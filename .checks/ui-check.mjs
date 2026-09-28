// Roteiro da interface do editor, dirigido pelo protocolo de depuração do Chromium.
// Uso: node .checks/ui-check.mjs <porta> <pasta-do-projeto>
// O app precisa estar aberto na tela inicial, com a pasta na lista de recentes.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [port, projectDir] = process.argv.slice(2)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve))
// A janela pode estar sem o foco do Windows: sem isto, focus()/blur() sintéticos não disparam eventos.
ws.send(
  JSON.stringify({ id: 0, method: 'Emulation.setFocusEmulationEnabled', params: { enabled: true } })
)
let nextId = 1
const js = (expression) =>
  new Promise((resolve) => {
    const id = nextId++
    ws.addEventListener('message', function onMessage(event) {
      const message = JSON.parse(event.data)
      if (message.id !== id) return
      ws.removeEventListener('message', onMessage)
      const result = message.result
      resolve(result.exceptionDetails ? `EXCEÇÃO: ${result.exceptionDetails.exception?.description}` : result.result.value)
    })
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }))
  })

// Ações na página
const click = async (selectorOrText) => {
  await js(`(() => {
    const byText = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(selectorOrText)})
    const target = byText ?? document.querySelector(${JSON.stringify(selectorOrText)})
    if (!target) throw new Error('não achei ' + ${JSON.stringify(selectorOrText)})
    target.click()
  })()`)
  await sleep(250)
}
const key = async (keyName, modifiers = {}) => {
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(keyName)}, bubbles: true, ctrlKey: ${!!modifiers.ctrl}, altKey: ${!!modifiers.alt}, shiftKey: ${!!modifiers.shift} }))`)
  await sleep(250)
}
const type = async (selector, value) => {
  await js(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)})
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
    input.focus()
    setter.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await sleep(250)
  await js(`document.querySelector(${JSON.stringify(selector)}).blur()`)
  await sleep(250)
}
const text = (selector) => js(`document.querySelector(${JSON.stringify(selector)})?.innerText.replace(/\\s+/g, ' ').trim() ?? '(nada)'`)
const tree = () => js(`[...document.querySelectorAll('[data-feature-id]')].map((b) => b.dataset.featureId).join(' ')`)
const selected = () => js(`document.querySelector('[data-feature-id][aria-current=true]')?.dataset.featureId`)
const title = () => js('document.title')
const log = (label, value) => console.log(label.padEnd(34), '→', value)

// 1. Abrir pelo recente
await click(`button:has(span)`)
for (let i = 0; i < 40 && (await tree()) === ''; i++) await sleep(250)
log('título ao abrir', await title())
log('árvore', await tree())

// 2. Tab abre "Nova filha": o ID acompanha o nome até ser editado
await click('[data-feature-id="busca"]')
await key('Tab')
log('Tab abre o diálogo', await text('[role=dialog] h2'))
await type('#new-feature-name', 'Relatório')
log('ID sugerido', await js(`document.querySelector('#new-feature-id').value`))
await type('#new-feature-id', 'busca')
log('ID repetido', await text('[role=dialog] .text-destructive'))
await type('#new-feature-id', 'busca_relatorio')
await click('Criar')
log('filha criada e selecionada', `${await selected()} | título: ${await title()}`)

// 3. Renomear pelo painel (o ID não muda)
await type('#feature-name', 'Relatório mensal')
log('renomear', await text('[data-feature-id="busca_relatorio"]'))

// 4. Desfazer duas vezes volta ao disco
await key('z', { ctrl: true })
log('Ctrl+Z desfaz o nome', await text('[data-feature-id="busca_relatorio"]'))
await key('z', { ctrl: true })
log('Ctrl+Z remove a feature', `${(await tree()).includes('busca_relatorio') ? 'ainda existe' : 'removida'} | título: ${await title()}`)

// 5. Excluir pag_pix com o diálogo de impacto
await click('[data-feature-id="pag_pix"]')
await key('Delete')
log('diálogo de impacto', await text('[role=dialog]'))
await click('Excluir')
log('depois de excluir', `${await tree()} | ${await text('aside section:last-of-type h2')}`)
await key('z', { ctrl: true })
log('Ctrl+Z restaura', `${(await tree()).includes('pag_pix')} | ${await text('aside section:last-of-type h2')}`)

// 6. Reordenar e edição recusada
await click('[data-feature-id="busca"]')
await key('ArrowUp', { alt: true })
log('Alt+↑ em busca', await tree())
await click('[data-feature-id="pag_pix"]')
await type('input[aria-label="Mínimo"]', '4')
await click('Aplicar')
log('grupo [4..*] recusado', await text('main > div.border-b'))

// 7. Salvar e conflito
await key('s', { ctrl: true })
await sleep(800)
log('Ctrl+S', `${await title()} | busca antes de catalogo no disco: ${readFileSync(join(projectDir, 'model.xml'), 'utf8').indexOf('id="busca"') < readFileSync(join(projectDir, 'model.xml'), 'utf8').indexOf('id="catalogo"')}`)
writeFileSync(join(projectDir, 'model.xml'), readFileSync(join(projectDir, 'model.xml'), 'utf8') + '\n')
await click('[data-feature-id="busca"]')
await key('ArrowDown', { alt: true })
await key('s', { ctrl: true })
await sleep(800)
log('conflito ao salvar', await text('[role=dialog]'))
await click('Recarregar (descarta minhas alterações)')
await sleep(1500)
log('recarregar', `${await tree()} | título: ${await title()}`)

// 8. Fechar com alteração pendente pede confirmação
await click('[data-feature-id="busca"]')
await key('ArrowDown', { alt: true })
await click('Fechar')
log('fechar com alteração', await text('[role=dialog]'))
await click('Fechar sem salvar')
log('tela inicial', await text('main h1'))

ws.close()
