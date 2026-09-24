import { useState } from 'react'
import type { AssetCatalog, AssetKind } from '@/domain/assets/asset-catalog'
import { checkNewAssetId, suggestAssetId, suggestAssetKind } from '@/domain/assets/asset-edits'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AnchorSelect, KindSelect } from './asset-fields'

interface LinkAssetDialogProps {
  readonly model: FeatureModel
  readonly catalog: AssetCatalog
  /** O arquivo escolhido no diálogo nativo, relativo à pasta do projeto. */
  readonly path: string
  readonly anchor: string
  readonly onClose: () => void
}

/**
 * Vincular um arquivo (SPEC §7): tipo sugerido pela extensão, nome opcional e o ID sugerido
 * pelo nome do arquivo, que só pode ser ajustado aqui (ADR 0004).
 */
export function LinkAssetDialog({
  model,
  catalog,
  path,
  anchor: initialAnchor,
  onClose
}: LinkAssetDialogProps): React.JSX.Element {
  const linkAsset = useProjectStore((state) => state.linkAsset)
  const [kind, setKind] = useState<AssetKind>(suggestAssetKind(path))
  const [name, setName] = useState('')
  const [id, setId] = useState(suggestAssetId(catalog, path))
  const [anchor, setAnchor] = useState(initialAnchor)
  const problem = checkNewAssetId(catalog, id)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (problem === null && linkAsset({ id, path, kind, anchor, name })) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Vincular arquivo</DialogTitle>
            <DialogDescription className="break-all font-mono">{path}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-asset-kind">Tipo</Label>
            <KindSelect id="link-asset-kind" value={kind} onChange={setKind} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-asset-name">Nome</Label>
            <Input
              id="link-asset-name"
              autoFocus
              placeholder="Opcional"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-asset-id">ID</Label>
            <Input
              id="link-asset-id"
              className="font-mono"
              value={id}
              onChange={(event) => setId(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sugerido pelo nome do arquivo. Pode ser ajustado agora; depois do vínculo, não muda.
            </p>
            {problem !== null && <p className="text-xs text-destructive">{problem}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-asset-anchor">Âncora</Label>
            <AnchorSelect
              id="link-asset-anchor"
              model={model}
              value={anchor}
              onChange={setAnchor}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={problem !== null}>
              Vincular
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
