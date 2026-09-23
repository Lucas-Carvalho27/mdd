const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/

/** Palavras da linguagem de expressões; não podem ser usadas como ID de feature (ADR 0004). */
export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  'not',
  'and',
  'or',
  'implies',
  'iff',
  'true',
  'false'
])

/** Segue o formato `[a-z][a-z0-9_]*`, sem checar palavras reservadas. */
export function matchesIdentifierFormat(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value)
}

/** ID que pode aparecer numa expressão: formato válido e não reservado. */
export function isValidFeatureId(value: string): boolean {
  return matchesIdentifierFormat(value) && !RESERVED_WORDS.has(value)
}
