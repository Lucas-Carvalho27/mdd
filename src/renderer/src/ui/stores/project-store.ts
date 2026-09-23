import { createStore, type StoreApi } from 'zustand/vanilla'
import type { FileProblem } from '@/application/file-problem'
import type { ProjectSession } from '@/application/project-session'
import type { OpenProjectResult } from '@/application/use-cases/open-project'
import type { SaveProjectResult } from '@/application/use-cases/save-project'

/** Casos de uso de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices {
  readonly openProject: { execute(): Promise<OpenProjectResult> }
  readonly saveProject: { execute(session: ProjectSession): Promise<SaveProjectResult> }
}

export interface ProjectState {
  readonly session: ProjectSession | null
  readonly busy: boolean
  /** Erros da última abertura ou gravação. */
  readonly problems: readonly FileProblem[]
  /** Avisos do projeto aberto; não impedem nada. */
  readonly warnings: readonly FileProblem[]
  readonly lastSavedAt: Date | null
  open(): Promise<void>
  save(): Promise<void>
  close(): void
}

export type ProjectStore = StoreApi<ProjectState>

/** Estado de tela do projeto aberto. As regras ficam nos casos de uso, não aqui. */
export function createProjectStore(services: ProjectStoreServices): ProjectStore {
  return createStore<ProjectState>()((set, get) => ({
    session: null,
    busy: false,
    problems: [],
    warnings: [],
    lastSavedAt: null,

    async open() {
      set({ busy: true, problems: [] })
      const result = await services.openProject.execute()
      switch (result.status) {
        case 'cancelled':
          set({ busy: false })
          return
        case 'failed':
          set({ busy: false, problems: result.problems })
          return
        case 'opened':
          set({
            busy: false,
            session: result.session,
            warnings: result.warnings,
            lastSavedAt: null
          })
          return
      }
    },

    async save() {
      const { session } = get()
      if (session === null) return
      set({ busy: true, problems: [] })
      const result = await services.saveProject.execute(session)
      set({
        busy: false,
        session: result.session,
        problems: result.problems,
        lastSavedAt: result.problems.length === 0 ? new Date() : get().lastSavedAt
      })
    },

    close() {
      set({ session: null, problems: [], warnings: [], lastSavedAt: null })
    }
  }))
}
