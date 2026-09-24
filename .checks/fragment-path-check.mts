// Regras dos caminhos de fragmento (plano da Fase 6, Tarefa 1).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/fragment-path-check.mts
import {
  checkNewFragmentPath,
  folderOf,
  isFragmentFile,
  isFragmentFolder
} from '@/domain/fragments/fragment-path'

const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const existing = ['docs/loja/visao-geral.xml', 'docs/pagamento/pix.xml']

console.log('— na árvore')
for (const path of [
  'docs/pagamento/pix.xml',
  'docs/LEIAME.XML',
  'docs/img/pix-fluxo.svg',
  'model.xml',
  'Assets.xml',
  'docs/model.xml',
  'configurations/loja-basica.xml',
  'Saida/loja-basica/product.xml',
  'docs/saida/x.xml',
  '.git/config.xml',
  'docs/.rascunho/a.xml'
]) {
  log(path, isFragmentFile(path, 'saida') ? 'arquivo' : '—')
}
for (const path of ['docs', 'configurations', 'saida', '.git', 'docs/.cache', 'docs/configurations']) {
  log(`${path}/`, isFragmentFolder(path, 'saida') ? 'pasta' : '—')
}

console.log('— caminho novo')
for (const input of [
  'docs/pagamento/cartao.xml',
  '  docs\\pagamento\\boleto2.xml  ',
  'Docs/Pagamento/cartao.xml',
  'DOCS/novo/a.xml',
  'docs/pagamento/PIX.xml',
  '',
  '/docs/a.xml',
  'C:/docs/a.xml',
  '../fora.xml',
  'docs/../a.xml',
  'docs//a.xml',
  'docs/a?.xml',
  'docs/pasta./a.xml',
  'docs/pasta /a.xml',
  'docs/a.txt',
  'docs/pagamento/',
  'docs/.rascunho/a.xml',
  '.xml',
  'model.xml',
  'ASSETS.XML',
  'configurations/nova.xml',
  'saida/loja/extra.xml'
]) {
  const checked = checkNewFragmentPath(input, 'saida', existing)
  log(JSON.stringify(input), checked.ok ? `ok ${checked.value}` : checked.error)
}

console.log('— pasta do arquivo')
for (const path of ['docs/pagamento/pix.xml', 'raiz.xml']) log(path, JSON.stringify(folderOf(path)))
