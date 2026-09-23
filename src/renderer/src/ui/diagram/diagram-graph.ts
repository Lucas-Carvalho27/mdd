import type {
  Feature,
  FeatureModel,
  Group,
  Variability
} from '@/domain/feature-model/feature-model'
import { featuresInPreOrder } from '@/domain/feature-model/traversal'

/*
 * O que o diagrama desenha, ainda sem posições (elas vêm de diagram-layout.ts).
 * Função pura sobre o modelo: nada de React aqui.
 */

/** Ponta da linha que chega à feature: ● obrigatória, ○ opcional, nada em membro de grupo. */
export type EdgeMarker = Variability | 'none'

export interface DiagramFeature {
  readonly id: string
  readonly name: string
  readonly isRoot: boolean
  /** Tem filhas, então pode ser recolhida. */
  readonly hasChildren: boolean
  readonly collapsed: boolean
  /** Quantas features a subárvore recolhida esconde (0 quando expandida). */
  readonly hiddenCount: number
}

export interface DiagramEdge {
  readonly parentId: string
  readonly childId: string
  readonly marker: EdgeMarker
}

export type GroupKind = 'alternative' | 'or' | 'custom'

export interface DiagramGroup {
  /** Único no diagrama: o pai e a posição do grupo entre os filhos dele. */
  readonly id: string
  readonly parentId: string
  readonly kind: GroupKind
  /** `[n..m]`, com `*` quando não há máximo. */
  readonly cardinality: string
  readonly memberIds: readonly string[]
}

export interface DiagramGraph {
  /** Em pré-ordem: cada pai antes das filhas, irmãs na ordem do modelo. */
  readonly features: readonly DiagramFeature[]
  readonly edges: readonly DiagramEdge[]
  readonly groups: readonly DiagramGroup[]
}

/** Monta o grafo do diagrama; as filhas de uma feature recolhida ficam de fora. */
export function buildDiagramGraph(
  model: FeatureModel,
  collapsed: ReadonlySet<string>
): DiagramGraph {
  const features: DiagramFeature[] = []
  const edges: DiagramEdge[] = []
  const groups: DiagramGroup[] = []

  const visit = (feature: Feature, isRoot: boolean): void => {
    const hasChildren = feature.children.length > 0
    const isCollapsed = hasChildren && collapsed.has(feature.id)
    features.push({
      id: feature.id,
      name: feature.name,
      isRoot,
      hasChildren,
      collapsed: isCollapsed,
      hiddenCount: isCollapsed ? featuresInPreOrder(feature).length - 1 : 0
    })
    if (isCollapsed) return

    feature.children.forEach((child, childIndex) => {
      if (child.kind === 'feature') {
        const marker = child.feature.variability ?? 'optional'
        edges.push({ parentId: feature.id, childId: child.feature.id, marker })
        visit(child.feature, false)
        return
      }
      groups.push({
        id: `${feature.id}:grupo:${childIndex}`,
        parentId: feature.id,
        kind: groupKind(child.group),
        cardinality: `[${child.group.min}..${child.group.max}]`,
        memberIds: child.group.members.map((member) => member.id)
      })
      for (const member of child.group.members) {
        edges.push({ parentId: feature.id, childId: member.id, marker: 'none' })
        visit(member, false)
      }
    })
  }

  visit(model.root, true)
  return { features, edges, groups }
}

function groupKind(group: Group): GroupKind {
  if (group.min === 1 && group.max === 1) return 'alternative'
  if (group.min === 1 && group.max === '*') return 'or'
  return 'custom'
}
