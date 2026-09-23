import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import { ContextMenu, ContextMenuTrigger } from '@/ui/components/ui/context-menu'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { useDropState } from './diagram-context'
import { FeatureMenu } from './FeatureMenu'
import type { FeatureFlowNode } from './flow-types'

// Pontos de conexão invisíveis, exatamente no meio da borda de cima e da de baixo.
const HIDDEN_HANDLE = { opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0, border: 0 }

/** Caixa da feature: nome, ID e o botão de recolher; botão direito abre o menu. */
export function FeatureNode({ data: { feature } }: NodeProps<FeatureFlowNode>): React.JSX.Element {
  const selected = useProjectStore((state) => state.selectedFeatureId === feature.id)
  const selectFeature = useProjectStore((state) => state.selectFeature)
  const toggleCollapsed = useProjectStore((state) => state.toggleCollapsed)
  const drop = useDropState(`feature:${feature.id}`)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            data-feature-id={feature.id}
            aria-current={selected ? 'true' : undefined}
            className={cn(
              'relative flex h-full w-full flex-col items-center justify-center rounded-md border bg-card px-3.5 text-card-foreground shadow-xs',
              selected && 'border-primary bg-primary text-primary-foreground',
              drop === 'valid' && 'ring-3 ring-emerald-500',
              drop === 'invalid' && 'ring-3 ring-destructive'
            )}
            onClick={() => selectFeature(feature.id)}
            onContextMenu={() => selectFeature(feature.id)}
          >
            <span className="max-w-full truncate text-sm leading-5 font-medium">
              {feature.name}
            </span>
            <code className="max-w-full truncate text-xs leading-4 opacity-70">{feature.id}</code>
            {feature.hasChildren && (
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
            )}
          </div>
        </ContextMenuTrigger>
        <FeatureMenu featureId={feature.id} />
      </ContextMenu>
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
