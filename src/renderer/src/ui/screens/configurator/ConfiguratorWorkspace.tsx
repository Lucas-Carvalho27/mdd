import { Copy, Pencil, Trash2 } from 'lucide-react'
import type { ConfigurationEntry, Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { FeatureDiagram, type DiagramMode } from '@/ui/diagram/FeatureDiagram'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { openConfigurationEntry } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AttributeValuesPanel } from './AttributeValuesPanel'
import { ConfigurationList } from './ConfigurationList'
import { ConfigurationProblems } from './ConfigurationProblems'

const CONFIGURE: DiagramMode = { kind: 'configure' }

interface ConfiguratorWorkspaceProps {
  readonly project: Project
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/**
 * Aba Configurações (SPEC §7): a lista à esquerda; no centro, o mesmo diagrama do modelo
 * em modo configuração; à direita, os valores dos atributos.
 */
export function ConfiguratorWorkspace({
  project,
  onOpenDialog
}: ConfiguratorWorkspaceProps): React.JSX.Element {
  const entry = useProjectStore(openConfigurationEntry)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[15rem_1fr_22rem]">
      <ConfigurationList configurations={project.configurations} onOpenDialog={onOpenDialog} />
      <section className="flex min-h-0 flex-col gap-3 p-4">
        {entry === null ? (
          <p className="text-sm text-muted-foreground">
            {project.configurations.length === 0
              ? 'Crie uma configuração para escolher as features de um produto.'
              : 'Escolha uma configuração na lista.'}
          </p>
        ) : (
          <>
            <ConfigurationToolbar entry={entry} onOpenDialog={onOpenDialog} />
            <ConfigurationProblems model={project.model} />
            <div className="min-h-0 flex-1 rounded-md border">
              <FeatureDiagram model={project.model} mode={CONFIGURE} />
            </div>
          </>
        )}
      </section>
      <aside className="min-h-0 overflow-auto border-l p-4">
        {entry !== null && <AttributeValuesPanel model={project.model} entry={entry} />}
      </aside>
    </div>
  )
}

interface ConfigurationToolbarProps {
  readonly entry: ConfigurationEntry
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

function ConfigurationToolbar({
  entry,
  onOpenDialog
}: ConfigurationToolbarProps): React.JSX.Element {
  const { key, configuration } = entry
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <div className="mr-auto min-w-0">
          <h2 className="truncate font-semibold">{configuration.name}</h2>
          <p className="truncate font-mono text-xs text-muted-foreground">
            configurations/{key}.xml
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenDialog({ kind: 'rename-configuration', key })}
        >
          <Pencil /> Renomear…
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenDialog({ kind: 'duplicate-configuration', key })}
        >
          <Copy /> Duplicar…
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenDialog({ kind: 'delete-configuration', key })}
        >
          <Trash2 /> Excluir…
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Clique numa feature para alternar entre indecisa, selecionada e desselecionada. O cadeado
        marca o que o modelo decide.
      </p>
    </div>
  )
}
