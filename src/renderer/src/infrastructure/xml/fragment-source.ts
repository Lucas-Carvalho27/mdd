import { DOMParser, type Document, type ParseError } from '@xmldom/xmldom'
import { err, ok, type Result } from '@/domain/shared/result'
import type { DecodeProblem } from './xml-reader'

/*
 * Como um fragmento entra no product.xml (SPEC §4.4): só o elemento raiz, com o texto
 * exatamente como está no arquivo. Saem o BOM, a declaração XML, o DOCTYPE e os comentários
 * e instruções de fora da raiz. Só é chamada depois que o xmllint confirmou que o arquivo é
 * XML bem-formado: o @xmldom/xmldom aceita alguns erros de sintaxe, mas pega o que o xmllint
 * deixa passar num arquivo com DOCTYPE (entidades) e prefixos de namespace sem declaração.
 */

const BOM = '\u{FEFF}'
const ENTITY_NOT_FOUND = /^entity not found:(&[^;\s]+;)/
/** As quebras de linha que o @xmldom/xmldom conta: "\r\n", "\r" sozinho e "\n". */
const LINE_BREAK = /\r\n?|\n/g

/** O texto do elemento raiz, pronto para entrar num `<fragment>`, ou os problemas encontrados. */
export function extractFragmentRoot(content: string): Result<string, DecodeProblem[]> {
  const text = withoutBom(content)
  const parsed = parse(text)
  if (!parsed.ok) return parsed
  const root = parsed.value.documentElement
  if (root === null || root.lineNumber === undefined || root.columnNumber === undefined) {
    return err([{ message: 'O fragmento não tem elemento raiz.' }])
  }

  // O fim da raiz é onde começa o nó seguinte (espaço, comentário ou instrução): assim um
  // CDATA ou comentário com algo parecido com a tag de fechamento não confunde a conta.
  const start = offsetOf(text, root.lineNumber, root.columnNumber)
  const next = root.nextSibling
  const end =
    next?.lineNumber !== undefined && next.columnNumber !== undefined
      ? offsetOf(text, next.lineNumber, next.columnNumber)
      : text.length
  const rootText = text.slice(start, end).trimEnd()
  const openTag = `<${root.tagName}`
  if (!rootText.startsWith(openTag)) {
    return err([{ line: root.lineNumber, message: 'Não foi possível localizar o elemento raiz.' }])
  }

  // Sem namespace padrão declarado, os elementos sem prefixo herdariam o `urn:mdd:product`
  // do produto: `xmlns=""` os mantém sem namespace, como no arquivo.
  if (root.hasAttribute('xmlns')) return ok(rootText)
  return ok(`${openTag} xmlns=""${rootText.slice(openTag.length)}`)
}

function withoutBom(content: string): string {
  return content.startsWith(BOM) ? content.slice(BOM.length) : content
}

function parse(text: string): Result<Document, DecodeProblem[]> {
  const problems: DecodeProblem[] = []
  try {
    const document = new DOMParser({
      locator: true,
      // As posições valem no texto como está, com "\r\n" ou "\r" sozinho.
      normalizeLineEndings: (source) => source,
      onError: (level, message, context) => {
        // Os erros fatais interrompem a leitura e chegam pelo catch.
        if (level !== 'error') return
        const line: number | undefined = context?.locator?.lineNumber
        // Numa entidade, a posição é a do começo do texto: a linha certa é a da entidade.
        const entity = ENTITY_NOT_FOUND.exec(message)
        problems.push({
          line: entity === null ? line : lineOfNext(text, entity[1], line),
          message: describe(message)
        })
      }
    }).parseFromString(text, 'text/xml')
    return problems.length > 0 ? err(problems) : ok(document)
  } catch (error) {
    const { message, locator } = error as ParseError
    return err([...problems, { line: locator?.lineNumber, message: describe(message) }])
  }
}

/** Posição no texto a partir de linha e coluna, as duas começando em 1. */
function offsetOf(text: string, line: number, column: number): number {
  const breaks = new RegExp(LINE_BREAK)
  let lineStart = 0
  for (let current = 1; current < line; current++) {
    const found = breaks.exec(text)
    if (found === null) break
    lineStart = found.index + found[0].length
  }
  return lineStart + column - 1
}

/** A linha da primeira vez que o trecho aparece, a partir do começo da linha indicada. */
function lineOfNext(
  text: string,
  needle: string,
  fromLine: number | undefined
): number | undefined {
  if (fromLine === undefined) return undefined
  const found = text.indexOf(needle, offsetOf(text, fromLine, 1))
  if (found < 0) return fromLine
  return (text.slice(0, found).match(LINE_BREAK)?.length ?? 0) + 1
}

function describe(message: string): string {
  const entity = ENTITY_NOT_FOUND.exec(message)
  if (entity !== null) {
    return `A entidade ${entity[1]} não é suportada: use o próprio caractere ou uma referência numérica, como &#160;.`
  }
  if (message.includes('NamespaceError')) {
    return 'Há um prefixo de namespace sem declaração (xmlns:…).'
  }
  return message.split('\n')[0]
}
