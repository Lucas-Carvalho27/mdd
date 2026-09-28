// Salvar nunca perde uma configuração: renomear com conflito e nomes que só diferem na caixa
// (correções da revisão da Fase 3). O armazenamento imita o Windows: "Loja.xml" e
// "loja.xml" são o mesmo arquivo, que guarda a caixa com que foi criado.
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/save-safety-check.mts
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { ProjectStorage, StorageError } from '@/application/ports/project-storage'
import type { ProjectSession } from '@/application/project-session'
import { SaveProject } from '@/application/use-cases/save-project'
import type { Configuration } from '@/domain/configuration/configuration'
import {
  addConfiguration,
  removeConfiguration,
  renameConfiguration
} from '@/domain/project/configuration-entries'
import type { ConfigurationEntry } from '@/domain/project/project'
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
const log = (label: string, value: unknown): void => console.log(label.padEnd(40), '→', value)
const hash = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex')
const named = (name: string): Configuration => ({ ...basica, name })

/** Pasta em memória sem diferença de caixa, com as pré-condições do processo main. */
function windowsFolder(initial: Record<string, string>) {
  const files = new Map<string, { name: string; content: string }>()
  const put = (path: string, content: string): void => {
    const name = files.get(path.toLowerCase())?.name ?? path
    files.set(path.toLowerCase(), { name, content })
  }
  for (const [path, content] of Object.entries(initial)) put(path, content)
  const get = (path: string): string | undefined => files.get(path.toLowerCase())?.content
  const changed = (path: string): StorageError => ({ code: 'changed-externally', message: path })
  const storage: ProjectStorage = {
    async readText(path) {
      const content = get(path)
      return content === undefined
        ? err({ code: 'not-found', message: path })
        : ok({ content, hash: hash(content) })
    },
    async writeText(path, content, precondition) {
      const current = get(path)
      const violated =
        (precondition.kind === 'must-not-exist' && current !== undefined) ||
        (precondition.kind === 'hash' &&
          (current === undefined || hash(current) !== precondition.expectedHash))
      if (violated) return err(changed(path))
      put(path, content)
      return ok(hash(content))
    },
    async list() {
      return ok([])
    },
    async remove(path, precondition): Promise<Result<null, StorageError>> {
      const current = get(path)
      if (current === undefined) return ok(null)
      if (precondition.kind === 'hash' && hash(current) !== precondition.expectedHash) {
        return err(changed(path))
      }
      files.delete(path.toLowerCase())
      return ok(null)
    }
  }
  const validator = { validate: async () => [] }
  const save = new SaveProject({
    models: new XmlFeatureModelRepository(storage, validator),
    assets: new XmlAssetCatalogRepository(storage, validator),
    configurations: new XmlConfigurationRepository(storage, validator)
  })
  /** As configurações no disco, com a caixa do nome do arquivo e o nome de exibição. */
  const disk = (): string =>
    [...files.values()]
      .filter((file) => file.name.startsWith('configurations/'))
      .map((file) => `${file.name.slice(15)}="${file.content.match(/name="([^"]+)"/)?.[1]}"`)
      .sort()
      .join(' ') || '(nenhuma)'
  return { save, disk }
}

function session(
  entries: readonly ConfigurationEntry[],
  hashes: Record<string, string>
): ProjectSession {
  return {
    folder: { rootPath: 'memória', name: 'memória' },
    project: { model, assets: { assets: [] }, configurations: entries },
    hashes: { model: hash(example('model.xml')), assets: null, configurations: hashes }
  }
}

const unwrap = <T>(result: Result<T, string>): T => {
  if (!result.ok) throw new Error(result.error)
  return result.value
}

// 1. Renomear para uma chave cujo arquivo foi criado fora do app
{
  const basicaXml = encodeConfiguration(basica)
  const { save, disk } = windowsFolder({
    'model.xml': example('model.xml'),
    'configurations/loja-basica.xml': basicaXml,
    'configurations/loja-premium.xml': encodeConfiguration(named('Premium de fora'))
  })
  const entries = [{ key: 'loja-basica', configuration: basica }]
  const renamed = unwrap(renameConfiguration(entries, 'loja-basica', 'Loja Premium'))
  const first = await save.execute(session(renamed.entries, { 'loja-basica': hash(basicaXml) }))
  log('1. conflitos', first.conflicts.join(' '))
  log('   disco depois de salvar', disk())
  const second = await save.execute(first.session, { overwrite: true })
  log('   disco depois de sobrescrever', disk())
  log('   hashes depois', Object.keys(second.session.hashes.configurations).join(' '))
}

// 2. Criar "Loja" com Loja.xml (feito à mão) no disco
{
  const entries = [{ key: 'Loja', configuration: named('Loja') }]
  log('2. chave da nova "Loja"', unwrap(addConfiguration(entries, 'Loja')).key)
}

// 3. Excluir Loja.xml e criar "Loja" de novo: vira loja.xml, o mesmo arquivo no Windows
{
  const antiga = encodeConfiguration(named('Loja antiga'))
  const { save, disk } = windowsFolder({
    'model.xml': example('model.xml'),
    'configurations/Loja.xml': antiga
  })
  const entries = [{ key: 'Loja', configuration: named('Loja antiga') }]
  const recreated = unwrap(addConfiguration(removeConfiguration(entries, 'Loja'), 'Loja'))
  const first = await save.execute(session(recreated.entries, { Loja: hash(antiga) }))
  log('3. conflitos', first.conflicts.join(' '))
  log('   disco depois de salvar', disk())
  const second = await save.execute(first.session, { overwrite: true })
  log('   disco depois de sobrescrever', disk())
  log('   hashes depois', Object.keys(second.session.hashes.configurations).join(' '))
}

// 4. Renomear Loja.xml ("Loja X") para "Loja": a chave só mudaria de caixa
{
  const antiga = encodeConfiguration(named('Loja X'))
  const { save, disk } = windowsFolder({
    'model.xml': example('model.xml'),
    'configurations/Loja.xml': antiga
  })
  const entries = [{ key: 'Loja', configuration: named('Loja X') }]
  const renamed = unwrap(renameConfiguration(entries, 'Loja', 'Loja'))
  log('4. chave depois de renomear', renamed.key)
  const saved = await save.execute(session(renamed.entries, { Loja: hash(antiga) }))
  log('   conflitos', saved.conflicts.join(' ') || '(nenhum)')
  log('   disco depois de salvar', disk())
}
