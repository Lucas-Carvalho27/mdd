import { ListChecks, Network, Paperclip } from 'lucide-react'
import { cn } from 'cn'

/** As abas da barra lateral (SPEC §7). */
export type ProjectView = 'model' | 'configurations' | 'assets'

const VIEWS = [
  { view: 'model', label: 'Modelo', Icon: Network },
  { view: 'configurations', label: 'Configurações', Icon: ListChecks },
  { view: 'assets', label: 'Assets', Icon: Paperclip }
] as const

interface ViewRailProps {
  readonly view: ProjectView
  readonly onChange: (view: ProjectView) => void
}

export function ViewRail({ view, onChange }: ViewRailProps): React.JSX.Element {
  return (
    <nav aria-label="Seções do projeto" className="flex w-24 shrink-0 flex-col gap-1 border-r p-2">
      {VIEWS.map(({ view: target, label, Icon }) => (
        <button
          key={target}
          type="button"
          aria-current={view === target ? 'page' : undefined}
          className={cn(
            'flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] leading-tight',
            view === target
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50'
          )}
          onClick={() => onChange(target)}
        >
          <Icon className="size-5" />
          {label}
        </button>
      ))}
    </nav>
  )
}
