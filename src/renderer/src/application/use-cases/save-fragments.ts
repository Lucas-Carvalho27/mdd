import { toFileContent } from '@/domain/fragments/text-format'
import { fileError, type FileProblem } from '../file-problem'
import {
  isModified,
  type FragmentDocument,
  type SavedFragment
} from '../fragments/fragment-document'
import type { FragmentChecker } from '../ports/fragment-checker'
import type { ProjectStorage, WritePrecondition } from '../ports/project-storage'
import type { SaveOptions } from './save-project'

export interface SaveFragmentsResult {
  /** O que foi gravado, por caminho. */
  readonly saved: ReadonlyMap<string, SavedFragment>
  /** A conferência de cada fragmento gravado; lista vazia = sem problema. */
  readonly checked: ReadonlyMap<string, readonly FileProblem[]>
  /** Fragmentos alterados fora do app, que não foram gravados (SPEC §8). */
  readonly conflicts: string[]
  /** Outros erros de gravação. */
  readonly problems: FileProblem[]
}

export interface SaveFragmentsDependencies {
  readonly storage: ProjectStorage
  readonly checker: FragmentChecker
}

/**
 * Grava os fragmentos alterados no formato de cada arquivo, com as precondições do resto do
 * projeto: o disco precisa estar como na última leitura, e um arquivo novo não pode existir.
 * Um fragmento com erro de XML é gravado mesmo assim; a conferência vai junto no resultado.
 */
export class SaveFragments {
  private readonly deps: SaveFragmentsDependencies

  constructor(deps: SaveFragmentsDependencies) {
    this.deps = deps
  }

  async execute(
    documents: readonly FragmentDocument[],
    options: SaveOptions = { overwrite: false }
  ): Promise<SaveFragmentsResult> {
    const saved = new Map<string, SavedFragment>()
    const checked = new Map<string, readonly FileProblem[]>()
    const conflicts: string[] = []
    const problems: FileProblem[] = []

    for (const document of documents) {
      if (!isModified(document) || document.readOnly !== undefined) continue
      const content = toFileContent(document.text, document.format)
      const written = await this.deps.storage.writeText(
        document.path,
        content,
        preconditionFor(document, options)
      )
      if (!written.ok) {
        if (written.error.code === 'changed-externally') conflicts.push(document.path)
        else problems.push(fileError(document.path, written.error.message))
        continue
      }
      saved.set(document.path, { text: document.text, hash: written.value })
      checked.set(document.path, await this.deps.checker.check(document.path, content))
    }
    return { saved, checked, conflicts, problems }
  }
}

function preconditionFor(document: FragmentDocument, options: SaveOptions): WritePrecondition {
  if (options.overwrite) return { kind: 'overwrite' }
  if (document.saved === null) return { kind: 'must-not-exist' }
  return { kind: 'hash', expectedHash: document.saved.hash }
}
