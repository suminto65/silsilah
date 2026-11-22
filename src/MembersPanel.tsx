import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import Modal from './Modal'
import { ROLE_LABEL, type Invite, type Member, type Person, type Role } from './types'

export default function MembersPanel({ treeId, userId, role, members, persons, onClose, onChanged, onError }: {
  treeId: string; userId: string; role: Role | undefined; members: Member[]; persons: Person[]
  onClose: () => void; onChanged: () => void; onError: (m: string) => void
}) {
  const isOwner = role === 'owner'
  const [invites, setInvites] = useState<Invite[]>([])
  const [newRole, setNewRole] = useState<'editor' | 'viewer'>('viewer')
  const [copied, setCopied] = useState('')

  const loadInv = useCallback(async () => {
    if (!isOwner) return
    const r = await supabase.from('invites').select('*').eq('tree_id', treeId).eq('revoked', false)
      .order('created_at', { ascending: false })
    if (r.error) onError(r.error.message)
    else setInvites((r.data as Invite[]).filter((i) => new Date(i.expires_at) > new Date() && i.uses < i.max_uses))
  }, [treeId, isOwner, onError])
  useEffect(() => { loadInv() }, [loadInv])

  const link = (t: string) => `${location.origin}/?invite=${t}`
  const createInvite = async () => {
    const r = await supabase.from('invites').insert({ tree_id: treeId, role: newRole })
    if (r.error) onError(r.error.message)
    await loadInv()
  }
  const revoke = async (id: string) => {
    const r = await supabase.from('invites').update({ revoked: true }).eq('id', id)
    if (r.error) onError(r.error.message)
    await loadInv()
  }
  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(link(t)); setCopied(t) } catch { prompt('Salin tautan ini:', link(t)) }
  }
  const wa = (i: Invite) => {
    const text = `Saya mengundang Anda mengisi silsilah keluarga kita (${ROLE_LABEL[i.role]}). Buka tautan ini lalu daftar/masuk: ${link(i.token)}`
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank')
  }
  const changeRole = async (uid: string, r: string) => {
    const x = await supabase.rpc('set_member_role', { p_tree: treeId, p_user: uid, p_role: r })
    if (x.error) onError(x.error.message)
    onChanged()
  }
  const remove = async (m: Member) => {
    const self = m.user_id === userId
    if (!confirm(self ? 'Keluar dari pohon keluarga ini?' : `Keluarkan ${m.email ?? 'anggota ini'}?`)) return
    const x = await supabase.rpc('remove_member', { p_tree: treeId, p_user: m.user_id })
    if (x.error) { onError(x.error.message); return }
    if (self) location.reload()
    else onChanged()
  }

  const b = { padding: '4px 8px' }
  return (
    <Modal title="Anggota & Undangan" onClose={onClose}>
      <div style={{ display: 'grid', gap: 8 }}>
        {members.map((m) => {
          const person = persons.find((p) => p.id === m.person_id)
          return (
            <div key={m.user_id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 8, fontSize: 14 }}>
              <div><b>{m.email ?? 'Anggota'}</b>{m.user_id === userId ? ' (Anda)' : ''}</div>
              <div style={{ color: '#555', fontSize: 12 }}>Kartu "Saya": {person ? person.full_name : 'belum dipilih'}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                {isOwner && m.role !== 'owner' ? (
                  <select value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value)}>
                    <option value="editor">Editor</option>
                    <option value="viewer">Pembaca</option>
                  </select>
                ) : <span>{ROLE_LABEL[m.role]}</span>}
                {m.role !== 'owner' && (isOwner || m.user_id === userId) &&
                  <button style={{ ...b, color: '#b00' }} onClick={() => remove(m)}>{m.user_id === userId ? 'Keluar' : 'Keluarkan'}</button>}
              </div>
            </div>
          )
        })}
      </div>

      {isOwner && (
        <div style={{ borderTop: '1px solid #ddd', paddingTop: 10, display: 'grid', gap: 8 }}>
          <b>Undang anggota keluarga</b>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'editor' | 'viewer')}>
              <option value="viewer">Pembaca (hanya melihat)</option>
              <option value="editor">Editor (boleh mengisi data)</option>
            </select>
            <button style={b} onClick={createInvite}>Buat tautan undangan</button>
          </div>
          <small style={{ color: '#555' }}>Tautan berlaku 7 hari dan bisa dipakai maksimal 10 orang. Bagikan hanya kepada keluarga.</small>
          {invites.map((i) => (
            <div key={i.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 8, fontSize: 13 }}>
              <div><b>{ROLE_LABEL[i.role]}</b> · dipakai {i.uses}/{i.max_uses} · sampai {new Date(i.expires_at).toLocaleDateString('id-ID')}</div>
              <div style={{ wordBreak: 'break-all', color: '#555' }}>{link(i.token)}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button style={b} onClick={() => copy(i.token)}>{copied === i.token ? 'Tersalin ✓' : 'Salin'}</button>
                <button style={b} onClick={() => wa(i)}>WhatsApp</button>
                <button style={{ ...b, color: '#b00' }} onClick={() => revoke(i.id)}>Cabut</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
