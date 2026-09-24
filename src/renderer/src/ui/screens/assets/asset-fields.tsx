import { useRef, useState } from 'react'
import * as cmd from '@/application/editing/commands'
import type { Asset, AssetKind } from '@/domain/assets/asset-catalog'
import { printExpression } from '@/domain/expression/printer'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { featuresInPreOrder } from '@/domain/feature-model/traversal'
import { checkExpression } from '@/ui/components/expression-check'
import { ExpressionInput } from '@/ui/components/ExpressionInput'
import { useProjectStore } from '@/ui/stores/project-store-context'

/** Campos de asset usados no diálogo de vincular e no painel. */

const SELECT = 'h-9 w-full rounded-md border bg-transparent px-2 text-sm'

const KIND_LABEL: Record<AssetKind, string> = {
  fragment: 'Fragmento (XML embutido no produto)',
  resource: 'Recurso (arquivo copiado para a saída)'
}

interface SelectProps<T extends string> {
  readonly id: string
  readonly value: T
  readonly onChange: (value: T) => void
}

export function KindSelect({ id, value, onChange }: SelectProps<AssetKind>): React.JSX.Element {
  return (
    <select
      id={id}
      className={SELECT}
      value={value}
      onChange={(event) => onChange(event.target.value as AssetKind)}
    >
      {(['fragment', 'resource'] as const).map((kind) => (
        <option key={kind} value={kind}>
          {KIND_LABEL[kind]}
        </option>
      ))}
    </select>
  )
}

/** As features na pré-ordem do modelo, com nome e ID. */
export function AnchorSelect({
  id,
  model,
  value,
  onChange
}: SelectProps<string> & { readonly model: FeatureModel }): React.JSX.Element {
  return (
    <select
      id={id}
      className={SELECT}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {featuresInPreOrder(model.root).map((feature) => (
        <option key={feature.id} value={feature.id}>
          {feature.name} ({feature.id})
        </option>
      ))}
    </select>
  )
}

/**
 * A condição de presença, com o editor das restrições. Grava ao sair do campo ou com Enter,
 * só se for válida; vazio tira a condição. Com erro, o texto fica e nada é gravado.
 */
export function ConditionField({
  model,
  asset
}: {
  readonly model: FeatureModel
  readonly asset: Asset
}): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const saved = asset.condition !== undefined ? printExpression(asset.condition) : ''
  const [text, setText] = useState(saved)
  const [source, setSource] = useState(saved)
  // Esc sai do campo sem gravar: o blur acontece antes de o texto voltar ao salvo.
  const cancelled = useRef(false)
  if (source !== saved) {
    // A condição mudou por fora (desfazer, outro asset selecionado): mostra a nova.
    setSource(saved)
    setText(saved)
  }

  const commit = (): void => {
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    const check = checkExpression(model, text)
    if (check.kind === 'empty' && saved !== '') run(cmd.setAssetCondition(asset.id, undefined))
    if (check.kind === 'valid' && printExpression(check.expression) !== saved) {
      run(cmd.setAssetCondition(asset.id, check.expression))
    }
  }

  return (
    <ExpressionInput
      id="asset-condition"
      model={model}
      placeholder="Sem condição: entra sempre que a âncora entrar"
      value={text}
      onChange={setText}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          cancelled.current = true
          setText(saved)
          event.currentTarget.blur()
        }
      }}
    />
  )
}
