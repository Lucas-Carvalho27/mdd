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
import type { Configuration } from '@/domain/configuration/configuration'
import {
  nextDecisionState,
  withAttributeValue,
  withDecision,
  withoutAttributeValue
} from '@/domain/configuration/configuration-edits'
import { withoutOrphanReferences } from '@/domain/configuration/references'
import type { Resolution } from '@/domain/configuration/resolution'
import type { Feature, FeatureModel } from '@/domain/feature-model/feature-model'
import { findFeature, locateFeature } from '@/domain/feature-model/tree'
import * as entries from '@/domain/project/configuration-entries'
import type { ConfigurationEntry, Project } from '@/domain/project/project'
import type { Result } from '@/domain/shared/result'
import {
  ASSETS_CLOSED,
  createAssetsActions,
  type AssetsServices,
  type AssetsState
} from './assets-actions'
import {
  createFragmentsActions,
  FRAGMENTS_CLOSED,
  hasModifiedFragments,
  type FragmentsServices,
  type FragmentsState
} from './fragments-actions'
import {
  createGenerationActions,
  GENERATION_CLOSED,
  withoutGenerationOf,
  type GenerationServices,
  type GenerationState
} from './generation-actions'

/** Casos de uso e serviços de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices
  extends AssetsServices, GenerationServices, FragmentsServices {
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
  readonly resolveConfiguration: {
    execute(model: FeatureModel, configuration: Configuration): Resolution
  }
  readonly recentProjects: { list(): Promise<RecentProject[]> }
  readonly unsavedChanges: UnsavedChangesIndicator
}

export interface ProjectState extends AssetsState, GenerationState, FragmentsState {
  readonly session: ProjectSession | null
  /** O projeto como está no disco; comparar com a sessão diz se há alterações. */
  readonly saved: Project | null
  readonly history: EditHistory
  readonly selectedFeatureId: string | null
  /** Subárvores recolhidas no diagrama; valem só enquanto o projeto está aberto (ADR 0007). */
  readonly collapsedFeatureIds: ReadonlySet<string>
  /** Chave da configuração aberta no configurador. */
  readonly openConfigurationKey: string | null
  readonly busy: boolean
  /** Erros da última abertura ou gravação. */
  readonly problems: readonly FileProblem[]
  /** Avisos do projeto aberto; não impedem nada. */
  readonly warnings: readonly FileProblem[]
  /** Arquivos alterados fora do app na última gravação: a interface pergunta o que fazer. */
  readonly conflicts: readonly string[]
  /** O aviso da faixa amarela, como "Edição recusada: …" ou "Arquivo recusado: …". */
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

  // Configurador (SPEC §7). Não entra no histórico de desfazer (SPEC §2).
  openConfiguration(key: string | null): void
  /** Cria e abre a configuração; devolve o motivo se o nome não serve. */
  createConfiguration(name: string): string | null
  renameConfiguration(key: string, name: string): string | null
  duplicateConfiguration(key: string, name: string): string | null
  /** Tira da lista; o arquivo é excluído ao salvar. */
  deleteConfiguration(key: string): void
  /** O clique no nó: indecisa → selecionada → desselecionada → indecisa. */
  toggleDecision(featureId: string): void
  removeDecision(featureId: string): void
  /** Texto vazio tira o valor; devolve o motivo se o valor não serve para o tipo. */
  setAttributeValue(featureId: string, attributeId: string, value: string): string | null
  removeAttributeValue(featureId: string, attributeId: string): void
  removeOrphanReferences(): void
  /** A resolução da configuração aberta; a mesma enquanto modelo e configuração não mudam. */
  openResolution(): Resolution | null
}

export type ProjectStore = StoreApi<ProjectState>

export function editorStateOf(session: ProjectSession): EditorState {
  return { model: session.project.model, assets: session.project.assets }
}

export function hasUnsavedChanges(state: ProjectState): boolean {
  if (state.session === null || state.saved === null) return false
  const { model, assets, configurations } = state.session.project
  return (
    model !== state.saved.model ||
    assets !== state.saved.assets ||
    configurations !== state.saved.configurations ||
    hasModifiedFragments(state)
  )
}

/** A configuração aberta no configurador, se houver. */
export function openConfigurationEntry(state: ProjectState): ConfigurationEntry | null {
  const key = state.openConfigurationKey
  if (state.session === null || key === null) return null
  return state.session.project.configurations.find((entry) => entry.key === key) ?? null
}

const NO_FEATURES: ReadonlySet<string> = new Set()

const CLOSED = {
  session: null,
  saved: null,
  history: EMPTY_HISTORY,
  selectedFeatureId: null,
  collapsedFeatureIds: NO_FEATURES,
  openConfigurationKey: null,
  problems: [],
  warnings: [],
  conflicts: [],
  notice: null,
  lastSavedAt: null,
  ...ASSETS_CLOSED,
  ...GENERATION_CLOSED,
  ...FRAGMENTS_CLOSED
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
        saved: session.project,
        selectedFeatureId: session.project.model.root.id
      })
      void get().loadRecents()
      void get().checkAssetFiles()
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
      // Vincular, trocar arquivo, desfazer…: o estado dos arquivos acompanha os assets.
      if (project.assets !== session.project.assets) void get().checkAssetFiles()
    }

    const setConfigurations = (
      configurations: readonly ConfigurationEntry[],
      openKey = get().openConfigurationKey
    ): void => {
      const { session } = get()
      if (session === null) return
      set({
        session: { ...session, project: { ...session.project, configurations } },
        openConfigurationKey: openKey
      })
    }

    /** Aplica uma mudança da lista e abre a configuração que ela indicar. */
    const changeList = (change: Result<entries.EntryChange, string>): string | null => {
      if (!change.ok) return change.error
      setConfigurations(change.value.entries, change.value.key)
      return null
    }

    /** Troca o conteúdo da configuração aberta. */
    const editOpen = (
      edit: (model: FeatureModel, configuration: Configuration) => Configuration
    ): void => {
      const { session } = get()
      const entry = openConfigurationEntry(get())
      if (session === null || entry === null) return
      const configuration = edit(session.project.model, entry.configuration)
      setConfigurations(
        entries.replaceConfiguration(session.project.configurations, entry.key, configuration)
      )
    }

    const resolve = (configuration: Configuration): Resolution | null => {
      const { session } = get()
      if (session === null) return null
      return services.resolveConfiguration.execute(session.project.model, configuration)
    }

    return {
      ...CLOSED,
      busy: false,
      recents: [],
      ...createAssetsActions(set, get, services),
      ...createGenerationActions(set, get, services),
      ...createFragmentsActions(set, get, services),

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
        // Os fragmentos vão depois dos arquivos do projeto, no mesmo Ctrl+S.
        const fragments = await get().saveFragments(options)
        // O projeto foi fechado ou trocado durante a gravação.
        if (get().session?.folder !== session.folder) {
          set({ busy: false })
          return
        }
        const projectSaved = result.conflicts.length === 0 && result.problems.length === 0
        const complete =
          projectSaved && fragments.conflicts.length === 0 && fragments.problems.length === 0
        set({
          busy: false,
          // Da sessão, só os hashes mudam: uma edição feita durante a gravação é mantida.
          session: { ...get().session!, hashes: result.session.hashes },
          conflicts: [...result.conflicts, ...fragments.conflicts],
          problems: [...result.problems, ...fragments.problems],
          ...(projectSaved ? { saved: session.project } : {}),
          ...(complete ? { lastSavedAt: new Date() } : {})
        })
      },

      async reload() {
        const { session, openConfigurationKey, fragmentFiles, shownFragmentPath } = get()
        if (session === null) return
        set({ busy: true, problems: [], conflicts: [] })
        handleOpen(await services.openProject.reopen(session.folder.rootPath))
        // A configuração aberta continua aberta, se ainda existir no disco.
        const reopened = get().session?.project.configurations
        if (reopened?.some((entry) => entry.key === openConfigurationKey)) {
          set({ openConfigurationKey })
        }
        // A aba Fragmentos relê as pastas, e o fragmento exibido volta, relido do disco.
        if (fragmentFiles === null || get().session === null) return
        await get().loadFragmentFiles()
        if (shownFragmentPath !== null && get().fragmentFiles?.includes(shownFragmentPath)) {
          await get().showFragment(shownFragmentPath)
        }
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
          set({ notice: `Edição recusada: ${step.error}` })
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
      },

      openConfiguration(key) {
        set({ openConfigurationKey: key })
      },

      createConfiguration(name) {
        const { session } = get()
        if (session === null) return 'Nenhum projeto aberto.'
        return changeList(entries.addConfiguration(session.project.configurations, name))
      },

      renameConfiguration(key, name) {
        const { session, openConfigurationKey } = get()
        if (session === null) return 'Nenhum projeto aberto.'
        const change = entries.renameConfiguration(session.project.configurations, key, name)
        if (!change.ok) return change.error
        // Renomear troca a chave; a configuração aberta continua aberta.
        const openKey = openConfigurationKey === key ? change.value.key : openConfigurationKey
        setConfigurations(change.value.entries, openKey)
        // A faixa da última geração é da chave antiga.
        if (change.value.key !== key) {
          set({ lastGeneration: withoutGenerationOf(get().lastGeneration, key) })
        }
        return null
      },

      duplicateConfiguration(key, name) {
        const { session } = get()
        if (session === null) return 'Nenhum projeto aberto.'
        return changeList(entries.duplicateConfiguration(session.project.configurations, key, name))
      },

      deleteConfiguration(key) {
        const { session, openConfigurationKey } = get()
        if (session === null) return
        setConfigurations(
          entries.removeConfiguration(session.project.configurations, key),
          openConfigurationKey === key ? null : openConfigurationKey
        )
        set({ lastGeneration: withoutGenerationOf(get().lastGeneration, key) })
      },

      toggleDecision(featureId) {
        const entry = openConfigurationEntry(get())
        if (entry === null) return
        const before = resolve(entry.configuration)
        const status = before?.kind === 'resolved' ? before.features.get(featureId) : undefined
        // Em conflito, ou numa feature decidida pelo modelo, o clique não faz nada.
        if (status === undefined || status.kind === 'propagated') return
        const current = status.kind === 'manual' ? status.state : undefined
        editOpen((model, configuration) => {
          const next = withDecision(model, configuration, featureId, nextDecisionState(current))
          // Um clique nunca deixa a configuração em conflito: nesse caso, a feature fica
          // indecisa, e a resolução mostra o valor que o modelo impõe (com o cadeado).
          return resolve(next)?.kind === 'resolved'
            ? next
            : withDecision(model, configuration, featureId, undefined)
        })
      },

      removeDecision(featureId) {
        editOpen((model, configuration) => withDecision(model, configuration, featureId, undefined))
      },

      setAttributeValue(featureId, attributeId, value) {
        const { session } = get()
        const entry = openConfigurationEntry(get())
        if (session === null || entry === null) return 'Nenhuma configuração aberta.'
        const edited = withAttributeValue(
          session.project.model,
          entry.configuration,
          featureId,
          attributeId,
          value
        )
        if (!edited.ok) return edited.error
        editOpen(() => edited.value)
        return null
      },

      removeAttributeValue(featureId, attributeId) {
        editOpen((_model, configuration) =>
          withoutAttributeValue(configuration, featureId, attributeId)
        )
      },

      removeOrphanReferences() {
        editOpen(withoutOrphanReferences)
      },

      openResolution() {
        const entry = openConfigurationEntry(get())
        return entry === null ? null : resolve(entry.configuration)
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
