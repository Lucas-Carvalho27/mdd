import type { DiagramFeature } from './diagram-graph'
import type { Size } from './diagram-layout'

/*
 * O layout precisa do tamanho de cada caixa antes de desenhar. A largura sai do texto
 * medido no canvas com as mesmas fontes da página; FeatureNode usa estas medidas.
 */

export const NODE_HEIGHT = 50
/** Recuo horizontal da caixa (classe `px-3.5` de FeatureNode) mais a borda. */
const HORIZONTAL_CHROME = 2 * 14 + 2
const MIN_WIDTH = 88

interface Fonts {
  readonly name: string
  readonly id: string
}

let context: CanvasRenderingContext2D | null = null
let fonts: Fonts | null = null

export function measureFeature(feature: DiagramFeature): Size {
  context ??= document.createElement('canvas').getContext('2d')!
  fonts ??= {
    // Nome: text-sm font-medium; ID: text-xs font-mono (as classes de FeatureNode).
    name: `500 14px ${getComputedStyle(document.body).fontFamily}`,
    id: `12px ${getComputedStyle(document.documentElement).getPropertyValue('--font-mono')}`
  }
  const nameWidth = textWidth(context, fonts.name, feature.name)
  const idWidth = textWidth(context, fonts.id, feature.id)
  const width = Math.ceil(Math.max(nameWidth, idWidth)) + HORIZONTAL_CHROME
  return { width: Math.max(MIN_WIDTH, width), height: NODE_HEIGHT }
}

function textWidth(context: CanvasRenderingContext2D, font: string, text: string): number {
  context.font = font
  return context.measureText(text).width
}
