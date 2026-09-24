// Edições de assets e comandos (plano da Fase 4, Tarefa 1).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/asset-edits-check.mts
import { readFileSync } from 'node:fs'
import * as cmd from '@/application/editing/commands'
import {
  EMPTY_HISTORY,
  executeCommand,
  undo,
  type EditHistory
} from '@/application/editing/edit-history'
import type { EditorCommand, EditorState } from '@/application/editing/editor-command'
import { assetLabel, EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import {
  checkNewAssetId,
  suggestAssetId,
  suggestAssetKind,
  type AssetDraft
} from '@/domain/assets/asset-edits'
import { groupAssetsByAnchor } from '@/domain/assets/asset-groups'
import { parseExpression } from '@/domain/expression/parser'
import { encodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'

const example = (path: string): string => readFileSync(`docs/examples/loja-online/${path}`, 'utf8')
const decoded = decodeFeatureModel(parseXmlRoot(example('model.xml')))
if (!decoded.ok) throw new Error('o modelo do exemplo não abriu')
const model = decoded.value
const log = (label: string, value: unknown): void => console.log(label.padEnd(38), '→', value)
const expression = (text: string) => {
  const parsed = parseExpression(text)
  if (!parsed.ok) throw new Error(parsed.error.message)
  return parsed.value
}

let state: EditorState = { model, assets: EMPTY_ASSET_CATALOG }
let history: EditHistory = EMPTY_HISTORY
/** Executa como a store: recusado não muda nada e devolve o motivo. */
const run = (command: EditorCommand): string => {
  const step = executeCommand(history, state, command)
  if (!step.ok) return `recusado: ${step.error}`
  state = step.value.state
  history = step.value.history
  return 'ok'
}
const order = (): string => state.assets.assets.map((asset) => asset.id).join(' ')
const draft = (
  path: string,
  anchor: string,
  id = suggestAssetId(state.assets, path)
): AssetDraft => ({
  id,
  path,
  kind: suggestAssetKind(path),
  anchor,
  name: ''
})

// 1. Sugestões
log('tipo de boleto.xml', suggestAssetKind('docs/pagamento/boleto.xml'))
log('tipo de pix-fluxo.svg', suggestAssetKind('docs/img/pix-fluxo.svg'))
log('tipo de LEIAME.XML', suggestAssetKind('LEIAME.XML'))
log('ID de visao-geral.xml', suggestAssetId(state.assets, 'docs/loja/visao-geral.xml'))
log('ID de pix-fluxo.svg', suggestAssetId(state.assets, 'docs/img/pix-fluxo.svg'))
log('ID de 2024-intro.xml', suggestAssetId(state.assets, '2024-intro.xml'))
log('ID de and.xml', suggestAssetId(state.assets, 'and.xml'))
log('ID de .gitkeep', suggestAssetId(state.assets, 'docs/.gitkeep'))

// 2. Recriar os 6 assets do exemplo, passando por todas as operações
run(
  cmd.linkAsset({ ...draft('docs/loja/visao-geral.xml', 'loja', 'doc_loja'), name: 'Visão geral' })
)
run(cmd.linkAsset({ ...draft('docs/busca/busca.xml', 'busca', 'doc_busca'), name: 'Busca' }))
// vinculado com o arquivo errado e na âncora errada; depois, troca de arquivo e de âncora
run(cmd.linkAsset(draft('docs/busca/busca.xml', 'catalogo', 'doc_busca_app')))
log('mesmo arquivo duas vezes', order())
run(cmd.linkAsset(draft('docs/pagamento/pix.xml', 'pag_pix', 'doc_pix')))
log('trocar arquivo', run(cmd.relinkAsset('doc_busca_app', 'docs/busca/busca-app.xml')))
log(
  'mudar âncora vai para o fim',
  `${run(cmd.setAssetAnchor('doc_busca_app', 'busca'))} | ${order()}`
)
log('subir dentro da âncora', `${run(cmd.reorderAsset('doc_busca_app', -1))} | ${order()}`)
log('descer de volta', `${run(cmd.reorderAsset('doc_busca_app', 1))} | ${order()}`)
log('primeiro da âncora não sobe', run(cmd.reorderAsset('doc_busca', -1)))
log('último da âncora não desce', run(cmd.reorderAsset('doc_pix', 1)))
run(cmd.renameAsset('doc_busca_app', 'Busca no app'))
run(cmd.setAssetCondition('doc_busca_app', expression('busca and mobile')))
run(cmd.renameAsset('doc_pix', 'Guia do PIX'))
// o SVG como fragmento, depois corrigido para recurso
run(cmd.linkAsset({ ...draft('docs/img/pix-fluxo.svg', 'pag_pix', 'img_pix'), kind: 'fragment' }))
run(cmd.setAssetKind('img_pix', 'resource'))
run(cmd.renameAsset('img_pix', 'Fluxo do PIX'))
run(
  cmd.linkAsset({
    ...draft('docs/pagamento/boleto.xml', 'pag_boleto', 'doc_boleto'),
    name: 'Guia do boleto'
  })
)
log('ordem final', order())
log('assets.xml igual ao exemplo', encodeAssetCatalog(state.assets) === example('assets.xml'))

// 3. Agrupamento por âncora, na pré-ordem do modelo
log(
  'grupos',
  groupAssetsByAnchor(state.model, state.assets)
    .map((group) => `${group.feature.id}(${group.assets.map((asset) => asset.id).join(',')})`)
    .join(' ')
)

// 4. Recusas: nada muda
const before = state
log('ID repetido', checkNewAssetId(state.assets, 'doc_pix'))
log('ID inválido', checkNewAssetId(state.assets, 'Doc-Pix'))
log('vincular com ID repetido', run(cmd.linkAsset(draft('x.svg', 'loja', 'doc_pix'))))
log('âncora inexistente (A2)', run(cmd.setAssetAnchor('doc_pix', 'fantasma')))
log(
  'condição com feature inexistente',
  run(cmd.setAssetCondition('doc_pix', expression('mobile and fantasma')))
)
log('caminho fora do projeto (A1)', run(cmd.relinkAsset('doc_pix', '../fora.xml')))
log('asset inexistente', run(cmd.unlinkAsset('fantasma', 'Fantasma')))
log('estado igual depois das recusas', state === before)

// 5. Nome vazio, sem condição, desvincular e desfazer
run(cmd.renameAsset('doc_busca', '  '))
log('sem nome mostra o arquivo', assetLabel(state.assets.assets[1]))
run(cmd.setAssetCondition('doc_busca_app', undefined))
log('condição removida', state.assets.assets[2].condition === undefined)
log('desvincular', `${run(cmd.unlinkAsset('img_pix', 'Fluxo do PIX'))} | ${order()}`)
log('rótulo do desfazer', history.past.at(-1)?.label)
for (let i = 0; i < 3; i++) {
  const step = undo(history)
  if (step === undefined) throw new Error('nada para desfazer')
  history = step.history
  state = step.state
}
log('desfazer 3 vezes volta ao exemplo', encodeAssetCatalog(state.assets) === example('assets.xml'))
