import type { GenerationPlan } from '@/domain/generation/generation-plan'
import type { Result } from '@/domain/shared/result'
import type { FileProblem } from '../file-problem'

/** Um arquivo do produto gerado, com o caminho relativo à pasta do produto. */
export type ProductFile =
  | { readonly kind: 'text'; readonly path: string; readonly content: string }
  /** Cópia byte a byte do arquivo do projeto com este caminho, para o mesmo caminho no produto. */
  | { readonly kind: 'copy'; readonly path: string }

/**
 * Monta o produto de um plano (SPEC §4.4, passos 2 e 3): confere todas as fontes e devolve os
 * arquivos do produto, ou todos os problemas encontrados de uma vez. Não grava nada: a pasta
 * temporária e a troca ficam com o `WriteProductFolder`, igual para qualquer formato.
 */
export interface ProductDeriver {
  derive(
    plan: GenerationPlan,
    generatedAt: Date
  ): Promise<Result<readonly ProductFile[], FileProblem[]>>
}
