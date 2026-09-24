import type { StoreApi } from 'zustand/vanilla'
import * as cmd from '@/application/editing/commands'
import type { AssetOpener } from '@/application/ports/asset-opener'
import type { ProjectFilePicker } from '@/application/ports/project-file-picker'
import { fileNameOf, type Asset, type AssetCatalog } from '@/domain/assets/asset-catalog'
import type { AssetDraft } from '@/domain/assets/asset-edits'
import type { AssetFileStatus } from '@/domain/assets/asset-file-status'
import type { ProjectState } from './project-store'

/** Os serviços da aba Assets; a composition root entrega as implementações. */
export interface AssetsServices {
  readonly checkAssetFiles: {
    execute(catalog: AssetCatalog): Promise<ReadonlyMap<string, AssetFileStatus>>
  }
  readonly filePicker: ProjectFilePicker
  readonly assetOpener: AssetOpener
}

/**
 * Estado e ações da aba Assets (SPEC §7). As edições passam pelo histórico, como as do
 * modelo; aqui ficam a seleção, o estado dos arquivos e o que fala com o disco e o sistema.
 */
export interface AssetsState {
  readonly selectedAssetId: string | null
  /**
   * O estado de cada caminho na última conferência. Um caminho que não está no mapa ainda não
   * foi conferido (a interface mostra "verificando…").
   */
  readonly assetFiles: ReadonlyMap<string, AssetFileStatus>

  selectAsset(assetId: string | null): void
  /** Confere todos os arquivos. Se uma conferência mais nova já respondeu, esta é descartada. */
  checkAssetFiles(): Promise<void>
  /** O diálogo de arquivo: o caminho relativo, ou `null` (cancelado, ou recusado com aviso). */
  pickAssetFile(title: string): Promise<string | null>
  /** Vincula e seleciona o asset novo; `false` se o vínculo foi recusado. */
  linkAsset(draft: AssetDraft): boolean
  /** Escolhe outro arquivo para o asset. */
  relinkAsset(assetId: string): Promise<void>
  openAsset(path: string): Promise<void>
}

export const ASSETS_CLOSED = {
  selectedAssetId: null,
  assetFiles: new Map<string, AssetFileStatus>()
} satisfies Partial<AssetsState>

/** O asset selecionado, se ainda existir (desfazer pode tê-lo tirado do catálogo). */
export function selectedAsset(state: ProjectState): Asset | null {
  const id = state.selectedAssetId
  if (state.session === null || id === null) return null
  return state.session.project.assets.assets.find((asset) => asset.id === id) ?? null
}

type SetState = StoreApi<ProjectState>['setState']

export function createAssetsActions(
  set: SetState,
  get: () => ProjectState,
  services: AssetsServices
): Omit<AssetsState, keyof typeof ASSETS_CLOSED> {
  // Cada conferência recebe um número; só a resposta da última é usada.
  let lastCheck = 0

  return {
    selectAsset(assetId) {
      set({ selectedAssetId: assetId })
    },

    async checkAssetFiles() {
      const session = get().session
      if (session === null) return
      const check = ++lastCheck
      const statuses = await services.checkAssetFiles.execute(session.project.assets)
      // Outra conferência começou depois desta, ou o projeto foi fechado ou trocado.
      if (check !== lastCheck || get().session?.folder !== session.folder) return
      set({ assetFiles: statuses })
    },

    async pickAssetFile(title) {
      const picked = await services.filePicker.pickFile(title)
      if (picked.ok) return picked.value
      set({ notice: `Arquivo recusado: ${picked.error.message}` })
      return null
    },

    linkAsset(draft) {
      if (!get().run(cmd.linkAsset(draft))) return false
      set({ selectedAssetId: draft.id })
      return true
    },

    async relinkAsset(assetId) {
      const path = await get().pickAssetFile('Trocar o arquivo do asset')
      if (path === null) return
      get().run(cmd.relinkAsset(assetId, path))
    },

    async openAsset(path) {
      const opened = await services.assetOpener.open(path)
      if (opened.ok) return
      set({ notice: `Não foi possível abrir "${fileNameOf(path)}": ${opened.error.message}` })
      // O arquivo pode ter sumido depois da última conferência.
      if (opened.error.code === 'not-found') void get().checkAssetFiles()
    }
  }
}
