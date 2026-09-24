import { useState } from 'react'
import { configurationKey, keyAfterRename } from '@/domain/project/configuration-entries'
import type { ConfigurationEntry } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface ConfigurationDialogsProps {
  readonly dialog: EditorDialog
  readonly configurations: readonly ConfigurationEntry[]
  readonly onClose: () => void
}

/** Criar, renomear, duplicar e excluir configurações (SPEC §7). */
export function ConfigurationDialogs({
  dialog,
  configurations,
  onClose
}: ConfigurationDialogsProps): React.JSX.Element | null {
  const create = useProjectStore((state) => state.createConfiguration)
  const rename = useProjectStore((state) => state.renameConfiguration)
  const duplicate = useProjectStore((state) => state.duplicateConfiguration)
  const keys = new Set(configurations.map((entry) => entry.key))
  const entryOf = (key: string): ConfigurationEntry | undefined =>
    configurations.find((entry) => entry.key === key)
  const others = (key: string): Set<string> => new Set([...keys].filter((other) => other !== key))

  switch (dialog?.kind) {
    case 'new-configuration':
      return (
        <NameDialog
          title="Nova configuração"
          submitLabel="Criar"
          initialName=""
          fileKeyFor={(name) => configurationKey(name, keys)}
          onSubmit={create}
          onClose={onClose}
        />
      )
    case 'rename-configuration': {
      const entry = entryOf(dialog.key)
      if (entry === undefined) return null
      return (
        <NameDialog
          title={`Renomear “${entry.configuration.name}”`}
          submitLabel="Renomear"
          initialName={entry.configuration.name}
          fileKeyFor={(name) => keyAfterRename(entry.key, name, others(entry.key))}
          onSubmit={(name) => rename(entry.key, name)}
          onClose={onClose}
        />
      )
    }
    case 'duplicate-configuration': {
      const entry = entryOf(dialog.key)
      if (entry === undefined) return null
      return (
        <NameDialog
          title={`Duplicar “${entry.configuration.name}”`}
          submitLabel="Duplicar"
          initialName={`${entry.configuration.name} (cópia)`}
          fileKeyFor={(name) => configurationKey(name, keys)}
          onSubmit={(name) => duplicate(entry.key, name)}
          onClose={onClose}
        />
      )
    }
    case 'delete-configuration': {
      const entry = entryOf(dialog.key)
      if (entry === undefined) return null
      return <DeleteDialog entry={entry} onClose={onClose} />
    }
    default:
      return null
  }
}

interface NameDialogProps {
  readonly title: string
  readonly submitLabel: string
  readonly initialName: string
  /** A chave que a configuração vai ter com o nome, para mostrar o nome do arquivo. */
  readonly fileKeyFor: (name: string) => string
  /** Devolve o motivo quando o nome não serve. */
  readonly onSubmit: (name: string) => string | null
  readonly onClose: () => void
}

/** O nome de exibição define o nome do arquivo (SPEC §3), mostrado enquanto se digita. */
function NameDialog({
  title,
  submitLabel,
  initialName,
  fileKeyFor,
  onSubmit,
  onClose
}: NameDialogProps): React.JSX.Element {
  const [name, setName] = useState(initialName)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const error = onSubmit(name)
    if (error === null) onClose()
    else setProblem(error)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="configuration-name">Nome</Label>
            <Input
              id="configuration-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Arquivo: <code>configurations/{fileKeyFor(name)}.xml</code>
            </p>
            {problem !== null && <p className="text-xs text-destructive">{problem}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={name.trim() === ''}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteDialogProps {
  readonly entry: ConfigurationEntry
  readonly onClose: () => void
}

/** A configuração sai da lista agora; o arquivo só é apagado ao salvar. */
function DeleteDialog({ entry, onClose }: DeleteDialogProps): React.JSX.Element {
  const remove = useProjectStore((state) => state.deleteConfiguration)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir “{entry.configuration.name}”?</DialogTitle>
          <DialogDescription>
            O arquivo configurations/{entry.key}.xml será apagado quando você salvar. Até lá, fechar
            o projeto sem salvar mantém a configuração.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              remove(entry.key)
              onClose()
            }}
          >
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
