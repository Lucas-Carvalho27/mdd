import type { IssueSeverity, ValidationIssue } from '@/domain/shared/validation-issue'

/** Problema num arquivo do projeto, pronto para mostrar ao usuário (SPEC §5). */
export interface FileProblem {
  /** Caminho relativo à pasta do projeto, como "model.xml". */
  readonly file: string
  readonly line?: number
  /** ID do elemento envolvido, quando o problema vem das regras do domínio. */
  readonly subject?: string
  readonly severity: IssueSeverity
  readonly message: string
}

export function fileError(file: string, message: string, line?: number): FileProblem {
  return { file, line, severity: 'error', message }
}

export function fromValidationIssues(
  file: string,
  issues: readonly ValidationIssue[]
): FileProblem[] {
  return issues.map((issue) => ({ file, ...issue }))
}
