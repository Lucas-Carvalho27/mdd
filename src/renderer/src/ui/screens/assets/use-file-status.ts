import { useProjectStore } from '@/ui/stores/project-store-context'

/** O estado conhecido do arquivo; `checking` antes da primeira conferência do caminho. */
export type ShownFileStatus = 'ok' | 'missing' | 'checking'

export function useFileStatus(path: string): ShownFileStatus {
  return useProjectStore((state) => state.assetFiles.get(path) ?? 'checking')
}
