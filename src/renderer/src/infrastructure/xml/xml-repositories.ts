import { fileError, type FileProblem } from '@/application/file-problem'
import type { ProjectStorage } from '@/application/ports/project-storage'
import type {
  AssetCatalogRepository,
  ConfigurationRepository,
  ExpectedHash,
  FeatureModelRepository,
  LoadedFile,
  RemoveResult,
  SaveResult
} from '@/application/ports/repositories'
import type { XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import type { AssetCatalog } from '@/domain/assets/asset-catalog'
import type { Configuration } from '@/domain/configuration/configuration'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeAssetCatalog, encodeAssetCatalog } from './assets-codec'
import { decodeConfiguration, encodeConfiguration } from './configuration-codec'
import { decodeFeatureModel, encodeFeatureModel } from './feature-model-codec'
import { XmlDocumentFile, type XmlDocumentFormat } from './xml-document-file'

const MODEL_PATH = 'model.xml'
const ASSETS_PATH = 'assets.xml'
const CONFIGURATIONS_DIRECTORY = 'configurations'

const featureModelFormat: XmlDocumentFormat<FeatureModel> = {
  schema: 'feature-model',
  decode: decodeFeatureModel,
  encode: encodeFeatureModel
}

const assetCatalogFormat: XmlDocumentFormat<AssetCatalog> = {
  schema: 'assets',
  decode: decodeAssetCatalog,
  encode: encodeAssetCatalog
}

const configurationFormat: XmlDocumentFormat<Configuration> = {
  schema: 'configuration',
  decode: decodeConfiguration,
  encode: encodeConfiguration
}

export class XmlFeatureModelRepository implements FeatureModelRepository {
  private readonly file: XmlDocumentFile<FeatureModel>

  constructor(storage: ProjectStorage, validator: XmlSchemaValidator) {
    this.file = new XmlDocumentFile(storage, validator, MODEL_PATH, featureModelFormat)
  }

  async load(): Promise<Result<LoadedFile<FeatureModel>, FileProblem[]>> {
    const loaded = await this.file.load()
    if (!loaded.ok) return loaded
    if (loaded.value === null) {
      return err([fileError(MODEL_PATH, 'A pasta não tem model.xml, então não é um projeto mdd.')])
    }
    return ok(loaded.value)
  }

  save(model: FeatureModel, expectedHash: ExpectedHash): Promise<SaveResult> {
    return this.file.save(model, expectedHash)
  }
}

export class XmlAssetCatalogRepository implements AssetCatalogRepository {
  private readonly file: XmlDocumentFile<AssetCatalog>

  constructor(storage: ProjectStorage, validator: XmlSchemaValidator) {
    this.file = new XmlDocumentFile(storage, validator, ASSETS_PATH, assetCatalogFormat)
  }

  load(): Promise<Result<LoadedFile<AssetCatalog> | null, FileProblem[]>> {
    return this.file.load()
  }

  save(catalog: AssetCatalog, expectedHash: ExpectedHash): Promise<SaveResult> {
    return this.file.save(catalog, expectedHash)
  }
}

export class XmlConfigurationRepository implements ConfigurationRepository {
  private readonly storage: ProjectStorage
  private readonly validator: XmlSchemaValidator

  constructor(storage: ProjectStorage, validator: XmlSchemaValidator) {
    this.storage = storage
    this.validator = validator
  }

  async listKeys(): Promise<Result<string[], FileProblem[]>> {
    const listed = await this.storage.list(CONFIGURATIONS_DIRECTORY)
    if (!listed.ok) {
      if (listed.error.code === 'not-found') return ok([])
      return err([fileError(CONFIGURATIONS_DIRECTORY, listed.error.message)])
    }
    return ok(
      listed.value
        .filter((entry) => entry.kind === 'file' && entry.name.endsWith('.xml'))
        .map((entry) => entry.name.slice(0, -'.xml'.length))
        .sort((a, b) => a.localeCompare(b))
    )
  }

  async load(key: string): Promise<Result<LoadedFile<Configuration>, FileProblem[]>> {
    const loaded = await this.fileFor(key).load()
    if (!loaded.ok) return loaded
    if (loaded.value === null) return err([fileError(this.pathFor(key), 'O arquivo não existe.')])
    return ok(loaded.value)
  }

  save(key: string, configuration: Configuration, expectedHash: ExpectedHash): Promise<SaveResult> {
    return this.fileFor(key).save(configuration, expectedHash)
  }

  remove(key: string, expectedHash: string | 'any'): Promise<RemoveResult> {
    return this.fileFor(key).remove(expectedHash)
  }

  private fileFor(key: string): XmlDocumentFile<Configuration> {
    return new XmlDocumentFile(this.storage, this.validator, this.pathFor(key), configurationFormat)
  }

  private pathFor(key: string): string {
    return `${CONFIGURATIONS_DIRECTORY}/${key}.xml`
  }
}
