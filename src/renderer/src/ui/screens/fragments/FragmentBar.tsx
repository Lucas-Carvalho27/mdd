import { Link2, Paperclip, Undo2 } from 'lucide-react'
import { isModified, type FragmentDocument } from '@/application/fragments/fragment-document'
import { assetLabel, type Asset } from '@/domain/assets/asset-catalog'
import { Button } from '@/ui/components/ui/button'

interface FragmentBarProps {
  readonly document: FragmentDocument
  /** Os assets deste arquivo, na ordem do assets.xml. */
  readonly assets: readonly Asset[]
  readonly onLink: () => void
  readonly onDiscard: () => void
}

/** A barra acima do editor: o caminho, o vínculo (ou "Vincular…") e "Descartar alterações". */
export function FragmentBar({
  document,
  assets,
  onLink,
  onDiscard
}: FragmentBarProps): React.JSX.Element {
  const [first] = assets
  return (
    <>
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <code data-fragment-bar className="min-w-0 flex-1 truncate text-sm">
          {document.path}
          {isModified(document) && <span title="Alterações não salvas"> •</span>}
        </code>
        {first !== undefined ? (
          <span
            data-fragment-link
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <Paperclip className="size-3.5" />
            {assetLabel(first)} · <code>{first.anchor}</code>
            {assets.length > 1 && ` +${assets.length - 1}`}
          </span>
        ) : (
          <Button size="sm" variant="outline" disabled={document.saved === null} onClick={onLink}>
            <Link2 /> Vincular a uma feature…
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={!isModified(document)} onClick={onDiscard}>
          <Undo2 /> Descartar alterações
        </Button>
      </div>
      {document.readOnly !== undefined && (
        <p className="border-b bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {document.readOnly}
        </p>
      )}
    </>
  )
}
