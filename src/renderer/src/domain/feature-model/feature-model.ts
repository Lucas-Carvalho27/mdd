import type { Expression } from '../expression/ast'

/*
 * O Feature Model é um valor imutável: toda edição (Fase 2) cria um modelo novo.
 * Isso deixa desfazer/refazer simples e evita que a interface veja um modelo pela metade.
 */

export type Variability = 'mandatory' | 'optional'

export type AttributeType = 'string' | 'number' | 'boolean' | 'enum'

export interface Attribute {
  readonly id: string
  readonly name: string
  readonly type: AttributeType
  /** Valor em texto, como aparece no XML; validado conforme o tipo. */
  readonly defaultValue?: string
  readonly min?: number
  readonly max?: number
  /** `false` = valor fixo definido no modelo; `true` = cada configuração escolhe. */
  readonly configurable: boolean
  /** Valores permitidos de um atributo `enum`; vazio nos demais tipos. */
  readonly options: readonly string[]
}

export interface Feature {
  readonly id: string
  readonly name: string
  readonly description?: string
  /** Presente só em features solitárias; ausente na raiz e em membros de grupo. */
  readonly variability?: Variability
  readonly attributes: readonly Attribute[]
  readonly children: readonly FeatureChild[]
}

/** `'*'` = sem limite superior. */
export type GroupMax = number | '*'

export interface Group {
  readonly min: number
  readonly max: GroupMax
  readonly members: readonly Feature[]
}

export type FeatureChild =
  | { readonly kind: 'feature'; readonly feature: Feature }
  | { readonly kind: 'group'; readonly group: Group }

export interface Constraint {
  readonly id: string
  readonly description?: string
  readonly expression: Expression
}

export interface FeatureModel {
  readonly name: string
  readonly root: Feature
  readonly constraints: readonly Constraint[]
}
