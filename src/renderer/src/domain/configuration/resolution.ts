import type { AttributeRef, InvalidValue } from './attribute-values'
import type { DecisionState, ManualDecision } from './configuration'
import type { OrphanReference } from './references'

/*
 * Resultado da resolução de uma configuração (SPEC §4.2). É sempre calculado a partir do
 * modelo e das decisões manuais, nunca salvo (ADR 0005).
 */

export type FeatureStatus =
  | { readonly kind: 'manual'; readonly state: DecisionState }
  | { readonly kind: 'propagated'; readonly state: DecisionState }
  | { readonly kind: 'undecided' }

interface ResolutionBase {
  readonly orphans: readonly OrphanReference[]
  readonly invalidValues: readonly InvalidValue[]
}

export type Resolution =
  /** O modelo, sozinho, não admite nenhum produto. */
  | (ResolutionBase & { readonly kind: 'empty-model' })
  /** As decisões manuais se contradizem: nenhuma propagação é mostrada. */
  | (ResolutionBase & {
      readonly kind: 'conflict'
      /** As decisões que valem (sem as órfãs), para o usuário remover. */
      readonly decisions: readonly ManualDecision[]
    })
  | (ResolutionBase & {
      readonly kind: 'resolved'
      /** O estado de cada feature do modelo. */
      readonly features: ReadonlyMap<string, FeatureStatus>
      readonly missingValues: readonly AttributeRef[]
    })

export interface ConfigurationStatus {
  /** Não está em conflito (e o modelo admite algum produto). */
  readonly valid: boolean
  /** Válida, sem features indecisas e com todos os valores de atributo. */
  readonly complete: boolean
  /** Tem referências órfãs, está em conflito ou tem valor inválido. */
  readonly stale: boolean
  readonly undecidedCount: number
  readonly missingValueCount: number
}

export function configurationStatus(resolution: Resolution): ConfigurationStatus {
  const damaged = resolution.orphans.length > 0 || resolution.invalidValues.length > 0
  if (resolution.kind !== 'resolved') {
    return {
      valid: false,
      complete: false,
      stale: damaged || resolution.kind === 'conflict',
      undecidedCount: 0,
      missingValueCount: 0
    }
  }
  const undecidedCount = [...resolution.features.values()].filter(
    (status) => status.kind === 'undecided'
  ).length
  const missingValueCount = resolution.missingValues.length
  return {
    valid: true,
    complete: undecidedCount === 0 && missingValueCount === 0,
    stale: damaged,
    undecidedCount,
    missingValueCount
  }
}

/** A feature está no produto (por decisão manual ou propagada)? */
export function isSelected(status: FeatureStatus | undefined): boolean {
  return status !== undefined && status.kind !== 'undecided' && status.state === 'selected'
}
