import type { ReactNode } from 'react'

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '92dvh',
        overflow: 'auto', padding: 16, display: 'grid', gap: 10, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, marginRight: 'auto' }}>{title}</h3>
          <button onClick={onClose} style={{ padding: '4px 10px' }}>Tutup</button>
        </div>
        {children}
      </div>
    </div>
  )
}
