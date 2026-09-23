import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'

/** Arquivos mudaram fora do app desde a última leitura: sobrescrever, recarregar ou cancelar (SPEC §8). */
export function ConflictDialog(): React.JSX.Element | null {
  const conflicts = useProjectStore((state) => state.conflicts)
  const save = useProjectStore((state) => state.save)
  const reload = useProjectStore((state) => state.reload)
  const dismiss = useProjectStore((state) => state.dismissConflicts)
  if (conflicts.length === 0) return null

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arquivos alterados fora do app</DialogTitle>
          <DialogDescription>
            Estes arquivos mudaram no disco desde que foram abertos (por exemplo, depois de um git
            pull) e não foram gravados:
          </DialogDescription>
        </DialogHeader>
        <ul className="ml-4 list-disc font-mono text-sm">
          {conflicts.map((file) => (
            <li key={file}>{file}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={() => void reload()}>
            Recarregar (descarta minhas alterações)
          </Button>
          <Button variant="destructive" onClick={() => void save({ overwrite: true })}>
            Sobrescrever
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
