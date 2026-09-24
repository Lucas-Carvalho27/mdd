import type { Result } from '@/domain/shared/result'
import type { StorageError } from './project-storage'

/** Abre um arquivo do projeto no programa padrão do sistema (SPEC §6.2). */
export interface AssetOpener {
  open(path: string): Promise<Result<null, StorageError>>
}
