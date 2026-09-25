import { NEW_FILE_FORMAT, type TextFormat } from '@/domain/fragments/text-format'

/** O fragmento como está no disco, na última leitura ou gravação. */
export interface SavedFragment {
  /** No formato do editor, para comparar com o texto atual. */
  readonly text: string
  readonly hash: string
}

/** Um fragmento aberto no editor (Fase 6). */
export interface FragmentDocument {
  readonly path: string
  /** O texto no editor: sem BOM e com "\n". */
  readonly text: string
  /** `null` num arquivo novo, que ainda não existe no disco. */
  readonly saved: SavedFragment | null
  /** O BOM e a quebra de linha do arquivo, para gravá-lo do mesmo jeito. */
  readonly format: TextFormat
  /** Por que o arquivo só pode ser lido, quando é o caso. */
  readonly readOnly?: string
}

/** Um fragmento novo começa só com a declaração XML e uma linha em branco. */
export const NEW_FRAGMENT_TEXT = '<?xml version="1.0" encoding="UTF-8"?>\n'

export function newFragment(path: string): FragmentDocument {
  return { path, text: NEW_FRAGMENT_TEXT, saved: null, format: NEW_FILE_FORMAT }
}

/** Tem alteração não salva: um arquivo novo sempre tem. */
export function isModified(document: FragmentDocument): boolean {
  return document.text !== document.saved?.text
}
