import { NameAndIdFields } from '@/ui/components/NameAndIdFields'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { useNameAndId } from '@/ui/components/use-name-and-id'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface NewProjectDialogProps {
  readonly onClose: () => void
}

const NO_IDS: ReadonlySet<string> = new Set()

/** Pede o nome e o ID da raiz; em seguida o diálogo nativo pede a pasta (SPEC §7). */
export function NewProjectDialog({ onClose }: NewProjectDialogProps): React.JSX.Element {
  const create = useProjectStore((state) => state.create)
  const fields = useNameAndId(NO_IDS, 'raiz')

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (fields.problem !== null) return
    onClose()
    void create(fields.name, fields.id)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>
              O nome vira o nome do modelo e da feature raiz. Em seguida, escolha uma pasta sem
              projeto.
            </DialogDescription>
          </DialogHeader>
          <NameAndIdFields value={fields} htmlId="new-project" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={fields.problem !== null}>
              Escolher pasta…
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
