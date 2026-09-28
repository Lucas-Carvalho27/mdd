// A página montada (Fase 7), num projeto pequeno em memória: moldura, seções, sumário,
// marcadores, caminhos, CSS e JS automáticos, cópias e os problemas da geração.
//   npx tsx --tsconfig tsconfig.web.json .checks/html-page-check.mts
import { CombinedProductDeriver } from '@/application/generation/combined-product-deriver'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import type { Configuration } from '@/domain/configuration/configuration'
import { planGeneration } from '@/domain/generation/generation-plan'
import { HtmlPageDeriver } from '@/infrastructure/html/html-page-deriver'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import { NodeXmlValidator } from './generation-support.mts'
import { memoryFolder } from './memory-folder.mts'

const model = decodeFeatureModel(
  parseXmlRoot(`<featureModel xmlns="urn:mdd:feature-model" schemaVersion="1" name="Loja">
  <feature id="loja" name="Loja &amp; Cia">
    <attribute id="versao" name="Versão" type="string" default="1.0"/>
    <feature id="busca" name="Busca" variability="optional"/>
    <feature id="tema_escuro" name="Tema escuro" variability="optional">
      <attribute id="cor" name="Cor" type="string" default="#222"/>
    </feature>
    <feature id="mobile" name="Mobile" variability="optional">
      <attribute id="plataforma" name="Plataforma" type="string" default="android"/>
    </feature>
  </feature>
</featureModel>`)
)
const assetsXml = (extra: string): string => `<assets xmlns="urn:mdd:assets" schemaVersion="1">
  <asset id="doc_loja" kind="fragment" path="docs/loja.html" anchor="loja"/>
  <asset id="site_css" kind="resource" path="css/site.css" anchor="loja"/>
  <asset id="app_js" kind="resource" path="js/app.js" anchor="loja"/>
  <asset id="doc_xml" kind="fragment" path="docs/topico.xml" anchor="loja"/>
  <asset id="doc_busca" kind="fragment" path="docs/busca/busca.html" anchor="busca"/>
  <asset id="escuro_css" kind="resource" path="css/escuro.css" anchor="tema_escuro"/>
  <asset id="doc_mobile" kind="fragment" path="docs/mobile.html" anchor="mobile"/>${extra}
</assets>`
if (!model.ok) throw new Error('modelo')

const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const configuration: Configuration = {
  name: 'Loja <Escura>',
  decisions: [
    { featureId: 'busca', state: 'selected' },
    { featureId: 'tema_escuro', state: 'selected' },
    { featureId: 'mobile', state: 'deselected' }
  ],
  values: [{ featureId: 'tema_escuro', attributeId: 'cor', value: '#000' }]
}

async function derive(files: Record<string, string>, extraAssets = '', config = configuration) {
  const assets = decodeAssetCatalog(parseXmlRoot(assetsXml(extraAssets)))
  if (!assets.ok || !model.ok) throw new Error('assets')
  const plan = planGeneration(
    model.value,
    assets.value,
    config,
    resolver.execute(model.value, config)
  )
  if (!plan.ok) throw new Error(plan.error)
  const { storage } = memoryFolder(files)
  const deriver = new CombinedProductDeriver([
    new XmlProductDeriver(storage, new NodeXmlValidator()),
    new HtmlPageDeriver(storage)
  ])
  return deriver.derive(plan.value, new Date('2026-09-28T12:00:00Z'))
}

const base: Record<string, string> = {
  'moldura.html': `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>{{produto}} — v{{loja.versao}}</title>
<link rel="stylesheet" href="css/site.css">
</head>
<body>
<header><a href="docs/guia.pdf?v=2#p3">Guia</a> <img src="img/logo.png" srcset="img/logo.png 1x, img/logo@2x.png 2x" alt=""></header>
{{sumario}}
{{conteudo}}
<footer>\\{{ literal }} · <a href="https://exemplo.com">site</a> · <a href="#busca">busca</a></footer>
</body>
</html>
`,
  'docs/loja.html':
    '\n\n<h2>Bem-vindo à {{ produto }}</h2>\n<p title="v{{loja.versao}}">Versão {{loja.versao}} &amp; mais.</p>\n<pre>\n  recuo\n</pre>\n\n',
  'docs/busca/busca.html':
    '<h3>Busca</h3>\n<img src="../../img/lupa.svg" alt="lupa">\n<style>.busca { color: {{tema_escuro.cor}} }</style>\n',
  'docs/mobile.html': '<p>{{mobile.plataforma}}</p>\n',
  'docs/topico.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<topic><title>XML</title></topic>\n',
  'css/site.css': 'body {}',
  'css/escuro.css': 'body { background: black }',
  'js/app.js': '',
  'docs/guia.pdf': '%PDF',
  'img/logo.png': 'png',
  'img/logo@2x.png': 'png',
  'img/lupa.svg': '<svg/>'
}

const show = (name: string, result: Awaited<ReturnType<typeof derive>>): void => {
  console.log(`=== ${name}`)
  if (!result.ok) {
    for (const problem of result.error) {
      console.log(
        `  ${problem.file}${problem.line ? `:${problem.line}` : ''} [${problem.subject ?? ''}] ${problem.message}`
      )
    }
    return
  }
  for (const file of result.value) {
    console.log(`  ${file.kind} ${file.path}`)
    if (file.kind === 'text' && file.path === 'index.html') {
      const lines = file.content.split('\n')
      console.log(lines.map((line) => (line === '' ? '    |' : `    | ${line}`)).join('\n'))
    }
  }
}

show('página com moldura', await derive(base))

const withoutFrame = { ...base }
delete withoutFrame['moldura.html']
const plain = await derive(withoutFrame)
show('sem moldura (a padrão)', plain)

show(
  'problemas',
  await derive(
    {
      ...base,
      'moldura.html': base['moldura.html'].replace(
        '<footer>',
        '<footer>{{mobile.plataforma}} <a href="/sobre.html">sobre</a>'
      ),
      'docs/loja.html':
        '<div>\n<p>{{loja.nome}}</p>\n<img src="img/falta.png">\n<a href="../../fora.html">fora</a>\n<a href="../index.html">início</a>\n',
      'docs/busca/busca.html': '<style>.busca { color: {{tema_escuro.cor}} }</style>\n',
      'index.html': '<p>index do projeto</p>'
    },
    '',
    {
      ...configuration,
      values: [{ featureId: 'tema_escuro', attributeId: 'cor', value: 'a</style><script>' }]
    }
  )
)

show(
  'recurso chamado index.html',
  await derive(
    { ...base, 'index.html': '<p>x</p>' },
    '\n  <asset id="index" kind="resource" path="index.html" anchor="loja"/>'
  )
)
show(
  'fragmento ausente',
  await derive({ ...base, 'docs/busca/busca.html': undefined as unknown as string })
)
