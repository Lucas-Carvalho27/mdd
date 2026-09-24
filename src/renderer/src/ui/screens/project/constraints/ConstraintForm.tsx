import { useState } from 'react'
import type { Expression } from '@/domain/expression/ast'
import { printExpression } from '@/domain/expression/printer'
import type { Constraint, FeatureModel } from '@/domain/feature-model/feature-model'
import { checkExpression } from '@/ui/components/expression-check'
import { ExpressionInput } from '@/ui/components/ExpressionInput'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'

interface ConstraintFormProps {
  readonly model: FeatureModel
  readonly initial?: Constraint
  readonly onSubmit: (expression: Expression, description: string) => void
  readonly onCancel: () => void
}

/**
 * Editor de restrição: mostra o erro de sintaxe com a coluna enquanto se digita e sugere
 * IDs de features para a palavra em andamento. Só confirma uma expressão válida.
 */
export function ConstraintForm({
  model,
  initial,
  onSubmit,
  onCancel
}: ConstraintFormProps): React.JSX.Element {
  const [text, setText] = useState(initial ? printExpression(initial.expression) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const check = checkExpression(model, text)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (check.kind === 'valid') onSubmit(check.expression, description)
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border p-3 text-sm">
      <div className="space-y-1.5">
        <Label htmlFor="constraint-expression">Expressão</Label>
        <ExpressionInput
          id="constraint-expression"
          autoFocus
          model={model}
          placeholder="pag_pix implies mobile"
          value={text}
          onChange={setText}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="constraint-description">Descrição</Label>
        <Input
          id="constraint-description"
          placeholder="Opcional"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={check.kind !== 'valid'}>
          {initial ? 'Salvar restrição' : 'Adicionar restrição'}
        </Button>
      </div>
    </form>
  )
}
