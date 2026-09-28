// Plano de geração sobre docs/examples/loja-online (plano da Fase 5, Tarefa 1).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/generation-plan-check.mts
import { readFileSync } from 'node:fs'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import type { Configuration } from '@/domain/configuration/configuration'
import { evaluateExpression } from '@/domain/expression/evaluator'
import { parseExpression } from '@/domain/expression/parser'
import { planGeneration, type PlannedSection } from '@/domain/generation/generation-plan'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'

const read = (path: string) =>
  parseXmlRoot(readFileSync(`docs/examples/loja-online/${path}`, 'utf8'))
const decodedModel = decodeFeatureModel(read('model.xml'))
const decodedAssets = decodeAssetCatalog(read('assets.xml'))
const decodedConfiguration = decodeConfiguration(read('configurations/loja-basica.xml'))
if (!decodedModel.ok || !decodedAssets.ok || !decodedConfiguration.ok) {
  throw new Error('o exemplo não abriu')
}
const model = decodedModel.value
const catalog = decodedAssets.value
const basica = decodedConfiguration.value
const log = (label: string, value: unknown): void => console.log(label.padEnd(32), '→', value)
const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const plan = (configuration: Configuration) =>
  planGeneration(model, catalog, configuration, resolver.execute(model, configuration))
const sections = (section: PlannedSection, depth = 0): string[] => [
  `${'  '.repeat(depth)}${section.featureId}${section.fragments.map((a) => ` [${a.id}]`).join('')}`,
  ...section.children.flatMap((child) => sections(child, depth + 1))
]

// 1. loja-basica: as features, os atributos, as seções e os recursos
const p1 = plan(basica)
if (!p1.ok) throw new Error(p1.error)
log('produto', `${p1.value.productName} | modelo ${p1.value.modelName}`)
for (const feature of p1.value.features) {
  const attributes = feature.attributes.map((a) => `${a.id}=${a.value}`).join(' ')
  log(`  feature ${feature.id}`, `${feature.name}${attributes === '' ? '' : ` | ${attributes}`}`)
}
for (const line of sections(p1.value.root)) console.log(`  seção ${line}`)
log('recursos', p1.value.resources.map((a) => `${a.id} ${a.path}`).join(', '))

// 2. busca sem mobile: doc_busca_app (condição "busca and mobile") fica de fora
const semMobile: Configuration = {
  ...basica,
  decisions: [
    { featureId: 'busca', state: 'selected' },
    { featureId: 'mobile', state: 'deselected' },
    { featureId: 'pag_cartao', state: 'selected' },
    { featureId: 'pag_pix', state: 'deselected' },
    { featureId: 'pag_boleto', state: 'selected' }
  ],
  values: [{ featureId: 'busca', attributeId: 'max_resultados', value: '100' }]
}
const p2 = plan(semMobile)
if (!p2.ok) throw new Error(p2.error)
log(
  'sem mobile: seções',
  sections(p2.value.root)
    .map((line) => line.trim())
    .join(' | ')
)
log('sem mobile: recursos', p2.value.resources.length)
log('sem mobile: atributos da busca', p2.value.features.find((f) => f.id === 'busca')?.attributes)

// 3. configuração incompleta é recusada
const incompleta: Configuration = { ...basica, decisions: basica.decisions.slice(1) }
const p3 = plan(incompleta)
log('incompleta', p3.ok ? 'aceita (ERRADO)' : p3.error)

// 4. mesmo caminho em dois recursos: copiado uma vez só
const dobrado = {
  assets: [
    ...catalog.assets,
    { ...catalog.assets.find((a) => a.id === 'img_pix')!, id: 'img_pix_2', anchor: 'loja' }
  ]
}
const p4 = planGeneration(model, dobrado, basica, resolver.execute(model, basica))
log('recurso repetido', p4.ok ? p4.value.resources.map((a) => a.id).join(', ') : p4.error)

// 5. o avaliador de expressões
const verdade = new Set(['a', 'b'])
for (const source of [
  'a and b',
  'a and c',
  'a or c',
  'not c',
  'c implies a',
  'a implies c',
  'a iff b',
  'a iff c',
  'true and not false',
  'not (a and c) and (c or b)'
]) {
  const parsed = parseExpression(source)
  if (!parsed.ok) throw new Error(source)
  log(`  ${source}`, evaluateExpression(parsed.value, verdade))
}
