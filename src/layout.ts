import type { Person, Relation } from './types'

export const W = 190 // lebar sel per orang
export const H = 160 // jarak antar generasi
export const NODE_W = 150

interface Unit { members: string[]; left: number }

// Tata letak: baris = generasi, pasangan bersebelahan, anak diusahakan di bawah
// orang tuanya. Orang "pusat" (rootId) SELALU berada di posisi (20, 0);
// semua orang lain menyesuaikan terhadap dia.
export function layout(persons: Person[], rels: Relation[], rootId?: string | null) {
  const pos = new Map<string, { x: number; y: number }>()
  if (!persons.length) return pos

  const byId = new Map(persons.map((p, i) => [p.id, { p, i }]))
  const ok = (r: Relation) => byId.has(r.a_id) && byId.has(r.b_id)
  const par = rels.filter((r) => r.type === 'parent_of' && ok(r))
  const pt = rels.filter((r) => r.type === 'partner_of' && ok(r))

  // generasi
  const gen = new Map<string, number>(persons.map((p) => [p.id, 0]))
  for (let i = 0; i < 60; i++) {
    let changed = false
    for (const r of par) {
      const g = gen.get(r.a_id)! + 1
      if (gen.get(r.b_id)! < g) { gen.set(r.b_id, g); changed = true }
    }
    for (const r of pt) {
      const m = Math.max(gen.get(r.a_id)!, gen.get(r.b_id)!)
      for (const id of [r.a_id, r.b_id]) if (gen.get(id) !== m) { gen.set(id, m); changed = true }
    }
    if (!changed) break
  }

  // kelompok pasangan
  const uf = new Map<string, string>(persons.map((p) => [p.id, p.id]))
  const find = (x: string): string => { let r = x; while (uf.get(r) !== r) r = uf.get(r)!; return r }
  for (const r of pt) { const a = find(r.a_id), b = find(r.b_id); if (a !== b) uf.set(a, b) }

  const sortKey = (id: string) => {
    const { p, i } = byId.get(id)!
    return `${p.birth_date ?? '9999-99-99'}|${String(i).padStart(6, '0')}`
  }
  const rank = (id: string) => { const g = byId.get(id)!.p.gender; return g === 'L' ? 0 : g === 'P' ? 1 : 2 }

  const groups = new Map<string, string[]>()
  for (const p of persons) { const k = find(p.id); groups.set(k, [...(groups.get(k) ?? []), p.id]) }

  const rows = new Map<number, Unit[]>()
  const unitOf = new Map<string, Unit>()
  for (const members of groups.values()) {
    members.sort((a, b) => rank(a) - rank(b) || (sortKey(a) < sortKey(b) ? -1 : 1))
    const u: Unit = { members, left: 0 }
    members.forEach((m) => unitOf.set(m, u))
    const g = gen.get(members[0])!
    rows.set(g, [...(rows.get(g) ?? []), u])
  }
  const gens = [...rows.keys()].sort((a, b) => a - b)

  const cx = (id: string) => { const u = unitOf.get(id)!; return u.left + u.members.indexOf(id) * W + W / 2 }
  const parentsOf = (id: string) => par.filter((r) => r.b_id === id).map((r) => r.a_id)
  const childrenOf = (id: string) => par.filter((r) => r.a_id === id).map((r) => r.b_id)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)
  const wParents = (u: Unit) => mean(u.members.flatMap((m) => parentsOf(m).map(cx)))
  const wChildren = (u: Unit) => mean(u.members.flatMap((m) => childrenOf(m).map(cx)))
  const first = (u: Unit) => u.members.map(sortKey).sort()[0]

  // urutan awal tiap baris: mengikuti posisi orang tua, lalu urutan lahir
  for (const g of gens) {
    const row = rows.get(g)!
    row.sort((a, b) => {
      const ka = wParents(a) ?? Infinity, kb = wParents(b) ?? Infinity
      if (ka !== kb) return ka < kb ? -1 : 1
      return first(a) < first(b) ? -1 : 1
    })
    let c = 0
    for (const u of row) { u.left = c; c += u.members.length * W }
  }

  const pack = (row: Unit[], want: (number | undefined)[]) => {
    const target = row.map((u, i) => (want[i] !== undefined ? want[i]! - (u.members.length * W) / 2 : u.left))
    let end = -Infinity
    const out = target.map((t, i) => { const l = Math.max(t, end); end = l + row[i].members.length * W; return l })
    const idx = want.map((w, i) => (w !== undefined ? i : -1)).filter((i) => i >= 0)
    const d = idx.length ? idx.reduce((s, i) => s + target[i] - out[i], 0) / idx.length : 0
    row.forEach((u, i) => { u.left = out[i] + d })
  }

  for (let it = 0; it < 8; it++) {
    for (const g of gens) { const row = rows.get(g)!; pack(row, row.map(wParents)) }
    for (const g of [...gens].reverse()) { const row = rows.get(g)!; pack(row, row.map(wChildren)) }
  }

  const rid = rootId && byId.has(rootId) ? rootId : persons[0].id
  const ox = cx(rid) - W / 2
  const oy = gen.get(rid)!
  for (const p of persons) {
    pos.set(p.id, { x: cx(p.id) - W / 2 - ox + (W - NODE_W) / 2, y: (gen.get(p.id)! - oy) * H })
  }
  return pos
}
