export type IssueSeverity = 'error' | 'warning'

/** Violação de uma regra do domínio (SPEC §4). Erros bloqueiam; avisos só informam. */
export interface ValidationIssue {
  readonly severity: IssueSeverity
  /** ID do elemento envolvido (feature, restrição, atributo, asset), quando houver. */
  readonly subject?: string
  readonly message: string
}

export function error(message: string, subject?: string): ValidationIssue {
  return { severity: 'error', subject, message }
}

export function warning(message: string, subject?: string): ValidationIssue {
  return { severity: 'warning', subject, message }
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error')
}
