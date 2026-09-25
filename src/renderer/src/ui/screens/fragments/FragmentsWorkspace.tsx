import { useEffect, useMemo } from 'react'
import { FilePlus2, RefreshCw } from 'lucide-react'
import type { Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { fragmentTreePaths, shownFragment } from '@/ui/stores/fragments-actions'
import { useProjectStore, useProjectStoreApi } from '@/ui/stores/project-store-context'
import { FragmentBar } from './FragmentBar'
import { FragmentEditor } from './FragmentEditor'
import type { FragmentEditorStates } from './fragment-editor-states'
import { FragmentTree } from './FragmentTree'
import { buildFragmentTree } from './fragment-tree'

/** Quanto esperar depois da última tecla para conferir o fragmento. */
const CHECK_DELAY_MS = 500

interface FragmentsWorkspaceProps {
  readonly project: Project
  readonly onOpenDialog: (dialog: EditorDialog) => void
  /** O estado do editor de cada arquivo, guardado pela tela do projeto. */
  readonly editorStates: FragmentEditorStates
}

/**
 * Aba Fragmentos (Fase 6): a árvore dos `.xml` do projeto à esquerda e o editor do arquivo
 * exibido no centro, com a barra do arquivo e a lista de problemas.
 */
export function FragmentsWorkspace({
  project,
  onOpenDialog,
  editorStates
}: FragmentsWorkspaceProps): React.JSX.Element {
  const store = useProjectStoreApi()
  const files = useProjectStore((state) => state.fragmentFiles)
  const documents = useProjectStore((state) => state.fragmentDocuments)
  const shown = useProjectStore(shownFragment)
  const problems = useProjectStore((state) =>
    state.shownFragmentPath === null
      ? undefined
      : state.fragmentProblems.get(state.shownFragmentPath)
  )
  const selectedFeatureId = useProjectStore((state) => state.selectedFeatureId)
  const showFragment = useProjectStore((state) => state.showFragment)
  const changeText = useProjectStore((state) => state.changeFragmentText)
  const checkFragment = useProjectStore((state) => state.checkFragment)
  const refresh = useProjectStore((state) => state.refreshFragments)

  // Entrar na aba lê as pastas; nas outras vezes, também relê os fragmentos sem alteração.
  useEffect(() => {
    const state = store.getState()
    void (state.fragmentFiles === null ? state.loadFragmentFiles() : state.refreshFragments())
  }, [store])

  // Confere o texto um pouco depois da última tecla.
  const shownPath = shown?.path
  const shownText = shown?.text
  useEffect(() => {
    if (shownPath === undefined || shownText === undefined) return
    const timer = setTimeout(() => void checkFragment(shownPath), CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [shownPath, shownText, checkFragment])

  const tree = useMemo(
    () => buildFragmentTree(fragmentTreePaths(files, documents)),
    [files, documents]
  )
  const linked = useMemo(
    () => new Set(project.assets.assets.map((asset) => asset.path)),
    [project.assets]
  )
  const hasFiles = tree.folders.length > 0 || tree.files.length > 0
  const newFragment = (): void => onOpenDialog({ kind: 'new-fragment' })

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[16rem_1fr]">
      <aside className="flex min-h-0 flex-col border-r">
        <div className="flex items-center gap-1 border-b p-2">
          <Button size="sm" onClick={newFragment}>
            <FilePlus2 /> Novo fragmento
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="ml-auto"
            title="Atualizar"
            onClick={() => void refresh()}
          >
            <RefreshCw />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto py-1">
          {files === null ? (
            <p className="p-3 text-sm text-muted-foreground">Lendo as pastas…</p>
          ) : hasFiles ? (
            <FragmentTree
              root={tree}
              documents={documents}
              linked={linked}
              shownPath={shown?.path ?? null}
              onShow={(path) => void showFragment(path)}
            />
          ) : (
            <p className="p-3 text-sm text-muted-foreground">Nenhum fragmento no projeto.</p>
          )}
        </div>
      </aside>
      <section className="flex min-h-0 flex-col">
        {shown === null ? (
          <div className="max-w-prose space-y-3 p-6 text-sm text-muted-foreground">
            <p>
              Um fragmento é um arquivo XML de documentação. Vinculado a uma feature como asset, ele
              entra no produto gerado das configurações que selecionam a feature.
            </p>
            <p>Escolha um arquivo à esquerda ou crie um novo.</p>
            <Button size="sm" onClick={newFragment}>
              <FilePlus2 /> Novo fragmento
            </Button>
          </div>
        ) : (
          <>
            <FragmentBar
              document={shown}
              assets={project.assets.assets.filter((asset) => asset.path === shown.path)}
              onLink={() =>
                onOpenDialog({
                  kind: 'link-asset',
                  path: shown.path,
                  anchor: selectedFeatureId ?? project.model.root.id
                })
              }
              onDiscard={() => onOpenDialog({ kind: 'discard-fragment', path: shown.path })}
            />
            <FragmentEditor
              document={shown}
              problems={problems}
              states={editorStates}
              onChange={changeText}
            />
          </>
        )}
      </section>
    </div>
  )
}
