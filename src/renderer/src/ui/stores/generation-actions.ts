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
   * Gera o produto da configuração `key`, do projeto como está na tela. A chave vem de quem
   * chama (o botão, ou o diálogo de substituir), e não da configuração aberta, que pode ter
   * mudado com o diálogo aberto. Devolve o resultado para a tela decidir o que mostrar, ou
   * `null` quando não há o que mostrar (nenhum projeto aberto, outra geração em andamento, ou
   * o projeto foi fechado no meio).
   */
  generateProduct(key: string, options?: GenerateOptions): Promise<GenerateProductResult | null>
  openGeneratedFolder(): Promise<void>
  dismissLastGeneration(): void
}

export const GENERATION_CLOSED = {
  generating: false,
  lastGeneration: null
} satisfies Partial<GenerationState>

/**
 * A última geração, sem ela se for da chave `key`. Renomear ou excluir a configuração apaga a
 * faixa: senão ela voltaria quando outra configuração ganhasse a mesma chave.
 */
export function withoutGenerationOf(
  last: LastGeneration | null,
  key: string
): LastGeneration | null {
  return last?.key === key ? null : last
}

type SetState = StoreApi<ProjectState>['setState']

export function createGenerationActions(
  set: SetState,
  get: () => ProjectState,
  services: GenerationServices
): Omit<GenerationState, keyof typeof GENERATION_CLOSED> {
  return {
    async generateProduct(key, options) {
      const { session, generating } = get()
      if (session === null || generating) return null
      set({ generating: true })
      // Fechar ou reabrir o projeto já zerou o estado da geração.
      const sameProject = (): boolean => get().session?.folder === session.folder
      try {
        const result = await services.generateProduct.execute(session.project, key, options)
        if (!sameProject()) return null
        set({ lastGeneration: lastGenerationAfter(get().lastGeneration, key, result) })
        return result
      } finally {
        // Também quando o caso de uso lança: o botão não fica preso em "Gerando…".
        if (sameProject()) set({ generating: false })
      }
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

/**
 * A faixa depois de uma geração: o sucesso a troca pela chave gerada; uma falha na escrita da
 * mesma chave a apaga, porque a pasta pode não existir mais.
 */
function lastGenerationAfter(
  last: LastGeneration | null,
  key: string,
  result: GenerateProductResult
): LastGeneration | null {
  if (result.kind === 'generated') {
    return { key, folder: result.folder, generatedAt: result.generatedAt }
  }
  return result.kind === 'write-failed' ? withoutGenerationOf(last, key) : last
}
