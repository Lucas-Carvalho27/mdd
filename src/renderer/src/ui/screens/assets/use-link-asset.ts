import { useCallback } from 'react'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'

/**
 * Vincular um arquivo: o diálogo nativo primeiro e, com um arquivo do projeto, o diálogo
 * "Vincular arquivo" com a âncora indicada. Cancelar ou escolher um arquivo de fora para aí.
 */
export function useLinkAsset(
  onOpenDialog: (dialog: EditorDialog) => void
): (anchor: string) => Promise<void> {
  const pickAssetFile = useProjectStore((state) => state.pickAssetFile)
  return useCallback(
    async (anchor) => {
      const path = await pickAssetFile('Vincular arquivo')
      if (path !== null) onOpenDialog({ kind: 'link-asset', path, anchor })
    },
    [pickAssetFile, onOpenDialog]
  )
}
