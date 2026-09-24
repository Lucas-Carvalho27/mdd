// Store da aba Assets com portas falsas (plano da Fase 4, Tarefa 3).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/assets-store-check.mts
import { readFileSync } from 'node:fs'
import type { StorageError } from '@/application/ports/project-storage'
import type { ProjectSession } from '@/application/project-session'
import type { AssetCatalog } from '@/domain/assets/asset-catalog'
import type { AssetFileStatus } from '@/domain/assets/asset-file-status'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { selectedAsset } from '@/ui/stores/assets-actions'
import { createProjectStore, hasUnsavedChanges } from '@/ui/stores/project-store'

const read = (path: string) =>
  parseXmlRoot(readFileSync(`docs/examples/loja-online/${path}`, 'utf8'))
const model = decodeFeatureModel(read('model.xml'))
const assets = decodeAssetCatalog(read('assets.xml'))
if (!model.ok || !assets.ok) throw new Error('o exemplo não abriu')
const session: ProjectSession = {
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: { model: model.value, assets: assets.value, configurations: [] },
  hashes: { model: 'x', assets: 'y', configurations: {} }
}
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}

// O disco falso: boleto.xml foi renomeado fora do app. Cada conferência pode ser segurada.
const missing = new Set(['docs/pagamento/boleto.xml'])
let hold: Promise<void> | null = null
const checks: string[] = []
const checkAssetFiles = {
  async execute(catalog: AssetCatalog): Promise<ReadonlyMap<string, AssetFileStatus>> {
    const snapshot = new Map(
      catalog.assets.map((asset): [string, AssetFileStatus] => [
        asset.path,
        missing.has(asset.path) ? 'missing' : 'ok'
      ])
    )
    checks.push(`${catalog.assets.length} assets`)
    if (hold !== null) await hold
    return snapshot
  }
}
const picks: Result<string | null, StorageError>[] = []
const opened: string[] = []
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session, warnings: [] }),
    reopen: notUsed
  },
  createProject: { execute: notUsed },
  saveProject: { execute: notUsed },
  resolveConfiguration: { execute: () => notUsed() as never },
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} },
  checkAssetFiles,
  filePicker: { pickFile: async () => picks.shift() ?? ok(null) },
  assetOpener: {
    async open(path) {
      opened.push(path)
      return path.endsWith('boleto.xml')
        ? err({ code: 'not-found', message: `"${path}" não existe.` })
        : ok(null)
    }
  }
})
const state = () => store.getState()
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const settle = () => new Promise((resolve) => setTimeout(resolve, 10))
const status = (path: string) => state().assetFiles.get(path) ?? 'verificando…'

// 1. Abrir o projeto confere os arquivos
let release = (): void => {}
hold = new Promise((resolve) => (release = resolve))
await state().open()
log('antes da resposta', status('docs/pagamento/boleto.xml'))
hold = null
release()
await settle()
log('boleto.xml', status('docs/pagamento/boleto.xml'))
log('busca.xml', status('docs/busca/busca.xml'))

// 2. Uma resposta antiga não apaga a mais nova
hold = new Promise((resolve) => (release = resolve))
const slow = state().checkAssetFiles()
hold = null
missing.delete('docs/pagamento/boleto.xml')
await state().checkAssetFiles()
log('conferência nova: boleto.xml', status('docs/pagamento/boleto.xml'))
missing.add('docs/pagamento/boleto.xml')
release()
await slow
log('depois da antiga responder', status('docs/pagamento/boleto.xml'))

// 3. Escolher arquivo: cancelado e fora do projeto
picks.push(ok(null))
log('cancelado', `${await state().pickAssetFile('Vincular')} | aviso: ${state().notice}`)
picks.push(
  err({
    code: 'outside-project',
    message:
      'O arquivo precisa estar dentro da pasta do projeto. Copie-o para dentro e vincule de novo.'
  })
)
log('fora do projeto', await state().pickAssetFile('Vincular'))
log('aviso', state().notice)
state().dismissNotice()

// 4. Vincular: seleciona o novo, confere o arquivo e marca alteração
checks.length = 0
const linked = state().linkAsset({
  id: 'capa',
  path: 'docs/img/capa.png',
  kind: 'resource',
  anchor: 'loja',
  name: 'Capa'
})
log(
  'vincular',
  `${linked} | selecionado: ${selectedAsset(state())?.id} | alterado: ${hasUnsavedChanges(state())}`
)
log('antes da conferência', status('docs/img/capa.png'))
await settle()
log('conferências depois de vincular', checks.join(', '))
log('depois da conferência', status('docs/img/capa.png'))
log(
  'ID repetido',
  `${state().linkAsset({ id: 'capa', path: 'x.png', kind: 'resource', anchor: 'loja', name: '' })} | ${state().notice}`
)

// 5. Desfazer tira o asset da seleção
state().undo()
log(
  'desfazer o vínculo',
  `selecionado: ${selectedAsset(state())?.id ?? '(nenhum)'} | alterado: ${hasUnsavedChanges(state())}`
)

// 6. Trocar arquivo
state().selectAsset('doc_boleto')
picks.push(ok('docs/pagamento/boleto-novo.xml'))
await state().relinkAsset('doc_boleto')
await settle()
log(
  'trocar arquivo',
  `${selectedAsset(state())?.path} | ${status('docs/pagamento/boleto-novo.xml')}`
)
log('rótulo do desfazer', state().history.past.at(-1)?.label)

// 7. Abrir: ok, e arquivo que sumiu
await state().openAsset('docs/img/pix-fluxo.svg')
log('abrir', `${opened.join(', ')} | aviso: ${state().notice}`)
checks.length = 0
await state().openAsset('docs/pagamento/boleto.xml')
await settle()
log('abrir o que sumiu', state().notice)
log('conferiu de novo', checks.length)

// 8. Fechar zera a aba
state().close()
log('fechado', `${state().assetFiles.size} estados | selecionado: ${state().selectedAssetId}`)
