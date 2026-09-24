// Geração do produto sobre cópias de docs/examples/loja-online (plano da Fase 5, Tarefa 3;
// casos 11 a 15 das correções da revisão final).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DOMParser, type Element } from '@xmldom/xmldom'
import type { ProjectStorage } from '@/application/ports/project-storage'
import type { XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import {
  GenerateProduct,
  type GenerateProductResult
} from '@/application/use-cases/generate-product'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { WriteProductFolder } from '@/application/use-cases/write-product-folder'
import type { Asset } from '@/domain/assets/asset-catalog'
import type { Configuration } from '@/domain/configuration/configuration'
import { err } from '@/domain/shared/result'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { extractFragmentRoot } from '@/infrastructure/xml/fragment-source'
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import {
  canonical,
  DiskStorage,
  fixedClock,
  freshExample,
  holdOpen,
  NodeXmlValidator,
  productSchemaIssues,
  readProject,
  sameBytes,
  writeFileIn
} from './generation-support.mts'

const log = (label: string, value: unknown): void => console.log(label.padEnd(40), '→', value)
const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const expected = readFileSync('docs/examples/produto-esperado/loja-basica/product.xml', 'utf8')

function generator(
  folder: string,
  storage: ProjectStorage = new DiskStorage(folder),
  at = '2026-09-24T14:03:05.123Z',
  validator: XmlSchemaValidator = new NodeXmlValidator()
) {
  return new GenerateProduct({
    resolveConfiguration: resolver,
    deriver: new XmlProductDeriver(storage, validator),
    writer: new WriteProductFolder(storage, 'saida'),
    clock: fixedClock(at)
  })
}
const summary = (result: GenerateProductResult): string => {
  switch (result.kind) {
    case 'generated':
      return `gerado em ${result.folder} às ${result.generatedAt.toISOString()}`
    case 'needs-confirmation':
      return `precisa confirmar: ${result.folder}`
    case 'problems':
    case 'write-failed':
      return `${result.kind}${'previousAt' in result && result.previousAt ? ` (anterior em ${result.previousAt})` : ''}\n${result.problems
        .map(
          (p) =>
            `${' '.repeat(43)}${p.file}${p.line ? `:${p.line}` : ''}${p.subject ? ` [${p.subject}]` : ''} ${p.message}`
        )
        .join('\n')}`
  }
}
const tree = (folder: string, prefix = ''): string[] =>
  existsSync(folder)
    ? readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? tree(join(folder, entry.name), `${prefix}${entry.name}/`)
          : [`${prefix}${entry.name}`]
      )
    : ['(não existe)']

// 1. loja-basica: equivalente ao esperado, conforme o product.xsd, com o .svg copiado
const a = freshExample('basica')
const projectA = readProject(a)
log('1. gerar loja-basica', summary(await generator(a).execute(projectA, 'loja-basica')))
const product = readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8')
log('   arquivos em saida/', tree(join(a, 'saida')).join(', '))
log('   igual ao esperado (sem espaços)', canonical(product) === canonical(expected))
log('   conforme o product.xsd', (await productSchemaIssues(product)).join(' | ') || 'sim')
log('   generatedAt', /generatedAt="([^"]+)"/.exec(product)?.[1])
log(
  '   .svg idêntico',
  sameBytes(join(a, 'docs/img/pix-fluxo.svg'), join(a, 'saida/loja-basica/docs/img/pix-fluxo.svg'))
)
const intact = [
  'docs/loja/visao-geral.xml',
  'docs/busca/busca.xml',
  'docs/busca/busca-app.xml',
  'docs/pagamento/pix.xml'
].every((path) => {
  const root = extractFragmentRoot(readFileSync(join(a, path), 'utf8'))
  return root.ok && product.includes(root.value)
})
log('   fragmentos intactos no product.xml', intact)
console.log(product.split('\n').slice(0, 12).join('\n'))

// 2. de novo, sem substituir: pede confirmação e não mexe na pasta
const before = readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8')
log(
  '2. gerar de novo',
  summary(await generator(a, undefined, '2026-09-24T15:00:00Z').execute(projectA, 'loja-basica'))
)
log('   pasta intacta', readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8') === before)

// 3. substituir, com restos de uma geração interrompida
writeFileIn(a, 'saida/.loja-basica.tmp/resto.txt', 'x')
writeFileIn(a, 'saida/.loja-basica.old/resto.txt', 'x')
writeFileIn(a, 'saida/loja-basica/a-mao.txt', 'colocado à mão')
log(
  '3. substituir',
  summary(
    await generator(a, undefined, '2026-09-24T15:00:00Z').execute(projectA, 'loja-basica', {
      replace: true
    })
  )
)
log('   arquivos em saida/', tree(join(a, 'saida')).join(', '))
log(
  '   generatedAt',
  /generatedAt="([^"]+)"/.exec(readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8'))?.[1]
)

// 4. pag_boleto selecionado e boleto.xml ausente: falha e não grava nada
const b = freshExample('boleto')
renameSync(join(b, 'docs/pagamento/boleto.xml'), join(b, 'docs/pagamento/boleto-renomeado.xml'))
const comBoleto: Configuration = {
  ...readProject(b).configurations[0].configuration,
  decisions: [
    { featureId: 'busca', state: 'selected' },
    { featureId: 'pag_cartao', state: 'selected' },
    { featureId: 'pag_pix', state: 'selected' },
    { featureId: 'pag_boleto', state: 'selected' }
  ]
}
const projectB = {
  ...readProject(b),
  configurations: [{ key: 'loja-basica', configuration: comBoleto }]
}
log('4. boleto ausente', summary(await generator(b).execute(projectB, 'loja-basica')))
log('   saida/ existe?', existsSync(join(b, 'saida')))

// 5. vários problemas de uma vez: malformado, entidade, codificação e recurso ausente
const c = freshExample('problemas')
writeFileIn(
  c,
  'docs/pagamento/pix.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<topic xmlns="urn:exemplo:doc">\n  <title>PIX\n</topic>\n'
)
writeFileIn(
  c,
  'docs/busca/busca.xml',
  '<?xml version="1.0"?>\n<!DOCTYPE topic SYSTEM "topic.dtd">\n<topic>\n  <p>Busca&nbsp;rápida</p>\n</topic>\n'
)
writeFileIn(
  c,
  'docs/loja/visao-geral.xml',
  '<?xml version="1.0" encoding="ISO-8859-1"?>\n<topic/>\n'
)
renameSync(join(c, 'docs/img/pix-fluxo.svg'), join(c, 'docs/img/outro.svg'))
log('5. vários problemas', summary(await generator(c).execute(readProject(c), 'loja-basica')))
log('   saida/ existe?', existsSync(join(c, 'saida')))

// 6. fragmento sem namespace, com DOCTYPE e comentários antes da raiz
const d = freshExample('sem-namespace')
writeFileIn(
  d,
  'docs/busca/busca-app.xml',
  '\u{FEFF}<?xml version="1.0" encoding="utf-8"?>\r\n<!-- cabeçalho -->\r\n<!DOCTYPE topic [\r\n  <!ELEMENT topic ANY>\r\n]>\r\n<topic id="app">\r\n  <pre>  linha 1\r\n    linha 2</pre>\r\n</topic>\r\n<!-- fim -->\r\n'
)
log('6. sem namespace', summary(await generator(d).execute(readProject(d), 'loja-basica')))
const productD = readFileSync(join(d, 'saida/loja-basica/product.xml'), 'utf8')
const fragmentD = [
  ...productD.matchAll(/<fragment asset="doc_busca_app"[^>]*>\r?\n(.*?)\r?\n\s*<\/fragment>/gs)
][0]?.[1]
log('   o fragmento no product.xml', JSON.stringify(fragmentD))
const topics = new DOMParser().parseFromString(productD, 'text/xml').getElementsByTagName('topic')
const appTopic = Array.from(topics).find(
  (t) => (t as Element).getAttribute('id') === 'app'
) as Element
log('   namespace do <topic> embutido', JSON.stringify(appTopic.namespaceURI))
log('   conforme o product.xsd', (await productSchemaIssues(productD)).join(' | ') || 'sim')

// 7. a troca falha: a pasta anterior volta para o lugar
const e = freshExample('troca')
await generator(e).execute(readProject(e), 'loja-basica')
const disk = new DiskStorage(e)
let renames = 0
const failingPlace: ProjectStorage = Object.assign(Object.create(disk), {
  rename: async (from: string, to: string) =>
    ++renames === 2
      ? err({ code: 'io' as const, message: 'falha simulada' })
      : disk.rename(from, to)
})
log(
  '7. troca falha',
  summary(
    await generator(e, failingPlace).execute(readProject(e), 'loja-basica', { replace: true })
  )
)
log('   arquivos em saida/', tree(join(e, 'saida')).join(', '))

// 8. a troca e a volta falham: a mensagem diz onde ficou a anterior
renames = 0
const failingBoth: ProjectStorage = Object.assign(Object.create(disk), {
  rename: async (from: string, to: string) =>
    ++renames >= 2 ? err({ code: 'io' as const, message: 'falha simulada' }) : disk.rename(from, to)
})
log(
  '8. troca e volta falham',
  summary(await generator(e, failingBoth).execute(readProject(e), 'loja-basica', { replace: true }))
)
log('   arquivos em saida/', tree(join(e, 'saida')).join(', '))

// 9. um arquivo da pasta aberto em outro programa (a trava do Windows)
const f = freshExample('trava')
await generator(f).execute(readProject(f), 'loja-basica')
const antes = readFileSync(join(f, 'saida/loja-basica/product.xml'), 'utf8')
const holder = await holdOpen(join(f, 'saida/loja-basica/product.xml'))
log(
  '9. arquivo aberto',
  summary(
    await generator(f, undefined, '2026-09-24T16:00:00Z').execute(readProject(f), 'loja-basica', {
      replace: true
    })
  )
)
holder.kill()
log('   arquivos em saida/', tree(join(f, 'saida')).join(', '))
log(
  '   product.xml anterior intacto',
  readFileSync(join(f, 'saida/loja-basica/product.xml'), 'utf8') === antes
)

// 10. configuração que não existe mais / incompleta
log('10. chave inexistente', summary(await generator(a).execute(projectA, 'nao-existe')))
const incompleta = {
  ...projectA,
  configurations: [
    {
      key: 'loja-basica',
      configuration: { ...projectA.configurations[0].configuration, decisions: [] }
    }
  ]
}
log('    incompleta', summary(await generator(a).execute(incompleta, 'loja-basica')))

// 11. depois do caso 8 (a troca e a volta falharam), com um arquivo posto à mão na .old: a
// versão anterior volta para o lugar antes da pergunta, e nada é apagado
writeFileIn(e, 'saida/.loja-basica.old/a-mao.txt', 'colocado à mão')
log(
  '11. gerar depois da falha',
  summary(
    await generator(e, undefined, '2026-09-24T17:00:00Z').execute(readProject(e), 'loja-basica')
  )
)
log('    arquivos em saida/', tree(join(e, 'saida')).join(', '))
log(
  '    substituir',
  summary(
    await generator(e, undefined, '2026-09-24T17:00:00Z').execute(readProject(e), 'loja-basica', {
      replace: true
    })
  )
)
log('    arquivos em saida/', tree(join(e, 'saida')).join(', '))

// 12. o app caiu entre as duas trocas, e a volta da .old falha: a geração para sem apagar nada
renameSync(join(e, 'saida/loja-basica'), join(e, 'saida/.loja-basica.old'))
writeFileIn(e, 'saida/.loja-basica.tmp/product.xml', '<product/>')
const failingRecovery: ProjectStorage = Object.assign(Object.create(disk), {
  rename: async () => err({ code: 'io' as const, message: 'falha simulada' })
})
log(
  '12. a volta da .old falha',
  summary(await generator(e, failingRecovery).execute(readProject(e), 'loja-basica'))
)
log('    arquivos em saida/', tree(join(e, 'saida')).join(', '))

// 13. fragmento em Latin-1, sem declaração de codificação: recusado na linha do "ã"
const g = freshExample('latin1')
writeFileSync(
  join(g, 'docs/busca/busca.xml'),
  Buffer.from('<topic>\n  <title>Busca</title>\n  <p>Visão geral</p>\n</topic>\n', 'latin1')
)
log('13. fragmento em Latin-1', summary(await generator(g).execute(readProject(g), 'loja-basica')))
log('    saida/ existe?', existsSync(join(g, 'saida')))

// 14. a gravação de um arquivo do produto falha: o problema aponta o caminho no projeto
const h = freshExample('gravacao')
const diskH = new DiskStorage(h)
const failingWrite: ProjectStorage = Object.assign(Object.create(diskH), {
  writeText: async () => err({ code: 'io' as const, message: 'disco cheio' })
})
log(
  '14. gravação falha',
  summary(await generator(h, failingWrite).execute(readProject(h), 'loja-basica'))
)
log('    arquivos em saida/', tree(join(h, 'saida')).join(', '))

// 15. muitos fragmentos: no máximo 4 conferências ao mesmo tempo, e os problemas na ordem do
// plano (o 2 passa pelo xmllint e demora mais que o 9, que falta)
const k = freshExample('muitos')
const extras = Array.from({ length: 10 }, (_, index): Asset => {
  const number = String(index + 1).padStart(2, '0')
  return {
    id: `extra_${number}`,
    kind: 'fragment',
    path: `docs/extra/extra-${number}.xml`,
    anchor: 'loja'
  }
})
for (const asset of extras) {
  if (asset.id === 'extra_09') continue
  writeFileIn(
    k,
    asset.path,
    asset.id === 'extra_02' ? '<topic>\n  <p>aberto\n</topic>\n' : `<topic id="${asset.id}"/>\n`
  )
}
const projectK = readProject(k)
const manyFragments = {
  ...projectK,
  assets: { assets: [...projectK.assets.assets, ...extras] }
}
const plainValidator = new NodeXmlValidator()
let inFlight = 0
let mostInFlight = 0
const countingValidator: XmlSchemaValidator = {
  async validate(schema, fileName, content) {
    mostInFlight = Math.max(mostInFlight, ++inFlight)
    const issues = await plainValidator.validate(schema, fileName, content)
    inFlight--
    return issues
  }
}
log(
  '15. 14 fragmentos',
  summary(
    await generator(k, undefined, undefined, countingValidator).execute(
      manyFragments,
      'loja-basica'
    )
  )
)
log('    conferências ao mesmo tempo', mostInFlight)
for (const asset of extras) {
  if (asset.id === 'extra_02') writeFileIn(k, asset.path, '<topic/>\n')
  if (asset.id === 'extra_09') writeFileIn(k, asset.path, '<topic/>\n')
}
mostInFlight = 0
log(
  '    corrigidos',
  summary(
    await generator(k, undefined, undefined, countingValidator).execute(
      manyFragments,
      'loja-basica'
    )
  )
)
log('    conferências ao mesmo tempo', mostInFlight)
const productK = readFileSync(join(k, 'saida/loja-basica/product.xml'), 'utf8')
log(
  '    ordem no product.xml',
  [...productK.matchAll(/<fragment asset="([^"]+)"/g)].map((match) => match[1]).join(' ')
)
