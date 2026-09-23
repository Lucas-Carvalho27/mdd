import type { AssetCatalog } from '../assets/asset-catalog'
import { referencedFeatureIds } from '../expression/references'
import { notFound } from '../feature-model/feature-edits'
import type { FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import { detachFeature, findFeature, locateFeature } from '../feature-model/tree'
import { err, ok, type Result } from '../shared/result'

/** Resultado de excluir uma feature com a subárvore, e tudo o que foi junto (SPEC §4.5). */
export interface FeatureDeletion {
  readonly model: FeatureModel
  readonly assets: AssetCatalog
  readonly removedFeatureIds: readonly string[]
  /** Restrições que citavam alguma feature excluída: são removidas inteiras. */
  readonly removedConstraintIds: readonly string[]
  /** Assets ancorados numa feature excluída ou com condição que a cita (os arquivos ficam). */
  readonly unlinkedAssetIds: readonly string[]
  readonly groupChange?: string
}

export function deleteFeature(
  model: FeatureModel,
  assets: AssetCatalog,
  featureId: string
): Result<FeatureDeletion, string> {
  const location = locateFeature(model.root, featureId)
  if (location === undefined) return err(notFound(featureId))
  if (location.kind === 'root') return err('A raiz não pode ser excluída.')

  const removed = new Set(featuresInPreOrder(findFeature(model.root, featureId)!).map((f) => f.id))
  const touchesRemoved = (ids: Set<string>): boolean => [...ids].some((id) => removed.has(id))

  const { root, groupChange } = detachFeature(model.root, location)
  const removedConstraints = model.constraints.filter((constraint) =>
    touchesRemoved(referencedFeatureIds(constraint.expression))
  )
  const unlinkedAssets = assets.assets.filter(
    (asset) =>
      removed.has(asset.anchor) ||
      (asset.condition !== undefined && touchesRemoved(referencedFeatureIds(asset.condition)))
  )

  return ok({
    model: {
      ...model,
      root,
      constraints: model.constraints.filter(
        (constraint) => !removedConstraints.includes(constraint)
      )
    },
    assets: { assets: assets.assets.filter((asset) => !unlinkedAssets.includes(asset)) },
    removedFeatureIds: [...removed],
    removedConstraintIds: removedConstraints.map((constraint) => constraint.id),
    unlinkedAssetIds: unlinkedAssets.map((asset) => asset.id),
    ...(groupChange !== undefined ? { groupChange } : {})
  })
}
