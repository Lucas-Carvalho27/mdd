import type { Result } from '@/domain/shared/result'
import type { StorageError } from './project-storage'

/** Escolha de um arquivo dentro do projeto aberto (SPEC §6.2), para vincular a um asset. */
export interface ProjectFilePicker {
  /**
   * O caminho relativo do arquivo escolhido, ou `null` quando o usuário cancela. Um arquivo
   * fora da pasta do projeto volta como erro `outside-project`.
   */
  pickFile(title: string): Promise<Result<string | null, StorageError>>
}
