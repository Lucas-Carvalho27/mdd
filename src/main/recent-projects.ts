import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname } from 'path'
import type { RecentProject } from '../shared/ipc'

const MAX_RECENT = 10

/** Lista dos últimos projetos abertos, num JSON em `userData` (fora de qualquer projeto). */
export class RecentProjectsStore {
  private readonly file: string

  constructor(file: string) {
    this.file = file
  }

  list(): RecentProject[] {
    try {
      const data: unknown = JSON.parse(readFileSync(this.file, 'utf8'))
      return Array.isArray(data) ? data.filter(isRecentProject) : []
    } catch {
      return []
    }
  }

  includes(rootPath: string): boolean {
    return this.list().some((project) => project.rootPath === rootPath)
  }

  /** Coloca a pasta no topo da lista. */
  add(rootPath: string): void {
    const others = this.list().filter((project) => project.rootPath !== rootPath)
    this.write([{ rootPath, name: basename(rootPath) }, ...others].slice(0, MAX_RECENT))
  }

  remove(rootPath: string): void {
    this.write(this.list().filter((project) => project.rootPath !== rootPath))
  }

  private write(projects: RecentProject[]): void {
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(projects, null, 2), 'utf8')
  }
}

function isRecentProject(value: unknown): value is RecentProject {
  const candidate = value as RecentProject
  return typeof candidate?.rootPath === 'string' && typeof candidate?.name === 'string'
}
