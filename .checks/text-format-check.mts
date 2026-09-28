// O texto do editor e o do arquivo (plano da Fase 6, Tarefa 1).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/text-format-check.mts
import { fromFileContent, NEW_FILE_FORMAT, toFileContent } from '@/domain/fragments/text-format'

const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const BOM = '\u{FEFF}'
/** Como JSON, com o BOM à vista. */
const show = (text: string): string => JSON.stringify(text).replace(BOM, '<BOM>')

const cases: [string, string][] = [
  ['LF', '<a>\n  <b/>\n</a>\n'],
  ['CRLF', '<a>\r\n  <b/>\r\n</a>\r\n'],
  ['BOM e CRLF', `${BOM}<a>\r\n</a>\r\n`],
  ['BOM e LF, sem quebra no fim', `${BOM}<a>\n</a>`],
  ['uma linha só', '<a/>'],
  ['vazio', ''],
  // Os dois últimos só mudam se forem editados: um arquivo sem alteração não é gravado.
  ['misturado', '<a>\r\n  <b/>\n</a>\r\n'],
  ['CR sozinho', '<a>\r</a>\r']
]
for (const [name, content] of cases) {
  const { text, format } = fromFileContent(content)
  const back = toFileContent(text, format)
  log(
    name,
    `${show(text)} bom=${format.bom} quebra=${JSON.stringify(format.lineBreak)} volta ${back === content ? 'idêntico' : `como ${show(back)}`}`
  )
}

// Editar e gravar: a linha nova sai no formato do arquivo.
const { text, format } = fromFileContent(`${BOM}<a>\r\n</a>\r\n`)
const edited = text.replace('</a>', '  <novo/>\n</a>')
log('linha nova num arquivo CRLF', show(toFileContent(edited, format)))
log('arquivo novo', show(toFileContent('<?xml version="1.0"?>\n<a/>\n', NEW_FILE_FORMAT)))
