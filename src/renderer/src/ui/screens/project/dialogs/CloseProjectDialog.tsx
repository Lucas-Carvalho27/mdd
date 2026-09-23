import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore, useProjectStoreApi } from '@/ui/stores/project-store-context'

/** Fechar o projeto com alterações não salvas pede confirmação (SPEC §8). */
export function CloseProjectDialog({
  onCancel
}: {
  readonly onCancel: () => void
}): React.JSX.Element {
  const store = useProjectStoreApi()
  const close = useProjectStore((state) => state.close)
  const save = useProjectStore((state) => state.save)

  const saveAndClose = async (): Promise<void> => {
    await save()
    // Só fecha se a gravação deu certo; senão o conflito ou o erro aparece na tela.
    if (!hasUnsavedChanges(store.getState())) close()
    else onCancel()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar com alterações não salvas?</DialogTitle>
          <DialogDescription>Se fechar sem salvar, as alterações serão perdidas.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={close}>
            Fechar sem salvar
          </Button>
          <Button onClick={() => void saveAndClose()}>Salvar e fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
