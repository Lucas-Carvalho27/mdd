import type { Expression } from '@/domain/expression/ast'
import { parseExpression } from '@/domain/expression/parser'
import { referencedFeatureIds } from '@/domain/expression/references'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { featureIdSet } from '@/domain/feature-model/tree'

/** O texto como expressão: vazio, válido (só com features existentes) ou com o problema. */
export type ExpressionCheck =
  | { readonly kind: 'empty' }
  | { readonly kind: 'valid'; readonly expression: Expression }
  | { readonly kind: 'invalid'; readonly problem: string }

export function checkExpression(model: FeatureModel, text: string): ExpressionCheck {
  if (text.trim() === '') return { kind: 'empty' }
  const parsed = parseExpression(text)
  if (!parsed.ok) {
    return { kind: 'invalid', problem: `Coluna ${parsed.error.column}: ${parsed.error.message}` }
  }
  const ids = featureIdSet(model.root)
  const unknown = [...referencedFeatureIds(parsed.value)].filter((id) => !ids.has(id))
  if (unknown.length > 0) {
    return { kind: 'invalid', problem: `Features inexistentes: ${unknown.join(', ')}` }
  }
  return { kind: 'valid', expression: parsed.value }
}
