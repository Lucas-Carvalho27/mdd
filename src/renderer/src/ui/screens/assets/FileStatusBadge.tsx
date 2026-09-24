import { cn } from 'cn'
import { useFileStatus, type ShownFileStatus } from './use-file-status'

const TEXT: Record<ShownFileStatus, string> = {
  ok: 'ok',
  missing: 'ausente',
  checking: 'verificando…'
}

/** O estado do arquivo do asset (SPEC §4.3): ok discreto, ausente em vermelho. */
export function FileStatusBadge({ path }: { readonly path: string }): React.JSX.Element {
  const status = useFileStatus(path)
  return (
    <span
      data-file-status={status}
      title={status === 'missing' ? 'O arquivo não existe (ou é uma pasta).' : undefined}
      className={cn(
        'shrink-0 rounded px-1.5 text-xs',
        status === 'missing'
          ? 'bg-destructive/10 font-medium text-destructive'
          : 'text-muted-foreground'
      )}
    >
      {TEXT[status]}
    </span>
  )
}
