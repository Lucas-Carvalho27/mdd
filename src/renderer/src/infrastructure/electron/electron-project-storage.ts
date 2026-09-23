import type {
  ProjectStorage,
  StorageEntry,
  StorageError,
  StoredText,
  WritePrecondition
} from '@/application/ports/project-storage'
import { ok, type Result } from '@/domain/shared/result'

/** `ProjectStorage` sobre a API `window.mdd` do preload (SPEC §6.3). */
export class ElectronProjectStorage implements ProjectStorage {
  readText(path: string): Promise<Result<StoredText, StorageError>> {
    return window.mdd.readText(path)
  }

  async writeText(
    path: string,
    content: string,
    precondition: WritePrecondition
  ): Promise<Result<string, StorageError>> {
    const written = await window.mdd.writeText(path, content, precondition)
    return written.ok ? ok(written.value.hash) : written
  }

  list(directory: string): Promise<Result<StorageEntry[], StorageError>> {
    return window.mdd.list(directory)
  }
}
