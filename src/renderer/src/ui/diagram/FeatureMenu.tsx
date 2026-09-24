import * as cmd from '@/application/editing/commands'
import { findFeature } from '@/domain/feature-model/tree'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut
} from '@/ui/components/ui/context-menu'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { useFeatureActions } from './diagram-context'

/** Itens do menu de contexto de um nó (SPEC §7); cada um faz o mesmo que o botão ou atalho. */
export function FeatureMenu({ featureId }: { readonly featureId: string }): React.JSX.Element {
  const actions = useFeatureActions()
  const model = useProjectStore((state) => state.session?.project.model)
  const collapsed = useProjectStore((state) => state.collapsedFeatureIds.has(featureId))
  const run = useProjectStore((state) => state.run)
  const toggleCollapsed = useProjectStore((state) => state.toggleCollapsed)
  const feature = model !== undefined ? findFeature(model.root, featureId) : undefined
  const isRoot = model?.root.id === featureId
  const hasChildren = (feature?.children.length ?? 0) > 0
  const hasLooseChildren = feature?.children.some((child) => child.kind === 'feature') ?? false

  return (
    <ContextMenuContent className="w-56">
      <ContextMenuItem onSelect={() => actions.addChild(featureId)}>
        Adicionar filha…<ContextMenuShortcut>Tab</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={isRoot} onSelect={() => actions.addSibling(featureId)}>
        Adicionar irmã…<ContextMenuShortcut>Enter</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!hasLooseChildren}
        onSelect={() => actions.groupChildren(featureId)}
      >
        Agrupar filhas…
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={isRoot} onSelect={() => run(cmd.reorderFeature(featureId, -1))}>
        Mover para cima<ContextMenuShortcut>Alt+↑</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={isRoot} onSelect={() => run(cmd.reorderFeature(featureId, 1))}>
        Mover para baixo<ContextMenuShortcut>Alt+↓</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!hasChildren} onSelect={() => toggleCollapsed(featureId)}>
        {collapsed ? 'Expandir' : 'Recolher'}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        disabled={isRoot}
        onSelect={() => actions.remove(featureId)}
      >
        Excluir…<ContextMenuShortcut>Delete</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
