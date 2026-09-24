import type { StoreApi } from 'zustand/vanilla'
import type { OutputFolderOpener } from '@/application/ports/output-folder-opener'
import type {
  GenerateOptions,
  GenerateProductResult
} from '@/application/use-cases/generate-product'
import type { Project } from '@/domain/project/project'
import type { ProjectState } from './project-store'

/** Os serviços da geração; a composition root entrega as implementações. */
export interface GenerationServices {
  readonly generateProduct: {
    execute(
      project: Project,
      key: string,
      options?: GenerateOptions
    ): Promise<GenerateProductResult>
  }
  readonly outputFolderOpener: OutputFolderOpener
}

/** A última geração que deu certo, mostrada na faixa verde do configurador. */
export interface LastGeneration {
  /** A chave da configuração gerada: a faixa só aparece com ela aberta. */
  readonly key: string
  /** A pasta do produto, como `saida/loja-basica`. */
  readonly folder: string
  readonly generatedAt: Date
}

/**
 * Estado e ações do botão "Gerar produto" (SPEC §4.4 e §7). Gerar não é uma edição: não
 * passa pelo histórico nem mexe no "•" de não salvo.
 */
export interface GenerationState {
  /** Há uma geração em andamento: o botão fica desligado. */
  readonly generating: boolean
  readonly lastGeneration: LastGeneration | null

  /**
   * Gera o produto da configuração aberta, do projeto como está na tela. Devolve o resultado
   * para a tela decidir o que mostrar, ou `null` quando não há o que mostrar (nenhuma
   * configuração aberta, outra geração em andamento, ou o projeto foi fechado no meio).
   */
  generateProduct(options?: GenerateOptions): Promise<GenerateProductResult | null>
  openGeneratedFolder(): Promise<void>
  dismissLastGeneration(): void
}

export const GENERATION_CLOSED = {
  generating: false,
  lastGeneration: null
} satisfies Partial<GenerationState>

type SetState = StoreApi<ProjectState>['setState']

export function createGenerationActions(
  set: SetState,
  get: () => ProjectState,
  services: GenerationServices
): Omit<GenerationState, keyof typeof GENERATION_CLOSED> {
  return {
    async generateProduct(options) {
      const { session, openConfigurationKey: key, generating } = get()
      if (session === null || key === null || generating) return null
      set({ generating: true })
      const result = await services.generateProduct.execute(session.project, key, options)
      // Fechar ou reabrir o projeto já zerou o estado da geração.
      if (get().session?.folder !== session.folder) return null
      set({
        generating: false,
        ...(result.kind === 'generated'
          ? { lastGeneration: { key, folder: result.folder, generatedAt: result.generatedAt } }
          : {})
      })
      return result
    },

    async openGeneratedFolder() {
      const last = get().lastGeneration
      if (last === null) return
      const opened = await services.outputFolderOpener.open(last.folder)
      if (!opened.ok) {
        set({ notice: `Não foi possível abrir ${last.folder}/: ${opened.error.message}` })
      }
    },

    dismissLastGeneration() {
      set({ lastGeneration: null })
    }
  }
}
