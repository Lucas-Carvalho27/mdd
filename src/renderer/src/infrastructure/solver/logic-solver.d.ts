/*
 * Tipos do pacote logic-solver 2.0.1, que não publica os seus (ADR 0002).
 * Só a parte da API que o adapter usa.
 */
declare module 'logic-solver' {
  namespace Logic {
    /** Nome de variável, ou o nome com "-" na frente para a negação. */
    type Term = string

    interface Formula {
      readonly type: string
    }

    type FormulaOrTerm = Formula | Term

    /** Um inteiro sem sinal representado por fórmulas (o bit menos significativo primeiro). */
    interface Bits {
      readonly bits: readonly FormulaOrTerm[]
    }

    type Operands = readonly (FormulaOrTerm | readonly FormulaOrTerm[])[]

    interface Solution {
      /** Variáveis verdadeiras, em ordem alfabética, sem as internas (que começam com "$"). */
      getTrueVars(): string[]
    }

    class Solver {
      require(...formulas: Operands): void
      solve(): Solution | null
      /** Resolve com a fórmula como suposição temporária. */
      solveAssuming(formula: FormulaOrTerm): Solution | null
    }

    const TRUE: Term
    const FALSE: Term

    function not(operand: FormulaOrTerm): FormulaOrTerm
    function and(...operands: Operands): FormulaOrTerm
    function or(...operands: Operands): FormulaOrTerm
    function implies(left: FormulaOrTerm, right: FormulaOrTerm): FormulaOrTerm
    function equiv(left: FormulaOrTerm, right: FormulaOrTerm): FormulaOrTerm
    function exactlyOne(...operands: Operands): FormulaOrTerm
    function atMostOne(...operands: Operands): FormulaOrTerm
    function sum(...operands: Operands): Bits
    function constantBits(wholeNumber: number): Bits
    function lessThanOrEqual(left: Bits, right: Bits): FormulaOrTerm
    function greaterThanOrEqual(left: Bits, right: Bits): FormulaOrTerm
  }

  export default Logic
}
