import type { Formula } from '@/domain/formula/formula'

/** Uma variável com um valor: "a feature `id` está (ou não) no produto". */
export interface Literal {
  readonly id: string
  readonly value: boolean
}

/** Uma solução: os IDs das variáveis verdadeiras. As demais são falsas. */
export type Solution = ReadonlySet<string>

/** Uma fórmula já carregada no solver, pronta para várias perguntas. */
export interface LoadedFormula {
  /** Uma solução da fórmula (com a suposição, se houver), ou `null` quando não existe. */
  solve(assuming?: Literal): Solution | null
}

/** Satisfatibilidade de fórmulas proposicionais (SPEC §6.2, ADR 0002). */
export interface ConstraintSolver {
  load(formula: Formula): LoadedFormula
}
