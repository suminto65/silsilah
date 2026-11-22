import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import Modal from './Modal'
import type { LogEntry } from './types'

const ACT = { INSERT: 'menambah', UPDATE: 'mengubah', DELETE: 'menghapus' } as const

export default function HistoryPanel({ treeId, canEdit, onClose, onRestored, onError }: {
  treeId: string; canEdit: boolean; onClose: () => void; onRestored: () => void; onError: (m: string) => void
}) {
  const [items, setItems] = useState<LogEntry[] | null>(null)
  const load = useCallback(async () => {
    const r = await supabase.from('change_log')
      .select('id,user_email,action,table_name,summary,created_at')
      .eq('tree_id', treeId).order('id', { ascending: false }).limit(100)
    if (r.error) onError(r.error.message)
    else setItems(r.data as LogEntry[])
  }, [treeId, onError])
  useEffect(() => { load() }, [load])

  const restore = async (id: number) => {
    const r = await supabase.rpc('restore_person', { p_log: id })
    if (r.error) { onError(r.error.message); return }
    onRestored()
    await load()
  }

  return (
    <Modal title="Riwayat perubahan" onClose={onClose}>
      {items === null && <p>Memuat…</p>}
      {items?.length === 0 && <p>Belum ada catatan.</p>}
      {items?.map((x) => (
        <div key={x.id} style={{ borderBottom: '1px solid #eee', paddingBottom: 6, fontSize: 14 }}>
          <div style={{ fontSize: 12, color: '#666' }}>
            {new Date(x.created_at).toLocaleString('id-ID')} · {x.user_email ?? 'seseorang'}
          </div>
          <div>
            {ACT[x.action]} {x.table_name === 'persons' ? 'orang' : 'hubungan'}: <b>{x.summary}</b>
          </div>
          {canEdit && x.action === 'DELETE' && x.table_name === 'persons' &&
            <button style={{ padding: '3px 8px', marginTop: 3 }} onClick={() => restore(x.id)}>Pulihkan (tanpa foto)</button>}
        </div>
      ))}
    </Modal>
  )
}
