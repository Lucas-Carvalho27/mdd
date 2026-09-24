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
 * Como o arquivo deve estar no disco para a gravação seguir: com este hash,
 * `null` quando ele ainda não deve existir, ou `'any'` para sobrescrever sem conferir.
 */
export type ExpectedHash = string | null | 'any'

/** Conflito = o arquivo mudou fora do app; o usuário decide se sobrescreve (SPEC §8). */
export type SaveFailure =
  | { readonly kind: 'conflict'; readonly file: string }
  | { readonly kind: 'error'; readonly problem: FileProblem }

/** Gravação bem-sucedida devolve o novo hash do arquivo. */
export type SaveResult = Result<string, SaveFailure>

export type RemoveResult = Result<null, SaveFailure>

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
  /** Exclui o arquivo se ele ainda estiver com o hash (ou sempre, com `'any'`). */
  remove(key: string, expectedHash: string | 'any'): Promise<RemoveResult>
}
