// Roteiro da aba Assets com entrada real (plano da Fase 4, Tarefa 4).
// Uso: node .checks/assets-ui.mjs <porta-cdp> <porta-inspect> <pasta-do-projeto>
// O app precisa estar aberto com --remote-debugging-port e --inspect. Nenhum programa abre:
// o diálogo de arquivo e o shell.openPath do main são trocados por registradores.
import { readFileSync, renameSync } from 'node:fs'
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
const { click, press, fill, choose, text, value, title, js, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))
const row = (id) => `[data-asset-id="${id}"]`
const groups = () =>
  js(`[...document.querySelectorAll('[data-anchor]')].map((group) =>
    group.dataset.anchor + '(' + [...group.querySelectorAll('[data-asset-id]')]
      .map((row) => row.dataset.assetId + ':' + row.querySelector('[data-file-status]').dataset.fileStatus)
      .join(' ') + ')').join(' ')`)
const status = (id) =>
  js(`document.querySelector('${row(id)} [data-file-status]').dataset.fileStatus`)
const summary = () => text('[data-assets-summary]')
const notice = () =>
  js(
    `[...document.querySelectorAll('main span')].find((s) => /^(Edição recusada|Arquivo recusado|Não foi possível abrir)/.test(s.innerText))?.innerText ?? '(sem aviso)'`
  )
const undoTitle = () =>
  js(
    `[...document.querySelectorAll('header button')].find((b) => b.title.startsWith('Desfazer'))?.title`
  )
const disabled = (selector) => js(`document.querySelector(${JSON.stringify(selector)}).disabled`)
const dialogOpen = () => js(`document.querySelector('[role=dialog]') !== null`)
const settle = () => sleep(600)

// 1. A aba mostra os 6 assets do exemplo, agrupados por âncora
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Assets' })
await waitFor(
  `document.querySelectorAll('[data-file-status=checking]').length === 0 && document.querySelectorAll('[data-asset-id]').length > 0`
)
log('1. grupos', await groups())
log('   resumo', await summary())
log('   painel sem seleção', await text('aside'))

// 2. boleto.xml renomeado fora do app: ausente quando a janela volta ao foco. O Windows não
// deixa um app em segundo plano tomar o foco, então o roteiro dispara o evento na página.
renameSync(file('docs/pagamento/boleto.xml'), file('docs/pagamento/boleto-renomeado.xml'))
log('2. antes de voltar o foco', await status('doc_boleto'))
await js(`window.dispatchEvent(new Event('focus'))`)
await settle()
log('   depois de voltar o foco', await status('doc_boleto'))
log('   resumo', await summary())
log('   abrir desligado', await disabled(`${row('doc_boleto')} button[title^="Abrir"]`))
renameSync(file('docs/loja/visao-geral.xml'), file('docs/loja/visao.xml'))
await click({ text: 'Atualizar' })
await settle()
log('   Atualizar', `doc_loja ${await status('doc_loja')} | ${await summary()}`)
renameSync(file('docs/loja/visao.xml'), file('docs/loja/visao-geral.xml'))
await click({ text: 'Atualizar' })
await settle()
log('   de volta', `doc_loja ${await status('doc_loja')} | ${await summary()}`)

// 3. Trocar arquivo
await click(`${row('doc_boleto')} > button`)
await main.answerFiles([file('docs/pagamento/boleto-renomeado.xml')])
await click({ text: 'Trocar arquivo…' })
await settle()
log(
  '3. trocar arquivo',
  `${await text('[data-asset-properties] code.break-all')} | ${await status('doc_boleto')}`
)
const dialogSeen = JSON.parse(await main.lastDialog())
log(
  '   diálogo',
  `${dialogSeen.title} | começa no projeto: ${dialogSeen.defaultPath === projectDir} | ${dialogSeen.properties}`
)
log('   desfazer', await undoTitle())
await press('z', { ctrl: true })
await settle()
log(
  '   Ctrl+Z na aba Assets',
  `${await text('[data-asset-properties] code.break-all')} | ${await status('doc_boleto')}`
)
await press('y', { ctrl: true })
await settle()
log(
  '   Ctrl+Y',
  `${await text('[data-asset-properties] code.break-all')} | ${await status('doc_boleto')}`
)

// 4. Condição: erro de sintaxe não grava; Enter grava; Esc descarta; sugestão mantém o foco
await click(`${row('doc_busca_app')} > button`)
log('4. condição', await value('#asset-condition'))
await fill('#asset-condition', 'busca and')
await click('#asset-name')
log('   erro ao sair', await text('[data-asset-properties] .text-destructive'))
log('   na lista', await text(`${row('doc_busca_app')} > button`))
await fill('#asset-condition', 'busca and not mobile')
await press('Enter')
log('   Enter grava', await text(`${row('doc_busca_app')} > button`))
await fill('#asset-condition', 'mobile')
await press('Escape')
log('   Esc descarta', `${await value('#asset-condition')} | ${await undoTitle()}`)
await fill('#asset-condition', 'busca and mob')
await click({ tag: '[data-asset-properties] button', text: 'mobile' })
log(
  '   sugestão',
  `"${await value('#asset-condition')}" | foco no campo: ${await js(`document.activeElement.id === 'asset-condition'`)}`
)
await press('Enter')
log('   de volta ao exemplo', await text(`${row('doc_busca_app')} > button`))

// 5. Nome, tipo, âncora e reordenar, cada um com desfazer
await fill('#asset-name', '')
await press('Enter')
log('5. sem nome', await text(`${row('doc_busca_app')} > button`))
await press('z', { ctrl: true })
await choose('#asset-kind', 'resource')
log(
  '   recurso',
  await js(`document.querySelector('${row('doc_busca_app')} svg').getAttribute('aria-label')`)
)
await press('z', { ctrl: true })
await choose('#asset-anchor', 'mobile')
log('   âncora mobile', await groups())
await press('z', { ctrl: true })
await click(`${row('doc_busca_app')} button[title="Mover para cima"]`)
log('   subir', await groups())
log(
  '   o primeiro não sobe',
  await disabled(`${row('doc_busca_app')} button[title="Mover para cima"]`)
)
await press('z', { ctrl: true })
log('   depois de desfazer', await groups())

// 6. Desvincular e desfazer
await click(`${row('img_pix')} > button`)
await click(`${row('img_pix')} button[title^="Desvincular"]`)
log('6. desvincular', `${await groups()} | painel: ${await text('aside')}`)
log('   desfazer', await undoTitle())
await press('z', { ctrl: true })
log('   depois de desfazer', await groups())

// 7. Vincular: arquivo de fora, cancelar, e um arquivo do projeto
await main.answerFiles(['C:\\Windows\\win.ini'])
await click({ text: 'Vincular arquivo…' })
await settle()
log('7. arquivo de fora', `${await notice()} | diálogo: ${await dialogOpen()}`)
await click('button[title="Dispensar"]')
await click({ text: 'Vincular arquivo…' })
await settle()
log('   cancelado', `diálogo: ${await dialogOpen()} | aviso: ${await notice()}`)
await click(`${row('doc_pix')} > button`)
await main.answerFiles([file('docs/img/pix-fluxo.svg')])
await click({ text: 'Vincular arquivo…' })
await waitFor(`document.querySelector('[role=dialog]') !== null`)
log(
  '   diálogo de vincular',
  `${await text('[role=dialog] p')} | ${await value('#link-asset-kind')} | ${await value('#link-asset-id')} | ${await value('#link-asset-anchor')}`
)
await fill('#link-asset-id', 'img_pix')
log(
  '   ID repetido',
  `${await text('[role=dialog] .text-destructive')} | botão desligado: ${await js(`[...document.querySelectorAll('[role=dialog] button')].find((b) => b.innerText === 'Vincular').disabled`)}`
)
await fill('#link-asset-id', 'img_pix_capa')
await fill('#link-asset-name', 'Capa do PIX')
await click({ tag: '[role=dialog] button', text: 'Vincular' })
await settle()
log(
  '   vinculado',
  `${await groups()} | selecionado: ${await js(`document.querySelector('[data-asset-properties]').dataset.assetProperties`)}`
)

// 8. Abrir no programa padrão (registrado, nada abre)
await click(`${row('doc_pix')} button[title^="Abrir"]`)
await settle()
log('8. abrir', (await main.opened()).replace(projectDir, '<projeto>'))
await main.failOpenFor('pix-fluxo.svg')
await click(`${row('img_pix')} button[title^="Abrir"]`)
await settle()
log('   falha ao abrir', await notice())
await click('button[title="Dispensar"]')

// 9. Atalhos da estrutura não valem na aba Assets
await press('Tab')
await press('Delete')
log('9. Tab e Delete na aba Assets', `diálogo: ${await dialogOpen()}`)

// 10. O painel da feature mostra os assets ancorados
await click({ text: 'Modelo' })
await waitFor(`document.querySelector('[data-feature-id="pag_pix"]') !== null`)
await sleep(800)
await click('[data-feature-id="pag_pix"]')
log('10. assets ancorados', await text('[data-anchored-assets]'))
await click({ tag: '[data-anchored-assets] button', text: 'Vincular arquivo…' })
await settle()
log('   vincular cancelado', `diálogo: ${await dialogOpen()}`)

// 10b. O editor de restrições, agora sobre o ExpressionInput, continua igual
const submitDisabled = () =>
  js(
    `[...document.querySelectorAll('form button')].find((b) => b.innerText === 'Adicionar restrição').disabled`
  )
const constraintsTitle = () =>
  js(
    `[...document.querySelectorAll('aside h2')].find((h) => h.innerText.startsWith('RESTRIÇÕES')).innerText`
  )
await click({ tag: 'aside button', text: 'Nova' })
await fill('#constraint-expression', 'pag_boleto and')
log(
  '10b. restrição com erro',
  `${await text('form .text-destructive')} | botão desligado: ${await submitDisabled()}`
)
await fill('#constraint-expression', 'pag_boleto implies bu')
await click({ tag: 'form button', text: 'busca' })
log('   sugestão', `"${await value('#constraint-expression')}"`)
await fill('#constraint-expression', 'pag_boleto implies fantasma')
log(
  '   feature inexistente',
  `${await text('form .text-destructive')} | botão desligado: ${await submitDisabled()}`
)
await fill('#constraint-expression', 'pag_boleto implies busca')
await click({ tag: 'form button', text: 'Adicionar restrição' })
log('   adicionada', await constraintsTitle())
await press('z', { ctrl: true })
log('   Ctrl+Z', await constraintsTitle())

// 11. No configurador, desfazer não vale
await click({ text: 'Configurações' })
log(
  '11. desfazer no configurador',
  (await undoTitle()) ??
    (await js(
      `[...document.querySelectorAll('header button')].find((b) => b.title.includes('Desfazer'))?.title`
    ))
)

// 12. Salvar
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
const saved = readFileSync(file('assets.xml'), 'utf8')
log('12. salvo', await title())
log(
  '   no disco',
  `${saved.includes('path="docs/pagamento/boleto-renomeado.xml"')} | ${saved.includes('id="img_pix_capa"')}`
)

log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
main.close()
