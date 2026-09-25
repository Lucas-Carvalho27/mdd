/*
 * O texto de um fragmento no editor e no disco (Fase 6). O editor trabalha sem BOM e com
 * "\n"; ao gravar, o texto volta ao formato do arquivo. Assim, só muda no disco o que foi
 * editado: o BOM e as quebras de linha ficam como estavam.
 */

const BOM = '\u{FEFF}'
/** "\r\n" e "\r" sozinho: no editor, as duas viram "\n". */
const FOREIGN_LINE_BREAK = /\r\n?/g

export interface TextFormat {
  readonly bom: boolean
  /** CRLF quando o arquivo tem algum "\r\n"; senão, LF. */
  readonly lineBreak: '\r\n' | '\n'
}

/** O formato de um fragmento criado pelo app. */
export const NEW_FILE_FORMAT: TextFormat = { bom: false, lineBreak: '\n' }

export interface EditorText {
  readonly text: string
  readonly format: TextFormat
}

/** O conteúdo do arquivo como o editor o mostra, e o formato para gravá-lo de volta. */
export function fromFileContent(content: string): EditorText {
  const bom = content.startsWith(BOM)
  const body = bom ? content.slice(BOM.length) : content
  return {
    text: body.replace(FOREIGN_LINE_BREAK, '\n'),
    format: { bom, lineBreak: body.includes('\r\n') ? '\r\n' : '\n' }
  }
}

/** O texto do editor no formato do arquivo, pronto para gravar. */
export function toFileContent(text: string, format: TextFormat): string {
  const body = format.lineBreak === '\n' ? text : text.replaceAll('\n', '\r\n')
  return format.bom ? `${BOM}${body}` : body
}
