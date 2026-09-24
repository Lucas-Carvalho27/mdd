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

export type EntryKind = 'file' | 'directory'

export interface DirectoryEntry {
  name: string
  kind: EntryKind
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

/**
 * Pasta do projeto onde a geração grava os produtos (SPEC §3). Só dentro dela o main aceita
 * renomear e apagar pastas, e abrir uma pasta no gerenciador de arquivos.
 */
export const OUTPUT_DIRECTORY = 'saida'

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
  /** Se o caminho é um arquivo ou uma pasta; `not-found` quando não existe. */
  stat(relativePath: string): Promise<IpcResult<EntryKind>>
  /** Copia um arquivo, criando as pastas do destino e substituindo o que já estiver lá. */
  copy(fromPath: string, toPath: string): Promise<IpcResult<null>>
  /** Renomeia um arquivo ou uma pasta; os dois caminhos ficam dentro de `saida/`. */
  rename(fromPath: string, toPath: string): Promise<IpcResult<null>>
  /** Apaga a pasta com tudo o que tem dentro, só dentro de `saida/`. Se não existe, conta como apagada. */
  removeDirectory(relativePath: string): Promise<IpcResult<null>>
  /**
   * Diálogo nativo para escolher um arquivo, começando na pasta do projeto. Devolve o caminho
   * relativo, `null` quando cancelado, ou `outside-project` para um arquivo de fora.
   */
  pickFileInProject(title: string): Promise<IpcResult<string | null>>
  /**
   * Abre o arquivo do projeto no programa padrão do sistema, ou uma pasta de `saida/` no
   * gerenciador de arquivos.
   */
  openPath(relativePath: string): Promise<IpcResult<null>>
  /**
   * Confere se o conteúdo é XML bem-formado e segue o XSD; sem schema (`null`), só se é
   * bem-formado. Lista vazia = válido.
   */
  validateXml(
    schema: XmlSchemaName | null,
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
  stat: 'mdd:stat',
  copy: 'mdd:copy',
  rename: 'mdd:rename',
  removeDirectory: 'mdd:remove-directory',
  pickFileInProject: 'mdd:pick-file-in-project',
  openPath: 'mdd:open-path',
  validateXml: 'mdd:validate-xml'
} as const
