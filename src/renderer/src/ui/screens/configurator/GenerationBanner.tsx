import { CircleCheck, FolderOpen, X } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'

/**
 * A faixa verde da última geração (SPEC §7). Só aparece com a configuração gerada aberta:
 * some ao trocar de configuração e volta ao voltar para ela.
 */
export function GenerationBanner({
  configurationKey
}: {
  readonly configurationKey: string
}): React.JSX.Element | null {
  const last = useProjectStore((state) => state.lastGeneration)
  const openFolder = useProjectStore((state) => state.openGeneratedFolder)
  const dismiss = useProjectStore((state) => state.dismissLastGeneration)
  if (last === null || last.key !== configurationKey) return null
  const time = last.generatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <section
      data-banner="generated"
      className="flex items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50"
    >
      <CircleCheck className="size-4 shrink-0" />
      <span className="flex-1">
        Produto gerado em <code>{last.folder}/</code> às {time}
      </span>
      <Button size="sm" variant="outline" onClick={() => void openFolder()}>
        <FolderOpen /> Abrir pasta
      </Button>
      <Button size="icon-sm" variant="ghost" title="Dispensar" onClick={dismiss}>
        <X />
      </Button>
    </section>
  )
}
