import type { AssetCatalog } from '../assets/asset-catalog'
import type { Configuration } from '../configuration/configuration'
import type { FeatureModel } from '../feature-model/feature-model'

/** Uma configuração e sua identidade: o nome do arquivo sem `.xml` (SPEC §3). */
export interface ConfigurationEntry {
  readonly key: string
  readonly configuration: Configuration
}

/** Conteúdo de uma pasta de projeto: um modelo, seus assets e suas configurações. */
export interface Project {
  readonly model: FeatureModel
  readonly assets: AssetCatalog
  readonly configurations: readonly ConfigurationEntry[]
}
