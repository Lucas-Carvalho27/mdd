import { useState } from 'react'
import type { Expression } from '@/domain/expression/ast'
import { parseExpression } from '@/domain/expression/parser'
import { printExpression } from '@/domain/expression/printer'
import { referencedFeatureIds } from '@/domain/expression/references'
import type { Constraint, FeatureModel } from '@/domain/feature-model/feature-model'
import { featureIdSet } from '@/domain/feature-model/tree'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'

interface ConstraintFormProps {
  readonly model: FeatureModel
  readonly initial?: Constraint
  readonly onSubmit: (expression: Expression, description: string) => void
  readonly onCancel: () => void
}

const MAX_SUGGESTIONS = 8

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
  const ids = featureIdSet(model.root)

  const parsed = parseExpression(text)
  const unknown = parsed.ok
    ? [...referencedFeatureIds(parsed.value)].filter((id) => !ids.has(id))
    : []
  const partial = /[a-z0-9_]*$/.exec(text)?.[0] ?? ''
  const suggestions =
    partial === ''
      ? []
      : [...ids].filter((id) => id.startsWith(partial) && id !== partial).slice(0, MAX_SUGGESTIONS)

  const complete = (id: string): void => {
    setText(`${text.slice(0, text.length - partial.length)}${id} `)
  }
  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (parsed.ok && unknown.length === 0) onSubmit(parsed.value, description)
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border p-3 text-sm">
      <div className="space-y-1.5">
        <Label htmlFor="constraint-expression">Expressão</Label>
        <Input
          id="constraint-expression"
          autoFocus
          className="font-mono"
          placeholder="pag_pix implies mobile"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Operadores: not, and, or, implies, iff. Use os IDs das features.
        </p>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suggestions.map((id) => (
              <button
                key={id}
                type="button"
                className="rounded bg-muted px-1.5 font-mono text-xs hover:bg-accent"
                onClick={() => complete(id)}
              >
                {id}
              </button>
            ))}
          </div>
        )}
        {text.trim() !== '' && !parsed.ok && (
          <p className="text-xs text-destructive">
            Coluna {parsed.error.column}: {parsed.error.message}
          </p>
        )}
        {unknown.length > 0 && (
          <p className="text-xs text-destructive">Features inexistentes: {unknown.join(', ')}</p>
        )}
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
        <Button type="submit" size="sm" disabled={!parsed.ok || unknown.length > 0}>
          {initial ? 'Salvar restrição' : 'Adicionar restrição'}
        </Button>
      </div>
    </form>
  )
}
