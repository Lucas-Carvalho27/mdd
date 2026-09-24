import { evaluateExpression } from '../expression/evaluator'
import type { Asset } from './asset-catalog'

/**
 * O asset entra no produto quando a âncora está selecionada e a condição, se houver, é
 * verdadeira para as features selecionadas (SPEC §4.3).
 */
export function isAssetIncluded(asset: Asset, selected: ReadonlySet<string>): boolean {
  if (!selected.has(asset.anchor)) return false
  return asset.condition === undefined || evaluateExpression(asset.condition, selected)
}
