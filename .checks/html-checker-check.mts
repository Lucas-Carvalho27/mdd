// A conferência de um fragmento HTML e da moldura (Fase 7), como o editor a mostra.
//   npx tsx --tsconfig tsconfig.web.json .checks/html-checker-check.mts
import { HtmlFragmentChecker } from '@/infrastructure/html/html-fragment-checker'
import { DEFAULT_FRAME } from '@/domain/pages/page-layout'

const checker = new HtmlFragmentChecker()
const check = async (name: string, path: string, content: string): Promise<void> => {
  const problems = await checker.check(path, content)
  const shown = problems.map((problem) => `${problem.line}: ${problem.message}`)
  console.log(`${name}: ${shown.length === 0 ? 'ok' : `\n    ${shown.join('\n    ')}`}`)
}

const fragment = 'docs/a.html'
await check('HTML normal', fragment, '<h2>Título</h2>\n<p>Um<br>dois &nbsp; <img src=a.png alt=x>\n<p>três\n<ul><li>a<li>b</ul>\n')
await check('div aberto', fragment, '<h2>T</h2>\n<div class="caixa">\n<p>x</p>\n')
await check('section a mais', fragment, '<p>a</p>\n</section>\n<p>b</p>\n')
await check('fora de ordem', fragment, '<p><b><i>x</b></i></p>\n')
await check('html e body', fragment, '<html>\n<body>\n<p>x</p>\n</body>\n</html>\n')
await check('doctype', fragment, '<!doctype html>\n<p>x</p>\n')
await check('td fora da tabela', fragment, '<p>x</p>\n<td>y</td>\n')
await check('div/', fragment, '<div/>\n<p>x</p>\n')
await check('sintaxe', fragment, '<img src="a" src="b">\n<p>&foo; &copy e 1 < 2</p>\n')
await check('svg', fragment, '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>\n')
await check('template', fragment, '<template data-perfis="a">\n  <section class="secao"><p>x</p></section>\n</template>\n')
await check('texto com < em script e style', fragment, '<script>if (a < b) { x = "</div>" }</script>\n<style>p > a { color: red }</style>\n')
await check('comentário', fragment, '<!-- </div> {{loja.versao}} -->\n<p>x</p>\n')
await check('UTF-8', fragment, '<p>Pagamento com cart\u{FFFD}o</p>\n')
await check('BOM e CRLF', fragment, '\u{FEFF}<p>a</p>\r\n<div>\r\n')

console.log('--- marcadores')
await check('lugares que valem', fragment, '<p title="{{loja.versao}}">{{loja.versao}}</p>\n<a href="tel:{{loja.fone}}">{{ loja.fone }}</a>\n<style>p { color: {{tema.cor}} }</style>\n')
await check('dentro da tag', fragment, '<p {{loja.versao}}>x</p>\n')
await check('dentro do script', fragment, '<script>const v = "{{loja.versao}}"</script>\n')
await check('sintaxe e reservados', fragment, '<p>{{loja.versao</p>\n<p>{{contuedo}} {{conteudo}} {{sumario}} \\{{</p>\n')

console.log('--- moldura')
await check('moldura padrão', 'moldura.html', DEFAULT_FRAME)
await check('moldura sem </body> nem conteúdo', 'moldura.html', '<!doctype html>\n<html>\n<head>\n<title>{{produto}}</title>\n</head>\n<body>\n<p>x</p>\n')
await check('conteúdo fora do body', 'moldura.html', '<!doctype html>\n<html>\n<head>\n<title>{{conteudo}}</title>\n</head>\n<body>\n<p class="{{sumario}}">x</p>\n{{conteudo}}\n</body>\n</html>\n')
await check('conteúdo repetido', 'Moldura.HTML', '<html><head></head><body>{{conteudo}} {{conteudo}} {{sumario}}</body></html>')
