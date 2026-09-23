import { useState } from 'react'
import * as cmd from '@/application/editing/commands'
import type { FeatureModel, GroupMax } from '@/domain/feature-model/feature-model'
import { findFeature } from '@/domain/feature-model/tree'
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
import { useProjectStore } from '@/ui/stores/project-store-context'

interface CreateGroupDialogProps {
  readonly model: FeatureModel
  readonly parentId: string
  readonly onClose: () => void
}

type Kind = 'alternative' | 'or' | 'custom'

/** Escolhe filhas soltas e o tipo do grupo (SPEC §4.5 "criar grupo a partir de filhos"). */
export function CreateGroupDialog({
  model,
  parentId,
  onClose
}: CreateGroupDialogProps): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const parent = findFeature(model.root, parentId)
  const loose = (parent?.children ?? []).flatMap((child) =>
    child.kind === 'feature' ? [child.feature] : []
  )
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(loose.map((f) => f.id)))
  const [kind, setKind] = useState<Kind>('alternative')
  const [min, setMin] = useState('1')
  const [max, setMax] = useState('*')

  const toggle = (id: string): void => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  const create = (): void => {
    const [groupMin, groupMax]: [number, GroupMax] =
      kind === 'alternative'
        ? [1, 1]
        : kind === 'or'
          ? [1, '*']
          : [Number(min), max.trim() === '*' ? '*' : Number(max)]
    const ids = loose.map((f) => f.id).filter((id) => selected.has(id))
    if (run(cmd.createGroup(parentId, ids, groupMin, groupMax))) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agrupar filhas de “{parent?.name ?? parentId}”</DialogTitle>
          <DialogDescription>
            O grupo fica na posição da primeira feature escolhida. As features deixam de ser
            obrigatórias ou opcionais: a cardinalidade decide quantas entram no produto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm">
          {loose.map((feature) => (
            <label key={feature.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(feature.id)}
                onChange={() => toggle(feature.id)}
              />
              {feature.name} <code className="text-xs text-muted-foreground">{feature.id}</code>
            </label>
          ))}
        </div>

        <div className="space-y-1 text-sm">
          {(
            [
              ['alternative', 'Alternative [1..1]: exatamente uma'],
              ['or', 'Or [1..*]: pelo menos uma'],
              ['custom', 'Personalizada']
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" checked={kind === value} onChange={() => setKind(value)} />
              {label}
            </label>
          ))}
          {kind === 'custom' && (
            <div className="ml-6 flex items-center gap-2">
              <Input
                aria-label="Mínimo"
                className="w-16"
                value={min}
                onChange={(e) => setMin(e.target.value)}
              />
              <span>até</span>
              <Input
                aria-label="Máximo (número ou *)"
                className="w-16"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={selected.size === 0} onClick={create}>
            Criar grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
