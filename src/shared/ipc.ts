/**
 * Contrato da API que o preload expõe em `window.mdd` (docs/SPEC.md §6.3).
 * Todos os caminhos são relativos à pasta do projeto aberto e usam "/" como separador.
 */

export type IpcErrorCode =
  'no-project' | 'outside-project' | 'not-found' | 'changed-externally' | 'io'

export interface IpcError {
  code: IpcErrorCode
  message: string
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: IpcError }

export interface OpenedProject {
  /** Caminho absoluto da pasta, só para exibição. */
  rootPath: string
  name: string
}

export interface DirectoryEntry {
  name: string
  kind: 'file' | 'directory'
}

export interface TextFile {
  content: string
  /** SHA-256 do conteúdo, usado para detectar alteração externa ao salvar. */
  hash: string
}

export type WritePrecondition =
  { kind: 'hash'; expectedHash: string } | { kind: 'must-not-exist' } | { kind: 'overwrite' }

export interface MddApi {
  openProjectFolder(): Promise<IpcResult<OpenedProject | null>>
  list(relativeDir: string): Promise<IpcResult<DirectoryEntry[]>>
  readText(relativePath: string): Promise<IpcResult<TextFile>>
  writeText(
    relativePath: string,
    content: string,
    precondition: WritePrecondition
  ): Promise<IpcResult<{ hash: string }>>
}

export const IpcChannel = {
  openProjectFolder: 'mdd:open-project-folder',
  list: 'mdd:list',
  readText: 'mdd:read-text',
  writeText: 'mdd:write-text'
} as const
