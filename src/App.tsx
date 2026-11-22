import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import TreeView from './TreeView'
import PersonForm, { type PersonValues } from './PersonForm'
import MembersPanel from './MembersPanel'
import HistoryPanel from './HistoryPanel'
import { ROLE_LABEL, type Member, type Person, type Relation } from './types'

const PENDING = 'pending_invite'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState<string | null>(() => {
    const t = new URLSearchParams(location.search).get('invite')
    if (t) { localStorage.setItem(PENDING, t); history.replaceState(null, '', location.pathname) }
    return localStorage.getItem(PENDING)
  })
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!ready) return <p style={{ padding: 20 }}>Memuat…</p>
  if (!session) return <Login invited={!!pending} />
  if (pending) return <InviteGate token={pending} onDone={() => setPending(null)} />
  return <Main userId={session.user.id} />
}

function InviteGate({ token, onDone }: { token: string; onDone: () => void }) {
  const [info, setInfo] = useState<{ tree_name: string; role: string; valid: boolean } | null | undefined>(undefined)
  const [err, setErr] = useState('')
  useEffect(() => {
    supabase.rpc('invite_info', { p_token: token }).then(({ data, error }) => {
      if (error) setErr(error.message)
      else setInfo(data?.[0] ?? null)
    })
  }, [token])
  const finish = () => { localStorage.removeItem(PENDING); onDone() }
  const accept = async () => {
    const r = await supabase.rpc('accept_invite', { p_token: token })
    if (r.error) { setErr(r.error.message); return }
    localStorage.setItem('tree_id', r.data as string)
    finish()
  }
  const roleText = info ? ROLE_LABEL[info.role as 'editor' | 'viewer'] ?? info.role : ''
  return (
    <div style={{ maxWidth: 360, margin: '15vh auto', fontFamily: 'sans-serif', display: 'grid', gap: 10, padding: 12 }}>
      <h2>Undangan Silsilah Keluarga</h2>
      {info === undefined && !err && <p>Memeriksa undangan…</p>}
      {info === null && <p>Tautan undangan tidak dikenal.</p>}
      {info && !info.valid && <p>Tautan undangan sudah kedaluwarsa, dicabut, atau penuh. Minta tautan baru kepada pengirimnya.</p>}
      {info?.valid && <p>Anda diundang bergabung ke <b>{info.tree_name}</b> sebagai <b>{roleText}</b>.</p>}
      {err && <small style={{ color: '#b00' }}>{err}</small>}
      {info?.valid && <button style={{ padding: 10 }} onClick={accept}>Gabung</button>}
      <button style={{ padding: 10 }} onClick={finish}>{info?.valid ? 'Nanti saja' : 'Lanjut'}</button>
    </div>
  )
}

function Login({ invited }: { invited: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const go = async (mode: 'in' | 'up') => {
    const r = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (r.error) setMsg(r.error.message)
    else if (mode === 'up' && !r.data.session) setMsg('Pendaftaran berhasil. Cek email untuk konfirmasi, lalu masuk.')
  }
  return (
    <div style={{ maxWidth: 320, margin: '15vh auto', fontFamily: 'sans-serif', display: 'grid', gap: 8 }}>
      <h2>Silsilah Keluarga</h2>
      {invited && <small>Anda menerima undangan. Daftar atau masuk dulu, lalu undangan akan dilanjutkan.</small>}
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Kata sandi" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={() => go('in')}>Masuk</button>
      <button onClick={() => go('up')}>Daftar</button>
      <small style={{ color: '#b00' }}>{msg}</small>
    </div>
  )
}

type Rel = 'first' | 'parent' | 'child' | 'partner' | 'sibling'
type FormState = { mode: 'add'; rel: Rel } | { mode: 'edit' } | null
type TreeInfo = { id: string; name: string }

const TITLES: Record<Rel, string> = {
  first: 'Tambah orang pertama (Saya)', parent: 'Tambah orang tua', child: 'Tambah anak',
  partner: 'Tambah pasangan', sibling: 'Tambah saudara',
}

function Main({ userId }: { userId: string }) {
  const [trees, setTrees] = useState<TreeInfo[]>([])
  const [treeId, setTreeId] = useState<string>()
  const [defaultRoot, setDefaultRoot] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [rels, setRels] = useState<Relation[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(null)
  const [panel, setPanel] = useState<'members' | 'history' | null>(null)
  const [recenter, setRecenter] = useState(0)
  const [msg, setMsg] = useState('')

  const me = members.find((m) => m.user_id === userId)
  const role = me?.role
  const canEdit = role === 'owner' || role === 'editor'
  const centerId = me?.person_id ?? defaultRoot

  const load = useCallback(async (tid: string) => {
    const [t, p, r, m] = await Promise.all([
      supabase.from('trees').select('root_person_id').eq('id', tid).single(),
      supabase.from('persons').select('*').eq('tree_id', tid).order('created_at'),
      supabase.from('relations').select('*').eq('tree_id', tid),
      supabase.from('tree_members').select('*').eq('tree_id', tid),
    ])
    const err = t.error || p.error || r.error || m.error
    if (err) { setMsg(err.message); return }
    setDefaultRoot(t.data.root_person_id)
    setPersons(p.data as Person[])
    setRels(r.data as Relation[])
    setMembers(m.data as Member[])
  }, [])

  useEffect(() => {
    (async () => {
      const ts = await supabase.from('trees').select('id,name').order('created_at')
      let list = (ts.data ?? []) as TreeInfo[]
      if (!list.length) {
        const ins = await supabase.from('trees').insert({ name: 'Keluarga Saya' }).select('id,name').single()
        if (ins.error) { setMsg(ins.error.message); return }
        list = [ins.data as TreeInfo]
      }
      setTrees(list)
      const saved = localStorage.getItem('tree_id')
      setTreeId(list.find((t) => t.id === saved)?.id ?? list[0].id)
    })()
  }, [])

  useEffect(() => {
    if (!treeId) return
    localStorage.setItem('tree_id', treeId)
    setSel(null)
    load(treeId)
  }, [treeId, load])

  // pembaruan langsung saat anggota lain mengubah data
  useEffect(() => {
    if (!treeId) return
    let timer: number | undefined
    const reload = () => { clearTimeout(timer); timer = window.setTimeout(() => load(treeId), 400) }
    const ch = supabase.channel('tree-' + treeId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'persons' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'relations' }, reload)
      .subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(ch) }
  }, [treeId, load])

  const selected = persons.find((p) => p.id === sel)

  const openAdd = (rel: Rel) => {
    if (rel === 'sibling' && !rels.some((r) => r.type === 'parent_of' && r.b_id === sel)) {
      alert('Tambahkan orang tua dulu, agar saudara bisa dihubungkan.'); return
    }
    setForm({ mode: 'add', rel })
  }

  const save = async (v: PersonValues) => {
    if (!treeId || !form) return
    if (form.mode === 'edit') {
      if (!selected) return
      const r = await supabase.from('persons').update(v).eq('id', selected.id)
      if (r.error) { setMsg(r.error.message); return }
      setForm(null)
      await load(treeId)
      return
    }
    const rel = form.rel
    const p = await supabase.from('persons').insert({ tree_id: treeId, ...v }).select('id').single()
    if (p.error) { setMsg(p.error.message); return }
    const n = p.data.id as string
    let rows: { type: string; a_id: string; b_id: string }[] = []
    if (sel) {
      if (rel === 'parent') rows = [{ type: 'parent_of', a_id: n, b_id: sel }]
      if (rel === 'child') rows = [{ type: 'parent_of', a_id: sel, b_id: n }]
      if (rel === 'partner') rows = [{ type: 'partner_of', a_id: sel, b_id: n }]
      if (rel === 'sibling')
        rows = rels.filter((r) => r.type === 'parent_of' && r.b_id === sel).map((r) => ({ type: 'parent_of', a_id: r.a_id, b_id: n }))
    }
    if (rows.length) {
      const r = await supabase.from('relations').insert(rows.map((x) => ({ ...x, tree_id: treeId })))
      if (r.error) setMsg(r.error.message)
    }
    if (rel === 'first') {
      const a = await supabase.rpc('set_my_person', { p_tree: treeId, p_person: n })
      if (a.error) setMsg(a.error.message)
      await supabase.from('trees').update({ root_person_id: n }).eq('id', treeId)
    }
    setForm(null)
    await load(treeId)
    setSel(n)
  }

  const makeCenter = async () => {
    if (!selected || !treeId) return
    const r = await supabase.rpc('set_my_person', { p_tree: treeId, p_person: selected.id })
    if (r.error) { setMsg(r.error.message); return }
    await load(treeId)
    setRecenter((k) => k + 1)
  }

  const remove = async () => {
    if (!selected || !treeId) return
    if (!confirm(`Hapus ${selected.full_name} beserta semua hubungannya? (Bisa dipulihkan dari Riwayat, tanpa foto.)`)) return
    const r = await supabase.from('persons').delete().eq('id', selected.id)
    if (r.error) setMsg(r.error.message)
    setSel(null)
    await load(treeId)
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: 2, persons, relations: rels }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'silsilah.json'
    a.click()
  }

  const importJson = async (f: File) => {
    if (!treeId) return
    try {
      const d = JSON.parse(await f.text())
      const map = new Map<string, string>()
      const ps = (d.persons as Person[]).map((p) => {
        const id = crypto.randomUUID()
        map.set(p.id, id)
        return { id, tree_id: treeId, full_name: p.full_name, gender: p.gender, birth_date: p.birth_date,
          death_date: p.death_date, address: p.address ?? null, phone: p.phone ?? null, photo: p.photo ?? null, notes: p.notes }
      })
      const rs = (d.relations as Relation[]).filter((r) => map.has(r.a_id) && map.has(r.b_id))
        .map((r) => ({ tree_id: treeId, type: r.type, a_id: map.get(r.a_id)!, b_id: map.get(r.b_id)! }))
      const a = await supabase.from('persons').insert(ps)
      if (a.error) throw a.error
      const b = await supabase.from('relations').insert(rs)
      if (b.error) throw b.error
      await load(treeId)
    } catch (e) { setMsg('Gagal impor: ' + (e as Error).message) }
  }

  const btn = { padding: '6px 10px' }
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 8, alignItems: 'center', borderBottom: '1px solid #ddd' }}>
        <b style={{ marginRight: 'auto' }}>
          Silsilah Keluarga{role && <span style={{ fontWeight: 'normal', fontSize: 12, color: '#555' }}> · {ROLE_LABEL[role]}</span>}
        </b>
        {trees.length > 1 && (
          <select value={treeId} onChange={(e) => setTreeId(e.target.value)}>
            {trees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <button style={btn} onClick={() => setRecenter((k) => k + 1)}>⌖ Pusatkan</button>
        <button style={btn} onClick={() => setPanel('members')}>Anggota</button>
        <button style={btn} onClick={() => setPanel('history')}>Riwayat</button>
        <button style={btn} onClick={exportJson}>Ekspor</button>
        {canEdit && (
          <label style={{ ...btn, border: '1px solid #888', borderRadius: 4, cursor: 'pointer' }}>
            Impor<input type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </label>
        )}
        <button style={btn} onClick={() => supabase.auth.signOut()}>Keluar</button>
      </header>
      {msg && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: '#fee', color: '#900', padding: 8 }} onClick={() => setMsg('')}>{msg} (ketuk untuk menutup)</div>}
      {role && !me?.person_id && persons.length > 0 && (
        <div style={{ background: '#eef6ff', padding: 8, fontSize: 13 }}>
          Klik kartu Anda, lalu tekan <b>⭐ Jadikan pusat (Saya)</b> agar tampilan berpusat pada Anda.
          {canEdit && ' Kalau Anda belum ada di pohon, tambahkan diri Anda lewat kartu kerabat terdekat.'}
        </div>
      )}
      <div style={{ flex: 1, position: 'relative' }}>
        {persons.length === 0 && treeId
          ? <div style={{ padding: 30 }}>
              {canEdit
                ? <button style={btn} onClick={() => setForm({ mode: 'add', rel: 'first' })}>+ Tambah orang pertama (Saya)</button>
                : <p>Pohon ini masih kosong.</p>}
            </div>
          : <TreeView persons={persons} rels={rels} rootId={centerId} sel={sel} onSelect={setSel} recenterKey={recenter} />}
      </div>
      {selected && (
        <footer style={{ padding: 8, borderTop: '1px solid #ddd', display: 'grid', gap: 6, maxHeight: '38dvh', overflow: 'auto' }}>
          <div>
            <b>{selected.full_name}</b>
            {selected.address && <div style={{ fontSize: 13 }}>📍 {selected.address}</div>}
            {selected.phone && <div style={{ fontSize: 13 }}>📞 <a href={`tel:${selected.phone}`}>{selected.phone}</a></div>}
            {selected.notes && <div style={{ fontSize: 13, color: '#555' }}>📝 {selected.notes}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {canEdit && <>
              <button style={btn} onClick={() => openAdd('parent')}>↑ Orang tua</button>
              <button style={btn} onClick={() => openAdd('child')}>↓ Anak</button>
              <button style={btn} onClick={() => openAdd('partner')}>↔ Pasangan</button>
              <button style={btn} onClick={() => openAdd('sibling')}>⇆ Saudara</button>
              <button style={btn} onClick={() => setForm({ mode: 'edit' })}>Ubah</button>
            </>}
            {selected.id !== centerId && <button style={btn} onClick={makeCenter}>⭐ Jadikan pusat (Saya)</button>}
            {canEdit && <button style={{ ...btn, color: '#b00' }} onClick={remove}>Hapus</button>}
          </div>
        </footer>
      )}
      {form && canEdit && (
        <PersonForm
          key={form.mode === 'edit' ? selected?.id : form.rel}
          title={form.mode === 'edit' ? 'Ubah data' : TITLES[form.rel]}
          initial={form.mode === 'edit' ? selected : undefined}
          onSave={save} onCancel={() => setForm(null)} />
      )}
      {panel === 'members' && treeId && (
        <MembersPanel treeId={treeId} userId={userId} role={role} members={members} persons={persons}
          onClose={() => setPanel(null)} onChanged={() => load(treeId)} onError={setMsg} />
      )}
      {panel === 'history' && treeId && (
        <HistoryPanel treeId={treeId} canEdit={canEdit} onClose={() => setPanel(null)}
          onRestored={() => load(treeId)} onError={setMsg} />
      )}
    </div>
  )
}
