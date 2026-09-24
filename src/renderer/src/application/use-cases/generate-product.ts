import type { Configuration } from '@/domain/configuration/configuration'
import type { Resolution } from '@/domain/configuration/resolution'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { planGeneration } from '@/domain/generation/generation-plan'
import type { Project } from '@/domain/project/project'
import { fileError, type FileProblem } from '../file-problem'
import type { Clock } from '../ports/clock'
import type { ProductDeriver } from '../ports/product-deriver'
import type { WriteProductFolder } from './write-product-folder'

export type GenerateProductResult =
  | { readonly kind: 'generated'; readonly folder: string; readonly generatedAt: Date }
  /** As fontes têm problemas: nada foi gravado. */
  | { readonly kind: 'problems'; readonly problems: readonly FileProblem[] }
  /** A pasta do produto já existe: gerar de novo com `replace` depois de o usuário confirmar. */
  | { readonly kind: 'needs-confirmation'; readonly folder: string }
  /** A gravação ou a troca falhou; `previousAt` diz onde ficou a versão anterior, se saiu do lugar. */
  | {
      readonly kind: 'write-failed'
      readonly problems: readonly FileProblem[]
      readonly previousAt?: string
    }

export interface GenerateOptions {
  /** Substitui a pasta do produto que já existe ("Substituir"). */
  readonly replace: boolean
}

export interface GenerateProductDependencies {
  readonly resolveConfiguration: {
    execute(model: FeatureModel, configuration: Configuration): Resolution
  }
  readonly deriver: ProductDeriver
  readonly writer: WriteProductFolder
  readonly clock: Clock
}

/**
 * Gera o produto de uma configuração (SPEC §4.4) a partir do projeto como está na tela, com
 * as alterações não salvas: planeja, deriva (conferindo as fontes), pergunta antes de
 * substituir e grava com a troca. A derivação vem antes da pergunta, para o usuário nunca
 * confirmar uma substituição que depois falharia.
 */
export class GenerateProduct {
  private readonly deps: GenerateProductDependencies

  constructor(deps: GenerateProductDependencies) {
    this.deps = deps
  }

  async execute(
    project: Project,
    key: string,
    options: GenerateOptions = { replace: false }
  ): Promise<GenerateProductResult> {
    const file = `configurations/${key}.xml`
    const entry = project.configurations.find((candidate) => candidate.key === key)
    if (entry === undefined) {
      return { kind: 'problems', problems: [fileError(file, 'A configuração não existe mais.')] }
    }
    const { model, assets } = project
    const resolution = this.deps.resolveConfiguration.execute(model, entry.configuration)
    const plan = planGeneration(model, assets, entry.configuration, resolution)
    if (!plan.ok) return { kind: 'problems', problems: [fileError(file, plan.error)] }

    const generatedAt = this.deps.clock.now()
    const derived = await this.deps.deriver.derive(plan.value, generatedAt)
    if (!derived.ok) return { kind: 'problems', problems: derived.error }

    const folder = this.deps.writer.folderOf(key)
    if (!options.replace && (await this.deps.writer.exists(key))) {
      return { kind: 'needs-confirmation', folder }
    }
    const written = await this.deps.writer.write(key, derived.value)
    if (written.kind === 'failed') {
      return { kind: 'write-failed', problems: written.problems, previousAt: written.previousAt }
    }
    return { kind: 'generated', folder, generatedAt }
  }
}
