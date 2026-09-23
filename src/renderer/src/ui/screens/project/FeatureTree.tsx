import type { Feature } from '@/domain/feature-model/feature-model'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { describeGroup } from './group-label'

/**
 * Árvore do modelo em lista, com seleção (Fase 2A). O diagrama gráfico a substitui na Fase 2B.
 * ● obrigatória, ○ opcional; membros de grupo aparecem sob o rótulo do grupo.
 */
export function FeatureTree({ root }: { readonly root: Feature }): React.JSX.Element {
  return (
    <ul className="space-y-0.5 text-sm" role="tree">
      <FeatureItem feature={root} />
    </ul>
  )
}

function FeatureItem({ feature }: { readonly feature: Feature }): React.JSX.Element {
  const selected = useProjectStore((state) => state.selectedFeatureId === feature.id)
  const selectFeature = useProjectStore((state) => state.selectFeature)

  return (
    <li role="treeitem" aria-selected={selected}>
      <button
        data-feature-id={feature.id}
        className={`flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left ${
          selected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
        }`}
        onClick={() => selectFeature(feature.id)}
      >
        <span aria-hidden className="w-3 text-center">
          {variabilityMarker(feature)}
        </span>
        <span className="font-medium">{feature.name}</span>
        <code className={`text-xs ${selected ? 'opacity-80' : 'text-muted-foreground'}`}>
          {feature.id}
        </code>
      </button>
      {feature.children.length > 0 && (
        <ul className="ml-4 space-y-0.5 border-l pl-2">
          {feature.children.map((child, index) =>
            child.kind === 'feature' ? (
              <FeatureItem key={child.feature.id} feature={child.feature} />
            ) : (
              <li key={`group-${index}`}>
                <span className="pl-1.5 text-xs uppercase text-muted-foreground">
                  grupo {describeGroup(child.group)}
                </span>
                <ul className="ml-2 space-y-0.5">
                  {child.group.members.map((member) => (
                    <FeatureItem key={member.id} feature={member} />
                  ))}
                </ul>
              </li>
            )
          )}
        </ul>
      )}
    </li>
  )
}

function variabilityMarker(feature: Feature): string {
  if (feature.variability === 'mandatory') return '●'
  if (feature.variability === 'optional') return '○'
  return ''
}
