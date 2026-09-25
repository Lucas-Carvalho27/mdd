export interface FragmentFolder {
  readonly name: string
  readonly path: string
  readonly folders: readonly FragmentFolder[]
  readonly files: readonly FragmentFile[]
}

export interface FragmentFile {
  readonly name: string
  readonly path: string
}

interface GrowingFolder {
  readonly name: string
  readonly path: string
  readonly folders: Map<string, GrowingFolder>
  readonly files: FragmentFile[]
}

/**
 * As pastas dos caminhos, com as pastas antes dos arquivos e cada grupo em ordem alfabética.
 * Como no Windows, "Docs/" e "docs/" são a mesma pasta.
 */
export function buildFragmentTree(paths: readonly string[]): FragmentFolder {
  const root: GrowingFolder = { name: '', path: '', folders: new Map(), files: [] }
  for (const path of paths) {
    const segments = path.split('/')
    let folder = root
    for (let depth = 1; depth < segments.length; depth++) {
      const key = segments[depth - 1].toLowerCase()
      let child = folder.folders.get(key)
      if (child === undefined) {
        const childPath = segments.slice(0, depth).join('/')
        child = { name: segments[depth - 1], path: childPath, folders: new Map(), files: [] }
        folder.folders.set(key, child)
      }
      folder = child
    }
    folder.files.push({ name: segments[segments.length - 1], path })
  }
  return sorted(root)
}

function sorted(folder: GrowingFolder): FragmentFolder {
  const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name)
  return {
    name: folder.name,
    path: folder.path,
    folders: [...folder.folders.values()].map(sorted).sort(byName),
    files: [...folder.files].sort(byName)
  }
}
