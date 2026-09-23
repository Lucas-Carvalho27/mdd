export interface ExpressionSyntaxError {
  readonly message: string
  /** Coluna (a partir de 1) onde o problema foi encontrado. */
  readonly column: number
}
