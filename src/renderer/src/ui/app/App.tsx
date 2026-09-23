import { useState } from 'react'
import type { DirectoryEntry, OpenedProject } from '../../../../shared/ipc'
import { Button } from '@/ui/components/ui/button'

/**
 * Tela provisória da Fase 0: prova que o IPC funciona de ponta a ponta.
 * É substituída pela tela inicial na Fase 1.
 */
export function App(): React.JSX.Element {
  const [project, setProject] = useState<OpenedProject | null>(null)
  const [entries, setEntries] = useState<DirectoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  async function openProject(): Promise<void> {
    setError(null)
    const opened = await window.mdd.openProjectFolder()
    if (!opened.ok) return setError(opened.error.message)
    if (opened.value === null) return
    setProject(opened.value)

    const listed = await window.mdd.list('.')
    if (!listed.ok) return setError(listed.error.message)
    setEntries(listed.value)

    const escape = await window.mdd.readText('../fora.txt')
    if (escape.ok) setError('ERRO: o main deixou ler fora do projeto!')
  }

  return (
    <main className="flex h-screen flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">mdd</h1>
      <Button className="self-start" onClick={openProject}>
        Abrir pasta de projeto
      </Button>
      {error && <p className="text-destructive">{error}</p>}
      {project && (
        <section>
          <h2 className="font-medium">{project.name}</h2>
          <p className="text-sm text-muted-foreground">{project.rootPath}</p>
          <ul className="mt-2 list-disc pl-6 text-sm">
            {entries.map((entry) => (
              <li key={entry.name}>
                {entry.name}
                {entry.kind === 'directory' ? '/' : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
