import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { ProblemList } from '@/ui/components/ProblemList'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useGenerateProduct } from './use-generate-product'

interface GenerationDialogsProps {
  readonly dialog: EditorDialog
  readonly onOpenDialog: (dialog: EditorDialog) => void
  readonly onClose: () => void
}

/** Os diálogos da geração (SPEC §7): substituir a pasta que já existe e os problemas. */
export function GenerationDialogs({
  dialog,
  onOpenDialog,
  onClose
}: GenerationDialogsProps): React.JSX.Element | null {
  const generate = useGenerateProduct(onOpenDialog)

  switch (dialog?.kind) {
    case 'replace-output':
      return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Substituir {dialog.folder}/?</DialogTitle>
              <DialogDescription>
                A pasta já existe e será trocada pelo produto novo. O que você tiver colocado nela à
                mão será perdido.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onClose()
                  void generate(dialog.key, { replace: true })
                }}
              >
                Substituir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )
    case 'generation-problems':
      return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Não foi possível gerar</DialogTitle>
              <DialogDescription>{dialog.note}</DialogDescription>
            </DialogHeader>
            <div className="max-h-80 overflow-auto">
              <ProblemList title="Problemas" tone="error" problems={dialog.problems} />
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )
    default:
      return null
  }
}
