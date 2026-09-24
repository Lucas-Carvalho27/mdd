import type { NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import { Check, Lock, X } from 'lucide-react'
import { decisionOf } from '@/domain/configuration/configuration-edits'
import { openConfigurationEntry, type ProjectState } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import type { ConfiguredFeatureFlowNode } from './flow-types'
import { CollapseButton, NodeHandles } from './node-parts'

/** Como a feature aparece no modo configuração (SPEC §7). */
type Shown =
  | 'manual-selected'
  | 'manual-deselected'
  | 'propagated-selected'
  | 'propagated-deselected'
  | 'undecided'

const BOX: Record<Shown, string> = {
  'manual-selected': 'border-emerald-700 bg-emerald-600 text-white',
  'propagated-selected':
    'border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50',
  'manual-deselected': 'border-destructive bg-destructive/10 text-destructive',
  'propagated-deselected': 'border-dashed bg-muted text-muted-foreground',
  undecided: 'bg-card text-card-foreground'
}

const HINT: Record<Shown, string> = {
  'manual-selected': 'Selecionada por você. Clique para desselecionar.',
  'propagated-selected': 'Decidido pelo modelo',
  'manual-deselected': 'Desselecionada por você. Clique para deixar indecisa.',
  'propagated-deselected': 'Decidido pelo modelo',
  undecided: 'Indecisa. Clique para selecionar.'
}

const CHECKED: Record<Shown, 'true' | 'false' | 'mixed'> = {
  'manual-selected': 'true',
  'propagated-selected': 'true',
  'manual-deselected': 'false',
  'propagated-deselected': 'false',
  undecided: 'mixed'
}

/**
 * Nó de feature no modo configuração: o estado vem da resolução da configuração aberta, e o
 * clique alterna a decisão manual. Nós decididos pelo modelo têm cadeado e não respondem.
 */
export function ConfiguredFeatureNode({
  data: { feature }
}: NodeProps<ConfiguredFeatureFlowNode>): React.JSX.Element {
  const shown = useProjectStore((state) => shownStatus(state, feature.id))
  const resolved = useProjectStore((state) => state.openResolution()?.kind === 'resolved')
  const toggleDecision = useProjectStore((state) => state.toggleDecision)
  const locked = shown === 'propagated-selected' || shown === 'propagated-deselected'
  const clickable = resolved && !locked
  const deselected = shown === 'manual-deselected' || shown === 'propagated-deselected'

  return (
    <>
      <div
        data-feature-id={feature.id}
        data-status={shown}
        role="checkbox"
        aria-checked={CHECKED[shown]}
        aria-disabled={!clickable}
        title={clickable || locked ? HINT[shown] : 'Resolva o conflito indicado acima do diagrama.'}
        className={cn(
          'relative flex h-full w-full flex-col items-center justify-center rounded-md border px-3.5 shadow-xs',
          BOX[shown],
          clickable && 'cursor-pointer'
        )}
        onClick={() => clickable && toggleDecision(feature.id)}
      >
        <StatusBadge shown={shown} />
        <span
          className={cn(
            'max-w-full truncate text-sm leading-5 font-medium',
            deselected && 'line-through'
          )}
        >
          {feature.name}
        </span>
        <code className="max-w-full truncate text-xs leading-4 opacity-70">{feature.id}</code>
        <CollapseButton feature={feature} />
      </div>
      <NodeHandles />
    </>
  )
}

/** ✓ selecionada, ✕ desselecionada, cadeado = decidida pelo modelo; indecisa não tem marca. */
function StatusBadge({ shown }: { readonly shown: Shown }): React.JSX.Element | null {
  if (shown === 'undecided') return null
  const icon =
    shown === 'manual-selected' ? <Check /> : shown === 'manual-deselected' ? <X /> : <Lock />
  return (
    <span className="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full border bg-background text-foreground [&_svg]:size-3">
      {icon}
    </span>
  )
}

function shownStatus(state: ProjectState, featureId: string): Shown {
  const resolution = state.openResolution()
  if (resolution?.kind === 'resolved') {
    const status = resolution.features.get(featureId)
    if (status === undefined || status.kind === 'undecided') return 'undecided'
    return `${status.kind}-${status.state}`
  }
  // Em conflito, ou com o modelo vazio, nada é propagado: só as decisões manuais aparecem.
  const entry = openConfigurationEntry(state)
  const manual = entry !== null ? decisionOf(entry.configuration, featureId) : undefined
  return manual === undefined ? 'undecided' : `manual-${manual}`
}
