// Store do configurador sobre docs/examples/loja-online (plano da Fase 3, Tarefa 3).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/configurator-store-check.mts
import { readFileSync } from 'node:fs'
import * as cmd from '@/application/editing/commands'
import type { ProjectSession } from '@/application/project-session'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { configurationStatus } from '@/domain/configuration/resolution'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import {
  createProjectStore,
  hasUnsavedChanges,
  openConfigurationEntry
} from '@/ui/stores/project-store'

const read = (path: string) =>
  parseXmlRoot(readFileSync(`docs/examples/loja-online/${path}`, 'utf8'))
const model = decodeFeatureModel(read('model.xml'))
const basica = decodeConfiguration(read('configurations/loja-basica.xml'))
if (!model.ok || !basica.ok) throw new Error('o exemplo não abriu')
const session: ProjectSession = {
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: {
    model: model.value,
    assets: EMPTY_ASSET_CATALOG,
    configurations: [{ key: 'loja-basica', configuration: basica.value }]
  },
  hashes: { model: 'x', assets: null, configurations: { 'loja-basica': 'y' } }
}
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}
const saved: ProjectSession[] = []
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session, warnings: [] }),
    reopen: async () => ({ status: 'opened', session, warnings: [] })
  },
  createProject: { execute: notUsed },
  saveProject: {
    execute: async (s) => {
      saved.push(s)
      return { session: s, conflicts: [], problems: [] }
    }
  },
  resolveConfiguration: new ResolveConfiguration(new LogicSolverConstraintSolver()),
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} },
  // Fase 4: a store confere os arquivos dos assets ao abrir o projeto.
  checkAssetFiles: { execute: async () => new Map() },
  filePicker: { pickFile: notUsed },
  assetOpener: { open: notUsed }
})
const state = () => store.getState()
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const summary = (): string => {
  const resolution = state().openResolution()
  if (resolution === null) return '(nenhuma aberta)'
  const status = configurationStatus(resolution)
  return `${resolution.kind} | completa ${status.complete} | indecisas ${status.undecidedCount}`
}
const feature = (id: string): string => {
  const resolution = state().openResolution()
  const s = resolution?.kind === 'resolved' ? resolution.features.get(id) : undefined
  return s === undefined ? '-' : s.kind === 'undecided' ? 'indecisa' : `${s.kind} ${s.state}`
}
const keys = (): string =>
  state()
    .session!.project.configurations.map((e) => `${e.key}(${e.configuration.name})`)
    .join(' ')

await state().open()
log('ao abrir', `aberta ${state().openConfigurationKey} | alterações ${hasUnsavedChanges(state())}`)

// 1. loja-basica completa, mobile propagada
state().openConfiguration('loja-basica')
log('loja-basica', `${summary()} | mobile ${feature('mobile')}`)
log('mesma resolução enquanto nada muda', state().openResolution() === state().openResolution())

// 2. Clique numa feature propagada não faz nada
state().toggleDecision('mobile')
log('clique em mobile (travada)', `${feature('mobile')} | alterações ${hasUnsavedChanges(state())}`)

// 3. Dois cliques em pag_pix: desselecionada, depois indecisa; mobile fica indecisa
state().toggleDecision('pag_pix')
log('1º clique em pag_pix', `${feature('pag_pix')} | mobile ${feature('mobile')}`)
state().toggleDecision('pag_pix')
log('2º clique em pag_pix', `${feature('pag_pix')} | mobile ${feature('mobile')} | ${summary()}`)
log('alterações pendentes', hasUnsavedChanges(state()))

// 4. O clique pula o estado que daria conflito: mobile manual selecionada, pag_pix selecionada
state().toggleDecision('mobile')
state().toggleDecision('pag_pix')
log('mobile manual + pag_pix', `mobile ${feature('mobile')} | pag_pix ${feature('pag_pix')}`)
state().toggleDecision('mobile')
log('clique em mobile pula o conflito', `mobile ${feature('mobile')} | ${summary()}`)

// 5. Valores de atributos
log('valor inválido', state().setAttributeValue('busca', 'max_resultados', '9000'))
log('valor válido', state().setAttributeValue('busca', 'max_resultados', '200'))
log(
  'valor gravado',
  openConfigurationEntry(state())!
    .configuration.values.map((v) => `${v.featureId}=${v.value}`)
    .join(' ')
)

// 6. Lista: criar abre a nova, renomear a aberta mantém aberta, excluir fecha
log('criar sem nome', state().createConfiguration(' '))
state().createConfiguration('Loja Completa')
log('criar', `${keys()} | aberta ${state().openConfigurationKey} | ${summary()}`)
state().renameConfiguration('loja-completa', 'Loja Premium')
log('renomear a aberta', `${keys()} | aberta ${state().openConfigurationKey}`)
state().duplicateConfiguration('loja-basica', 'Loja Básica')
log('duplicar', `${keys()} | aberta ${state().openConfigurationKey}`)
state().deleteConfiguration('loja-basica-2')
log('excluir a aberta', `${keys()} | aberta ${state().openConfigurationKey}`)

// 7. Órfãs: excluir pag_pix no modelo; a configuração mostra a referência e a remove
state().openConfiguration('loja-basica')
state().toggleDecision('pag_pix')
state().run(cmd.deleteFeature('pag_pix', 'PIX'))
const orphans = state().openResolution()!.orphans
log(
  'órfãs depois de excluir pag_pix',
  orphans.map((o) => (o.kind === 'decision' ? o.decision.featureId : o.value.attributeId)).join(' ')
)
state().removeOrphanReferences()
log('depois de remover as órfãs', `${state().openResolution()!.orphans.length} | ${summary()}`)

// 8. Salvar grava a lista inteira e limpa o "•"
await state().save()
log(
  'salvo',
  `${saved
    .at(-1)!
    .project.configurations.map((e) => e.key)
    .join(' ')} | alterações ${hasUnsavedChanges(state())}`
)

// 9. Recarregar mantém a configuração aberta se ela ainda existe no disco
state().openConfiguration('loja-basica')
await state().reload()
log('recarregar', `aberta ${state().openConfigurationKey}`)
