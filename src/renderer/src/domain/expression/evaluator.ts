import type { Expression } from './ast'

/**
 * O valor da expressão com as features do conjunto verdadeiras e as demais falsas.
 * Usado nas condições de presença dos assets (SPEC §4.3).
 */
export function evaluateExpression(expression: Expression, trueIds: ReadonlySet<string>): boolean {
  switch (expression.kind) {
    case 'var':
      return trueIds.has(expression.id)
    case 'const':
      return expression.value
    case 'not':
      return !evaluateExpression(expression.operand, trueIds)
    case 'binary': {
      const left = evaluateExpression(expression.left, trueIds)
      const right = evaluateExpression(expression.right, trueIds)
      switch (expression.operator) {
        case 'and':
          return left && right
        case 'or':
          return left || right
        case 'implies':
          return !left || right
        case 'iff':
          return left === right
      }
    }
  }
}
