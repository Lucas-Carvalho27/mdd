import type { AssetCatalog } from '@/domain/assets/asset-catalog'
import type { AssetFileStatus } from '@/domain/assets/asset-file-status'
import type { ProjectStorage } from '../ports/project-storage'

/**
 * O estado do arquivo de cada asset (SPEC §4.3), por caminho. Ok é um arquivo que existe;
 * não existir, ser uma pasta ou não dar para conferir contam como ausente. Um caminho usado
 * por vários assets é conferido uma vez só.
 */
export class CheckAssetFiles {
  private readonly storage: ProjectStorage

  constructor(storage: ProjectStorage) {
    this.storage = storage
  }

  async execute(catalog: AssetCatalog): Promise<ReadonlyMap<string, AssetFileStatus>> {
    const paths = [...new Set(catalog.assets.map((asset) => asset.path))]
    const statuses = await Promise.all(
      paths.map(async (path): Promise<[string, AssetFileStatus]> => {
        const entry = await this.storage.stat(path)
        return [path, entry.ok && entry.value === 'file' ? 'ok' : 'missing']
      })
    )
    return new Map(statuses)
  }
}
