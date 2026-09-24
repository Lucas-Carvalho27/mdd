// Aceitação da Fase 3 (SPEC §9) no app empacotado, com entrada real.
// Uso: node .checks/aceitacao-3.mjs <porta> <pasta-do-projeto> <parte>
//   parte 1: loja-basica completa com mobile travada; tirar a decisão de pag_pix deixa mobile
//            indecisa; excluir pag_pix no modelo e salvar.
//   parte 2: (app reaberto) loja-basica abre desatualizada, com a referência órfã; deixa uma
//            decisão pendente para o teste de fechar a janela.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, log, sleep } from './cdp.mjs'

const [port, projectDir, part] = process.argv.slice(2)
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
const { click, press, text, title, js, waitFor } = ui
const node = (id) => `[data-feature-id="${id}"]`
const status = (id) => js(`document.querySelector('${node(id)}').dataset.status`)
const locked = (id) =>
  js(
    `(() => { const n = document.querySelector('${node(id)}'); return n.getAttribute('aria-disabled') + ' | ' + n.title })()`
  )
const footer = () => text('footer')
const example = readFileSync('docs/examples/loja-online/configurations/loja-basica.xml', 'utf8')
const onDisk = () => readFileSync(join(projectDir, 'configurations', 'loja-basica.xml'), 'utf8')

await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Configurações' })
await click('[data-configuration-key="loja-basica"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await sleep(800)

if (part === '1') {
  log('1. loja-basica', await footer())
  log('   mobile', `${await status('mobile')} | travada: ${await locked('mobile')}`)
  await click(node('mobile'))
  log('   clique em mobile', `${await status('mobile')} | ${await title()}`)

  await click(node('pag_pix'))
  await click(node('pag_pix'))
  log(
    '2. sem a decisão de pag_pix',
    `pag_pix ${await status('pag_pix')} | mobile ${await status('mobile')}`
  )
  log('   barra de status', await footer())
  await click(node('pag_pix'))
  log(
    '   decisão de volta',
    `pag_pix ${await status('pag_pix')} | mobile ${await status('mobile')}`
  )

  await click({ text: 'Modelo' })
  await waitFor(`document.querySelector('${node('pag_pix')}') !== null`)
  await sleep(800)
  await click(node('pag_pix'))
  await press('Delete')
  log(
    '3. impacto: configurações',
    await js(
      `[...document.querySelectorAll('[role=dialog] .space-y-3 > div')].find((d) => d.innerText.startsWith('Configurações'))?.innerText.replace(/\\s+/g, ' ')`
    )
  )
  await click({ tag: '[role=dialog] button', text: 'Excluir' })
  await press('s', { ctrl: true })
  await waitFor(`!document.title.startsWith('•')`)
  log('   salvo', await title())
  log('   loja-basica.xml igual ao exemplo', onDisk() === example)
}

if (part === '2') {
  log('3. loja-basica ao reabrir', await footer())
  log('   faixa', await text('[data-banner="orphans"] h3'))
  log('   referência órfã', await text('[data-banner="orphans"] li'))
  log('   mobile', await status('mobile'))
  await click(node('busca'))
  log('4. decisão pendente', `busca ${await status('busca')} | ${await title()}`)
}

log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
