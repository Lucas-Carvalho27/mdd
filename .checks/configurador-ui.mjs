// Roteiro do configurador (plano da Fase 3, Tarefa 4), com entrada real pelo protocolo do Chromium.
// Uso: node .checks/configurador-ui.mjs <porta> <pasta-do-projeto>
// O app precisa estar na tela inicial, com a pasta nos recentes. A pasta é uma cópia de
// docs/examples/loja-online com configurations/conflito.xml a mais (veja o plano).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, log, sleep } from './cdp.mjs'

const [port, projectDir] = process.argv.slice(2)
const ui = await connect(port)
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
const { click, press, fill, choose, text, title, js, waitFor } = ui
const node = (id) => `[data-feature-id="${id}"]`
const MARK = {
  'manual-selected': '+',
  'manual-deselected': '-',
  'propagated-selected': '+🔒',
  'propagated-deselected': '-🔒',
  undecided: '?'
}
const states = () =>
  js(
    `[...document.querySelectorAll('[data-feature-id]')].map((n) => n.dataset.featureId + ({ ${Object.entries(
      MARK
    )
      .map(([k, v]) => `'${k}': '${v}'`)
      .join(', ')} })[n.dataset.status]).join(' ')`
  )
const footer = () => text('footer')
const banners = () =>
  js(
    `[...document.querySelectorAll('[data-banner]')].map((b) => b.dataset.banner).join(' ') || 'nenhuma'`
  )
const configurations = () =>
  js(
    `[...document.querySelectorAll('[data-configuration-key]')].map((b) => b.dataset.configurationKey + (b.getAttribute('aria-current') ? '*' : '')).join(' ')`
  )
const file = (name) => {
  const path = join(projectDir, 'configurations', name)
  return existsSync(path) ? readFileSync(path, 'utf8') : '(não existe)'
}

// 1. Abrir pelo recente e ir para a aba Configurações
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Configurações' })
await sleep(300)
log('aba', await js(`document.querySelector('nav [aria-current=page]').innerText`))
log(
  'rótulo da aba cortado',
  await js(
    `[...document.querySelectorAll('nav[aria-label="Seções do projeto"] button')].some((b) => b.scrollWidth > b.clientWidth)`
  )
)
log('lista', await configurations())
log('centro sem configuração aberta', await text('main section p'))
log('barra de status', await footer())

// 2. Abrir loja-basica: completa, mobile propagada e travada
await click('[data-configuration-key="loja-basica"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await sleep(800)
log('estados', await states())
log('barra de status', await footer())
log('dica de mobile', await js(`document.querySelector('${node('mobile')}').title`))
log(
  'mobile aria-disabled',
  await js(`document.querySelector('${node('mobile')}').getAttribute('aria-disabled')`)
)
log('faixas', await banners())
log('título', await title())

// 3. Clique em mobile (travada) não muda nada
await click(node('mobile'))
log('clique em mobile', `${await states()} | ${await title()}`)

// 4. Dois cliques em pag_pix: mobile fica indecisa
await click(node('pag_pix'))
log('1º clique em pag_pix', await states())
await click(node('pag_pix'))
log('2º clique em pag_pix', await states())
log('barra de status', await footer())
log('título', await title())
await click(node('pag_pix'))
log('3º clique em pag_pix', await states())

// 5. Atalhos de edição não valem aqui; desfazer fica desabilitado
await press('Tab')
log(
  'Tab no configurador',
  await js(`document.querySelector('[role=dialog]') ? 'abriu diálogo' : 'nada'`)
)
log(
  'botão desfazer',
  await js(
    `(() => { const b = document.querySelector('header button[title*="Desfazer"]'); return b.disabled + ' | ' + b.title })()`
  )
)

// 6. Valores dos atributos das features selecionadas
log(
  'painel de valores',
  await js(
    `[...document.querySelectorAll('[data-values-feature]')].map((d) => d.dataset.valuesFeature).join(' ')`
  )
)
await fill('#value-busca-max_resultados', '9000')
await press('Enter')
log(
  'valor fora da faixa',
  `${await js(`document.querySelector('#value-busca-max_resultados').value`)} | ${await text('[data-values-feature="busca"] .text-destructive')}`
)
await fill('#value-busca-max_resultados', '200')
await press('Enter')
log(
  'valor válido',
  `${await js(`document.querySelector('#value-busca-max_resultados').value`)} | erro: ${await text('[data-values-feature="busca"] .text-destructive')}`
)
await choose('#value-mobile-plataforma', '')
log(
  'plataforma sem valor',
  `${await footer()} | ${await text('[data-values-feature="mobile"] .text-destructive')}`
)
await choose('#value-mobile-plataforma', 'ios')
log('plataforma ios', await footer())

// 7. Nova configuração, renomear, duplicar e excluir
await click({ text: 'Nova' })
await fill('#configuration-name', 'Loja Básica')
log('arquivo sugerido', await text('[role=dialog] code'))
await fill('#configuration-name', 'Loja Completa')
await click({ text: 'Criar' })
await sleep(500)
log('criada e aberta', `${await configurations()} | ${await footer()}`)
await click({ text: 'Renomear…' })
await fill('#configuration-name', 'Loja Premium')
await click({ tag: '[role=dialog] button', text: 'Renomear' })
await sleep(300)
log('renomeada', await configurations())
await click({ text: 'Duplicar…' })
log('nome sugerido na cópia', await js(`document.querySelector('#configuration-name').value`))
await click({ tag: '[role=dialog] button', text: 'Duplicar' })
await sleep(300)
log('duplicada', await configurations())
await click({ text: 'Excluir…' })
log('diálogo de exclusão', await text('[role=dialog] p'))
await click({ tag: '[role=dialog] button', text: 'Excluir' })
await sleep(300)
log('excluída', `${await configurations()} | ${await text('main section p')}`)

// 8. Salvar grava loja-basica e loja-premium; a cópia excluída nunca chegou ao disco
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log('título depois de salvar', await title())
log(
  'loja-basica.xml',
  file('loja-basica.xml')
    .match(/<value[^\n]*/g)
    .join(' ')
)
log('loja-premium.xml', file('loja-premium.xml').split('\n')[1])
log('cópia no disco', file('loja-premium-copia.xml'))

// 9. Excluir pag_pix no modelo e salvar: loja-basica abre desatualizada
await click({ text: 'Modelo' })
await waitFor(`document.querySelector('${node('pag_pix')}') !== null`)
await sleep(800)
await click(node('pag_pix'))
await press('Delete')
log('impacto', await text('[role=dialog] .space-y-3'))
await click({ tag: '[role=dialog] button', text: 'Excluir' })
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
await click({ text: 'Configurações' })
await click('[data-configuration-key="loja-basica"]')
await sleep(800)
log('desatualizada: faixas', await banners())
log('referência órfã', await text('[data-banner="orphans"] li'))
log('estados', await states())
log('barra de status', await footer())
await click({ text: 'Remover referências órfãs' })
await sleep(300)
log('depois de remover', `${await banners()} | ${await footer()} | ${await title()}`)

// 10. Conflito vindo do arquivo: nós sem resposta, remover uma decisão resolve
await click('[data-configuration-key="conflito"]')
await sleep(800)
log('conflito: faixas', await banners())
log('decisões listadas', await text('[data-banner="conflict"] ul'))
log('estados em conflito', await states())
log(
  'nó em conflito responde?',
  await js(`document.querySelector('${node('busca')}').getAttribute('aria-disabled')`)
)
log('painel de valores', await text('aside p'))
await js(
  `[...document.querySelectorAll('[data-banner="conflict"] li')].find((li) => li.innerText.startsWith('Catálogo')).querySelector('button').dataset.alvo = 'sim'`
)
await click('[data-alvo="sim"]')
await sleep(500)
log('depois de remover a decisão', `${await banners()} | ${await footer()}`)
log('estados', await states())

log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
