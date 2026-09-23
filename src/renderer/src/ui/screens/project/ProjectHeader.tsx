import { Redo2, Save, Undo2, X } from 'lucide-react'
import type { ProjectSession } from '@/application/project-session'
import { Button } from '@/ui/components/ui/button'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface ProjectHeaderProps {
  readonly session: ProjectSession
  readonly onClose: () => void
}

export function ProjectHeader({ session, onClose }: ProjectHeaderProps): React.JSX.Element {
  const busy = useProjectStore((state) => state.busy)
  const unsaved = useProjectStore(hasUnsavedChanges)
  const lastSavedAt = useProjectStore((state) => state.lastSavedAt)
  const undoLabel = useProjectStore((state) => state.history.past.at(-1)?.label)
  const redoLabel = useProjectStore((state) => state.history.future[0]?.label)
  const undo = useProjectStore((state) => state.undo)
  const redo = useProjectStore((state) => state.redo)
  const save = useProjectStore((state) => state.save)

  return (
    <header className="flex items-center gap-2 border-b px-4 py-2">
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-semibold">
          {unsaved && <span title="Alterações não salvas">• </span>}
          {session.project.model.name}
        </h1>
        <p className="truncate text-xs text-muted-foreground">{session.folder.rootPath}</p>
      </div>
      {lastSavedAt !== null && !unsaved && (
        <span className="text-xs text-muted-foreground">
          Salvo às {lastSavedAt.toLocaleTimeString('pt-BR')}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        disabled={undoLabel === undefined}
        title={undoLabel ? `Desfazer: ${undoLabel} (Ctrl+Z)` : 'Nada para desfazer'}
        onClick={undo}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={redoLabel === undefined}
        title={redoLabel ? `Refazer: ${redoLabel} (Ctrl+Y)` : 'Nada para refazer'}
        onClick={redo}
      >
        <Redo2 />
      </Button>
      <Button disabled={busy} title="Salvar (Ctrl+S)" onClick={() => void save()}>
        <Save /> Salvar
      </Button>
      <Button variant="outline" onClick={onClose}>
        <X /> Fechar
      </Button>
    </header>
  )
}
