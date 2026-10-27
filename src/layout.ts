import type { Person, Relation } from './types'

export const W = 190
export const H = 150

// Tata letak sederhana: baris = generasi, pasangan selalu bersebelahan,
// urutan tiap baris mengikuti posisi rata-rata orang tuanya.
export function layout(persons: Person[], rels: Relation[]) {
  const gen = new Map<string, number>(persons.map((p) => [p.id, 0]))
  const par = rels.filter((r) => r.type === 'parent_of')
  const pt = rels.filter((r) => r.type === 'partner_of')

  for (let i = 0; i < 60; i++) {
    let changed = false
    for (const r of par) {
      const g = (gen.get(r.a_id) ?? 0) + 1
      if ((gen.get(r.b_id) ?? 0) < g) { gen.set(r.b_id, g); changed = true }
    }
    for (const r of pt) {
      const m = Math.max(gen.get(r.a_id) ?? 0, gen.get(r.b_id) ?? 0)
      for (const id of [r.a_id, r.b_id]) if (gen.get(id) !== m) { gen.set(id, m); changed = true }
    }
    if (!changed) break
  }

  // kelompokkan pasangan
  const root = new Map<string, string>(persons.map((p) => [p.id, p.id]))
  const find = (x: string): string => (root.get(x) === x ? x : find(root.get(x)!))
  for (const r of pt) root.set(find(r.a_id), find(r.b_id))

  const levels = new Map<number, string[]>()
  for (const p of persons) {
    const g = gen.get(p.id) ?? 0
    levels.set(g, [...(levels.get(g) ?? []), p.id])
  }

  const x = new Map<string, number>()
  const pos = new Map<string, { x: number; y: number }>()
  for (const g of [...levels.keys()].sort((a, b) => a - b)) {
    const units = new Map<string, string[]>()
    for (const id of levels.get(g)!) units.set(find(id), [...(units.get(find(id)) ?? []), id])
    const keyed = [...units.values()].map((members, i) => {
      const xs = members.flatMap((m) =>
        par.filter((r) => r.b_id === m && x.has(r.a_id)).map((r) => x.get(r.a_id)!))
      return { members, i, key: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Infinity }
    })
    keyed.sort((a, b) => (a.key === b.key ? a.i - b.i : a.key - b.key))
    let cursor = 0
    for (const u of keyed) for (const id of u.members) {
      x.set(id, cursor)
      pos.set(id, { x: cursor, y: g * H })
      cursor += W
    }
  }
  return pos
}
