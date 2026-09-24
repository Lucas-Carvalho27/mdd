// Fecha o app pelo protocolo de depuração, sem matar processos pelo nome. Antes, avisa o
// main que não há alterações pendentes: senão ele abriria o diálogo nativo e esperaria.
// Uso: node .checks/quit.mjs <porta>
import { connect } from './cdp.mjs'
const port = process.argv[2]
const ui = await connect(port)
await ui.js('window.mdd.setUnsavedChanges(false)')
ui.close()
const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
const ws = new WebSocket(webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve))
ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }))
await new Promise((resolve) => setTimeout(resolve, 500))
console.log('app fechado')
process.exit(0)
