// Cliente mínimo do protocolo de depuração do Chromium, com entrada "de verdade":
// cliques do mouse, texto por Input.insertText (acentos ok) e teclas por Input.dispatchKeyEvent.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export { sleep }

export async function connect(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  const page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve))
  let nextId = 1
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      ws.addEventListener('message', function onMessage(event) {
        const message = JSON.parse(event.data)
        if (message.id !== id) return
        ws.removeEventListener('message', onMessage)
        if (message.error) reject(new Error(`${method}: ${message.error.message}`))
        else resolve(message.result)
      })
      ws.send(JSON.stringify({ id, method, params }))
    })

  const js = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (result.exceptionDetails) {
      throw new Error(`EXCEÇÃO: ${result.exceptionDetails.exception?.description}`)
    }
    return result.result.value
  }

  // Localiza por seletor CSS ou pelo texto visível: { text } (igual) ou { startsWith }.
  // Sem { tag }, procura em button e label.
  const locate = (target) => {
    if (typeof target === 'string') return `document.querySelector(${JSON.stringify(target)})`
    const all = `[...document.querySelectorAll(${JSON.stringify(target.tag ?? 'button, label')})]`
    return target.startsWith !== undefined
      ? `${all}.find((el) => el.innerText.trim().startsWith(${JSON.stringify(target.startsWith)}))`
      : `${all}.find((el) => el.innerText.trim() === ${JSON.stringify(target.text)})`
  }

  const center = async (target) => {
    const box = await js(`(() => {
      const el = ${locate(target)}
      if (!el) return null
      // No diagrama, rolar o elemento deslocaria a tela do React Flow.
      if (!el.closest('.react-flow')) el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: !!el.disabled || el.dataset.disabled !== undefined }
    })()`)
    if (box === null) throw new Error(`não achei ${JSON.stringify(target)}`)
    if (box.disabled) throw new Error(`desabilitado: ${JSON.stringify(target)}`)
    return box
  }

  const mouse = (type, x, y, extra = {}) =>
    send('Input.dispatchMouseEvent', { type, x, y, clickCount: 1, ...extra })

  const click = async (target) => {
    const { x, y } = await center(target)
    await mouse('mouseMoved', x, y)
    await mouse('mousePressed', x, y, { button: 'left', buttons: 1 })
    await mouse('mouseReleased', x, y, { button: 'left', buttons: 0 })
    await sleep(200)
  }

  const rightClick = async (target) => {
    const { x, y } = await center(target)
    await mouse('mouseMoved', x, y)
    await mouse('mousePressed', x, y, { button: 'right', buttons: 2 })
    await mouse('mouseReleased', x, y, { button: 'right', buttons: 0 })
    await sleep(300)
  }

  // Arrasta com o botão esquerdo de `from` até `to` (elemento ou ponto { x, y } da tela),
  // em passos; `during` roda com o botão ainda pressionado, antes de soltar.
  const drag = async (from, to, { steps = 12, during } = {}) => {
    const a = await center(from)
    const b = typeof to === 'object' && 'x' in to ? to : await center(to)
    await mouse('mouseMoved', a.x, a.y)
    await mouse('mousePressed', a.x, a.y, { button: 'left', buttons: 1 })
    for (let i = 1; i <= steps; i++) {
      const x = a.x + ((b.x - a.x) * i) / steps
      const y = a.y + ((b.y - a.y) * i) / steps
      await mouse('mouseMoved', x, y, { button: 'left', buttons: 1 })
      await sleep(20)
    }
    await sleep(200)
    const observed = during ? await during() : undefined
    await mouse('mouseReleased', b.x, b.y, { button: 'left', buttons: 0 })
    await sleep(500)
    return observed
  }

  const KEYS = {
    Tab: { code: 'Tab', vk: 9 },
    Enter: { code: 'Enter', vk: 13, text: '\r' },
    Escape: { code: 'Escape', vk: 27 },
    Delete: { code: 'Delete', vk: 46 },
    ArrowUp: { code: 'ArrowUp', vk: 38 },
    ArrowDown: { code: 'ArrowDown', vk: 40 },
    s: { code: 'KeyS', vk: 83 },
    z: { code: 'KeyZ', vk: 90 },
    y: { code: 'KeyY', vk: 89 },
    a: { code: 'KeyA', vk: 65 }
  }
  // modifiers: Alt=1, Ctrl=2, Meta=4, Shift=8
  const press = async (key, { ctrl = false, alt = false, shift = false } = {}) => {
    const k = KEYS[key]
    const modifiers = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (shift ? 8 : 0)
    const base = { key, code: k.code, windowsVirtualKeyCode: k.vk, modifiers }
    const withText = k.text !== undefined && modifiers === 0
    await send('Input.dispatchKeyEvent', {
      type: withText ? 'keyDown' : 'rawKeyDown',
      ...base,
      ...(withText ? { text: k.text, unmodifiedText: k.text } : {})
    })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
    await sleep(250)
  }

  // Clica no campo, seleciona o conteúdo e digita por cima (substitui o que houver).
  const fill = async (selector, value) => {
    await click(selector)
    await js(`document.querySelector(${JSON.stringify(selector)}).select()`)
    await send('Input.insertText', { text: value })
    await sleep(200)
  }

  // <select>: o popup nativo não é alcançável; troca o valor como o teclado faria.
  const choose = async (selector, value) => {
    await js(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      el.focus()
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)})
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })()`)
    await sleep(200)
  }

  const text = (selector) =>
    js(
      `document.querySelector(${JSON.stringify(selector)})?.innerText.replace(/\\s+/g, ' ').trim() ?? '(nada)'`
    )
  const value = (selector) => js(`document.querySelector(${JSON.stringify(selector)})?.value`)
  const tree = () =>
    js(
      `[...document.querySelectorAll('[data-feature-id]')].map((b) => b.dataset.featureId).join(' ')`
    )
  const selected = () =>
    js(
      `(document.querySelector('[data-feature-id][aria-current=true]') ?? document.querySelector('[aria-selected=true] > button'))?.dataset.featureId ?? '(nenhuma)'`
    )
  const title = () => js('document.title')
  const notice = () =>
    js(
      `[...document.querySelectorAll('main span')].find((s) => s.innerText.startsWith('Edição recusada'))?.innerText ?? '(sem aviso)'`
    )
  const waitFor = async (expression, timeoutMs = 10000) => {
    for (let waited = 0; waited < timeoutMs; waited += 200) {
      if (await js(expression)) return true
      await sleep(200)
    }
    throw new Error(`tempo esgotado esperando: ${expression}`)
  }

  return {
    ws,
    send,
    js,
    center,
    click,
    rightClick,
    drag,
    press,
    fill,
    choose,
    text,
    value,
    tree,
    selected,
    title,
    notice,
    waitFor,
    close: () => ws.close()
  }
}

export const log = (label, value) => console.log(label.padEnd(36), '→', value)
