import {
  autocompletion,
  completionKeymap,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { xml } from '@codemirror/lang-xml'
import { HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { lintGutter, lintKeymap, type Diagnostic } from '@codemirror/lint'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { EditorState, type Extension, type Text } from '@codemirror/state'
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  MatchDecorator,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { FileProblem } from '@/application/file-problem'
import { fragmentFormat } from '@/domain/fragments/fragment-format'
import { isFramePath } from '@/domain/pages/page-layout'

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
  'Control character': 'Caractere de controle',
  Completions: 'Sugestões'
}

/**
 * As cores vêm das variáveis do tema (index.css), que mudam no tema escuro. O HTML usa as
 * mesmas do XML, e o CSS e o JavaScript de dentro dele, as mais próximas.
 */
const COLORS = HighlightStyle.define([
  { tag: [tags.tagName, tags.angleBracket], color: 'var(--xml-tag)' },
  { tag: [tags.attributeName, tags.propertyName], color: 'var(--xml-attribute)' },
  {
    tag: [tags.attributeValue, tags.string, tags.special(tags.string)],
    color: 'var(--xml-string)'
  },
  { tag: [tags.character, tags.number], color: 'var(--xml-entity)' },
  { tag: [tags.blockComment, tags.lineComment], color: 'var(--xml-comment)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.documentMeta, tags.keyword], color: 'var(--xml-meta)' },
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
  '.cm-panels': { color: 'var(--foreground)', backgroundColor: 'var(--muted)' },
  '.cm-marker': {
    color: 'var(--xml-meta)',
    backgroundColor: 'color-mix(in oklch, var(--xml-meta) 12%, transparent)',
    borderRadius: '3px'
  },
  '.cm-tooltip': { color: 'var(--foreground)', backgroundColor: 'var(--popover)' }
})

/** Os marcadores, como `{{loja.versao}}` e `\{{`, com cor própria (Fase 7). */
const MARKERS = new MatchDecorator({
  regexp: /\\?\{\{[^{}\n]*\}\}|\\\{\{/g,
  decoration: Decoration.mark({ class: 'cm-marker' })
})
const markerHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = MARKERS.createDeco(view)
    }
    update(update: ViewUpdate): void {
      this.decorations = MARKERS.updateDeco(update, this.decorations)
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

/** Depois de `{{`, sugere os marcadores que valem neste arquivo. */
function markerCompletions(names: () => readonly string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const typed = context.matchBefore(/\{\{\s*[a-z0-9_.]*/)
    if (typed === null) return null
    const start = typed.from + typed.text.search(/[a-z0-9_.]*$/)
    const closed = context.state.sliceDoc(context.pos, context.pos + 2) === '}}'
    return {
      from: start,
      options: names().map((label) => ({ label, apply: closed ? label : `${label}}}` })),
      validFor: /^[a-z0-9_.]*$/
    }
  }
}

export interface FragmentEditorOptions {
  readonly readOnly: boolean
  /** O texto mudou: digitação, colar, desfazer… */
  readonly onChange: (text: string) => void
  /** Os marcadores de atributo do modelo (`feature.atributo`), lidos na hora da sugestão. */
  readonly attributeMarkers: () => readonly string[]
}

/**
 * O estado do CodeMirror para um fragmento: o texto, o histórico de desfazer e a seleção. A
 * linguagem vem da extensão; num `.html`, os marcadores têm cor e sugestão.
 */
export function createFragmentEditorState(
  path: string,
  text: string,
  options: FragmentEditorOptions
): EditorState {
  const isHtml = fragmentFormat(path) === 'html'
  const reserved = isFramePath(path) ? ['produto', 'conteudo', 'sumario'] : ['produto']
  // Uma fonte só por estado: o CodeMirror reconhece a fonte pela identidade da função, e uma
  // função nova a cada consulta faria ele descartar a resposta da anterior.
  const markerSource = markerCompletions(() => [...options.attributeMarkers(), ...reserved])
  const language: Extension[] = isHtml
    ? [
        html(),
        markerHighlight,
        // Mais uma fonte de sugestões, ao lado das tags e dos atributos do próprio HTML.
        EditorState.languageData.of(() => [{ autocomplete: markerSource }]),
        autocompletion({ icons: false })
      ]
    : [xml()]
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
      language,
      syntaxHighlighting(COLORS),
      search({ top: true }),
      lintGutter(),
      keymap.of([
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...lintKeymap,
        ...completionKeymap,
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
