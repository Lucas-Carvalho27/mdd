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
import type { Feature, FeatureModel } from '@/domain/feature-model/feature-model'
import { findFeature, locateFeature } from '@/domain/feature-model/tree'

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
  /** Subárvores recolhidas no diagrama; valem só enquanto o projeto está aberto (ADR 0007). */
  readonly collapsedFeatureIds: ReadonlySet<string>
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
  /** Simula a edição sem registrar nada: `null` se ela seria aceita, senão o motivo da recusa. */
  check(command: EditorCommand): string | null
  undo(): void
  redo(): void
  selectFeature(featureId: string): void
  /** Recolhe ou expande a subárvore da feature no diagrama. */
  toggleCollapsed(featureId: string): void
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

const NO_FEATURES: ReadonlySet<string> = new Set()

const CLOSED = {
  session: null,
  saved: null,
  history: EMPTY_HISTORY,
  selectedFeatureId: null,
  collapsedFeatureIds: NO_FEATURES,
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
      const { session, selectedFeatureId, collapsedFeatureIds } = get()
      if (session === null) return
      const project = { ...session.project, ...step.state }
      const selected = nextSelection(selectedFeatureId, project.model, step.focusFeatureId)
      set({
        session: { ...session, project },
        history: step.history,
        notice: null,
        selectedFeatureId: selected,
        collapsedFeatureIds: revealed(collapsedFeatureIds, project.model, selected)
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

      check(command) {
        const { session, history } = get()
        if (session === null) return 'Nenhum projeto aberto.'
        const step = executeCommand(history, editorStateOf(session), command)
        return step.ok ? null : step.error
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

      toggleCollapsed(featureId) {
        const { session, selectedFeatureId, collapsedFeatureIds } = get()
        if (session === null) return
        const collapsed = new Set(collapsedFeatureIds)
        if (collapsed.delete(featureId)) {
          set({ collapsedFeatureIds: collapsed })
          return
        }
        collapsed.add(featureId)
        // A seleção não pode sumir dentro da subárvore recolhida: passa para a feature recolhida.
        const root = session.project.model.root
        const hidden =
          selectedFeatureId !== null && ancestorIds(root, selectedFeatureId).includes(featureId)
        set({
          collapsedFeatureIds: collapsed,
          ...(hidden ? { selectedFeatureId: featureId } : {})
        })
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

/** Expande os ancestrais da feature, para ela não ficar escondida numa subárvore recolhida. */
function revealed(
  collapsed: ReadonlySet<string>,
  model: FeatureModel,
  featureId: string
): ReadonlySet<string> {
  const ancestors = ancestorIds(model.root, featureId)
  if (!ancestors.some((id) => collapsed.has(id))) return collapsed
  return new Set([...collapsed].filter((id) => !ancestors.includes(id)))
}

/** IDs do pai, do avô… até a raiz. */
function ancestorIds(root: Feature, featureId: string): string[] {
  const ids: string[] = []
  let location = locateFeature(root, featureId)
  while (location !== undefined && location.kind !== 'root') {
    ids.push(location.parent.id)
    location = locateFeature(root, location.parent.id)
  }
  return ids
}
