import type { GenerationPlan } from '@/domain/generation/generation-plan'
import type { FileProblem } from '../file-problem'

/** A página da visualização e o que há de errado nela. */
export interface PagePreview {
  /** O `index.html`, como a geração o gravaria, mesmo com problemas (no melhor esforço). */
  readonly page: string
  readonly problems: readonly FileProblem[]
  /** O projeto não tem `moldura.html`: a página usa a moldura padrão. */
  readonly defaultFrame: boolean
}

/**
 * Monta a página de um plano para a visualização (Fase 8). Os fragmentos com texto em
 * `edited` (os abertos no editor com alteração, por caminho) entram com esse texto, e não com
 * o do disco. Com problemas, a página sai assim mesmo: um marcador que não resolve fica como
 * está escrito, e um arquivo que falta fica como falta.
 */
export interface PagePreviewer {
  preview(plan: GenerationPlan, edited: ReadonlyMap<string, string>): Promise<PagePreview>
}
