import { ok, type Result } from '@/domain/shared/result'
import type {
  ProjectStorage,
  RemovePrecondition,
  StorageEntry,
  StorageEntryKind,
  StorageError,
  StoredText,
  WritePrecondition
} from '../ports/project-storage'

/**
 * O projeto com os fragmentos abertos no editor (Fase 8): um arquivo com texto em `edited`
 * (por caminho, comparado sem caixa, como no Windows) é lido com esse texto, e existe mesmo
 * que ainda não esteja no disco. O resto passa direto para o armazenamento de baixo. Serve
 * só para ler: a visualização nunca grava.
 */
export class EditedFragmentsStorage implements ProjectStorage {
  private readonly storage: ProjectStorage
  private readonly edited: ReadonlyMap<string, string>

  constructor(storage: ProjectStorage, edited: ReadonlyMap<string, string>) {
    this.storage = storage
    this.edited = new Map([...edited].map(([path, text]) => [path.toLowerCase(), text]))
  }

  readText(path: string): Promise<Result<StoredText, StorageError>> {
    const text = this.edited.get(path.toLowerCase())
    // Sem hash: um texto do editor nunca é gravado por aqui.
    return text === undefined
      ? this.storage.readText(path)
      : Promise.resolve(ok({ content: text, hash: '' }))
  }

  stat(path: string): Promise<Result<StorageEntryKind, StorageError>> {
    return this.edited.has(path.toLowerCase())
      ? Promise.resolve(ok('file'))
      : this.storage.stat(path)
  }

  list(directory: string): Promise<Result<StorageEntry[], StorageError>> {
    return this.storage.list(directory)
  }

  writeText(
    path: string,
    content: string,
    precondition: WritePrecondition
  ): Promise<Result<string, StorageError>> {
    return this.storage.writeText(path, content, precondition)
  }

  remove(path: string, precondition: RemovePrecondition): Promise<Result<null, StorageError>> {
    return this.storage.remove(path, precondition)
  }

  copy(from: string, to: string): Promise<Result<null, StorageError>> {
    return this.storage.copy(from, to)
  }

  rename(from: string, to: string): Promise<Result<null, StorageError>> {
    return this.storage.rename(from, to)
  }

  removeDirectory(path: string): Promise<Result<null, StorageError>> {
    return this.storage.removeDirectory(path)
  }
}
