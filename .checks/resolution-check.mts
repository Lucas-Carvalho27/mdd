// Resolução de configurações sobre docs/examples/loja-online (plano da Fase 3, Tarefa 1).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/resolution-check.mts
import { readFileSync } from 'node:fs'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import type { Configuration } from '@/domain/configuration/configuration'
import { configurationStatus, type Resolution } from '@/domain/configuration/resolution'
import type { Feature, FeatureModel } from '@/domain/feature-model/feature-model'
import { parseExpression } from '@/domain/expression/parser'
import { deleteFeature } from '@/domain/project/feature-deletion'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'

const read = (path: string) =>
  parseXmlRoot(readFileSync(`docs/examples/loja-online/${path}`, 'utf8'))
const decodedModel = decodeFeatureModel(read('model.xml'))
const decodedConfiguration = decodeConfiguration(read('configurations/loja-basica.xml'))
if (!decodedModel.ok || !decodedConfiguration.ok) throw new Error('o exemplo não abriu')
const model = decodedModel.value
const basica = decodedConfiguration.value
const log = (label: string, value: unknown): void => console.log(label.padEnd(30), '→', value)

const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const mark = { selected: '+', deselected: '-' }
const show = (resolution: Resolution): string => {
  const status = configurationStatus(resolution)
  const head = `${resolution.kind} | válida ${status.valid} | completa ${status.complete} | desatualizada ${status.stale}`
  if (resolution.kind !== 'resolved') return head
  const features = [...resolution.features]
    .map(([id, s]) =>
      s.kind === 'undecided'
        ? `${id}?`
        : `${id}${mark[s.state]}${s.kind === 'propagated' ? '🔒' : ''}`
    )
    .join(' ')
  return `${head} | indecisas ${status.undecidedCount} | sem valor ${status.missingValueCount}\n${' '.repeat(33)}${features}`
}
const withDecisions = (c: Configuration, decisions: Configuration['decisions']): Configuration => ({
  ...c,
  decisions
})

// 1. loja-basica abre completa, com mobile selecionada por propagação
const r1 = resolver.execute(model, basica)
log('loja-basica', show(r1))
log('mesma resolução no cache', resolver.execute(model, basica) === r1)

// 2. sem a decisão de pag_pix, mobile fica indecisa
const semPix = withDecisions(
  basica,
  basica.decisions.filter((d) => d.featureId !== 'pag_pix')
)
log('sem a decisão de pag_pix', show(resolver.execute(model, semPix)))

// 3. excluir pag_pix no modelo: a configuração fica desatualizada, com a referência órfã
const deleted = deleteFeature(model, { assets: [] }, 'pag_pix')
if (!deleted.ok) throw new Error(deleted.error)
const r3 = resolver.execute(deleted.value.model, basica)
log('pag_pix excluída do modelo', show(r3))
log(
  'órfãs',
  r3.orphans
    .map((o) => (o.kind === 'decision' ? `decisão ${o.decision.featureId}` : o.reason))
    .join(', ')
)

// 4. conflito: pag_pix selecionada e mobile desselecionada
const conflito = withDecisions(basica, [
  ...basica.decisions,
  { featureId: 'mobile', state: 'deselected' }
])
const r4 = resolver.execute(model, conflito)
log('pag_pix + não mobile', show(r4))
log(
  'decisões para remover',
  r4.kind === 'conflict' ? r4.decisions.map((d) => `${d.featureId}:${d.state}`).join(' ') : '-'
)

// 5. modelo vazio: uma restrição que nenhum produto satisfaz
const expression = parseExpression('not catalogo')
if (!expression.ok) throw new Error('expressão')
const vazio: FeatureModel = {
  ...model,
  constraints: [...model.constraints, { id: 'c2', expression: expression.value }]
}
log('modelo vazio', show(resolver.execute(vazio, basica)))

// 6. valores de atributos: inválido, e atributo sem valor nem default
const valores: Configuration = {
  ...basica,
  values: [
    { featureId: 'busca', attributeId: 'max_resultados', value: 'abc' },
    { featureId: 'loja', attributeId: 'versao', value: '2.0' }
  ]
}
const r6 = resolver.execute(model, valores)
log('valores', show(r6))
log(
  'inválidos',
  r6.invalidValues
    .map((i) => `${i.value.featureId}.${i.value.attributeId}: ${i.message}`)
    .join('; ')
)
log(
  'órfãs (atributo fixo)',
  r6.orphans
    .map((o) =>
      o.kind === 'value' ? `${o.value.featureId}.${o.value.attributeId} ${o.reason}` : ''
    )
    .join('; ')
)
log(
  'sem valor',
  r6.kind === 'resolved'
    ? r6.missingValues.map((m) => `${m.featureId}.${m.attributeId}`).join(' ')
    : '-'
)

// 7. grupo [2..2]: escolher uma deixa as outras decididas
const pagamento = model.root.children[3]
if (pagamento.kind !== 'feature' || pagamento.feature.children[0].kind !== 'group')
  throw new Error('forma')
const group = pagamento.feature.children[0].group
const dois: FeatureModel = {
  ...model,
  constraints: [],
  root: {
    ...model.root,
    children: model.root.children.map((child, index) =>
      index === 3 && child.kind === 'feature'
        ? {
            kind: 'feature',
            feature: {
              ...child.feature,
              children: [{ kind: 'group', group: { ...group, min: 2, max: 2 } }]
            }
          }
        : child
    )
  }
}
const r7 = resolver.execute(dois, {
  name: 'x',
  decisions: [{ featureId: 'pag_boleto', state: 'deselected' }],
  values: []
})
log('grupo [2..2] sem boleto', show(r7))

// 8. desempenho: modelo sintético de 321 features
let next = 0
const leaf = (): Feature => ({ id: `f${next++}`, name: 'F', attributes: [], children: [] })
const branch = (children: Feature[], variability?: 'mandatory' | 'optional'): Feature => ({
  ...leaf(),
  ...(variability ? { variability } : {}),
  children: children.map((feature) => ({ kind: 'feature', feature }))
})
const optional = (feature: Feature): Feature => ({ ...feature, variability: 'optional' })
const areas = Array.from({ length: 10 }, () => {
  const members = Array.from({ length: 5 }, () => ({
    ...leaf(),
    children: Array.from({ length: 4 }, () => ({
      kind: 'feature' as const,
      feature: optional(leaf())
    }))
  }))
  const extras = Array.from({ length: 2 }, () =>
    optional(branch([optional(leaf()), optional(leaf())]))
  )
  return {
    ...leaf(),
    variability: 'mandatory' as const,
    children: [
      { kind: 'group' as const, group: { min: 1, max: 2, members } },
      ...extras.map((feature) => ({ kind: 'feature' as const, feature }))
    ]
  }
})
const big: FeatureModel = {
  name: 'Grande',
  root: {
    id: 'raiz',
    name: 'Raiz',
    attributes: [],
    children: areas.map((feature) => ({ kind: 'feature', feature }))
  },
  constraints: []
}
const decisions = ['f1', 'f7', 'f40', 'f80', 'f120', 'f200', 'f250', 'f300'].map((featureId) => ({
  featureId,
  state: 'selected' as const
}))
const bigResolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const times: number[] = []
for (let i = 0; i < 5; i++) {
  const started = performance.now()
  bigResolver.execute(big, { name: `x${i}`, decisions, values: [] })
  times.push(performance.now() - started)
}
const bigResolution = bigResolver.execute(big, { name: 'x0', decisions, values: [] })
const bigStatus = configurationStatus(bigResolution)
log(
  'modelo grande',
  `${bigResolution.kind === 'resolved' ? bigResolution.features.size : 0} features | indecisas ${bigStatus.undecidedCount}`
)
log('tempo por resolução (ms)', times.map((t) => Math.round(t)).join(' '))
