import { useState } from 'react'
import { folderOf } from '@/domain/fragments/fragment-path'
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

interface FragmentDialogsProps {
  readonly dialog: EditorDialog
  readonly onClose: () => void
}

/** Criar um fragmento e descartar as alterações de um (Fase 6). */
export function FragmentDialogs({
  dialog,
  onClose
}: FragmentDialogsProps): React.JSX.Element | null {
  switch (dialog?.kind) {
    case 'new-fragment':
      return <NewFragmentDialog onClose={onClose} />
    case 'discard-fragment':
      return <DiscardFragmentDialog path={dialog.path} onClose={onClose} />
    default:
      return null
  }
}

/** O caminho começa na pasta do fragmento exibido; o arquivo só vai para o disco no Ctrl+S. */
function NewFragmentDialog({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  const shownPath = useProjectStore((state) => state.shownFragmentPath)
  const checkPath = useProjectStore((state) => state.checkNewFragmentPath)
  const create = useProjectStore((state) => state.createFragment)
  const [path, setPath] = useState(() => (shownPath === null ? '' : folderOf(shownPath)))
  const problem = checkPath(path)
  // Enquanto só a pasta está digitada, ainda não é hora de reclamar.
  const typing = path.trim() === '' || path.endsWith('/')

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (create(path) === null) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Novo fragmento</DialogTitle>
            <DialogDescription>
              O arquivo é criado ao salvar, com as pastas que faltarem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fragment-path">Caminho</Label>
            <Input
              id="fragment-path"
              autoFocus
              className="font-mono"
              placeholder="docs/novo.xml"
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Relativo à pasta do projeto, terminando em .xml.
            </p>
            {problem !== null && !typing && <p className="text-xs text-destructive">{problem}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={problem !== null}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DiscardFragmentDialogProps {
  readonly path: string
  readonly onClose: () => void
}

function DiscardFragmentDialog({
  path,
  onClose
}: DiscardFragmentDialogProps): React.JSX.Element | null {
  const document = useProjectStore((state) => state.fragmentDocuments.get(path))
  const discard = useProjectStore((state) => state.discardFragment)
  if (document === undefined) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar alterações?</DialogTitle>
          <DialogDescription>
            {document.saved === null ? (
              <>
                O arquivo novo <code>{path}</code> sai da lista e não será criado.
              </>
            ) : (
              <>
                O texto de <code>{path}</code> volta a ser o que está no disco.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              discard(path)
              onClose()
            }}
          >
            Descartar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
