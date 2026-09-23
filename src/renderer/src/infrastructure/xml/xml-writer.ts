/*
 * Escrita determinística de XML (SPEC §5): UTF-8 com declaração, recuo de 2 espaços,
 * atributos na ordem em que são passados e atributos `undefined` omitidos.
 * O mesmo modelo gera sempre os mesmos bytes, o que deixa os diffs do git limpos.
 */

export type XmlAttributes = ReadonlyArray<readonly [name: string, value: string | undefined]>

export interface XmlElement {
  readonly name: string
  readonly attributes: XmlAttributes
  readonly children: readonly XmlElement[]
  /** Quando definido, o elemento tem só este texto e nenhum filho. */
  readonly text?: string
}

export function element(
  name: string,
  attributes: XmlAttributes = [],
  children: readonly XmlElement[] = []
): XmlElement {
  return { name, attributes, children }
}

export function textElement(
  name: string,
  text: string,
  attributes: XmlAttributes = []
): XmlElement {
  return { name, attributes, children: [], text }
}

export function writeXmlDocument(root: XmlElement): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${writeElement(root, 0)}\n`
}

function writeElement(node: XmlElement, depth: number): string {
  const indent = '  '.repeat(depth)
  const attributes = node.attributes
    .filter((attribute): attribute is readonly [string, string] => attribute[1] !== undefined)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('')
  const opening = `${indent}<${node.name}${attributes}`

  if (node.text !== undefined) return `${opening}>${escapeText(node.text)}</${node.name}>`
  if (node.children.length === 0) return `${opening}/>`
  return [
    `${opening}>`,
    ...node.children.map((child) => writeElement(child, depth + 1)),
    `${indent}</${node.name}>`
  ].join('\n')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;')
}
