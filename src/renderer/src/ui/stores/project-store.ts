import { createStore, type StoreApi } from 'zustand/vanilla'
import type { EditorCommand, EditorState } from '@/application/editing/editor-command'
import {
  EMPTY_HISTORY,
  executeCommand,
  redo,
  undo,
  type EditHistory,
  type HistoryStep
} from '@/application/editing/edit-history'
import type { FileProblem } from '@/application/file-problem'
import type { RecentProject } from '@/application/ports/recent-projects'
import type { UnsavedChangesIndicator } from '@/application/ports/unsaved-changes-indicator'
import type { ProjectSession } from '@/application/project-session'
import type { CreateProjectResult } from '@/application/use-cases/create-project'
import type { OpenProjectResult } from '@/application/use-cases/open-project'
import type { SaveOptions, SaveProjectResult } from '@/application/use-cases/save-project'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { findFeature } from '@/domain/feature-model/tree'

/** Casos de uso e serviços de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices {
  readonly openProject: {
    execute(): Promise<OpenProjectResult>
    reopen(rootPath: string): Promise<OpenProjectResult>
  }
  readonly createProject: {
    execute(name: string, rootId?: string): Promise<CreateProjectResult>
  }
  readonly saveProject: {
    execute(session: ProjectSession, options?: SaveOptions): Promise<SaveProjectResult>
  }
  readonly recentProjects: { list(): Promise<RecentProject[]> }
  readonly unsavedChanges: UnsavedChangesIndicator
}

export interface ProjectState {
  readonly session: ProjectSession | null
  /** Modelo e assets como estão no disco; comparar com a sessão diz se há alterações. */
  readonly saved: EditorState | null
  readonly history: EditHistory
  readonly selectedFeatureId: string | null
  readonly busy: boolean
  /** Erros da última abertura ou gravação. */
  readonly problems: readonly FileProblem[]
  /** Avisos do projeto aberto; não impedem nada. */
  readonly warnings: readonly FileProblem[]
  /** Arquivos alterados fora do app na última gravação: a interface pergunta o que fazer. */
  readonly conflicts: readonly string[]
  /** Por que a última edição foi recusada. */
  readonly notice: string | null
  readonly recents: readonly RecentProject[]
  readonly lastSavedAt: Date | null

  loadRecents(): Promise<void>
  open(): Promise<void>
  openRecent(rootPath: string): Promise<void>
  create(name: string, rootId?: string): Promise<void>
  save(options?: SaveOptions): Promise<void>
  /** Relê o projeto do disco, descartando as alterações ("Recarregar", SPEC §8). */
  reload(): Promise<void>
  dismissConflicts(): void
  close(): void
  /** Executa uma edição; devolve `false` se ela foi recusada (o motivo fica em `notice`). */
  run(command: EditorCommand): boolean
  undo(): void
  redo(): void
  selectFeature(featureId: string): void
  dismissNotice(): void
}

export type ProjectStore = StoreApi<ProjectState>

export function editorStateOf(session: ProjectSession): EditorState {
  return { model: session.project.model, assets: session.project.assets }
}

export function hasUnsavedChanges(state: ProjectState): boolean {
  if (state.session === null || state.saved === null) return false
  const { model, assets } = state.session.project
  return model !== state.saved.model || assets !== state.saved.assets
}

const CLOSED = {
  session: null,
  saved: null,
  history: EMPTY_HISTORY,
  selectedFeatureId: null,
  problems: [],
  warnings: [],
  conflicts: [],
  notice: null,
  lastSavedAt: null
} satisfies Partial<ProjectState>

/** Estado de tela do editor. As regras ficam no domínio e nos casos de uso, não aqui. */
export function createProjectStore(services: ProjectStoreServices): ProjectStore {
  const store = createStore<ProjectState>()((set, get) => {
    const opened = (session: ProjectSession, warnings: readonly FileProblem[]): void => {
      set({
        ...CLOSED,
        busy: false,
        session,
        warnings,
        saved: editorStateOf(session),
        selectedFeatureId: session.project.model.root.id
      })
      void get().loadRecents()
    }

    const handleOpen = (result: OpenProjectResult): void => {
      if (result.status === 'opened') opened(result.session, result.warnings)
      else set({ busy: false, problems: result.status === 'failed' ? result.problems : [] })
    }

    const applyStep = (step: HistoryStep): void => {
      const { session, selectedFeatureId } = get()
      if (session === null) return
      const project = { ...session.project, ...step.state }
      set({
        session: { ...session, project },
        history: step.history,
        notice: null,
        selectedFeatureId: nextSelection(selectedFeatureId, project.model, step.focusFeatureId)
      })
    }

    return {
      ...CLOSED,
      busy: false,
      recents: [],

      async loadRecents() {
        set({ recents: await services.recentProjects.list() })
      },

      async open() {
        set({ busy: true, problems: [] })
        handleOpen(await services.openProject.execute())
      },

      async openRecent(rootPath) {
        set({ busy: true, problems: [] })
        handleOpen(await services.openProject.reopen(rootPath))
        void get().loadRecents()
      },

      async create(name, rootId) {
        set({ busy: true, problems: [] })
        const result = await services.createProject.execute(name, rootId)
        if (result.status === 'created') opened(result.session, [])
        else set({ busy: false, problems: result.status === 'failed' ? result.problems : [] })
      },

      async save(options) {
        const { session } = get()
        if (session === null) return
        set({ busy: true, problems: [], conflicts: [] })
        const result = await services.saveProject.execute(session, options)
        const complete = result.conflicts.length === 0 && result.problems.length === 0
        set({
          busy: false,
          // Da sessão, só os hashes mudam: uma edição feita durante a gravação é mantida.
          session: { ...get().session!, hashes: result.session.hashes },
          conflicts: result.conflicts,
          problems: result.problems,
          ...(complete ? { saved: editorStateOf(session), lastSavedAt: new Date() } : {})
        })
      },

      async reload() {
        const { session } = get()
        if (session === null) return
        set({ busy: true, problems: [], conflicts: [] })
        handleOpen(await services.openProject.reopen(session.folder.rootPath))
      },

      dismissConflicts() {
        set({ conflicts: [] })
      },

      close() {
        set({ ...CLOSED })
        void get().loadRecents()
      },

      run(command) {
        const { session, history } = get()
        if (session === null) return false
        const step = executeCommand(history, editorStateOf(session), command)
        if (!step.ok) {
          set({ notice: step.error })
          return false
        }
        applyStep(step.value)
        return true
      },

      undo() {
        const step = undo(get().history)
        if (step !== undefined) applyStep(step)
      },

      redo() {
        const step = redo(get().history)
        if (step !== undefined) applyStep(step)
      },

      selectFeature(featureId) {
        set({ selectedFeatureId: featureId })
      },

      dismissNotice() {
        set({ notice: null })
      }
    }
  })

  store.subscribe((state) => services.unsavedChanges.set(hasUnsavedChanges(state)))
  return store
}

/**
 * Depois de uma edição: seleciona a feature que o comando indicou, mantém a seleção se ela
 * ainda existe, ou volta para a raiz (por exemplo, depois de excluir a feature selecionada).
 */
function nextSelection(
  current: string | null,
  model: FeatureModel,
  focusFeatureId: string | undefined
): string {
  if (focusFeatureId !== undefined) return focusFeatureId
  if (current !== null && findFeature(model.root, current) !== undefined) return current
  return model.root.id
}
