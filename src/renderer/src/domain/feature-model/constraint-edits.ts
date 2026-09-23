import type { Expression } from '../expression/ast'
import { err, ok } from '../shared/result'
import type { EditResult } from './feature-edits'
import type { Constraint, FeatureModel } from './feature-model'

/*
 * Edições de restrições. A expressão chega já convertida em árvore (a interface usa
 * `parseExpression`); se ela cita features inexistentes, a regra M4 recusa depois.
 */

export interface AddedConstraint {
  readonly model: FeatureModel
  readonly constraintId: string
}

/** Novas restrições recebem IDs c1, c2, c3… */
export function addConstraint(
  model: FeatureModel,
  expression: Expression,
  description: string
): EditResult<AddedConstraint> {
  const taken = new Set(model.constraints.map((constraint) => constraint.id))
  let number = 1
  while (taken.has(`c${number}`)) number++
  const constraintId = `c${number}`
  const constraint = withDescription({ id: constraintId, expression }, description)
  return ok({ model: { ...model, constraints: [...model.constraints, constraint] }, constraintId })
}

export function updateConstraint(
  model: FeatureModel,
  constraintId: string,
  expression: Expression,
  description: string
): EditResult {
  if (!model.constraints.some((constraint) => constraint.id === constraintId)) {
    return err(`A restrição "${constraintId}" não existe.`)
  }
  const constraints = model.constraints.map((constraint) =>
    constraint.id === constraintId
      ? withDescription({ id: constraintId, expression }, description)
      : constraint
  )
  return ok({ ...model, constraints })
}

export function removeConstraint(model: FeatureModel, constraintId: string): EditResult {
  if (!model.constraints.some((constraint) => constraint.id === constraintId)) {
    return err(`A restrição "${constraintId}" não existe.`)
  }
  return ok({
    ...model,
    constraints: model.constraints.filter((constraint) => constraint.id !== constraintId)
  })
}

function withDescription(constraint: Constraint, description: string): Constraint {
  const trimmed = description.trim()
  return trimmed === '' ? constraint : { ...constraint, description: trimmed }
}
