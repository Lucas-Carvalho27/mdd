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
    if (this.rootPath === null) throw new Error('Nenhum projeto aberto.')
    if (isAbsolute(relativePath)) return null
    const absolute = resolve(join(this.rootPath, relativePath))
    const fromRoot = relative(this.rootPath, absolute)
    const escapes = fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)
    return escapes ? null : absolute
  }
}
