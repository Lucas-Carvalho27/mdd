import type { FileProblem } from '@/application/file-problem'

interface ProblemListProps {
  readonly title: string
  readonly tone: 'error' | 'warning'
  readonly problems: readonly FileProblem[]
}

/** Lista de problemas no formato "arquivo:linha [elemento] mensagem" (SPEC §5). */
export function ProblemList({ title, tone, problems }: ProblemListProps): React.JSX.Element | null {
  if (problems.length === 0) return null
  const border = tone === 'error' ? 'border-destructive/50' : 'border-amber-500/50'
  return (
    <section className={`rounded-md border ${border} p-4`}>
      <h2 className="font-medium">{title}</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {problems.map((problem, index) => (
          <li key={index}>
            <span className="font-mono text-muted-foreground">{locationOf(problem)}</span>{' '}
            {problem.message}
          </li>
        ))}
      </ul>
    </section>
  )
}

function locationOf(problem: FileProblem): string {
  const line = problem.line !== undefined ? `:${problem.line}` : ''
  const subject = problem.subject !== undefined ? ` [${problem.subject}]` : ''
  return `${problem.file}${line}${subject}`
}
