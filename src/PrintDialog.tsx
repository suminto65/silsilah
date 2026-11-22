import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Modal from './Modal'
import { layout, NODE_W } from './layout'
import type { Person, Relation } from './types'

const PAPER = { A4: [210, 297], A3: [297, 420], A2: [420, 594] } as const
type PaperKey = keyof typeof PAPER
const MARGIN = 8 // mm

const wrap = (name: string, max = 17): string[] => {
  const lines: string[] = []
  let cur = ''
  for (const w of name.split(/\s+/)) {
    const t = (cur + ' ' + w).trim()
    if (t.length <= max) cur = t
    else { if (cur) lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  if (lines.length > 2) lines.splice(1, lines.length - 1, lines.slice(1).join(' '))
  return lines.map((l) => (l.length > max ? l.slice(0, max - 1) + '…' : l))
}
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const yr = (d: string | null) => (d ? d.slice(0, 4) : '')
const years = (p: Person) =>
  p.birth_date && p.death_date ? `${yr(p.birth_date)} – ${yr(p.death_date)}`
    : p.birth_date ? yr(p.birth_date) : p.death_date ? `– ${yr(p.death_date)}` : ''

function geometry(persons: Person[], rels: Relation[], centerId: string | null, photos: boolean, details: boolean) {
  const pos = layout(persons, rels, centerId)
  const NH = (photos ? 56 : 14) + 28 + 16 + (details ? 30 : 0) + 8
  const ys = (NH + 50) / 160
  const P = new Map<string, { x: number; y: number }>()
  pos.forEach((p, id) => P.set(id, { x: p.x, y: p.y * ys }))
  const xs = [...P.values()].map((p) => p.x)
  const yv = [...P.values()].map((p) => p.y)
  let minX = Math.min(...xs) - 30, maxX = Math.max(...xs) + NODE_W + 30
  const minY = Math.min(...yv) - 80, maxY = Math.max(...yv) + NH + 50
  if (maxX - minX < 520) { const e = (520 - (maxX - minX)) / 2; minX -= e; maxX += e }
  return { P, NH, vb: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } }
}

function TreeSvg({ persons, rels, centerId, treeName, photos, details, idp, style }: {
  persons: Person[]; rels: Relation[]; centerId: string | null; treeName: string
  photos: boolean; details: boolean; idp: string; style?: React.CSSProperties
}) {
  const { P, NH, vb } = useMemo(() => geometry(persons, rels, centerId, photos, details),
    [persons, rels, centerId, photos, details])
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet" fontFamily="Arial, Helvetica, sans-serif" style={{ display: 'block', ...style }}>
      <text x={vb.x + 30} y={vb.y + 32} fontSize={22} fontWeight="bold">{treeName} — Silsilah Keluarga</text>
      <text x={vb.x + 30} y={vb.y + 50} fontSize={11} fill="#555">Dicetak {today}</text>

      {rels.filter((r) => r.type === 'parent_of' && P.has(r.a_id) && P.has(r.b_id)).map((r) => {
        const a = P.get(r.a_id)!, b = P.get(r.b_id)!
        const x1 = a.x + NODE_W / 2, y1 = a.y + NH, x2 = b.x + NODE_W / 2, y2 = b.y
        const ym = y1 + (y2 - y1) / 2
        return <path key={r.id} d={`M${x1} ${y1} V${ym} H${x2} V${y2}`} fill="none" stroke="#666" strokeWidth={1.3} />
      })}
      {rels.filter((r) => r.type === 'partner_of' && P.has(r.a_id) && P.has(r.b_id)).map((r) => {
        const a = P.get(r.a_id)!, b = P.get(r.b_id)!
        const [l, rt] = a.x <= b.x ? [a, b] : [b, a]
        return <line key={r.id} x1={l.x + NODE_W} y1={l.y + NH / 2} x2={rt.x} y2={rt.y + NH / 2}
          stroke="#d33" strokeWidth={1.6} strokeDasharray="5 4" />
      })}

      {persons.map((p) => {
        const pt = P.get(p.id)
        if (!pt) return null
        const fill = p.gender === 'L' ? '#e3f0ff' : p.gender === 'P' ? '#ffe6ef' : '#f1f1f1'
        const isC = p.id === (centerId ?? persons[0]?.id)
        const lines = wrap(p.full_name)
        const y0 = photos ? 67 : 25
        const yy = y0 + (lines.length - 1) * 14 + 14
        const cid = `${idp}-c-${p.id}`
        return (
          <g key={p.id} transform={`translate(${pt.x} ${pt.y})`}>
            <rect width={NODE_W} height={NH} rx={10} fill={fill} stroke={isC ? '#e0a800' : '#888'} strokeWidth={isC ? 3 : 1} />
            {photos && (p.photo
              ? <>
                  <clipPath id={cid}><circle cx={NODE_W / 2} cy={30} r={22} /></clipPath>
                  <image href={p.photo} x={NODE_W / 2 - 22} y={8} width={44} height={44}
                    clipPath={`url(#${cid})`} preserveAspectRatio="xMidYMid slice" />
                </>
              : <>
                  <circle cx={NODE_W / 2} cy={30} r={22} fill="#ccc" />
                  <text x={NODE_W / 2} y={38} fontSize={22} textAnchor="middle" fill="#fff">{p.full_name.slice(0, 1).toUpperCase()}</text>
                </>)}
            {lines.map((l, i) => (
              <text key={i} x={NODE_W / 2} y={y0 + i * 14} fontSize={12} fontWeight="bold" textAnchor="middle">{l}</text>
            ))}
            <text x={NODE_W / 2} y={yy} fontSize={10} textAnchor="middle" fill="#555">{years(p)}</text>
            {details && p.address && <text x={NODE_W / 2} y={yy + 13} fontSize={9} textAnchor="middle" fill="#333">{trunc(p.address, 28)}</text>}
            {details && p.phone && <text x={NODE_W / 2} y={yy + 25} fontSize={9} textAnchor="middle" fill="#333">{trunc(p.phone, 28)}</text>}
          </g>
        )
      })}
      <text x={vb.x + 30} y={vb.y + vb.h - 16} fontSize={10} fill="#555">
        Garis putus-putus merah = pasangan · Bingkai emas = pusat tampilan
      </text>
    </svg>
  )
}

export default function PrintDialog({ persons, rels, centerId, treeName, onClose }: {
  persons: Person[]; rels: Relation[]; centerId: string | null; treeName: string; onClose: () => void
}) {
  const [paper, setPaper] = useState<PaperKey>('A4')
  const [orient, setOrient] = useState<'auto' | 'landscape' | 'portrait'>('auto')
  const [photos, setPhotos] = useState(true)
  const [details, setDetails] = useState(false)

  const g = useMemo(() => geometry(persons, rels, centerId, photos, details), [persons, rels, centerId, photos, details])
  const land = orient === 'auto' ? g.vb.w >= g.vb.h : orient === 'landscape'
  const [pw, ph] = PAPER[paper]
  const W = land ? ph : pw
  const H = land ? pw : ph
  const printRoot = document.getElementById('print-root')
  const common = { persons, rels, centerId, treeName, photos, details }

  return (
    <Modal title="Cetak / Simpan PDF" onClose={onClose}>
      <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
        <label>Ukuran kertas{' '}
          <select value={paper} onChange={(e) => setPaper(e.target.value as PaperKey)}>
            <option value="A4">A4</option>
            <option value="A3">A3 (keluarga besar)</option>
            <option value="A2">A2 (sangat besar)</option>
          </select>
        </label>
        <label>Arah kertas{' '}
          <select value={orient} onChange={(e) => setOrient(e.target.value as typeof orient)}>
            <option value="auto">Otomatis</option>
            <option value="landscape">Mendatar</option>
            <option value="portrait">Tegak</option>
          </select>
        </label>
        <label><input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} /> Sertakan foto</label>
        <label><input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} /> Sertakan alamat dan No. HP</label>
        <div style={{ aspectRatio: `${W} / ${H}`, width: '100%', border: '1px solid #999', background: '#fff' }}>
          <TreeSvg {...common} idp="pv" style={{ width: '100%', height: '100%' }} />
        </div>
        <small style={{ color: '#555' }}>
          Pratinjau {paper} {land ? 'mendatar' : 'tegak'}. Pohon dimuat dalam satu lembar. Di jendela cetak pilih
          <b> Simpan sebagai PDF</b>, dan matikan <b>Header dan footer</b> agar bersih.
        </small>
        <button style={{ padding: 10, background: '#2f6f4f', color: '#fff', border: 0, borderRadius: 6 }}
          onClick={() => window.print()}>Cetak / Simpan sebagai PDF</button>
      </div>
      {printRoot && createPortal(
        <>
          <style>{`@page { size: ${paper} ${land ? 'landscape' : 'portrait'}; margin: ${MARGIN}mm; }`}</style>
          <TreeSvg {...common} idp="pr" style={{ width: `${W - 2 * MARGIN - 1}mm`, height: `${H - 2 * MARGIN - 1}mm` }} />
        </>, printRoot)}
    </Modal>
  )
}
