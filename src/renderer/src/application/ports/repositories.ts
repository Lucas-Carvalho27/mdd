import type { AssetCatalog } from '@/domain/assets/asset-catalog'
import type { Configuration } from '@/domain/configuration/configuration'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import type { Result } from '@/domain/shared/result'
import type { FileProblem } from '../file-problem'

export interface LoadedFile<T> {
  readonly value: T
  readonly hash: string
}

/**
 * Hash que o arquivo deve ter no disco para a gravação seguir,
 * ou `null` quando o arquivo ainda não deve existir.
 */
export type ExpectedHash = string | null

/** Gravação bem-sucedida devolve o novo hash do arquivo. */
export type SaveResult = Result<string, FileProblem[]>

export interface FeatureModelRepository {
  load(): Promise<Result<LoadedFile<FeatureModel>, FileProblem[]>>
  save(model: FeatureModel, expectedHash: ExpectedHash): Promise<SaveResult>
}

export interface AssetCatalogRepository {
  /** `null` quando o projeto ainda não tem assets.xml. */
  load(): Promise<Result<LoadedFile<AssetCatalog> | null, FileProblem[]>>
  save(catalog: AssetCatalog, expectedHash: ExpectedHash): Promise<SaveResult>
}

export interface ConfigurationRepository {
  /** Chaves (nome do arquivo sem .xml) das configurações existentes, em ordem alfabética. */
  listKeys(): Promise<Result<string[], FileProblem[]>>
  load(key: string): Promise<Result<LoadedFile<Configuration>, FileProblem[]>>
  save(key: string, configuration: Configuration, expectedHash: ExpectedHash): Promise<SaveResult>
}
