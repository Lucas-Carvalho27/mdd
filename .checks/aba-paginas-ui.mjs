// Roteiro da aba Páginas com entrada real (Fase 8), sobre uma cópia do exemplo herby: o quadro
// isolado, as larguras, a atualização ao editar, os problemas, a moldura padrão, gerar e abrir
// no navegador, e o Ctrl+S com o foco na página.
// Uso: EXAMPLE=herby bash .checks/run-ui.sh <app.exe | dev> .checks/aba-paginas-ui.mjs 9229
import { readFileSync, rmSync } from 'node:fs'
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
const { click, fill, press, js, send, title, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))

/** O quadro da página: um alvo à parte no protocolo, porque a página fica em outra origem. */
async function frame() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    const target = targets.find((t) => t.url.startsWith('mdd-page://'))
    if (target) {
      const ws = new WebSocket(target.webSocketDebuggerUrl)
      await new Promise((resolve) => ws.addEventListener('open', resolve))
      let id = 0
      const evaluate = (expression) =>
        new Promise((resolve) => {
          const mine = ++id
          ws.addEventListener('message', function on(event) {
            const message = JSON.parse(event.data)
            if (message.id !== mine) return
            ws.removeEventListener('message', on)
            resolve(
              message.result?.result?.value ??
                message.result?.exceptionDetails?.exception?.description ??
                message.error?.message
            )
          })
          ws.send(
            JSON.stringify({
              id: mine,
              method: 'Runtime.evaluate',
              params: { expression, returnByValue: true, awaitPromise: true }
            })
          )
        })
      // A página pode estar recarregando: espera o documento completo.
      for (
        let wait = 0;
        wait < 40 && (await evaluate('document.readyState')) !== 'complete';
        wait++
      ) {
        await sleep(100)
      }
      return { evaluate, close: () => ws.close() }
    }
    await sleep(250)
  }
  throw new Error('não achei o quadro da página')
}
/** A versão da página no quadro (o `v=` do endereço); 0 sem quadro. */
const version = () =>
  js(
    `Number(new URL(document.querySelector('[data-page-frame]')?.src || 'x:?v=0').searchParams.get('v'))`
  )
/** Espera uma montagem mais nova que a versão `than` e devolve o quadro com ela. */
async function newer(than) {
  await waitFor(
    `Number(new URL(document.querySelector('[data-page-frame]')?.src || 'x:?v=0').searchParams.get('v')) > ${than}`,
    20000
  )
  await sleep(800)
  return frame()
}
const empty = () =>
  js(
    `document.querySelector('[data-page-empty]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '(página)'`
  )
const bar = () =>
  js(`document.querySelector('[data-pages] > div')?.innerText.replace(/\\s+/g, ' ').trim()`)
const problems = () =>
  js(
    `[...document.querySelectorAll('[data-page-problems] button')].map((b) => b.innerText.replace(/\\s+/g, ' ')).join(' | ') || '(nenhum)'`
  )
const VIEW = `document.querySelector('.cm-content').cmTile.root.view`
const clickAfter = async (needle) => {
  const box = await js(`(() => {
    const view = ${VIEW}
    const found = view.state.doc.toString().indexOf(${JSON.stringify(needle)})
    if (found < 0) return null
    const at = view.coordsAtPos(found + ${needle.length})
    return { x: at.left, y: (at.top + at.bottom) / 2 }
  })()`)
  if (box === null) throw new Error(`não achei ${needle} no editor`)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type,
      x: box.x,
      y: box.y,
      button: 'left',
      buttons: type === 'mousePressed' ? 1 : 0,
      clickCount: 1
    })
  }
  await sleep(200)
}
const discard = async () => {
  await click({ startsWith: 'Descartar alterações' })
  await click({ text: 'Descartar' })
  await waitFor(`document.querySelector('[role=dialog]') === null`)
}

// 1. A aba, sem configuração aberta
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Páginas' })
await sleep(800)
log('1. sem configuração', await empty())

// 2. A página de completa-atibaia, isolada do app
await click('[data-configuration-key="completa-atibaia"]')
await waitFor(`document.querySelector('[data-page-frame]')?.src.startsWith('mdd-page://')`, 20000)
let page = await frame()
log('2. barra', await bar())
log('   título da página', await page.evaluate('document.title'))
log('   window.mdd na página', await page.evaluate('typeof window.mdd'))
log(
  '   ler o parent',
  await page.evaluate(
    `(() => { try { return parent.document.title } catch (e) { return e.name } })()`
  )
)
log(
  '   imagens visíveis, quebradas',
  await page.evaluate(
    `(() => { const shown = [...document.images].filter((i) => !i.closest('template')); return shown.length + ', ' + shown.filter((i) => !i.complete || i.naturalWidth === 0).length })()`
  )
)
log('   problemas', await problems())

// 3. As larguras, com as media queries do CSS da página
for (const label of ['Celular', 'Tablet', 'Largura toda']) {
  await click({ startsWith: label })
  await sleep(400)
  log(
    `3. ${label}`,
    `${await page.evaluate('innerWidth')} px, celular no CSS: ${await page.evaluate(`matchMedia('(max-width: 600px)').matches`)}`
  )
}

// 4. Um link para fora vai para o navegador do sistema; a página fica
await page.evaluate(
  `(() => { const a = document.createElement('a'); a.href = 'https://example.com/ajuda'; document.body.append(a); a.click(); return 'ok' })()`
)
await sleep(800)
log('4. navegador do sistema', await main.external())
log('   o quadro continua em', String(await page.evaluate('location.href')).replace(/\?.*/, ''))

// 5. Editar um fragmento sem salvar: a página muda, na mesma rolagem
await page.evaluate('scrollTo(0, 900)')
await sleep(500)
page.close()
let seen = await version()
await click({ text: 'Fragmentos' })
await waitFor(`document.querySelectorAll('[data-fragment-path]').length > 0`)
await click('[data-fragment-path="fragmentos/plataforma.html"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Como funciona')`)
await clickAfter('Como funciona')
await send('Input.insertText', { text: ' (editado no app)' })
await sleep(300)
await click({ text: 'Páginas' })
page = await newer(seen)
log(
  '5. título da seção',
  await page.evaluate(`document.querySelector('#plataforma-01 h3').innerText`)
)
log('   rolagem', await page.evaluate('Math.round(scrollY)'))
log('   janela', await title())

// 6. Ctrl+S com o foco na página salva o projeto
await page.evaluate(`dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))`)
await waitFor(`!document.title.startsWith('•')`, 10000)
log(
  '6. Ctrl+S na página',
  `${await title()} | no disco: ${readFileSync(file('fragmentos/plataforma.html'), 'utf8').includes('(editado no app)') ? 'editado' : 'original'}`
)
page.close()

// 7. Um valor de atributo no configurador
await click({ text: 'Configurações' })
await waitFor(`document.querySelector('#value-herby-rede') !== null`)
await fill('#value-herby-rede', 'Atibaia (SP)')
await press('Enter')
await sleep(300)
seen = await version()
await click({ text: 'Páginas' })
page = await newer(seen)
log('7. subtítulo', await page.evaluate(`document.querySelector('.subtitulo').innerText`))
page.close()

// 8. Configuração incompleta: a página dá lugar ao que falta
await click({ text: 'Configurações' })
await click('[data-feature-id="lixeira"]')
await sleep(300)
await click({ text: 'Páginas' })
await sleep(1200)
log('8. incompleta', await empty())
await click({ text: 'Configurações' })
await click('[data-feature-id="lixeira"]')
await click('[data-feature-id="lixeira"]')
await sleep(300)

// 9. Um problema: a página aparece assim mesmo, e o clique leva à linha
await click({ text: 'Fragmentos' })
await click('[data-fragment-path="fragmentos/plataforma.html"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Como funciona')`)
await clickAfter('<h2>{{herby.produto}}</h2>')
await send('Input.insertText', { text: '\n<div class="aberto">' })
await sleep(300)
await click({ text: 'Páginas' })
await waitFor(`document.querySelectorAll('[data-page-problems] button').length > 0`, 20000)
log('9. problemas', await problems())
page = await frame()
log('   a página continua', await page.evaluate(`document.querySelector('.capa h1').innerText`))
page.close()
await click('[data-page-problems] button')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('aberto')`)
await sleep(400)
log(
  '   cursor na linha',
  await js(`${VIEW}.state.doc.lineAt(${VIEW}.state.selection.main.head).number`)
)
await discard()

// 10. Sem moldura.html: a moldura padrão e "Criar moldura"
rmSync(file('moldura.html'))
await click({ text: 'Páginas' })
await waitFor(`document.querySelector('[data-page-frame]')?.src.startsWith('mdd-page://')`, 20000)
await sleep(1000)
seen = await version()
await click({ text: 'Recarregar' })
page = await newer(seen)
log('10. barra', await bar())
log('    título da página', await page.evaluate('document.title'))
page.close()
await click({ text: 'Criar moldura' })
await waitFor(`document.querySelector('[data-fragment-bar]')?.innerText.includes('moldura.html')`)
log(
  '    aba Fragmentos',
  await js(`document.querySelector('[data-fragment-bar]').innerText.replace(/\\s+/g, ' ')`)
)
await discard()

// 11. Gerar e abrir no navegador
await click({ text: 'Páginas' })
await waitFor(`document.querySelector('[data-page-frame]')?.src.startsWith('mdd-page://')`, 20000)
await click({ text: 'Gerar produto' })
await waitFor(`document.querySelector('[data-banner=generated]') !== null`, 60000)
await click({ text: 'Abrir no navegador' })
await sleep(500)
log(
  '11. faixa',
  await js(
    `document.querySelector('[data-banner=generated]').innerText.replace(/\\s+/g, ' ').replace(/\\d{2}:\\d{2}/, 'HH:MM')`
  )
)
log('    aberto no sistema', String(await main.opened()).replace(projectDir, '<projeto>'))

log('erros no console', errors.length === 0 ? 'nenhum' : errors.join(' | '))
ui.close()
main.close()
