import { checkAttributeValue } from '../feature-model/attribute-value'
import type { FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import { err, ok, type Result } from '../shared/result'
import type { AttributeValue, Configuration, DecisionState, ManualDecision } from './configuration'
import { configurableAttribute, featuresById } from './references'

/*
 * Edições de uma configuração (SPEC §4.2). Uma decisão ou um valor novo entra na ordem
 * do modelo, e não no fim: assim o arquivo não depende da ordem dos cliques. Uma edição
 * que não muda nada devolve a mesma configuração, e a tela não mostra alteração pendente.
 */

/** O clique no modo configuração (SPEC §7): indecisa → selecionada → desselecionada → indecisa. */
export function nextDecisionState(current: DecisionState | undefined): DecisionState | undefined {
  if (current === undefined) return 'selected'
  return current === 'selected' ? 'deselected' : undefined
}

export function decisionOf(
  configuration: Configuration,
  featureId: string
): DecisionState | undefined {
  return configuration.decisions.find((decision) => decision.featureId === featureId)?.state
}

/** Troca a decisão manual sobre a feature; `undefined` remove a decisão. */
export function withDecision(
  model: FeatureModel,
  configuration: Configuration,
  featureId: string,
  state: DecisionState | undefined
): Configuration {
  const current = decisionOf(configuration, featureId)
  if (current === state) return configuration
  if (state === undefined) {
    return {
      ...configuration,
      decisions: configuration.decisions.filter((decision) => decision.featureId !== featureId)
    }
  }
  if (current !== undefined) {
    return {
      ...configuration,
      decisions: configuration.decisions.map((decision) =>
        decision.featureId === featureId ? { featureId, state } : decision
      )
    }
  }
  const rank = featureRanks(model)
  return {
    ...configuration,
    decisions: insertInOrder<ManualDecision>(
      configuration.decisions,
      { featureId, state },
      (a, b) => rank(a.featureId) - rank(b.featureId)
    )
  }
}

/**
 * Grava o valor de um atributo configurável, conferido pelo tipo. Texto vazio tira o valor,
 * e aí vale o `default` do modelo, se houver.
 */
export function withAttributeValue(
  model: FeatureModel,
  configuration: Configuration,
  featureId: string,
  attributeId: string,
  value: string
): Result<Configuration, string> {
  const features = featuresById(model)
  const attribute = configurableAttribute(features.get(featureId), attributeId)
  if (attribute === undefined) {
    return err(`"${featureId}" não tem o atributo configurável "${attributeId}".`)
  }
  if (value === '') return ok(withoutAttributeValue(configuration, featureId, attributeId))
  const problem = checkAttributeValue(attribute, value)
  if (problem !== null) return err(problem)

  const entry: AttributeValue = { featureId, attributeId, value }
  const index = configuration.values.findIndex(
    (existing) => existing.featureId === featureId && existing.attributeId === attributeId
  )
  if (index >= 0) {
    if (configuration.values[index].value === value) return ok(configuration)
    return ok({ ...configuration, values: configuration.values.with(index, entry) })
  }
  const rank = featureRanks(model)
  const attributeRank = (other: AttributeValue): number =>
    features
      .get(other.featureId)
      ?.attributes.findIndex((candidate) => candidate.id === other.attributeId) ?? 0
  return ok({
    ...configuration,
    values: insertInOrder(
      configuration.values,
      entry,
      (a, b) => rank(a.featureId) - rank(b.featureId) || attributeRank(a) - attributeRank(b)
    )
  })
}

export function withoutAttributeValue(
  configuration: Configuration,
  featureId: string,
  attributeId: string
): Configuration {
  const values = configuration.values.filter(
    (value) => value.featureId !== featureId || value.attributeId !== attributeId
  )
  return values.length === configuration.values.length
    ? configuration
    : { ...configuration, values }
}

/** Posição da feature na pré-ordem do modelo; as que não existem mais vão para o fim. */
function featureRanks(model: FeatureModel): (featureId: string) => number {
  const ranks = new Map(featuresInPreOrder(model.root).map((feature, index) => [feature.id, index]))
  return (featureId) => ranks.get(featureId) ?? Number.MAX_SAFE_INTEGER
}

/** Põe o item antes do primeiro que deve vir depois dele. */
function insertInOrder<T>(
  items: readonly T[],
  item: T,
  compare: (a: T, b: T) => number
): readonly T[] {
  const index = items.findIndex((other) => compare(item, other) < 0)
  return index < 0 ? [...items, item] : [...items.slice(0, index), item, ...items.slice(index)]
}
