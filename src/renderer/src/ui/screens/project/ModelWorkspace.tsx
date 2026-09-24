import type { ProjectSession } from '@/application/project-session'
import type { FeatureActions } from '@/ui/diagram/diagram-context'
import { FeatureDiagram } from '@/ui/diagram/FeatureDiagram'
import { ConstraintsPanel } from './constraints/ConstraintsPanel'
import type { EditorDialog } from './editor-dialog'
import { FeatureToolbar } from './FeatureToolbar'
import { FeatureProperties } from './properties/FeatureProperties'

interface ModelWorkspaceProps {
  readonly session: ProjectSession
  readonly actions: FeatureActions
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/** Aba Modelo: barra de ações e diagrama no centro, propriedades e restrições à direita. */
export function ModelWorkspace({
  session,
  actions,
  onOpenDialog
}: ModelWorkspaceProps): React.JSX.Element {
  const { project } = session
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_24rem]">
      <section className="flex min-h-0 flex-col gap-3 p-4">
        <FeatureToolbar model={project.model} onOpenDialog={onOpenDialog} />
        <div className="min-h-0 flex-1 rounded-md border">
          <FeatureDiagram
            key={session.folder.rootPath}
            model={project.model}
            mode={{ kind: 'edit', actions }}
          />
        </div>
      </section>
      <aside className="min-h-0 space-y-8 overflow-auto border-l p-4">
        <FeatureProperties project={project} />
        <ConstraintsPanel model={project.model} />
      </aside>
    </div>
  )
}
