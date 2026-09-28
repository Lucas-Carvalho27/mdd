// Conexão com o processo main pelo inspetor do Node (app aberto com --inspect=<porta>).
// Troca o diálogo de arquivo e o shell.openPath por versões que registram o pedido e devolvem
// a resposta combinada; e simula a volta do foco com uma segunda janela, sem mexer na tela
// do usuário além de uma janela pequena por um instante.
export async function connectMain(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve))
  let nextId = 1
  const evaluate = (expression) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      ws.addEventListener('message', function onMessage(event) {
        const message = JSON.parse(event.data)
        if (message.id !== id) return
        ws.removeEventListener('message', onMessage)
        const result = message.result
        if (message.error) reject(new Error(message.error.message))
        else if (result.exceptionDetails)
          reject(new Error(result.exceptionDetails.exception?.description))
        else resolve(result.result.value)
      })
      ws.send(
        JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: {
            expression,
            awaitPromise: true,
            returnByValue: true,
            includeCommandLineAPI: true
          }
        })
      )
    })

  await evaluate(`(() => {
    const { dialog, shell } = require('electron')
    globalThis.__main = { files: [], opened: [], failOpen: [] }
    const state = globalThis.__main
    dialog.showOpenDialog = async (...args) => {
      const options = args.at(-1)
      const answer = state.files.shift()
      state.lastDialog = { title: options.title, defaultPath: options.defaultPath, properties: options.properties }
      return answer === undefined ? { canceled: true, filePaths: [] } : { canceled: false, filePaths: [answer] }
    }
    shell.openPath = async (path) => {
      state.opened.push(path)
      return state.failOpen.some((end) => path.endsWith(end)) ? 'Nenhum programa associado (simulado).' : ''
    }
  })()`)

  return {
    /** Os próximos diálogos de arquivo devolvem estes caminhos absolutos; sem nenhum, cancela. */
    answerFiles: (paths) =>
      evaluate(`globalThis.__main.files.push(...${JSON.stringify(paths)}); 'ok'`),
    lastDialog: () => evaluate('JSON.stringify(globalThis.__main.lastDialog ?? null)'),
    /** O que o app pediu para abrir, desde a última leitura. */
    opened: () => evaluate('globalThis.__main.opened.splice(0).join(" | ")'),
    failOpenFor: (end) => evaluate(`globalThis.__main.failOpen.push(${JSON.stringify(end)}); 'ok'`),
    /** Outra janela ganha o foco e a principal o recebe de volta, como ao voltar do Explorer. */
    refocus: () =>
      evaluate(`(async () => {
        const { BrowserWindow } = require('electron')
        const [main] = BrowserWindow.getAllWindows()
        const other = new BrowserWindow({ width: 240, height: 120, title: 'foco' })
        other.focus()
        await new Promise((r) => setTimeout(r, 600))
        main.focus()
        await new Promise((r) => setTimeout(r, 600))
        other.destroy()
        return main.isFocused()
      })()`),
    close: () => ws.close()
  }
}
