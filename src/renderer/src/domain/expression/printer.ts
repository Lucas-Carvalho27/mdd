import type { BinaryOperator, Expression } from './ast'

const BINARY_PRECEDENCE: Record<BinaryOperator, number> = { iff: 1, implies: 2, or: 3, and: 4 }
const NOT_PRECEDENCE = 5
const ATOM_PRECEDENCE = 6

/**
 * Forma canônica da expressão: espaços simples e parênteses só onde necessário.
 * Garante que `parseExpression(printExpression(e))` devolve a mesma árvore.
 */
export function printExpression(expression: Expression): string {
  switch (expression.kind) {
    case 'var':
      return expression.id
    case 'const':
      return String(expression.value)
    case 'not':
      return `not ${printOperand(expression.operand, precedenceOf(expression.operand) < NOT_PRECEDENCE)}`
    case 'binary': {
      const precedence = BINARY_PRECEDENCE[expression.operator]
      const rightAssociative = expression.operator === 'implies'
      const leftPrecedence = precedenceOf(expression.left)
      const rightPrecedence = precedenceOf(expression.right)
      const left = printOperand(
        expression.left,
        leftPrecedence < precedence || (rightAssociative && leftPrecedence === precedence)
      )
      const right = printOperand(
        expression.right,
        rightPrecedence < precedence || (!rightAssociative && rightPrecedence === precedence)
      )
      return `${left} ${expression.operator} ${right}`
    }
  }
}

function printOperand(expression: Expression, parenthesize: boolean): string {
  const text = printExpression(expression)
  return parenthesize ? `(${text})` : text
}

function precedenceOf(expression: Expression): number {
  switch (expression.kind) {
    case 'binary':
      return BINARY_PRECEDENCE[expression.operator]
    case 'not':
      return NOT_PRECEDENCE
    default:
      return ATOM_PRECEDENCE
  }
}
