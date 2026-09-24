import { createHash } from 'crypto'
import { ipcMain, shell } from 'electron'
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import { dirname } from 'path'
import {
  IpcChannel,
  type DirectoryEntry,
  type EntryKind,
  type IpcResult,
  type RemovePrecondition,
  type TextFile,
  type WritePrecondition
} from '../../shared/ipc'
import type { ProjectRoot } from '../project-root'
import { fail, ok } from './results'

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/** Executa a operação num caminho do projeto, convertendo falhas em IpcResult. */
async function withinProject<T>(
  root: ProjectRoot,
  relativePath: string,
  operation: (absolutePath: string) => Promise<IpcResult<T>>
): Promise<IpcResult<T>> {
  if (root.current === null) return fail('no-project', 'Nenhum projeto aberto.')
  const absolutePath = root.resolve(relativePath)
  if (absolutePath === null) {
    return fail('outside-project', `O caminho "${relativePath}" fica fora do projeto.`)
  }
  try {
    return await operation(absolutePath)
  } catch (error) {
    if (isNotFound(error)) return fail('not-found', `"${relativePath}" não existe.`)
    return fail('io', `Erro ao acessar "${relativePath}": ${(error as Error).message}`)
  }
}

function violatesPrecondition(current: string | null, precondition: WritePrecondition): boolean {
  switch (precondition.kind) {
    case 'overwrite':
      return false
    case 'must-not-exist':
      return current !== null
    case 'hash':
      return current === null || sha256(current) !== precondition.expectedHash
  }
}

export function registerFileHandlers(root: ProjectRoot): void {
  ipcMain.handle(IpcChannel.list, (_event, relativeDir: string) =>
    withinProject<DirectoryEntry[]>(root, relativeDir, async (path) => {
      const entries = await readdir(path, { withFileTypes: true })
      return ok(
        entries
          .filter((entry) => entry.isFile() || entry.isDirectory())
          .map((entry) => ({ name: entry.name, kind: entry.isFile() ? 'file' : 'directory' }))
      )
    })
  )

  ipcMain.handle(IpcChannel.readText, (_event, relativePath: string) =>
    withinProject<TextFile>(root, relativePath, async (path) => {
      const content = await readFile(path, 'utf8')
      return ok({ content, hash: sha256(content) })
    })
  )

  ipcMain.handle(
    IpcChannel.writeText,
    (_event, relativePath: string, content: string, precondition: WritePrecondition) =>
      withinProject<{ hash: string }>(root, relativePath, async (path) => {
        if (violatesPrecondition(await readIfExists(path), precondition)) {
          return fail('changed-externally', `"${relativePath}" foi alterado fora do app.`)
        }
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, content, 'utf8')
        return ok({ hash: sha256(content) })
      })
  )

  ipcMain.handle(
    IpcChannel.remove,
    (_event, relativePath: string, precondition: RemovePrecondition) =>
      withinProject<null>(root, relativePath, async (path) => {
        const current = await readIfExists(path)
        if (current === null) return ok(null)
        if (precondition.kind === 'hash' && sha256(current) !== precondition.expectedHash) {
          return fail('changed-externally', `"${relativePath}" foi alterado fora do app.`)
        }
        await unlink(path)
        return ok(null)
      })
  )

  ipcMain.handle(IpcChannel.stat, (_event, relativePath: string) =>
    withinProject<EntryKind>(root, relativePath, async (path) => {
      const info = await stat(path)
      return ok(info.isDirectory() ? 'directory' : 'file')
    })
  )

  ipcMain.handle(IpcChannel.openPath, (_event, relativePath: string) =>
    withinProject<null>(root, relativePath, async (path) => {
      if ((await stat(path)).isDirectory()) {
        return fail('io', `"${relativePath}" é uma pasta, não um arquivo.`)
      }
      // O Electron devolve texto vazio quando deu certo, ou a mensagem do sistema.
      const problem = await shell.openPath(path)
      return problem === '' ? ok(null) : fail('io', problem)
    })
  )
}
