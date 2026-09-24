import { CheckAssetFiles } from '@/application/use-cases/check-asset-files'
import { CreateProject } from '@/application/use-cases/create-project'
import { GenerateProduct } from '@/application/use-cases/generate-product'
import { OpenProject } from '@/application/use-cases/open-project'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { SaveProject } from '@/application/use-cases/save-project'
import { WriteProductFolder } from '@/application/use-cases/write-product-folder'
import { ElectronAssetOpener } from '@/infrastructure/electron/electron-asset-opener'
import { ElectronOutputFolderOpener } from '@/infrastructure/electron/electron-output-folder-opener'
import { ElectronProjectFilePicker } from '@/infrastructure/electron/electron-project-file-picker'
import { ElectronProjectFolderPicker } from '@/infrastructure/electron/electron-project-folder-picker'
import { ElectronProjectStorage } from '@/infrastructure/electron/electron-project-storage'
import { ElectronRecentProjects } from '@/infrastructure/electron/electron-recent-projects'
import { ElectronUnsavedChangesIndicator } from '@/infrastructure/electron/electron-unsaved-changes-indicator'
import { ElectronXmlSchemaValidator } from '@/infrastructure/electron/electron-xml-schema-validator'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { SystemClock } from '@/infrastructure/system/system-clock'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import { createProjectStore, type ProjectStore } from '@/ui/stores/project-store'
import { OUTPUT_DIRECTORY } from '../../../../shared/ipc'

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
  // Uma só resolução para a tela e a geração: o resultado guardado serve às duas.
  const resolveConfiguration = new ResolveConfiguration(new LogicSolverConstraintSolver())
  return createProjectStore({
    openProject: new OpenProject({ picker, recents, ...repositories }),
    createProject: new CreateProject({ picker, models }),
    saveProject: new SaveProject(repositories),
    resolveConfiguration,
    recentProjects: recents,
    unsavedChanges: new ElectronUnsavedChangesIndicator(),
    checkAssetFiles: new CheckAssetFiles(storage),
    filePicker: new ElectronProjectFilePicker(),
    assetOpener: new ElectronAssetOpener(),
    generateProduct: new GenerateProduct({
      resolveConfiguration,
      deriver: new XmlProductDeriver(storage, validator),
      writer: new WriteProductFolder(storage, OUTPUT_DIRECTORY),
      clock: new SystemClock()
    }),
    outputFolderOpener: new ElectronOutputFolderOpener()
  })
}
