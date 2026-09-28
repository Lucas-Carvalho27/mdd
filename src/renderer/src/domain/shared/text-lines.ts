/** As quebras de linha, contadas como no editor e no @xmldom/xmldom: "\r\n", "\r" sozinho e "\n". */
const LINE_BREAK = /\r\n?|\n/g

/** A linha (a partir de 1) da posição `offset` do texto. */
export function lineAt(text: string, offset: number): number {
  return (text.slice(0, offset).match(LINE_BREAK)?.length ?? 0) + 1
}
