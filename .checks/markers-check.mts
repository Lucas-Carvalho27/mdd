// Os marcadores (Fase 7): sintaxe, escape, espaços, IDs contra o modelo e valores contra o plano.
//   npx tsx --tsconfig tsconfig.web.json .checks/markers-check.mts
import type { GenerationPlan } from '@/domain/generation/generation-plan'
import {
  findMarkers,
  frameCountProblems,
  markerIdProblem,
  markerLabel,
  markerValue
} from '@/domain/pages/markers'

const show = (text: string): void => {
  const found = findMarkers(text)
  const markers = found.markers.map((marker) => `${markerLabel(marker.target)}@${marker.start}-${marker.end}`)
  const problems = found.problems.map((problem) => `${problem.offset}: ${problem.message}`)
  console.log(`${JSON.stringify(text)} → [${markers.join(', ')}]${problems.length ? ` problemas: ${problems.join(' | ')}` : ''}`)
}

console.log('--- sintaxe')
show('Olá {{loja.versao}}!')
show('{{ loja.versao }} e {{produto}}')
show('\\{{loja.versao}} fica literal')
show('{{loja.versao')
show('{{ a {{loja.versao}}')
show('{{Loja.Versao}} {{loja-versao}} {{a.b.c}}')
show('{{contuedo}} {{conteudo}} {{sumario}}')
show('sem marcador { } }} {')

const modelAttributes = new Map([
  ['loja', ['versao']],
  ['mobile', ['plataforma']]
])
console.log('--- IDs')
for (const text of ['{{loja.versao}}', '{{loja.nome}}', '{{carrinho.total}}', '{{conteudo}}', '{{produto}}']) {
  const target = findMarkers(text).markers[0].target
  console.log(`${text}: ${markerIdProblem(target, modelAttributes) ?? 'ok'}`)
}

console.log('--- contagem na moldura')
for (const text of ['<body>{{conteudo}}</body>', '<body></body>', '{{conteudo}}{{conteudo}}{{sumario}}{{sumario}}']) {
  const problems = frameCountProblems(findMarkers(text).markers)
  console.log(`${text} → ${problems.map((problem) => `${problem.offset}: ${problem.message}`).join(' | ') || 'ok'}`)
}

console.log('--- valores')
const plan = {
  productName: 'Loja <Básica>',
  modelName: 'Loja',
  features: [{ id: 'loja', name: 'Loja', attributes: [{ id: 'versao', value: '1.0 & "beta"' }] }],
  root: { featureId: 'loja', fragments: [], children: [] },
  resources: [],
  hasPage: true,
  modelAttributes
} satisfies GenerationPlan
for (const text of ['{{loja.versao}}', '{{produto}}', '\\{{', '{{mobile.plataforma}}', '{{loja.nome}}', '{{sumario}}']) {
  const value = markerValue(findMarkers(text).markers[0].target, plan)
  console.log(`${text} → ${value.ok ? JSON.stringify(value.value) : `problema: ${value.error}`}`)
}
