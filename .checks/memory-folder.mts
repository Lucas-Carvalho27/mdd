// Pasta de projeto em memória para os roteiros da Fase 6. Imita o Windows e o processo main:
// "Docs/a.xml" e "docs/a.xml" são o mesmo arquivo, que guarda a caixa com que foi criado, e
// as gravações seguem as mesmas pré-condições de hash do main.
import { createHash } from 'node:crypto'
import type {
  ProjectStorage,
  StorageEntry,
  StorageError
} from '@/application/ports/project-storage'
import { err, ok } from '@/domain/shared/result'

export const hash = (content: string): string =>
  createHash('sha256').update(content, 'utf8').digest('hex')

export function memoryFolder(initial: Record<string, string>) {
  const files = new Map<string, { name: string; content: string }>()
  /** Caminhos cuja gravação falha com um erro de disco. */
  const failing = new Set<string>()
  const put = (path: string, content: string): void => {
    const name = files.get(path.toLowerCase())?.name ?? path
    files.set(path.toLowerCase(), { name, content })
  }
  for (const [path, content] of Object.entries(initial)) put(path, content)
  const get = (path: string): string | undefined => files.get(path.toLowerCase())?.content
  const changed = (path: string): StorageError => ({
    code: 'changed-externally',
    message: `"${path}" foi alterado fora do app.`
  })
  const missing = (path: string): StorageError => ({
    code: 'not-found',
    message: `"${path}" não existe.`
  })

  const storage: ProjectStorage = {
    async readText(path) {
      const content = get(path)
      return content === undefined ? err(missing(path)) : ok({ content, hash: hash(content) })
    },
    async writeText(path, content, precondition) {
      if (failing.has(path)) {
        return err({ code: 'io', message: `Erro ao acessar "${path}": EPERM` })
      }
      const current = get(path)
      const violated =
        (precondition.kind === 'must-not-exist' && current !== undefined) ||
        (precondition.kind === 'hash' &&
          (current === undefined || hash(current) !== precondition.expectedHash))
      if (violated) return err(changed(path))
      put(path, content)
      return ok(hash(content))
    },
    async list(directory) {
      const prefix = directory === '' ? '' : `${directory.toLowerCase()}/`
      const entries = new Map<string, StorageEntry>()
      for (const { name } of files.values()) {
        if (!name.toLowerCase().startsWith(prefix)) continue
        const rest = name.slice(prefix.length).split('/')
        const kind = rest.length === 1 ? 'file' : 'directory'
        entries.set(rest[0].toLowerCase(), { name: rest[0], kind })
      }
      return entries.size === 0 && directory !== ''
        ? err(missing(directory))
        : ok([...entries.values()])
    },
    async remove(path) {
      files.delete(path.toLowerCase())
      return ok(null)
    },
    async stat(path) {
      return get(path) === undefined ? err(missing(path)) : ok('file')
    },
    copy: async () => err({ code: 'io', message: 'não usado' }),
    rename: async () => err({ code: 'io', message: 'não usado' }),
    removeDirectory: async () => err({ code: 'io', message: 'não usado' })
  }

  return {
    storage,
    failing,
    /** O conteúdo no disco, como JSON, com o BOM à vista; `(não existe)` quando falta. */
    show: (path: string): string => {
      const content = get(path)
      return content === undefined
        ? '(não existe)'
        : JSON.stringify(content).replace('\u{FEFF}', '<BOM>')
    },
    /** Muda o arquivo "fora do app". */
    write: (path: string, content: string): void => put(path, content),
    /** Apaga o arquivo "fora do app". */
    delete: (path: string): void => void files.delete(path.toLowerCase()),
    names: (): string[] => [...files.values()].map((file) => file.name).sort()
  }
}
