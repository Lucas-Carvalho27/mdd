import { firstPerPath, type Asset, type AssetCatalog } from '../assets/asset-catalog'
import { isAssetIncluded } from '../assets/asset-inclusion'
import { storedValue } from '../configuration/attribute-values'
import type { Configuration } from '../configuration/configuration'
import { configurationStatus, isSelected, type Resolution } from '../configuration/resolution'
import type { Feature, FeatureModel } from '../feature-model/feature-model'
import { childFeatures, featuresInPreOrder } from '../feature-model/traversal'
import { err, ok, type Result } from '../shared/result'

/*
 * Passo 1 da geração (SPEC §4.4): o que vai para o produto, calculado só a partir do modelo,
 * dos assets e da configuração. Nada aqui lê o disco; a hora da geração também fica de fora.
 */

export interface PlannedAttribute {
  readonly id: string
  /** O valor final: o `default` num atributo fixo; num configurável, o da configuração ou o `default`. */
  readonly value: string
}

export interface PlannedFeature {
  readonly id: string
  readonly name: string
  /** Na ordem do modelo. */
  readonly attributes: readonly PlannedAttribute[]
}

/** Uma seção por feature selecionada, aninhada como na árvore. */
export interface PlannedSection {
  readonly featureId: string
  /** Os fragmentos incluídos, na ordem do assets.xml. */
  readonly fragments: readonly Asset[]
  readonly children: readonly PlannedSection[]
}

export interface GenerationPlan {
  /** O nome da configuração. */
  readonly productName: string
  readonly modelName: string
  /** As features selecionadas, em pré-ordem. */
  readonly features: readonly PlannedFeature[]
  readonly root: PlannedSection
  /**
   * Os recursos incluídos, um por caminho (o primeiro asset que o usa), na ordem do
   * assets.xml. Não aparecem no product.xml: só são copiados.
   */
  readonly resources: readonly Asset[]
}

export function planGeneration(
  model: FeatureModel,
  catalog: AssetCatalog,
  configuration: Configuration,
  resolution: Resolution
): Result<GenerationPlan, string> {
  if (resolution.kind !== 'resolved' || !configurationStatus(resolution).complete) {
    return err('A configuração precisa estar completa para gerar o produto.')
  }
  const selected = new Set(
    [...resolution.features].filter(([, status]) => isSelected(status)).map(([id]) => id)
  )
  const included = catalog.assets.filter((asset) => isAssetIncluded(asset, selected))

  const sectionOf = (feature: Feature): PlannedSection => ({
    featureId: feature.id,
    fragments: included.filter((asset) => asset.kind === 'fragment' && asset.anchor === feature.id),
    children: childFeatures(feature)
      .filter((child) => selected.has(child.id))
      .map(sectionOf)
  })

  return ok({
    productName: configuration.name,
    modelName: model.name,
    features: featuresInPreOrder(model.root)
      .filter((feature) => selected.has(feature.id))
      .map((feature) => plannedFeature(feature, configuration)),
    root: sectionOf(model.root),
    resources: firstPerPath(included.filter((asset) => asset.kind === 'resource'))
  })
}

function plannedFeature(feature: Feature, configuration: Configuration): PlannedFeature {
  return {
    id: feature.id,
    name: feature.name,
    attributes: feature.attributes.flatMap((attribute) => {
      const chosen = attribute.configurable
        ? storedValue(configuration, feature.id, attribute.id)
        : undefined
      // Numa configuração completa, todo atributo tem valor; o filtro só protege o tipo.
      const value = chosen ?? attribute.defaultValue
      return value === undefined ? [] : [{ id: attribute.id, value }]
    })
  }
}
