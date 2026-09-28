// Responde os diálogos nativos do processo main sem usar a tela: pelo inspetor do Node
// (app aberto com --inspect=<porta>), troca dialog.showOpenDialog / showMessageBoxSync por
// versões que registram o que o app pediu e devolvem a resposta escolhida.
// Uso: node .checks/main-dialogs.mjs <porta-inspect> <ação> [argumento]
//   pasta <caminho>        → o próximo "escolher pasta" devolve esse caminho
//   respostas <b1,b2,...>  → as próximas confirmações escolhem esses botões (pelo texto)
//   fechar-janela          → fecha a janela como o X da barra de título (evento 'close')
//   registro               → mostra os diálogos pedidos até agora
const [port, action, argument] = process.argv.slice(2)

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const ws = new WebSocket(targets[0].webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve))
const evaluate = (expression) =>
  new Promise((resolve, reject) => {
    ws.addEventListener('close', () => reject(new Error('conexão encerrada')))
    ws.addEventListener('message', function onMessage(event) {
      const message = JSON.parse(event.data)
      if (message.id !== 1) return
      ws.removeEventListener('message', onMessage)
      const result = message.result
      if (message.error) reject(new Error(message.error.message))
      else if (result.exceptionDetails)
        reject(new Error(result.exceptionDetails.exception?.description))
      else resolve(result.result.value)
    })
    ws.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true }
      })
    )
  })

const setup = `
  const { dialog, BrowserWindow } = require('electron')
  globalThis.__dialogs ??= { log: [], folder: null, answers: [] }
  const state = globalThis.__dialogs
`

const expressions = {
  pasta: `(async () => { ${setup}
    state.folder = ${JSON.stringify(argument)}
    dialog.showOpenDialog = async (...args) => {
      const options = args.at(-1)
      state.log.push({ diálogo: 'escolher pasta', título: options.title, propriedades: options.properties, resposta: state.folder })
      return { canceled: false, filePaths: [state.folder] }
    }
    return 'escolher pasta → ' + state.folder
  })()`,
  respostas: `(async () => { ${setup}
    state.answers = ${JSON.stringify((argument ?? '').split(','))}
    dialog.showMessageBoxSync = (...args) => {
      const options = args.at(-1)
      const answer = state.answers.shift()
      const index = options.buttons.indexOf(answer)
      if (index < 0) throw new Error('botão inexistente: ' + answer)
      state.log.push({ diálogo: 'confirmação', título: options.title, mensagem: options.message, detalhe: options.detail, botões: options.buttons, resposta: answer })
      return index
    }
    return 'próximas confirmações → ' + state.answers.join(', ')
  })()`,
  'fechar-janela': `(async () => { ${setup}
    const [window] = BrowserWindow.getAllWindows()
    window.close()
    await new Promise((resolve) => setTimeout(resolve, 500))
    return BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).length === 1
      ? 'janela continua aberta'
      : 'janela fechada'
  })()`,
  registro: `(async () => { ${setup} return JSON.stringify(state.log, null, 2) })()`
}

try {
  console.log(await evaluate(expressions[action]))
} catch (error) {
  // Fechar a última janela encerra o app, e a conexão cai antes da resposta.
  console.log(
    action === 'fechar-janela' ? 'conexão encerrada (o app saiu)' : `ERRO: ${error.message}`
  )
}
ws.close()
