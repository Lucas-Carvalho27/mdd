import { useCallback } from 'react'
import type { GenerateOptions } from '@/application/use-cases/generate-product'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'

/**
 * Gera o produto da configuração aberta e abre o diálogo que o resultado pede: substituir a
 * pasta que já existe, ou os problemas. O sucesso aparece na faixa verde, sem diálogo.
 */
export function useGenerateProduct(
  onOpenDialog: (dialog: EditorDialog) => void
): (options?: GenerateOptions) => Promise<void> {
  const generate = useProjectStore((state) => state.generateProduct)
  return useCallback(
    async (options) => {
      const result = await generate(options)
      switch (result?.kind) {
        case 'needs-confirmation':
          onOpenDialog({ kind: 'replace-output', folder: result.folder })
          break
        case 'problems':
          onOpenDialog({
            kind: 'generation-problems',
            problems: result.problems,
            note: 'Nada foi gravado.'
          })
          break
        case 'write-failed':
          onOpenDialog({
            kind: 'generation-problems',
            problems: result.problems,
            note:
              result.previousAt === undefined
                ? 'Nenhuma pasta foi substituída.'
                : `A versão anterior ficou em ${result.previousAt}.`
          })
          break
      }
    },
    [generate, onOpenDialog]
  )
}
