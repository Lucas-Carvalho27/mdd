// A aba Fragmentos com HTML (Fase 7), sobre uma pasta em memória: a conferência por formato, os
// IDs dos marcadores contra o modelo (conferidos de novo quando o modelo muda), o texto inicial
// de um .html e da moldura, e o aviso ao salvar com erro.
//   npx tsx --tsconfig tsconfig.web.json .checks/html-store-check.mts
import { readFileSync } from 'node:fs'
import { removeAttribute } from '@/application/editing/commands'
import { FragmentCheckerByFormat } from '@/application/fragments/fragment-checker-by-format'
import type { ProjectSession } from '@/application/project-session'
import { FragmentFiles } from '@/application/use-cases/fragment-files'
import { OpenFragment } from '@/application/use-cases/open-fragment'
import { SaveFragments } from '@/application/use-cases/save-fragments'
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { HtmlFragmentChecker } from '@/infrastructure/html/html-fragment-checker'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { XmlFragmentChecker } from '@/infrastructure/xml/xml-fragment-checker'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { fragmentTreePaths } from '@/ui/stores/fragments-actions'
import { createProjectStore } from '@/ui/stores/project-store'
import { NodeXmlValidator } from './generation-support.mts'
import { memoryFolder } from './memory-folder.mts'

const example = (path: string): string => readFileSync(`docs/examples/loja-online/${path}`, 'utf8')
const model = decodeFeatureModel(parseXmlRoot(example('model.xml')))
if (!model.ok) throw new Error('o exemplo não abriu')
const folder = memoryFolder({
  'model.xml': example('model.xml'),
  'docs/pagamento/pix.xml': example('docs/pagamento/pix.xml'),
  'docs/loja.html':
    '<h2>Loja {{loja.versao}}</h2>\n<p>{{mobile.plataforma}} {{carrinho.total}}</p>\n'
})
const session = (): ProjectSession => ({
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: { model: model.value, assets: EMPTY_ASSET_CATALOG, configurations: [] },
  hashes: { model: 'x', assets: null, configurations: {} }
})
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}
const checker = new FragmentCheckerByFormat({
  xml: new XmlFragmentChecker(new NodeXmlValidator()),
  html: new HtmlFragmentChecker()
})
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session: session(), warnings: [] }),
    reopen: async () => ({ status: 'opened', session: session(), warnings: [] })
  },
  createProject: { execute: notUsed },
  saveProject: { execute: async (current) => ({ session: current, conflicts: [], problems: [] }) },
  resolveConfiguration: { execute: () => notUsed() as never },
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} },
  checkAssetFiles: { execute: async () => new Map() },
  filePicker: { pickFile: notUsed },
  assetOpener: { open: notUsed },
  generateProduct: { execute: notUsed },
  outputFolderOpener: { open: notUsed },
  fragmentFiles: new FragmentFiles(folder.storage, 'saida'),
  openFragment: new OpenFragment(folder.storage),
  saveFragments: new SaveFragments({ storage: folder.storage, checker }),
  fragmentChecker: checker
})
const state = () => store.getState()
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const problems = (path: string): string => {
  const found = state().fragmentProblems.get(path)
  if (found === undefined) return '(não conferido)'
  return found.length === 0 ? 'ok' : found.map((p) => `linha ${p.line} ${p.message}`).join(' | ')
}
const LOJA = 'docs/loja.html'

await state().open()
await state().loadFragmentFiles()
log('árvore', fragmentTreePaths(state().fragmentFiles, state().fragmentDocuments).sort().join(' '))
await state().showFragment(LOJA)
log('problemas do .html', problems(LOJA))
await state().showFragment('docs/pagamento/pix.xml')
log('problemas do .xml', problems('docs/pagamento/pix.xml'))

console.log('— o modelo muda: loja perde o atributo versao')
log('comando', state().run(removeAttribute('loja', 'versao')) ? 'feito' : 'recusado')
await state().checkFragment(LOJA)
log('problemas do .html', problems(LOJA))
state().undo()
await state().checkFragment(LOJA)
log('depois de desfazer', problems(LOJA))

console.log('— arquivos novos')
log('novo .html', state().createFragment('docs/novo.html') ?? 'criado')
log('texto', JSON.stringify(state().fragmentDocuments.get('docs/novo.html')?.text))
log('nova moldura', state().createFragment('moldura.html') ?? 'criada')
log('texto', JSON.stringify(state().fragmentDocuments.get('moldura.html')?.text))
log('.htm', state().createFragment('docs/velho.htm') ?? 'criado')

console.log('— salvar com erro')
state().changeFragmentText('docs/novo.html', '<div>\n<p>sem fechar\n')
await state().save()
log('aviso', [...state().fragmentWarnings.values()].map((warning) => warning.message).join(' | '))
log('no disco', folder.show('docs/novo.html'))
