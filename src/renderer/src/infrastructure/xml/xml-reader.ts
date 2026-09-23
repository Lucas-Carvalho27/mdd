import { DOMParser, type Element } from '@xmldom/xmldom'

/*
 * Leitura com @xmldom/xmldom (funciona igual no navegador e no Node) e com número de linha
 * em cada elemento, usado para apontar erros das regras do domínio.
 * Só é chamada depois que o documento passou pelo XSD, então a estrutura é confiável.
 */

const ELEMENT_NODE = 1

export interface DecodeProblem {
  readonly line?: number
  readonly subject?: string
  readonly message: string
}

export function parseXmlRoot(content: string): Element {
  const failures: string[] = []
  const document = new DOMParser({
    locator: true,
    onError: (level, message) => {
      if (level !== 'warning') failures.push(message)
    }
  }).parseFromString(content, 'text/xml')
  const root = document.documentElement
  if (failures.length > 0 || root === null) {
    throw new Error(`XML inválido depois da validação: ${failures.join('; ')}`)
  }
  return root
}

export function childElements(parent: Element, localName?: string): Element[] {
  const elements: Element[] = []
  for (let index = 0; index < parent.childNodes.length; index++) {
    const node = parent.childNodes[index]
    if (node.nodeType !== ELEMENT_NODE) continue
    const child = node as Element
    if (localName === undefined || child.localName === localName) elements.push(child)
  }
  return elements
}

export function firstChild(parent: Element, localName: string): Element | undefined {
  return childElements(parent, localName)[0]
}

export function requiredAttribute(element: Element, name: string): string {
  return element.getAttribute(name) ?? ''
}

export function optionalAttribute(element: Element, name: string): string | undefined {
  return element.hasAttribute(name) ? (element.getAttribute(name) ?? undefined) : undefined
}

export function textOf(element: Element): string {
  return element.textContent ?? ''
}

export function lineOf(element: Element): number | undefined {
  return element.lineNumber
}
