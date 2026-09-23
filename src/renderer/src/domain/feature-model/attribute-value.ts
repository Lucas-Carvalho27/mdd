import type { Attribute } from './feature-model'

const DECIMAL = /^-?\d+(\.\d+)?$/

/**
 * Confere se um valor em texto serve para o atributo (SPEC §4.2).
 * Devolve `null` quando serve, ou a explicação do problema.
 */
export function checkAttributeValue(attribute: Attribute, value: string): string | null {
  switch (attribute.type) {
    case 'string':
      return null
    case 'boolean':
      return value === 'true' || value === 'false' ? null : 'use "true" ou "false"'
    case 'enum':
      return attribute.options.includes(value)
        ? null
        : `use um destes valores: ${attribute.options.join(', ')}`
    case 'number': {
      if (!DECIMAL.test(value)) return `"${value}" não é um número`
      const number = Number(value)
      if (attribute.min !== undefined && number < attribute.min) {
        return `o mínimo é ${attribute.min}`
      }
      if (attribute.max !== undefined && number > attribute.max) {
        return `o máximo é ${attribute.max}`
      }
      return null
    }
  }
}
