import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import * as cmd from '@/application/editing/commands'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { printExpression } from '@/domain/expression/printer'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { ConstraintForm } from './ConstraintForm'

/** `null` = nenhum formulário; `'new'` = criando; ID = editando essa restrição. */
type Editing = null | 'new' | string

/** Lista e edição das restrições entre ramos (SPEC §7). */
export function ConstraintsPanel({ model }: { readonly model: FeatureModel }): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const [editing, setEditing] = useState<Editing>(null)

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Restrições ({model.constraints.length})
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setEditing('new')}>
          <Plus /> Nova
        </Button>
      </div>

      <ul className="space-y-1">
        {model.constraints.map((constraint) =>
          editing === constraint.id ? (
            <li key={constraint.id}>
              <ConstraintForm
                model={model}
                initial={constraint}
                onCancel={() => setEditing(null)}
                onSubmit={(expression, description) => {
                  const done = run(cmd.updateConstraint(constraint.id, expression, description))
                  if (done) setEditing(null)
                }}
              />
            </li>
          ) : (
            <li key={constraint.id} className="flex items-start gap-1 text-sm">
              <span className="flex-1">
                <code>{printExpression(constraint.expression)}</code>
                {constraint.description && (
                  <span className="block text-xs text-muted-foreground">
                    {constraint.description}
                  </span>
                )}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Editar"
                onClick={() => setEditing(constraint.id)}
              >
                <Pencil />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Excluir"
                onClick={() => run(cmd.removeConstraint(constraint.id))}
              >
                <Trash2 />
              </Button>
            </li>
          )
        )}
      </ul>

      {editing === 'new' && (
        <ConstraintForm
          model={model}
          onCancel={() => setEditing(null)}
          onSubmit={(expression, description) => {
            if (run(cmd.addConstraint(expression, description))) setEditing(null)
          }}
        />
      )}
    </section>
  )
}
