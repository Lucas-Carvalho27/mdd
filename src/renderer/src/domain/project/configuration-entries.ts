import type { Configuration } from '../configuration/configuration'
import { err, ok, type Result } from '../shared/result'
import type { ConfigurationEntry } from './project'

/*
 * A lista de configurações do projeto. A chave é o nome do arquivo sem `.xml` e sai sempre
 * do nome de exibição (SPEC §3): renomear a configuração troca a chave, e o arquivo é
 * renomeado ao salvar. A lista fica em ordem de chave, como a pasta no disco.
 *
 * No Windows, `Loja.xml` e `loja.xml` são o mesmo arquivo. Por isso duas chaves que só
 * diferem na caixa contam como a mesma: uma colide com a outra, e renomear para uma
 * delas mantém a chave antiga. Uma chave com maiúsculas só vem de arquivo criado fora do app.
 */

export interface EntryChange {
  readonly entries: readonly ConfigurationEntry[]
  /** A chave da configuração criada ou renomeada. */
  readonly key: string
}

const FALLBACK_KEY = 'configuracao'

/**
 * Chave a partir do nome: sem acentos, minúsculas, cada trecho que não for letra ou dígito
 * vira "-", e um sufixo -2, -3… evita colisões. Ex.: "Loja Básica" → "loja-basica".
 */
export function configurationKey(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || FALLBACK_KEY
  const takenIgnoringCase = new Set([...taken].map((key) => key.toLowerCase()))
  if (!takenIgnoringCase.has(base)) return base
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}-${suffix}`
    if (!takenIgnoringCase.has(candidate)) return candidate
  }
}

/** A chave depois de renomear. Fica a mesma quando só a caixa mudaria: é o mesmo arquivo. */
export function keyAfterRename(key: string, name: string, taken: ReadonlySet<string>): string {
  const next = configurationKey(name, taken)
  return sameKey(next, key) ? key : next
}

/** As duas chaves apontam para o mesmo arquivo no Windows? */
export function sameKey(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

export function addConfiguration(
  entries: readonly ConfigurationEntry[],
  name: string
): Result<EntryChange, string> {
  const trimmed = name.trim()
  if (trimmed === '') return err('Informe o nome.')
  return ok(insert(entries, { name: trimmed, decisions: [], values: [] }))
}

/** Uma cópia com as mesmas decisões e valores, com outro nome. */
export function duplicateConfiguration(
  entries: readonly ConfigurationEntry[],
  key: string,
  name: string
): Result<EntryChange, string> {
  const source = entries.find((entry) => entry.key === key)
  if (source === undefined) return err(`A configuração "${key}" não existe.`)
  const trimmed = name.trim()
  if (trimmed === '') return err('Informe o nome.')
  return ok(insert(entries, { ...source.configuration, name: trimmed }))
}

export function renameConfiguration(
  entries: readonly ConfigurationEntry[],
  key: string,
  name: string
): Result<EntryChange, string> {
  const source = entries.find((entry) => entry.key === key)
  if (source === undefined) return err(`A configuração "${key}" não existe.`)
  const trimmed = name.trim()
  if (trimmed === '') return err('Informe o nome.')
  if (trimmed === source.configuration.name) return ok({ entries, key })
  const others = entries.filter((entry) => entry.key !== key)
  const renamed = { ...source.configuration, name: trimmed }
  return ok(insert(others, renamed, keyAfterRename(key, trimmed, keysOf(others))))
}

export function removeConfiguration(
  entries: readonly ConfigurationEntry[],
  key: string
): readonly ConfigurationEntry[] {
  return entries.filter((entry) => entry.key !== key)
}

/** Troca o conteúdo da configuração `key`; a mesma lista volta se nada mudou. */
export function replaceConfiguration(
  entries: readonly ConfigurationEntry[],
  key: string,
  configuration: Configuration
): readonly ConfigurationEntry[] {
  const index = entries.findIndex((entry) => entry.key === key)
  if (index < 0 || entries[index].configuration === configuration) return entries
  return entries.with(index, { key, configuration })
}

/** Põe a configuração na lista, com a chave indicada ou com uma nova, tirada do nome. */
function insert(
  entries: readonly ConfigurationEntry[],
  configuration: Configuration,
  key = configurationKey(configuration.name, keysOf(entries))
): EntryChange {
  return {
    entries: [...entries, { key, configuration }].sort((a, b) => a.key.localeCompare(b.key)),
    key
  }
}

function keysOf(entries: readonly ConfigurationEntry[]): Set<string> {
  return new Set(entries.map((entry) => entry.key))
}
