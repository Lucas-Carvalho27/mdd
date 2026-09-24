import Logic from 'logic-solver'
import type {
  ConstraintSolver,
  Literal,
  LoadedFormula,
  Solution
} from '@/application/ports/constraint-solver'
import type { Formula } from '@/domain/formula/formula'

/**
 * `ConstraintSolver` sobre o logic-solver (MiniSat compilado para JavaScript, ADR 0002).
 * Cada `load` cria um solver novo: o MiniSat reserva 64 MB por instância, que o coletor de
 * lixo devolve quando a resolução termina.
 */
export class LogicSolverConstraintSolver implements ConstraintSolver {
  load(formula: Formula): LoadedFormula {
    const solver = new Logic.Solver()
    solver.require(toLogic(formula))
    return {
      solve: (assuming?: Literal): Solution | null => {
        const solution =
          assuming === undefined
            ? solver.solve()
            : solver.solveAssuming(assuming.value ? assuming.id : Logic.not(assuming.id))
        return solution === null ? null : new Set(solution.getTrueVars())
      }
    }
  }
}

function toLogic(formula: Formula): Logic.FormulaOrTerm {
  switch (formula.kind) {
    case 'var':
      return formula.id
    case 'const':
      return formula.value ? Logic.TRUE : Logic.FALSE
    case 'not':
      return Logic.not(toLogic(formula.operand))
    case 'and':
      return Logic.and(formula.operands.map(toLogic))
    case 'or':
      return Logic.or(formula.operands.map(toLogic))
    case 'implies':
      return Logic.implies(toLogic(formula.left), toLogic(formula.right))
    case 'iff':
      return Logic.equiv(toLogic(formula.left), toLogic(formula.right))
    case 'cardinality':
      return cardinality(formula.min, formula.max, formula.operands.map(toLogic))
  }
}

/** Entre `min` e `max` termos verdadeiros; os casos comuns (or, alternative) sem somador. */
function cardinality(
  min: number,
  max: number,
  terms: readonly Logic.FormulaOrTerm[]
): Logic.FormulaOrTerm {
  const count = terms.length
  if (min <= 0 && max >= count) return Logic.TRUE
  if (min === 1 && max >= count) return Logic.or(terms)
  if (max === 1) return min === 1 ? Logic.exactlyOne(terms) : Logic.atMostOne(terms)
  const sum = Logic.sum(terms)
  return Logic.and(
    min > 0 ? [Logic.greaterThanOrEqual(sum, Logic.constantBits(min))] : [],
    max < count ? [Logic.lessThanOrEqual(sum, Logic.constantBits(max))] : []
  )
}
