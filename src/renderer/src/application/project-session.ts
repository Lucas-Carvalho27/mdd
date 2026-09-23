import type { Project } from '@/domain/project/project'
import type { PickedFolder } from './ports/project-folder-picker'
import type { ExpectedHash } from './ports/repositories'

/** Hashes dos arquivos como estavam no disco na última leitura ou gravação. */
export interface FileHashes {
  readonly model: string
  /** `null` enquanto o assets.xml não existe no disco. */
  readonly assets: ExpectedHash
  /** Por chave de configuração. */
  readonly configurations: Readonly<Record<string, string>>
}

/** Projeto aberto: o conteúdo e o que é preciso para gravá-lo com segurança. */
export interface ProjectSession {
  readonly folder: PickedFolder
  readonly project: Project
  readonly hashes: FileHashes
}
