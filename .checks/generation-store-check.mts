// Store da geração com portas falsas (plano da Fase 5, Tarefa 4; casos 9 a 13 das correções
// da revisão final).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
import { readFileSync } from 'node:fs'
import type { ProjectSession } from '@/application/project-session'
import type { GenerateProductResult } from '@/application/use-cases/generate-product'
import { err, ok } from '@/domain/shared/result'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { createProjectStore, hasUnsavedChanges } from '@/ui/stores/project-store'

const read = (path: string) =>
  parseXmlRoot(readFileSync(`docs/examples/loja-online/${path}`, 'utf8'))
const model = decodeFeatureModel(read('model.xml'))
const assets = decodeAssetCatalog(read('assets.xml'))
const basica = decodeConfiguration(read('configurations/loja-basica.xml'))
if (!model.ok || !assets.ok || !basica.ok) throw new Error('o exemplo não abriu')
const session = (): ProjectSession => ({
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: {
    model: model.value,
    assets: assets.value,
    configurations: [{ key: 'loja-basica', configuration: basica.value }]
  },
  hashes: { model: 'x', assets: 'y', configurations: { 'loja-basica': 'z' } }
})
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}

// A geração falsa: devolve o próximo resultado da fila; cada uma pode ser segurada.
const results: GenerateProductResult[] = []
const calls: string[] = []
let hold: Promise<void> | null = null
let throwNext = false
const opened: string[] = []
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session: session(), warnings: [] }),
    reopen: async () => ({ status: 'opened', session: session(), warnings: [] })
  },
  createProject: { execute: notUsed },
  saveProject: { execute: notUsed },
  resolveConfiguration: { execute: () => notUsed() as never },
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} },
  checkAssetFiles: { execute: async () => new Map() },
  filePicker: { pickFile: notUsed },
  assetOpener: { open: notUsed },
  generateProduct: {
    async execute(_project, key, options) {
      calls.push(`${key}${options?.replace ? ' (substituir)' : ''}`)
      if (hold !== null) await hold
      if (throwNext) {
        throwNext = false
        throw new Error('falha inesperada')
      }
      return results.shift()!
    }
  },
  outputFolderOpener: {
    async open(folder) {
      opened.push(folder)
      return folder.endsWith('sumiu') ? err({ code: 'not-found', message: 'não existe' }) : ok(null)
    }
  }
})
const state = () => store.getState()
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const last = () => {
  const generation = state().lastGeneration
  return generation === null ? '(nenhuma)' : `${generation.key} → ${generation.folder}`
}
const generated = (folder: string): GenerateProductResult => ({
  kind: 'generated',
  folder,
  generatedAt: new Date('2026-09-24T14:03:00Z')
})

// 1. Sem projeto aberto, nada acontece
log('1. sem projeto aberto', await state().generateProduct('loja-basica'))
log('   chamadas', calls.length)
await state().open()

// 2. Gerar: "gerando" durante, a última geração depois, sem mudar o "•"
state().openConfiguration('loja-basica')
let release = (): void => {}
hold = new Promise((resolve) => (release = resolve))
results.push(generated('saida/loja-basica'))
const pending = state().generateProduct('loja-basica')
log('2. durante: gerando', state().generating)
log('   segundo clique', await state().generateProduct('loja-basica'))
hold = null
release()
log('   resultado', (await pending)?.kind)
log('   depois: gerando', state().generating)
log('   última geração', last())
log('   alterações não salvas', hasUnsavedChanges(state()))
log('   chamadas', calls.join(', '))

// 3. Pede confirmação e substitui
results.push({ kind: 'needs-confirmation', folder: 'saida/loja-basica' })
log('3. de novo', (await state().generateProduct('loja-basica'))?.kind)
results.push(generated('saida/loja-basica'))
log('   substituir', (await state().generateProduct('loja-basica', { replace: true }))?.kind)
log('   chamadas', calls.slice(-2).join(', '))

// 4. Problemas: a última geração continua a de antes
results.push({ kind: 'problems', problems: [] })
log('4. problemas', (await state().generateProduct('loja-basica'))?.kind)
log('   última geração', last())

// 5. Abrir a pasta; a falha vira aviso
await state().openGeneratedFolder()
log('5. abriu', opened.join(', '))
store.setState({
  lastGeneration: { key: 'loja-basica', folder: 'saida/sumiu', generatedAt: new Date() }
})
await state().openGeneratedFolder()
log('   aviso', state().notice)

// 6. Dispensar a faixa
state().dismissLastGeneration()
log('6. depois do ×', last())

// 7. Recarregar o projeto no meio da geração: o resultado é descartado
results.push(generated('saida/loja-basica'))
hold = new Promise((resolve) => (release = resolve))
const during = state().generateProduct('loja-basica')
await state().reload()
hold = null
release()
log('7. recarregado no meio', await during)
log('   gerando', state().generating)
log('   última geração', last())

// 8. Fechar o projeto zera a última geração
state().openConfiguration('loja-basica')
results.push(generated('saida/loja-basica'))
await state().generateProduct('loja-basica')
state().close()
log('8. depois de fechar', last())

// 9. O "Substituir" de um diálogo aberto antes de trocar de configuração gera a chave do
// diálogo, e não a configuração aberta
await state().open()
state().openConfiguration('loja-basica')
state().duplicateConfiguration('loja-basica', 'Loja Outra')
log('9. configuração aberta', state().openConfigurationKey)
results.push(generated('saida/loja-basica'))
log(
  '   substituir loja-basica',
  (await state().generateProduct('loja-basica', { replace: true }))?.kind
)
log('   chamada', calls.at(-1))
log('   última geração', last())

// 10. Renomear a configuração gerada apaga a faixa, que não volta com o nome de volta
const keys = () =>
  state()
    .session!.project.configurations.map((entry) => entry.key)
    .join(', ')
state().renameConfiguration('loja-outra', 'Loja Outra 2')
log('10. renomear outra', last())
state().renameConfiguration('loja-basica', 'Loja Básica 2')
log('    renomear a gerada', last())
state().renameConfiguration('loja-basica-2', 'Loja Básica')
log('    nome de volta', `${keys()} | ${last()}`)

// 11. Excluir a configuração gerada apaga a faixa; uma nova com a mesma chave não a traz
results.push(generated('saida/loja-basica'))
await state().generateProduct('loja-basica')
state().deleteConfiguration('loja-outra-2')
log('11. excluir outra', last())
state().deleteConfiguration('loja-basica')
log('    excluir a gerada', last())
state().createConfiguration('Loja Básica')
log('    nova com a mesma chave', `${keys()} | ${last()}`)

// 12. Uma falha na escrita apaga a faixa da mesma chave, e não a de outra
results.push(generated('saida/loja-basica'))
await state().generateProduct('loja-basica')
results.push({ kind: 'write-failed', problems: [] })
log(
  '12. falha na escrita de outra',
  `${(await state().generateProduct('outra'))?.kind} | ${last()}`
)
results.push({ kind: 'write-failed', problems: [] })
log(
  '    falha na escrita da gerada',
  `${(await state().generateProduct('loja-basica'))?.kind} | ${last()}`
)

// 13. O caso de uso lança: o botão não fica preso em "Gerando…"
throwNext = true
log(
  '13. o caso de uso lança',
  await state()
    .generateProduct('loja-basica')
    .catch((error: Error) => `rejeitou: ${error.message}`)
)
log('    gerando', state().generating)
