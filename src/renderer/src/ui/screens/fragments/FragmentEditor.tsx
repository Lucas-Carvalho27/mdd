import { useEffect, useRef } from 'react'
import { setDiagnostics } from '@codemirror/lint'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { FileProblem } from '@/application/file-problem'
import type { FragmentDocument } from '@/application/fragments/fragment-document'
import type { FragmentEditorStates } from './fragment-editor-states'
import { FragmentProblems } from './FragmentProblems'
import { createXmlEditorState, diagnosticsFor } from './xml-editor-setup'

interface FragmentEditorProps {
  readonly document: FragmentDocument
  /** `undefined` enquanto a primeira conferência não respondeu. */
  readonly problems: readonly FileProblem[] | undefined
  /** Onde fica o estado de cada arquivo quando ele não está no editor. */
  readonly states: FragmentEditorStates
  readonly onChange: (path: string, text: string) => void
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
  onChange
}: FragmentEditorProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
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
      next = createXmlEditorState(text, {
        readOnly,
        onChange: (changed) => onChange(path, changed)
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

  const goToLine = (line: number): void => {
    const current = view.current
    if (current === null) return
    const { doc } = current.state
    const target = doc.line(Math.min(Math.max(line, 1), doc.lines))
    current.dispatch({
      selection: EditorSelection.cursor(target.from),
      effects: EditorView.scrollIntoView(target.from, { y: 'center' })
    })
    current.focus()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={host} data-fragment-editor className="min-h-0 flex-1 overflow-hidden" />
      <FragmentProblems problems={problems} onGoToLine={goToLine} />
    </div>
  )
}
