/*
 * Fórmula proposicional sobre IDs de features, com um nó de cardinalidade (SPEC §4.1).
 * O domínio só constrói a fórmula; resolvê-la é trabalho do solver (ADR 0002).
 */

export type Formula =
  | { readonly kind: 'var'; readonly id: string }
  | { readonly kind: 'const'; readonly value: boolean }
  | { readonly kind: 'not'; readonly operand: Formula }
  | { readonly kind: 'and'; readonly operands: readonly Formula[] }
  | { readonly kind: 'or'; readonly operands: readonly Formula[] }
  | { readonly kind: 'implies'; readonly left: Formula; readonly right: Formula }
  | { readonly kind: 'iff'; readonly left: Formula; readonly right: Formula }
  | {
      readonly kind: 'cardinality'
      /** Quantos operandos verdadeiros, no mínimo e no máximo (inclusive). */
      readonly min: number
      readonly max: number
      readonly operands: readonly Formula[]
    }

export function variable(id: string): Formula {
  return { kind: 'var', id }
}

/** A feature com o valor indicado: `id` quando verdadeira, `not id` quando falsa. */
export function literal(id: string, value: boolean): Formula {
  return value ? variable(id) : { kind: 'not', operand: variable(id) }
}

export function and(operands: readonly Formula[]): Formula {
  return { kind: 'and', operands }
}

export function implies(left: Formula, right: Formula): Formula {
  return { kind: 'implies', left, right }
}
