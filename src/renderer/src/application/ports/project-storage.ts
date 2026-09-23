import type { Result } from '@/domain/shared/result'

export type StorageErrorCode =
  'no-project' | 'outside-project' | 'not-found' | 'changed-externally' | 'io'

export interface StorageError {
  readonly code: StorageErrorCode
  readonly message: string
}

export interface StoredText {
  readonly content: string
  /** Hash do conteúdo lido, usado para detectar alteração externa ao gravar. */
  readonly hash: string
}

export interface StorageEntry {
  readonly name: string
  readonly kind: 'file' | 'directory'
}

export type WritePrecondition =
  | { readonly kind: 'hash'; readonly expectedHash: string }
  | { readonly kind: 'must-not-exist' }
  | { readonly kind: 'overwrite' }

/** Arquivos da pasta do projeto aberto. Caminhos relativos, com "/" como separador. */
export interface ProjectStorage {
  readText(path: string): Promise<Result<StoredText, StorageError>>
  /** Devolve o hash do conteúdo gravado. */
  writeText(
    path: string,
    content: string,
    precondition: WritePrecondition
  ): Promise<Result<string, StorageError>>
  list(directory: string): Promise<Result<StorageEntry[], StorageError>>
}
