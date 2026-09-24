import type { Configuration } from '../configuration/configuration'
import { err, ok, type Result } from '../shared/result'
import type { ConfigurationEntry } from './project'

/*
 * A lista de configurações do projeto. A chave é o nome do arquivo sem `.xml` e sai sempre
 * do nome de exibição (SPEC §3): renomear a configuração troca a chave, e o arquivo é
 * renomeado ao salvar. A lista fica em ordem de chave, como a pasta no disco.
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
  if (!taken.has(base)) return base
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}-${suffix}`
    if (!taken.has(candidate)) return candidate
  }
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
  return ok(insert(others, { ...source.configuration, name: trimmed }))
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

function insert(entries: readonly ConfigurationEntry[], configuration: Configuration): EntryChange {
  const key = configurationKey(configuration.name, new Set(entries.map((entry) => entry.key)))
  return {
    entries: [...entries, { key, configuration }].sort((a, b) => a.key.localeCompare(b.key)),
    key
  }
}
