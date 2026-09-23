import type { ProjectSession } from '@/application/project-session'
import { printExpression } from '@/domain/expression/printer'
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { FeatureTree } from './FeatureTree'

export function ProjectScreen({
  session
}: {
  readonly session: ProjectSession
}): React.JSX.Element {
  const busy = useProjectStore((state) => state.busy)
  const problems = useProjectStore((state) => state.problems)
  const warnings = useProjectStore((state) => state.warnings)
  const lastSavedAt = useProjectStore((state) => state.lastSavedAt)
  const save = useProjectStore((state) => state.save)
  const close = useProjectStore((state) => state.close)
  const { model, assets, configurations } = session.project

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <div className="flex-1">
          <h1 className="font-semibold">{model.name}</h1>
          <p className="text-xs text-muted-foreground">{session.folder.rootPath}</p>
        </div>
        {lastSavedAt !== null && (
          <span className="text-xs text-muted-foreground">
            Salvo às {lastSavedAt.toLocaleTimeString('pt-BR')}
          </span>
        )}
        <Button variant="outline" onClick={close}>
          Fechar
        </Button>
        <Button disabled={busy} onClick={() => void save()}>
          Salvar
        </Button>
      </header>

      <div className="flex-1 space-y-8 overflow-auto p-6">
        <ProblemList title="Não foi possível salvar" tone="error" problems={problems} />
        <ProblemList title="Avisos" tone="warning" problems={warnings} />

        <Section title="Features">
          <FeatureTree root={model.root} />
        </Section>

        <Section title={`Restrições (${model.constraints.length})`}>
          <ul className="space-y-1 text-sm">
            {model.constraints.map((constraint) => (
              <li key={constraint.id}>
                <code>{printExpression(constraint.expression)}</code>
                {constraint.description && (
                  <span className="text-muted-foreground"> — {constraint.description}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={`Assets (${assets.assets.length})`}>
          <ul className="space-y-1 text-sm">
            {assets.assets.map((asset) => (
              <li key={asset.id}>
                <code>{asset.path}</code> → {asset.anchor}
                {asset.condition && (
                  <span className="text-muted-foreground">
                    {' '}
                    se {printExpression(asset.condition)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={`Configurações (${configurations.length})`}>
          <ul className="space-y-1 text-sm">
            {configurations.map(({ key, configuration }) => (
              <li key={key}>
                {configuration.name}{' '}
                <span className="text-muted-foreground">
                  ({key}.xml, {configuration.decisions.length} decisões)
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </main>
  )
}

function Section({
  title,
  children
}: {
  readonly title: string
  readonly children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}
