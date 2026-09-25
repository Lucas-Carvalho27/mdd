// Roteiro da aba Fragmentos com entrada real (plano da Fase 6, Tarefa 5).
// Uso: bash .checks/run-ui.sh <app.exe | dev> .checks/fragmentos-ui.mjs 9229
// O app precisa estar aberto com --remote-debugging-port e --inspect.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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
const { click, press, fill, choose, text, title, js, send, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))
const BOM = '\u{FEFF}'
const show = (content) => JSON.stringify(content).replace(BOM, '<BOM>')

// O EditorView do CodeMirror, pelo DOM, como no `EditorView.findFromDOM` (o `cmTile` do conteúdo).
const VIEW = `document.querySelector('.cm-content').cmTile.root.view`
const editorText = () => js(`${VIEW}.state.doc.toString()`)
const tree = () =>
  js(
    `[...document.querySelectorAll('[data-fragment-path]')].map((b) => b.dataset.fragmentPath + (b.innerText.includes('•') ? ' •' : '') + (b.innerText.includes('novo') ? ' novo' : '') + (b.querySelector('[aria-label="Vinculado a um asset"]') ? ' 📎' : '')).join(' | ')`
  )
const problems = () => text('[data-fragment-problems]')
const summary = () => text('[data-fragments-summary]')
const bar = () => text('[data-fragment-bar]')
const dialog = () =>
  js(`document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '(sem diálogo)'`)
const warnings = () =>
  js(
    `[...document.querySelectorAll('main section h2')].find((h) => h.innerText === 'Avisos')?.parentElement.innerText.replace(/\\s+/g, ' ').trim() ?? '(sem avisos)'`
  )
const mouse = (type, x, y, clickCount) =>
  send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount })
/** Clica no editor na posição do texto `needle` (+ `delta` caracteres); duas vezes seleciona a palavra. */
const clickText = async (needle, { delta = 0, clicks = 1 } = {}) => {
  const box = await js(`(() => {
    const view = ${VIEW}
    const found = view.state.doc.toString().indexOf(${JSON.stringify(needle)})
    if (found < 0) return null
    const at = view.coordsAtPos(found + ${delta})
    return { x: at.left + 2, y: (at.top + at.bottom) / 2 }
  })()`)
  if (box === null) throw new Error(`não achei ${needle} no editor`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y })
  for (let count = 1; count <= clicks; count++) {
    await mouse('mousePressed', box.x, box.y, count)
    await mouse('mouseReleased', box.x, box.y, count)
  }
  await sleep(200)
}
const type = async (content) => {
  await send('Input.insertText', { text: content })
  await sleep(300)
}
const key = async (keyName, code, vk, modifiers = 0) => {
  const base = { key: keyName, code, windowsVirtualKeyCode: vk, modifiers }
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  await sleep(250)
}
/** Espera a conferência do texto atual (meio segundo depois da última tecla). */
const settle = () => sleep(1500)
const fromExample = () => {
  const changed = []
  const walk = (dir) => {
    for (const name of readdirSync(join(projectDir, dir))) {
      const rel = dir === '' ? name : `${dir}/${name}`
      if (statSync(file(rel)).isDirectory()) walk(rel)
      else {
        let original = null
        try {
          original = readFileSync(join('docs/examples/loja-online', ...rel.split('/')))
        } catch {
          // Arquivo novo.
        }
        if (original === null || !original.equals(readFileSync(file(rel)))) changed.push(rel)
      }
    }
  }
  walk('')
  return changed.join(' ') || '(nenhum)'
}

// A visão geral passa a ter BOM e CRLF, para conferir que o formato fica.
const visaoOriginal = readFileSync(file('docs/loja/visao-geral.xml'), 'utf8')
writeFileSync(file('docs/loja/visao-geral.xml'), BOM + visaoOriginal.replaceAll('\n', '\r\n'))

// 1. A aba e a árvore
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Fragmentos' })
await waitFor(`document.querySelectorAll('[data-fragment-path]').length > 0`)
log('1. árvore', await tree())
log('   status', await summary())

// 2. Abrir o pix.xml: a barra, o realce e a conferência
await click('[data-fragment-path="docs/pagamento/pix.xml"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Pagamento com PIX')`)
await settle()
log('2. barra', await bar())
log('   vínculo', await text('[data-fragment-link]'))
log(
  '   realce da tag',
  await js(`(() => {
    const token = [...document.querySelectorAll('.cm-line span')].find((s) => s.textContent === 'title')
    // A variável sai minificada do build ("oklch(46% .16 262)"): compara com a cor calculada.
    const probe = document.createElement('span')
    probe.style.color = 'var(--xml-tag)'
    document.body.append(probe)
    const tag = getComputedStyle(probe).color
    probe.remove()
    return token && getComputedStyle(token).color === tag ? 'cor de --xml-tag' : 'sem cor'
  })()`)
)
log('   problemas', await problems())

// 3. Digitar: o "•" no título, na árvore, na barra e no status
await clickText('PIX</title>', { clicks: 2 })
await type('Pix')
log('3. título da janela', await title())
log('   árvore', await tree())
log('   status', await summary())

// 4. Ctrl+Z e Ctrl+Y ficam com o editor
log('   desfazer do cabeçalho', await js(`document.querySelector('header button[title^="Desfazer"]').disabled ? 'desligado' : 'ligado'`))
await press('z', { ctrl: true })
log('4. Ctrl+Z', `${(await editorText()).includes('com PIX</title>') ? 'PIX de volta' : 'não voltou'} · ${await title()}`)
await press('y', { ctrl: true })
log('   Ctrl+Y', (await editorText()).includes('com Pix</title>') ? 'Pix de novo' : 'não refez')

// 5. Ctrl+S: só esse arquivo muda
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log('5. Ctrl+S', `${await title()} · status ${await summary()}`)
log('   diferentes do exemplo', fromExample())

// 6. Apagar o ">" de uma tag: o problema com a linha, a marca e o clique que leva até ela
await clickText('<title>', { delta: 6 })
await press('Delete')
await settle()
log('6. problemas', await problems())
log('   marcas no editor', await js(`document.querySelectorAll('.cm-lintRange-error').length + ' sublinhado(s), ' + document.querySelectorAll('.cm-lint-marker-error').length + ' na margem'`))
await clickText('<p>')
await click('[data-fragment-problems] button')
log('   linha do cursor', await js(`document.querySelector('.cm-activeLine')?.textContent.trim()`))

// 7. Salvar com erro: o aviso, e a geração recusa o arquivo
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log('7. avisos', await warnings())
await click({ text: 'Configurações' })
await click('[data-configuration-key="loja-basica"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await click({ text: 'Gerar produto' })
await waitFor(`document.querySelector('[role=dialog]') !== null`, 20000)
log('   gerar loja-basica', await dialog())
await press('Escape')

// 8. De volta: o desfazer do texto sobreviveu à troca de aba
await click({ text: 'Fragmentos' })
await waitFor(`document.querySelector('.cm-content') !== null`)
await clickText('<p>')
await press('z', { ctrl: true })
await settle()
log('8. Ctrl+Z depois de trocar de aba', `${(await editorText()).includes('<title>Pagamento com Pix') ? '">" de volta' : 'não voltou'} · ${await problems()}`)
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log('   salvo sem erro', await warnings())

// 9. Arquivo com BOM e CRLF: editar e salvar mantém o formato
await click('[data-fragment-path="docs/loja/visao-geral.xml"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('loja')`)
const visaoWord = (await editorText()).match(/<title>(\S+)/)[1]
await clickText(`<title>${visaoWord}`, { delta: 8, clicks: 2 })
await type('Panorama')
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
const visao = readFileSync(file('docs/loja/visao-geral.xml'), 'utf8')
log('9. visao-geral.xml no disco', `BOM ${visao.startsWith(BOM) ? 'sim' : 'não'} · ${visao.split('\r\n').length - 1} CRLF, ${visao.replaceAll('\r\n', '').split('\n').length - 1} LF sozinho · título ${visao.match(/<title>([^<]+)/)[1]}`)

// 10. Alterado fora do app: sem alteração no app, o editor mostra o texto novo
writeFileSync(file('docs/loja/visao-geral.xml'), '<topic>\n  <title>Mudou por fora</title>\n</topic>\n')
await js(`window.dispatchEvent(new Event('focus'))`)
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Mudou por fora')`)
log('10. volta do foco', `${(await editorText()).split('\n')[1].trim()} · ${await title()}`)

// 11. Com alteração no app e fora dele: o conflito
await clickText('Mudou por fora', { clicks: 2 })
await type('Editado')
writeFileSync(file('docs/loja/visao-geral.xml'), '<topic>\n  <title>git pull</title>\n</topic>\n')
await press('s', { ctrl: true })
await waitFor(`document.querySelector('[role=dialog]') !== null`)
log('11. Ctrl+S', await dialog())
await click({ text: 'Sobrescrever' })
await waitFor(`!document.title.startsWith('•')`)
log('    Sobrescrever', readFileSync(file('docs/loja/visao-geral.xml'), 'utf8').split('\n')[1].trim())

// 12. Novo fragmento: o caminho sugerido, a recusa e a criação
await click({ text: 'Novo fragmento' })
log('12. caminho sugerido', await ui.value('#fragment-path'))
await fill('#fragment-path', 'configurations/x.xml')
log('    configurations/x.xml', await dialog())
await fill('#fragment-path', 'Docs/Pagamento/cartao.xml')
await click({ text: 'Criar' })
await waitFor(`document.querySelector('[data-fragment-path="docs/pagamento/cartao.xml"]') !== null`)
await settle()
log('    árvore', await tree())
log('    editor', JSON.stringify(await editorText()))
log('    problemas', await problems())
log('    Vincular…', await js(`[...document.querySelectorAll('button')].find((b) => b.innerText.includes('Vincular a uma feature'))?.disabled ? 'desligado' : 'ligado'`))
await clickText('<?xml')
await key('End', 'End', 35, 2)
await type('<topic xmlns="urn:exemplo:doc">\n  <title>Pagamento com cartão</title>\n</topic>\n')
await settle()
log('    digitado', await problems())
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log('    salvo', `${await tree()} · ${show(readFileSync(file('docs/pagamento/cartao.xml'), 'utf8').slice(0, 40))}…`)

// 13. Vincular a uma feature pelo editor
await click({ startsWith: 'Vincular a uma feature' })
await choose('#link-asset-anchor', 'pag_cartao')
await fill('#link-asset-name', 'Guia do cartão')
await click({ text: 'Vincular' })
await sleep(300)
log('13. vínculo', await text('[data-fragment-link]'))
log('    árvore', await tree())

// 14. Ctrl+Z no editor desfaz o texto, não o vínculo
await clickText('Pagamento com cartão', { delta: 14, clicks: 2 })
await type('crédito')
await press('z', { ctrl: true })
log('14. Ctrl+Z no texto', `${(await editorText()).includes('com cartão') ? 'texto de volta' : 'não voltou'} · vínculo ${await text('[data-fragment-link]')}`)

// 15. "Editar" na aba Assets
await click({ text: 'Assets' })
await waitFor(`document.querySelector('[data-asset-id="doc_cartao"]') !== null || document.querySelector('[data-asset-id="cartao"]') !== null`)
log('15. na aba Assets', await js(`[...document.querySelectorAll('[data-asset-id]')].map((row) => row.dataset.assetId + ' ' + (row.querySelector('button[title="Editar na aba Fragmentos"]') ? 'editar' : '-')).join(' | ')`))
await click('[data-asset-id="doc_boleto"] button[title="Editar na aba Fragmentos"]')
await waitFor(`document.querySelector('[data-fragment-bar]')?.innerText.includes('boleto')`)
log('    Editar doc_boleto', await bar())

// 16. Descartar alterações
await clickText('<title>', { delta: 7, clicks: 2 })
await type('Rascunho')
log('16. antes', `${await bar()} · ${await summary()}`)
await click({ startsWith: 'Descartar alterações' })
log('    diálogo', await dialog())
await click({ text: 'Descartar' })
log('    depois', `${await bar()} · ${await summary()} · ${await title()}`)

await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log('17. Ctrl+S, diferentes do exemplo', fromExample())
log('erros no console', errors.length === 0 ? 'nenhum' : errors.join(' | '))
ui.close()
main.close()
