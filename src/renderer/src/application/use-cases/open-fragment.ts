import { encodingProblem } from '@/domain/fragments/encoding'
import { fromFileContent } from '@/domain/fragments/text-format'
import { ok, type Result } from '@/domain/shared/result'
import type { FragmentDocument } from '../fragments/fragment-document'
import type { ProjectStorage, StorageError } from '../ports/project-storage'

const NOT_UTF_8 =
  'Este arquivo não está em UTF-8. Salve-o em UTF-8 em outro editor para poder editar aqui.'

/**
 * Lê um fragmento para o editor. Um arquivo em outra codificação fica só para leitura: os
 * acentos já chegaram trocados, e gravá-lo de volta os perderia de vez.
 */
export class OpenFragment {
  private readonly storage: ProjectStorage

  constructor(storage: ProjectStorage) {
    this.storage = storage
  }

  async execute(path: string): Promise<Result<FragmentDocument, StorageError>> {
    const read = await this.storage.readText(path)
    if (!read.ok) return read
    const { content, hash } = read.value
    const { text, format } = fromFileContent(content)
    const document: FragmentDocument = { path, text, format, saved: { text, hash } }
    return ok(
      encodingProblem(content) === undefined ? document : { ...document, readOnly: NOT_UTF_8 }
    )
  }
}
