// Uso: node cdp-eval.mjs <porta> "<expressão JS>" ["<expressão>" ...]
// Espera a janela do Electron aparecer e imprime o resultado de cada expressão.
const [port, ...expressions] = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let page
for (let i = 0; i < 90 && !page; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
  } catch {}
  if (!page) await sleep(1000)
}
if (!page) {
  console.log('FALHA: nenhuma janela apareceu')
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let nextId = 1
const evaluate = (expression) =>
  new Promise((resolve) => {
    const id = nextId++
    ws.addEventListener('message', function onMessage(event) {
      const message = JSON.parse(event.data)
      if (message.id !== id) return
      ws.removeEventListener('message', onMessage)
      resolve(message.result.exceptionDetails ? `EXCEÇÃO: ${message.result.exceptionDetails.text}` : message.result.result.value)
    })
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }))
  })

// Espera o React montar algo no #root (o Vite compila na primeira carga).
for (let i = 0; i < 30; i++) {
  if (await evaluate("document.getElementById('root')?.childElementCount > 0")) break
  await sleep(1000)
}
console.log('url:', page.url)
for (const expression of expressions) console.log(`${expression}  =>`, JSON.stringify(await evaluate(expression)))
ws.close()
