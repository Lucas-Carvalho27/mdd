import type { Configuration } from './configuration'

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
