import { useEffect, useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { NewProjectDialog } from './NewProjectDialog'

export function StartScreen(): React.JSX.Element {
  const busy = useProjectStore((state) => state.busy)
  const problems = useProjectStore((state) => state.problems)
  const recents = useProjectStore((state) => state.recents)
  const open = useProjectStore((state) => state.open)
  const openRecent = useProjectStore((state) => state.openRecent)
  const loadRecents = useProjectStore((state) => state.loadRecents)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void loadRecents()
  }, [loadRecents])

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-10">
      <header>
        <h1 className="text-3xl font-semibold">mdd</h1>
        <p className="text-muted-foreground">
          Linhas de produto: Feature Models, configurações e documentação.
        </p>
      </header>

      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => setCreating(true)}>
          <Plus /> Novo projeto
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void open()}>
          <FolderOpen /> {busy ? 'Abrindo…' : 'Abrir projeto'}
        </Button>
      </div>

      <ProblemList title="O projeto não pôde ser aberto" tone="error" problems={problems} />

      {recents.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recentes
          </h2>
          <ul className="divide-y rounded-md border">
            {recents.map((recent) => (
              <li key={recent.rootPath}>
                <button
                  className="w-full px-3 py-2 text-left hover:bg-accent disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void openRecent(recent.rootPath)}
                >
                  <span className="font-medium">{recent.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {recent.rootPath}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {creating && <NewProjectDialog onClose={() => setCreating(false)} />}
    </main>
  )
}
