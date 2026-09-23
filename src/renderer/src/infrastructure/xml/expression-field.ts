import type { Element } from '@xmldom/xmldom'
import type { Expression } from '@/domain/expression/ast'
import { parseExpression } from '@/domain/expression/parser'
import { lineOf, textOf, type DecodeProblem } from './xml-reader'

/**
 * Lê o texto de um elemento como expressão. Em caso de erro de sintaxe, registra o
 * problema com a linha do elemento e devolve `undefined`.
 */
export function decodeExpression(
  element: Element,
  subject: string,
  problems: DecodeProblem[]
): Expression | undefined {
  const parsed = parseExpression(textOf(element))
  if (parsed.ok) return parsed.value
  problems.push({
    line: lineOf(element),
    subject,
    message: `Expressão inválida (coluna ${parsed.error.column}): ${parsed.error.message}`
  })
  return undefined
}
