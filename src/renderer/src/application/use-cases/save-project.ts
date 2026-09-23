import type { FileProblem } from '../file-problem'
import type {
  AssetCatalogRepository,
  ConfigurationRepository,
  FeatureModelRepository
} from '../ports/repositories'
import type { ProjectSession } from '../project-session'

export interface SaveProjectResult {
  /** Sessão com os hashes atualizados dos arquivos que foram gravados. */
  readonly session: ProjectSession
  /** Arquivos que não puderam ser gravados (por exemplo, alterados fora do app). */
  readonly problems: FileProblem[]
}

export interface SaveProjectDependencies {
  readonly models: FeatureModelRepository
  readonly assets: AssetCatalogRepository
  readonly configurations: ConfigurationRepository
}

/**
 * Grava todos os arquivos do projeto. Cada arquivo só é gravado se ainda estiver
 * como na última leitura; os demais seguem sendo gravados e o problema é informado.
 */
export class SaveProject {
  private readonly deps: SaveProjectDependencies

  constructor(deps: SaveProjectDependencies) {
    this.deps = deps
  }

  async execute(session: ProjectSession): Promise<SaveProjectResult> {
    const { project, hashes } = session
    const problems: FileProblem[] = []

    const model = await this.deps.models.save(project.model, hashes.model)
    if (!model.ok) problems.push(...model.error)

    let assetsHash = hashes.assets
    if (hashes.assets !== null || project.assets.assets.length > 0) {
      const assets = await this.deps.assets.save(project.assets, hashes.assets)
      if (assets.ok) assetsHash = assets.value
      else problems.push(...assets.error)
    }

    const configurationHashes: Record<string, string> = { ...hashes.configurations }
    for (const { key, configuration } of project.configurations) {
      const saved = await this.deps.configurations.save(
        key,
        configuration,
        hashes.configurations[key] ?? null
      )
      if (saved.ok) configurationHashes[key] = saved.value
      else problems.push(...saved.error)
    }

    return {
      problems,
      session: {
        ...session,
        hashes: {
          model: model.ok ? model.value : hashes.model,
          assets: assetsHash,
          configurations: configurationHashes
        }
      }
    }
  }
}
