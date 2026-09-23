import type { Feature, FeatureChild, Group } from './feature-model'
import { featuresInPreOrder } from './traversal'

/*
 * Navegação e atualização imutável da árvore. Atualizar uma feature recria só o caminho
 * da raiz até ela; o resto da árvore é compartilhado com a versão anterior.
 */

export type FeatureLocation =
  | { readonly kind: 'root' }
  | { readonly kind: 'solitary'; readonly parent: Feature; readonly childIndex: number }
  | {
      readonly kind: 'member'
      readonly parent: Feature
      /** Posição do grupo em `parent.children`. */
      readonly childIndex: number
      readonly memberIndex: number
    }

export function findFeature(root: Feature, id: string): Feature | undefined {
  return featuresInPreOrder(root).find((feature) => feature.id === id)
}

export function featureIdSet(root: Feature): Set<string> {
  return new Set(featuresInPreOrder(root).map((feature) => feature.id))
}

export function locateFeature(root: Feature, id: string): FeatureLocation | undefined {
  if (root.id === id) return { kind: 'root' }
  const search = (parent: Feature): FeatureLocation | undefined => {
    for (const [childIndex, child] of parent.children.entries()) {
      if (child.kind === 'feature') {
        if (child.feature.id === id) return { kind: 'solitary', parent, childIndex }
        const found = search(child.feature)
        if (found) return found
      } else {
        for (const [memberIndex, member] of child.group.members.entries()) {
          if (member.id === id) return { kind: 'member', parent, childIndex, memberIndex }
          const found = search(member)
          if (found) return found
        }
      }
    }
    return undefined
  }
  return search(root)
}

/** Troca a feature `id` pelo resultado de `update`. Se o ID não existe, devolve a mesma raiz. */
export function updateFeature(
  root: Feature,
  id: string,
  update: (feature: Feature) => Feature
): Feature {
  if (root.id === id) return update(root)
  let changed = false
  const children = root.children.map((child) => {
    const next = updateChild(child, id, update)
    if (next !== child) changed = true
    return next
  })
  return changed ? { ...root, children } : root
}

function updateChild(
  child: FeatureChild,
  id: string,
  update: (feature: Feature) => Feature
): FeatureChild {
  if (child.kind === 'feature') {
    const feature = updateFeature(child.feature, id, update)
    return feature === child.feature ? child : { kind: 'feature', feature }
  }
  const members = child.group.members.map((member) => updateFeature(member, id, update))
  const changed = members.some((member, index) => member !== child.group.members[index])
  return changed ? { kind: 'group', group: { ...child.group, members } } : child
}

/** O grupo na posição `childIndex` dos filhos de `parent`. */
export function groupAt(parent: Feature, childIndex: number): Group {
  const child = parent.children[childIndex]
  if (child?.kind !== 'group') {
    throw new Error(`Não há grupo na posição ${childIndex} de "${parent.id}".`)
  }
  return child.group
}

export function withoutVariability(feature: Feature): Feature {
  const { variability, ...rest } = feature
  return rest
}

export interface DetachResult {
  readonly root: Feature
  /** Descrição do ajuste feito no grupo de origem, quando houve (SPEC §4.5). */
  readonly groupChange?: string
}

/**
 * Tira da árvore a feature na posição indicada. Se ela era membro de um grupo, o grupo
 * vazio é removido e um mínimo maior que o número de membros é reduzido.
 */
export function detachFeature(root: Feature, location: FeatureLocation): DetachResult {
  if (location.kind === 'root') throw new Error('A raiz não pode ser removida da árvore.')
  const { parent, childIndex } = location

  if (location.kind === 'solitary') {
    const children = parent.children.filter((_, index) => index !== childIndex)
    return { root: updateFeature(root, parent.id, (p) => ({ ...p, children })) }
  }

  const group = groupAt(parent, childIndex)
  const members = group.members.filter((_, index) => index !== location.memberIndex)
  let groupChange: string | undefined
  let children: FeatureChild[]
  if (members.length === 0) {
    children = parent.children.filter((_, index) => index !== childIndex)
    groupChange = `O grupo de "${parent.name}" ficou vazio e foi removido.`
  } else {
    const min = Math.min(group.min, members.length)
    if (min !== group.min) {
      groupChange = `O mínimo do grupo de "${parent.name}" passou de ${group.min} para ${min}.`
    }
    children = parent.children.map((child, index) =>
      index === childIndex ? { kind: 'group', group: { ...group, min, members } } : child
    )
  }
  return { root: updateFeature(root, parent.id, (p) => ({ ...p, children })), groupChange }
}
