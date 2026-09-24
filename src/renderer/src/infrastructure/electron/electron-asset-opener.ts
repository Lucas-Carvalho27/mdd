import type { AssetOpener } from '@/application/ports/asset-opener'
import type { StorageError } from '@/application/ports/project-storage'
import type { Result } from '@/domain/shared/result'

/** `shell.openPath` no processo main, só para arquivos do projeto aberto. */
export class ElectronAssetOpener implements AssetOpener {
  open(path: string): Promise<Result<null, StorageError>> {
    return window.mdd.openPath(path)
  }
}
