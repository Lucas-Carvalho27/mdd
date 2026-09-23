import * as cmd from '@/application/editing/commands'
import { analyzeFeatureDeletion } from '@/application/editing/impact'
import { printExpression } from '@/domain/expression/printer'
import { findFeature } from '@/domain/feature-model/tree'
import type { Project } from '@/domain/project/project'
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

interface DeleteFeatureDialogProps {
  readonly project: Project
  readonly featureId: string
  readonly onClose: () => void
}

/** Mostra tudo o que a exclusão leva junto antes de confirmar (SPEC §4.5). */
export function DeleteFeatureDialog({
  project,
  featureId,
  onClose
}: DeleteFeatureDialogProps): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const feature = findFeature(project.model.root, featureId)
  const impact = analyzeFeatureDeletion(project, featureId)
  const nameOf = (id: string): string => findFeature(project.model.root, id)?.name ?? id

  const confirm = (): void => {
    if (feature !== undefined) run(cmd.deleteFeature(featureId, feature.name))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir “{feature?.name ?? featureId}”?</DialogTitle>
          <DialogDescription>
            Dá para desfazer com Ctrl+Z enquanto o projeto estiver aberto.
          </DialogDescription>
        </DialogHeader>

        {!impact.ok ? (
          <p className="text-sm text-destructive">{impact.error}</p>
        ) : (
          <div className="space-y-3 text-sm">
            <Impact title="Features excluídas" items={impact.value.removedFeatureIds.map(nameOf)} />
            <Impact
              title="Restrições removidas inteiras"
              items={impact.value.removedConstraintIds.map((id) => {
                const constraint = project.model.constraints.find((c) => c.id === id)
                return constraint ? printExpression(constraint.expression) : id
              })}
            />
            <Impact
              title="Assets desvinculados (os arquivos continuam no disco)"
              items={impact.value.unlinkedAssetIds.map((id) => {
                const asset = project.assets.assets.find((a) => a.id === id)
                return asset ? asset.path : id
              })}
            />
            <Impact
              title="Configurações que vão abrir como desatualizadas"
              items={[...impact.value.affectedConfigurations]}
            />
            {impact.value.groupChange && <p>{impact.value.groupChange}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!impact.ok} onClick={confirm}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Impact({
  title,
  items
}: {
  readonly title: string
  readonly items: readonly string[]
}): React.JSX.Element | null {
  if (items.length === 0) return null
  return (
    <div>
      <p className="font-medium">
        {title} ({items.length})
      </p>
      <ul className="ml-4 list-disc text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
