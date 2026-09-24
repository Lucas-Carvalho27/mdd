import type { Feature, FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import type { Asset, AssetCatalog } from './asset-catalog'

/** Os assets de uma âncora, na ordem do catálogo (a ordem no produto gerado). */
export interface AnchorGroup {
  readonly feature: Feature
  readonly assets: readonly Asset[]
}

/** Um grupo por âncora, na pré-ordem do modelo; só as features que têm assets. */
export function groupAssetsByAnchor(model: FeatureModel, catalog: AssetCatalog): AnchorGroup[] {
  return featuresInPreOrder(model.root)
    .map((feature) => ({ feature, assets: assetsAnchoredAt(catalog, feature.id) }))
    .filter((group) => group.assets.length > 0)
}

export function assetsAnchoredAt(catalog: AssetCatalog, featureId: string): Asset[] {
  return catalog.assets.filter((asset) => asset.anchor === featureId)
}
