import type { Edge, Node } from '@xyflow/react'
import type { DiagramFeature, EdgeMarker } from './diagram-graph'
import type { GroupArc } from './diagram-layout'

/** Nós e linhas do React Flow que o diagrama usa. */

export type FeatureFlowNode = Node<{ feature: DiagramFeature }, 'feature'>

export type GroupArcFlowNode = Node<{ arc: GroupArc }, 'group-arc'>

export type DiagramFlowNode = FeatureFlowNode | GroupArcFlowNode

export type VariabilityFlowEdge = Edge<{ marker: EdgeMarker }, 'variability'>
