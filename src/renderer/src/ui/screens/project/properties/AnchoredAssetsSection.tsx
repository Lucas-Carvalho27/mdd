import { Link2 } from 'lucide-react'
import { assetLabel, type AssetCatalog } from '@/domain/assets/asset-catalog'
import { assetsAnchoredAt } from '@/domain/assets/asset-groups'
import { Button } from '@/ui/components/ui/button'
import { FileStatusBadge } from '@/ui/screens/assets/FileStatusBadge'
import { useLinkAsset } from '@/ui/screens/assets/use-link-asset'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'

interface AnchoredAssetsSectionProps {
  readonly catalog: AssetCatalog
  readonly featureId: string
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/** Os assets ancorados na feature (SPEC §7), com o estado do arquivo e o atalho para vincular. */
export function AnchoredAssetsSection({
  catalog,
  featureId,
  onOpenDialog
}: AnchoredAssetsSectionProps): React.JSX.Element {
  const startLink = useLinkAsset(onOpenDialog)
  const anchored = assetsAnchoredAt(catalog, featureId)

  return (
    <section className="space-y-2" data-anchored-assets>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Assets ancorados ({anchored.length})</h3>
        <Button size="sm" variant="ghost" onClick={() => void startLink(featureId)}>
          <Link2 /> Vincular arquivo…
        </Button>
      </div>
      {anchored.length > 0 && (
        <ul className="space-y-1">
          {anchored.map((asset) => (
            <li key={asset.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate" title={asset.path}>
                {assetLabel(asset)}
              </span>
              <FileStatusBadge path={asset.path} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
