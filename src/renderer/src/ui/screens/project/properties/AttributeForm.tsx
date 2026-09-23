import { useState } from 'react'
import type { AttributeDraft } from '@/domain/feature-model/attribute-edits'
import type { Attribute, AttributeType } from '@/domain/feature-model/feature-model'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'

interface AttributeFormProps {
  readonly initial?: Attribute
  readonly onSubmit: (draft: AttributeDraft) => void
  readonly onCancel: () => void
}

const TYPES: readonly AttributeType[] = ['string', 'number', 'boolean', 'enum']

/**
 * Formulário de atributo. Não valida nada: monta o rascunho e o comando confere as
 * regras M5 (tipos, faixa, default); se recusar, o motivo aparece no aviso da tela.
 */
export function AttributeForm({
  initial,
  onSubmit,
  onCancel
}: AttributeFormProps): React.JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<AttributeType>(initial?.type ?? 'string')
  const [defaultValue, setDefaultValue] = useState(initial?.defaultValue ?? '')
  const [min, setMin] = useState(initial?.min?.toString() ?? '')
  const [max, setMax] = useState(initial?.max?.toString() ?? '')
  const [options, setOptions] = useState(initial?.options.join(', ') ?? '')
  const [fixed, setFixed] = useState(initial !== undefined && !initial.configurable)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    onSubmit({
      name,
      type,
      ...(defaultValue.trim() !== '' ? { defaultValue: defaultValue.trim() } : {}),
      ...(type === 'number' && min.trim() !== '' ? { min: Number(min) } : {}),
      ...(type === 'number' && max.trim() !== '' ? { max: Number(max) } : {}),
      configurable: !fixed,
      options:
        type === 'enum'
          ? options
              .split(',')
              .map((option) => option.trim())
              .filter((option) => option !== '')
          : []
    })
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border p-3 text-sm">
      <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
        <Label htmlFor="attribute-name">Nome</Label>
        <Input
          id="attribute-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Label htmlFor="attribute-type">Tipo</Label>
        <select
          id="attribute-type"
          className="h-9 rounded-md border bg-transparent px-2"
          value={type}
          onChange={(e) => setType(e.target.value as AttributeType)}
        >
          {TYPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        {type === 'enum' && (
          <>
            <Label htmlFor="attribute-options">Opções</Label>
            <Input
              id="attribute-options"
              placeholder="android, ios, ambas"
              value={options}
              onChange={(e) => setOptions(e.target.value)}
            />
          </>
        )}

        {type === 'number' && (
          <>
            <Label>Faixa</Label>
            <div className="flex items-center gap-2">
              <Input aria-label="Mínimo" value={min} onChange={(e) => setMin(e.target.value)} />
              <span>a</span>
              <Input aria-label="Máximo" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </>
        )}

        <Label htmlFor="attribute-default">Padrão</Label>
        <Input
          id="attribute-default"
          placeholder={type === 'boolean' ? 'true ou false' : 'opcional'}
          value={defaultValue}
          onChange={(e) => setDefaultValue(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
        Valor fixo, definido no modelo (senão, cada produto escolhe)
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm">
          {initial ? 'Salvar atributo' : 'Adicionar atributo'}
        </Button>
      </div>
    </form>
  )
}
