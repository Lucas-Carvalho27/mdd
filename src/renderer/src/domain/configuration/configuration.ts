/*
 * Uma configuração guarda só decisões manuais e valores de atributos (ADR 0005).
 * O resto (propagação, validade, completude) é calculado: veja resolution.ts.
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
