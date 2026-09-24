import type { Result } from '@/domain/shared/result'
import type { StorageError } from './project-storage'

/** Abre uma pasta gerada (`saida/<chave>`) no gerenciador de arquivos do sistema. */
export interface OutputFolderOpener {
  open(folder: string): Promise<Result<null, StorageError>>
}
