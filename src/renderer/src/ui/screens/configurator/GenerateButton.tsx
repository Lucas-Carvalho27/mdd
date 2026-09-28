import { FileOutput } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { generationBlockedReason } from './configuration-texts'
import { useGenerateProduct } from './use-generate-product'

/**
 * "Gerar produto" (SPEC §7), nas abas Configurações e Páginas: só com a configuração
 * completa; a dica diz o que falta.
 */
export function GenerateButton({
  configurationKey,
  onOpenDialog
}: {
  readonly configurationKey: string
  readonly onOpenDialog: (dialog: EditorDialog) => void
}): React.JSX.Element {
  const resolution = useProjectStore((state) => state.openResolution())
  const generating = useProjectStore((state) => state.generating)
  const generate = useGenerateProduct(onOpenDialog)
  const blocked = resolution === null ? null : generationBlockedReason(resolution)

  return (
    // Um botão desligado não mostra a dica: ela fica no elemento de fora.
    <span title={blocked ?? undefined}>
      <Button
        size="sm"
        disabled={resolution === null || blocked !== null || generating}
        onClick={() => void generate(configurationKey)}
      >
        <FileOutput /> {generating ? 'Gerando…' : 'Gerar produto'}
      </Button>
    </span>
  )
}
