import { useCallback, useEffect, useRef } from 'react'
import { setDiagnostics } from '@codemirror/lint'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { FileProblem } from '@/application/file-problem'
import type { FragmentDocument } from '@/application/fragments/fragment-document'
import type { FragmentEditorStates } from './fragment-editor-states'
import { FragmentProblems } from './FragmentProblems'
import { createFragmentEditorState, diagnosticsFor } from './fragment-editor-setup'

interface FragmentEditorProps {
  readonly document: FragmentDocument
  /** `undefined` enquanto a primeira conferência não respondeu. */
  readonly problems: readonly FileProblem[] | undefined
  /** Onde fica o estado de cada arquivo quando ele não está no editor. */
  readonly states: FragmentEditorStates
  readonly onChange: (path: string, text: string) => void
  /** Os marcadores de atributo do modelo (`feature.atributo`), sugeridos nos fragmentos HTML. */
  readonly attributeMarkers: readonly string[]
  /** Uma linha a mostrar quando este arquivo estiver no editor (um problema da aba Páginas). */
  readonly reveal: { readonly path: string; readonly line: number } | null
  readonly onRevealed: () => void
}

/**
 * O editor de um fragmento, com o CodeMirror. Ao trocar de arquivo ou sair da aba, o estado do
 * arquivo (com o desfazer e a seleção) fica guardado em `states`, e volta com ele. Um texto que
 * mudou fora do editor (descartar, atualizar, recarregar) recomeça o estado daquele arquivo.
 */
export function FragmentEditor({
  document,
  problems,
  states,
  onChange,
  attributeMarkers,
  reveal,
  onRevealed
}: FragmentEditorProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  // O estado de cada arquivo dura mais que uma renderização: a sugestão lê o modelo da vez.
  const markers = useRef(attributeMarkers)
  useEffect(() => {
    markers.current = attributeMarkers
  }, [attributeMarkers])
  const view = useRef<EditorView | null>(null)
  const shownPath = useRef<string | null>(null)
  const { path, text } = document
  const readOnly = document.readOnly !== undefined

  useEffect(() => {
    const created = new EditorView({ parent: host.current ?? undefined })
    view.current = created
    return () => {
      if (shownPath.current !== null) states.set(shownPath.current, created.state)
      created.destroy()
      view.current = null
      shownPath.current = null
    }
  }, [states])

  // Mostra o arquivo: o estado guardado, se o texto ainda for o mesmo, ou um estado novo.
  useEffect(() => {
    const current = view.current
    if (current === null) return
    if (shownPath.current !== null) states.set(shownPath.current, current.state)
    let next = states.get(path)
    if (next === undefined || next.doc.toString() !== text || next.readOnly !== readOnly) {
      next = createFragmentEditorState(path, text, {
        readOnly,
        onChange: (changed) => onChange(path, changed),
        attributeMarkers: () => markers.current
      })
    }
    if (next !== current.state) current.setState(next)
    states.set(path, next)
    shownPath.current = path
  }, [states, path, text, readOnly, onChange])

  // As marcas dos problemas; um estado novo começa sem elas.
  useEffect(() => {
    const current = view.current
    if (current === null) return
    current.dispatch(
      setDiagnostics(current.state, diagnosticsFor(current.state.doc, problems ?? []))
    )
  }, [states, path, text, readOnly, problems])

  const goToLine = useCallback((line: number): void => {
    const current = view.current
    if (current === null) return
    const { doc } = current.state
    const target = doc.line(Math.min(Math.max(line, 1), doc.lines))
    current.dispatch({
      selection: EditorSelection.cursor(target.from),
      effects: EditorView.scrollIntoView(target.from, { y: 'center' })
    })
    current.focus()
  }, [])

  // A linha pedida pela aba Páginas, quando o arquivo dela já está no editor.
  useEffect(() => {
    if (reveal === null || reveal.path !== path) return
    goToLine(reveal.line)
    onRevealed()
  }, [reveal, path, text, goToLine, onRevealed])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={host} data-fragment-editor className="min-h-0 flex-1 overflow-hidden" />
      <FragmentProblems problems={problems} onGoToLine={goToLine} />
    </div>
  )
}
