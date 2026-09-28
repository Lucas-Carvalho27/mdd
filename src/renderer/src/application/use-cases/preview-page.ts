import type { Configuration } from '@/domain/configuration/configuration'
import type { Resolution } from '@/domain/configuration/resolution'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { planGeneration } from '@/domain/generation/generation-plan'
import { projectHasPage } from '@/domain/pages/page-assembly'
import type { Project } from '@/domain/project/project'
import type { FileProblem } from '../file-problem'
import type { PagePreviewHost } from '../ports/page-preview-host'
import type { PagePreviewer } from '../ports/page-previewer'

export type PreviewPageResult =
  | { readonly kind: 'no-configuration' }
  /** O projeto não tem fragmento HTML: não há página. */
  | { readonly kind: 'no-page' }
  /** A configuração não está completa (ou está em conflito, ou o modelo é vazio). */
  | { readonly kind: 'blocked' }
  | {
      readonly kind: 'page'
      /** Onde a página ficou disponível. */
      readonly address: string
      readonly problems: readonly FileProblem[]
      readonly defaultFrame: boolean
    }

export interface PreviewPageDependencies {
  readonly resolveConfiguration: {
    execute(model: FeatureModel, configuration: Configuration): Resolution
  }
  readonly previewer: PagePreviewer
  readonly host: PagePreviewHost
}

/**
 * A página da configuração aberta, do projeto como está na tela (Fase 8): com as decisões e
 * os valores não salvos e com o texto dos fragmentos abertos no editor (`edited`). Entrega a
 * página a quem a mostra; não grava nada em `saida/`.
 */
export class PreviewPage {
  private readonly deps: PreviewPageDependencies

  constructor(deps: PreviewPageDependencies) {
    this.deps = deps
  }

  async execute(
    project: Project,
    key: string | null,
    edited: ReadonlyMap<string, string>
  ): Promise<PreviewPageResult> {
    const entry = project.configurations.find((candidate) => candidate.key === key)
    if (entry === undefined) return { kind: 'no-configuration' }
    if (!projectHasPage(project.assets)) return { kind: 'no-page' }
    const { model, assets } = project
    const resolution = this.deps.resolveConfiguration.execute(model, entry.configuration)
    const plan = planGeneration(model, assets, entry.configuration, resolution)
    if (!plan.ok) return { kind: 'blocked' }

    const preview = await this.deps.previewer.preview(plan.value, edited)
    await this.deps.host.show(preview.page)
    return {
      kind: 'page',
      address: this.deps.host.address,
      problems: preview.problems,
      defaultFrame: preview.defaultFrame
    }
  }
}
