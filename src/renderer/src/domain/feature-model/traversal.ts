import type { Feature } from './feature-model'

/** Filhos diretos da feature, na ordem do modelo (solitárias e membros de grupo). */
export function childFeatures(feature: Feature): Feature[] {
  return feature.children.flatMap((child) =>
    child.kind === 'feature' ? [child.feature] : child.group.members
  )
}

/** Todas as features em pré-ordem: cada pai antes dos filhos, irmãos na ordem do modelo. */
export function featuresInPreOrder(root: Feature): Feature[] {
  return [root, ...childFeatures(root).flatMap(featuresInPreOrder)]
}
