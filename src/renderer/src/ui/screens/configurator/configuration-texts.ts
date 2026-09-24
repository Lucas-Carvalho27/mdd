import type { DecisionState } from '@/domain/configuration/configuration'
import type { OrphanReference } from '@/domain/configuration/references'
import { configurationStatus, type Resolution } from '@/domain/configuration/resolution'

/** Textos do configurador que mais de um componente usa. */

export function decisionLabel(state: DecisionState): string {
  return state === 'selected' ? 'selecionada' : 'desselecionada'
}

const ORPHAN_VALUE_REASON = {
  feature: 'a feature não existe mais',
  attribute: 'o atributo não existe mais',
  fixed: 'o atributo agora tem valor fixo no modelo'
} as const

export function describeOrphan(orphan: OrphanReference): string {
  if (orphan.kind === 'decision') {
    const { featureId, state } = orphan.decision
    return `Decisão sobre “${featureId}” (${decisionLabel(state)}): a feature não existe mais.`
  }
  const { featureId, attributeId, value } = orphan.value
  return `Valor de ${featureId}.${attributeId} (“${value}”): ${ORPHAN_VALUE_REASON[orphan.reason]}.`
}

/** "Válida · incompleta (2 indecisas, 1 atributo sem valor) · desatualizada" (SPEC §7). */
export function statusText(resolution: Resolution): string {
  const status = configurationStatus(resolution)
  const parts: string[] = []
  if (resolution.kind === 'empty-model') parts.push('Modelo vazio: nenhum produto é possível')
  else if (resolution.kind === 'conflict') parts.push('Em conflito')
  else if (status.complete) parts.push('Válida', 'completa')
  else {
    const missing = [
      plural(status.undecidedCount, 'indecisa', 'indecisas'),
      plural(status.missingValueCount, 'atributo sem valor', 'atributos sem valor')
    ].filter((part) => part !== null)
    parts.push('Válida', `incompleta (${missing.join(', ')})`)
  }
  if (status.stale) parts.push('desatualizada')
  return parts.join(' · ')
}

function plural(count: number, one: string, many: string): string | null {
  if (count === 0) return null
  return `${count} ${count === 1 ? one : many}`
}
