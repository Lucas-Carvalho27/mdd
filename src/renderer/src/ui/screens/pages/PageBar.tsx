import { LayoutTemplate, Monitor, RotateCw, Smartphone, Tablet } from 'lucide-react'
import type { ConfigurationEntry } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { GenerateButton } from '@/ui/screens/configurator/GenerateButton'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'

const WIDTHS = [
  { width: 'mobile', label: 'Celular', Icon: Smartphone },
  { width: 'tablet', label: 'Tablet', Icon: Tablet },
  { width: 'full', label: 'Largura toda', Icon: Monitor }
] as const

interface PageBarProps {
  readonly entry: ConfigurationEntry
  readonly defaultFrame: boolean
  readonly onOpenDialog: (dialog: EditorDialog) => void
  readonly onCreateFrame: () => void
}

/** A barra acima da página: a configuração, as larguras, "Recarregar" e "Gerar produto". */
export function PageBar({
  entry,
  defaultFrame,
  onOpenDialog,
  onCreateFrame
}: PageBarProps): React.JSX.Element {
  const width = useProjectStore((state) => state.pageWidth)
  const setWidth = useProjectStore((state) => state.setPageWidth)
  const refresh = useProjectStore((state) => state.refreshPage)

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <div className="mr-auto min-w-0">
          <h2 className="truncate font-semibold">{entry.configuration.name}</h2>
          <p className="truncate font-mono text-xs text-muted-foreground">
            configurations/{entry.key}.xml
          </p>
        </div>
        <div role="group" aria-label="Largura da página" className="flex gap-0.5">
          {WIDTHS.map(({ width: target, label, Icon }) => (
            <Button
              key={target}
              size="sm"
              variant={width === target ? 'secondary' : 'ghost'}
              aria-pressed={width === target}
              onClick={() => setWidth(target)}
            >
              <Icon /> {label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          <RotateCw /> Recarregar
        </Button>
        <GenerateButton configurationKey={entry.key} onOpenDialog={onOpenDialog} />
      </div>
      {defaultFrame && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LayoutTemplate className="size-3.5" />
          Sem moldura.html: a página usa a moldura padrão.
          <Button size="xs" variant="link" className="h-auto p-0" onClick={onCreateFrame}>
            Criar moldura
          </Button>
        </p>
      )}
    </div>
  )
}
