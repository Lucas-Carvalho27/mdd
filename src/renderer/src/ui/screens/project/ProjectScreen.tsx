import { useCallback, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { ProjectSession } from '@/application/project-session'
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
import type { FeatureActions } from '@/ui/diagram/diagram-context'
import { ConfigurationDialogs } from '@/ui/screens/configurator/ConfigurationDialogs'
import { ConfigurationStatusBar } from '@/ui/screens/configurator/ConfigurationStatusBar'
import { AssetsWorkspace } from '@/ui/screens/assets/AssetsWorkspace'
import { LinkAssetDialog } from '@/ui/screens/assets/LinkAssetDialog'
import { ConfiguratorWorkspace } from '@/ui/screens/configurator/ConfiguratorWorkspace'
import { GenerationDialogs } from '@/ui/screens/configurator/GenerationDialogs'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { CloseProjectDialog } from './dialogs/CloseProjectDialog'
import { ConflictDialog } from './dialogs/ConflictDialog'
import { CreateGroupDialog } from './dialogs/CreateGroupDialog'
import { DeleteFeatureDialog } from './dialogs/DeleteFeatureDialog'
import { NewFeatureDialog } from './dialogs/NewFeatureDialog'
import type { EditorDialog } from './editor-dialog'
import { ModelWorkspace } from './ModelWorkspace'
import { ProjectHeader } from './ProjectHeader'
import { useEditorShortcuts } from './use-editor-shortcuts'
import { useWindowFocus } from './use-window-focus'
import { ViewRail, type ProjectView } from './ViewRail'

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
  const checkAssetFiles = useProjectStore((state) => state.checkAssetFiles)
  const [view, setView] = useState<ProjectView>('model')
  const [dialog, setDialog] = useState<EditorDialog>(null)
  const openDialog = useCallback((next: EditorDialog) => setDialog(next), [])
  useEditorShortcuts(openDialog, {
    enabled: dialog === null,
    history: view !== 'configurations',
    editing: view === 'model'
  })
  // Um arquivo pode ter sido renomeado fora do app enquanto a janela estava em segundo plano.
  const onWindowFocus = useCallback(() => void checkAssetFiles(), [checkAssetFiles])
  useWindowFocus(onWindowFocus)
  const actions = useMemo<FeatureActions>(
    () => ({
      addChild: (featureId) => openDialog({ kind: 'new-feature', placement: 'child', featureId }),
      addSibling: (featureId) =>
        openDialog({ kind: 'new-feature', placement: 'sibling', featureId }),
      groupChildren: (parentId) => openDialog({ kind: 'create-group', parentId }),
      remove: (featureId) => openDialog({ kind: 'delete-feature', featureId })
    }),
    [openDialog]
  )

  const { project } = session
  const requestClose = (): void => (unsaved ? setDialog({ kind: 'close-project' }) : close())

  return (
    <main className="flex h-screen flex-col">
      <ProjectHeader
        session={session}
        historyEnabled={view !== 'configurations'}
        onClose={requestClose}
      />

      {notice !== null && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span className="flex-1">{notice}</span>
          <Button size="icon-sm" variant="ghost" title="Dispensar" onClick={dismissNotice}>
            <X />
          </Button>
        </div>
      )}

      {(problems.length > 0 || warnings.length > 0) && (
        <div className="space-y-2 border-b p-4">
          <ProblemList title="Não foi possível salvar" tone="error" problems={problems} />
          <ProblemList title="Avisos" tone="warning" problems={warnings} />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <ViewRail view={view} onChange={setView} />
        {view === 'model' && (
          <ModelWorkspace session={session} actions={actions} onOpenDialog={openDialog} />
        )}
        {view === 'configurations' && (
          <ConfiguratorWorkspace project={project} onOpenDialog={openDialog} />
        )}
        {view === 'assets' && <AssetsWorkspace project={project} onOpenDialog={openDialog} />}
      </div>

      <footer className="border-t px-4 py-1 text-xs text-muted-foreground">
        {view === 'configurations' ? (
          <ConfigurationStatusBar />
        ) : (
          `${project.assets.assets.length} assets · ${project.configurations.length} configurações`
        )}
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
      {dialog?.kind === 'link-asset' && (
        <LinkAssetDialog
          model={project.model}
          catalog={project.assets}
          path={dialog.path}
          anchor={dialog.anchor}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfigurationDialogs
        dialog={dialog}
        configurations={project.configurations}
        onClose={() => setDialog(null)}
      />
      <GenerationDialogs
        dialog={dialog}
        onOpenDialog={openDialog}
        onClose={() => setDialog(null)}
      />
      <ConflictDialog />
    </main>
  )
}
