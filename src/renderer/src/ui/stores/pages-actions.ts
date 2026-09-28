import type { StoreApi } from 'zustand/vanilla'
import type { FileProblem } from '@/application/file-problem'
import { isModified } from '@/application/fragments/fragment-document'
import type { PreviewPageResult } from '@/application/use-cases/preview-page'
import type { Project } from '@/domain/project/project'
import type { ProjectState } from './project-store'

/** Os serviços da aba Páginas; a composition root entrega as implementações. */
export interface PagesServices {
  readonly previewPage: {
    execute(
      project: Project,
      key: string | null,
      edited: ReadonlyMap<string, string>
    ): Promise<PreviewPageResult>
  }
}

export type PageWidth = 'mobile' | 'tablet' | 'full'

/** O que a aba Páginas mostra. */
export type PagePreviewState =
  /** Nada montado ainda. */
  | { readonly kind: 'idle' }
  | { readonly kind: 'no-configuration' }
  | { readonly kind: 'no-page' }
  | { readonly kind: 'blocked' }
  | {
      readonly kind: 'page'
      readonly address: string
      /** Muda a cada montagem: o quadro recarrega. */
      readonly version: number
      readonly problems: readonly FileProblem[]
      readonly defaultFrame: boolean
    }

/**
 * Estado e ações da aba Páginas (Fase 8): a página da configuração aberta, montada do projeto
 * como está na tela, a largura e a rolagem guardada entre as montagens.
 */
export interface PagesState {
  readonly pagePreview: PagePreviewState
  readonly pageWidth: PageWidth
  /** A rolagem da página, que a próxima montagem devolve. */
  readonly pageScroll: number

  /**
   * Monta a página de novo. Uma montagem pedida durante outra espera ela acabar: a página
   * entregue ao main é sempre a mais nova.
   */
  refreshPage(): Promise<void>
  setPageWidth(width: PageWidth): void
  setPageScroll(y: number): void
}

export const PAGES_CLOSED = {
  pagePreview: { kind: 'idle' },
  pageWidth: 'full',
  pageScroll: 0
} satisfies Partial<PagesState>

type SetState = StoreApi<ProjectState>['setState']

export function createPagesActions(
  set: SetState,
  get: () => ProjectState,
  services: PagesServices
): Omit<PagesState, keyof typeof PAGES_CLOSED> {
  let running: Promise<void> | null = null
  let again = false
  let version = 0
  /** A configuração da última página: trocar de configuração volta ao topo. */
  let lastKey: string | null = null

  const build = async (): Promise<void> => {
    const { session, openConfigurationKey, fragmentDocuments } = get()
    if (session === null) return
    const edited = new Map(
      [...fragmentDocuments.values()]
        .filter(isModified)
        .map((document) => [document.path, document.text])
    )
    const result = await services.previewPage.execute(session.project, openConfigurationKey, edited)
    // O projeto foi fechado ou trocado enquanto a página era montada.
    if (get().session?.folder !== session.folder) return
    if (openConfigurationKey !== lastKey) {
      lastKey = openConfigurationKey
      set({ pageScroll: 0 })
    }
    set({
      pagePreview: result.kind === 'page' ? { ...result, version: ++version } : result
    })
  }

  return {
    async refreshPage() {
      if (running !== null) {
        again = true
        return running
      }
      running = (async () => {
        do {
          again = false
          await build()
        } while (again)
      })()
      try {
        await running
      } finally {
        running = null
      }
    },

    setPageWidth(width) {
      set({ pageWidth: width })
    },

    setPageScroll(y) {
      set({ pageScroll: y })
    }
  }
}
