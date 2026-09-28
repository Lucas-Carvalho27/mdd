import type { FileProblem } from '@/application/file-problem'

interface PageProblemsProps {
  readonly problems: readonly FileProblem[]
  /** Abre o arquivo na aba Fragmentos, com o cursor na linha. */
  readonly onOpen: (file: string, line: number) => void
}

/**
 * Os problemas da página (Fase 8): a página aparece assim mesmo, e a geração os recusa.
 * Clicar num problema abre o arquivo na linha.
 */
export function PageProblems({ problems, onOpen }: PageProblemsProps): React.JSX.Element | null {
  if (problems.length === 0) return null
  return (
    <section className="rounded-md border border-destructive/40">
      <h3 className="border-b px-3 py-1 text-xs font-medium text-destructive">
        {problems.length === 1 ? '1 problema' : `${problems.length} problemas`}: a página aparece
        assim mesmo, mas a geração recusa
      </h3>
      <ul data-page-problems className="max-h-40 overflow-auto py-1 text-sm">
        {problems.map((problem, index) => (
          <li key={index}>
            <button
              type="button"
              className="flex w-full gap-3 px-3 py-0.5 text-left hover:bg-accent"
              onClick={() => onOpen(problem.file, problem.line ?? 1)}
            >
              <span className="shrink-0 font-mono text-xs leading-5 text-destructive">
                {problem.file}
                {problem.line !== undefined && `:${problem.line}`}
              </span>
              <span>{problem.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
