import { isAbsolute, join, relative, resolve, sep } from 'path'
import { OUTPUT_DIRECTORY } from '../shared/ipc'

/**
 * Guarda a pasta do projeto aberto e resolve caminhos relativos a ela,
 * recusando qualquer caminho que escape da pasta.
 */
export class ProjectRoot {
  private rootPath: string | null = null

  open(rootPath: string): void {
    this.rootPath = resolve(rootPath)
  }

  get current(): string | null {
    return this.rootPath
  }

  /** Devolve o caminho absoluto, ou `null` se o caminho sair do projeto. */
  resolve(relativePath: string): string | null {
    const root = this.requireRoot()
    if (isAbsolute(relativePath)) return null
    const absolute = resolve(join(root, relativePath))
    return escapesRoot(relative(root, absolute)) ? null : absolute
  }

  /**
   * Como `resolve`, mas só para caminhos dentro da pasta de saída (`saida/`), nunca a própria
   * pasta. É o limite das operações que apagam ou movem pastas inteiras. No Windows, o
   * `relative` ignora maiúsculas: `SAIDA/x` fica dentro de `saida/`.
   */
  resolveInOutput(relativePath: string): string | null {
    const absolute = this.resolve(relativePath)
    if (absolute === null) return null
    const fromOutput = relative(join(this.requireRoot(), OUTPUT_DIRECTORY), absolute)
    return fromOutput === '' || escapesRoot(fromOutput) ? null : absolute
  }

  /**
   * O caminho relativo à raiz, com "/" como separador, de um arquivo escolhido no diálogo.
   * `null` para o que fica fora do projeto (outro disco, pasta vizinha) ou para a própria raiz.
   */
  toRelative(absolutePath: string): string | null {
    const fromRoot = relative(this.requireRoot(), resolve(absolutePath))
    if (fromRoot === '' || escapesRoot(fromRoot)) return null
    return fromRoot.split(sep).join('/')
  }

  private requireRoot(): string {
    if (this.rootPath === null) throw new Error('Nenhum projeto aberto.')
    return this.rootPath
  }
}

/** O caminho, relativo à raiz, sai dela? No Windows, outro disco volta como caminho absoluto. */
function escapesRoot(fromRoot: string): boolean {
  return fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)
}
