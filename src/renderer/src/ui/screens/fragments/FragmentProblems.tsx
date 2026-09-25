import type { FileProblem } from '@/application/file-problem'

interface FragmentProblemsProps {
  /** `undefined` enquanto a primeira conferência não respondeu. */
  readonly problems: readonly FileProblem[] | undefined
  readonly onGoToLine: (line: number) => void
}

/** A conferência do fragmento, a mesma da geração; clicar num problema leva até a linha. */
export function FragmentProblems({
  problems,
  onGoToLine
}: FragmentProblemsProps): React.JSX.Element {
  if (problems === undefined || problems.length === 0) {
    return (
      <p data-fragment-problems className="border-t px-3 py-2 text-xs text-muted-foreground">
        {problems === undefined
          ? 'Conferindo…'
          : 'Nenhum problema: o fragmento pode entrar num produto.'}
      </p>
    )
  }
  return (
    <ul data-fragment-problems className="max-h-40 overflow-auto border-t py-1 text-sm">
      {problems.map((problem, index) => (
        <li key={index}>
          <button
            type="button"
            className="flex w-full gap-3 px-3 py-0.5 text-left hover:bg-accent"
            onClick={() => onGoToLine(problem.line ?? 1)}
          >
            <span className="shrink-0 font-mono text-xs leading-5 text-destructive">
              linha {problem.line ?? '?'}
            </span>
            <span>{problem.message}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
