import { err, ok, type Result } from '@/domain/shared/result'
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

/** A versão anterior não voltou para o lugar: nada foi apagado. */
export interface RecoverFailure {
  readonly problems: readonly FileProblem[]
  /** Onde continua a versão anterior: `saida/.<chave>.old/`. */
  readonly previousAt: string
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

  /**
   * Põe de volta a versão anterior que ficou em `saida/.<chave>.old/` sem a pasta do produto:
   * a troca e a volta falharam, ou o app caiu entre as duas trocas. Sem isso, a escrita
   * seguinte a apagaria como sobra, sem perguntar. Uma `.old` junto da pasta do produto é
   * sobra de uma troca que deu certo, e fica para a escrita apagar.
   */
  async recover(key: string): Promise<Result<null, RecoverFailure>> {
    const folder = this.folderOf(key)
    const previous = this.previousOf(key)
    const lost = !(await this.exists(key)) && (await this.storage.stat(previous)).ok
    if (!lost) return ok(null)
    const restored = await this.storage.rename(previous, folder)
    if (restored.ok) return ok(null)
    return err({
      problems: [
        fileError(
          `${previous}/`,
          `Não foi possível pôr a versão anterior de volta em ${folder}/: ${restored.error.message}`
        )
      ],
      previousAt: `${previous}/`
    })
  }

  async write(key: string, files: readonly ProductFile[]): Promise<WriteProductResult> {
    const folder = this.folderOf(key)
    const temporary = `${this.outputDirectory}/.${key}.tmp`
    const previous = this.previousOf(key)

    // Sobras de uma geração interrompida. Uma `.old` sem a pasta do produto já voltou para o
    // lugar no `recover`.
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
        return failed(target, `Não foi possível gravar ${target}: ${written.error.message}`)
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

  /** Onde a versão anterior fica durante a troca: `saida/.loja-basica.old`. */
  private previousOf(key: string): string {
    return `${this.outputDirectory}/.${key}.old`
  }
}

function failed(file: string, message: string): WriteProductResult & { kind: 'failed' } {
  return { kind: 'failed', problems: [fileError(file, message)] }
}
