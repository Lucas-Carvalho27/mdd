import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
import { useProjectStore } from '@/ui/stores/project-store-context'

export function StartScreen(): React.JSX.Element {
  const busy = useProjectStore((state) => state.busy)
  const problems = useProjectStore((state) => state.problems)
  const open = useProjectStore((state) => state.open)

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-10">
      <header>
        <h1 className="text-3xl font-semibold">mdd</h1>
        <p className="text-muted-foreground">
          Linhas de produto: Feature Models, configurações e documentação.
        </p>
      </header>
      <Button className="self-start" disabled={busy} onClick={() => void open()}>
        {busy ? 'Abrindo…' : 'Abrir projeto'}
      </Button>
      <ProblemList title="O projeto não pôde ser aberto" tone="error" problems={problems} />
    </main>
  )
}
