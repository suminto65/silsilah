import { useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow, Background, Controls, Handle, Position, useReactFlow, useNodesInitialized,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { layout, W, NODE_W } from './layout'
import type { Person, Relation } from './types'

type PData = { p: Person; sel: boolean; root: boolean }

function PersonNode({ data }: NodeProps<Node<PData>>) {
  const { p, sel, root } = data
  const yr = (d: string | null) => (d ? d.slice(0, 4) : '')
  const years = p.birth_date || p.death_date ? `${yr(p.birth_date)} – ${yr(p.death_date)}` : ''
  const bg = p.gender === 'L' ? '#e3f0ff' : p.gender === 'P' ? '#ffe6ef' : '#f1f1f1'
  return (
    <div style={{ width: NODE_W, padding: 8, textAlign: 'center', borderRadius: 10, background: bg,
      border: sel ? '3px solid #2f6f4f' : root ? '2px solid #e0a800' : '1px solid #999', fontSize: 13 }}>
      <Handle id="t" type="target" position={Position.Top} />
      <Handle id="l" type="target" position={Position.Left} />
      {p.photo
        ? <img src={p.photo} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
        : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ccc', margin: '0 auto',
            lineHeight: '44px', fontSize: 20, color: '#fff' }}>{p.full_name.slice(0, 1).toUpperCase()}</div>}
      <div style={{ marginTop: 4 }}><b>{root ? '⭐ ' : ''}{p.full_name}</b></div>
      <div style={{ fontSize: 11, color: '#555' }}>{years}</div>
      <Handle id="r" type="source" position={Position.Right} />
      <Handle id="b" type="source" position={Position.Bottom} />
    </div>
  )
}
const nodeTypes = { person: PersonNode }

// Orang pusat selalu berada di (20, 0) dengan lebar NODE_W
function Recenter({ trigger }: { trigger: number }) {
  const { setCenter } = useReactFlow()
  const inited = useNodesInitialized()
  const done = useRef(false)
  const center = (duration: number) => setCenter(W / 2, 50, { zoom: 1, duration })
  useEffect(() => { if (inited && !done.current) { done.current = true; center(0) } }, [inited]) // eslint-disable-line
  useEffect(() => { if (trigger > 0) center(300) }, [trigger]) // eslint-disable-line
  return null
}

export default function TreeView({ persons, rels, rootId, sel, onSelect, recenterKey }: {
  persons: Person[]; rels: Relation[]; rootId: string | null; sel: string | null
  onSelect: (id: string | null) => void; recenterKey: number
}) {
  const { nodes, edges } = useMemo(() => {
    const pos = layout(persons, rels, rootId)
    const rid = rootId ?? persons[0]?.id
    const nodes: Node<PData>[] = persons.map((p) => ({
      id: p.id, type: 'person', position: pos.get(p.id) ?? { x: 0, y: 0 },
      data: { p, sel: p.id === sel, root: p.id === rid },
    }))
    const edges: Edge[] = rels.map((r) => {
      if (r.type === 'parent_of')
        return { id: r.id, type: 'smoothstep', source: r.a_id, target: r.b_id, sourceHandle: 'b', targetHandle: 't' }
      const left = (pos.get(r.a_id)?.x ?? 0) <= (pos.get(r.b_id)?.x ?? 0)
      return { id: r.id, source: left ? r.a_id : r.b_id, target: left ? r.b_id : r.a_id,
        sourceHandle: 'r', targetHandle: 'l', style: { stroke: '#d33', strokeDasharray: '5 4' } }
    })
    return { nodes, edges }
  }, [persons, rels, rootId, sel])

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} minZoom={0.2}
      nodesDraggable={false} nodesConnectable={false}
      onNodeClick={(_, n) => onSelect(n.id)} onPaneClick={() => onSelect(null)}>
      <Recenter trigger={recenterKey} />
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
