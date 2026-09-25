import { useMemo } from 'react'
import { isModified } from '@/application/fragments/fragment-document'
import { fragmentTreePaths } from '@/ui/stores/fragments-actions'
import { useProjectStore } from '@/ui/stores/project-store-context'

/** Barra de status da aba Fragmentos: quantos há e quantos têm alteração não salva. */
export function FragmentStatusBar(): React.JSX.Element {
  const files = useProjectStore((state) => state.fragmentFiles)
  const documents = useProjectStore((state) => state.fragmentDocuments)
  const count = useMemo(() => fragmentTreePaths(files, documents).length, [files, documents])
  const modified = useMemo(() => [...documents.values()].filter(isModified).length, [documents])
  return (
    <span data-fragments-summary>
      {count} {count === 1 ? 'fragmento' : 'fragmentos'}
      {modified > 0 && ` · ${modified} com alterações`}
    </span>
  )
}
