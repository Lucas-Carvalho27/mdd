import { referencedFeatureIds } from '../expression/references'
import { featuresInPreOrder } from '../feature-model/traversal'
import type { FeatureModel } from '../feature-model/feature-model'
import { error, type ValidationIssue } from '../shared/validation-issue'
import type { AssetCatalog } from './asset-catalog'

/** Confere as invariantes A1–A3 dos assets contra o modelo (SPEC §4.3). */
export function validateAssetCatalog(
  catalog: AssetCatalog,
  model: FeatureModel
): ValidationIssue[] {
  const featureIds = new Set(featuresInPreOrder(model.root).map((feature) => feature.id))
  const assetIds = new Set<string>()
  const issues: ValidationIssue[] = []

  for (const asset of catalog.assets) {
    if (assetIds.has(asset.id)) issues.push(error(`ID de asset "${asset.id}" repetido.`, asset.id))
    assetIds.add(asset.id)

    if (!isInsideProject(asset.path)) {
      issues.push(
        error(`O caminho "${asset.path}" precisa ser relativo e ficar dentro do projeto.`, asset.id)
      )
    }
    if (!featureIds.has(asset.anchor)) {
      issues.push(error(`A âncora "${asset.anchor}" não existe no modelo.`, asset.id))
    }
    if (asset.condition !== undefined) {
      for (const id of referencedFeatureIds(asset.condition)) {
        if (!featureIds.has(id)) {
          issues.push(error(`A condição cita a feature "${id}", que não existe.`, asset.id))
        }
      }
    }
  }
  return issues
}

/** Caminho relativo com "/" que não escapa da pasta do projeto (A1). */
export function isInsideProject(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\') || /^[A-Za-z]:/.test(path)) {
    return false
  }
  let depth = 0
  for (const segment of path.split('/')) {
    if (segment === '..') depth--
    else if (segment !== '.' && segment !== '') depth++
    if (depth < 0) return false
  }
  return true
}
