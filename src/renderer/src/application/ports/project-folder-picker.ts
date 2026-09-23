import type { Result } from '@/domain/shared/result'
import type { StorageError } from './project-storage'

export interface PickedFolder {
  /** Caminho absoluto, só para exibição. */
  readonly rootPath: string
  readonly name: string
}

/** Pede ao usuário a pasta do projeto e passa a usá-la como raiz do `ProjectStorage`. */
export interface ProjectFolderPicker {
  /** `null` quando o usuário cancela. */
  pick(): Promise<Result<PickedFolder | null, StorageError>>
}
