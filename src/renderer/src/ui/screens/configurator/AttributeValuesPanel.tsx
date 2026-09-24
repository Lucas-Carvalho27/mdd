import { useState } from 'react'
import { storedValue } from '@/domain/configuration/attribute-values'
import { isSelected } from '@/domain/configuration/resolution'
import type { Attribute, FeatureModel } from '@/domain/feature-model/feature-model'
import { featuresInPreOrder } from '@/domain/feature-model/traversal'
import type { ConfigurationEntry } from '@/domain/project/project'
import { CommitField } from '@/ui/components/CommitField'
import { Field } from '@/ui/screens/project/properties/Field'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface AttributeValuesPanelProps {
  readonly model: FeatureModel
  readonly entry: ConfigurationEntry
}

/**
 * Painel direito do configurador (SPEC §7): os atributos configuráveis das features
 * selecionadas, com o valor conferido pelo tipo. Vazio = vale o padrão do modelo.
 */
export function AttributeValuesPanel({
  model,
  entry
}: AttributeValuesPanelProps): React.JSX.Element {
  const resolution = useProjectStore((state) => state.openResolution())

  if (resolution?.kind !== 'resolved') {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          Resolva o problema indicado acima do diagrama para editar os valores.
        </p>
      </Panel>
    )
  }

  const missing = new Set(
    resolution.missingValues.map(({ featureId, attributeId }) => `${featureId}.${attributeId}`)
  )
  const features = featuresInPreOrder(model.root).filter(
    (feature) =>
      isSelected(resolution.features.get(feature.id)) &&
      feature.attributes.some((attribute) => attribute.configurable)
  )

  return (
    // A chave zera as mensagens de erro dos campos ao trocar de configuração.
    <Panel key={entry.key}>
      {features.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma feature selecionada tem atributos configuráveis.
        </p>
      )}
      {features.map((feature) => (
        <div key={feature.id} data-values-feature={feature.id} className="space-y-3">
          <h3 className="text-sm font-medium">{feature.name}</h3>
          {feature.attributes
            .filter((attribute) => attribute.configurable)
            .map((attribute) => (
              <AttributeValueField
                key={attribute.id}
                featureId={feature.id}
                attribute={attribute}
                value={storedValue(entry.configuration, feature.id, attribute.id)}
                missing={missing.has(`${feature.id}.${attribute.id}`)}
              />
            ))}
        </div>
      ))}
    </Panel>
  )
}

function Panel({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Valores dos atributos
      </h2>
      {children}
    </section>
  )
}

interface AttributeValueFieldProps {
  readonly featureId: string
  readonly attribute: Attribute
  readonly value: string | undefined
  /** Sem valor válido e sem padrão: a configuração não fica completa. */
  readonly missing: boolean
}

function AttributeValueField({
  featureId,
  attribute,
  value,
  missing
}: AttributeValueFieldProps): React.JSX.Element {
  const setAttributeValue = useProjectStore((state) => state.setAttributeValue)
  const [problem, setProblem] = useState<string | null>(null)
  const id = `value-${featureId}-${attribute.id}`
  const fallback =
    attribute.defaultValue !== undefined ? `padrão: ${attribute.defaultValue}` : 'sem valor'
  const commit = (next: string): boolean => {
    const error = setAttributeValue(featureId, attribute.id, next)
    setProblem(error)
    return error === null
  }

  return (
    <Field label={attribute.name} htmlFor={id}>
      {attribute.type === 'enum' || attribute.type === 'boolean' ? (
        <select
          id={id}
          className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          value={value ?? ''}
          onChange={(event) => commit(event.target.value)}
        >
          <option value="">({fallback})</option>
          {(attribute.type === 'enum' ? attribute.options : ['true', 'false']).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <CommitField id={id} value={value ?? ''} placeholder={fallback} onCommit={commit} />
      )}
      {attribute.type === 'number' && (
        <p className="text-xs text-muted-foreground">{numberHint(attribute)}</p>
      )}
      {problem !== null && <p className="text-xs text-destructive">{problem}</p>}
      {problem === null && missing && (
        <p className="text-xs text-destructive">
          Escolha um valor para a configuração ficar completa.
        </p>
      )}
    </Field>
  )
}

function numberHint(attribute: Attribute): string {
  if (attribute.min !== undefined && attribute.max !== undefined) {
    return `Número de ${attribute.min} a ${attribute.max}.`
  }
  if (attribute.min !== undefined) return `Número a partir de ${attribute.min}.`
  if (attribute.max !== undefined) return `Número até ${attribute.max}.`
  return 'Número.'
}
