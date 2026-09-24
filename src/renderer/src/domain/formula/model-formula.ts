import type { Expression } from '../expression/ast'
import type { Feature, FeatureModel, Group } from '../feature-model/feature-model'
import { and, implies, variable, type Formula } from './formula'

/**
 * A semântica do modelo (SPEC §4.1) como uma conjunção:
 * 1. a raiz é verdadeira;
 * 2. cada feature implica o pai;
 * 3. o pai implica cada filha solitária obrigatória;
 * 4. o pai implica a cardinalidade de cada grupo;
 * 5. todas as restrições.
 */
export function modelFormula(model: FeatureModel): Formula {
  const parts: Formula[] = [variable(model.root.id)]

  const visit = (parent: Feature): void => {
    for (const child of parent.children) {
      if (child.kind === 'feature') {
        parts.push(implies(variable(child.feature.id), variable(parent.id)))
        if (child.feature.variability === 'mandatory') {
          parts.push(implies(variable(parent.id), variable(child.feature.id)))
        }
        visit(child.feature)
        continue
      }
      for (const member of child.group.members) {
        parts.push(implies(variable(member.id), variable(parent.id)))
      }
      parts.push(implies(variable(parent.id), groupCardinality(child.group)))
      child.group.members.forEach(visit)
    }
  }

  visit(model.root)
  for (const constraint of model.constraints) parts.push(expressionFormula(constraint.expression))
  return and(parts)
}

/** `[a..b]` sobre os membros; `*`, ou um máximo acima do número de membros, vale como todos. */
function groupCardinality(group: Group): Formula {
  const count = group.members.length
  const max = group.max === '*' || group.max > count ? count : group.max
  return {
    kind: 'cardinality',
    min: group.min,
    max,
    operands: group.members.map((member) => variable(member.id))
  }
}

export function expressionFormula(expression: Expression): Formula {
  switch (expression.kind) {
    case 'var':
      return variable(expression.id)
    case 'const':
      return { kind: 'const', value: expression.value }
    case 'not':
      return { kind: 'not', operand: expressionFormula(expression.operand) }
    case 'binary': {
      const left = expressionFormula(expression.left)
      const right = expressionFormula(expression.right)
      switch (expression.operator) {
        case 'and':
          return { kind: 'and', operands: [left, right] }
        case 'or':
          return { kind: 'or', operands: [left, right] }
        case 'implies':
          return { kind: 'implies', left, right }
        case 'iff':
          return { kind: 'iff', left, right }
      }
    }
  }
}
