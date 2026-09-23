import { isValidFeatureId } from '../expression/identifier'
import { generateId } from '../shared/identifier-generator'
import { err, ok, type Result } from '../shared/result'
import type { Feature, FeatureChild, FeatureModel, Variability } from './feature-model'
import {
  detachFeature,
  featureIdSet,
  findFeature,
  groupAt,
  locateFeature,
  updateFeature,
  withoutVariability
} from './tree'

/*
 * Edições da estrutura do Feature Model (SPEC §4.5). Cada operação devolve um modelo novo
 * ou a explicação de por que não pode ser feita. As regras M1–M5 são conferidas depois,
 * pelo histórico de comandos, em cima do modelo resultante.
 */

export type EditResult<T = FeatureModel> = Result<T, string>

export interface AddedFeature {
  readonly model: FeatureModel
  readonly featureId: string
}

/** Sem `id`, ele é gerado a partir do nome; com `id`, ele precisa ser válido e inédito. */
export function addChildFeature(
  model: FeatureModel,
  parentId: string,
  name: string,
  id?: string
): EditResult<AddedFeature> {
  if (findFeature(model.root, parentId) === undefined) return err(notFound(parentId))
  const created = createFeature(model, name, 'optional', id)
  if (!created.ok) return created
  const feature = created.value
  const root = updateFeature(model.root, parentId, (parent) => ({
    ...parent,
    children: [...parent.children, { kind: 'feature', feature }]
  }))
  return ok({ model: { ...model, root }, featureId: feature.id })
}

/** Cria a feature logo depois de `siblingId`, no mesmo grupo quando ela for membro de um. */
export function addSiblingFeature(
  model: FeatureModel,
  siblingId: string,
  name: string,
  id?: string
): EditResult<AddedFeature> {
  const location = locateFeature(model.root, siblingId)
  if (location === undefined) return err(notFound(siblingId))
  if (location.kind === 'root') return err('A raiz não tem irmãs: adicione uma filha.')

  const variability = location.kind === 'solitary' ? 'optional' : undefined
  const created = createFeature(model, name, variability, id)
  if (!created.ok) return created
  const feature = created.value
  const { parent, childIndex } = location

  const children: FeatureChild[] =
    location.kind === 'solitary'
      ? insertAt(parent.children, childIndex + 1, { kind: 'feature', feature })
      : parent.children.map((child, index) => {
          if (index !== childIndex) return child
          const group = groupAt(parent, childIndex)
          return {
            kind: 'group',
            group: { ...group, members: insertAt(group.members, location.memberIndex + 1, feature) }
          }
        })
  const root = updateFeature(model.root, parent.id, (p) => ({ ...p, children }))
  return ok({ model: { ...model, root }, featureId: feature.id })
}

export function renameFeature(model: FeatureModel, featureId: string, name: string): EditResult {
  const trimmed = name.trim()
  if (trimmed === '') return err('O nome não pode ficar vazio.')
  return editFeature(model, featureId, (feature) => ({ ...feature, name: trimmed }))
}

/** Texto vazio remove a descrição. */
export function setFeatureDescription(
  model: FeatureModel,
  featureId: string,
  description: string
): EditResult {
  const trimmed = description.trim()
  return editFeature(model, featureId, (feature) => {
    const { description: previousDescription, ...rest } = feature
    return trimmed === '' ? rest : { ...rest, description: trimmed }
  })
}

export function setVariability(
  model: FeatureModel,
  featureId: string,
  variability: Variability
): EditResult {
  const location = locateFeature(model.root, featureId)
  if (location === undefined) return err(notFound(featureId))
  if (location.kind !== 'solitary') {
    return err('Só features fora de grupo são obrigatórias ou opcionais.')
  }
  return editFeature(model, featureId, (feature) => ({ ...feature, variability }))
}

/** Troca a feature de lugar com a irmã anterior (-1) ou seguinte (+1). */
export function reorderFeature(model: FeatureModel, featureId: string, offset: -1 | 1): EditResult {
  const location = locateFeature(model.root, featureId)
  if (location === undefined) return err(notFound(featureId))
  if (location.kind === 'root') return err('A raiz não tem irmãs.')
  const { parent, childIndex } = location

  if (location.kind === 'solitary') {
    const children = swap(parent.children, childIndex, childIndex + offset)
    if (children === undefined) return err(edgeMessage(offset))
    return ok({ ...model, root: updateFeature(model.root, parent.id, (p) => ({ ...p, children })) })
  }

  const group = groupAt(parent, childIndex)
  const members = swap(group.members, location.memberIndex, location.memberIndex + offset)
  if (members === undefined) return err(edgeMessage(offset))
  const children = parent.children.map((child, index) =>
    index === childIndex ? { kind: 'group' as const, group: { ...group, members } } : child
  )
  return ok({ ...model, root: updateFeature(model.root, parent.id, (p) => ({ ...p, children })) })
}

/** Para onde uma feature pode ir: filha solta de outra feature ou membro do grupo de `memberId`. */
export type MoveDestination =
  | { readonly kind: 'child'; readonly parentId: string }
  | { readonly kind: 'group'; readonly memberId: string }

/**
 * Muda a feature de pai, levando a subárvore junto; ela vai para o fim do destino.
 * Ao entrar num grupo perde a variabilidade; ao sair de um grupo vira opcional.
 */
export function moveFeature(
  model: FeatureModel,
  featureId: string,
  destination: MoveDestination
): EditResult {
  const location = locateFeature(model.root, featureId)
  if (location === undefined) return err(notFound(featureId))
  if (location.kind === 'root') return err('A raiz não pode ser movida.')
  const feature = findFeature(model.root, featureId)!

  const targetId = destination.kind === 'child' ? destination.parentId : destination.memberId
  if (findFeature(model.root, targetId) === undefined) return err(notFound(targetId))
  if (findFeature(feature, targetId) !== undefined) {
    return err('Uma feature não pode ir para dentro da própria subárvore.')
  }

  if (destination.kind === 'group') {
    const target = locateFeature(model.root, destination.memberId)!
    if (target.kind !== 'member') return err('O destino não é membro de um grupo.')
    if (
      location.kind === 'member' &&
      location.parent.id === target.parent.id &&
      location.childIndex === target.childIndex
    ) {
      return err('A feature já está nesse grupo.')
    }
  }

  const { root: detachedRoot } = detachFeature(model.root, location)

  if (destination.kind === 'child') {
    const moved: Feature =
      location.kind === 'solitary' ? feature : { ...feature, variability: 'optional' }
    const root = updateFeature(detachedRoot, destination.parentId, (parent) => ({
      ...parent,
      children: [...parent.children, { kind: 'feature', feature: moved }]
    }))
    return ok({ ...model, root })
  }

  const target = locateFeature(detachedRoot, destination.memberId)
  if (target === undefined || target.kind !== 'member') {
    return err('O grupo de destino deixou de existir.')
  }
  const moved = withoutVariability(feature)
  const children = target.parent.children.map((child, index) => {
    if (index !== target.childIndex) return child
    const group = groupAt(target.parent, index)
    return { kind: 'group' as const, group: { ...group, members: [...group.members, moved] } }
  })
  const root = updateFeature(detachedRoot, target.parent.id, (parent) => ({ ...parent, children }))
  return ok({ ...model, root })
}

// Auxiliares

function createFeature(
  model: FeatureModel,
  name: string,
  variability: Variability | undefined,
  requestedId: string | undefined
): EditResult<Feature> {
  const trimmed = name.trim()
  if (trimmed === '') return err('O nome não pode ficar vazio.')
  const taken = featureIdSet(model.root)
  const id = requestedId?.trim() ?? generateId(trimmed, taken, 'feature')
  const problem = checkNewFeatureId(id, taken)
  if (problem !== null) return err(problem)
  return ok({
    id,
    name: trimmed,
    ...(variability !== undefined ? { variability } : {}),
    attributes: [],
    children: []
  })
}

/**
 * Confere um ID escolhido na criação da feature (ADR 0004: depois de criada, ele não muda).
 * Devolve `null` quando serve, ou a explicação do problema.
 */
export function checkNewFeatureId(id: string, taken: ReadonlySet<string>): string | null {
  if (!isValidFeatureId(id)) {
    return `O ID "${id}" é inválido: use letras minúsculas, dígitos e _, começando por letra, e evite palavras reservadas.`
  }
  if (taken.has(id)) return `O ID "${id}" já existe no modelo.`
  return null
}

export function editFeature(
  model: FeatureModel,
  featureId: string,
  update: (feature: Feature) => Feature
): EditResult {
  if (findFeature(model.root, featureId) === undefined) return err(notFound(featureId))
  return ok({ ...model, root: updateFeature(model.root, featureId, update) })
}

export function notFound(featureId: string): string {
  return `A feature "${featureId}" não existe.`
}

function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)]
}

function swap<T>(items: readonly T[], from: number, to: number): T[] | undefined {
  if (to < 0 || to >= items.length) return undefined
  const copy = [...items]
  ;[copy[from], copy[to]] = [copy[to], copy[from]]
  return copy
}

function edgeMessage(offset: -1 | 1): string {
  return offset < 0 ? 'A feature já é a primeira.' : 'A feature já é a última.'
}
