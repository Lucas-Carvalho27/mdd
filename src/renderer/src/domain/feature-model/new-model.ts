import { generateId } from '../shared/identifier-generator'
import { err, ok, type Result } from '../shared/result'
import { checkNewFeatureId } from './feature-edits'
import type { FeatureModel } from './feature-model'

/**
 * Modelo de um projeto novo: só a raiz, com o mesmo nome do modelo (SPEC §7).
 * Sem `rootId`, o ID da raiz é gerado a partir do nome.
 */
export function createFeatureModel(name: string, rootId?: string): Result<FeatureModel, string> {
  const trimmed = name.trim()
  if (trimmed === '') return err('O nome do projeto não pode ficar vazio.')
  const id = rootId?.trim() ?? generateId(trimmed, new Set(), 'raiz')
  const problem = checkNewFeatureId(id, new Set())
  if (problem !== null) return err(problem)
  return ok({
    name: trimmed,
    root: { id, name: trimmed, attributes: [], children: [] },
    constraints: []
  })
}

export function renameModel(model: FeatureModel, name: string): Result<FeatureModel, string> {
  const trimmed = name.trim()
  if (trimmed === '') return err('O nome do modelo não pode ficar vazio.')
  return ok({ ...model, name: trimmed })
}
