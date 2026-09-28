// Gera uma configuração do exemplo herby numa cópia em .checks/geracao/herby, pelo mesmo
// caminho do app (GenerateProduct com o product.xml e a página), e mostra o resultado.
//   npx tsx --tsconfig tsconfig.web.json .checks/herby-generate.mts [configuração]
import { cpSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CombinedProductDeriver } from '@/application/generation/combined-product-deriver'
import { GenerateProduct } from '@/application/use-cases/generate-product'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { WriteProductFolder } from '@/application/use-cases/write-product-folder'
import { HtmlPageDeriver } from '@/infrastructure/html/html-page-deriver'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import { DiskStorage, NodeXmlValidator } from './generation-support.mts'

const key = process.argv[2] ?? 'completa-atibaia'
const folder = resolve('.checks/geracao/herby')
rmSync(folder, { recursive: true, force: true })
cpSync('docs/examples/herby', folder, { recursive: true })

const read = (path: string) => parseXmlRoot(readFileSync(join(folder, path), 'utf8'))
const model = decodeFeatureModel(read('model.xml'))
const assets = decodeAssetCatalog(read('assets.xml'))
if (!model.ok || !assets.ok) throw new Error('o exemplo não abriu')
const configurations = readdirSync(join(folder, 'configurations')).map((name) => {
  const decoded = decodeConfiguration(read(`configurations/${name}`))
  if (!decoded.ok) throw new Error(`${name} não abriu`)
  return { key: name.slice(0, -'.xml'.length), configuration: decoded.value }
})

const storage = new DiskStorage(folder)
const validator = new NodeXmlValidator()
const generate = new GenerateProduct({
  resolveConfiguration: new ResolveConfiguration(new LogicSolverConstraintSolver()),
  deriver: new CombinedProductDeriver([
    new XmlProductDeriver(storage, validator),
    new HtmlPageDeriver(storage)
  ]),
  writer: new WriteProductFolder(storage, 'saida'),
  clock: { now: () => new Date('2026-09-28T12:00:00Z') }
})
const result = await generate.execute(
  { model: model.value, assets: assets.value, configurations },
  key
)
console.log(`${key}: ${result.kind}`)
if (result.kind === 'problems' || result.kind === 'write-failed') {
  for (const problem of result.problems) {
    console.log(`  ${problem.file}${problem.line ? `:${problem.line}` : ''} [${problem.subject ?? ''}] ${problem.message}`)
  }
}
if (result.kind === 'generated') {
  const list = (directory: string, prefix = ''): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? list(join(directory, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`]
    )
  const files = list(join(folder, 'saida', key))
  console.log(`  ${files.length} arquivos: ${files.filter((file) => !file.includes('/img/')).join(', ')} e ${files.filter((file) => file.includes('/img/')).length} imagens`)
}
