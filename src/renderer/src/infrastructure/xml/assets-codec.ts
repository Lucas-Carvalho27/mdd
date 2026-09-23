import type { Element } from '@xmldom/xmldom'
import type { Asset, AssetCatalog, AssetKind } from '@/domain/assets/asset-catalog'
import { printExpression } from '@/domain/expression/printer'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeExpression } from './expression-field'
import {
  childElements,
  firstChild,
  optionalAttribute,
  requiredAttribute,
  type DecodeProblem
} from './xml-reader'
import { element, textElement, writeXmlDocument, type XmlElement } from './xml-writer'

const NAMESPACE = 'urn:mdd:assets'

// Leitura (docs/schemas/assets.xsd)

export function decodeAssetCatalog(root: Element): Result<AssetCatalog, DecodeProblem[]> {
  const problems: DecodeProblem[] = []
  const assets = childElements(root, 'asset').flatMap((asset) => decodeAsset(asset, problems))
  return problems.length > 0 ? err(problems) : ok({ assets })
}

function decodeAsset(node: Element, problems: DecodeProblem[]): Asset[] {
  const id = requiredAttribute(node, 'id')
  const name = optionalAttribute(node, 'name')
  const conditionElement = firstChild(node, 'condition')
  const condition = conditionElement ? decodeExpression(conditionElement, id, problems) : undefined
  if (conditionElement && condition === undefined) return []
  return [
    {
      id,
      kind: requiredAttribute(node, 'kind') as AssetKind,
      path: requiredAttribute(node, 'path'),
      anchor: requiredAttribute(node, 'anchor'),
      ...(name !== undefined ? { name } : {}),
      ...(condition !== undefined ? { condition } : {})
    }
  ]
}

// Escrita, na ordem de elementos e atributos do XSD

export function encodeAssetCatalog(catalog: AssetCatalog): string {
  return writeXmlDocument(
    element(
      'assets',
      [
        ['xmlns', NAMESPACE],
        ['schemaVersion', '1']
      ],
      catalog.assets.map(encodeAsset)
    )
  )
}

function encodeAsset(asset: Asset): XmlElement {
  return element(
    'asset',
    [
      ['id', asset.id],
      ['kind', asset.kind],
      ['path', asset.path],
      ['anchor', asset.anchor],
      ['name', asset.name]
    ],
    asset.condition !== undefined
      ? [textElement('condition', printExpression(asset.condition))]
      : []
  )
}
