import type { Edge, Node } from '@xyflow/react'
import type { DiagramFeature, EdgeMarker } from './diagram-graph'
import type { GroupArc } from './diagram-layout'

/** Nós e linhas do React Flow que o diagrama usa. */

export type FeatureFlowNode = Node<{ feature: DiagramFeature }, 'feature'>

/** A mesma feature no modo configuração (SPEC §7). */
export type ConfiguredFeatureFlowNode = Node<{ feature: DiagramFeature }, 'configured-feature'>

export type GroupArcFlowNode = Node<{ arc: GroupArc }, 'group-arc'>

export type DiagramFlowNode = FeatureFlowNode | ConfiguredFeatureFlowNode | GroupArcFlowNode

export type VariabilityFlowEdge = Edge<{ marker: EdgeMarker }, 'variability'>
