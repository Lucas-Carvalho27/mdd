import { useCallback, useState } from 'react'
import { X } from 'lucide-react'
import type { ProjectSession } from '@/application/project-session'
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { ConstraintsPanel } from './constraints/ConstraintsPanel'
import { CloseProjectDialog } from './dialogs/CloseProjectDialog'
import { ConflictDialog } from './dialogs/ConflictDialog'
import { CreateGroupDialog } from './dialogs/CreateGroupDialog'
import { DeleteFeatureDialog } from './dialogs/DeleteFeatureDialog'
import { NewFeatureDialog } from './dialogs/NewFeatureDialog'
import type { EditorDialog } from './editor-dialog'
import { FeatureToolbar } from './FeatureToolbar'
import { FeatureTree } from './FeatureTree'
import { ProjectHeader } from './ProjectHeader'
import { FeatureProperties } from './properties/FeatureProperties'
import { useEditorShortcuts } from './use-editor-shortcuts'

export function ProjectScreen({
  session
}: {
  readonly session: ProjectSession
}): React.JSX.Element {
  const problems = useProjectStore((state) => state.problems)
  const warnings = useProjectStore((state) => state.warnings)
  const notice = useProjectStore((state) => state.notice)
  const dismissNotice = useProjectStore((state) => state.dismissNotice)
  const unsaved = useProjectStore(hasUnsavedChanges)
  const close = useProjectStore((state) => state.close)
  const [dialog, setDialog] = useState<EditorDialog>(null)
  const openDialog = useCallback((next: EditorDialog) => setDialog(next), [])
  useEditorShortcuts(openDialog, dialog === null)

  const { project } = session
  const requestClose = (): void => (unsaved ? setDialog({ kind: 'close-project' }) : close())

  return (
    <main className="flex h-screen flex-col">
      <ProjectHeader session={session} onClose={requestClose} />

      {notice !== null && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span className="flex-1">Edição recusada: {notice}</span>
          <Button size="icon-sm" variant="ghost" title="Dispensar" onClick={dismissNotice}>
            <X />
          </Button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_24rem]">
        <section className="min-h-0 space-y-4 overflow-auto p-4">
          <ProblemList title="Não foi possível salvar" tone="error" problems={problems} />
          <ProblemList title="Avisos" tone="warning" problems={warnings} />
          <div>
            <FeatureToolbar model={project.model} onOpenDialog={openDialog} />
            <FeatureTree root={project.model.root} />
          </div>
        </section>
        <aside className="min-h-0 space-y-8 overflow-auto border-l p-4">
          <FeatureProperties project={project} />
          <ConstraintsPanel model={project.model} />
        </aside>
      </div>

      <footer className="border-t px-4 py-1 text-xs text-muted-foreground">
        {project.assets.assets.length} assets · {project.configurations.length} configurações
      </footer>

      {dialog?.kind === 'new-feature' && (
        <NewFeatureDialog
          model={project.model}
          placement={dialog.placement}
          featureId={dialog.featureId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete-feature' && (
        <DeleteFeatureDialog
          project={project}
          featureId={dialog.featureId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'create-group' && (
        <CreateGroupDialog
          model={project.model}
          parentId={dialog.parentId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'close-project' && <CloseProjectDialog onCancel={() => setDialog(null)} />}
      <ConflictDialog />
    </main>
  )
}
