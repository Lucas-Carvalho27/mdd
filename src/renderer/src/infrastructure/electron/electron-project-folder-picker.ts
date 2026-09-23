import type { PickedFolder, ProjectFolderPicker } from '@/application/ports/project-folder-picker'
import type { StorageError } from '@/application/ports/project-storage'
import type { Result } from '@/domain/shared/result'

/** Diálogo nativo de pasta; o processo main passa a usar a pasta escolhida como raiz. */
export class ElectronProjectFolderPicker implements ProjectFolderPicker {
  pick(): Promise<Result<PickedFolder | null, StorageError>> {
    return window.mdd.openProjectFolder()
  }
}
