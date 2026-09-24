import type { EdgeProps } from '@xyflow/react'
import type { VariabilityFlowEdge } from './flow-types'

const CIRCLE_RADIUS = 5

/**
 * Linha reta do pai à filha. Na ponta da filha: círculo cheio (obrigatória), vazio
 * (opcional) ou nada (membro de grupo, que o arco do grupo já descreve).
 */
export function VariabilityEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data
}: EdgeProps<VariabilityFlowEdge>): React.JSX.Element {
  const marker = data?.marker ?? 'none'
  const length = Math.hypot(targetX - sourceX, targetY - sourceY) || 1
  const ux = (targetX - sourceX) / length
  const uy = (targetY - sourceY) / length
  const circle = { x: targetX - ux * CIRCLE_RADIUS, y: targetY - uy * CIRCLE_RADIUS }
  const end =
    marker === 'none'
      ? { x: targetX, y: targetY }
      : { x: targetX - ux * 2 * CIRCLE_RADIUS, y: targetY - uy * 2 * CIRCLE_RADIUS }

  return (
    <g>
      <path
        d={`M ${sourceX} ${sourceY} L ${end.x} ${end.y}`}
        className="fill-none stroke-foreground/60"
        strokeWidth={1.25}
      />
      {marker !== 'none' && (
        <circle
          data-marker={marker}
          cx={circle.x}
          cy={circle.y}
          r={CIRCLE_RADIUS}
          strokeWidth={1.25}
          className={
            marker === 'mandatory'
              ? 'fill-foreground stroke-foreground'
              : 'fill-background stroke-foreground'
          }
        />
      )}
    </g>
  )
}
