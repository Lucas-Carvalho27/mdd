import type { ProjectFilePicker } from '@/application/ports/project-file-picker'
import type { StorageError } from '@/application/ports/project-storage'
import type { Result } from '@/domain/shared/result'

/** Diálogo nativo de arquivo; o processo main converte a escolha para caminho relativo. */
export class ElectronProjectFilePicker implements ProjectFilePicker {
  pickFile(title: string): Promise<Result<string | null, StorageError>> {
    return window.mdd.pickFileInProject(title)
  }
}
