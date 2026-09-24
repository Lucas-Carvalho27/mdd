import { Plus } from 'lucide-react'
import { cn } from 'cn'
import type { ConfigurationEntry } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'

interface ConfigurationListProps {
  readonly configurations: readonly ConfigurationEntry[]
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/** A lista de configurações do projeto; um clique abre a configuração no diagrama. */
export function ConfigurationList({
  configurations,
  onOpenDialog
}: ConfigurationListProps): React.JSX.Element {
  const openKey = useProjectStore((state) => state.openConfigurationKey)
  const openConfiguration = useProjectStore((state) => state.openConfiguration)

  return (
    <nav aria-label="Configurações" className="flex min-h-0 flex-col gap-2 border-r p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Configurações
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpenDialog({ kind: 'new-configuration' })}
        >
          <Plus /> Nova
        </Button>
      </div>
      {configurations.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma configuração ainda. Crie uma para escolher as features de um produto.
        </p>
      )}
      <ul className="min-h-0 space-y-1 overflow-auto">
        {configurations.map(({ key, configuration }) => (
          <li key={key}>
            <button
              type="button"
              data-configuration-key={key}
              aria-current={key === openKey ? 'true' : undefined}
              className={cn(
                'w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                key === openKey && 'bg-accent font-medium'
              )}
              onClick={() => openConfiguration(key)}
            >
              <span className="block truncate">{configuration.name}</span>
              <span className="block truncate font-mono text-xs text-muted-foreground">
                {key}.xml
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
