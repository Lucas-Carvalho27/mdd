// Roteiro do diagrama (plano da 2B, Tarefa 3), com entrada real pelo protocolo do Chromium.
// Uso: node .checks/diagrama-ui.mjs <porta>
// O app precisa estar na tela inicial, com uma cópia de docs/examples/loja-online nos recentes.
import { connect, log, sleep } from './cdp.mjs'

const ui = await connect(process.argv[2])
// A janela pode estar sem o foco do Windows: sem isto, os campos não gravam ao sair.
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
const { click, rightClick, drag, press, fill, text, tree, selected, title, notice, js, waitFor } =
  ui
const node = (id) => `[data-feature-id="${id}"]`
const ring = (id) =>
  js(
    `(() => { const c = document.querySelector('${node(id)}').className; return c.includes('ring-emerald') ? 'verde' : c.includes('ring-destructive') ? 'vermelho' : 'sem destaque' })()`
  )
const edgesFrom = (id) =>
  js(
    `[...document.querySelectorAll('.react-flow__edge[data-id^="${id}->"]')].map((e) => e.dataset.id.split('->')[1]).join(' ')`
  )

// 1. Abrir pelo recente e conferir o desenho
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await sleep(800)
log('título ao abrir', await title())
log('nós (ordem do DOM)', await tree())
log('selecionada', await selected())
log(
  'pontas das linhas',
  await js(
    `[...document.querySelectorAll('.react-flow__edge')].map((e) => e.dataset.id.split('->')[1] + ({ mandatory: '●', optional: '○' }[e.querySelector('circle')?.dataset.marker] ?? '-')).join(' ')`
  )
)
log(
  'arcos',
  await js(
    `[...document.querySelectorAll('[data-group-id]')].map((s) => s.dataset.groupId + ' ' + s.dataset.groupKind).join('; ')`
  )
)
log(
  'texto cortado',
  await js(
    `[...document.querySelectorAll('[data-feature-id] > span, [data-feature-id] > code')].filter((el) => el.scrollWidth > el.clientWidth).map((el) => el.textContent).join(', ') || 'nenhum'`
  )
)

// 2. Menu de contexto: seleciona o nó, itens em português, os que não se aplicam desabilitados
await rightClick(node('busca'))
log('botão direito seleciona', await selected())
log('menu', await text('[role=menu]'))
log(
  'desabilitados',
  await js(
    `[...document.querySelectorAll('[role=menuitem][data-disabled]')].map((i) => i.firstChild.textContent).join(', ')`
  )
)
await click({ tag: '[role=menuitem]', startsWith: 'Adicionar filha' })
log('diálogo pelo menu', await text('[role=dialog] h2'))
await fill('#new-feature-name', 'Relatório')
await click({ text: 'Criar' })
await waitFor(`document.querySelector('${node('relatorio')}') !== null`)
log('criada', `${await selected()} | ${await tree()}`)
log('página livre depois do menu', await js(`getComputedStyle(document.body).pointerEvents`))

// 3. Enter num item do menu não vira o atalho "Adicionar irmã"
await rightClick(node('busca'))
for (let i = 0; i < 4; i++) await press('ArrowDown')
log('item com foco', await js(`document.activeElement.firstChild?.textContent`))
await press('Enter')
await sleep(400)
log(
  'Enter no menu',
  `diálogos abertos: ${await js(`document.querySelectorAll('[role=dialog]').length`)} | ${await tree()}`
)
await press('z', { ctrl: true })
await sleep(400)

// 4. Arrastar e soltar
const overMobile = await drag(node('relatorio'), node('mobile'), { during: () => ring('mobile') })
await sleep(500)
log(
  'soltar sobre mobile',
  `destaque: ${overMobile} | filhas de mobile: ${await edgesFrom('mobile')} | selecionada: ${await selected()}`
)
const overPix = await drag(node('pagamento'), node('pag_pix'), { during: () => ring('pag_pix') })
await sleep(400)
log('soltar na própria subárvore', `destaque: ${overPix} | ${await notice()}`)
const overArc = await drag(node('busca'), '[data-group-id="pagamento:grupo:0"]', {
  during: () =>
    js(`document.querySelector('[data-group-id="pagamento:grupo:0"] path').getAttribute('class')`)
})
await sleep(500)
log('soltar sobre o arco', `destaque: ${overArc} | membros: ${await edgesFrom('pagamento')}`)

// 5. Recolher com a seleção dentro, e soltar sobre um nó recolhido
await click(`${node('pagamento')} button`)
await sleep(500)
log(
  'recolher',
  `${await tree()} | botão: ${await text(`${node('pagamento')} button`)} | selecionada: ${await selected()}`
)
await drag(node('catalogo'), node('pagamento'))
await sleep(700)
log('soltar sobre o recolhido', `${await tree()} | selecionada: ${await selected()}`)
for (let i = 0; i < 4; i++) await press('z', { ctrl: true })
await sleep(600)
log('Ctrl+Z ×4', `${await tree()} | ${await title()}`)

// 6. Excluir pelo menu mostra o impacto
await rightClick(node('pag_pix'))
await click({ tag: '[role=menuitem]', startsWith: 'Excluir' })
log('Excluir… pelo menu', await text('[role=dialog]'))
await click({ text: 'Cancelar' })

// 7. A feature nova fora da área visível faz a tela rolar até ela
for (let i = 0; i < 4; i++) await click('button[title="Aproximar"]')
await click(node('pag_boleto'))
await press('Tab')
await fill('#new-feature-name', 'Carnê')
await click({ text: 'Criar' })
await sleep(900)
const visible = await js(`(() => {
  const pane = document.querySelector('.react-flow').getBoundingClientRect()
  const r = document.querySelector('${node('carne')}').getBoundingClientRect()
  return r.left >= pane.left && r.right <= pane.right && r.top >= pane.top && r.bottom <= pane.bottom
})()`)
log('feature nova fora da tela', `${await selected()} | ficou visível: ${visible}`)
await press('z', { ctrl: true })
await click('button[title="Ajustar à tela"]')
await sleep(400)
// 8. Notação dos grupos: alternative (arco vazio), personalizada ([n..m]) e or (cheio)
const arc = () =>
  js(`(() => {
    const svg = document.querySelector('[data-group-id="pagamento:grupo:0"]')
    const label = svg.querySelector('text')?.textContent ?? 'nenhum'
    return svg.dataset.groupKind + ' | ' + svg.querySelector('path').getAttribute('class') + ' | rótulo: ' + label
  })()`)
await click(node('pag_pix'))
await click({ text: 'Alternative [1..1]' })
await sleep(500)
log('grupo alternative', await arc())
await fill('input[aria-label="Mínimo"]', '2')
await fill('input[aria-label="Máximo (número ou *)"]', '3')
await click({ text: 'Aplicar' })
await sleep(500)
log('grupo personalizado', await arc())
await press('z', { ctrl: true })
await press('z', { ctrl: true })
await sleep(500)
log('Ctrl+Z ×2 volta ao or', await arc())
log('final', `${await tree()} | ${await title()}`)
log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
