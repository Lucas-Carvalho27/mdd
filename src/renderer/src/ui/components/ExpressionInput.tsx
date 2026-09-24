import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { featureIdSet } from '@/domain/feature-model/tree'
import { Input } from '@/ui/components/ui/input'
import { checkExpression } from './expression-check'

interface ExpressionInputProps {
  readonly id: string
  readonly model: FeatureModel
  readonly value: string
  readonly onChange: (text: string) => void
  readonly onBlur?: () => void
  readonly onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
  readonly autoFocus?: boolean
  readonly placeholder?: string
}

const MAX_SUGGESTIONS = 8

/**
 * Campo de expressão das restrições e das condições (SPEC §7): mostra o erro de sintaxe com
 * a coluna enquanto se digita e sugere IDs de features para a palavra em andamento.
 */
export function ExpressionInput({
  id,
  model,
  value,
  onChange,
  onBlur,
  onKeyDown,
  autoFocus,
  placeholder
}: ExpressionInputProps): React.JSX.Element {
  const check = checkExpression(model, value)
  const partial = /[a-z0-9_]*$/.exec(value)?.[0] ?? ''
  const suggestions =
    partial === ''
      ? []
      : [...featureIdSet(model.root)]
          .filter((featureId) => featureId.startsWith(partial) && featureId !== partial)
          .slice(0, MAX_SUGGESTIONS)

  return (
    <>
      <Input
        id={id}
        autoFocus={autoFocus}
        className="font-mono"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <p className="text-xs text-muted-foreground">
        Operadores: not, and, or, implies, iff. Use os IDs das features.
      </p>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded bg-muted px-1.5 font-mono text-xs hover:bg-accent"
              // O campo continua com o foco: completar não conta como sair dele.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                onChange(`${value.slice(0, value.length - partial.length)}${suggestion} `)
              }
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      {check.kind === 'invalid' && <p className="text-xs text-destructive">{check.problem}</p>}
    </>
  )
}
