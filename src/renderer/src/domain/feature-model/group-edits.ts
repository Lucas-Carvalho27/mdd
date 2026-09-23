import { err, ok } from '../shared/result'
import { notFound, type EditResult } from './feature-edits'
import type { Feature, FeatureChild, FeatureModel, GroupMax } from './feature-model'
import { findFeature, groupAt, locateFeature, updateFeature, withoutVariability } from './tree'

/*
 * Edições de grupos (SPEC §4.5). Um grupo não tem ID próprio: ele é identificado por
 * qualquer um de seus membros. As regras de cardinalidade (M3) são conferidas depois.
 */

/** Junta filhas soltas de `parentId` num grupo, na posição da primeira delas. */
export function createGroup(
  model: FeatureModel,
  parentId: string,
  memberIds: readonly string[],
  min: number,
  max: GroupMax
): EditResult {
  const parent = findFeature(model.root, parentId)
  if (parent === undefined) return err(notFound(parentId))
  if (memberIds.length === 0) return err('Escolha ao menos uma feature para o grupo.')

  const selected = new Set<number>()
  for (const id of memberIds) {
    const index = parent.children.findIndex(
      (child) => child.kind === 'feature' && child.feature.id === id
    )
    if (index === -1) return err(`"${id}" não é uma filha solta de "${parent.name}".`)
    selected.add(index)
  }

  const members: Feature[] = parent.children.flatMap((child, index) =>
    selected.has(index) && child.kind === 'feature' ? [withoutVariability(child.feature)] : []
  )
  const first = Math.min(...selected)
  const children = parent.children.flatMap((child, index): FeatureChild[] => {
    if (index === first) return [{ kind: 'group', group: { min, max, members } }]
    return selected.has(index) ? [] : [child]
  })
  return ok({ ...model, root: updateFeature(model.root, parentId, (p) => ({ ...p, children })) })
}

export function setGroupCardinality(
  model: FeatureModel,
  memberId: string,
  min: number,
  max: GroupMax
): EditResult {
  const location = locateFeature(model.root, memberId)
  if (location === undefined) return err(notFound(memberId))
  if (location.kind !== 'member') return err('A feature não é membro de um grupo.')
  const { parent, childIndex } = location
  const children = parent.children.map((child, index) =>
    index === childIndex
      ? { kind: 'group' as const, group: { ...groupAt(parent, index), min, max } }
      : child
  )
  return ok({ ...model, root: updateFeature(model.root, parent.id, (p) => ({ ...p, children })) })
}

/** Desfaz o grupo de `memberId`: os membros viram filhas soltas opcionais, na mesma ordem. */
export function ungroup(model: FeatureModel, memberId: string): EditResult {
  const location = locateFeature(model.root, memberId)
  if (location === undefined) return err(notFound(memberId))
  if (location.kind !== 'member') return err('A feature não é membro de um grupo.')
  const { parent, childIndex } = location
  const children = parent.children.flatMap((child, index): FeatureChild[] =>
    index === childIndex
      ? groupAt(parent, index).members.map((member) => ({
          kind: 'feature',
          feature: { ...member, variability: 'optional' }
        }))
      : [child]
  )
  return ok({ ...model, root: updateFeature(model.root, parent.id, (p) => ({ ...p, children })) })
}
