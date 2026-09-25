import type { EditorState } from '@codemirror/state'

/**
 * O estado do CodeMirror de cada fragmento, com o desfazer e a seleção, por caminho. A tela do
 * projeto o guarda enquanto o projeto está aberto: trocar de arquivo ou de aba e voltar mantém
 * o histórico do texto.
 */
export type FragmentEditorStates = Map<string, EditorState>
