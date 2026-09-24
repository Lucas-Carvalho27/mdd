import { cn } from 'cn'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { findFeature } from '@/domain/feature-model/tree'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { decisionLabel, describeOrphan } from './configuration-texts'

/**
 * Faixas acima do diagrama (SPEC §7): modelo vazio, decisões em conflito (com a ação de
 * remover cada uma), referências órfãs (com a ação de remover todas) e valores inválidos.
 */
export function ConfigurationProblems({
  model
}: {
  readonly model: FeatureModel
}): React.JSX.Element | null {
  const resolution = useProjectStore((state) => state.openResolution())
  const removeDecision = useProjectStore((state) => state.removeDecision)
  const removeOrphanReferences = useProjectStore((state) => state.removeOrphanReferences)
  const removeAttributeValue = useProjectStore((state) => state.removeAttributeValue)
  if (resolution === null) return null
  const nameOf = (featureId: string): string =>
    findFeature(model.root, featureId)?.name ?? featureId

  return (
    <>
      {resolution.kind === 'empty-model' && (
        <Banner id="empty-model" tone="error" title="O modelo não admite nenhum produto">
          <p>As regras do modelo se contradizem. Corrija-as na aba Modelo.</p>
        </Banner>
      )}
      {resolution.kind === 'conflict' && (
        <Banner id="conflict" tone="error" title="As decisões manuais se contradizem">
          <p>Remova decisões até a configuração voltar a ser válida:</p>
          <ul className="space-y-1">
            {resolution.decisions.map(({ featureId, state }) => (
              <li key={featureId} className="flex items-center gap-2">
                <span className="flex-1">
                  {nameOf(featureId)} — {decisionLabel(state)}
                </span>
                <Button size="xs" variant="outline" onClick={() => removeDecision(featureId)}>
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        </Banner>
      )}
      {resolution.orphans.length > 0 && (
        <Banner
          id="orphans"
          tone="warning"
          title="Configuração desatualizada: há referências ao que não existe mais no modelo"
        >
          <ul className="ml-4 list-disc">
            {resolution.orphans.map((orphan, index) => (
              <li key={index}>{describeOrphan(orphan)}</li>
            ))}
          </ul>
          <Button size="sm" variant="outline" onClick={removeOrphanReferences}>
            Remover referências órfãs
          </Button>
        </Banner>
      )}
      {resolution.invalidValues.length > 0 && (
        <Banner id="invalid-values" tone="warning" title="Valores de atributos inválidos">
          <ul className="space-y-1">
            {resolution.invalidValues.map(({ value, message }) => (
              <li
                key={`${value.featureId}.${value.attributeId}`}
                className="flex items-center gap-2"
              >
                <span className="flex-1">
                  {nameOf(value.featureId)} › {value.attributeId} = “{value.value}”: {message}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => removeAttributeValue(value.featureId, value.attributeId)}
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        </Banner>
      )}
    </>
  )
}

interface BannerProps {
  readonly id: string
  readonly tone: 'error' | 'warning'
  readonly title: string
  readonly children: React.ReactNode
}

function Banner({ id, tone, title, children }: BannerProps): React.JSX.Element {
  return (
    <section
      data-banner={id}
      className={cn(
        'space-y-2 rounded-md border p-3 text-sm',
        tone === 'error'
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50'
      )}
    >
      <h3 className="font-medium">{title}</h3>
      {children}
    </section>
  )
}
