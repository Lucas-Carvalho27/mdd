import type { StoreApi } from 'zustand/vanilla'
import type { FileProblem } from '@/application/file-problem'
import {
  isModified,
  newFragment,
  type FragmentDocument
} from '@/application/fragments/fragment-document'
import type { FragmentChecker } from '@/application/ports/fragment-checker'
import type { StorageError } from '@/application/ports/project-storage'
import type { SaveFragmentsResult } from '@/application/use-cases/save-fragments'
import type { SaveOptions } from '@/application/use-cases/save-project'
import type { Result } from '@/domain/shared/result'
import type { ProjectState } from './project-store'

/** Os serviços da aba Fragmentos; a composition root entrega as implementações. */
export interface FragmentsServices {
  readonly fragmentFiles: {
    list(): Promise<Result<string[], string>>
    checkNewPath(input: string, existing: readonly string[]): Result<string, string>
  }
  readonly openFragment: {
    execute(path: string): Promise<Result<FragmentDocument, StorageError>>
  }
  readonly saveFragments: {
    execute(
      documents: readonly FragmentDocument[],
      options?: SaveOptions
    ): Promise<SaveFragmentsResult>
  }
  readonly fragmentChecker: FragmentChecker
}

/**
 * Estado e ações da aba Fragmentos (Fase 6). O texto editado entra no "•" e no Ctrl+S do
 * projeto; o desfazer do texto fica com o editor, fora do histórico.
 */
export interface FragmentsState {
  /** Os fragmentos no disco, na última leitura das pastas; `null` antes de a aba ser aberta. */
  readonly fragmentFiles: readonly string[] | null
  /** Os fragmentos abertos, por caminho: os lidos do disco e os novos. */
  readonly fragmentDocuments: ReadonlyMap<string, FragmentDocument>
  /** O fragmento no editor. */
  readonly shownFragmentPath: string | null
  /** A última conferência de cada fragmento aberto. */
  readonly fragmentProblems: ReadonlyMap<string, readonly FileProblem[]>
  /** Os fragmentos salvos com erro de XML, com o primeiro problema, para a faixa de avisos. */
  readonly fragmentWarnings: ReadonlyMap<string, FileProblem>

  /** Lê as pastas do projeto (ao entrar na aba). */
  loadFragmentFiles(): Promise<void>
  /** Mostra o fragmento no editor, lendo-o do disco se ainda não estiver aberto. */
  showFragment(path: string): Promise<void>
  changeFragmentText(path: string, text: string): void
  /** Confere o texto atual. Se outra conferência do mesmo arquivo começou depois, esta é descartada. */
  checkFragment(path: string): Promise<void>
  /** O motivo da recusa do caminho de um fragmento novo, ou `null` quando ele serve. */
  checkNewFragmentPath(input: string): string | null
  /** Cria o fragmento só no editor (vai para o disco no Ctrl+S) e o mostra; ou o motivo da recusa. */
  createFragment(input: string): string | null
  /** Volta ao texto do disco; um fragmento novo sai da lista. */
  discardFragment(path: string): void
  /** Relê as pastas e os fragmentos sem alteração (a janela voltou ao foco, ou "Atualizar"). */
  refreshFragments(): Promise<void>
  /** Grava os fragmentos alterados, como parte do Ctrl+S; devolve os conflitos e os erros. */
  saveFragments(options?: SaveOptions): Promise<Pick<SaveFragmentsResult, 'conflicts' | 'problems'>>
}

export const FRAGMENTS_CLOSED = {
  fragmentFiles: null,
  fragmentDocuments: new Map<string, FragmentDocument>(),
  shownFragmentPath: null,
  fragmentProblems: new Map<string, readonly FileProblem[]>(),
  fragmentWarnings: new Map<string, FileProblem>()
} satisfies Partial<FragmentsState>

/** O fragmento no editor, se houver. */
export function shownFragment(state: ProjectState): FragmentDocument | null {
  const path = state.shownFragmentPath
  return path === null ? null : (state.fragmentDocuments.get(path) ?? null)
}

export function hasModifiedFragments(state: ProjectState): boolean {
  return [...state.fragmentDocuments.values()].some(isModified)
}

/**
 * Os caminhos da árvore: os do disco e os fragmentos novos, que só existem no editor. Um novo
 * que apareceu no disco (criado por fora, com qualquer caixa) não se repete.
 */
export function fragmentTreePaths(
  files: readonly string[] | null,
  documents: ReadonlyMap<string, FragmentDocument>
): string[] {
  const onDisk = files ?? []
  const known = new Set(onDisk.map((path) => path.toLowerCase()))
  const created = [...documents.values()]
    .filter((document) => document.saved === null && !known.has(document.path.toLowerCase()))
    .map((document) => document.path)
  return [...onDisk, ...created]
}

type SetState = StoreApi<ProjectState>['setState']

export function createFragmentsActions(
  set: SetState,
  get: () => ProjectState,
  services: FragmentsServices
): Omit<FragmentsState, keyof typeof FRAGMENTS_CLOSED> {
  // Cada leitura das pastas e cada conferência recebem um número; só a última é usada.
  let lastListing = 0
  const lastCheck = new Map<string, number>()
  /** O texto da última conferência de cada fragmento, para não conferir o mesmo texto de novo. */
  const checkedText = new Map<string, string>()

  const setDocument = (document: FragmentDocument): void => {
    const documents = new Map(get().fragmentDocuments)
    documents.set(document.path, document)
    set({ fragmentDocuments: documents })
  }

  const removeDocument = (path: string): void => {
    const { fragmentDocuments, fragmentProblems, shownFragmentPath } = get()
    const documents = new Map(fragmentDocuments)
    documents.delete(path)
    const problems = new Map(fragmentProblems)
    problems.delete(path)
    set({
      fragmentDocuments: documents,
      fragmentProblems: problems,
      shownFragmentPath: shownFragmentPath === path ? null : shownFragmentPath
    })
  }

  /** Lê as pastas; `null` se a leitura falhou (o motivo vai para a faixa) ou ficou velha. */
  const listFiles = async (): Promise<readonly string[] | null> => {
    const session = get().session
    if (session === null) return null
    const listing = ++lastListing
    const listed = await services.fragmentFiles.list()
    if (listing !== lastListing || get().session?.folder !== session.folder) return null
    if (!listed.ok) {
      set({ notice: `Não foi possível ler as pastas do projeto: ${listed.error}` })
      return null
    }
    set({ fragmentFiles: listed.value })
    return listed.value
  }

  /** Os caminhos que um fragmento novo não pode repetir. */
  const existingPaths = (): string[] => [
    ...(get().fragmentFiles ?? []),
    ...get().fragmentDocuments.keys()
  ]

  return {
    async loadFragmentFiles() {
      await listFiles()
    },

    async showFragment(path) {
      const session = get().session
      if (session === null) return
      if (!get().fragmentDocuments.has(path)) {
        const opened = await services.openFragment.execute(path)
        if (get().session?.folder !== session.folder) return
        if (!opened.ok) {
          set({ notice: `Não foi possível abrir "${path}": ${opened.error.message}` })
          // O arquivo sumiu depois da última leitura das pastas.
          if (opened.error.code === 'not-found') void listFiles()
          return
        }
        // Se outro clique já o abriu enquanto este lia, fica o que já estava.
        if (!get().fragmentDocuments.has(path)) setDocument(opened.value)
      }
      set({ shownFragmentPath: path })
      await get().checkFragment(path)
    },

    changeFragmentText(path, text) {
      const document = get().fragmentDocuments.get(path)
      if (document === undefined || document.readOnly !== undefined || document.text === text) {
        return
      }
      setDocument({ ...document, text })
    },

    async checkFragment(path) {
      const session = get().session
      const document = get().fragmentDocuments.get(path)
      if (session === null || document === undefined) return
      if (get().fragmentProblems.has(path) && checkedText.get(path) === document.text) return
      const check = (lastCheck.get(path) ?? 0) + 1
      lastCheck.set(path, check)
      const problems = await services.fragmentChecker.check(path, document.text)
      if (lastCheck.get(path) !== check || get().session?.folder !== session.folder) return
      if (!get().fragmentDocuments.has(path)) return
      const all = new Map(get().fragmentProblems)
      all.set(path, problems)
      checkedText.set(path, document.text)
      set({ fragmentProblems: all })
    },

    checkNewFragmentPath(input) {
      const checked = services.fragmentFiles.checkNewPath(input, existingPaths())
      return checked.ok ? null : checked.error
    },

    createFragment(input) {
      const checked = services.fragmentFiles.checkNewPath(input, existingPaths())
      if (!checked.ok) return checked.error
      setDocument(newFragment(checked.value))
      void get().showFragment(checked.value)
      return null
    },

    discardFragment(path) {
      const document = get().fragmentDocuments.get(path)
      if (document === undefined) return
      if (document.saved === null) removeDocument(path)
      else setDocument({ ...document, text: document.saved.text })
    },

    async refreshFragments() {
      const { session, fragmentFiles } = get()
      // Só depois de a aba ter sido aberta com este projeto.
      if (session === null || fragmentFiles === null) return
      if ((await listFiles()) === null) return
      for (const document of get().fragmentDocuments.values()) {
        if (document.saved === null) continue
        const reread = await services.openFragment.execute(document.path)
        if (get().session?.folder !== session.folder) return
        const current = get().fragmentDocuments.get(document.path)
        if (current === undefined) continue
        if (!reread.ok) {
          if (reread.error.code !== 'not-found') continue
          // Apagado fora do app: sem alteração, sai da lista; com alteração, vira novo.
          if (isModified(current)) setDocument({ ...current, saved: null })
          else removeDocument(current.path)
          continue
        }
        // Mudou fora do app: sem alteração no app, o editor passa a mostrar o texto novo. Com
        // alteração, fica como está, e o conflito aparece ao salvar.
        if (!isModified(current) && reread.value.saved?.hash !== current.saved?.hash) {
          setDocument(reread.value)
        }
      }
      const shown = get().shownFragmentPath
      if (shown !== null) await get().checkFragment(shown)
    },

    async saveFragments(options) {
      const session = get().session
      const documents = [...get().fragmentDocuments.values()].filter(isModified)
      if (session === null || documents.length === 0) return { conflicts: [], problems: [] }
      const result = await services.saveFragments.execute(documents, options)
      if (get().session?.folder !== session.folder) return { conflicts: [], problems: [] }

      const saved = new Map(get().fragmentDocuments)
      const problems = new Map(get().fragmentProblems)
      const warnings = new Map(get().fragmentWarnings)
      for (const [path, written] of result.saved) {
        const current = saved.get(path)
        if (current === undefined) continue
        // Uma edição feita durante a gravação é mantida: o fragmento continua alterado.
        saved.set(path, { ...current, saved: written })
        const found = result.checked.get(path) ?? []
        if (current.text === written.text) {
          problems.set(path, found)
          checkedText.set(path, written.text)
        }
        if (found.length === 0) warnings.delete(path)
        else {
          warnings.set(path, {
            ...found[0],
            severity: 'warning',
            message: `Salvo com erro de XML: ${found[0].message}`
          })
        }
      }
      set({ fragmentDocuments: saved, fragmentProblems: problems, fragmentWarnings: warnings })
      return { conflicts: result.conflicts, problems: result.problems }
    }
  }
}
