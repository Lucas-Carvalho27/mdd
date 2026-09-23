import { OpenProject } from '@/application/use-cases/open-project'
import { SaveProject } from '@/application/use-cases/save-project'
import { ElectronProjectFolderPicker } from '@/infrastructure/electron/electron-project-folder-picker'
import { ElectronProjectStorage } from '@/infrastructure/electron/electron-project-storage'
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
  const repositories = {
    models: new XmlFeatureModelRepository(storage, validator),
    assets: new XmlAssetCatalogRepository(storage, validator),
    configurations: new XmlConfigurationRepository(storage, validator)
  }
  return createProjectStore({
    openProject: new OpenProject({ picker: new ElectronProjectFolderPicker(), ...repositories }),
    saveProject: new SaveProject(repositories)
  })
}
