// A conferência de um fragmento, igual para a geração e o editor (plano da Fase 6, Tarefa 2).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/fragment-checker-check.mts
import { readFileSync } from 'node:fs'
import { XmlFragmentChecker } from '@/infrastructure/xml/xml-fragment-checker'
import { NodeXmlValidator } from './generation-support.mts'

const checker = new XmlFragmentChecker(new NodeXmlValidator())
const pix = readFileSync('docs/examples/loja-online/docs/pagamento/pix.xml', 'utf8')
const cases: Record<string, string> = {
  'pix.xml do exemplo': pix,
  'tag sem ">"': pix.replace('<title>Pagamento', '<title Pagamento'),
  'tag sem fechar, CRLF': '<?xml version="1.0"?>\r\n<t>\r\n  <p>a\r\n</t>\r\n',
  'arquivo novo': '<?xml version="1.0" encoding="UTF-8"?>\n',
  'Latin-1 declarado': '<?xml version="1.0" encoding="ISO-8859-1"?>\n<t>a</t>\n',
  'bytes que não são UTF-8': '<t>\n  <p>ok</p>\n  <p>a\u{FFFD}b</p>\n</t>\n',
  '&nbsp; com DTD externa':
    '<?xml version="1.0"?>\n<!DOCTYPE t PUBLIC "-//X//DTD T//EN" "t.dtd">\n<t>\n  <p>a&nbsp;b</p>\n</t>\n',
  'prefixo sem declaração': '<t>\n\n  <p:x/></t>'
}
for (const [name, content] of Object.entries(cases)) {
  const problems = await checker.check('docs/x.xml', content)
  console.log(
    name.padEnd(26),
    '→',
    problems.length === 0
      ? 'ok'
      : problems.map((p) => `${p.file}:${p.line ?? '?'} ${p.message}`).join(' | ')
  )
}

const root = await checker.extractRoot('docs/pagamento/pix.xml', pix)
console.log('raiz extraída do pix.xml'.padEnd(26), '→', root.ok ? root.value.split('\n')[0] : root.error)
