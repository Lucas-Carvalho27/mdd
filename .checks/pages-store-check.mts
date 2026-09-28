// A store da aba Páginas (Fase 8): montagens pedidas durante outra se juntam numa só, a mais
// nova é a que fica, a rolagem volta ao topo ao trocar de configuração, e uma montagem que
// termina depois de fechar o projeto é descartada.
//   npx tsx --tsconfig tsconfig.web.json .checks/pages-store-check.mts
import { readFileSync } from 'node:fs'
import type { ProjectSession } from '@/application/project-session'
import type { PreviewPageResult } from '@/application/use-cases/preview-page'
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { createProjectStore } from '@/ui/stores/project-store'

const model = decodeFeatureModel(
  parseXmlRoot(readFileSync('docs/examples/loja-online/model.xml', 'utf8'))
)
if (!model.ok) throw new Error('o exemplo não abriu')
const configuration = { name: 'A', decisions: [], values: [] }
const session = (): ProjectSession => ({
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: {
    model: model.value,
    assets: EMPTY_ASSET_CATALOG,
    configurations: [
      { key: 'a', configuration },
      { key: 'b', configuration: { ...configuration, name: 'B' } }
    ]
  },
  hashes: { model: 'x', assets: null, configurations: {} }
})
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}

/** A montagem de mentira: cada chamada espera um pouco e anota o que recebeu. */
const calls: string[] = []
let delay = 50
const previewPage = {
  async execute(
    _project: unknown,
    key: string | null,
    edited: ReadonlyMap<string, string>
  ): Promise<PreviewPageResult> {
    calls.push(`${key} (${[...edited.keys()].join(', ') || 'sem editados'})`)
    await new Promise((resolve) => setTimeout(resolve, delay))
    return key === null
      ? { kind: 'no-configuration' }
      : { kind: 'page', address: 'mdd-page://pagina/index.html', problems: [], defaultFrame: false }
  }
}
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session: session(), warnings: [] }),
    reopen: async () => ({ status: 'opened', session: session(), warnings: [] })
  },
  createProject: { execute: notUsed },
  saveProject: { execute: async (current) => ({ session: current, conflicts: [], problems: [] }) },
  resolveConfiguration: {
    execute: () => ({ kind: 'empty-model', orphans: [], invalidValues: [] })
  },
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} },
  checkAssetFiles: { execute: async () => new Map() },
  filePicker: { pickFile: notUsed },
  assetOpener: { open: notUsed },
  generateProduct: { execute: notUsed },
  outputFolderOpener: { open: notUsed },
  fragmentFiles: { list: notUsed, checkNewPath: () => notUsed() as never },
  openFragment: { execute: notUsed },
  saveFragments: { execute: notUsed },
  fragmentChecker: { check: async () => [] },
  previewPage
})
const state = () => store.getState()
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const shown = (): string => {
  const preview = state().pagePreview
  return preview.kind === 'page' ? `página, versão ${preview.version}` : preview.kind
}

await state().open()
log('antes de montar', shown())
await state().refreshPage()
log('sem configuração aberta', `${shown()} | chamadas: ${calls.splice(0).join(' ; ')}`)

state().openConfiguration('a')
await state().refreshPage()
log('configuração a', `${shown()} | chamadas: ${calls.splice(0).join(' ; ')}`)
state().setPageScroll(900)

console.log('— três pedidos seguidos')
const first = state().refreshPage()
void state().refreshPage()
const last = state().refreshPage()
await Promise.all([first, last])
log('montagens', `${calls.length}: ${calls.splice(0).join(' ; ')}`)
log('fica a mais nova', shown())
log('a rolagem continua', state().pageScroll)

console.log('— outra configuração')
state().openConfiguration('b')
await state().refreshPage()
log('configuração b', `${shown()} | rolagem: ${state().pageScroll}`)
calls.splice(0)

console.log('— fechar durante a montagem')
delay = 200
const pending = state().refreshPage()
await new Promise((resolve) => setTimeout(resolve, 50))
state().close()
await pending
log(
  'depois de fechar',
  `${shown()} | largura: ${state().pageWidth} | rolagem: ${state().pageScroll}`
)
