// Extração da raiz dos fragmentos (plano da Fase 5, Tarefa 3).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/fragment-source-check.mts
import { declaredEncoding } from '@/domain/fragments/encoding'
import { extractFragmentRoot } from '@/infrastructure/xml/fragment-source'

const show = (text: string): string => JSON.stringify(text)
const cases: Record<string, string> = {
  simples: '<?xml version="1.0" encoding="UTF-8"?>\n<topic xmlns="urn:x">\n  <p>a</p>\n</topic>\n',
  'sem namespace': '<topic>\n  <p>a</p>\n</topic>',
  'prefixo na raiz': '<d:topic xmlns:d="urn:d"><p/></d:topic>',
  'BOM e CRLF':
    '\u{FEFF}<?xml version="1.0"?>\r\n<!-- licença -->\r\n<t a="1">\r\n  <p/>\r\n</t>\r\n',
  'DOCTYPE interno':
    '<?xml version="1.0"?>\n<!DOCTYPE t [\n <!ENTITY % x "a>]">\n <!-- ]> -->\n]>\n<?pi antes?>\n  <t><![CDATA[</t>]]><!-- </t> --></t>\n<!-- depois --><?pi depois?>\n\n',
  'CR sozinho': '<?xml version="1.0"?>\r<!-- a -->\r<t>\r<p/></t>',
  'emoji antes': '<!-- 😀 --><t/>',
  'raiz vazia': '<?xml version="1.0"?>\n<t/>',
  'DOCTYPE externo e &nbsp;':
    '<?xml version="1.0"?>\n<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">\n<topic>\n  <p>a&nbsp;b</p>\n  <p>&copy;</p>\n</topic>\n',
  'entidade interna': '<!DOCTYPE t [\n<!ENTITY e "x">\n]>\n<t>\n\n&e;</t>',
  'prefixo sem declaração': '<t>\n\n  <p:x/></t>',
  'referências válidas': '<t>&amp;&lt;&gt;&quot;&apos;&#233;&#xE9;</t>'
}
for (const [name, content] of Object.entries(cases)) {
  const result = extractFragmentRoot(content)
  console.log(
    name.padEnd(26),
    '→',
    result.ok
      ? show(result.value)
      : result.error.map((p) => `linha ${p.line ?? '?'}: ${p.message}`).join(' | ')
  )
}

console.log('--- codificação declarada')
for (const content of [
  '<?xml version="1.0" encoding="UTF-8"?><t/>',
  "\u{FEFF}<?xml version='1.0' encoding='iso-8859-1' standalone='yes'?><t/>",
  '<?xml version="1.0"?><t/>',
  '<t/>'
]) {
  console.log(
    show(content.slice(0, 40)).replace('\u{FEFF}', '<BOM>').padEnd(46),
    '→',
    declaredEncoding(content)
  )
}
