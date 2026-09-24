import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileCode2,
  Paperclip,
  Pencil,
  Unlink
} from 'lucide-react'
import { cn } from 'cn'
import * as cmd from '@/application/editing/commands'
import { assetLabel, type Asset } from '@/domain/assets/asset-catalog'
import type { AnchorGroup } from '@/domain/assets/asset-groups'
import { printExpression } from '@/domain/expression/printer'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { FileStatusBadge } from './FileStatusBadge'
import { useFileStatus } from './use-file-status'

/** Os assets agrupados por âncora, na ordem do modelo (SPEC §7). */
export function AssetList({
  groups,
  onEditFragment
}: {
  readonly groups: readonly AnchorGroup[]
  readonly onEditFragment: (path: string) => void
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      {groups.map(({ feature, assets }) => (
        <section key={feature.id} data-anchor={feature.id} className="space-y-1">
          <h3 className="text-sm font-medium">
            {feature.name} <code className="text-xs text-muted-foreground">{feature.id}</code>
          </h3>
          <ul className="divide-y rounded-md border">
            {assets.map((asset, index) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                first={index === 0}
                last={index === assets.length - 1}
                onEditFragment={onEditFragment}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

interface AssetRowProps {
  readonly asset: Asset
  /** Primeiro e último da âncora: não sobem nem descem. */
  readonly first: boolean
  readonly last: boolean
  readonly onEditFragment: (path: string) => void
}

function AssetRow({ asset, first, last, onEditFragment }: AssetRowProps): React.JSX.Element {
  const selected = useProjectStore((state) => state.selectedAssetId === asset.id)
  const selectAsset = useProjectStore((state) => state.selectAsset)
  const run = useProjectStore((state) => state.run)
  const openAsset = useProjectStore((state) => state.openAsset)
  const status = useFileStatus(asset.path)
  const label = assetLabel(asset)
  const Icon = asset.kind === 'fragment' ? FileCode2 : Paperclip

  return (
    <li
      data-asset-id={asset.id}
      aria-selected={selected}
      className={cn('flex items-center gap-2 px-2 py-1.5', selected && 'bg-accent')}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-2 text-left"
        onClick={() => selectAsset(asset.id)}
      >
        <Icon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-label={asset.kind === 'fragment' ? 'Fragmento' : 'Recurso'}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{label}</span>
          <code className="block truncate text-xs text-muted-foreground">{asset.path}</code>
          {asset.condition !== undefined && (
            <span className="block truncate text-xs text-muted-foreground">
              se <code>{printExpression(asset.condition)}</code>
            </span>
          )}
        </span>
        <FileStatusBadge path={asset.path} />
      </button>
      {asset.kind === 'fragment' && (
        <Button
          size="icon-sm"
          variant="ghost"
          title="Editar na aba Fragmentos"
          disabled={status === 'missing'}
          onClick={() => onEditFragment(asset.path)}
        >
          <Pencil />
        </Button>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        title="Abrir no programa padrão"
        disabled={status === 'missing'}
        onClick={() => void openAsset(asset.path)}
      >
        <ExternalLink />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        title="Mover para cima"
        disabled={first}
        onClick={() => run(cmd.reorderAsset(asset.id, -1))}
      >
        <ArrowUp />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        title="Mover para baixo"
        disabled={last}
        onClick={() => run(cmd.reorderAsset(asset.id, 1))}
      >
        <ArrowDown />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        title="Desvincular (o arquivo continua no disco)"
        onClick={() => run(cmd.unlinkAsset(asset.id, label))}
      >
        <Unlink />
      </Button>
    </li>
  )
}
