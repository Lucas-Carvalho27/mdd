import type { Expression } from './ast'

/** IDs de features citados na expressão. */
export function referencedFeatureIds(expression: Expression): Set<string> {
  const ids = new Set<string>()
  collect(expression, ids)
  return ids
}

function collect(expression: Expression, ids: Set<string>): void {
  switch (expression.kind) {
    case 'var':
      ids.add(expression.id)
      return
    case 'const':
      return
    case 'not':
      collect(expression.operand, ids)
      return
    case 'binary':
      collect(expression.left, ids)
      collect(expression.right, ids)
      return
  }
}
