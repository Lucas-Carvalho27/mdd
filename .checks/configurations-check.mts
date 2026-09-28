// Edição e lista de configurações, e a gravação com exclusão (plano da Fase 3, Tarefa 2).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/configurations-check.mts
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { ProjectStorage, StorageError } from '@/application/ports/project-storage'
import type { ProjectSession } from '@/application/project-session'
import { SaveProject } from '@/application/use-cases/save-project'
import {
  decisionOf,
  nextDecisionState,
  withAttributeValue,
  withDecision
} from '@/domain/configuration/configuration-edits'
import { withoutOrphanReferences } from '@/domain/configuration/references'
import {
  addConfiguration,
  configurationKey,
  duplicateConfiguration,
  removeConfiguration,
  renameConfiguration
} from '@/domain/project/configuration-entries'
import { deleteFeature } from '@/domain/project/feature-deletion'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeConfiguration, encodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'

const example = (path: string): string => readFileSync(`docs/examples/loja-online/${path}`, 'utf8')
const decodedModel = decodeFeatureModel(parseXmlRoot(example('model.xml')))
const decodedConfiguration = decodeConfiguration(
  parseXmlRoot(example('configurations/loja-basica.xml'))
)
if (!decodedModel.ok || !decodedConfiguration.ok) throw new Error('o exemplo não abriu')
const model = decodedModel.value
const basica = decodedConfiguration.value
const original = example('configurations/loja-basica.xml')
const log = (label: string, value: unknown): void => console.log(label.padEnd(34), '→', value)

// 1. O clique: indecisa → selecionada → desselecionada → indecisa
const cycle: string[] = []
let state: 'selected' | 'deselected' | undefined = undefined
for (let i = 0; i < 4; i++) {
  cycle.push(state ?? 'indecisa')
  state = nextDecisionState(state)
}
log('ciclo do clique', cycle.join(' → '))

// 2. Tirar e devolver a decisão de pag_pix volta ao arquivo idêntico (ordem do modelo)
let c = basica
c = withDecision(model, c, 'pag_pix', nextDecisionState(decisionOf(c, 'pag_pix')))
log('pag_pix depois de 1 clique', decisionOf(c, 'pag_pix'))
c = withDecision(model, c, 'pag_pix', nextDecisionState(decisionOf(c, 'pag_pix')))
log('pag_pix depois de 2 cliques', decisionOf(c, 'pag_pix') ?? 'indecisa')
c = withDecision(model, c, 'pag_pix', nextDecisionState(decisionOf(c, 'pag_pix')))
log('3º clique: arquivo idêntico', encodeConfiguration(c) === original)
log('decisão igual, mesmo objeto', withDecision(model, basica, 'busca', 'selected') === basica)

// 3. Valores: conferidos pelo tipo, vazio remove, novo entra na ordem do modelo
const semValores = { ...basica, values: [] }
const v1 = withAttributeValue(model, semValores, 'mobile', 'plataforma', 'android')
const v2 = v1.ok ? withAttributeValue(model, v1.value, 'busca', 'max_resultados', '100') : v1
log('valores na ordem do modelo', v2.ok && encodeConfiguration(v2.value) === original)
const invalid = withAttributeValue(model, basica, 'busca', 'max_resultados', '5')
log('valor fora da faixa', invalid.ok ? 'aceito' : invalid.error)
const fixed = withAttributeValue(model, basica, 'loja', 'versao', '2.0')
log('atributo fixo', fixed.ok ? 'aceito' : fixed.error)
const cleared = withAttributeValue(model, basica, 'busca', 'max_resultados', '')
log('vazio remove o valor', cleared.ok && cleared.value.values.map((v) => v.featureId).join(' '))

// 4. Remover referências órfãs depois de excluir pag_pix do modelo
const deleted = deleteFeature(model, { assets: [] }, 'pag_pix')
if (!deleted.ok) throw new Error(deleted.error)
log(
  'sem as órfãs',
  withoutOrphanReferences(deleted.value.model, basica)
    .decisions.map((d) => d.featureId)
    .join(' ')
)

// 5. Chaves e lista
log('chave de "Loja Básica"', configurationKey('Loja Básica', new Set()))
log('chave com colisão', configurationKey('Loja Básica', new Set(['loja-basica'])))
log('chave de "  ***  "', configurationKey('  ***  ', new Set()))
const entries = [{ key: 'loja-basica', configuration: basica }]
const added = addConfiguration(entries, 'Loja Completa')
const dup = added.ok
  ? duplicateConfiguration(added.value.entries, 'loja-basica', 'Loja Básica')
  : added
log(
  'criar e duplicar',
  dup.ok && dup.value.entries.map((e) => `${e.key}:${e.configuration.decisions.length}`).join(' ')
)
const renamed = renameConfiguration(entries, 'loja-basica', 'Loja Econômica')
log(
  'renomear troca a chave',
  renamed.ok && `${renamed.value.key} ${renamed.value.entries[0].configuration.name}`
)
const same = renameConfiguration(entries, 'loja-basica', 'Loja Básica')
log('mesmo nome devolve a mesma lista', same.ok && same.value.entries === entries)
log('nome vazio', addConfiguration(entries, '  ').ok)

// 6. Gravar: renomear cria o arquivo novo e exclui o antigo; conflito na exclusão
const files = new Map<string, string>([
  ['model.xml', example('model.xml')],
  ['configurations/loja-basica.xml', original],
  ['configurations/loja-velha.xml', original]
])
const hash = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex')
const missing = (path: string): StorageError => ({
  code: 'not-found',
  message: `${path} não existe`
})
const changed = (path: string): StorageError => ({ code: 'changed-externally', message: path })
const storage: ProjectStorage = {
  async readText(path) {
    const content = files.get(path)
    return content === undefined ? err(missing(path)) : ok({ content, hash: hash(content) })
  },
  async writeText(path, content, precondition) {
    const current = files.get(path)
    const violated =
      (precondition.kind === 'must-not-exist' && current !== undefined) ||
      (precondition.kind === 'hash' &&
        (current === undefined || hash(current) !== precondition.expectedHash))
    if (violated) return err(changed(path))
    files.set(path, content)
    return ok(hash(content))
  },
  async list() {
    return ok([])
  },
  async remove(path, precondition): Promise<Result<null, StorageError>> {
    const current = files.get(path)
    if (current === undefined) return ok(null)
    if (precondition.kind === 'hash' && hash(current) !== precondition.expectedHash) {
      return err(changed(path))
    }
    files.delete(path)
    return ok(null)
  }
}
const validator = { validate: async () => [] }
const save = new SaveProject({
  models: new XmlFeatureModelRepository(storage, validator),
  assets: new XmlAssetCatalogRepository(storage, validator),
  configurations: new XmlConfigurationRepository(storage, validator)
})
if (!renamed.ok) throw new Error('renomear')
const session: ProjectSession = {
  folder: { rootPath: 'memória', name: 'memória' },
  project: { model, assets: { assets: [] }, configurations: renamed.value.entries },
  hashes: {
    model: hash(example('model.xml')),
    assets: null,
    configurations: { 'loja-basica': hash(original), 'loja-velha': hash(original) }
  }
}
files.set('configurations/loja-velha.xml', original.replace('Loja Básica', 'Alterada fora'))
const first = await save.execute(session)
log('arquivos depois de salvar', [...files.keys()].filter((f) => f.startsWith('config')).join(' '))
log('conflitos', first.conflicts.join(' '))
log('hashes das configurações', Object.keys(first.session.hashes.configurations).join(' '))
const second = await save.execute(first.session, { overwrite: true })
log(
  'sobrescrever exclui o alterado',
  [...files.keys()].filter((f) => f.startsWith('config')).join(' ')
)
log('hashes depois', Object.keys(second.session.hashes.configurations).join(' '))
log('nome gravado', files.get('configurations/loja-economica.xml')?.match(/name="([^"]+)"/)?.[1])
log('removeConfiguration', removeConfiguration(entries, 'loja-basica').length)
