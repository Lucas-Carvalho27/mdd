import { useEffect } from 'react'
import { Link2, RefreshCw } from 'lucide-react'
import { groupAssetsByAnchor } from '@/domain/assets/asset-groups'
import type { Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { selectedAsset } from '@/ui/stores/assets-actions'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AssetList } from './AssetList'
import { AssetProperties } from './AssetProperties'
import { useLinkAsset } from './use-link-asset'

interface AssetsWorkspaceProps {
  readonly project: Project
  readonly onOpenDialog: (dialog: EditorDialog) => void
  /** Abre o fragmento na aba Fragmentos. */
  readonly onEditFragment: (path: string) => void
}

/**
 * Aba Assets (SPEC §7): os assets agrupados por âncora no centro e as propriedades do
 * selecionado à direita. Entrar na aba confere os arquivos no disco.
 */
export function AssetsWorkspace({
  project,
  onOpenDialog,
  onEditFragment
}: AssetsWorkspaceProps): React.JSX.Element {
  const asset = useProjectStore(selectedAsset)
  const selectedFeatureId = useProjectStore((state) => state.selectedFeatureId)
  const assetFiles = useProjectStore((state) => state.assetFiles)
  const checkAssetFiles = useProjectStore((state) => state.checkAssetFiles)
  const startLink = useLinkAsset(onOpenDialog)
  const { model, assets } = project

  useEffect(() => {
    void checkAssetFiles()
  }, [checkAssetFiles])

  const groups = groupAssetsByAnchor(model, assets)
  const missing = assets.assets.filter((item) => assetFiles.get(item.path) === 'missing').length
  // A âncora sugerida: a do asset selecionado ou, sem ele, a feature selecionada no modelo.
  const anchor = asset?.anchor ?? selectedFeatureId ?? model.root.id

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_24rem]">
      <section className="flex min-h-0 flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void startLink(anchor)}>
            <Link2 /> Vincular arquivo…
          </Button>
          <Button size="sm" variant="outline" onClick={() => void checkAssetFiles()}>
            <RefreshCw /> Atualizar
          </Button>
          <span data-assets-summary className="ml-auto text-sm text-muted-foreground">
            {assets.assets.length} {assets.assets.length === 1 ? 'asset' : 'assets'}
            {missing > 0 && ` · ${missing} ${missing === 1 ? 'ausente' : 'ausentes'}`}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {groups.length === 0 ? (
            <p className="max-w-prose text-sm text-muted-foreground">
              Nenhum asset vinculado. Um asset liga um arquivo do projeto a uma feature (a âncora):
              um fragmento XML entra no produto gerado, e um recurso é copiado para a saída.
            </p>
          ) : (
            <AssetList groups={groups} onEditFragment={onEditFragment} />
          )}
        </div>
      </section>
      <aside className="min-h-0 overflow-auto border-l p-4">
        {asset === null ? (
          <p className="text-sm text-muted-foreground">Escolha um asset na lista.</p>
        ) : (
          <AssetProperties key={asset.id} model={model} asset={asset} />
        )}
      </aside>
    </div>
  )
}
