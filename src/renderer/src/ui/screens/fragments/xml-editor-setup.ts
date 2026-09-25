import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { xml } from '@codemirror/lang-xml'
import { HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { lintGutter, lintKeymap, type Diagnostic } from '@codemirror/lint'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { EditorState, type Text } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { FileProblem } from '@/application/file-problem'

/** Os textos do CodeMirror em português: o painel de busca, a lista de problemas… */
const PHRASES: Record<string, string> = {
  Find: 'Buscar',
  Replace: 'Substituir',
  next: 'próximo',
  previous: 'anterior',
  all: 'todos',
  'match case': 'maiúsculas',
  'by word': 'palavra inteira',
  regexp: 'expressão regular',
  replace: 'substituir',
  'replace all': 'substituir todos',
  close: 'fechar',
  'current match': 'ocorrência atual',
  'on line': 'na linha',
  'replaced match on line $': 'ocorrência substituída na linha $',
  'replaced $ matches': '$ ocorrências substituídas',
  'Go to line': 'Ir para a linha',
  go: 'ir',
  Diagnostics: 'Problemas',
  'No diagnostics': 'Nenhum problema',
  'Selection deleted': 'Seleção apagada',
  'Control character': 'Caractere de controle'
}

/** As cores vêm das variáveis do tema (index.css), que mudam no tema escuro. */
const XML_COLORS = HighlightStyle.define([
  { tag: [tags.tagName, tags.angleBracket], color: 'var(--xml-tag)' },
  { tag: tags.attributeName, color: 'var(--xml-attribute)' },
  { tag: [tags.attributeValue, tags.special(tags.string)], color: 'var(--xml-string)' },
  { tag: tags.character, color: 'var(--xml-entity)' },
  { tag: tags.blockComment, color: 'var(--xml-comment)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.documentMeta], color: 'var(--xml-meta)' },
  { tag: tags.invalid, color: 'var(--destructive)' }
])

const THEME = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    color: 'var(--foreground)',
    backgroundColor: 'var(--background)'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace' },
  '.cm-content': { caretColor: 'var(--foreground)' },
  '.cm-gutters': {
    color: 'var(--muted-foreground)',
    backgroundColor: 'var(--muted)',
    borderRight: '1px solid var(--border)'
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklch, var(--accent) 60%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--accent)' },
  '.cm-panels': { color: 'var(--foreground)', backgroundColor: 'var(--muted)' }
})

export interface XmlEditorOptions {
  readonly readOnly: boolean
  /** O texto mudou: digitação, colar, desfazer… */
  readonly onChange: (text: string) => void
}

/** O estado do CodeMirror para um fragmento: o texto, o histórico de desfazer e a seleção. */
export function createXmlEditorState(text: string, options: XmlEditorOptions): EditorState {
  return EditorState.create({
    doc: text,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      drawSelection(),
      indentOnInput(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      xml(),
      syntaxHighlighting(XML_COLORS),
      search({ top: true }),
      lintGutter(),
      keymap.of([
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...lintKeymap,
        indentWithTab
      ]),
      EditorState.phrases.of(PHRASES),
      EditorState.readOnly.of(options.readOnly),
      EditorView.editable.of(!options.readOnly),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange(update.state.doc.toString())
      }),
      THEME
    ]
  })
}

/** Os problemas da conferência como marcas do editor, cada um na linha inteira. */
export function diagnosticsFor(doc: Text, problems: readonly FileProblem[]): Diagnostic[] {
  return problems.map((problem) => {
    const line = doc.line(Math.min(Math.max(problem.line ?? 1, 1), doc.lines))
    return { from: line.from, to: line.to, severity: 'error', message: problem.message }
  })
}
