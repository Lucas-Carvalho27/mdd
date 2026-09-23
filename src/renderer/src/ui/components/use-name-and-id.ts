import { useState } from 'react'
import { checkNewFeatureId } from '@/domain/feature-model/feature-edits'
import { generateId } from '@/domain/shared/identifier-generator'

export interface NameAndId {
  readonly name: string
  readonly id: string
  setName(name: string): void
  setId(id: string): void
  /** Por que ainda não dá para criar, ou `null`. */
  readonly problem: string | null
}

/**
 * Nome e ID de uma feature nova (ADR 0004). O ID acompanha o nome como sugestão até o
 * usuário editá-lo; depois de criada a feature, ele não muda mais.
 */
export function useNameAndId(taken: ReadonlySet<string>, fallback: string): NameAndId {
  const [name, setName] = useState('')
  const [customId, setCustomId] = useState<string | null>(null)
  const id = customId ?? generateId(name, taken, fallback)
  const problem = name.trim() === '' ? 'Informe o nome.' : checkNewFeatureId(id, taken)
  return { name, id, setName, setId: setCustomId, problem }
}
