import { FileCode2, Folder, Paperclip } from 'lucide-react'
import { cn } from 'cn'
import { isModified, type FragmentDocument } from '@/application/fragments/fragment-document'
import type { FragmentFile, FragmentFolder } from './fragment-tree'

interface FragmentTreeProps {
  readonly root: FragmentFolder
  readonly documents: ReadonlyMap<string, FragmentDocument>
  /** Os caminhos que são arquivo de algum asset. */
  readonly linked: ReadonlySet<string>
  readonly shownPath: string | null
  readonly onShow: (path: string) => void
}

/** As pastas do projeto com os fragmentos, todas abertas (Fase 6). */
export function FragmentTree(props: FragmentTreeProps): React.JSX.Element {
  return (
    <ul aria-label="Fragmentos do projeto" className="text-sm">
      <FolderContents folder={props.root} depth={0} {...props} />
    </ul>
  )
}

interface FolderContentsProps extends FragmentTreeProps {
  readonly folder: FragmentFolder
  readonly depth: number
}

function FolderContents({ folder, depth, ...props }: FolderContentsProps): React.JSX.Element {
  const indent = { paddingLeft: `${0.5 + depth * 0.875}rem` }
  return (
    <>
      {folder.folders.map((child) => (
        <li key={child.path}>
          <div
            data-fragment-folder={child.path}
            className="flex items-center gap-1.5 py-0.5 pr-2 text-muted-foreground"
            style={indent}
          >
            <Folder className="size-4 shrink-0" />
            <span className="truncate">{child.name}</span>
          </div>
          <ul>
            <FolderContents folder={child} depth={depth + 1} {...props} />
          </ul>
        </li>
      ))}
      {folder.files.map((file) => (
        <FileItem key={file.path} file={file} indent={indent} {...props} />
      ))}
    </>
  )
}

interface FileItemProps extends FragmentTreeProps {
  readonly file: FragmentFile
  readonly indent: React.CSSProperties
}

function FileItem({
  file,
  indent,
  documents,
  linked,
  shownPath,
  onShow
}: FileItemProps): React.JSX.Element {
  const document = documents.get(file.path)
  const shown = file.path === shownPath
  return (
    <li>
      <button
        type="button"
        data-fragment-path={file.path}
        aria-current={shown ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-1.5 py-0.5 pr-2 text-left',
          shown ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-accent/50'
        )}
        style={indent}
        onClick={() => onShow(file.path)}
      >
        <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
        {document !== undefined && isModified(document) && (
          <span title="Alterações não salvas">•</span>
        )}
        {document?.saved === null && (
          <span className="text-xs text-muted-foreground" title="Ainda não existe no disco">
            novo
          </span>
        )}
        {linked.has(file.path) && (
          <Paperclip
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-label="Vinculado a um asset"
          />
        )}
      </button>
    </li>
  )
}
