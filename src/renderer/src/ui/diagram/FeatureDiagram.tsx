import '@xyflow/react/dist/base.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  applyNodeChanges,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore as useFlowStore,
  type NodeChange,
  type OnNodeDrag
} from '@xyflow/react'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import * as cmd from '@/application/editing/commands'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import type { MoveDestination } from '@/domain/feature-model/feature-edits'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import {
  DropHighlightContext,
  FeatureActionsContext,
  type DropHighlight,
  type FeatureActions
} from './diagram-context'
import { buildDiagramGraph, type DiagramGraph } from './diagram-graph'
import {
  ARC_RADIUS,
  dropTargetAt,
  dropTargetKey,
  layoutDiagram,
  type DiagramLayout,
  type DropTarget
} from './diagram-layout'
import { FeatureNode } from './FeatureNode'
import type { DiagramFlowNode, VariabilityFlowEdge } from './flow-types'
import { GroupArcNode } from './GroupArcNode'
import { measureFeature } from './measure-feature'
import { VariabilityEdge } from './VariabilityEdge'

const NODE_TYPES = { feature: FeatureNode, 'group-arc': GroupArcNode }
const EDGE_TYPES = { variability: VariabilityEdge }
const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1 }
// O React Flow desliga o mouse em nós que não são arrastáveis nem selecionáveis, como a
// raiz; as features precisam dele sempre (clique e menu de contexto). Os arcos, não.
const FEATURE_NODE_STYLE = { pointerEvents: 'all' } as const
const ARIA_LABELS = {
  'node.a11yDescription.default': 'Clique para selecionar a feature.',
  'node.a11yDescription.keyboardDisabled': 'Clique para selecionar a feature.',
  'edge.a11yDescription.default': 'Ligação entre uma feature e a filha.'
}

interface Placed {
  readonly graph: DiagramGraph
  readonly layout: DiagramLayout
}

interface Hover extends DropHighlight {
  readonly target: DropTarget
}

interface FeatureDiagramProps {
  readonly model: FeatureModel
  readonly actions: FeatureActions
}

/**
 * Diagrama do Feature Model (SPEC §7, ADR 0007): layout sempre calculado, arrastar um nó
 * muda o pai da feature, e toda edição passa pelos comandos do histórico.
 */
export function FeatureDiagram({ model, actions }: FeatureDiagramProps): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <FeatureActionsContext value={actions}>
        <DiagramCanvas model={model} />
      </FeatureActionsContext>
    </ReactFlowProvider>
  )
}

function DiagramCanvas({ model }: { readonly model: FeatureModel }): React.JSX.Element {
  const collapsed = useProjectStore((state) => state.collapsedFeatureIds)
  const selectedId = useProjectStore((state) => state.selectedFeatureId)
  const check = useProjectStore((state) => state.check)
  const run = useProjectStore((state) => state.run)
  const { fitView, getViewport, screenToFlowPosition, setCenter, zoomIn, zoomOut } = useReactFlow<
    DiagramFlowNode,
    VariabilityFlowEdge
  >()
  const viewWidth = useFlowStore((state) => state.width)
  const viewHeight = useFlowStore((state) => state.height)

  const graph = useMemo(() => buildDiagramGraph(model, collapsed), [model, collapsed])
  const [placed, setPlaced] = useState<Placed | null>(null)
  useEffect(() => {
    // Um layout antigo que termine depois de um novo é descartado.
    let current = true
    void layoutDiagram(graph, measureFeature).then((layout) => {
      if (current) setPlaced({ graph, layout })
    })
    return () => {
      current = false
    }
  }, [graph])

  const laidOut = useMemo(() => (placed === null ? [] : toFlowNodes(placed)), [placed])
  const edges = useMemo(() => (placed === null ? [] : toFlowEdges(placed.graph)), [placed])

  // Os nós seguem o layout; entre um layout e outro, só o arrasto muda a posição de um nó.
  const [nodes, setNodes] = useState<DiagramFlowNode[]>([])
  const [source, setSource] = useState<DiagramFlowNode[]>([])
  if (source !== laidOut) {
    setSource(laidOut)
    setNodes(laidOut)
  }
  const onNodesChange = (changes: NodeChange<DiagramFlowNode>[]): void => {
    const allowed = changes.filter(
      (change) => change.type === 'position' || change.type === 'dimensions'
    )
    setNodes((current) => applyNodeChanges(allowed, current))
  }

  const [hover, setHover] = useState<Hover | null>(null)
  const onNodeDrag: OnNodeDrag<DiagramFlowNode> = (event, node) => {
    if (placed === null) return
    const pointer = 'changedTouches' in event ? event.changedTouches[0] : event
    const point = screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY })
    const target = dropTargetAt(placed.layout, point, node.id)
    const key = target === null ? null : dropTargetKey(target)
    if (key === (hover?.key ?? null)) return
    setHover(
      target === null
        ? null
        : {
            key: key!,
            target,
            valid: check(cmd.moveFeature(node.id, destinationOf(target))) === null
          }
    )
  }
  const onNodeDragStop: OnNodeDrag<DiagramFlowNode> = (_event, node) => {
    // Alvo inválido: o comando é recusado e o motivo aparece no aviso de edição recusada.
    if (hover !== null) run(cmd.moveFeature(node.id, destinationOf(hover.target)))
    setHover(null)
    setNodes(laidOut)
  }

  // Ao abrir, ajusta à tela; depois, só rola se a feature selecionada sair da área visível.
  const fitted = useRef(false)
  useEffect(() => {
    if (placed === null || viewWidth === 0) return
    if (!fitted.current) {
      fitted.current = true
      void fitView(FIT_VIEW_OPTIONS)
      return
    }
    const box = selectedId !== null ? placed.layout.boxes.get(selectedId) : undefined
    if (box === undefined) return
    const { x, y, zoom } = getViewport()
    const left = box.x * zoom + x
    const top = box.y * zoom + y
    const visible =
      left >= 0 &&
      top >= 0 &&
      left + box.width * zoom <= viewWidth &&
      top + box.height * zoom <= viewHeight
    if (!visible)
      void setCenter(box.x + box.width / 2, box.y + box.height / 2, { zoom, duration: 200 })
  }, [placed, selectedId, viewWidth, viewHeight, fitView, getViewport, setCenter])

  return (
    <DropHighlightContext value={hover}>
      <ReactFlow<DiagramFlowNode, VariabilityFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        disableKeyboardA11y
        nodeDragThreshold={4}
        minZoom={0.2}
        maxZoom={2}
        ariaLabelConfig={ARIA_LABELS}
        proOptions={{ hideAttribution: true }}
      >
        <Panel position="bottom-left" className="flex gap-1">
          <Button size="icon-sm" variant="outline" title="Aproximar" onClick={() => void zoomIn()}>
            <ZoomIn />
          </Button>
          <Button size="icon-sm" variant="outline" title="Afastar" onClick={() => void zoomOut()}>
            <ZoomOut />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            title="Ajustar à tela"
            onClick={() => void fitView(FIT_VIEW_OPTIONS)}
          >
            <Maximize />
          </Button>
        </Panel>
      </ReactFlow>
    </DropHighlightContext>
  )
}

function destinationOf(target: DropTarget): MoveDestination {
  return target.kind === 'feature'
    ? { kind: 'child', parentId: target.featureId }
    : { kind: 'group', memberId: target.group.memberIds[0] }
}

/** Features em pré-ordem (a ordem do DOM), depois os arcos dos grupos. */
function toFlowNodes({ graph, layout }: Placed): DiagramFlowNode[] {
  const features: DiagramFlowNode[] = graph.features.map((feature) => {
    const box = layout.boxes.get(feature.id)!
    return {
      id: feature.id,
      type: 'feature',
      position: { x: box.x, y: box.y },
      width: box.width,
      height: box.height,
      draggable: !feature.isRoot,
      style: FEATURE_NODE_STYLE,
      data: { feature }
    }
  })
  const arcs: DiagramFlowNode[] = layout.arcs.map((arc) => ({
    id: arc.group.id,
    type: 'group-arc',
    position: { x: arc.center.x - ARC_RADIUS, y: arc.center.y },
    width: 2 * ARC_RADIUS,
    height: ARC_RADIUS,
    draggable: false,
    data: { arc }
  }))
  return [...features, ...arcs]
}

function toFlowEdges(graph: DiagramGraph): VariabilityFlowEdge[] {
  return graph.edges.map((edge) => ({
    id: `${edge.parentId}->${edge.childId}`,
    source: edge.parentId,
    target: edge.childId,
    type: 'variability',
    data: { marker: edge.marker }
  }))
}
