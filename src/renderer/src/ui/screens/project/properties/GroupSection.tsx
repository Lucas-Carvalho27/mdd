import { useState } from 'react'
import * as cmd from '@/application/editing/commands'
import type { Feature, GroupMax } from '@/domain/feature-model/feature-model'
import { groupAt } from '@/domain/feature-model/tree'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { describeGroup } from '../group-label'
import { Field } from './Field'

interface GroupSectionProps {
  readonly parent: Feature
  readonly childIndex: number
  /** Membro selecionado; ele identifica o grupo nos comandos. */
  readonly memberId: string
}

/** Cardinalidade do grupo da feature selecionada: alternative, or ou personalizada. */
export function GroupSection({
  parent,
  childIndex,
  memberId
}: GroupSectionProps): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const group = groupAt(parent, childIndex)
  const [min, setMin] = useState(String(group.min))
  const [max, setMax] = useState(String(group.max))
  const [source, setSource] = useState(group)
  if (source !== group) {
    setSource(group)
    setMin(String(group.min))
    setMax(String(group.max))
  }

  const apply = (newMin: number, newMax: GroupMax): boolean =>
    run(cmd.setGroupCardinality(memberId, newMin, newMax))
  const applyCustom = (): void => {
    const parsedMax: GroupMax = max.trim() === '*' ? '*' : Number(max)
    apply(Number(min), parsedMax)
  }

  return (
    <Field label={`Grupo de "${parent.name}" — ${describeGroup(group)}`}>
      <p className="text-xs text-muted-foreground">
        Membros de grupo não são obrigatórios nem opcionais: a cardinalidade decide quantos entram.
      </p>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" onClick={() => apply(1, 1)}>
          Alternative [1..1]
        </Button>
        <Button size="sm" variant="outline" onClick={() => apply(1, '*')}>
          Or [1..*]
        </Button>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Input
          aria-label="Mínimo"
          className="w-16"
          value={min}
          onChange={(event) => setMin(event.target.value)}
        />
        <span>até</span>
        <Input
          aria-label="Máximo (número ou *)"
          className="w-16"
          value={max}
          onChange={(event) => setMax(event.target.value)}
        />
        <Button size="sm" variant="outline" onClick={applyCustom}>
          Aplicar
        </Button>
      </div>
      <Button size="sm" variant="ghost" onClick={() => run(cmd.ungroup(memberId))}>
        Desfazer grupo
      </Button>
    </Field>
  )
}
