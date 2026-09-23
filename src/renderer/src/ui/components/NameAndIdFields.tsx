import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import type { NameAndId } from './use-name-and-id'

interface NameAndIdFieldsProps {
  readonly value: NameAndId
  /** Prefixo dos `id` HTML dos campos, como "new-feature" → "new-feature-name". */
  readonly htmlId: string
}

/** Campos "Nome" e "ID" de uma feature nova, com o ID sugerido a partir do nome. */
export function NameAndIdFields({ value, htmlId }: NameAndIdFieldsProps): React.JSX.Element {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${htmlId}-name`}>Nome</Label>
        <Input
          id={`${htmlId}-name`}
          autoFocus
          value={value.name}
          onChange={(event) => value.setName(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${htmlId}-id`}>ID</Label>
        <Input
          id={`${htmlId}-id`}
          className="font-mono"
          value={value.id}
          onChange={(event) => value.setId(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Sugerido a partir do nome. Pode ser ajustado agora; depois da criação, não muda.
        </p>
        {value.name.trim() !== '' && value.problem !== null && (
          <p className="text-xs text-destructive">{value.problem}</p>
        )}
      </div>
    </>
  )
}
