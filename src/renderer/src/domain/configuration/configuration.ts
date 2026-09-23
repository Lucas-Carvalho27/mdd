/*
 * Uma configuração guarda só decisões manuais e valores de atributos (ADR 0005).
 * A resolução (propagação, validade, completude) chega na Fase 3.
 */

export type DecisionState = 'selected' | 'deselected'

export interface ManualDecision {
  readonly featureId: string
  readonly state: DecisionState
}

export interface AttributeValue {
  readonly featureId: string
  readonly attributeId: string
  readonly value: string
}

export interface Configuration {
  readonly name: string
  readonly decisions: readonly ManualDecision[]
  readonly values: readonly AttributeValue[]
}
