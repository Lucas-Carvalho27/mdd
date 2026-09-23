import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { validateAssetCatalog } from '@/domain/assets/validation'
import { validateFeatureModel } from '@/domain/feature-model/validation'
import type { ConfigurationEntry } from '@/domain/project/project'
import { fileError, fromValidationIssues, type FileProblem } from '../file-problem'
import type { PickedFolder, ProjectFolderPicker } from '../ports/project-folder-picker'
import type { RecentProjects } from '../ports/recent-projects'
import type {
  AssetCatalogRepository,
  ConfigurationRepository,
  FeatureModelRepository
} from '../ports/repositories'
import type { ProjectSession } from '../project-session'

export type OpenProjectResult =
  | { readonly status: 'cancelled' }
  | {
      readonly status: 'opened'
      readonly session: ProjectSession
      readonly warnings: FileProblem[]
    }
  | { readonly status: 'failed'; readonly problems: FileProblem[] }

export interface OpenProjectDependencies {
  readonly picker: ProjectFolderPicker
  readonly recents: RecentProjects
  readonly models: FeatureModelRepository
  readonly assets: AssetCatalogRepository
  readonly configurations: ConfigurationRepository
}

/**
 * Abre uma pasta de projeto: lê e valida todos os arquivos (SPEC §5).
 * Qualquer erro em qualquer arquivo impede a abertura; avisos são devolvidos junto.
 */
export class OpenProject {
  private readonly deps: OpenProjectDependencies

  constructor(deps: OpenProjectDependencies) {
    this.deps = deps
  }

  /** Pergunta a pasta ao usuário. */
  async execute(): Promise<OpenProjectResult> {
    const picked = await this.deps.picker.pick()
    if (!picked.ok) return { status: 'failed', problems: [fileError('.', picked.error.message)] }
    if (picked.value === null) return { status: 'cancelled' }
    return this.load(picked.value)
  }

  /** Reabre uma pasta conhecida: da lista de recentes, ou para "Recarregar" (SPEC §8). */
  async reopen(rootPath: string): Promise<OpenProjectResult> {
    const reopened = await this.deps.recents.reopen(rootPath)
    if (!reopened.ok) {
      return { status: 'failed', problems: [fileError('.', reopened.error.message)] }
    }
    return this.load(reopened.value)
  }

  private async load(folder: PickedFolder): Promise<OpenProjectResult> {
    const model = await this.deps.models.load()
    if (!model.ok) return { status: 'failed', problems: model.error }

    const problems: FileProblem[] = fromValidationIssues(
      'model.xml',
      validateFeatureModel(model.value.value)
    )

    const assets = await this.deps.assets.load()
    if (!assets.ok) problems.push(...assets.error)
    const catalog = assets.ok && assets.value !== null ? assets.value.value : EMPTY_ASSET_CATALOG
    problems.push(
      ...fromValidationIssues('assets.xml', validateAssetCatalog(catalog, model.value.value))
    )

    const configurations: ConfigurationEntry[] = []
    const configurationHashes: Record<string, string> = {}
    const keys = await this.deps.configurations.listKeys()
    if (!keys.ok) problems.push(...keys.error)
    for (const key of keys.ok ? keys.value : []) {
      const loaded = await this.deps.configurations.load(key)
      if (!loaded.ok) {
        problems.push(...loaded.error)
        continue
      }
      configurations.push({ key, configuration: loaded.value.value })
      configurationHashes[key] = loaded.value.hash
    }

    const errors = problems.filter((problem) => problem.severity === 'error')
    if (errors.length > 0) return { status: 'failed', problems: errors }

    return {
      status: 'opened',
      warnings: problems,
      session: {
        folder,
        project: { model: model.value.value, assets: catalog, configurations },
        hashes: {
          model: model.value.hash,
          assets: assets.ok && assets.value !== null ? assets.value.hash : null,
          configurations: configurationHashes
        }
      }
    }
  }
}
