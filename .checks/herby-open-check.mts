// Abre o exemplo herby como o app abre (XML, XSD e regras do domínio), sem a interface.
//   npx tsx --tsconfig tsconfig.web.json .checks/herby-open-check.mts
import { resolve } from 'node:path'
import { OpenProject } from '@/application/use-cases/open-project'
import { ok } from '@/domain/shared/result'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'
import { DiskStorage, NodeXmlValidator } from './generation-support.mts'

const folder = resolve('docs/examples/herby')
const storage = new DiskStorage(folder)
const validator = new NodeXmlValidator()
const open = new OpenProject({
  picker: { pick: async () => ok({ rootPath: folder, name: 'herby' }) },
  recents: { list: async () => [], reopen: async () => ok({ rootPath: folder, name: 'herby' }) },
  models: new XmlFeatureModelRepository(storage, validator),
  assets: new XmlAssetCatalogRepository(storage, validator),
  configurations: new XmlConfigurationRepository(storage, validator)
} as never)
const result = await open.execute()
console.log(result.status)
if (result.status === 'opened') {
  const { project } = result.session
  console.log(
    `${project.assets.assets.length} assets, ${project.configurations.length} configurações, avisos: ${result.warnings.length}`
  )
} else {
  console.log(JSON.stringify(result, null, 1).slice(0, 1500))
  process.exitCode = 1
}
