import ELK from 'elkjs/lib/elk.bundled.js'
import type { DiagramFeature, DiagramGraph, DiagramGroup } from './diagram-graph'

/*
 * Posições do diagrama (ADR 0007): sempre calculadas, nunca salvas. O elkjs põe as caixas;
 * o arco de cada grupo e o alvo sob o cursor saem daqui, por geometria, sem olhar o DOM.
 */

export interface Size {
  readonly width: number
  readonly height: number
}

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Box extends Point, Size {}

/**
 * Arco de um grupo: setor de círculo com centro na base do pai, entre as linhas do primeiro
 * e do último membro. Ângulos em radianos com o y para baixo: 0 aponta para a direita e
 * π/2 para baixo, então `startAngle` é o lado direito e `endAngle` o esquerdo.
 */
export interface GroupArc {
  readonly group: DiagramGroup
  readonly center: Point
  readonly startAngle: number
  readonly endAngle: number
}

export interface DiagramLayout {
  readonly boxes: ReadonlyMap<string, Box>
  readonly arcs: readonly GroupArc[]
}

/** Raio do arco desenhado. */
export const ARC_RADIUS = 22
/** Até onde, a partir do centro, soltar conta como "sobre o arco". */
const ARC_HIT_RADIUS = ARC_RADIUS + 14
/** Folga angular do alvo do arco, e abertura mínima de um grupo com um membro só. */
const ARC_ANGLE_MARGIN = 0.12
/** Vão entre a base de um nível e o topo do seguinte: cabe o arco e o círculo da variabilidade. */
const LEVEL_GAP = 72

// mrtree desenha árvores com o pai centrado; MODEL_ORDER mantém a ordem das irmãs,
// que é semântica (é a ordem das seções no produto gerado). O mrtree usa o mesmo
// espaçamento nas duas direções, então só o x vem dele; o y sai do nível (layoutDiagram).
const LAYOUT_OPTIONS = {
  'elk.algorithm': 'mrtree',
  'elk.direction': 'DOWN',
  'elk.mrtree.weighting': 'MODEL_ORDER',
  'elk.spacing.nodeNode': '28'
}

const elk = new ELK()

export async function layoutDiagram(
  graph: DiagramGraph,
  sizeOf: (feature: DiagramFeature) => Size
): Promise<DiagramLayout> {
  const result = await elk.layout({
    id: 'diagrama',
    layoutOptions: LAYOUT_OPTIONS,
    children: graph.features.map((feature) => ({ id: feature.id, ...sizeOf(feature) })),
    edges: graph.edges.map((edge) => ({
      id: `${edge.parentId}->${edge.childId}`,
      sources: [edge.parentId],
      targets: [edge.childId]
    }))
  })
  const tops = levelTops(graph, sizeOf)
  const boxes = new Map<string, Box>(
    (result.children ?? []).map((node) => [
      node.id,
      { x: node.x ?? 0, y: tops.get(node.id)!, width: node.width ?? 0, height: node.height ?? 0 }
    ])
  )
  return { boxes, arcs: graph.groups.map((group) => groupArc(group, boxes)) }
}

/** Topo de cada feature: os níveis ficam um abaixo do outro, separados por LEVEL_GAP. */
function levelTops(
  graph: DiagramGraph,
  sizeOf: (feature: DiagramFeature) => Size
): Map<string, number> {
  const parentOf = new Map(graph.edges.map((edge) => [edge.childId, edge.parentId]))
  const depth = new Map<string, number>()
  const levelHeight: number[] = []
  for (const feature of graph.features) {
    // Pré-ordem: o pai sempre vem antes, então a profundidade dele já é conhecida.
    const parentId = parentOf.get(feature.id)
    const level = parentId === undefined ? 0 : depth.get(parentId)! + 1
    depth.set(feature.id, level)
    levelHeight[level] = Math.max(levelHeight[level] ?? 0, sizeOf(feature).height)
  }
  const levelTop = [0]
  for (let level = 1; level < levelHeight.length; level++) {
    levelTop[level] = levelTop[level - 1] + levelHeight[level - 1] + LEVEL_GAP
  }
  return new Map([...depth].map(([id, level]) => [id, levelTop[level]]))
}

function groupArc(group: DiagramGroup, boxes: ReadonlyMap<string, Box>): GroupArc {
  const parent = boxes.get(group.parentId)!
  const center = { x: parent.x + parent.width / 2, y: parent.y + parent.height }
  const angles = group.memberIds.map((id) => {
    const member = boxes.get(id)!
    return Math.atan2(member.y - center.y, member.x + member.width / 2 - center.x)
  })
  const start = Math.min(...angles)
  const end = Math.max(...angles)
  const spread = Math.max(0, ARC_ANGLE_MARGIN - (end - start)) / 2
  return { group, center, startAngle: start - spread, endAngle: end + spread }
}

/** Onde uma feature arrastada pode ser solta: sobre outra feature ou sobre o arco de um grupo. */
export type DropTarget =
  | { readonly kind: 'feature'; readonly featureId: string }
  | { readonly kind: 'group'; readonly group: DiagramGroup }

/** O alvo sob o ponto (em coordenadas do diagrama), ignorando a própria feature arrastada. */
export function dropTargetAt(
  layout: DiagramLayout,
  point: Point,
  draggedId: string
): DropTarget | null {
  for (const [featureId, box] of layout.boxes) {
    if (featureId === draggedId) continue
    const inside =
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    if (inside) return { kind: 'feature', featureId }
  }
  for (const arc of layout.arcs) {
    const dx = point.x - arc.center.x
    const dy = point.y - arc.center.y
    const angle = Math.atan2(dy, dx)
    const near = dy > 0 && Math.hypot(dx, dy) <= ARC_HIT_RADIUS
    const between =
      angle >= arc.startAngle - ARC_ANGLE_MARGIN && angle <= arc.endAngle + ARC_ANGLE_MARGIN
    if (near && between) return { kind: 'group', group: arc.group }
  }
  return null
}

/** Chave estável de um alvo, para saber se o cursor mudou de alvo durante o arrasto. */
export function dropTargetKey(target: DropTarget): string {
  return target.kind === 'feature' ? `feature:${target.featureId}` : target.group.id
}
