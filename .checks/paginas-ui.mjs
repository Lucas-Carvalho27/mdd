// Roteiro das páginas HTML com entrada real (Fase 7), sobre uma cópia do exemplo herby:
// o editor de HTML, os marcadores (cor, sugestão e IDs), a moldura, o fragmento novo e a geração.
// Uso: EXAMPLE=herby bash .checks/run-ui.sh <app.exe | dev> .checks/paginas-ui.mjs 9229
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, log, sleep } from './cdp.mjs'

const [port, , projectDir] = process.argv.slice(2)
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
const { click, fill, text, js, send, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))

const VIEW = `document.querySelector('.cm-content').cmTile.root.view`
const editorLine = (line) => js(`${VIEW}.state.doc.line(${line}).text`)
const paths = () => js(`[...document.querySelectorAll('[data-fragment-path]')].map((b) => b.dataset.fragmentPath)`)
const problems = () => text('[data-fragment-problems]')
const bar = () => js(`document.querySelector('[data-fragment-bar]')?.parentElement.innerText.replace(/\\s+/g, ' ').trim()`)
const dialog = () =>
  js(`document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '(sem diálogo)'`)
const banner = () =>
  js(
    `document.querySelector('[data-banner=generated]')?.innerText.replace(/\\s+/g, ' ').replace(/\\d{2}:\\d{2}/, 'HH:MM').trim() ?? '(sem faixa)'`
  )
const mouse = (type, x, y, clickCount) =>
  send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount })
/** Clica no editor logo depois do texto `needle`. */
const clickAfter = async (needle) => {
  const box = await js(`(() => {
    const view = ${VIEW}
    const found = view.state.doc.toString().indexOf(${JSON.stringify(needle)})
    if (found < 0) return null
    const at = view.coordsAtPos(found + ${needle.length})
    return { x: at.left, y: (at.top + at.bottom) / 2 }
  })()`)
  if (box === null) throw new Error(`não achei ${needle} no editor`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y })
  await mouse('mousePressed', box.x, box.y, 1)
  await mouse('mouseReleased', box.x, box.y, 1)
  await sleep(200)
}
const type = async (content) => {
  await send('Input.insertText', { text: content })
  await sleep(400)
}
const key = async (keyName, code, vk, modifiers = 0) => {
  const base = { key: keyName, code, windowsVirtualKeyCode: vk, modifiers }
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  await sleep(200)
}
const settle = () => sleep(1500)
const discard = async () => {
  await click({ startsWith: 'Descartar alterações' })
  await click({ text: 'Descartar' })
  await waitFor(`document.querySelector('[role=dialog]') === null`)
}
/** A cor calculada de um trecho do editor, comparada com a de uma variável do tema. */
const colorOf = (needle, variable) =>
  js(`(() => {
    const span = [...document.querySelectorAll('.cm-content span')].find((s) => s.innerText === ${JSON.stringify(needle)})
    const probe = document.createElement('span')
    probe.style.color = 'var(${variable})'
    document.body.append(probe)
    const expected = getComputedStyle(probe).color
    probe.remove()
    return span ? (getComputedStyle(span).color === expected ? '${variable}' : getComputedStyle(span).color) : '(não achei)'
  })()`)

// 1. A aba Fragmentos com os .html e a moldura
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Fragmentos' })
await waitFor(`document.querySelectorAll('[data-fragment-path]').length > 0`)
const listed = await paths()
log('1. árvore', `${listed.length} arquivos, ${listed.filter((path) => path.endsWith('.html')).length} .html, moldura: ${listed.includes('moldura.html') ? 'sim' : 'não'}`)

// 2. Um fragmento HTML: realce, marcador e conferência
await click('[data-fragment-path="fragmentos/plataforma.html"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Como funciona')`)
await settle()
log('2. barra', await bar())
log('   cor da tag h2', await colorOf('h2', '--xml-tag'))
log('   marcadores com cor', await js(`[...document.querySelectorAll('.cm-marker')].map((m) => m.innerText).join(' ')`))
log('   problemas', await problems())

// 3. A sugestão depois de {{
await clickAfter('</h2>')
await type(' {{herby.contato_w')
await waitFor(`document.querySelector('.cm-tooltip-autocomplete') !== null`)
log('3. sugestões', await js(`[...document.querySelectorAll('.cm-tooltip-autocomplete li')].map((li) => li.innerText).join(' | ')`))
await key('Enter', 'Enter', 13)
log('   linha 1', await editorLine(1))

// 4. Um ID que não existe
await type(' {{herby.nada}}')
await settle()
log('4. problemas', await problems())
await discard()
log('   depois de descartar', await editorLine(1))

// 5. Uma tag que fica aberta
await click('[data-fragment-path="fragmentos/acesso-plataforma.html"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Link de acesso')`)
await clickAfter('</section>')
for (let count = 0; count < '</section>'.length; count++) await key('Backspace', 'Backspace', 8)
await settle()
log('5. problemas', await problems())
await discard()
await settle()
log('   depois de descartar', await problems())

// 6. A moldura
await click('[data-fragment-path="moldura.html"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('{{conteudo}}')`)
await settle()
log('6. barra', await bar())
log('   problemas', await problems())

// 7. Fragmento novo: .htm recusado, .html começa vazio
await click({ text: 'Novo fragmento' })
await fill('#fragment-path', 'fragmentos/velho.htm')
log('7. .htm', await dialog())
await fill('#fragment-path', 'fragmentos/novo.html')
await click({ text: 'Criar' })
await waitFor(`document.querySelector('[data-fragment-path="fragmentos/novo.html"]') !== null`)
await settle()
log('   editor', JSON.stringify(await js(`${VIEW}.state.doc.toString()`)))
log('   problemas', await problems())
await discard()

// 8. Gerar completa-atibaia
await click({ text: 'Configurações' })
await click('[data-configuration-key="completa-atibaia"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await click({ text: 'Gerar produto' })
await waitFor(`document.querySelector('[data-banner=generated]') !== null`, 60000)
log('8. faixa', await banner())
const page = file('saida/completa-atibaia/index.html')
const expected = 'docs/examples/produto-esperado/herby-completa-atibaia/index.html'
log('   index.html', existsSync(page) ? (readFileSync(page).equals(readFileSync(expected)) ? 'idêntico ao esperado' : 'DIFERENTE do esperado') : '(não existe)')
const count = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => total + (entry.isDirectory() ? count(join(dir, entry.name)) : 1), 0)
log('   arquivos na saída', count(file('saida/completa-atibaia')))
log('   título', await js('document.title'))
log('erros no console', errors.length === 0 ? 'nenhum' : errors.join(' | '))
ui.close()
