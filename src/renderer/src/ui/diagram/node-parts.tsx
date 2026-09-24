import { Handle, Position } from '@xyflow/react'
import { useProjectStore } from '@/ui/stores/project-store-context'
import type { DiagramFeature } from './diagram-graph'

// Pontos de conexão invisíveis, exatamente no meio da borda de cima e da de baixo.
const HIDDEN_HANDLE = { opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0, border: 0 }

/** Onde as linhas chegam e saem do nó; os dois tipos de nó de feature usam os mesmos. */
export function NodeHandles(): React.JSX.Element {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} style={HIDDEN_HANDLE} />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={HIDDEN_HANDLE}
      />
    </>
  )
}

/** Botão no lado direito do nó que tem filhas: recolhe (−) ou expande (+N). */
export function CollapseButton({
  feature
}: {
  readonly feature: DiagramFeature
}): React.JSX.Element | null {
  const toggleCollapsed = useProjectStore((state) => state.toggleCollapsed)
  if (!feature.hasChildren) return null
  return (
    <button
      type="button"
      className="nodrag absolute top-1/2 -right-2.5 -translate-y-1/2 rounded-full border bg-background px-1.5 text-[10px] leading-4 text-foreground hover:bg-accent"
      title={feature.collapsed ? 'Expandir' : 'Recolher'}
      onClick={(event) => {
        event.stopPropagation()
        toggleCollapsed(feature.id)
      }}
    >
      {feature.collapsed ? `+${feature.hiddenCount}` : '−'}
    </button>
  )
}
