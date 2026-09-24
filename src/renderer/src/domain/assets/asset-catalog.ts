import type { Expression } from '../expression/ast'

export type AssetKind = 'fragment' | 'resource'

export interface Asset {
  readonly id: string
  readonly kind: AssetKind
  /** Relativo à pasta do projeto, com "/" como separador. */
  readonly path: string
  /** Feature que define onde o asset aparece no produto gerado. */
  readonly anchor: string
  readonly name?: string
  /** Condição de presença opcional; junto com a âncora, define quando o asset entra. */
  readonly condition?: Expression
}

export interface AssetCatalog {
  /** Na ordem do assets.xml, que é a ordem dos assets de uma mesma âncora no produto. */
  readonly assets: readonly Asset[]
}

export const EMPTY_ASSET_CATALOG: AssetCatalog = { assets: [] }

/** O último trecho do caminho: "docs/img/pix-fluxo.svg" → "pix-fluxo.svg". */
export function fileNameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Como o asset aparece na interface: o nome, ou o nome do arquivo quando não tem nome. */
export function assetLabel(asset: Asset): string {
  return asset.name ?? fileNameOf(asset.path)
}
