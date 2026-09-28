import { ipcMain, net, protocol } from 'electron'
import { stat } from 'fs/promises'
import { pathToFileURL } from 'url'
import { IpcChannel, PREVIEW_HOST, PREVIEW_SCHEME } from '../shared/ipc'
import type { ProjectRoot } from './project-root'

/*
 * A visualização da página (Fase 8, ADR 0011). O renderer monta a página e a entrega por
 * `setPreviewPage`; o main a serve no esquema próprio `mdd-page:`, com os arquivos do projeto
 * aberto (só leitura). A página roda num <iframe> com sandbox, numa origem opaca: os scripts e
 * a internet funcionam, mas ela não enxerga o app. Sem CSP na resposta, a do app não vale nela.
 * A do app (`frame-src mdd-page:`) barra o quadro de navegar para fora do esquema: um link para
 * fora é aberto pelo script da visualização como janela nova, que o `setWindowOpenHandler` manda
 * para o navegador do sistema.
 */

/** Os endereços que saem da página e abrem no programa padrão do sistema. */
const EXTERNAL = /^(https?|mailto):/i
const NO_STORE = { 'cache-control': 'no-store' }

/**
 * O script que só a visualização leva, antes do `</body>`: devolve a rolagem guardada (o
 * `?y=` do endereço), avisa o app de cada rolagem, repassa o Ctrl+S (com o foco dentro da
 * página, as teclas não chegam ao app) e abre os links para fora como janela nova, que vai para
 * o navegador do sistema. O index.html gerado não o leva.
 */
const PREVIEW_SCRIPT = `<script>
(() => {
  const saved = Number(new URLSearchParams(location.search).get('y')) || 0
  const restore = () => { if (saved > 0) scrollTo(0, saved) }
  addEventListener('DOMContentLoaded', restore)
  addEventListener('load', restore)
  let last = -1
  addEventListener('scroll', () => {
    if (scrollY === last) return
    last = scrollY
    parent.postMessage({ mddPreview: 'scroll', y: scrollY }, '*')
  }, { passive: true })
  addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (link === null || !/^(https?|mailto):$/.test(new URL(link.href).protocol)) return
    event.preventDefault()
    open(link.href, '_blank', 'noopener')
  }, true)
  addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      parent.postMessage({ mddPreview: 'save' }, '*')
    }
  })
})()
</script>
`

/** Antes do `app.whenReady`: o esquema é padrão (endereços relativos) e seguro. */
export function registerPreviewScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: PREVIEW_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

/** Depois do `app.whenReady`: o canal que recebe a página e a resposta do esquema. */
export function registerPagePreview(root: ProjectRoot): void {
  let page = ''
  ipcMain.handle(IpcChannel.setPreviewPage, (_event, html: string) => {
    page = withPreviewScript(html)
  })
  protocol.handle(PREVIEW_SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.host !== PREVIEW_HOST) return new Response(null, { status: 404 })
    const path = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    if (path === 'index.html') {
      return new Response(page, {
        headers: { 'content-type': 'text/html; charset=utf-8', ...NO_STORE }
      })
    }
    const absolute = root.current === null ? null : root.resolve(path)
    if (absolute === null || !(await isFile(absolute))) return new Response(null, { status: 404 })
    // Sem cache: "Recarregar" precisa pegar um arquivo mudado por fora.
    const file = await net.fetch(pathToFileURL(absolute).toString())
    const headers = new Headers(file.headers)
    headers.set('cache-control', 'no-store')
    return new Response(file.body, { status: file.status, headers })
  })
}

/** Um endereço aberto com `target="_blank"` ou `window.open`: só os de fora, no sistema. */
export function isExternalAddress(url: string): boolean {
  return EXTERNAL.test(url)
}

function withPreviewScript(html: string): string {
  const end = html.toLowerCase().lastIndexOf('</body>')
  return end < 0 ? html + PREVIEW_SCRIPT : html.slice(0, end) + PREVIEW_SCRIPT + html.slice(end)
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}
