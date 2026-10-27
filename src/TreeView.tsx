import { useMemo } from 'react'
import { ReactFlow, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { layout } from './layout'
import type { Person, Relation } from './types'

type PData = { p: Person; sel: boolean }

function PersonNode({ data }: NodeProps<Node<PData>>) {
  const { p, sel } = data
  const yr = (d: string | null) => (d ? d.slice(0, 4) : '')
  const years = p.birth_date || p.death_date ? `${yr(p.birth_date)} – ${yr(p.death_date)}` : ''
  const bg = p.gender === 'L' ? '#e3f0ff' : p.gender === 'P' ? '#ffe6ef' : '#f1f1f1'
  return (
    <div style={{ width: 150, padding: 8, textAlign: 'center', borderRadius: 10, background: bg,
      border: sel ? '3px solid #2f6f4f' : '1px solid #999', fontSize: 13 }}>
      <Handle id="t" type="target" position={Position.Top} />
      <Handle id="l" type="target" position={Position.Left} />
      <b>{p.full_name}</b>
      <div style={{ fontSize: 11, color: '#555' }}>{years}</div>
      <Handle id="r" type="source" position={Position.Right} />
      <Handle id="b" type="source" position={Position.Bottom} />
    </div>
  )
}
const nodeTypes = { person: PersonNode }

export default function TreeView({ persons, rels, sel, onSelect }:
  { persons: Person[]; rels: Relation[]; sel: string | null; onSelect: (id: string | null) => void }) {
  const { nodes, edges } = useMemo(() => {
    const pos = layout(persons, rels)
    const nodes: Node<PData>[] = persons.map((p) => ({
      id: p.id, type: 'person', position: pos.get(p.id) ?? { x: 0, y: 0 }, data: { p, sel: p.id === sel },
    }))
    const edges: Edge[] = rels.map((r) => {
      if (r.type === 'parent_of')
        return { id: r.id, source: r.a_id, target: r.b_id, sourceHandle: 'b', targetHandle: 't' }
      const left = (pos.get(r.a_id)?.x ?? 0) <= (pos.get(r.b_id)?.x ?? 0)
      return { id: r.id, source: left ? r.a_id : r.b_id, target: left ? r.b_id : r.a_id,
        sourceHandle: 'r', targetHandle: 'l', style: { stroke: '#d33', strokeDasharray: '5 4' } }
    })
    return { nodes, edges }
  }, [persons, rels, sel])

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.2}
      nodesDraggable={false} nodesConnectable={false}
      onNodeClick={(_, n) => onSelect(n.id)} onPaneClick={() => onSelect(null)}>
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
