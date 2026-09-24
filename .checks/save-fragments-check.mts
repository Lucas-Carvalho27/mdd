// Listar, abrir e salvar fragmentos (plano da Fase 6, Tarefa 3).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/save-fragments-check.mts
import type { FragmentDocument } from '@/application/fragments/fragment-document'
import { newFragment } from '@/application/fragments/fragment-document'
import { FragmentFiles } from '@/application/use-cases/fragment-files'
import { OpenFragment } from '@/application/use-cases/open-fragment'
import { SaveFragments, type SaveFragmentsResult } from '@/application/use-cases/save-fragments'
import { XmlFragmentChecker } from '@/infrastructure/xml/xml-fragment-checker'
import { NodeXmlValidator } from './generation-support.mts'
import { memoryFolder } from './memory-folder.mts'

const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const BOM = '\u{FEFF}'
const folder = memoryFolder({
  'model.xml': '<model/>',
  'assets.xml': '<assets/>',
  'configurations/loja-basica.xml': '<configuration/>',
  'docs/loja/visao-geral.xml': '<?xml version="1.0"?>\n<topic>\n  <title>Loja</title>\n</topic>\n',
  'docs/pagamento/pix.xml': `${BOM}<?xml version="1.0"?>\r\n<topic>\r\n  <title>PIX</title>\r\n</topic>\r\n`,
  'docs/pagamento/latin1.xml': '<?xml version="1.0"?>\n<t>Informa\u{FFFD}\u{FFFD}o</t>\n',
  'docs/img/pix-fluxo.svg': '<svg/>',
  'saida/loja-basica/product.xml': '<product/>',
  '.git/info.xml': '<x/>',
  'raiz.xml': '<raiz/>'
})
const files = new FragmentFiles(folder.storage, 'saida')
const open = new OpenFragment(folder.storage)
const save = new SaveFragments({
  storage: folder.storage,
  checker: new XmlFragmentChecker(new NodeXmlValidator())
})
const opened = async (path: string): Promise<FragmentDocument> => {
  const result = await open.execute(path)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
const summary = (result: SaveFragmentsResult): string => {
  const problems = [...result.checked].map(
    ([path, found]) =>
      `${path}: ${found.length === 0 ? 'ok' : found.map((p) => `linha ${p.line} ${p.message}`).join('; ')}`
  )
  return [
    `gravados [${[...result.saved.keys()].join(', ')}]`,
    `conflitos [${result.conflicts.join(', ')}]`,
    `erros [${result.problems.map((p) => `${p.file} ${p.message}`).join(', ')}]`,
    ...problems.map((line) => `  ${line}`)
  ].join('\n    ')
}

console.log('— listar')
const listed = await files.list()
log('fragmentos', listed.ok ? listed.value.sort().join(' ') : listed.error)
const existing = listed.ok ? listed.value : []
const cartaoPath = files.checkNewPath('Docs/Pagamento/cartao.xml', existing)
log('caminho novo Docs/Pagamento/…', cartaoPath.ok ? cartaoPath.value : cartaoPath.error)
const repeated = files.checkNewPath('docs/pagamento/PIX.xml', existing)
log('caminho novo docs/pagamento/PIX…', repeated.ok ? repeated.value : repeated.error)

console.log('— abrir')
const pix = await opened('docs/pagamento/pix.xml')
log('pix.xml', `${JSON.stringify(pix.text)} bom=${pix.format.bom} quebra=${JSON.stringify(pix.format.lineBreak)}`)
log('pix.xml só leitura?', pix.readOnly ?? 'não')
const latin1 = await opened('docs/pagamento/latin1.xml')
log('latin1.xml só leitura?', latin1.readOnly ?? 'não')
const absent = await open.execute('docs/nada.xml')
log('arquivo que não existe', absent.ok ? 'abriu?!' : absent.error.code)

console.log('— salvar só os alterados')
const visao = await opened('docs/loja/visao-geral.xml')
const pixEdited = { ...pix, text: pix.text.replace('PIX', 'Pagamento com PIX') }
const cartao = {
  ...newFragment(cartaoPath.ok ? cartaoPath.value : ''),
  text: '<?xml version="1.0" encoding="UTF-8"?>\n<topic>\n  <title>Cartão</title>\n</topic>\n'
}
const latin1Edited = { ...latin1, text: `${latin1.text}<!-- editado -->` }
const first = await save.execute([visao, pixEdited, cartao, latin1Edited])
log('resultado', summary(first))
log('pix.xml no disco', folder.show('docs/pagamento/pix.xml'))
log('cartao.xml no disco', folder.show('docs/pagamento/cartao.xml'))
log('latin1.xml no disco', folder.show('docs/pagamento/latin1.xml'))

console.log('— salvar de novo, sem mudança')
const pixSaved = { ...pixEdited, saved: first.saved.get(pixEdited.path) ?? null }
log('resultado', summary(await save.execute([pixSaved, visao])))

console.log('— com erro de XML')
const broken = { ...pixSaved, text: pixSaved.text.replace('</title>', '</titulo>') }
const brokenResult = await save.execute([broken])
log('resultado', summary(brokenResult))
const pixBroken = { ...broken, saved: brokenResult.saved.get(broken.path) ?? null }

console.log('— alterado fora do app')
folder.write('docs/pagamento/pix.xml', `${BOM}<?xml version="1.0"?>\r\n<topic>\r\n  <title>git pull</title>\r\n</topic>\r\n`)
const mine = { ...pixBroken, text: pixBroken.text.replace('</titulo>', '</title>') }
log('salvar', summary(await save.execute([mine])))
log('pix.xml no disco', folder.show('docs/pagamento/pix.xml'))
log('Sobrescrever', summary(await save.execute([mine], { overwrite: true })))
log('pix.xml no disco', folder.show('docs/pagamento/pix.xml'))

console.log('— arquivo novo que apareceu por fora')
const novo = { ...newFragment('docs/novo.xml'), text: '<novo/>\n' }
folder.write('DOCS/NOVO.XML', '<de-fora/>\n')
log('salvar', summary(await save.execute([novo])))
log('Sobrescrever', summary(await save.execute([novo], { overwrite: true })))
log('no disco', folder.names().filter((name) => name.toLowerCase().includes('novo')).join(' '))

console.log('— apagado por fora, com alteração')
const visaoEdited = { ...visao, text: visao.text.replace('Loja', 'A loja') }
folder.delete('docs/loja/visao-geral.xml')
log('salvar', summary(await save.execute([visaoEdited])))
log('Sobrescrever', summary(await save.execute([visaoEdited], { overwrite: true })))

console.log('— erro de disco')
folder.failing.add('raiz.xml')
const raiz = await opened('raiz.xml')
log('salvar', summary(await save.execute([{ ...raiz, text: '<raiz a="1"/>' }])))
