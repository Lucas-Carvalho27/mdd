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

/** Excluir só se o arquivo ainda estiver com este hash, ou excluir de qualquer jeito. */
export type RemovePrecondition = { kind: 'hash'; expectedHash: string } | { kind: 'overwrite' }

/** Schemas de docs/schemas/ usados na leitura dos arquivos do projeto. */
export type XmlSchemaName = 'feature-model' | 'assets' | 'configuration'

export interface XmlSchemaIssue {
  line?: number
  message: string
}

export interface RecentProject {
  rootPath: string
  name: string
}

export interface MddApi {
  openProjectFolder(): Promise<IpcResult<OpenedProject | null>>
  /** Os últimos projetos abertos, do mais recente para o mais antigo. */
  listRecentProjects(): Promise<RecentProject[]>
  /** Reabre uma pasta que está na lista de recentes. */
  reopenProject(rootPath: string): Promise<IpcResult<OpenedProject>>
  /** Avisa o main se há alterações não salvas, para confirmar antes de fechar a janela. */
  setUnsavedChanges(unsaved: boolean): void
  list(relativeDir: string): Promise<IpcResult<DirectoryEntry[]>>
  readText(relativePath: string): Promise<IpcResult<TextFile>>
  writeText(
    relativePath: string,
    content: string,
    precondition: WritePrecondition
  ): Promise<IpcResult<{ hash: string }>>
  /** Exclui o arquivo. Um arquivo que já não existe conta como excluído. */
  remove(relativePath: string, precondition: RemovePrecondition): Promise<IpcResult<null>>
  /** Confere se o conteúdo é XML bem-formado e segue o XSD. Lista vazia = válido. */
  validateXml(
    schema: XmlSchemaName,
    fileName: string,
    content: string
  ): Promise<IpcResult<XmlSchemaIssue[]>>
}

export const IpcChannel = {
  openProjectFolder: 'mdd:open-project-folder',
  listRecentProjects: 'mdd:list-recent-projects',
  reopenProject: 'mdd:reopen-project',
  setUnsavedChanges: 'mdd:set-unsaved-changes',
  list: 'mdd:list',
  readText: 'mdd:read-text',
  writeText: 'mdd:write-text',
  remove: 'mdd:remove',
  validateXml: 'mdd:validate-xml'
} as const
