import { fileError, type FileProblem } from '../file-problem'
import type { ProductFile } from '../ports/product-deriver'
import type { ProjectStorage } from '../ports/project-storage'

export type WriteProductResult =
  | { readonly kind: 'written' }
  | {
      readonly kind: 'failed'
      readonly problems: readonly FileProblem[]
      /**
       * Onde ficou a versão anterior, quando ela não voltou para o lugar. Sem isso, a pasta
       * anterior continua onde estava (ou não havia nenhuma).
       */
      readonly previousAt?: string
    }

/**
 * A pasta temporária e a troca (SPEC §4.4, passos 3 e 4). Grava tudo em
 * `saida/.<chave>.tmp/` e só então troca pela pasta do produto: renomeia a anterior para
 * `.old`, a temporária para o lugar dela, e apaga a `.old`. Uma falha no meio nunca deixa o
 * usuário sem nenhuma das duas versões. Não sabe nada de XML: serve para qualquer formato.
 */
export class WriteProductFolder {
  private readonly storage: ProjectStorage
  private readonly outputDirectory: string

  /** `outputDirectory` é a pasta de saída do projeto (SPEC §3), como `saida`. */
  constructor(storage: ProjectStorage, outputDirectory: string) {
    this.storage = storage
    this.outputDirectory = outputDirectory
  }

  /** A pasta do produto de uma configuração: `saida/loja-basica`. */
  folderOf(key: string): string {
    return `${this.outputDirectory}/${key}`
  }

  async exists(key: string): Promise<boolean> {
    return (await this.storage.stat(this.folderOf(key))).ok
  }

  async write(key: string, files: readonly ProductFile[]): Promise<WriteProductResult> {
    const folder = this.folderOf(key)
    const temporary = `${this.outputDirectory}/.${key}.tmp`
    const previous = `${this.outputDirectory}/.${key}.old`

    // Sobras de uma geração interrompida.
    for (const leftover of [temporary, previous]) {
      const removed = await this.storage.removeDirectory(leftover)
      if (!removed.ok) {
        return failed(
          leftover,
          `Não foi possível apagar a sobra de uma geração anterior: ${removed.error.message}`
        )
      }
    }

    for (const file of files) {
      const target = `${temporary}/${file.path}`
      const written =
        file.kind === 'text'
          ? await this.storage.writeText(target, file.content, { kind: 'overwrite' })
          : await this.storage.copy(file.path, target)
      if (!written.ok) {
        await this.storage.removeDirectory(temporary)
        return failed(file.path, `Não foi possível gravar ${target}: ${written.error.message}`)
      }
    }

    const hadPrevious = (await this.storage.stat(folder)).ok
    if (hadPrevious) {
      // O Windows não deixa renomear uma pasta com um arquivo aberto em outro programa.
      const moved = await this.storage.rename(folder, previous)
      if (!moved.ok) {
        await this.storage.removeDirectory(temporary)
        return failed(
          `${folder}/`,
          `Não foi possível substituir ${folder}/: feche os arquivos dessa pasta e gere de novo.`
        )
      }
    }

    const placed = await this.storage.rename(temporary, folder)
    if (!placed.ok) {
      const restored = hadPrevious ? (await this.storage.rename(previous, folder)).ok : true
      await this.storage.removeDirectory(temporary)
      return {
        ...failed(
          `${folder}/`,
          `Não foi possível colocar o produto em ${folder}/: ${placed.error.message}`
        ),
        ...(restored ? {} : { previousAt: `${previous}/` })
      }
    }

    // O produto novo já está no lugar: se a .old não sair agora, sai na próxima geração.
    if (hadPrevious) await this.storage.removeDirectory(previous)
    return { kind: 'written' }
  }
}

function failed(file: string, message: string): WriteProductResult & { kind: 'failed' } {
  return { kind: 'failed', problems: [fileError(file, message)] }
}
