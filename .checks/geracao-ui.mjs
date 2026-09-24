// Roteiro da geração com entrada real (plano da Fase 5, Tarefa 4).
// Uso: bash .checks/run-ui.sh <app.exe | dev> .checks/geracao-ui.mjs 9229
// O app precisa estar aberto com --remote-debugging-port e --inspect. Nenhum programa abre:
// o shell.openPath do main é trocado por um registrador.
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { connect, log, sleep } from './cdp.mjs'
import { connectMain } from './main-process.mjs'

const [port, inspectPort, projectDir] = process.argv.slice(2)
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
const { click, fill, text, title, js, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))
const node = (id) => `[data-feature-id="${id}"]`
const generateButton = () =>
  js(`(() => {
    const button = [...document.querySelectorAll('main section button')].find((b) => /Gerar produto|Gerando/.test(b.innerText))
    if (!button) return '(sem botão)'
    return (button.disabled ? 'desligado' : 'ligado') + (button.parentElement.title ? ' | dica: ' + button.parentElement.title : '')
  })()`)
const banner = () =>
  js(
    `document.querySelector('[data-banner=generated]')?.innerText.replace(/\\s+/g, ' ').replace(/\\d{2}:\\d{2}/, 'HH:MM').trim() ?? '(sem faixa)'`
  )
const dialog = () =>
  js(
    `document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '(sem diálogo)'`
  )
const generatedAt = () => {
  const path = file('saida/loja-basica/product.xml')
  return existsSync(path)
    ? /generatedAt="([^"]+)"/.exec(readFileSync(path, 'utf8'))?.[1]
    : '(não existe)'
}
const outputFiles = () =>
  ['saida/loja-basica/product.xml', 'saida/loja-basica/docs/img/pix-fluxo.svg']
    .map((path) => `${path.split('/').pop()} ${existsSync(file(path)) ? 'sim' : 'não'}`)
    .join(', ')
const generate = async () => {
  await click({ text: 'Gerar produto' })
  await waitFor(
    `![...document.querySelectorAll('main section button')].some((b) => b.innerText.includes('Gerando'))`
  )
  await sleep(300)
}

// 1. loja-basica aberta: o botão ligado
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Configurações' })
await click('[data-configuration-key="loja-basica"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await sleep(500)
log('1. botão', await generateButton())
log('   saida/ existe?', existsSync(file('saida')))

// 2. incompleta: desligado, com o motivo; completa de novo: ligado
await click(node('pag_pix'))
log('2. pag_pix desselecionada', await generateButton())
await click(node('pag_pix'))
await click(node('pag_pix'))
log('   pag_pix de volta', await generateButton())

// 3. gerar: a faixa verde, os arquivos, e o "•" não muda
const titleBefore = await title()
await generate()
log('3. faixa', await banner())
log('   arquivos', outputFiles())
log('   título igual ao de antes', (await title()) === titleBefore)
const firstGeneratedAt = generatedAt()

// 4. Abrir pasta: o main recebe a pasta gerada
await click({ text: 'Abrir pasta' })
await sleep(300)
log('4. abriu', (await main.opened()).replace(projectDir, '<projeto>'))

// 5. outra configuração: a faixa some, e volta com loja-basica
await click({ text: 'Nova' })
await fill('#configuration-name', 'Outra')
await click({ tag: '[role=dialog] button', text: 'Criar' })
await waitFor(`document.querySelector('[role=dialog]') === null`)
await sleep(500)
log('5. em "Outra": faixa', await banner())
log('   botão', await generateButton())
await click('[data-configuration-key="loja-basica"]')
await sleep(500)
log('   de volta: faixa', await banner())

// 6. gerar de novo: pergunta antes de substituir
await sleep(1100) // para o generatedAt mudar de segundo
await generate()
log('6. diálogo', await dialog())
await click({ tag: '[role=dialog] button', text: 'Cancelar' })
await sleep(300)
log('   Cancelar: generatedAt igual', generatedAt() === firstGeneratedAt)
await generate()
await click({ tag: '[role=dialog] button', text: 'Substituir' })
await waitFor(`document.querySelector('[role=dialog]') === null`)
await waitFor(
  `![...document.querySelectorAll('main section button')].some((b) => b.innerText.includes('Gerando'))`
)
await sleep(300)
log('   Substituir: generatedAt mudou', generatedAt() !== firstGeneratedAt)
log('   faixa', await banner())

// 7. um fragmento ausente: o diálogo de problemas, e nada muda no disco
const secondGeneratedAt = generatedAt()
renameSync(file('docs/pagamento/pix.xml'), file('docs/pagamento/pix-renomeado.xml'))
await generate()
log('7. diálogo', await dialog())
await click({ tag: '[role=dialog] button', text: 'Fechar' })
await sleep(300)
log('   generatedAt igual', generatedAt() === secondGeneratedAt)
renameSync(file('docs/pagamento/pix-renomeado.xml'), file('docs/pagamento/pix.xml'))

// 8. o × fecha a faixa
await click('[data-banner=generated] button[title="Dispensar"]')
log('8. depois do ×', await banner())

log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
main.close()
