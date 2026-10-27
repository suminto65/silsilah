import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import TreeView from './TreeView'
import type { Person, Relation } from './types'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!ready) return <p style={{ padding: 20 }}>Memuat…</p>
  return session ? <Main /> : <Login />
}

function Login() {
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
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Kata sandi" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={() => go('in')}>Masuk</button>
      <button onClick={() => go('up')}>Daftar</button>
      <small style={{ color: '#b00' }}>{msg}</small>
    </div>
  )
}

type Rel = 'first' | 'parent' | 'child' | 'partner' | 'sibling'

function Main() {
  const [treeId, setTreeId] = useState<string>()
  const [persons, setPersons] = useState<Person[]>([])
  const [rels, setRels] = useState<Relation[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async (tid: string) => {
    const [p, r] = await Promise.all([
      supabase.from('persons').select('*').eq('tree_id', tid),
      supabase.from('relations').select('*').eq('tree_id', tid),
    ])
    const err = p.error || r.error
    if (err) { setMsg(err.message); return }
    setPersons(p.data as Person[])
    setRels(r.data as Relation[])
  }, [])

  useEffect(() => {
    (async () => {
      let { data } = await supabase.from('trees').select('id').order('created_at').limit(1)
      if (!data?.length) {
        const ins = await supabase.from('trees').insert({ name: 'Keluarga Saya' }).select('id').single()
        if (ins.error) { setMsg(ins.error.message); return }
        data = [ins.data]
      }
      setTreeId(data[0].id)
      load(data[0].id)
    })()
  }, [load])

  const selected = persons.find((p) => p.id === sel)

  const addPerson = async (rel: Rel) => {
    if (!treeId) return
    const parents = rels.filter((r) => r.type === 'parent_of' && r.b_id === sel)
    if (rel === 'sibling' && !parents.length) { alert('Tambahkan orang tua dulu, agar saudara bisa dihubungkan.'); return }
    const name = prompt('Nama lengkap:')
    if (!name) return
    const g = (prompt('Jenis kelamin (L/P, kosongkan jika belum diketahui):') || '').toUpperCase()
    const p = await supabase.from('persons')
      .insert({ tree_id: treeId, full_name: name, gender: g === 'L' || g === 'P' ? g : null })
      .select('id').single()
    if (p.error) { setMsg(p.error.message); return }
    const n = p.data.id as string
    let rows: { type: string; a_id: string; b_id: string }[] = []
    if (sel) {
      if (rel === 'parent') rows = [{ type: 'parent_of', a_id: n, b_id: sel }]
      if (rel === 'child') rows = [{ type: 'parent_of', a_id: sel, b_id: n }]
      if (rel === 'partner') rows = [{ type: 'partner_of', a_id: sel, b_id: n }]
      if (rel === 'sibling') rows = parents.map((r) => ({ type: 'parent_of', a_id: r.a_id, b_id: n }))
    }
    if (rows.length) {
      const r = await supabase.from('relations').insert(rows.map((x) => ({ ...x, tree_id: treeId })))
      if (r.error) setMsg(r.error.message)
    }
    await load(treeId)
    setSel(n)
  }

  const edit = async () => {
    if (!selected || !treeId) return
    const full_name = prompt('Nama lengkap:', selected.full_name)
    if (!full_name) return
    const birth = prompt('Tanggal lahir (YYYY-MM-DD, boleh kosong):', selected.birth_date ?? '')
    const death = prompt('Tanggal wafat (YYYY-MM-DD, boleh kosong):', selected.death_date ?? '')
    const r = await supabase.from('persons')
      .update({ full_name, birth_date: birth || null, death_date: death || null }).eq('id', selected.id)
    if (r.error) setMsg(r.error.message)
    await load(treeId)
  }

  const remove = async () => {
    if (!selected || !treeId) return
    if (!confirm(`Hapus ${selected.full_name} beserta semua hubungannya?`)) return
    const r = await supabase.from('persons').delete().eq('id', selected.id)
    if (r.error) setMsg(r.error.message)
    setSel(null)
    await load(treeId)
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: 1, persons, relations: rels }, null, 2)], { type: 'application/json' })
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
        return { id, tree_id: treeId, full_name: p.full_name, gender: p.gender, birth_date: p.birth_date, death_date: p.death_date, notes: p.notes }
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
        <b style={{ marginRight: 'auto' }}>Silsilah Keluarga</b>
        <button style={btn} onClick={exportJson}>Ekspor</button>
        <label style={{ ...btn, border: '1px solid #888', borderRadius: 4, cursor: 'pointer' }}>
          Impor<input type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </label>
        <button style={btn} onClick={() => supabase.auth.signOut()}>Keluar</button>
      </header>
      {msg && <div style={{ background: '#fee', color: '#900', padding: 6 }} onClick={() => setMsg('')}>{msg}</div>}
      <div style={{ flex: 1, position: 'relative' }}>
        {persons.length === 0 && treeId
          ? <div style={{ padding: 30 }}><button style={btn} onClick={() => addPerson('first')}>+ Tambah orang pertama</button></div>
          : <TreeView persons={persons} rels={rels} sel={sel} onSelect={setSel} />}
      </div>
      {selected && (
        <footer style={{ padding: 8, borderTop: '1px solid #ddd', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <b style={{ marginRight: 'auto' }}>{selected.full_name}</b>
          <button style={btn} onClick={() => addPerson('parent')}>↑ Orang tua</button>
          <button style={btn} onClick={() => addPerson('child')}>↓ Anak</button>
          <button style={btn} onClick={() => addPerson('partner')}>↔ Pasangan</button>
          <button style={btn} onClick={() => addPerson('sibling')}>⇆ Saudara</button>
          <button style={btn} onClick={edit}>Ubah</button>
          <button style={{ ...btn, color: '#b00' }} onClick={remove}>Hapus</button>
        </footer>
      )}
    </div>
  )
}
