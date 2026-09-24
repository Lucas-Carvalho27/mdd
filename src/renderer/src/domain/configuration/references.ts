import type { Attribute, Feature, FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import type { AttributeValue, Configuration, ManualDecision } from './configuration'

/** A configuração tem decisão ou valor de atributo para alguma das features? */
export function referencesAnyFeature(
  configuration: Configuration,
  featureIds: ReadonlySet<string>
): boolean {
  return (
    configuration.decisions.some((decision) => featureIds.has(decision.featureId)) ||
    configuration.values.some((value) => featureIds.has(value.featureId))
  )
}

/** A configuração tem valor para este atributo desta feature? */
export function referencesAttribute(
  configuration: Configuration,
  featureId: string,
  attributeId: string
): boolean {
  return configuration.values.some(
    (value) => value.featureId === featureId && value.attributeId === attributeId
  )
}

/**
 * Referência a algo que não existe mais no modelo (SPEC §4.2): é ignorada na resolução e
 * deixa a configuração desatualizada. Um valor para um atributo que virou fixo também conta.
 */
export type OrphanReference =
  | { readonly kind: 'decision'; readonly decision: ManualDecision }
  | {
      readonly kind: 'value'
      readonly value: AttributeValue
      readonly reason: 'feature' | 'attribute' | 'fixed'
    }

/** Features do modelo por ID. */
export function featuresById(model: FeatureModel): Map<string, Feature> {
  return new Map(featuresInPreOrder(model.root).map((feature) => [feature.id, feature]))
}

/** O atributo configurável `attributeId` da feature, se existir. */
export function configurableAttribute(
  feature: Feature | undefined,
  attributeId: string
): Attribute | undefined {
  const attribute = feature?.attributes.find((candidate) => candidate.id === attributeId)
  return attribute?.configurable ? attribute : undefined
}

export function findOrphanReferences(
  model: FeatureModel,
  configuration: Configuration
): OrphanReference[] {
  const features = featuresById(model)
  const orphans: OrphanReference[] = configuration.decisions
    .filter((decision) => !features.has(decision.featureId))
    .map((decision) => ({ kind: 'decision', decision }))
  for (const value of configuration.values) {
    const reason = orphanValueReason(features.get(value.featureId), value.attributeId)
    if (reason !== null) orphans.push({ kind: 'value', value, reason })
  }
  return orphans
}

/** As decisões manuais que valem na resolução: as que citam features existentes. */
export function activeDecisions(
  model: FeatureModel,
  configuration: Configuration
): ManualDecision[] {
  const features = featuresById(model)
  return configuration.decisions.filter((decision) => features.has(decision.featureId))
}

/** A configuração sem as referências órfãs ("remover referências órfãs", SPEC §7). */
export function withoutOrphanReferences(
  model: FeatureModel,
  configuration: Configuration
): Configuration {
  const features = featuresById(model)
  return {
    ...configuration,
    decisions: configuration.decisions.filter((decision) => features.has(decision.featureId)),
    values: configuration.values.filter(
      (value) => orphanValueReason(features.get(value.featureId), value.attributeId) === null
    )
  }
}

function orphanValueReason(
  feature: Feature | undefined,
  attributeId: string
): 'feature' | 'attribute' | 'fixed' | null {
  if (feature === undefined) return 'feature'
  const attribute = feature.attributes.find((candidate) => candidate.id === attributeId)
  if (attribute === undefined) return 'attribute'
  return attribute.configurable ? null : 'fixed'
}
