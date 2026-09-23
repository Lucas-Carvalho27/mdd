import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import * as cmd from '@/application/editing/commands'
import { configurationsUsingAttribute } from '@/application/editing/impact'
import type { Attribute, Feature } from '@/domain/feature-model/feature-model'
import type { Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AttributeForm } from './AttributeForm'

interface AttributesSectionProps {
  readonly project: Project
  readonly feature: Feature
}

/** `null` = nenhum formulário; `'new'` = criando; ID = editando esse atributo. */
type Editing = null | 'new' | string

export function AttributesSection({ project, feature }: AttributesSectionProps): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const [editing, setEditing] = useState<Editing>(null)
  const [featureId, setFeatureId] = useState(feature.id)
  if (featureId !== feature.id) {
    setFeatureId(feature.id)
    setEditing(null)
  }

  const remove = (attribute: Attribute): void => {
    const users = configurationsUsingAttribute(project, feature.id, attribute.id)
    const warning =
      users.length > 0
        ? `\n\nEstas configurações têm valor para ele e vão abrir como desatualizadas: ${users.join(', ')}.`
        : ''
    if (window.confirm(`Excluir o atributo "${attribute.name}"?${warning}`)) {
      run(cmd.removeAttribute(feature.id, attribute.id))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Atributos</h3>
        <Button size="sm" variant="ghost" onClick={() => setEditing('new')}>
          <Plus /> Adicionar
        </Button>
      </div>

      {feature.attributes.length === 0 && editing !== 'new' && (
        <p className="text-sm text-muted-foreground">Nenhum atributo.</p>
      )}

      <ul className="space-y-1">
        {feature.attributes.map((attribute) =>
          editing === attribute.id ? (
            <li key={attribute.id}>
              <AttributeForm
                initial={attribute}
                onCancel={() => setEditing(null)}
                onSubmit={(draft) => {
                  const done = run(cmd.updateAttribute(feature.id, attribute.id, draft))
                  if (done) setEditing(null)
                }}
              />
            </li>
          ) : (
            <li key={attribute.id} className="flex items-center gap-1 text-sm">
              <span className="flex-1">
                {attribute.name}{' '}
                <code className="text-xs text-muted-foreground">{attribute.id}</code>
                <span className="block text-xs text-muted-foreground">{summarize(attribute)}</span>
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Editar"
                onClick={() => setEditing(attribute.id)}
              >
                <Pencil />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Excluir"
                onClick={() => remove(attribute)}
              >
                <Trash2 />
              </Button>
            </li>
          )
        )}
      </ul>

      {editing === 'new' && (
        <AttributeForm
          onCancel={() => setEditing(null)}
          onSubmit={(draft) => {
            if (run(cmd.addAttribute(feature.id, draft))) setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function summarize(attribute: Attribute): string {
  const parts: string[] = [attribute.type]
  if (attribute.type === 'enum') parts.push(`{${attribute.options.join(', ')}}`)
  if (attribute.min !== undefined || attribute.max !== undefined) {
    parts.push(`${attribute.min ?? '…'} a ${attribute.max ?? '…'}`)
  }
  if (attribute.defaultValue !== undefined) parts.push(`padrão ${attribute.defaultValue}`)
  parts.push(attribute.configurable ? 'escolhido por produto' : 'fixo')
  return parts.join(' · ')
}
