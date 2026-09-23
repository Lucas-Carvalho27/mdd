export type BinaryOperator = 'and' | 'or' | 'implies' | 'iff'

/** Árvore de uma expressão proposicional sobre IDs de features (SPEC §4.1). */
export type Expression =
  | { readonly kind: 'var'; readonly id: string }
  | { readonly kind: 'const'; readonly value: boolean }
  | { readonly kind: 'not'; readonly operand: Expression }
  | {
      readonly kind: 'binary'
      readonly operator: BinaryOperator
      readonly left: Expression
      readonly right: Expression
    }
