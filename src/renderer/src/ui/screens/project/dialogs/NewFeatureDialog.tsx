import * as cmd from '@/application/editing/commands'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { featureIdSet, findFeature } from '@/domain/feature-model/tree'
import { NameAndIdFields } from '@/ui/components/NameAndIdFields'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { useNameAndId } from '@/ui/components/use-name-and-id'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface NewFeatureDialogProps {
  readonly model: FeatureModel
  /** Filha da feature indicada, ou irmã logo abaixo dela. */
  readonly placement: 'child' | 'sibling'
  readonly featureId: string
  readonly onClose: () => void
}

/** Cria uma feature pedindo nome e ID (Tab = filha, Enter = irmã). */
export function NewFeatureDialog({
  model,
  placement,
  featureId,
  onClose
}: NewFeatureDialogProps): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const fields = useNameAndId(featureIdSet(model.root), 'feature')
  const target = findFeature(model.root, featureId)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (fields.problem !== null) return
    const command =
      placement === 'child'
        ? cmd.addChildFeature(featureId, fields.name, fields.id)
        : cmd.addSiblingFeature(featureId, fields.name, fields.id)
    if (run(command)) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {placement === 'child' ? 'Nova filha de' : 'Nova irmã de'} “{target?.name}”
            </DialogTitle>
          </DialogHeader>
          <NameAndIdFields value={fields} htmlId="new-feature" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={fields.problem !== null}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
