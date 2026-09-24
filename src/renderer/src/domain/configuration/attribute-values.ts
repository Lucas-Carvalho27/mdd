import { checkAttributeValue } from '../feature-model/attribute-value'
import type { FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import type { AttributeValue, Configuration } from './configuration'
import { configurableAttribute, featuresById } from './references'

export interface AttributeRef {
  readonly featureId: string
  readonly attributeId: string
}

/** Valor gravado que não serve para o tipo do atributo (SPEC §4.2): deixa a configuração desatualizada. */
export interface InvalidValue {
  readonly value: AttributeValue
  readonly message: string
}

/** O valor que a configuração guarda para o atributo, se houver. */
export function storedValue(
  configuration: Configuration,
  featureId: string,
  attributeId: string
): string | undefined {
  return configuration.values.find(
    (value) => value.featureId === featureId && value.attributeId === attributeId
  )?.value
}

/** Valores de atributos configuráveis existentes que não servem para o tipo. */
export function findInvalidValues(
  model: FeatureModel,
  configuration: Configuration
): InvalidValue[] {
  const features = featuresById(model)
  return configuration.values.flatMap((value) => {
    const attribute = configurableAttribute(features.get(value.featureId), value.attributeId)
    const message = attribute !== undefined ? checkAttributeValue(attribute, value.value) : null
    return message !== null ? [{ value, message }] : []
  })
}

/**
 * Atributos configuráveis das features selecionadas que ficam sem valor válido: nem a
 * configuração tem um valor que sirva, nem o modelo tem `default` (SPEC §4.2, "Completa").
 */
export function findMissingValues(
  model: FeatureModel,
  configuration: Configuration,
  selected: ReadonlySet<string>
): AttributeRef[] {
  return featuresInPreOrder(model.root)
    .filter((feature) => selected.has(feature.id))
    .flatMap((feature) =>
      feature.attributes
        .filter((attribute) => attribute.configurable)
        .filter((attribute) => {
          const value = storedValue(configuration, feature.id, attribute.id)
          if (value !== undefined) return checkAttributeValue(attribute, value) !== null
          return attribute.defaultValue === undefined
        })
        .map((attribute) => ({ featureId: feature.id, attributeId: attribute.id }))
    )
}
