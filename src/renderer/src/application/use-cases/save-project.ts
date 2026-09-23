import type { FileProblem } from '../file-problem'
import type {
  AssetCatalogRepository,
  ConfigurationRepository,
  ExpectedHash,
  FeatureModelRepository,
  SaveResult
} from '../ports/repositories'
import type { ProjectSession } from '../project-session'

export interface SaveProjectResult {
  /** Sessão com os hashes atualizados dos arquivos que foram gravados. */
  readonly session: ProjectSession
  /** Arquivos alterados fora do app, que não foram gravados (SPEC §8). */
  readonly conflicts: string[]
  /** Outros erros de gravação. */
  readonly problems: FileProblem[]
}

export interface SaveProjectDependencies {
  readonly models: FeatureModelRepository
  readonly assets: AssetCatalogRepository
  readonly configurations: ConfigurationRepository
}

export interface SaveOptions {
  /** Grava mesmo que o arquivo tenha mudado fora do app ("Sobrescrever"). */
  readonly overwrite: boolean
}

/**
 * Grava todos os arquivos do projeto. Cada arquivo só é gravado se ainda estiver como na
 * última leitura, a não ser com `overwrite`; os demais seguem sendo gravados.
 */
export class SaveProject {
  private readonly deps: SaveProjectDependencies

  constructor(deps: SaveProjectDependencies) {
    this.deps = deps
  }

  async execute(
    session: ProjectSession,
    options: SaveOptions = { overwrite: false }
  ): Promise<SaveProjectResult> {
    const { project, hashes } = session
    const conflicts: string[] = []
    const problems: FileProblem[] = []
    const expect = (hash: ExpectedHash): ExpectedHash => (options.overwrite ? 'any' : hash)
    const collect = (result: SaveResult): string | undefined => {
      if (result.ok) return result.value
      if (result.error.kind === 'conflict') conflicts.push(result.error.file)
      else problems.push(result.error.problem)
      return undefined
    }

    const modelHash = collect(await this.deps.models.save(project.model, expect(hashes.model)))

    let assetsHash = hashes.assets
    if (hashes.assets !== null || project.assets.assets.length > 0) {
      assetsHash =
        collect(await this.deps.assets.save(project.assets, expect(hashes.assets))) ?? hashes.assets
    }

    const configurationHashes: Record<string, string> = { ...hashes.configurations }
    for (const { key, configuration } of project.configurations) {
      const saved = await this.deps.configurations.save(
        key,
        configuration,
        expect(hashes.configurations[key] ?? null)
      )
      const hash = collect(saved)
      if (hash !== undefined) configurationHashes[key] = hash
    }

    return {
      conflicts,
      problems,
      session: {
        ...session,
        hashes: {
          model: modelHash ?? hashes.model,
          assets: assetsHash,
          configurations: configurationHashes
        }
      }
    }
  }
}
