// Aceitação da Fase 5 (SPEC §9) pela interface, no app empacotado (plano da Fase 5, Tarefa 5).
// Uso: bash .checks/run-ui.sh <app.exe | dev> .checks/aceitacao-5.mjs
// Parte 1: com pag_boleto selecionado e boleto.xml ausente, a geração falha e não grava nada.
// Parte 2: gerar loja-basica produz o equivalente a produto-esperado/loja-basica/, mais o .svg.
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { DOMParser } from '@xmldom/xmldom'
import { connect, log, sleep } from './cdp.mjs'

const [port, projectDir] = process.argv.slice(2)
const ui = await connect(port)
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
const { click, text, js, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))
const node = (id) => `[data-feature-id="${id}"]`
const status = (id) => js(`document.querySelector('${node(id)}').dataset.status`)
const dialog = () =>
  js(
    `document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '(sem diálogo)'`
  )
const generate = async () => {
  await click({ text: 'Gerar produto' })
  await sleep(300)
  await waitFor(
    `![...document.querySelectorAll('main section button')].some((b) => b.innerText.includes('Gerando'))`
  )
  await sleep(300)
}

/** Comparação que ignora comentários, espaços, declarações de namespace e o generatedAt. */
function canonical(content) {
  const lines = []
  const walk = (node, depth) => {
    if (node.nodeType === 1) {
      const attributes = Array.from(node.attributes)
        .filter(
          (a) => a.name !== 'xmlns' && !a.name.startsWith('xmlns:') && a.name !== 'generatedAt'
        )
        .map((a) => `${a.namespaceURI ? `{${a.namespaceURI}}` : ''}${a.localName}=${a.value}`)
        .sort()
      lines.push(
        `${'  '.repeat(depth)}{${node.namespaceURI ?? ''}}${node.localName} ${attributes.join(' ')}`
      )
      for (const child of Array.from(node.childNodes)) walk(child, depth + 1)
    } else if (node.nodeType === 3 || node.nodeType === 4) {
      const value = node.nodeValue.replace(/\s+/g, ' ').trim()
      if (value !== '') lines.push(`${'  '.repeat(depth)}"${value}"`)
    }
  }
  walk(new DOMParser().parseFromString(content, 'text/xml').documentElement, 0)
  return lines.join('\n')
}

await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Configurações' })
await click('[data-configuration-key="loja-basica"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await sleep(500)

// Parte 1
renameSync(file('docs/pagamento/boleto.xml'), file('docs/pagamento/boleto-renomeado.xml'))
await click(node('pag_boleto'))
await click(node('pag_boleto'))
log('1. pag_boleto', await status('pag_boleto'))
log('   barra de status', await text('footer'))
await generate()
log('   diálogo', await dialog())
log('   saida/ existe?', existsSync(file('saida')))
await click({ tag: '[role=dialog] button', text: 'Fechar' })
await click(node('pag_boleto'))
log('   pag_boleto de volta', await status('pag_boleto'))
renameSync(file('docs/pagamento/boleto-renomeado.xml'), file('docs/pagamento/boleto.xml'))

// Parte 2
await generate()
log('2. faixa', (await text('[data-banner=generated] span')).replace(/\d{2}:\d{2}/, 'HH:MM'))
const product = readFileSync(file('saida/loja-basica/product.xml'), 'utf8')
const expected = readFileSync('docs/examples/produto-esperado/loja-basica/product.xml', 'utf8')
log('   equivalente ao esperado', canonical(product) === canonical(expected))
log(
  '   .svg idêntico',
  readFileSync(file('docs/img/pix-fluxo.svg')).equals(
    readFileSync(file('saida/loja-basica/docs/img/pix-fluxo.svg'))
  )
)
log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
