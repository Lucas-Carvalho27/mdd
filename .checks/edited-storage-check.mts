// O armazenamento da visualização (Fase 8): o texto do editor no lugar do disco, só para os
// fragmentos abertos com alteração.
//   npx tsx --tsconfig tsconfig.web.json .checks/edited-storage-check.mts
import { EditedFragmentsStorage } from '@/application/fragments/edited-fragments-storage'
import { memoryFolder } from './memory-folder.mts'

const folder = memoryFolder({
  'docs/a.html': '<p>disco</p>',
  'docs/b.html': '<p>b no disco</p>',
  'img/x.png': 'png'
})
const storage = new EditedFragmentsStorage(
  folder.storage,
  new Map([
    ['docs/a.html', '<p>editor</p>'],
    ['Docs/Novo.html', '<p>novo, só no editor</p>']
  ])
)
const read = async (path: string): Promise<string> => {
  const result = await storage.readText(path)
  return result.ok ? JSON.stringify(result.value.content) : `erro ${result.error.code}`
}
const kind = async (path: string): Promise<string> => {
  const result = await storage.stat(path)
  return result.ok ? result.value : `erro ${result.error.code}`
}
const log = (label: string, value: unknown): void => console.log(label.padEnd(28), '→', value)

log('docs/a.html (editado)', await read('docs/a.html'))
log('DOCS/A.HTML (sem caixa)', await read('DOCS/A.HTML'))
log('docs/b.html (só no disco)', await read('docs/b.html'))
log('docs/novo.html (novo)', await read('docs/novo.html'))
log('docs/falta.html', await read('docs/falta.html'))
log('stat docs/novo.html', await kind('docs/novo.html'))
log('stat img/x.png', await kind('img/x.png'))
log('stat img/falta.png', await kind('img/falta.png'))
log('disco de a.html, intacto', folder.show('docs/a.html'))
