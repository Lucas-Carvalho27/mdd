import type { Attribute, Feature, Group } from '@/domain/feature-model/feature-model'

/**
 * Visualização provisória do modelo em lista (Fase 1). O diagrama chega na Fase 2.
 * ● obrigatória, ○ opcional; membros de grupo aparecem sob o rótulo do grupo.
 */
export function FeatureTree({ root }: { readonly root: Feature }): React.JSX.Element {
  return (
    <ul className="space-y-1 text-sm">
      <FeatureItem feature={root} />
    </ul>
  )
}

function FeatureItem({ feature }: { readonly feature: Feature }): React.JSX.Element {
  return (
    <li>
      <div className="flex flex-wrap items-baseline gap-2">
        <span aria-hidden className="w-3 text-center">
          {feature.variability === 'mandatory'
            ? '●'
            : feature.variability === 'optional'
              ? '○'
              : ''}
        </span>
        <span className="font-medium">{feature.name}</span>
        <code className="text-xs text-muted-foreground">{feature.id}</code>
        {feature.attributes.map((attribute) => (
          <span key={attribute.id} className="rounded bg-muted px-1.5 text-xs">
            {describeAttribute(attribute)}
          </span>
        ))}
      </div>
      {feature.children.length > 0 && (
        <ul className="ml-5 space-y-1 border-l pl-3">
          {feature.children.map((child, index) =>
            child.kind === 'feature' ? (
              <FeatureItem key={child.feature.id} feature={child.feature} />
            ) : (
              <li key={`group-${index}`}>
                <span className="text-xs uppercase text-muted-foreground">
                  grupo {describeGroup(child.group)}
                </span>
                <ul className="ml-2 space-y-1">
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

function describeGroup(group: Group): string {
  if (group.min === 1 && group.max === 1) return 'alternative'
  if (group.min === 1 && group.max === '*') return 'or'
  return `[${group.min}..${group.max}]`
}

function describeAttribute(attribute: Attribute): string {
  const value = attribute.defaultValue !== undefined ? ` = ${attribute.defaultValue}` : ''
  const fixed = attribute.configurable ? '' : ' (fixo)'
  return `${attribute.name}: ${attribute.type}${value}${fixed}`
}
