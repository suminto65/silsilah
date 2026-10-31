import { useState } from 'react'
import type { Person } from './types'

export type PersonValues = Pick<Person,
  'full_name' | 'gender' | 'birth_date' | 'death_date' | 'address' | 'phone' | 'photo' | 'notes'>

// foto dipotong persegi & dikecilkan (240px) agar ringan disimpan
async function toAvatar(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const S = 240, side = Math.min(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = S; c.height = S
  c.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, S, S)
  return c.toDataURL('image/jpeg', 0.75)
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 16 }
const lbl: React.CSSProperties = { display: 'grid', gap: 3, fontSize: 13, color: '#333' }

export default function PersonForm({ title, initial, onSave, onCancel }: {
  title: string; initial?: Partial<PersonValues>
  onSave: (v: PersonValues) => void | Promise<void>; onCancel: () => void
}) {
  const [v, setV] = useState<PersonValues>({
    full_name: '', gender: null, birth_date: null, death_date: null,
    address: null, phone: null, photo: null, notes: null, ...initial,
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof PersonValues>(k: K, val: PersonValues[K]) => setV((s) => ({ ...s, [k]: val }))

  const submit = async () => {
    if (!v.full_name.trim()) { setErr('Nama wajib diisi.'); return }
    if (v.birth_date && v.death_date && v.death_date < v.birth_date) {
      setErr('Tanggal meninggal tidak boleh sebelum tanggal lahir.'); return
    }
    setBusy(true)
    await onSave({
      ...v, full_name: v.full_name.trim(),
      birth_date: v.birth_date || null, death_date: v.death_date || null,
      address: v.address?.trim() || null, phone: v.phone?.trim() || null, notes: v.notes?.trim() || null,
    })
    setBusy(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, maxHeight: '92dvh',
        overflow: 'auto', padding: 16, display: 'grid', gap: 10, fontFamily: 'sans-serif' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {v.photo
            ? <img src={v.photo} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#ddd', display: 'grid', placeItems: 'center', color: '#777', fontSize: 12 }}>Foto</div>}
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ border: '1px solid #888', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>
              {v.photo ? 'Ganti foto' : 'Pilih foto'}
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) { try { set('photo', await toAvatar(f)) } catch { setErr('Foto tidak bisa dibaca.') } }
              }} />
            </label>
            {v.photo && <button type="button" onClick={() => set('photo', null)}>Hapus foto</button>}
          </div>
        </div>

        <label style={lbl}>Nama lengkap *
          <input style={inp} value={v.full_name} onChange={(e) => set('full_name', e.target.value)} autoFocus />
        </label>
        <label style={lbl}>Jenis kelamin
          <select style={inp} value={v.gender ?? ''} onChange={(e) => set('gender', (e.target.value || null) as Person['gender'])}>
            <option value="">Belum diketahui</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </label>
        <label style={lbl}>Tanggal lahir
          <input style={inp} type="date" value={v.birth_date ?? ''} onChange={(e) => set('birth_date', e.target.value || null)} />
        </label>
        <label style={lbl}>Tanggal meninggal (kosongkan jika masih hidup)
          <input style={inp} type="date" value={v.death_date ?? ''} onChange={(e) => set('death_date', e.target.value || null)} />
        </label>
        <label style={lbl}>Alamat
          <textarea style={inp} rows={2} value={v.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </label>
        <label style={lbl}>No. HP
          <input style={inp} type="tel" inputMode="tel" value={v.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
        </label>
        <label style={lbl}>Catatan
          <textarea style={inp} rows={3} value={v.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </label>

        {err && <div style={{ color: '#b00', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={{ padding: '8px 14px' }} onClick={onCancel} disabled={busy}>Batal</button>
          <button type="button" style={{ padding: '8px 14px', background: '#2f6f4f', color: '#fff', border: 0, borderRadius: 4 }}
            onClick={submit} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  )
}
