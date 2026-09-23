import type { PickedFolder } from '@/application/ports/project-folder-picker'
import type { StorageError } from '@/application/ports/project-storage'
import type { RecentProject, RecentProjects } from '@/application/ports/recent-projects'
import type { Result } from '@/domain/shared/result'

/** Lista de recentes mantida pelo processo main (SPEC §6.3). */
export class ElectronRecentProjects implements RecentProjects {
  list(): Promise<RecentProject[]> {
    return window.mdd.listRecentProjects()
  }

  reopen(rootPath: string): Promise<Result<PickedFolder, StorageError>> {
    return window.mdd.reopenProject(rootPath)
  }
}
