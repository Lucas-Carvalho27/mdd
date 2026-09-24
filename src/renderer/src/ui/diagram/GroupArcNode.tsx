import type { NodeProps } from '@xyflow/react'
import { useDropState } from './diagram-context'
import { ARC_RADIUS } from './diagram-layout'
import type { GroupArcFlowNode } from './flow-types'

// Classes escritas por inteiro, para o Tailwind encontrá-las no código.
const COLORS = {
  idle: { stroke: 'stroke-foreground', fill: 'fill-foreground' },
  valid: { stroke: 'stroke-emerald-500', fill: 'fill-emerald-500' },
  invalid: { stroke: 'stroke-destructive', fill: 'fill-destructive' }
}

/**
 * Arco de um grupo, colado na base do pai: vazio = alternative, cheio = or; nos demais,
 * vazio com a cardinalidade ao lado. O nó ocupa o retângulo 2r × r logo abaixo do centro,
 * e o SVG usa o centro do arco como origem (r, 0).
 */
export function GroupArcNode({ data: { arc } }: NodeProps<GroupArcFlowNode>): React.JSX.Element {
  const drop = useDropState(arc.group.id)
  const r = ARC_RADIUS
  const point = (angle: number): string => `${r + r * Math.cos(angle)} ${r * Math.sin(angle)}`
  const curve = `${point(arc.startAngle)} A ${r} ${r} 0 0 1 ${point(arc.endAngle)}`
  const filled = arc.group.kind === 'or'
  const color = COLORS[drop ?? 'idle']

  return (
    <svg
      width={2 * r}
      height={r}
      overflow="visible"
      data-group-id={arc.group.id}
      data-group-kind={arc.group.kind}
      className="pointer-events-none"
    >
      <path
        d={filled ? `M ${r} 0 L ${curve} Z` : `M ${curve}`}
        strokeWidth={drop === null ? 1.5 : 3}
        className={`${filled ? color.fill : 'fill-none'} ${color.stroke}`}
      />
      {arc.group.kind === 'custom' && (
        <text x={2 * r + 4} y={12} className="fill-foreground text-[11px]">
          {arc.group.cardinality}
        </text>
      )}
    </svg>
  )
}
