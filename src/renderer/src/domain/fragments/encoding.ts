/*
 * O app lê os fragmentos como UTF-8 (SPEC §4.4). Um arquivo em outra codificação chega com os
 * acentos trocados por U+FFFD, e não pode ir para o produto nem ser gravado de volta.
 */

const BOM = '\u{FEFF}'
const REPLACEMENT_CHARACTER = '\u{FFFD}'
const DECLARED_ENCODING = /^<\?xml\s[^?]*?\bencoding\s*=\s*(["'])(.*?)\1/
const UTF_8 = /^utf-?8$/i
/** As quebras de linha que o @xmldom/xmldom conta: "\r\n", "\r" sozinho e "\n". */
const LINE_BREAK = /\r\n?|\n/g

export interface EncodingProblem {
  readonly line: number
  readonly message: string
}

/** A codificação da declaração XML, se houver. */
export function declaredEncoding(content: string): string | undefined {
  const text = content.startsWith(BOM) ? content.slice(BOM.length) : content
  return DECLARED_ENCODING.exec(text)?.[2]
}

/**
 * A linha do primeiro U+FFFD, se houver: a leitura como UTF-8 põe esse caractere no lugar dos
 * bytes inválidos, como os acentos de um arquivo salvo em Latin-1.
 */
export function firstUndecodedLine(content: string): number | undefined {
  const found = content.indexOf(REPLACEMENT_CHARACTER)
  if (found < 0) return undefined
  return (content.slice(0, found).match(LINE_BREAK)?.length ?? 0) + 1
}

/** Por que o conteúdo, lido como UTF-8, não serve; `undefined` quando serve. */
export function encodingProblem(content: string): EncodingProblem | undefined {
  // Com outra codificação declarada, os acentos já chegam trocados.
  const encoding = declaredEncoding(content)
  if (encoding !== undefined && !UTF_8.test(encoding)) {
    return {
      line: 1,
      message: `A codificação ${encoding} não é suportada: salve o arquivo em UTF-8.`
    }
  }
  // Sem declaração, a outra codificação aparece nos bytes que não são UTF-8.
  const undecoded = firstUndecodedLine(content)
  if (undecoded !== undefined) {
    return { line: undecoded, message: 'O arquivo não está em UTF-8: salve-o em UTF-8.' }
  }
  return undefined
}
