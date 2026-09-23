import { CreateProject } from '@/application/use-cases/create-project'
import { OpenProject } from '@/application/use-cases/open-project'
import { SaveProject } from '@/application/use-cases/save-project'
import { ElectronProjectFolderPicker } from '@/infrastructure/electron/electron-project-folder-picker'
import { ElectronProjectStorage } from '@/infrastructure/electron/electron-project-storage'
import { ElectronRecentProjects } from '@/infrastructure/electron/electron-recent-projects'
import { ElectronUnsavedChangesIndicator } from '@/infrastructure/electron/electron-unsaved-changes-indicator'
import { ElectronXmlSchemaValidator } from '@/infrastructure/electron/electron-xml-schema-validator'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'
import { createProjectStore, type ProjectStore } from '@/ui/stores/project-store'

/**
 * Único lugar que conhece as implementações concretas (Dependency Inversion):
 * cria os adapters, injeta nos casos de uso e entrega a store pronta para a interface.
 */
export function createAppStore(): ProjectStore {
  const storage = new ElectronProjectStorage()
  const validator = new ElectronXmlSchemaValidator()
  const picker = new ElectronProjectFolderPicker()
  const recents = new ElectronRecentProjects()
  const models = new XmlFeatureModelRepository(storage, validator)
  const repositories = {
    models,
    assets: new XmlAssetCatalogRepository(storage, validator),
    configurations: new XmlConfigurationRepository(storage, validator)
  }
  return createProjectStore({
    openProject: new OpenProject({ picker, recents, ...repositories }),
    createProject: new CreateProject({ picker, models }),
    saveProject: new SaveProject(repositories),
    recentProjects: recents,
    unsavedChanges: new ElectronUnsavedChangesIndicator()
  })
}
