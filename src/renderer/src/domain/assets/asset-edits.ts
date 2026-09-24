import type { Expression } from '../expression/ast'
import { isValidFeatureId } from '../expression/identifier'
import type { FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import { generateId } from '../shared/identifier-generator'
import { err, ok, type Result } from '../shared/result'
import { fileNameOf, type Asset, type AssetCatalog, type AssetKind } from './asset-catalog'

/*
 * Edições do mapeamento de assets (SPEC §4.5). Cada operação devolve um catálogo novo ou o
 * motivo da recusa. As invariantes A1–A3 são conferidas depois, pelo histórico de comandos.
 * A ordem do catálogo é a ordem no assets.xml; entre os assets de uma mesma âncora, é também
 * a ordem no produto gerado (SPEC §4.3). Um asset novo, ou que troca de âncora, entra como o
 * último da âncora, na posição que mantém o arquivo agrupado na ordem das âncoras no modelo:
 * assim o arquivo não depende da ordem em que os vínculos foram feitos.
 */

export type AssetEditResult = Result<AssetCatalog, string>

/** O que se escolhe ao vincular um arquivo. */
export interface AssetDraft {
  readonly id: string
  readonly path: string
  readonly kind: AssetKind
  readonly anchor: string
  /** Vazio = sem nome. */
  readonly name: string
}

/** `.xml` vira fragmento; as demais extensões, recurso (SPEC §7). */
export function suggestAssetKind(path: string): AssetKind {
  return path.toLowerCase().endsWith('.xml') ? 'fragment' : 'resource'
}

/** ID a partir do nome do arquivo sem a extensão: "pix-fluxo.svg" → "pix_fluxo". */
export function suggestAssetId(catalog: AssetCatalog, path: string): string {
  const fileName = fileNameOf(path)
  const dot = fileName.lastIndexOf('.')
  const base = dot > 0 ? fileName.slice(0, dot) : fileName
  return generateId(base, assetIds(catalog), 'asset')
}

/**
 * Confere o ID escolhido ao vincular: o mesmo formato do ID de feature e inédito entre os
 * assets. Como o das features, ele não muda depois (ADR 0004). `null` quando serve.
 */
export function checkNewAssetId(catalog: AssetCatalog, id: string): string | null {
  if (!isValidFeatureId(id)) {
    return `O ID "${id}" é inválido: use letras minúsculas, dígitos e _, começando por letra, e evite palavras reservadas.`
  }
  if (assetIds(catalog).has(id)) return `Já existe um asset com o ID "${id}".`
  return null
}

export function linkAsset(
  model: FeatureModel,
  catalog: AssetCatalog,
  draft: AssetDraft
): AssetEditResult {
  const problem = checkNewAssetId(catalog, draft.id)
  if (problem !== null) return err(problem)
  const name = draft.name.trim()
  const asset: Asset = {
    id: draft.id,
    kind: draft.kind,
    path: draft.path,
    anchor: draft.anchor,
    ...(name !== '' ? { name } : {})
  }
  return ok({ assets: insertAsLastOfAnchor(model, catalog.assets, asset) })
}

/** Nome vazio tira o nome: a interface passa a mostrar o nome do arquivo. */
export function renameAsset(catalog: AssetCatalog, assetId: string, name: string): AssetEditResult {
  const trimmed = name.trim()
  return editAsset(catalog, assetId, ({ name: _old, ...asset }) =>
    trimmed !== '' ? { ...asset, name: trimmed } : asset
  )
}

export function setAssetKind(
  catalog: AssetCatalog,
  assetId: string,
  kind: AssetKind
): AssetEditResult {
  return editAsset(catalog, assetId, (asset) => ({ ...asset, kind }))
}

/** Com a âncora nova, o asset passa a ser o último dela. */
export function setAssetAnchor(
  model: FeatureModel,
  catalog: AssetCatalog,
  assetId: string,
  anchor: string
): AssetEditResult {
  const asset = findAsset(catalog, assetId)
  if (asset === undefined) return err(notFound(assetId))
  if (asset.anchor === anchor) return ok(catalog)
  const others = catalog.assets.filter((other) => other.id !== assetId)
  return ok({ assets: insertAsLastOfAnchor(model, others, { ...asset, anchor }) })
}

/** `undefined` tira a condição: o asset entra sempre que a âncora estiver selecionada. */
export function setAssetCondition(
  catalog: AssetCatalog,
  assetId: string,
  condition: Expression | undefined
): AssetEditResult {
  return editAsset(catalog, assetId, ({ condition: _old, ...asset }) =>
    condition !== undefined ? { ...asset, condition } : asset
  )
}

/** Troca o arquivo; ID, nome, tipo, âncora e condição ficam como estão. */
export function relinkAsset(catalog: AssetCatalog, assetId: string, path: string): AssetEditResult {
  return editAsset(catalog, assetId, (asset) => ({ ...asset, path }))
}

/** Troca de lugar com o vizinho da mesma âncora, acima (-1) ou abaixo (1). */
export function reorderAsset(
  catalog: AssetCatalog,
  assetId: string,
  offset: -1 | 1
): AssetEditResult {
  const index = catalog.assets.findIndex((asset) => asset.id === assetId)
  if (index < 0) return err(notFound(assetId))
  const anchor = catalog.assets[index].anchor
  let neighbor = index + offset
  while (neighbor >= 0 && neighbor < catalog.assets.length) {
    if (catalog.assets[neighbor].anchor === anchor) break
    neighbor += offset
  }
  if (neighbor < 0 || neighbor >= catalog.assets.length) {
    return err(
      offset < 0 ? 'O asset já é o primeiro da âncora.' : 'O asset já é o último da âncora.'
    )
  }
  const assets = [...catalog.assets]
  ;[assets[index], assets[neighbor]] = [assets[neighbor], assets[index]]
  return ok({ assets })
}

/** O arquivo continua no disco. */
export function unlinkAsset(catalog: AssetCatalog, assetId: string): AssetEditResult {
  if (findAsset(catalog, assetId) === undefined) return err(notFound(assetId))
  return ok({ assets: catalog.assets.filter((asset) => asset.id !== assetId) })
}

export function findAsset(catalog: AssetCatalog, assetId: string): Asset | undefined {
  return catalog.assets.find((asset) => asset.id === assetId)
}

/**
 * Põe o asset depois do último cuja âncora vem antes da dele, ou é a dele, na pré-ordem do
 * modelo. Uma âncora que não existe vai para o fim (e o histórico recusa o comando, A2).
 */
function insertAsLastOfAnchor(
  model: FeatureModel,
  assets: readonly Asset[],
  asset: Asset
): Asset[] {
  const ranks = new Map(featuresInPreOrder(model.root).map((feature, index) => [feature.id, index]))
  const rank = (anchor: string): number => ranks.get(anchor) ?? Number.MAX_SAFE_INTEGER
  let index = 0
  assets.forEach((other, position) => {
    if (rank(other.anchor) <= rank(asset.anchor)) index = position + 1
  })
  return [...assets.slice(0, index), asset, ...assets.slice(index)]
}

function editAsset(
  catalog: AssetCatalog,
  assetId: string,
  update: (asset: Asset) => Asset
): AssetEditResult {
  if (findAsset(catalog, assetId) === undefined) return err(notFound(assetId))
  return ok({
    assets: catalog.assets.map((asset) => (asset.id === assetId ? update(asset) : asset))
  })
}

function assetIds(catalog: AssetCatalog): Set<string> {
  return new Set(catalog.assets.map((asset) => asset.id))
}

function notFound(assetId: string): string {
  return `O asset "${assetId}" não existe.`
}
