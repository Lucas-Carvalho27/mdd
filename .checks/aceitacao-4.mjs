// Aceitação da Fase 4 (SPEC §9) com entrada real.
// Uso: node .checks/aceitacao-4.mjs <porta-cdp> <porta-inspect> <parte> <pasta-do-projeto>
//   parte 1: a aba mostra os 6 assets do exemplo; boleto.xml renomeado fora do app fica ausente.
//   parte 2: sem o assets.xml, os 6 assets são vinculados pela interface, fora de ordem, e o
//            arquivo salvo sai idêntico ao do exemplo.
import { readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { connect, log, sleep } from './cdp.mjs'
import { connectMain } from './main-process.mjs'

const [port, inspectPort, part, projectDir] = process.argv.slice(2)
const ui = await connect(port)
const main = await connectMain(inspectPort)
await ui.send('Emulation.setFocusEmulationEnabled', { enabled: true })
await ui.send('Runtime.enable')
const errors = []
ui.ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails.exception?.description)
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '))
  }
})
const { click, press, fill, choose, text, title, js, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))
const row = (id) => `[data-asset-id="${id}"]`
const groups = () =>
  js(`[...document.querySelectorAll('[data-anchor]')].map((group) =>
    group.dataset.anchor + '(' + [...group.querySelectorAll('[data-asset-id]')]
      .map((row) => row.dataset.assetId + ':' + row.querySelector('[data-file-status]').dataset.fileStatus)
      .join(' ') + ')').join(' ')`)
const example = readFileSync('docs/examples/loja-online/assets.xml', 'utf8')

if (part === '2') rmSync(file('assets.xml'))
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Assets' })
await sleep(800)

if (part === '1') {
  log('1. a aba mostra', await groups())
  log('   resumo', await text('[data-assets-summary]'))
  renameSync(file('docs/pagamento/boleto.xml'), file('docs/pagamento/boleto-renomeado.xml'))
  // O Windows não deixa um app em segundo plano tomar o foco: o evento vai direto à página.
  await js(`window.dispatchEvent(new Event('focus'))`)
  await sleep(600)
  log('2. boleto.xml renomeado fora', await groups())
  log('   resumo', await text('[data-assets-summary]'))
}

if (part === '2') {
  log('1. sem assets.xml', await text('[data-assets-summary]'))
  const link = async ({ path, id, name, anchor, kind }) => {
    await main.answerFiles([file(path)])
    await click({ text: 'Vincular arquivo…' })
    await waitFor(`document.querySelector('[role=dialog]') !== null`)
    if (kind !== undefined) await choose('#link-asset-kind', kind)
    await fill('#link-asset-name', name)
    await fill('#link-asset-id', id)
    await choose('#link-asset-anchor', anchor)
    await click({ tag: '[role=dialog] button', text: 'Vincular' })
    await waitFor(`document.querySelector('[role=dialog]') === null`)
  }
  // Fora de ordem de propósito: o arquivo sai na ordem das âncoras no modelo.
  await link({
    path: 'docs/pagamento/boleto.xml',
    id: 'doc_boleto',
    name: 'Guia do boleto',
    anchor: 'pag_boleto'
  })
  await link({
    path: 'docs/busca/busca-app.xml',
    id: 'doc_busca_app',
    name: 'Busca no app',
    anchor: 'busca'
  })
  await link({
    path: 'docs/img/pix-fluxo.svg',
    id: 'img_pix',
    name: 'Fluxo do PIX',
    anchor: 'pag_pix'
  })
  await link({
    path: 'docs/loja/visao-geral.xml',
    id: 'doc_loja',
    name: 'Visão geral',
    anchor: 'loja'
  })
  await link({ path: 'docs/busca/busca.xml', id: 'doc_busca', name: 'Busca', anchor: 'busca' })
  await link({
    path: 'docs/pagamento/pix.xml',
    id: 'doc_pix',
    name: 'Guia do PIX',
    anchor: 'pag_pix'
  })
  log('2. vinculados', await groups())
  await click(`${row('doc_busca')} button[title="Mover para cima"]`)
  await click(`${row('doc_pix')} button[title="Mover para cima"]`)
  await click(`${row('doc_busca_app')} > button`)
  await fill('#asset-condition', 'busca and mobile')
  await press('Enter')
  log('3. reordenados, com a condição', await groups())
  await press('s', { ctrl: true })
  await waitFor(`!document.title.startsWith('•')`)
  log('4. salvo', await title())
  log('   assets.xml igual ao exemplo', readFileSync(file('assets.xml'), 'utf8') === example)
}

log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
main.close()
