import type { Result } from '@/domain/shared/result'
import type { PickedFolder } from './project-folder-picker'
import type { StorageError } from './project-storage'

export interface RecentProject {
  readonly rootPath: string
  readonly name: string
}

/** Os últimos projetos abertos, guardados fora do projeto (SPEC §7). */
export interface RecentProjects {
  /** Do mais recente para o mais antigo. */
  list(): Promise<RecentProject[]>
  /** Volta a usar a pasta como raiz do projeto, sem diálogo. */
  reopen(rootPath: string): Promise<Result<PickedFolder, StorageError>>
}
