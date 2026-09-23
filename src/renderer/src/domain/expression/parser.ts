import { err, ok, type Result } from '../shared/result'
import type { BinaryOperator, Expression } from './ast'
import type { ExpressionSyntaxError } from './syntax-error'
import { tokenize, type Token, type TokenKind } from './tokenizer'

/**
 * Converte o texto de uma expressão em árvore (gramática em docs/SPEC.md §4.1).
 * Precedência, da mais forte para a mais fraca: not, and, or, implies, iff.
 * `implies` associa à direita; os demais operadores binários, à esquerda.
 */
export function parseExpression(source: string): Result<Expression, ExpressionSyntaxError> {
  const tokens = tokenize(source)
  if (!tokens.ok) return tokens
  if (tokens.value.length === 1) return err({ message: 'A expressão está vazia.', column: 1 })

  try {
    return ok(new ExpressionParser(tokens.value).parse())
  } catch (failure) {
    if (failure instanceof ParseFailure) return err(failure.syntaxError)
    throw failure
  }
}

class ParseFailure {
  readonly syntaxError: ExpressionSyntaxError

  constructor(syntaxError: ExpressionSyntaxError) {
    this.syntaxError = syntaxError
  }
}

class ExpressionParser {
  private readonly tokens: readonly Token[]
  private position = 0

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens
  }

  parse(): Expression {
    const expression = this.parseIff()
    const next = this.peek()
    if (next.kind !== 'end') this.fail(`Faltou um operador antes de "${next.text}".`, next)
    return expression
  }

  private parseIff(): Expression {
    let left = this.parseImplies()
    while (this.match('iff')) left = binary('iff', left, this.parseImplies())
    return left
  }

  private parseImplies(): Expression {
    const left = this.parseOr()
    return this.match('implies') ? binary('implies', left, this.parseImplies()) : left
  }

  private parseOr(): Expression {
    let left = this.parseAnd()
    while (this.match('or')) left = binary('or', left, this.parseAnd())
    return left
  }

  private parseAnd(): Expression {
    let left = this.parseUnary()
    while (this.match('and')) left = binary('and', left, this.parseUnary())
    return left
  }

  private parseUnary(): Expression {
    if (this.match('not')) return { kind: 'not', operand: this.parseUnary() }
    return this.parsePrimary()
  }

  private parsePrimary(): Expression {
    const token = this.peek()
    switch (token.kind) {
      case 'identifier':
        this.position++
        return { kind: 'var', id: token.text }
      case 'true':
      case 'false':
        this.position++
        return { kind: 'const', value: token.kind === 'true' }
      case '(': {
        this.position++
        const inner = this.parseIff()
        if (!this.match(')')) this.fail('Falta fechar o parêntese.', this.peek())
        return inner
      }
      case 'end':
        return this.fail('A expressão terminou antes da hora: falta um operando.', token)
      default:
        return this.fail(
          `Esperava uma feature, "not" ou "(", mas encontrou "${token.text}".`,
          token
        )
    }
  }

  private peek(): Token {
    return this.tokens[this.position]
  }

  private match(kind: TokenKind): boolean {
    if (this.peek().kind !== kind) return false
    this.position++
    return true
  }

  private fail(message: string, token: Token): never {
    throw new ParseFailure({ message, column: token.column })
  }
}

function binary(operator: BinaryOperator, left: Expression, right: Expression): Expression {
  return { kind: 'binary', operator, left, right }
}
