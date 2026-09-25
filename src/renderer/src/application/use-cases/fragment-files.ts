import {
  checkNewFragmentPath,
  isFragmentFile,
  isFragmentFolder
} from '@/domain/fragments/fragment-path'
import { err, ok, type Result } from '@/domain/shared/result'
import type { ProjectStorage } from '../ports/project-storage'

/**
 * Os fragmentos na pasta do projeto (Fase 6): a lista da árvore e o caminho de um arquivo
 * novo. As duas coisas dependem das mesmas regras e do nome da pasta de saída.
 */
export class FragmentFiles {
  private readonly storage: ProjectStorage
  private readonly outputDirectory: string

  constructor(storage: ProjectStorage, outputDirectory: string) {
    this.storage = storage
    this.outputDirectory = outputDirectory
  }

  /** Os caminhos de todos os fragmentos do projeto, pasta por pasta; ou o motivo da falha. */
  async list(): Promise<Result<string[], string>> {
    const found: string[] = []
    const folders = ['']
    for (let index = 0; index < folders.length; index++) {
      const folder = folders[index]
      const listed = await this.storage.list(folder)
      if (!listed.ok) {
        // Uma pasta apagada enquanto a lista era lida.
        if (listed.error.code === 'not-found' && folder !== '') continue
        return err(listed.error.message)
      }
      for (const entry of listed.value) {
        const path = folder === '' ? entry.name : `${folder}/${entry.name}`
        if (entry.kind === 'directory') {
          if (isFragmentFolder(path, this.outputDirectory)) folders.push(path)
        } else if (isFragmentFile(path, this.outputDirectory)) {
          found.push(path)
        }
      }
    }
    return ok(found)
  }

  /** O caminho de um fragmento novo, conferido contra os que já existem; ou o motivo da recusa. */
  checkNewPath(input: string, existing: readonly string[]): Result<string, string> {
    return checkNewFragmentPath(input, this.outputDirectory, existing)
  }
}
