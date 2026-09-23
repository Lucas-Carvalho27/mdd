import { ArrowDown, ArrowUp, Group as GroupIcon, ListPlus, Plus, Trash2 } from 'lucide-react'
import * as cmd from '@/application/editing/commands'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { findFeature, locateFeature } from '@/domain/feature-model/tree'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import type { EditorDialog } from './editor-dialog'

interface FeatureToolbarProps {
  readonly model: FeatureModel
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/** Ações sobre a feature selecionada; os atalhos equivalentes aparecem na dica de cada botão. */
export function FeatureToolbar({ model, onOpenDialog }: FeatureToolbarProps): React.JSX.Element {
  const selectedId = useProjectStore((state) => state.selectedFeatureId)
  const run = useProjectStore((state) => state.run)
  const feature = selectedId !== null ? findFeature(model.root, selectedId) : undefined
  const location = selectedId !== null ? locateFeature(model.root, selectedId) : undefined
  const isRoot = location?.kind === 'root'
  const hasLooseChildren = feature?.children.some((child) => child.kind === 'feature') ?? false

  if (feature === undefined) return <div className="h-9" />

  return (
    <div className="mb-3 flex flex-wrap gap-1">
      <Button
        size="sm"
        variant="outline"
        title="Adicionar filha (Tab)"
        onClick={() =>
          onOpenDialog({ kind: 'new-feature', placement: 'child', featureId: feature.id })
        }
      >
        <Plus /> Filha
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isRoot}
        title="Adicionar irmã logo abaixo (Enter)"
        onClick={() =>
          onOpenDialog({ kind: 'new-feature', placement: 'sibling', featureId: feature.id })
        }
      >
        <ListPlus /> Irmã
      </Button>
      <Button
        size="icon-sm"
        variant="outline"
        disabled={isRoot}
        title="Mover para cima (Alt+↑)"
        onClick={() => run(cmd.reorderFeature(feature.id, -1))}
      >
        <ArrowUp />
      </Button>
      <Button
        size="icon-sm"
        variant="outline"
        disabled={isRoot}
        title="Mover para baixo (Alt+↓)"
        onClick={() => run(cmd.reorderFeature(feature.id, 1))}
      >
        <ArrowDown />
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!hasLooseChildren}
        title="Juntar filhas soltas num grupo"
        onClick={() => onOpenDialog({ kind: 'create-group', parentId: feature.id })}
      >
        <GroupIcon /> Agrupar filhas…
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isRoot}
        title="Excluir com a subárvore (Delete)"
        onClick={() => onOpenDialog({ kind: 'delete-feature', featureId: feature.id })}
      >
        <Trash2 /> Excluir…
      </Button>
    </div>
  )
}
