import type { OutputFolderOpener } from '@/application/ports/output-folder-opener'
import type { StorageError } from '@/application/ports/project-storage'
import type { Result } from '@/domain/shared/result'

/** `shell.openPath` no processo main, que só abre pastas dentro de `saida/`. */
export class ElectronOutputFolderOpener implements OutputFolderOpener {
  open(folder: string): Promise<Result<null, StorageError>> {
    return window.mdd.openPath(folder)
  }
}
