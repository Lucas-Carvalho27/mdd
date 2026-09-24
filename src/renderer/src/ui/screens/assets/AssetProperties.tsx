import { ExternalLink, FileSearch } from 'lucide-react'
import * as cmd from '@/application/editing/commands'
import { fileNameOf, type Asset } from '@/domain/assets/asset-catalog'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { CommitField } from '@/ui/components/CommitField'
import { Button } from '@/ui/components/ui/button'
import { Field } from '@/ui/screens/project/properties/Field'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AnchorSelect, ConditionField, KindSelect } from './asset-fields'
import { FileStatusBadge } from './FileStatusBadge'
import { useFileStatus } from './use-file-status'

/** Painel direito da aba Assets (SPEC §7). Cada alteração vira um comando do histórico. */
export function AssetProperties({
  model,
  asset
}: {
  readonly model: FeatureModel
  readonly asset: Asset
}): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const openAsset = useProjectStore((state) => state.openAsset)
  const relinkAsset = useProjectStore((state) => state.relinkAsset)
  const status = useFileStatus(asset.path)

  return (
    <section className="space-y-4" data-asset-properties={asset.id}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Asset</h2>

      <Field label="ID">
        <p className="text-sm">
          <code>{asset.id}</code>{' '}
          <span className="text-xs text-muted-foreground">escolhido ao vincular; não muda</span>
        </p>
      </Field>

      <Field label="Arquivo">
        <div className="flex items-start gap-2">
          <code className="min-w-0 flex-1 break-all text-sm">{asset.path}</code>
          <FileStatusBadge path={asset.path} />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={status === 'missing'}
            onClick={() => void openAsset(asset.path)}
          >
            <ExternalLink /> Abrir
          </Button>
          <Button size="sm" variant="outline" onClick={() => void relinkAsset(asset.id)}>
            <FileSearch /> Trocar arquivo…
          </Button>
        </div>
      </Field>

      <Field label="Nome" htmlFor="asset-name">
        <CommitField
          id="asset-name"
          value={asset.name ?? ''}
          placeholder={`Opcional (sem nome, aparece "${fileNameOf(asset.path)}")`}
          onCommit={(name) => run(cmd.renameAsset(asset.id, name))}
        />
      </Field>

      <Field label="Tipo" htmlFor="asset-kind">
        <KindSelect
          id="asset-kind"
          value={asset.kind}
          onChange={(kind) => run(cmd.setAssetKind(asset.id, kind))}
        />
      </Field>

      <Field label="Âncora" htmlFor="asset-anchor">
        <AnchorSelect
          id="asset-anchor"
          model={model}
          value={asset.anchor}
          onChange={(anchor) => run(cmd.setAssetAnchor(asset.id, anchor))}
        />
      </Field>

      <Field label="Condição de presença" htmlFor="asset-condition">
        <ConditionField model={model} asset={asset} />
      </Field>
    </section>
  )
}
