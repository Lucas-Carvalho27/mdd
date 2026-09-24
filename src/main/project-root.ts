import { isAbsolute, join, relative, resolve, sep } from 'path'

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
