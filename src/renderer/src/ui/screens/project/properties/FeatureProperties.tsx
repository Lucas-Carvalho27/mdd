import * as cmd from '@/application/editing/commands'
import type { Project } from '@/domain/project/project'
import { findFeature, locateFeature } from '@/domain/feature-model/tree'
import { CommitField } from '@/ui/components/CommitField'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AttributesSection } from './AttributesSection'
import { Field } from './Field'
import { GroupSection } from './GroupSection'

/** Propriedades da feature selecionada (SPEC §7). Cada alteração vira um comando. */
export function FeatureProperties({ project }: { readonly project: Project }): React.JSX.Element {
  const selectedId = useProjectStore((state) => state.selectedFeatureId)
  const run = useProjectStore((state) => state.run)
  const { model } = project
  const feature = selectedId !== null ? findFeature(model.root, selectedId) : undefined
  const location = selectedId !== null ? locateFeature(model.root, selectedId) : undefined
  if (feature === undefined || location === undefined) {
    return <p className="text-sm text-muted-foreground">Selecione uma feature.</p>
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Feature
      </h2>

      {location.kind === 'root' && (
        <Field label="Nome do modelo" htmlFor="model-name">
          <CommitField
            id="model-name"
            value={model.name}
            onCommit={(name) => run(cmd.renameModel(name))}
          />
        </Field>
      )}

      <Field label="Nome" htmlFor="feature-name">
        <CommitField
          id="feature-name"
          value={feature.name}
          onCommit={(name) => run(cmd.renameFeature(feature.id, name))}
        />
      </Field>

      <Field label="ID">
        <p className="text-sm">
          <code>{feature.id}</code>{' '}
          <span className="text-xs text-muted-foreground">gerado na criação; não muda</span>
        </p>
      </Field>

      <Field label="Descrição" htmlFor="feature-description">
        <CommitField
          id="feature-description"
          multiline
          value={feature.description ?? ''}
          placeholder="Opcional (Ctrl+Enter para confirmar)"
          onCommit={(description) => run(cmd.setFeatureDescription(feature.id, description))}
        />
      </Field>

      {location.kind === 'root' && (
        <p className="text-sm text-muted-foreground">A raiz está presente em todo produto.</p>
      )}
      {location.kind === 'solitary' && (
        <Field label="Variabilidade">
          <div className="flex gap-1">
            {(['mandatory', 'optional'] as const).map((variability) => (
              <Button
                key={variability}
                size="sm"
                variant={feature.variability === variability ? 'default' : 'outline'}
                onClick={() => run(cmd.setVariability(feature.id, variability))}
              >
                {variability === 'mandatory' ? '● Obrigatória' : '○ Opcional'}
              </Button>
            ))}
          </div>
        </Field>
      )}
      {location.kind === 'member' && (
        <GroupSection
          parent={location.parent}
          childIndex={location.childIndex}
          memberId={feature.id}
        />
      )}

      <AttributesSection project={project} feature={feature} />
    </section>
  )
}
