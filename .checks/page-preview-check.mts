// A página da visualização (Fase 8) sobre uma cópia do herby: igual à página gerada, com o
// texto do editor, com problemas (a página sai assim mesmo), incompleta, sem página e com a
// moldura padrão.
//   npx tsx --tsconfig tsconfig.web.json .checks/page-preview-check.mts
import { cpSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { PagePreviewHost } from '@/application/ports/page-preview-host'
import { PreviewPage } from '@/application/use-cases/preview-page'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import type { Project } from '@/domain/project/project'
import { HtmlPageDeriver } from '@/infrastructure/html/html-page-deriver'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { DiskStorage } from './generation-support.mts'

function copyOf(example: string, name: string): string {
  const folder = resolve('.checks/geracao', name)
  rmSync(folder, { recursive: true, force: true })
  cpSync(`docs/examples/${example}`, folder, { recursive: true })
  return folder
}

function readProject(folder: string): Project {
  const read = (path: string) => parseXmlRoot(readFileSync(join(folder, path), 'utf8'))
  const model = decodeFeatureModel(read('model.xml'))
  const assets = decodeAssetCatalog(read('assets.xml'))
  if (!model.ok || !assets.ok) throw new Error('o exemplo não abriu')
  const configurations = readdirSync(join(folder, 'configurations')).map((name) => {
    const decoded = decodeConfiguration(read(`configurations/${name}`))
    if (!decoded.ok) throw new Error(`${name} não abriu`)
    return { key: name.slice(0, -'.xml'.length), configuration: decoded.value }
  })
  return { model: model.value, assets: assets.value, configurations }
}

/** O main de mentira: guarda a última página entregue. */
const shown: string[] = []
const host: PagePreviewHost = {
  address: 'mdd-page://pagina/index.html',
  show: async (html) => void shown.push(html)
}
const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const previewIn = (folder: string): PreviewPage =>
  new PreviewPage({
    resolveConfiguration: resolver,
    previewer: new HtmlPageDeriver(new DiskStorage(folder)),
    host
  })
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const describe = (result: Awaited<ReturnType<PreviewPage['execute']>>): string =>
  result.kind === 'page'
    ? `página em ${result.address}, moldura padrão: ${result.defaultFrame ? 'sim' : 'não'}, ${result.problems.length} problema(s)`
    : result.kind

const herby = copyOf('herby', 'visualizacao-herby')
const project = readProject(herby)
const preview = previewIn(herby)
const expected = readFileSync(
  'docs/examples/produto-esperado/herby-completa-atibaia/index.html',
  'utf8'
)
const PLATAFORMA = 'fragmentos/plataforma.html'
const original = readFileSync(join(herby, PLATAFORMA), 'utf8')

console.log('— a configuração da aceitação')
log('completa-atibaia', describe(await preview.execute(project, 'completa-atibaia', new Map())))
log('igual à página gerada', shown.at(-1) === expected ? 'sim' : 'NÃO')

console.log('— o texto do editor, sem salvar')
const edited = original.replace('Como funciona', 'Como funciona (editado no app)')
log(
  'resultado',
  describe(await preview.execute(project, 'completa-atibaia', new Map([[PLATAFORMA, edited]])))
)
log(
  'a página tem o texto editado',
  shown.at(-1)?.includes('Como funciona (editado no app)') ? 'sim' : 'NÃO'
)
log(
  'o disco continua igual',
  readFileSync(join(herby, PLATAFORMA), 'utf8') === original ? 'sim' : 'NÃO'
)

console.log('— com problemas, a página sai assim mesmo')
const broken = original.replace(
  '<h2>{{herby.produto}}</h2>',
  '<h2>{{herby.nada}}</h2>\n<div class="aberto">'
)
const withProblems = await preview.execute(
  project,
  'completa-atibaia',
  new Map([[PLATAFORMA, broken]])
)
log('resultado', describe(withProblems))
if (withProblems.kind === 'page') {
  for (const problem of withProblems.problems) {
    log(`   ${problem.file}:${problem.line}`, problem.message)
  }
}
log(
  'o marcador fica como está escrito',
  shown.at(-1)?.includes('<h2>{{herby.nada}}</h2>') ? 'sim' : 'NÃO'
)
log('o resto da página continua', shown.at(-1)?.includes('Acesso à Plataforma') ? 'sim' : 'NÃO')

console.log('— sem página')
const incomplete = {
  ...project,
  configurations: [
    ...project.configurations,
    { key: 'vazia', configuration: { name: 'Vazia', decisions: [], values: [] } }
  ]
}
log('configuração incompleta', describe(await preview.execute(incomplete, 'vazia', new Map())))
log('nenhuma configuração aberta', describe(await preview.execute(project, null, new Map())))
const loja = copyOf('loja-online', 'visualizacao-loja')
log(
  'loja-online (sem fragmento HTML)',
  describe(await previewIn(loja).execute(readProject(loja), 'loja-basica', new Map()))
)

console.log('— a moldura padrão')
rmSync(join(herby, 'moldura.html'))
log('sem moldura.html', describe(await preview.execute(project, 'completa-atibaia', new Map())))
log('a página começa com', JSON.stringify(shown.at(-1)?.split('\n').slice(0, 6).join(' ')))
log(
  'moldura.html nova, só no editor',
  describe(
    await preview.execute(
      project,
      'completa-atibaia',
      new Map([
        [
          'moldura.html',
          '<!doctype html><html><head></head><body><main>{{conteudo}}</main></body></html>'
        ]
      ])
    )
  )
)
