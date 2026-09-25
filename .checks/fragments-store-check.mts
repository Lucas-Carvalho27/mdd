// Store da aba Fragmentos sobre uma pasta em memória (plano da Fase 6, Tarefa 4).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/fragments-store-check.mts
import { readFileSync } from 'node:fs'
import type { ProjectSession } from '@/application/project-session'
import { FragmentFiles } from '@/application/use-cases/fragment-files'
import { OpenFragment } from '@/application/use-cases/open-fragment'
import { SaveFragments } from '@/application/use-cases/save-fragments'
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { XmlFragmentChecker } from '@/infrastructure/xml/xml-fragment-checker'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { fragmentTreePaths, shownFragment } from '@/ui/stores/fragments-actions'
import { createProjectStore, hasUnsavedChanges } from '@/ui/stores/project-store'
import { NodeXmlValidator } from './generation-support.mts'
import { memoryFolder } from './memory-folder.mts'

const example = (path: string): string => readFileSync(`docs/examples/loja-online/${path}`, 'utf8')
const model = decodeFeatureModel(parseXmlRoot(example('model.xml')))
if (!model.ok) throw new Error('o exemplo não abriu')
const folder = memoryFolder({
  'model.xml': example('model.xml'),
  'docs/loja/visao-geral.xml': example('docs/loja/visao-geral.xml'),
  'docs/pagamento/pix.xml': example('docs/pagamento/pix.xml'),
  'docs/pagamento/boleto.xml': example('docs/pagamento/boleto.xml'),
  'docs/antigo.xml':
    '<?xml version="1.0" encoding="ISO-8859-1"?>\n<t>Informa\u{FFFD}\u{FFFD}o</t>\n'
})
const session = (): ProjectSession => ({
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: { model: model.value, assets: EMPTY_ASSET_CATALOG, configurations: [] },
  hashes: { model: 'x', assets: null, configurations: {} }
})
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}
const checker = new XmlFragmentChecker(new NodeXmlValidator())
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
const tree = (): string =>
  fragmentTreePaths(state().fragmentFiles, state().fragmentDocuments).sort().join(' ')
const problems = (path: string): string => {
  const found = state().fragmentProblems.get(path)
  if (found === undefined) return '(não conferido)'
  return found.length === 0 ? 'ok' : found.map((p) => `linha ${p.line} ${p.message}`).join(' | ')
}
const unsaved = (): string => (hasUnsavedChanges(state()) ? '•' : 'salvo')
const text = (path: string): string => JSON.stringify(state().fragmentDocuments.get(path)?.text)
const PIX = 'docs/pagamento/pix.xml'

console.log('— abrir o projeto e a aba')
await state().open()
await state().refreshFragments()
log('antes da aba, Atualizar', state().fragmentFiles === null ? 'não lê as pastas' : 'leu?!')
await state().loadFragmentFiles()
log('árvore', tree())
await state().showFragment(PIX)
log('exibido', shownFragment(state())?.path)
log('problemas', problems(PIX))
log('título', unsaved())

console.log('— editar e salvar')
const original = state().fragmentDocuments.get(PIX)!.text
state().changeFragmentText(PIX, original.replace('Pagamento com PIX', 'Pague com PIX'))
log('depois de digitar', unsaved())
state().changeFragmentText(PIX, original)
log('voltando ao texto do disco', unsaved())
state().changeFragmentText(PIX, original.replace('Pagamento com PIX', 'Pague com PIX'))
await state().save()
log(
  'depois do Ctrl+S',
  `${unsaved()} · conflitos ${state().conflicts.length} · avisos ${state().fragmentWarnings.size}`
)
log('no disco', folder.show(PIX).includes('Pague com PIX') ? 'título novo' : 'título antigo')

console.log('— com erro de XML')
const saved = state().fragmentDocuments.get(PIX)!.text
state().changeFragmentText(PIX, saved.replace('</title>', '</titulo>'))
await state().checkFragment(PIX)
log('problemas', problems(PIX))
await state().save()
log(
  'depois do Ctrl+S',
  `${unsaved()} · avisos: ${[...state().fragmentWarnings.values()].map((w) => `${w.file}:${w.line} ${w.message}`).join(' | ')}`
)
state().changeFragmentText(PIX, saved)
await state().save()
log(
  'corrigido e salvo',
  `${unsaved()} · avisos ${state().fragmentWarnings.size} · problemas ${problems(PIX)}`
)

console.log('— só para leitura')
await state().showFragment('docs/antigo.xml')
log('antigo.xml', state().fragmentDocuments.get('docs/antigo.xml')?.readOnly)
state().changeFragmentText('docs/antigo.xml', 'texto novo')
log('digitar nele', `${text('docs/antigo.xml')} · ${unsaved()}`)
log('problemas', problems('docs/antigo.xml'))

console.log('— fragmento novo')
log('caminho docs/pagamento/PIX.xml', state().checkNewFragmentPath('docs/pagamento/PIX.xml'))
log('criar configurations/x.xml', state().createFragment('configurations/x.xml'))
log(
  'criar Docs/Pagamento/cartao.xml',
  state().createFragment('Docs/Pagamento/cartao.xml') ?? 'criado'
)
await state().checkFragment('docs/pagamento/cartao.xml')
log('exibido', `${shownFragment(state())?.path} · ${text('docs/pagamento/cartao.xml')}`)
log('problemas', problems('docs/pagamento/cartao.xml'))
log('árvore', tree())
log('título', unsaved())
log('criar o mesmo de novo', state().createFragment('docs/pagamento/cartao.xml'))
state().discardFragment('docs/pagamento/cartao.xml')
log(
  'descartado',
  `exibido ${shownFragment(state())?.path ?? '(nenhum)'} · ${unsaved()} · árvore ${tree()}`
)
state().createFragment('docs/pagamento/cartao.xml')
state().changeFragmentText(
  'docs/pagamento/cartao.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<topic xmlns="urn:exemplo:doc">\n  <title>Cartão</title>\n</topic>\n'
)
await state().save()
log(
  'salvo',
  `${unsaved()} · no disco ${folder.show('docs/pagamento/cartao.xml').includes('Cartão') ? 'o texto digitado' : 'outro'} · árvore ${tree()}`
)

console.log('— descartar alterações')
await state().showFragment('docs/loja/visao-geral.xml')
const visao = text('docs/loja/visao-geral.xml')
state().changeFragmentText('docs/loja/visao-geral.xml', 'rascunho')
log('alterado', unsaved())
state().discardFragment('docs/loja/visao-geral.xml')
log(
  'descartado',
  `${unsaved()} · texto ${text('docs/loja/visao-geral.xml') === visao ? 'do disco' : 'outro'}`
)

console.log('— mudanças fora do app, e a janela volta ao foco')
folder.write('docs/loja/visao-geral.xml', '<topic>\n  <title>Mudou por fora</title>\n</topic>\n')
folder.write('docs/busca/busca.xml', '<topic/>\n')
await state().showFragment('docs/pagamento/boleto.xml')
folder.delete('docs/pagamento/boleto.xml')
state().changeFragmentText(PIX, `${state().fragmentDocuments.get(PIX)!.text}<!-- minha -->\n`)
folder.write(PIX, '<topic>\n  <title>git pull</title>\n</topic>\n')
await state().showFragment('docs/loja/visao-geral.xml')
await state().refreshFragments()
log('árvore', tree())
log('visao-geral.xml (sem alteração)', text('docs/loja/visao-geral.xml'))
log(
  'pix.xml (com alteração)',
  state().fragmentDocuments.get(PIX)?.text.includes('minha') ? 'mantido' : 'trocado'
)
log('problemas do exibido', problems('docs/loja/visao-geral.xml'))
await state().save()
log('Ctrl+S', `conflitos [${state().conflicts.join(', ')}] · ${unsaved()}`)
await state().save({ overwrite: true })
log('Sobrescrever', `conflitos [${state().conflicts.join(', ')}] · ${unsaved()}`)
log('pix.xml no disco', folder.show(PIX).includes('minha') ? 'o meu' : 'o de fora')

console.log('— apagado por fora: exibido sem alteração, e com alteração')
await state().showFragment('docs/busca/busca.xml')
folder.delete('docs/busca/busca.xml')
await state().refreshFragments()
log('busca.xml', `exibido ${shownFragment(state())?.path ?? '(nenhum)'} · árvore ${tree()}`)
await state().showFragment('docs/loja/visao-geral.xml')
state().changeFragmentText('docs/loja/visao-geral.xml', '<topic/>\n')
folder.delete('docs/loja/visao-geral.xml')
await state().refreshFragments()
log(
  'visao-geral.xml',
  `novo? ${state().fragmentDocuments.get('docs/loja/visao-geral.xml')?.saved === null} · árvore ${tree()}`
)
await state().save()
log(
  'Ctrl+S',
  `conflitos [${state().conflicts.join(', ')}] · ${unsaved()} · no disco ${folder.show('docs/loja/visao-geral.xml')}`
)

console.log('— recarregar e fechar')
state().changeFragmentText('docs/loja/visao-geral.xml', '<topic>rascunho</topic>\n')
await state().reload()
log(
  'Recarregar',
  `exibido ${shownFragment(state())?.path} · ${text('docs/loja/visao-geral.xml')} · ${unsaved()}`
)
state().changeFragmentText('docs/loja/visao-geral.xml', '<topic>outro</topic>\n')
state().close()
log(
  'Fechar',
  `${state().fragmentDocuments.size} abertos · aba ${state().fragmentFiles === null ? 'zerada' : 'não zerada'}`
)
