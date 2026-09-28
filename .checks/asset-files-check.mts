// Estado dos arquivos dos assets (plano da Fase 4, Tarefa 2).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/asset-files-check.mts
import type { ProjectStorage, StorageEntryKind } from '@/application/ports/project-storage'
import { CheckAssetFiles } from '@/application/use-cases/check-asset-files'
import type { Asset } from '@/domain/assets/asset-catalog'
import { err, ok } from '@/domain/shared/result'

const log = (label: string, value: unknown): void => console.log(label.padEnd(30), '→', value)
const entries = new Map<string, StorageEntryKind>([
  ['docs/busca/busca.xml', 'file'],
  ['docs/img', 'directory']
])
const asked: string[] = []
const storage = {
  async stat(path: string) {
    asked.push(path)
    if (path === 'bloqueado.xml') return err({ code: 'io' as const, message: 'sem permissão' })
    const kind = entries.get(path)
    return kind === undefined ? err({ code: 'not-found' as const, message: path }) : ok(kind)
  }
} as unknown as ProjectStorage

const asset = (id: string, path: string): Asset => ({ id, kind: 'resource', path, anchor: 'loja' })
const statuses = await new CheckAssetFiles(storage).execute({
  assets: [
    asset('a', 'docs/busca/busca.xml'),
    asset('b', 'docs/busca/busca.xml'),
    asset('c', 'docs/pagamento/boleto.xml'),
    asset('d', 'docs/img'),
    asset('e', 'bloqueado.xml')
  ]
})
log('arquivo que existe', statuses.get('docs/busca/busca.xml'))
log('arquivo que não existe', statuses.get('docs/pagamento/boleto.xml'))
log('caminho que é pasta', statuses.get('docs/img'))
log('erro ao conferir', statuses.get('bloqueado.xml'))
log('caminhos conferidos', `${asked.length} (${statuses.size} no mapa)`)
log('catálogo vazio', (await new CheckAssetFiles(storage).execute({ assets: [] })).size)
