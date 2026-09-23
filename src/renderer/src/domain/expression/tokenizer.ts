import { err, ok, type Result } from '../shared/result'
import type { ExpressionSyntaxError } from './syntax-error'
import { matchesIdentifierFormat, RESERVED_WORDS } from './identifier'

export type TokenKind =
  'identifier' | 'not' | 'and' | 'or' | 'implies' | 'iff' | 'true' | 'false' | '(' | ')' | 'end'

export interface Token {
  readonly kind: TokenKind
  readonly text: string
  /** Coluna (a partir de 1) do primeiro caractere do token. */
  readonly column: number
}

const WORD_CHARACTER = /[A-Za-z0-9_]/
const WHITESPACE = /\s/

export function tokenize(source: string): Result<Token[], ExpressionSyntaxError> {
  const tokens: Token[] = []
  let index = 0

  while (index < source.length) {
    const character = source[index]
    const column = index + 1

    if (WHITESPACE.test(character)) {
      index++
    } else if (character === '(' || character === ')') {
      tokens.push({ kind: character, text: character, column })
      index++
    } else if (WORD_CHARACTER.test(character)) {
      let end = index
      while (end < source.length && WORD_CHARACTER.test(source[end])) end++
      const word = source.slice(index, end)
      if (RESERVED_WORDS.has(word)) {
        tokens.push({ kind: word as TokenKind, text: word, column })
      } else if (matchesIdentifierFormat(word)) {
        tokens.push({ kind: 'identifier', text: word, column })
      } else {
        return err({
          message: `"${word}" não é um ID válido: use letras minúsculas, dígitos e _, começando por letra.`,
          column
        })
      }
      index = end
    } else {
      return err({ message: `Caractere inesperado "${character}".`, column })
    }
  }

  tokens.push({ kind: 'end', text: '', column: source.length + 1 })
  return ok(tokens)
}
