import type { NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import { ContextMenu, ContextMenuTrigger } from '@/ui/components/ui/context-menu'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { useDropState } from './diagram-context'
import { FeatureMenu } from './FeatureMenu'
import type { FeatureFlowNode } from './flow-types'
import { CollapseButton, NodeHandles } from './node-parts'

/** Caixa da feature: nome, ID e o botão de recolher; botão direito abre o menu. */
export function FeatureNode({ data: { feature } }: NodeProps<FeatureFlowNode>): React.JSX.Element {
  const selected = useProjectStore((state) => state.selectedFeatureId === feature.id)
  const selectFeature = useProjectStore((state) => state.selectFeature)
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
            <CollapseButton feature={feature} />
          </div>
        </ContextMenuTrigger>
        <FeatureMenu featureId={feature.id} />
      </ContextMenu>
      <NodeHandles />
    </>
  )
}
