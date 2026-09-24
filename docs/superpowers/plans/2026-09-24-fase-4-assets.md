# Fase 4 — Assets: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** vincular arquivos do projeto às features. A janela ganha a aba Assets, com os assets agrupados por âncora, o estado de cada arquivo (ok ou ausente) e as ações abrir, editar, trocar arquivo, reordenar e desvincular. O painel da feature mostra os assets ancorados nela.

**Arquitetura:**

- **Domínio** (puro): as edições do catálogo de assets, com a ordem do arquivo seguindo as âncoras no modelo; o agrupamento por âncora; o tipo `AssetFileStatus`.
- **Aplicação:** comandos de asset no histórico de desfazer; as portas `ProjectFilePicker` e `AssetOpener`; `ProjectStorage.stat`; o caso de uso `CheckAssetFiles`.
- **Processo main e IPC:** canais `stat`, `pickFileInProject` e `openPath`; o `ProjectRoot` converte o caminho escolhido para relativo e recusa o que fica fora.
- **Interface:** as ações de assets da store num arquivo próprio; a aba Assets (lista, painel, diálogo de vincular); a seção "Assets ancorados" no painel da feature; o editor de expressão tirado de dentro do `ConstraintForm`; atalhos com três escopos; conferência dos arquivos quando a janela volta ao foco.

**Stack:** a das fases anteriores. Sem dependências novas.

**Spec:** [docs/superpowers/specs/2026-09-24-fase-4-assets-design.md](../specs/2026-09-24-fase-4-assets-design.md) (o desenho aprovado) e [docs/SPEC.md](../../SPEC.md): §4.3 (assets), §4.5 (comandos de asset), §6.2 e §6.3 (portas e canais), §7 (Assets) e §9 (linha da Fase 4). Veja também os ADRs [0004](../../adr/0004-ids-estaveis-para-features.md) e [0008](../../adr/0008-camadas-com-lint-sem-testes.md). O protótipo refinou alguns pontos do desenho; eles estão em "O que o protótipo respondeu", e a Tarefa 5 os leva para a spec do desenho e para a SPEC.

## Restrições globais

- **Sem testes automatizados** (ADR 0008).
  - Cada tarefa verifica com `npm run typecheck`, `npm run lint` e scripts descartáveis em `.checks/`.
  - `.checks/` fica fora do git, do ESLint e do Prettier.
  - Os scripts `.mts` rodam com `npx tsx --tsconfig tsconfig.web.json`, por causa do alias `@/`. Os `.mjs` rodam com `node`.
  - Os roteiros da interface usam `.checks/cdp.mjs` (plano da 2B, Tarefa 3, Passo 12) e `.checks/quit.mjs` (plano da Fase 3, Tarefa 4, Passo 15). Num clone novo, recrie os dois a partir desses planos. O `main-process.mjs` e o `run-ui.sh` estão na Tarefa 4 deste plano.
- **Camadas** (SPEC §6.1): `domain/` não importa nada de fora dele; `application/` só `domain/`; só `ui/app/` conhece `infrastructure/`. O lint barra violações.
- **Imports:** dentro de `domain/`, relativos; nas demais camadas, alias `@/`.
- **Idioma:** identificadores em inglês; textos da interface, mensagens, comentários e documentação em português.
- **Regras do lint:**
  - toda função tem tipo de retorno explícito;
  - as regras de hooks do React 19 estão ligadas: nada de `setState` síncrono dentro de effect, nada de ler ref durante o render;
  - um arquivo `.tsx` só exporta componentes (`react-refresh/only-export-components`): funções, hooks e constantes compartilhadas vão para um `.ts` ao lado.
- **Classes do Tailwind** sempre escritas por inteiro no código (nada de `` `bg-${cor}` ``), senão o Tailwind não as gera.
- **Imutabilidade:** modelo e catálogo de assets são valores imutáveis. Uma edição que não muda nada devolve o mesmo objeto.
- **Toda edição de asset é um comando do histórico** (SPEC §4.5): desfazer e refazer valem nas abas Modelo e Assets. O histórico já confere as regras A1–A3 depois de cada comando.
- **Estado do arquivo** é calculado e nunca salvo (SPEC §4.3).
- **Commits:** rode `npm run format` antes de cada commit. Os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Shell:** todo comando roda na raiz do repositório com **Git Bash**, no branch `fase-4-assets`.
- **Roteiros de interface abrem janelas na tela do usuário:** combine o momento com ele antes. Para fechar o app, use `.checks/quit.mjs`, nunca `taskkill /IM electron.exe`.

## O que o protótipo respondeu

O código deste plano foi prototipado e verificado numa cópia descartável do repositório, inclusive no `mdd.exe` empacotado. Estas são as respostas aos riscos do desenho e os achados pelo caminho.

**Os cinco riscos:**

1. **Caminho escolhido no diálogo.** O `path.relative` do Node resolve os casos do Windows: maiúsculas diferentes na raiz, `/` no lugar de `\`, a própria pasta do projeto (volta `""`), pasta vizinha de nome parecido (`loja-online-2`), outro disco e caminho de rede (voltam `..\…` ou absolutos). Uma pasta interna chamada `..loja` continua valendo, porque a regra é "começa com `..` seguido do separador". O `ProjectRoot` ganha `toRelative` e compartilha essa regra com o `resolve`.
2. **A volta do foco.** Com uma troca de foco de verdade (outra janela ganha o foco e a do app o recebe de volta), o renderer recebe `blur` e `focus`, cada um duas vezes. Basta ouvir o `focus` da `window`; o main não precisa avisar. As duas conferências seguidas custam pouco, e a resposta da mais antiga é descartada.
   - **Nos roteiros**, a troca de foco não é confiável: o Windows não deixa um app em segundo plano tomar o foco de outra janela, e o `focus()` do main não chega quando o usuário está usando outra janela. Os roteiros disparam o evento na página (`window.dispatchEvent(new Event('focus'))`), o que exercita o nosso código. Na aceitação, o usuário faz uma vez à mão: renomeia no Explorer e volta ao app.
3. **`shell.openPath`.** O caminho até ele foi conferido no `mdd.exe` com o `shell.openPath` trocado por um registrador, pelo inspetor do main: o app pede o caminho absoluto certo, e uma falha vira aviso. A abertura de verdade fica para a aceitação, combinada com o usuário. Um arquivo de extensão sem programa associado não serve de teste sem janela: o Windows pode abrir o diálogo "Como você deseja abrir este arquivo?".
4. **`ExpressionInput`.** Nenhum roteiro anterior digitava no editor de restrições, então o `assets-ui.mjs` cobre isso: erro com a coluna, feature inexistente, sugestão, adicionar e desfazer. Clicar numa sugestão não tira o foco do campo (`onMouseDown` com `preventDefault`), o que importa para a condição, que grava ao sair do campo.
5. **Ações de assets num arquivo à parte.** O `assets-actions.ts` recebe `set` e `get` da `project-store` e importa dela só tipos, que somem no JavaScript: não há import circular em tempo de execução.

**Achados pelo caminho** (a Tarefa 5 leva para a spec do desenho e para a SPEC):

6. **Ordem no arquivo.** Mandar para o fim do arquivo um asset novo, ou que troca de âncora, deixava a lista agrupada certa, mas o `assets.xml` diferente do exemplo. Um asset novo, ou que troca de âncora, entra como o último da âncora, na posição que mantém o arquivo agrupado na ordem das âncoras no modelo (pré-ordem). Assim o exemplo recriado pela interface, vinculando fora de ordem, sai idêntico. É o mesmo princípio das decisões da Fase 3: o arquivo não depende da ordem dos cliques.
7. **Estado depois de desfazer.** Conferir só depois de vincular e trocar arquivo deixava "verificando…" para sempre num caminho que voltou com o desfazer. A store confere os arquivos depois de qualquer comando que mude os assets (`applyStep`), o que cobre vincular, trocar arquivo, desfazer e refazer.
8. **Ctrl+Z com o foco numa lista de opções.** Depois de escolher tipo ou âncora, o foco fica no `<select>`, e o atalho ignorava a tecla como se fosse um campo de texto. Um `<select>` não tem desfazer próprio: ali Ctrl+Z e Ctrl+Y vão para o histórico; as demais teclas continuam com a lista.
9. **Esc no campo de condição.** O `blur()` dispara o `onBlur` na hora, ainda com o texto digitado na closure, e gravaria o que o Esc devia descartar. Um `ref` marca o cancelamento.
10. **O aviso da faixa amarela** passa a guardar o texto inteiro: "Edição recusada: …", "Arquivo recusado: …", "Não foi possível abrir …". A faixa só exibe o texto, então os roteiros antigos, que procuram "Edição recusada", continuam iguais.
11. **Funções de edição separadas.** No lugar de um `updateAsset` com campos opcionais, o domínio tem `renameAsset`, `setAssetKind`, `setAssetAnchor` e `setAssetCondition`, cada um com o seu comando e rótulo de desfazer.
12. **`configurator-store-check.mts`** (Fase 3) monta a store sem os serviços novos, e a store agora confere os arquivos ao abrir o projeto. Ele ganha os três serviços, com a mesma saída (Tarefa 3).
13. **Regressão:** o `ui-check.mjs` (2A) e o `configurador-ui.mjs` (Fase 3) saíram iguais; neste, só muda a linha da dica do desfazer ("Desfazer vale só nas abas Modelo e Assets"). O `diagrama-ui.mjs` (2B) é instável nos arrastos e no clique logo depois de "Ajustar à tela": falhou uma vez em três rodadas no protótipo, duas em três na execução deste plano e uma em três no `mdd.exe` de antes da Fase 4, cada vez num ponto diferente. Não tem relação com esta fase: se falhar, rode de novo.
14. **Na execução**, logo depois de um build, a tela inicial demorou mais que uma espera fixa de 2 segundos, e o roteiro clicou antes de a lista de recentes aparecer. O `run-ui.sh` espera a lista aparecer (até 30 segundos).

## Mapa de arquivos

| Arquivo                                                                                                                                           | Responsabilidade                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `domain/assets/asset-catalog.ts`                                                                                                                  | `fileNameOf` e `assetLabel`                                                                       |
| `domain/assets/asset-edits.ts`                                                                                                                    | Sugestões de ID e tipo; vincular, editar, trocar arquivo, reordenar e desvincular                 |
| `domain/assets/asset-groups.ts`                                                                                                                   | Grupos por âncora na pré-ordem; assets de uma âncora                                              |
| `domain/assets/asset-file-status.ts`                                                                                                              | Tipo `AssetFileStatus`                                                                            |
| `application/editing/commands.ts`                                                                                                                 | Comandos de asset                                                                                 |
| `application/ports/project-storage.ts`                                                                                                            | `stat`                                                                                            |
| `application/ports/project-file-picker.ts`, `asset-opener.ts`                                                                                     | Portas novas                                                                                      |
| `application/use-cases/check-asset-files.ts`                                                                                                      | Estado do arquivo por caminho                                                                     |
| `shared/ipc.ts`, `preload/index.ts`                                                                                                               | Canais `stat`, `pickFileInProject` e `openPath`                                                   |
| `main/project-root.ts`                                                                                                                            | `toRelative`                                                                                      |
| `main/ipc/file-handlers.ts`, `project-handlers.ts`                                                                                                | Os três canais no main                                                                            |
| `infrastructure/electron/*`                                                                                                                       | `stat`, `ElectronProjectFilePicker`, `ElectronAssetOpener`                                        |
| `ui/stores/assets-actions.ts`                                                                                                                     | Seleção, estado dos arquivos, escolher, vincular, trocar e abrir                                  |
| `ui/stores/project-store.ts`                                                                                                                      | Monta as ações de assets; aviso com o texto inteiro; confere ao abrir e depois de mudar os assets |
| `ui/app/composition-root.ts`                                                                                                                      | Injeta os serviços novos                                                                          |
| `ui/components/expression-check.ts`, `ExpressionInput.tsx`                                                                                        | O editor de expressão compartilhado                                                               |
| `ui/screens/project/constraints/ConstraintForm.tsx`                                                                                               | Usa o `ExpressionInput`                                                                           |
| `ui/screens/assets/*`                                                                                                                             | A aba Assets                                                                                      |
| `ui/screens/project/properties/AnchoredAssetsSection.tsx`, `FeatureProperties.tsx`, `ModelWorkspace.tsx`                                          | Assets ancorados no painel da feature                                                             |
| `ui/screens/project/ViewRail.tsx`, `ProjectScreen.tsx`, `ProjectHeader.tsx`, `editor-dialog.ts`, `use-editor-shortcuts.ts`, `use-window-focus.ts` | Terceira aba, diálogo de vincular, atalhos por escopo, volta do foco                              |

(Os caminhos em `domain/`, `application/`, `infrastructure/` e `ui/` ficam em `src/renderer/src/`; os de `shared/`, `preload/` e `main/`, em `src/`.)

---

### Tarefa 1: Domínio e comandos dos assets

**Arquivos:**

- Modificar: `src/renderer/src/domain/assets/asset-catalog.ts`
- Criar: `src/renderer/src/domain/assets/asset-edits.ts`, `src/renderer/src/domain/assets/asset-groups.ts`
- Modificar: `src/renderer/src/application/editing/commands.ts`
- Verificação: `.checks/asset-edits-check.mts`

**Interfaces:**

- Consome: `Asset`, `AssetCatalog`, `AssetKind`, `EMPTY_ASSET_CATALOG` (`domain/assets/asset-catalog.ts`); `generateId(name, taken, fallback)` (`domain/shared/identifier-generator.ts`); `isValidFeatureId` (`domain/expression/identifier.ts`); `featuresInPreOrder` (`domain/feature-model/traversal.ts`); `Expression`; `EditorCommand`, `executeCommand`, `undo` (`application/editing/`); `encodeAssetCatalog` (`infrastructure/xml/assets-codec.ts`, só no roteiro).
- Produz:
  - `fileNameOf(path): string`, `assetLabel(asset): string` (`asset-catalog.ts`)
  - `AssetDraft` (`id`, `path`, `kind`, `anchor`, `name`; nome vazio = sem nome), `AssetEditResult`, `suggestAssetKind(path)`, `suggestAssetId(catalog, path)`, `checkNewAssetId(catalog, id): string | null`, `linkAsset(model, catalog, draft)`, `renameAsset(catalog, assetId, name)`, `setAssetKind(catalog, assetId, kind)`, `setAssetAnchor(model, catalog, assetId, anchor)`, `setAssetCondition(catalog, assetId, condition | undefined)`, `relinkAsset(catalog, assetId, path)`, `reorderAsset(catalog, assetId, -1 | 1)`, `unlinkAsset(catalog, assetId)`, `findAsset(catalog, assetId)` (`asset-edits.ts`)
  - `AnchorGroup` (`feature`, `assets`), `groupAssetsByAnchor(model, catalog)`, `assetsAnchoredAt(catalog, featureId)` (`asset-groups.ts`)
  - comandos `linkAsset(draft)`, `renameAsset(assetId, name)`, `setAssetKind(assetId, kind)`, `setAssetAnchor(assetId, anchor)`, `setAssetCondition(assetId, condition)`, `relinkAsset(assetId, path)`, `reorderAsset(assetId, offset)`, `unlinkAsset(assetId, label)` (`commands.ts`)

- [ ] **Passo 1: Conferir o branch**

```bash
git switch fase-4-assets
git log --oneline -3
```

Esperado: o branch já tem o commit do desenho (`docs: desenho da Fase 4 (assets)`) e o deste plano.

- [ ] **Passo 2: Escrever o roteiro `.checks/asset-edits-check.mts`**

O caso principal recria os 6 assets do exemplo do zero, passando por todas as operações, e confere o `assets.xml` byte a byte.

```ts
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
```

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/asset-edits-check.mts
```

Esperado: falha ao carregar, porque `@/domain/assets/asset-edits` ainda não existe.

- [ ] **Passo 4: `src/renderer/src/domain/assets/asset-catalog.ts`**

Acrescente no fim do arquivo:

```ts
/** O último trecho do caminho: "docs/img/pix-fluxo.svg" → "pix-fluxo.svg". */
export function fileNameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Como o asset aparece na interface: o nome, ou o nome do arquivo quando não tem nome. */
export function assetLabel(asset: Asset): string {
  return asset.name ?? fileNameOf(asset.path)
}
```

- [ ] **Passo 5: Criar `src/renderer/src/domain/assets/asset-edits.ts`**

```ts
import type { Expression } from '../expression/ast'
import { isValidFeatureId } from '../expression/identifier'
import type { FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import { generateId } from '../shared/identifier-generator'
import { err, ok, type Result } from '../shared/result'
import { fileNameOf, type Asset, type AssetCatalog, type AssetKind } from './asset-catalog'

/*
 * Edições do mapeamento de assets (SPEC §4.5). Cada operação devolve um catálogo novo ou o
 * motivo da recusa. As invariantes A1–A3 são conferidas depois, pelo histórico de comandos.
 * A ordem do catálogo é a ordem no assets.xml; entre os assets de uma mesma âncora, é também
 * a ordem no produto gerado (SPEC §4.3). Um asset novo, ou que troca de âncora, entra como o
 * último da âncora, na posição que mantém o arquivo agrupado na ordem das âncoras no modelo:
 * assim o arquivo não depende da ordem em que os vínculos foram feitos.
 */

export type AssetEditResult = Result<AssetCatalog, string>

/** O que se escolhe ao vincular um arquivo. */
export interface AssetDraft {
  readonly id: string
  readonly path: string
  readonly kind: AssetKind
  readonly anchor: string
  /** Vazio = sem nome. */
  readonly name: string
}

/** `.xml` vira fragmento; as demais extensões, recurso (SPEC §7). */
export function suggestAssetKind(path: string): AssetKind {
  return path.toLowerCase().endsWith('.xml') ? 'fragment' : 'resource'
}

/** ID a partir do nome do arquivo sem a extensão: "pix-fluxo.svg" → "pix_fluxo". */
export function suggestAssetId(catalog: AssetCatalog, path: string): string {
  const fileName = fileNameOf(path)
  const dot = fileName.lastIndexOf('.')
  const base = dot > 0 ? fileName.slice(0, dot) : fileName
  return generateId(base, assetIds(catalog), 'asset')
}

/**
 * Confere o ID escolhido ao vincular: o mesmo formato do ID de feature e inédito entre os
 * assets. Como o das features, ele não muda depois (ADR 0004). `null` quando serve.
 */
export function checkNewAssetId(catalog: AssetCatalog, id: string): string | null {
  if (!isValidFeatureId(id)) {
    return `O ID "${id}" é inválido: use letras minúsculas, dígitos e _, começando por letra, e evite palavras reservadas.`
  }
  if (assetIds(catalog).has(id)) return `Já existe um asset com o ID "${id}".`
  return null
}

export function linkAsset(
  model: FeatureModel,
  catalog: AssetCatalog,
  draft: AssetDraft
): AssetEditResult {
  const problem = checkNewAssetId(catalog, draft.id)
  if (problem !== null) return err(problem)
  const name = draft.name.trim()
  const asset: Asset = {
    id: draft.id,
    kind: draft.kind,
    path: draft.path,
    anchor: draft.anchor,
    ...(name !== '' ? { name } : {})
  }
  return ok({ assets: insertAsLastOfAnchor(model, catalog.assets, asset) })
}

/** Nome vazio tira o nome: a interface passa a mostrar o nome do arquivo. */
export function renameAsset(catalog: AssetCatalog, assetId: string, name: string): AssetEditResult {
  const trimmed = name.trim()
  return editAsset(catalog, assetId, ({ name: _old, ...asset }) =>
    trimmed !== '' ? { ...asset, name: trimmed } : asset
  )
}

export function setAssetKind(
  catalog: AssetCatalog,
  assetId: string,
  kind: AssetKind
): AssetEditResult {
  return editAsset(catalog, assetId, (asset) => ({ ...asset, kind }))
}

/** Com a âncora nova, o asset passa a ser o último dela. */
export function setAssetAnchor(
  model: FeatureModel,
  catalog: AssetCatalog,
  assetId: string,
  anchor: string
): AssetEditResult {
  const asset = findAsset(catalog, assetId)
  if (asset === undefined) return err(notFound(assetId))
  if (asset.anchor === anchor) return ok(catalog)
  const others = catalog.assets.filter((other) => other.id !== assetId)
  return ok({ assets: insertAsLastOfAnchor(model, others, { ...asset, anchor }) })
}

/** `undefined` tira a condição: o asset entra sempre que a âncora estiver selecionada. */
export function setAssetCondition(
  catalog: AssetCatalog,
  assetId: string,
  condition: Expression | undefined
): AssetEditResult {
  return editAsset(catalog, assetId, ({ condition: _old, ...asset }) =>
    condition !== undefined ? { ...asset, condition } : asset
  )
}

/** Troca o arquivo; ID, nome, tipo, âncora e condição ficam como estão. */
export function relinkAsset(catalog: AssetCatalog, assetId: string, path: string): AssetEditResult {
  return editAsset(catalog, assetId, (asset) => ({ ...asset, path }))
}

/** Troca de lugar com o vizinho da mesma âncora, acima (-1) ou abaixo (1). */
export function reorderAsset(
  catalog: AssetCatalog,
  assetId: string,
  offset: -1 | 1
): AssetEditResult {
  const index = catalog.assets.findIndex((asset) => asset.id === assetId)
  if (index < 0) return err(notFound(assetId))
  const anchor = catalog.assets[index].anchor
  let neighbor = index + offset
  while (neighbor >= 0 && neighbor < catalog.assets.length) {
    if (catalog.assets[neighbor].anchor === anchor) break
    neighbor += offset
  }
  if (neighbor < 0 || neighbor >= catalog.assets.length) {
    return err(
      offset < 0 ? 'O asset já é o primeiro da âncora.' : 'O asset já é o último da âncora.'
    )
  }
  const assets = [...catalog.assets]
  ;[assets[index], assets[neighbor]] = [assets[neighbor], assets[index]]
  return ok({ assets })
}

/** O arquivo continua no disco. */
export function unlinkAsset(catalog: AssetCatalog, assetId: string): AssetEditResult {
  if (findAsset(catalog, assetId) === undefined) return err(notFound(assetId))
  return ok({ assets: catalog.assets.filter((asset) => asset.id !== assetId) })
}

export function findAsset(catalog: AssetCatalog, assetId: string): Asset | undefined {
  return catalog.assets.find((asset) => asset.id === assetId)
}

/**
 * Põe o asset depois do último cuja âncora vem antes da dele, ou é a dele, na pré-ordem do
 * modelo. Uma âncora que não existe vai para o fim (e o histórico recusa o comando, A2).
 */
function insertAsLastOfAnchor(
  model: FeatureModel,
  assets: readonly Asset[],
  asset: Asset
): Asset[] {
  const ranks = new Map(featuresInPreOrder(model.root).map((feature, index) => [feature.id, index]))
  const rank = (anchor: string): number => ranks.get(anchor) ?? Number.MAX_SAFE_INTEGER
  let index = 0
  assets.forEach((other, position) => {
    if (rank(other.anchor) <= rank(asset.anchor)) index = position + 1
  })
  return [...assets.slice(0, index), asset, ...assets.slice(index)]
}

function editAsset(
  catalog: AssetCatalog,
  assetId: string,
  update: (asset: Asset) => Asset
): AssetEditResult {
  if (findAsset(catalog, assetId) === undefined) return err(notFound(assetId))
  return ok({
    assets: catalog.assets.map((asset) => (asset.id === assetId ? update(asset) : asset))
  })
}

function assetIds(catalog: AssetCatalog): Set<string> {
  return new Set(catalog.assets.map((asset) => asset.id))
}

function notFound(assetId: string): string {
  return `O asset "${assetId}" não existe.`
}
```

`({ name: _old, ...asset })` tira o campo do objeto; o lint aceita a variável sem uso porque está ao lado do `...resto` (`ignoreRestSiblings`).

- [ ] **Passo 6: Criar `src/renderer/src/domain/assets/asset-groups.ts`**

```ts
import type { Feature, FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import type { Asset, AssetCatalog } from './asset-catalog'

/** Os assets de uma âncora, na ordem do catálogo (a ordem no produto gerado). */
export interface AnchorGroup {
  readonly feature: Feature
  readonly assets: readonly Asset[]
}

/** Um grupo por âncora, na pré-ordem do modelo; só as features que têm assets. */
export function groupAssetsByAnchor(model: FeatureModel, catalog: AssetCatalog): AnchorGroup[] {
  return featuresInPreOrder(model.root)
    .map((feature) => ({ feature, assets: assetsAnchoredAt(catalog, feature.id) }))
    .filter((group) => group.assets.length > 0)
}

export function assetsAnchoredAt(catalog: AssetCatalog, featureId: string): Asset[] {
  return catalog.assets.filter((asset) => asset.anchor === featureId)
}
```

- [ ] **Passo 7: Comandos em `src/renderer/src/application/editing/commands.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import * as attributes from '@/domain/feature-model/attribute-edits'
import * as constraints from '@/domain/feature-model/constraint-edits'
import * as features from '@/domain/feature-model/feature-edits'
import type { FeatureModel, GroupMax, Variability } from '@/domain/feature-model/feature-model'
```

por:

<!-- prettier-ignore -->
```ts
import { fileNameOf, type AssetCatalog, type AssetKind } from '@/domain/assets/asset-catalog'
import * as assets from '@/domain/assets/asset-edits'
import * as attributes from '@/domain/feature-model/attribute-edits'
import * as constraints from '@/domain/feature-model/constraint-edits'
import * as features from '@/domain/feature-model/feature-edits'
import type { FeatureModel, GroupMax, Variability } from '@/domain/feature-model/feature-model'
```

Troque:

<!-- prettier-ignore -->
```ts
    }
  }
}

function modelCommand(
  label: string,
  edit: (model: FeatureModel) => Result<FeatureModel, string>,
  focusFeatureId?: string
```

por:

<!-- prettier-ignore -->
```ts
    }
  }
}

export function linkAsset(draft: assets.AssetDraft): EditorCommand {
  return assetCommand(`Vincular "${fileNameOf(draft.path)}"`, (catalog, model) =>
    assets.linkAsset(model, catalog, draft)
  )
}

export function renameAsset(assetId: string, name: string): EditorCommand {
  return assetCommand('Renomear asset', (catalog) => assets.renameAsset(catalog, assetId, name))
}

export function setAssetKind(assetId: string, kind: AssetKind): EditorCommand {
  return assetCommand(kind === 'fragment' ? 'Tornar fragmento' : 'Tornar recurso', (catalog) =>
    assets.setAssetKind(catalog, assetId, kind)
  )
}

export function setAssetAnchor(assetId: string, anchor: string): EditorCommand {
  return assetCommand('Mudar âncora', (catalog, model) =>
    assets.setAssetAnchor(model, catalog, assetId, anchor)
  )
}

export function setAssetCondition(
  assetId: string,
  condition: Expression | undefined
): EditorCommand {
  return assetCommand(condition ? 'Editar condição' : 'Remover condição', (catalog) =>
    assets.setAssetCondition(catalog, assetId, condition)
  )
}

export function relinkAsset(assetId: string, path: string): EditorCommand {
  return assetCommand(`Trocar arquivo por "${fileNameOf(path)}"`, (catalog) =>
    assets.relinkAsset(catalog, assetId, path)
  )
}

export function reorderAsset(assetId: string, offset: -1 | 1): EditorCommand {
  return assetCommand(offset < 0 ? 'Mover asset para cima' : 'Mover asset para baixo', (catalog) =>
    assets.reorderAsset(catalog, assetId, offset)
  )
}

/** `label` é como o asset aparece na lista, para o "Desfazer: Desvincular …". */
export function unlinkAsset(assetId: string, label: string): EditorCommand {
  return assetCommand(`Desvincular "${label}"`, (catalog) => assets.unlinkAsset(catalog, assetId))
}

function modelCommand(
  label: string,
  edit: (model: FeatureModel) => Result<FeatureModel, string>,
  focusFeatureId?: string
```

Troque:

<!-- prettier-ignore -->
```ts
      return ok({ state: { ...state, model: edited.value }, focusFeatureId })
    }
  }
}
```

por:

<!-- prettier-ignore -->
```ts
      return ok({ state: { ...state, model: edited.value }, focusFeatureId })
    }
  }
}

function assetCommand(
  label: string,
  edit: (catalog: AssetCatalog, model: FeatureModel) => Result<AssetCatalog, string>
): EditorCommand {
  return {
    label,
    run: (state) => {
      const edited = edit(state.assets, state.model)
      if (!edited.ok) return edited
      return ok({ state: { ...state, assets: edited.value } })
    }
  }
}
```

- [ ] **Passo 8: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/asset-edits-check.mts
```

Esperado, exatamente:

```
tipo de boleto.xml                     → fragment
tipo de pix-fluxo.svg                  → resource
tipo de LEIAME.XML                     → fragment
ID de visao-geral.xml                  → visao_geral
ID de pix-fluxo.svg                    → pix_fluxo
ID de 2024-intro.xml                   → f_2024_intro
ID de and.xml                          → and_2
ID de .gitkeep                         → gitkeep
mesmo arquivo duas vezes               → doc_loja doc_busca_app doc_busca
trocar arquivo                         → ok
mudar âncora vai para o fim            → ok | doc_loja doc_busca doc_busca_app doc_pix
subir dentro da âncora                 → ok | doc_loja doc_busca_app doc_busca doc_pix
descer de volta                        → ok | doc_loja doc_busca doc_busca_app doc_pix
primeiro da âncora não sobe            → recusado: O asset já é o primeiro da âncora.
último da âncora não desce             → recusado: O asset já é o último da âncora.
ordem final                            → doc_loja doc_busca doc_busca_app doc_pix img_pix doc_boleto
assets.xml igual ao exemplo            → true
grupos                                 → loja(doc_loja) busca(doc_busca,doc_busca_app) pag_pix(doc_pix,img_pix) pag_boleto(doc_boleto)
ID repetido                            → Já existe um asset com o ID "doc_pix".
ID inválido                            → O ID "Doc-Pix" é inválido: use letras minúsculas, dígitos e _, começando por letra, e evite palavras reservadas.
vincular com ID repetido               → recusado: Já existe um asset com o ID "doc_pix".
âncora inexistente (A2)                → recusado: A âncora "fantasma" não existe no modelo.
condição com feature inexistente       → recusado: A condição cita a feature "fantasma", que não existe.
caminho fora do projeto (A1)           → recusado: O caminho "../fora.xml" precisa ser relativo e ficar dentro do projeto.
asset inexistente                      → recusado: O asset "fantasma" não existe.
estado igual depois das recusas        → true
sem nome mostra o arquivo              → busca.xml
condição removida                      → true
desvincular                            → ok | doc_loja doc_busca doc_busca_app doc_pix doc_boleto
rótulo do desfazer                     → Desvincular "Fluxo do PIX"
desfazer 3 vezes volta ao exemplo      → true
```

Destaques: "assets.xml igual ao exemplo → true" mesmo com um vínculo na âncora errada, uma troca de arquivo e um tipo corrigido pelo caminho; "mudar âncora vai para o fim" põe `doc_busca_app` depois de `doc_busca`, e não no fim do arquivo; as recusas não mudam nada.

- [ ] **Passo 9: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 10: Commit**

```bash
npm run format
git add src/renderer/src/domain/assets src/renderer/src/application/editing/commands.ts
git commit -m "feat(assets): edições de assets e comandos, com o arquivo na ordem das âncoras

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: Estado, escolha e abertura de arquivos

**Arquivos:**

- Criar: `src/renderer/src/domain/assets/asset-file-status.ts`
- Modificar: `src/renderer/src/application/ports/project-storage.ts`
- Criar: `src/renderer/src/application/ports/project-file-picker.ts`, `src/renderer/src/application/ports/asset-opener.ts`, `src/renderer/src/application/use-cases/check-asset-files.ts`
- Modificar: `src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/ipc/file-handlers.ts`, `src/main/ipc/project-handlers.ts`
- Substituir: `src/main/project-root.ts`
- Modificar: `src/renderer/src/infrastructure/electron/electron-project-storage.ts`
- Criar: `src/renderer/src/infrastructure/electron/electron-project-file-picker.ts`, `src/renderer/src/infrastructure/electron/electron-asset-opener.ts`
- Verificação: `.checks/asset-files-check.mts`, `.checks/project-root-check.mts`

**Interfaces:**

- Consome: `AssetCatalog` (`domain/assets/asset-catalog.ts`); `ProjectStorage`, `StorageError`, `StorageEntry` (`application/ports/project-storage.ts`); `IpcChannel`, `MddApi`, `IpcResult` (`shared/ipc.ts`); `withinProject`, `ok`, `fail` (`main/ipc/`).
- Produz:
  - `AssetFileStatus = 'ok' | 'missing'` (`domain/assets/asset-file-status.ts`)
  - `StorageEntryKind = 'file' | 'directory'` e `ProjectStorage.stat(path): Promise<Result<StorageEntryKind, StorageError>>`
  - `ProjectFilePicker.pickFile(title): Promise<Result<string | null, StorageError>>`; `AssetOpener.open(path): Promise<Result<null, StorageError>>`
  - `class CheckAssetFiles` (`constructor(storage)`, `execute(catalog): Promise<ReadonlyMap<string, AssetFileStatus>>`)
  - canais `mdd:stat`, `mdd:pick-file-in-project`, `mdd:open-path`; `MddApi.stat`, `pickFileInProject`, `openPath`
  - `ProjectRoot.toRelative(absolutePath): string | null`
  - `ElectronProjectFilePicker`, `ElectronAssetOpener`, `ElectronProjectStorage.stat`

- [ ] **Passo 1: Escrever `.checks/asset-files-check.mts`**

```ts
// Estado dos arquivos dos assets (plano da Fase 4, Tarefa 2).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/asset-files-check.mts
import type { ProjectStorage, StorageEntryKind } from '@/application/ports/project-storage'
import { CheckAssetFiles } from '@/application/use-cases/check-asset-files'
import type { Asset } from '@/domain/assets/asset-catalog'
import { err, ok } from '@/domain/shared/result'

const log = (label: string, value: unknown): void => console.log(label.padEnd(30), '→', value)
const entries = new Map<string, StorageEntryKind>([
  ['docs/busca/busca.xml', 'file'],
  ['docs/img', 'directory']
])
const asked: string[] = []
const storage = {
  async stat(path: string) {
    asked.push(path)
    if (path === 'bloqueado.xml') return err({ code: 'io' as const, message: 'sem permissão' })
    const kind = entries.get(path)
    return kind === undefined ? err({ code: 'not-found' as const, message: path }) : ok(kind)
  }
} as unknown as ProjectStorage

const asset = (id: string, path: string): Asset => ({ id, kind: 'resource', path, anchor: 'loja' })
const statuses = await new CheckAssetFiles(storage).execute({
  assets: [
    asset('a', 'docs/busca/busca.xml'),
    asset('b', 'docs/busca/busca.xml'),
    asset('c', 'docs/pagamento/boleto.xml'),
    asset('d', 'docs/img'),
    asset('e', 'bloqueado.xml')
  ]
})
log('arquivo que existe', statuses.get('docs/busca/busca.xml'))
log('arquivo que não existe', statuses.get('docs/pagamento/boleto.xml'))
log('caminho que é pasta', statuses.get('docs/img'))
log('erro ao conferir', statuses.get('bloqueado.xml'))
log('caminhos conferidos', `${asked.length} (${statuses.size} no mapa)`)
log('catálogo vazio', (await new CheckAssetFiles(storage).execute({ assets: [] })).size)
```

- [ ] **Passo 2: Escrever `.checks/project-root-check.mts`**

Ele importa o `ProjectRoot` do main direto, por caminho relativo (o main não usa o alias `@/`).

```ts
// O caminho escolhido no diálogo, relativo à raiz do projeto (plano da Fase 4, Tarefa 2).
// Uso: npx tsx .checks/project-root-check.mts
import { ProjectRoot } from '../src/main/project-root'

const root = new ProjectRoot()
root.open(String.raw`C:\projetos\loja-online`)
const log = (label: string, value: unknown): void => console.log(label.padEnd(34), '→', value)
const cases: [string, string][] = [
  ['arquivo numa subpasta', String.raw`C:\projetos\loja-online\docs\pagamento\boleto.xml`],
  ['outra caixa na raiz', String.raw`c:\PROJETOS\Loja-Online\docs\img\pix-fluxo.svg`],
  ['com barras normais', 'C:/projetos/loja-online/model.xml'],
  ['a própria pasta', String.raw`C:\projetos\loja-online`],
  ['pasta vizinha de nome parecido', String.raw`C:\projetos\loja-online-2\x.xml`],
  ['pasta de cima', String.raw`C:\projetos\outra.xml`],
  ['outro disco', String.raw`D:\fora\arquivo.xml`],
  ['caminho de rede', String.raw`\\servidor\pasta\a.xml`],
  ['pasta interna "..loja"', String.raw`C:\projetos\loja-online\..loja\a.xml`]
]
for (const [label, path] of cases) log(label, root.toRelative(path) ?? '(fora do projeto)')
log('resolve continua recusando ../', root.resolve('../fora.xml') ?? '(fora do projeto)')
log('resolve de um caminho do projeto', root.resolve('docs/busca/busca.xml'))
```

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/asset-files-check.mts
npx tsx .checks/project-root-check.mts
```

Esperado: o primeiro falha ao carregar `@/application/use-cases/check-asset-files`; o segundo, com `root.toRelative is not a function`.

- [ ] **Passo 4: Criar `src/renderer/src/domain/assets/asset-file-status.ts`**

```ts
/**
 * Estado do arquivo de um asset (SPEC §4.3): calculado, nunca salvo. "XML malformado" só é
 * conferido na geração (Fase 5).
 */
export type AssetFileStatus = 'ok' | 'missing'
```

- [ ] **Passo 5: `stat` na porta `src/renderer/src/application/ports/project-storage.ts`**

Troque:

<!-- prettier-ignore -->
```ts
}

export interface StorageEntry {
  readonly name: string
  readonly kind: 'file' | 'directory'
}
```

por:

<!-- prettier-ignore -->
```ts
}

export type StorageEntryKind = 'file' | 'directory'

export interface StorageEntry {
  readonly name: string
  readonly kind: StorageEntryKind
}
```

Troque:

<!-- prettier-ignore -->
```ts
  /** Exclui o arquivo; um arquivo que já não existe conta como excluído. */
  remove(path: string, precondition: RemovePrecondition): Promise<Result<null, StorageError>>
}
```

por:

<!-- prettier-ignore -->
```ts
  /** Exclui o arquivo; um arquivo que já não existe conta como excluído. */
  remove(path: string, precondition: RemovePrecondition): Promise<Result<null, StorageError>>
  /** Se o caminho é um arquivo ou uma pasta; `not-found` quando não existe. */
  stat(path: string): Promise<Result<StorageEntryKind, StorageError>>
}
```

- [ ] **Passo 6: Criar as portas novas**

`src/renderer/src/application/ports/project-file-picker.ts`:

```ts
import type { Result } from '@/domain/shared/result'
import type { StorageError } from './project-storage'

/** Escolha de um arquivo dentro do projeto aberto (SPEC §6.2), para vincular a um asset. */
export interface ProjectFilePicker {
  /**
   * O caminho relativo do arquivo escolhido, ou `null` quando o usuário cancela. Um arquivo
   * fora da pasta do projeto volta como erro `outside-project`.
   */
  pickFile(title: string): Promise<Result<string | null, StorageError>>
}
```

`src/renderer/src/application/ports/asset-opener.ts`:

```ts
import type { Result } from '@/domain/shared/result'
import type { StorageError } from './project-storage'

/** Abre um arquivo do projeto no programa padrão do sistema (SPEC §6.2). */
export interface AssetOpener {
  open(path: string): Promise<Result<null, StorageError>>
}
```

- [ ] **Passo 7: Criar `src/renderer/src/application/use-cases/check-asset-files.ts`**

```ts
import type { AssetCatalog } from '@/domain/assets/asset-catalog'
import type { AssetFileStatus } from '@/domain/assets/asset-file-status'
import type { ProjectStorage } from '../ports/project-storage'

/**
 * O estado do arquivo de cada asset (SPEC §4.3), por caminho. Ok é um arquivo que existe;
 * não existir, ser uma pasta ou não dar para conferir contam como ausente. Um caminho usado
 * por vários assets é conferido uma vez só.
 */
export class CheckAssetFiles {
  private readonly storage: ProjectStorage

  constructor(storage: ProjectStorage) {
    this.storage = storage
  }

  async execute(catalog: AssetCatalog): Promise<ReadonlyMap<string, AssetFileStatus>> {
    const paths = [...new Set(catalog.assets.map((asset) => asset.path))]
    const statuses = await Promise.all(
      paths.map(async (path): Promise<[string, AssetFileStatus]> => {
        const entry = await this.storage.stat(path)
        return [path, entry.ok && entry.value === 'file' ? 'ok' : 'missing']
      })
    )
    return new Map(statuses)
  }
}
```

- [ ] **Passo 8: Contrato do IPC em `src/shared/ipc.ts`**

Troque:

<!-- prettier-ignore -->
```ts
}

export interface DirectoryEntry {
  name: string
  kind: 'file' | 'directory'
}
```

por:

<!-- prettier-ignore -->
```ts
}

export type EntryKind = 'file' | 'directory'

export interface DirectoryEntry {
  name: string
  kind: EntryKind
}
```

Troque:

<!-- prettier-ignore -->
```ts
  /** Exclui o arquivo. Um arquivo que já não existe conta como excluído. */
  remove(relativePath: string, precondition: RemovePrecondition): Promise<IpcResult<null>>
  /** Confere se o conteúdo é XML bem-formado e segue o XSD. Lista vazia = válido. */
  validateXml(
```

por:

<!-- prettier-ignore -->
```ts
  /** Exclui o arquivo. Um arquivo que já não existe conta como excluído. */
  remove(relativePath: string, precondition: RemovePrecondition): Promise<IpcResult<null>>
  /** Se o caminho é um arquivo ou uma pasta; `not-found` quando não existe. */
  stat(relativePath: string): Promise<IpcResult<EntryKind>>
  /**
   * Diálogo nativo para escolher um arquivo, começando na pasta do projeto. Devolve o caminho
   * relativo, `null` quando cancelado, ou `outside-project` para um arquivo de fora.
   */
  pickFileInProject(title: string): Promise<IpcResult<string | null>>
  /** Abre o arquivo do projeto no programa padrão do sistema. */
  openPath(relativePath: string): Promise<IpcResult<null>>
  /** Confere se o conteúdo é XML bem-formado e segue o XSD. Lista vazia = válido. */
  validateXml(
```

Troque:

<!-- prettier-ignore -->
```ts
  writeText: 'mdd:write-text',
  remove: 'mdd:remove',
  validateXml: 'mdd:validate-xml'
} as const
```

por:

<!-- prettier-ignore -->
```ts
  writeText: 'mdd:write-text',
  remove: 'mdd:remove',
  stat: 'mdd:stat',
  pickFileInProject: 'mdd:pick-file-in-project',
  openPath: 'mdd:open-path',
  validateXml: 'mdd:validate-xml'
} as const
```

- [ ] **Passo 9: `src/preload/index.ts`**

Troque:

<!-- prettier-ignore -->
```ts
  remove: (relativePath, precondition) =>
    ipcRenderer.invoke(IpcChannel.remove, relativePath, precondition),
  validateXml: (schema, fileName, content) =>
    ipcRenderer.invoke(IpcChannel.validateXml, schema, fileName, content)
```

por:

<!-- prettier-ignore -->
```ts
  remove: (relativePath, precondition) =>
    ipcRenderer.invoke(IpcChannel.remove, relativePath, precondition),
  stat: (relativePath) => ipcRenderer.invoke(IpcChannel.stat, relativePath),
  pickFileInProject: (title) => ipcRenderer.invoke(IpcChannel.pickFileInProject, title),
  openPath: (relativePath) => ipcRenderer.invoke(IpcChannel.openPath, relativePath),
  validateXml: (schema, fileName, content) =>
    ipcRenderer.invoke(IpcChannel.validateXml, schema, fileName, content)
```

- [ ] **Passo 10: Substituir `src/main/project-root.ts`**

```ts
import { isAbsolute, join, relative, resolve, sep } from 'path'

/**
 * Guarda a pasta do projeto aberto e resolve caminhos relativos a ela,
 * recusando qualquer caminho que escape da pasta.
 */
export class ProjectRoot {
  private rootPath: string | null = null

  open(rootPath: string): void {
    this.rootPath = resolve(rootPath)
  }

  get current(): string | null {
    return this.rootPath
  }

  /** Devolve o caminho absoluto, ou `null` se o caminho sair do projeto. */
  resolve(relativePath: string): string | null {
    const root = this.requireRoot()
    if (isAbsolute(relativePath)) return null
    const absolute = resolve(join(root, relativePath))
    return escapesRoot(relative(root, absolute)) ? null : absolute
  }

  /**
   * O caminho relativo à raiz, com "/" como separador, de um arquivo escolhido no diálogo.
   * `null` para o que fica fora do projeto (outro disco, pasta vizinha) ou para a própria raiz.
   */
  toRelative(absolutePath: string): string | null {
    const fromRoot = relative(this.requireRoot(), resolve(absolutePath))
    if (fromRoot === '' || escapesRoot(fromRoot)) return null
    return fromRoot.split(sep).join('/')
  }

  private requireRoot(): string {
    if (this.rootPath === null) throw new Error('Nenhum projeto aberto.')
    return this.rootPath
  }
}

/** O caminho, relativo à raiz, sai dela? No Windows, outro disco volta como caminho absoluto. */
function escapesRoot(fromRoot: string): boolean {
  return fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)
}
```

- [ ] **Passo 11: `stat` e `openPath` em `src/main/ipc/file-handlers.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import { createHash } from 'crypto'
import { ipcMain } from 'electron'
import { mkdir, readdir, readFile, unlink, writeFile } from 'fs/promises'
import { dirname } from 'path'
import {
  IpcChannel,
  type DirectoryEntry,
  type IpcResult,
  type RemovePrecondition,
```

por:

<!-- prettier-ignore -->
```ts
import { createHash } from 'crypto'
import { ipcMain, shell } from 'electron'
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import { dirname } from 'path'
import {
  IpcChannel,
  type DirectoryEntry,
  type EntryKind,
  type IpcResult,
  type RemovePrecondition,
```

Troque:

<!-- prettier-ignore -->
```ts
      })
  )
}
```

por:

<!-- prettier-ignore -->
```ts
      })
  )

  ipcMain.handle(IpcChannel.stat, (_event, relativePath: string) =>
    withinProject<EntryKind>(root, relativePath, async (path) => {
      const info = await stat(path)
      return ok(info.isDirectory() ? 'directory' : 'file')
    })
  )

  ipcMain.handle(IpcChannel.openPath, (_event, relativePath: string) =>
    withinProject<null>(root, relativePath, async (path) => {
      if ((await stat(path)).isDirectory()) {
        return fail('io', `"${relativePath}" é uma pasta, não um arquivo.`)
      }
      // O Electron devolve texto vazio quando deu certo, ou a mensagem do sistema.
      const problem = await shell.openPath(path)
      return problem === '' ? ok(null) : fail('io', problem)
    })
  )
}
```

- [ ] **Passo 12: `pickFileInProject` em `src/main/ipc/project-handlers.ts`**

Troque:

<!-- prettier-ignore -->
```ts
  )

  ipcMain.handle(IpcChannel.listRecentProjects, () => recents.list())
```

por:

<!-- prettier-ignore -->
```ts
  )

  ipcMain.handle(
    IpcChannel.pickFileInProject,
    async (event, title: string): Promise<IpcResult<string | null>> => {
      if (root.current === null) return fail('no-project', 'Nenhum projeto aberto.')
      const options: OpenDialogOptions = {
        title,
        defaultPath: root.current,
        properties: ['openFile']
      }
      const window = BrowserWindow.fromWebContents(event.sender)
      const choice = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (choice.canceled || choice.filePaths.length === 0) return ok(null)
      const relativePath = root.toRelative(choice.filePaths[0])
      if (relativePath === null) {
        return fail(
          'outside-project',
          'O arquivo precisa estar dentro da pasta do projeto. Copie-o para dentro e vincule de novo.'
        )
      }
      return ok(relativePath)
    }
  )

  ipcMain.handle(IpcChannel.listRecentProjects, () => recents.list())
```

- [ ] **Passo 13: Adapters**

`src/renderer/src/infrastructure/electron/electron-project-storage.ts`:

Troque:

<!-- prettier-ignore -->
```ts
  RemovePrecondition,
  StorageEntry,
  StorageError,
  StoredText,
```

por:

<!-- prettier-ignore -->
```ts
  RemovePrecondition,
  StorageEntry,
  StorageEntryKind,
  StorageError,
  StoredText,
```

Troque:

<!-- prettier-ignore -->
```ts
    return window.mdd.remove(path, precondition)
  }
}
```

por:

<!-- prettier-ignore -->
```ts
    return window.mdd.remove(path, precondition)
  }

  stat(path: string): Promise<Result<StorageEntryKind, StorageError>> {
    return window.mdd.stat(path)
  }
}
```

`src/renderer/src/infrastructure/electron/electron-project-file-picker.ts`:

```ts
import type { ProjectFilePicker } from '@/application/ports/project-file-picker'
import type { StorageError } from '@/application/ports/project-storage'
import type { Result } from '@/domain/shared/result'

/** Diálogo nativo de arquivo; o processo main converte a escolha para caminho relativo. */
export class ElectronProjectFilePicker implements ProjectFilePicker {
  pickFile(title: string): Promise<Result<string | null, StorageError>> {
    return window.mdd.pickFileInProject(title)
  }
}
```

`src/renderer/src/infrastructure/electron/electron-asset-opener.ts`:

```ts
import type { AssetOpener } from '@/application/ports/asset-opener'
import type { StorageError } from '@/application/ports/project-storage'
import type { Result } from '@/domain/shared/result'

/** `shell.openPath` no processo main, só para arquivos do projeto aberto. */
export class ElectronAssetOpener implements AssetOpener {
  open(path: string): Promise<Result<null, StorageError>> {
    return window.mdd.openPath(path)
  }
}
```

- [ ] **Passo 14: Rodar os roteiros**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/asset-files-check.mts
npx tsx .checks/project-root-check.mts
```

Esperado, exatamente:

```
arquivo que existe             → ok
arquivo que não existe         → missing
caminho que é pasta            → missing
erro ao conferir               → missing
caminhos conferidos            → 4 (4 no mapa)
catálogo vazio                 → 0
```

```
arquivo numa subpasta              → docs/pagamento/boleto.xml
outra caixa na raiz                → docs/img/pix-fluxo.svg
com barras normais                 → model.xml
a própria pasta                    → (fora do projeto)
pasta vizinha de nome parecido     → (fora do projeto)
pasta de cima                      → (fora do projeto)
outro disco                        → (fora do projeto)
caminho de rede                    → (fora do projeto)
pasta interna "..loja"             → ..loja/a.xml
resolve continua recusando ../     → (fora do projeto)
resolve de um caminho do projeto   → C:\projetos\loja-online\docs\busca\busca.xml
```

- [ ] **Passo 15: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 16: Commit**

```bash
npm run format
git add src/shared src/preload src/main src/renderer/src/domain src/renderer/src/application src/renderer/src/infrastructure
git commit -m "feat(assets): estado do arquivo, escolha de arquivo no projeto e abrir no programa padrão

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Store da aba Assets

**Arquivos:**

- Criar: `src/renderer/src/ui/stores/assets-actions.ts`
- Modificar: `src/renderer/src/ui/stores/project-store.ts`, `src/renderer/src/ui/app/composition-root.ts`, `src/renderer/src/ui/screens/project/ProjectScreen.tsx` (uma linha: o aviso)
- Verificação: `.checks/assets-store-check.mts`, `.checks/configurator-store-check.mts` (ganha os serviços novos)

**Interfaces:**

- Consome: comandos `linkAsset` e `relinkAsset` (Tarefa 1); `AssetFileStatus`, `ProjectFilePicker`, `AssetOpener`, `CheckAssetFiles`, `ElectronProjectFilePicker`, `ElectronAssetOpener` (Tarefa 2); `ProjectState`, `run`, `applyStep` (`project-store.ts`).
- Produz:
  - `AssetsServices` (`checkAssetFiles`, `filePicker`, `assetOpener`), que a `ProjectStoreServices` passa a estender
  - `AssetsState`, que o `ProjectState` passa a estender: `selectedAssetId`, `assetFiles: ReadonlyMap<string, AssetFileStatus>` (caminho fora do mapa = ainda não conferido), `selectAsset(id)`, `checkAssetFiles()`, `pickAssetFile(title): Promise<string | null>`, `linkAsset(draft): boolean`, `relinkAsset(assetId)`, `openAsset(path)`
  - `selectedAsset(state): Asset | null`, `ASSETS_CLOSED`, `createAssetsActions(set, get, services)` (`assets-actions.ts`)
  - `notice` passa a guardar o texto inteiro do aviso ("Edição recusada: …")

- [ ] **Passo 1: Escrever `.checks/assets-store-check.mts`**

A conferência falsa pode ser segurada, para mostrar o "verificando…" e a resposta antiga descartada.

```ts
// Store da aba Assets com portas falsas (plano da Fase 4, Tarefa 3).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/assets-store-check.mts
import { readFileSync } from 'node:fs'
import type { StorageError } from '@/application/ports/project-storage'
import type { ProjectSession } from '@/application/project-session'
import type { AssetCatalog } from '@/domain/assets/asset-catalog'
import type { AssetFileStatus } from '@/domain/assets/asset-file-status'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { selectedAsset } from '@/ui/stores/assets-actions'
import { createProjectStore, hasUnsavedChanges } from '@/ui/stores/project-store'

const read = (path: string) =>
  parseXmlRoot(readFileSync(`docs/examples/loja-online/${path}`, 'utf8'))
const model = decodeFeatureModel(read('model.xml'))
const assets = decodeAssetCatalog(read('assets.xml'))
if (!model.ok || !assets.ok) throw new Error('o exemplo não abriu')
const session: ProjectSession = {
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: { model: model.value, assets: assets.value, configurations: [] },
  hashes: { model: 'x', assets: 'y', configurations: {} }
}
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}

// O disco falso: boleto.xml foi renomeado fora do app. Cada conferência pode ser segurada.
const missing = new Set(['docs/pagamento/boleto.xml'])
let hold: Promise<void> | null = null
const checks: string[] = []
const checkAssetFiles = {
  async execute(catalog: AssetCatalog): Promise<ReadonlyMap<string, AssetFileStatus>> {
    const snapshot = new Map(
      catalog.assets.map((asset): [string, AssetFileStatus] => [
        asset.path,
        missing.has(asset.path) ? 'missing' : 'ok'
      ])
    )
    checks.push(`${catalog.assets.length} assets`)
    if (hold !== null) await hold
    return snapshot
  }
}
const picks: Result<string | null, StorageError>[] = []
const opened: string[] = []
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session, warnings: [] }),
    reopen: notUsed
  },
  createProject: { execute: notUsed },
  saveProject: { execute: notUsed },
  resolveConfiguration: { execute: () => notUsed() as never },
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} },
  checkAssetFiles,
  filePicker: { pickFile: async () => picks.shift() ?? ok(null) },
  assetOpener: {
    async open(path) {
      opened.push(path)
      return path.endsWith('boleto.xml')
        ? err({ code: 'not-found', message: `"${path}" não existe.` })
        : ok(null)
    }
  }
})
const state = () => store.getState()
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const settle = () => new Promise((resolve) => setTimeout(resolve, 10))
const status = (path: string) => state().assetFiles.get(path) ?? 'verificando…'

// 1. Abrir o projeto confere os arquivos
let release = (): void => {}
hold = new Promise((resolve) => (release = resolve))
await state().open()
log('antes da resposta', status('docs/pagamento/boleto.xml'))
hold = null
release()
await settle()
log('boleto.xml', status('docs/pagamento/boleto.xml'))
log('busca.xml', status('docs/busca/busca.xml'))

// 2. Uma resposta antiga não apaga a mais nova
hold = new Promise((resolve) => (release = resolve))
const slow = state().checkAssetFiles()
hold = null
missing.delete('docs/pagamento/boleto.xml')
await state().checkAssetFiles()
log('conferência nova: boleto.xml', status('docs/pagamento/boleto.xml'))
missing.add('docs/pagamento/boleto.xml')
release()
await slow
log('depois da antiga responder', status('docs/pagamento/boleto.xml'))

// 3. Escolher arquivo: cancelado e fora do projeto
picks.push(ok(null))
log('cancelado', `${await state().pickAssetFile('Vincular')} | aviso: ${state().notice}`)
picks.push(
  err({
    code: 'outside-project',
    message:
      'O arquivo precisa estar dentro da pasta do projeto. Copie-o para dentro e vincule de novo.'
  })
)
log('fora do projeto', await state().pickAssetFile('Vincular'))
log('aviso', state().notice)
state().dismissNotice()

// 4. Vincular: seleciona o novo, confere o arquivo e marca alteração
checks.length = 0
const linked = state().linkAsset({
  id: 'capa',
  path: 'docs/img/capa.png',
  kind: 'resource',
  anchor: 'loja',
  name: 'Capa'
})
log(
  'vincular',
  `${linked} | selecionado: ${selectedAsset(state())?.id} | alterado: ${hasUnsavedChanges(state())}`
)
log('antes da conferência', status('docs/img/capa.png'))
await settle()
log('conferências depois de vincular', checks.join(', '))
log('depois da conferência', status('docs/img/capa.png'))
log(
  'ID repetido',
  `${state().linkAsset({ id: 'capa', path: 'x.png', kind: 'resource', anchor: 'loja', name: '' })} | ${state().notice}`
)

// 5. Desfazer tira o asset da seleção
state().undo()
log(
  'desfazer o vínculo',
  `selecionado: ${selectedAsset(state())?.id ?? '(nenhum)'} | alterado: ${hasUnsavedChanges(state())}`
)

// 6. Trocar arquivo
state().selectAsset('doc_boleto')
picks.push(ok('docs/pagamento/boleto-novo.xml'))
await state().relinkAsset('doc_boleto')
await settle()
log(
  'trocar arquivo',
  `${selectedAsset(state())?.path} | ${status('docs/pagamento/boleto-novo.xml')}`
)
log('rótulo do desfazer', state().history.past.at(-1)?.label)

// 7. Abrir: ok, e arquivo que sumiu
await state().openAsset('docs/img/pix-fluxo.svg')
log('abrir', `${opened.join(', ')} | aviso: ${state().notice}`)
checks.length = 0
await state().openAsset('docs/pagamento/boleto.xml')
await settle()
log('abrir o que sumiu', state().notice)
log('conferiu de novo', checks.length)

// 8. Fechar zera a aba
state().close()
log('fechado', `${state().assetFiles.size} estados | selecionado: ${state().selectedAssetId}`)
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/assets-store-check.mts
```

Esperado: falha ao carregar `@/ui/stores/assets-actions`.

- [ ] **Passo 3: Criar `src/renderer/src/ui/stores/assets-actions.ts`**

```ts
import type { StoreApi } from 'zustand/vanilla'
import * as cmd from '@/application/editing/commands'
import type { AssetOpener } from '@/application/ports/asset-opener'
import type { ProjectFilePicker } from '@/application/ports/project-file-picker'
import { fileNameOf, type Asset, type AssetCatalog } from '@/domain/assets/asset-catalog'
import type { AssetDraft } from '@/domain/assets/asset-edits'
import type { AssetFileStatus } from '@/domain/assets/asset-file-status'
import type { ProjectState } from './project-store'

/** Os serviços da aba Assets; a composition root entrega as implementações. */
export interface AssetsServices {
  readonly checkAssetFiles: {
    execute(catalog: AssetCatalog): Promise<ReadonlyMap<string, AssetFileStatus>>
  }
  readonly filePicker: ProjectFilePicker
  readonly assetOpener: AssetOpener
}

/**
 * Estado e ações da aba Assets (SPEC §7). As edições passam pelo histórico, como as do
 * modelo; aqui ficam a seleção, o estado dos arquivos e o que fala com o disco e o sistema.
 */
export interface AssetsState {
  readonly selectedAssetId: string | null
  /**
   * O estado de cada caminho na última conferência. Um caminho que não está no mapa ainda não
   * foi conferido (a interface mostra "verificando…").
   */
  readonly assetFiles: ReadonlyMap<string, AssetFileStatus>

  selectAsset(assetId: string | null): void
  /** Confere todos os arquivos. Se uma conferência mais nova já respondeu, esta é descartada. */
  checkAssetFiles(): Promise<void>
  /** O diálogo de arquivo: o caminho relativo, ou `null` (cancelado, ou recusado com aviso). */
  pickAssetFile(title: string): Promise<string | null>
  /** Vincula e seleciona o asset novo; `false` se o vínculo foi recusado. */
  linkAsset(draft: AssetDraft): boolean
  /** Escolhe outro arquivo para o asset. */
  relinkAsset(assetId: string): Promise<void>
  openAsset(path: string): Promise<void>
}

export const ASSETS_CLOSED = {
  selectedAssetId: null,
  assetFiles: new Map<string, AssetFileStatus>()
} satisfies Partial<AssetsState>

/** O asset selecionado, se ainda existir (desfazer pode tê-lo tirado do catálogo). */
export function selectedAsset(state: ProjectState): Asset | null {
  const id = state.selectedAssetId
  if (state.session === null || id === null) return null
  return state.session.project.assets.assets.find((asset) => asset.id === id) ?? null
}

type SetState = StoreApi<ProjectState>['setState']

export function createAssetsActions(
  set: SetState,
  get: () => ProjectState,
  services: AssetsServices
): Omit<AssetsState, keyof typeof ASSETS_CLOSED> {
  // Cada conferência recebe um número; só a resposta da última é usada.
  let lastCheck = 0

  return {
    selectAsset(assetId) {
      set({ selectedAssetId: assetId })
    },

    async checkAssetFiles() {
      const session = get().session
      if (session === null) return
      const check = ++lastCheck
      const statuses = await services.checkAssetFiles.execute(session.project.assets)
      // Outra conferência começou depois desta, ou o projeto foi fechado ou trocado.
      if (check !== lastCheck || get().session?.folder !== session.folder) return
      set({ assetFiles: statuses })
    },

    async pickAssetFile(title) {
      const picked = await services.filePicker.pickFile(title)
      if (picked.ok) return picked.value
      set({ notice: `Arquivo recusado: ${picked.error.message}` })
      return null
    },

    linkAsset(draft) {
      if (!get().run(cmd.linkAsset(draft))) return false
      set({ selectedAssetId: draft.id })
      return true
    },

    async relinkAsset(assetId) {
      const path = await get().pickAssetFile('Trocar o arquivo do asset')
      if (path === null) return
      get().run(cmd.relinkAsset(assetId, path))
    },

    async openAsset(path) {
      const opened = await services.assetOpener.open(path)
      if (opened.ok) return
      set({ notice: `Não foi possível abrir "${fileNameOf(path)}": ${opened.error.message}` })
      // O arquivo pode ter sumido depois da última conferência.
      if (opened.error.code === 'not-found') void get().checkAssetFiles()
    }
  }
}
```

- [ ] **Passo 4: Montar as ações em `src/renderer/src/ui/stores/project-store.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import type { ConfigurationEntry, Project } from '@/domain/project/project'
import type { Result } from '@/domain/shared/result'

/** Casos de uso e serviços de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices {
  readonly openProject: {
    execute(): Promise<OpenProjectResult>
```

por:

<!-- prettier-ignore -->
```ts
import type { ConfigurationEntry, Project } from '@/domain/project/project'
import type { Result } from '@/domain/shared/result'
import {
  ASSETS_CLOSED,
  createAssetsActions,
  type AssetsServices,
  type AssetsState
} from './assets-actions'

/** Casos de uso e serviços de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices extends AssetsServices {
  readonly openProject: {
    execute(): Promise<OpenProjectResult>
```

Troque:

<!-- prettier-ignore -->
```ts
}

export interface ProjectState {
  readonly session: ProjectSession | null
  /** O projeto como está no disco; comparar com a sessão diz se há alterações. */
```

por:

<!-- prettier-ignore -->
```ts
}

export interface ProjectState extends AssetsState {
  readonly session: ProjectSession | null
  /** O projeto como está no disco; comparar com a sessão diz se há alterações. */
```

Troque:

<!-- prettier-ignore -->
```ts
  /** Arquivos alterados fora do app na última gravação: a interface pergunta o que fazer. */
  readonly conflicts: readonly string[]
  /** Por que a última edição foi recusada. */
  readonly notice: string | null
  readonly recents: readonly RecentProject[]
```

por:

<!-- prettier-ignore -->
```ts
  /** Arquivos alterados fora do app na última gravação: a interface pergunta o que fazer. */
  readonly conflicts: readonly string[]
  /** O aviso da faixa amarela, como "Edição recusada: …" ou "Arquivo recusado: …". */
  readonly notice: string | null
  readonly recents: readonly RecentProject[]
```

Troque:

<!-- prettier-ignore -->
```ts
  conflicts: [],
  notice: null,
  lastSavedAt: null
} satisfies Partial<ProjectState>
```

por:

<!-- prettier-ignore -->
```ts
  conflicts: [],
  notice: null,
  lastSavedAt: null,
  ...ASSETS_CLOSED
} satisfies Partial<ProjectState>
```

Troque:

<!-- prettier-ignore -->
```ts
      })
      void get().loadRecents()
    }
```

por:

<!-- prettier-ignore -->
```ts
      })
      void get().loadRecents()
      void get().checkAssetFiles()
    }
```

Troque:

<!-- prettier-ignore -->
```ts
        collapsedFeatureIds: revealed(collapsedFeatureIds, project.model, selected)
      })
    }
```

por:

<!-- prettier-ignore -->
```ts
        collapsedFeatureIds: revealed(collapsedFeatureIds, project.model, selected)
      })
      // Vincular, trocar arquivo, desfazer…: o estado dos arquivos acompanha os assets.
      if (project.assets !== session.project.assets) void get().checkAssetFiles()
    }
```

Troque:

<!-- prettier-ignore -->
```ts
      busy: false,
      recents: [],

      async loadRecents() {
```

por:

<!-- prettier-ignore -->
```ts
      busy: false,
      recents: [],
      ...createAssetsActions(set, get, services),

      async loadRecents() {
```

Troque:

<!-- prettier-ignore -->
```ts
        const step = executeCommand(history, editorStateOf(session), command)
        if (!step.ok) {
          set({ notice: step.error })
          return false
        }
```

por:

<!-- prettier-ignore -->
```ts
        const step = executeCommand(history, editorStateOf(session), command)
        if (!step.ok) {
          set({ notice: `Edição recusada: ${step.error}` })
          return false
        }
```

- [ ] **Passo 5: Serviços novos em `src/renderer/src/ui/app/composition-root.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import { CreateProject } from '@/application/use-cases/create-project'
import { OpenProject } from '@/application/use-cases/open-project'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { SaveProject } from '@/application/use-cases/save-project'
import { ElectronProjectFolderPicker } from '@/infrastructure/electron/electron-project-folder-picker'
import { ElectronProjectStorage } from '@/infrastructure/electron/electron-project-storage'
```

por:

<!-- prettier-ignore -->
```ts
import { CheckAssetFiles } from '@/application/use-cases/check-asset-files'
import { CreateProject } from '@/application/use-cases/create-project'
import { OpenProject } from '@/application/use-cases/open-project'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { SaveProject } from '@/application/use-cases/save-project'
import { ElectronAssetOpener } from '@/infrastructure/electron/electron-asset-opener'
import { ElectronProjectFilePicker } from '@/infrastructure/electron/electron-project-file-picker'
import { ElectronProjectFolderPicker } from '@/infrastructure/electron/electron-project-folder-picker'
import { ElectronProjectStorage } from '@/infrastructure/electron/electron-project-storage'
```

Troque:

<!-- prettier-ignore -->
```ts
    resolveConfiguration: new ResolveConfiguration(new LogicSolverConstraintSolver()),
    recentProjects: recents,
    unsavedChanges: new ElectronUnsavedChangesIndicator()
  })
}
```

por:

<!-- prettier-ignore -->
```ts
    resolveConfiguration: new ResolveConfiguration(new LogicSolverConstraintSolver()),
    recentProjects: recents,
    unsavedChanges: new ElectronUnsavedChangesIndicator(),
    checkAssetFiles: new CheckAssetFiles(storage),
    filePicker: new ElectronProjectFilePicker(),
    assetOpener: new ElectronAssetOpener()
  })
}
```

- [ ] **Passo 6: O aviso em `src/renderer/src/ui/screens/project/ProjectScreen.tsx`**

A store já guarda o prefixo; troque:

```tsx
<span className="flex-1">Edição recusada: {notice}</span>
```

por:

```tsx
<span className="flex-1">{notice}</span>
```

- [ ] **Passo 7: Os serviços novos em `.checks/configurator-store-check.mts`**

O roteiro da Fase 3 monta a store; agora ela confere os arquivos ao abrir o projeto. No `createProjectStore({ … })` do roteiro, troque:

```ts
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} }
})
```

por:

```ts
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} },
  // Fase 4: a store confere os arquivos dos assets ao abrir o projeto.
  checkAssetFiles: { execute: async () => new Map() },
  filePicker: { pickFile: notUsed },
  assetOpener: { open: notUsed }
})
```

- [ ] **Passo 8: Rodar os roteiros**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/assets-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/configurator-store-check.mts
```

Esperado do primeiro, exatamente:

```
antes da resposta                    → verificando…
boleto.xml                           → missing
busca.xml                            → ok
conferência nova: boleto.xml         → ok
depois da antiga responder           → ok
cancelado                            → null | aviso: null
fora do projeto                      → null
aviso                                → Arquivo recusado: O arquivo precisa estar dentro da pasta do projeto. Copie-o para dentro e vincule de novo.
vincular                             → true | selecionado: capa | alterado: true
antes da conferência                 → verificando…
conferências depois de vincular      → 7 assets
depois da conferência                → ok
ID repetido                          → false | Edição recusada: Já existe um asset com o ID "capa".
desfazer o vínculo                   → selecionado: (nenhum) | alterado: false
trocar arquivo                       → docs/pagamento/boleto-novo.xml | ok
rótulo do desfazer                   → Trocar arquivo por "boleto-novo.xml"
abrir                                → docs/img/pix-fluxo.svg | aviso: null
abrir o que sumiu                    → Não foi possível abrir "boleto.xml": "docs/pagamento/boleto.xml" não existe.
conferiu de novo                     → 1
fechado                              → 0 estados | selecionado: null
```

Do segundo: exatamente a saída do plano da Fase 3 (Tarefa 3, Passo 4), 21 linhas.

- [ ] **Passo 9: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 10: Commit**

```bash
npm run format
git add src/renderer/src/ui
git commit -m "feat(ui): store guarda o asset selecionado e o estado dos arquivos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: Interface da aba Assets

**Arquivos:**

- Criar: `src/renderer/src/ui/components/expression-check.ts`, `src/renderer/src/ui/components/ExpressionInput.tsx`
- Substituir: `src/renderer/src/ui/screens/project/constraints/ConstraintForm.tsx`
- Criar: `src/renderer/src/ui/screens/assets/use-file-status.ts`, `FileStatusBadge.tsx`, `use-link-asset.ts`, `asset-fields.tsx`, `LinkAssetDialog.tsx`, `AssetProperties.tsx`, `AssetList.tsx`, `AssetsWorkspace.tsx`
- Criar: `src/renderer/src/ui/screens/project/properties/AnchoredAssetsSection.tsx`, `src/renderer/src/ui/screens/project/use-window-focus.ts`
- Modificar: `src/renderer/src/ui/screens/project/properties/FeatureProperties.tsx`, `ModelWorkspace.tsx`, `ViewRail.tsx`, `editor-dialog.ts`, `use-editor-shortcuts.ts`, `ProjectHeader.tsx`, `ProjectScreen.tsx` (em `src/renderer/src/ui/screens/project/`)
- Verificação: `.checks/main-process.mjs`, `.checks/run-ui.sh`, `.checks/assets-ui.mjs`; regressão com `.checks/ui-check.mjs`, `.checks/diagrama-ui.mjs` e `.checks/configurador-ui.mjs`

**Interfaces:**

- Consome: tudo das Tarefas 1–3; `CommitField`, `Field`, `Button`, `Dialog*`, `Input`, `Label` (componentes existentes); `parseExpression`, `printExpression`, `referencedFeatureIds`; `featureIdSet` (`domain/feature-model/tree.ts`).
- Produz:
  - `checkExpression(model, text): ExpressionCheck` (`'empty' | 'valid' | 'invalid'`) e `<ExpressionInput id model value onChange onBlur? onKeyDown? autoFocus? placeholder? />`
  - `ProjectView` com `'assets'`; `EditorDialog` com `{ kind: 'link-asset', path, anchor }`
  - `ShortcutScope` com `enabled`, `history` e `editing`
  - atributos para os roteiros: `data-anchor` (grupo), `data-asset-id` (linha, com `aria-selected`), `data-file-status` (`ok`, `missing` ou `checking`), `data-assets-summary`, `data-asset-properties` (painel, com o ID), `data-anchored-assets` (seção do painel da feature); campos `#asset-name`, `#asset-kind`, `#asset-anchor`, `#asset-condition`, `#link-asset-kind`, `#link-asset-name`, `#link-asset-id`, `#link-asset-anchor`

- [ ] **Passo 1: Escrever `.checks/main-process.mjs`**

Fala com o processo main pelo inspetor do Node: troca o diálogo de arquivo e o `shell.openPath` por registradores. Nenhum programa abre na tela do usuário.

```js
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
```

- [ ] **Passo 2: Escrever `.checks/run-ui.sh`**

Prepara uma cópia limpa do exemplo, abre o app (`dev` = `electron.exe .` sobre o `out/`), espera a lista de recentes aparecer, roda um roteiro e fecha. Para o `configurador-ui.mjs`, acrescenta o `conflito.xml` da Fase 3.

```bash
#!/usr/bin/env bash
# Prepara uma cópia limpa do exemplo, abre o app, roda um roteiro de interface e fecha o app.
# Uso: bash .checks/run-ui.sh <app.exe | dev> <roteiro> [argumentos extras do roteiro...]
set -u
app="$1"; script="$2"; shift 2
rm -rf .checks/ui-data .checks/loja-ui && mkdir -p .checks/ui-data
cp -r docs/examples/loja-online .checks/loja-ui
if [ "$script" = ".checks/configurador-ui.mjs" ]; then
  cat > .checks/loja-ui/configurations/conflito.xml <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<configuration xmlns="urn:mdd:configuration" schemaVersion="1" name="Conflito">
  <decision feature="catalogo" state="deselected"/>
  <decision feature="busca" state="selected"/>
</configuration>
XML
fi
dir="$(cygpath -w "$PWD/.checks/loja-ui")"
node -e "require('fs').writeFileSync('.checks/ui-data/recent-projects.json', JSON.stringify([{ rootPath: process.argv[1], name: 'loja-ui' }]))" "$dir"
if [ "$app" = "dev" ]; then exe=./node_modules/electron/dist/electron.exe; first=.; else exe="$app"; first=; fi
"$exe" $first --inspect=9229 --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/ui-data")" > /dev/null 2>&1 &
for i in $(seq 1 30); do curl -s http://127.0.0.1:9333/json > /dev/null 2>&1 && break; sleep 1; done
# Logo depois de um build, a tela inicial demora mais: espera a lista de recentes aparecer.
node -e "import('./.checks/cdp.mjs').then(async ({ connect }) => { const ui = await connect(9333); await ui.waitFor(\"document.querySelector('main section ul button') !== null\", 30000); ui.close() })"
node "$script" 9333 "$@" "$dir"
node .checks/quit.mjs 9333
sleep 2
```

- [ ] **Passo 3: Escrever `.checks/assets-ui.mjs`**

```js
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
```

- [ ] **Passo 4: Rodar e ver falhar**

```bash
npm run build
bash .checks/run-ui.sh dev .checks/assets-ui.mjs 9229
```

Esperado: o roteiro para com `não achei {"text":"Assets"}`: a aba ainda não existe.

- [ ] **Passo 5: Criar `src/renderer/src/ui/components/expression-check.ts`**

```ts
import type { Expression } from '@/domain/expression/ast'
import { parseExpression } from '@/domain/expression/parser'
import { referencedFeatureIds } from '@/domain/expression/references'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { featureIdSet } from '@/domain/feature-model/tree'

/** O texto como expressão: vazio, válido (só com features existentes) ou com o problema. */
export type ExpressionCheck =
  | { readonly kind: 'empty' }
  | { readonly kind: 'valid'; readonly expression: Expression }
  | { readonly kind: 'invalid'; readonly problem: string }

export function checkExpression(model: FeatureModel, text: string): ExpressionCheck {
  if (text.trim() === '') return { kind: 'empty' }
  const parsed = parseExpression(text)
  if (!parsed.ok) {
    return { kind: 'invalid', problem: `Coluna ${parsed.error.column}: ${parsed.error.message}` }
  }
  const ids = featureIdSet(model.root)
  const unknown = [...referencedFeatureIds(parsed.value)].filter((id) => !ids.has(id))
  if (unknown.length > 0) {
    return { kind: 'invalid', problem: `Features inexistentes: ${unknown.join(', ')}` }
  }
  return { kind: 'valid', expression: parsed.value }
}
```

- [ ] **Passo 6: Criar `src/renderer/src/ui/components/ExpressionInput.tsx`**

```tsx
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { featureIdSet } from '@/domain/feature-model/tree'
import { Input } from '@/ui/components/ui/input'
import { checkExpression } from './expression-check'

interface ExpressionInputProps {
  readonly id: string
  readonly model: FeatureModel
  readonly value: string
  readonly onChange: (text: string) => void
  readonly onBlur?: () => void
  readonly onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
  readonly autoFocus?: boolean
  readonly placeholder?: string
}

const MAX_SUGGESTIONS = 8

/**
 * Campo de expressão das restrições e das condições (SPEC §7): mostra o erro de sintaxe com
 * a coluna enquanto se digita e sugere IDs de features para a palavra em andamento.
 */
export function ExpressionInput({
  id,
  model,
  value,
  onChange,
  onBlur,
  onKeyDown,
  autoFocus,
  placeholder
}: ExpressionInputProps): React.JSX.Element {
  const check = checkExpression(model, value)
  const partial = /[a-z0-9_]*$/.exec(value)?.[0] ?? ''
  const suggestions =
    partial === ''
      ? []
      : [...featureIdSet(model.root)]
          .filter((featureId) => featureId.startsWith(partial) && featureId !== partial)
          .slice(0, MAX_SUGGESTIONS)

  return (
    <>
      <Input
        id={id}
        autoFocus={autoFocus}
        className="font-mono"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <p className="text-xs text-muted-foreground">
        Operadores: not, and, or, implies, iff. Use os IDs das features.
      </p>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded bg-muted px-1.5 font-mono text-xs hover:bg-accent"
              // O campo continua com o foco: completar não conta como sair dele.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                onChange(`${value.slice(0, value.length - partial.length)}${suggestion} `)
              }
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      {check.kind === 'invalid' && <p className="text-xs text-destructive">{check.problem}</p>}
    </>
  )
}
```

- [ ] **Passo 7: Substituir `src/renderer/src/ui/screens/project/constraints/ConstraintForm.tsx`**

O comportamento não muda; o campo de expressão passa a ser o `ExpressionInput`.

```tsx
import { useState } from 'react'
import type { Expression } from '@/domain/expression/ast'
import { printExpression } from '@/domain/expression/printer'
import type { Constraint, FeatureModel } from '@/domain/feature-model/feature-model'
import { checkExpression } from '@/ui/components/expression-check'
import { ExpressionInput } from '@/ui/components/ExpressionInput'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'

interface ConstraintFormProps {
  readonly model: FeatureModel
  readonly initial?: Constraint
  readonly onSubmit: (expression: Expression, description: string) => void
  readonly onCancel: () => void
}

/**
 * Editor de restrição: mostra o erro de sintaxe com a coluna enquanto se digita e sugere
 * IDs de features para a palavra em andamento. Só confirma uma expressão válida.
 */
export function ConstraintForm({
  model,
  initial,
  onSubmit,
  onCancel
}: ConstraintFormProps): React.JSX.Element {
  const [text, setText] = useState(initial ? printExpression(initial.expression) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const check = checkExpression(model, text)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (check.kind === 'valid') onSubmit(check.expression, description)
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border p-3 text-sm">
      <div className="space-y-1.5">
        <Label htmlFor="constraint-expression">Expressão</Label>
        <ExpressionInput
          id="constraint-expression"
          autoFocus
          model={model}
          placeholder="pag_pix implies mobile"
          value={text}
          onChange={setText}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="constraint-description">Descrição</Label>
        <Input
          id="constraint-description"
          placeholder="Opcional"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={check.kind !== 'valid'}>
          {initial ? 'Salvar restrição' : 'Adicionar restrição'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Passo 8: Estado do arquivo na tela**

`src/renderer/src/ui/screens/assets/use-file-status.ts`:

```ts
import { useProjectStore } from '@/ui/stores/project-store-context'

/** O estado conhecido do arquivo; `checking` antes da primeira conferência do caminho. */
export type ShownFileStatus = 'ok' | 'missing' | 'checking'

export function useFileStatus(path: string): ShownFileStatus {
  return useProjectStore((state) => state.assetFiles.get(path) ?? 'checking')
}
```

`src/renderer/src/ui/screens/assets/FileStatusBadge.tsx`:

```tsx
import { cn } from 'cn'
import { useFileStatus, type ShownFileStatus } from './use-file-status'

const TEXT: Record<ShownFileStatus, string> = {
  ok: 'ok',
  missing: 'ausente',
  checking: 'verificando…'
}

/** O estado do arquivo do asset (SPEC §4.3): ok discreto, ausente em vermelho. */
export function FileStatusBadge({ path }: { readonly path: string }): React.JSX.Element {
  const status = useFileStatus(path)
  return (
    <span
      data-file-status={status}
      title={status === 'missing' ? 'O arquivo não existe (ou é uma pasta).' : undefined}
      className={cn(
        'shrink-0 rounded px-1.5 text-xs',
        status === 'missing'
          ? 'bg-destructive/10 font-medium text-destructive'
          : 'text-muted-foreground'
      )}
    >
      {TEXT[status]}
    </span>
  )
}
```

- [ ] **Passo 9: Criar `src/renderer/src/ui/screens/assets/use-link-asset.ts`**

```ts
import { useCallback } from 'react'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'

/**
 * Vincular um arquivo: o diálogo nativo primeiro e, com um arquivo do projeto, o diálogo
 * "Vincular arquivo" com a âncora indicada. Cancelar ou escolher um arquivo de fora para aí.
 */
export function useLinkAsset(
  onOpenDialog: (dialog: EditorDialog) => void
): (anchor: string) => Promise<void> {
  const pickAssetFile = useProjectStore((state) => state.pickAssetFile)
  return useCallback(
    async (anchor) => {
      const path = await pickAssetFile('Vincular arquivo')
      if (path !== null) onOpenDialog({ kind: 'link-asset', path, anchor })
    },
    [pickAssetFile, onOpenDialog]
  )
}
```

- [ ] **Passo 10: Criar `src/renderer/src/ui/screens/assets/asset-fields.tsx`**

Tipo, âncora e condição, usados no diálogo e no painel. A condição grava ao sair do campo ou com Enter, só se for válida.

```tsx
import { useRef, useState } from 'react'
import * as cmd from '@/application/editing/commands'
import type { Asset, AssetKind } from '@/domain/assets/asset-catalog'
import { printExpression } from '@/domain/expression/printer'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { featuresInPreOrder } from '@/domain/feature-model/traversal'
import { checkExpression } from '@/ui/components/expression-check'
import { ExpressionInput } from '@/ui/components/ExpressionInput'
import { useProjectStore } from '@/ui/stores/project-store-context'

/** Campos de asset usados no diálogo de vincular e no painel. */

const SELECT = 'h-9 w-full rounded-md border bg-transparent px-2 text-sm'

const KIND_LABEL: Record<AssetKind, string> = {
  fragment: 'Fragmento (XML embutido no produto)',
  resource: 'Recurso (arquivo copiado para a saída)'
}

interface SelectProps<T extends string> {
  readonly id: string
  readonly value: T
  readonly onChange: (value: T) => void
}

export function KindSelect({ id, value, onChange }: SelectProps<AssetKind>): React.JSX.Element {
  return (
    <select
      id={id}
      className={SELECT}
      value={value}
      onChange={(event) => onChange(event.target.value as AssetKind)}
    >
      {(['fragment', 'resource'] as const).map((kind) => (
        <option key={kind} value={kind}>
          {KIND_LABEL[kind]}
        </option>
      ))}
    </select>
  )
}

/** As features na pré-ordem do modelo, com nome e ID. */
export function AnchorSelect({
  id,
  model,
  value,
  onChange
}: SelectProps<string> & { readonly model: FeatureModel }): React.JSX.Element {
  return (
    <select
      id={id}
      className={SELECT}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {featuresInPreOrder(model.root).map((feature) => (
        <option key={feature.id} value={feature.id}>
          {feature.name} ({feature.id})
        </option>
      ))}
    </select>
  )
}

/**
 * A condição de presença, com o editor das restrições. Grava ao sair do campo ou com Enter,
 * só se for válida; vazio tira a condição. Com erro, o texto fica e nada é gravado.
 */
export function ConditionField({
  model,
  asset
}: {
  readonly model: FeatureModel
  readonly asset: Asset
}): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const saved = asset.condition !== undefined ? printExpression(asset.condition) : ''
  const [text, setText] = useState(saved)
  const [source, setSource] = useState(saved)
  // Esc sai do campo sem gravar: o blur acontece antes de o texto voltar ao salvo.
  const cancelled = useRef(false)
  if (source !== saved) {
    // A condição mudou por fora (desfazer, outro asset selecionado): mostra a nova.
    setSource(saved)
    setText(saved)
  }

  const commit = (): void => {
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    const check = checkExpression(model, text)
    if (check.kind === 'empty' && saved !== '') run(cmd.setAssetCondition(asset.id, undefined))
    if (check.kind === 'valid' && printExpression(check.expression) !== saved) {
      run(cmd.setAssetCondition(asset.id, check.expression))
    }
  }

  return (
    <ExpressionInput
      id="asset-condition"
      model={model}
      placeholder="Sem condição: entra sempre que a âncora entrar"
      value={text}
      onChange={setText}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          cancelled.current = true
          setText(saved)
          event.currentTarget.blur()
        }
      }}
    />
  )
}
```

- [ ] **Passo 11: Criar `src/renderer/src/ui/screens/assets/LinkAssetDialog.tsx`**

```tsx
import { useState } from 'react'
import type { AssetCatalog, AssetKind } from '@/domain/assets/asset-catalog'
import { checkNewAssetId, suggestAssetId, suggestAssetKind } from '@/domain/assets/asset-edits'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AnchorSelect, KindSelect } from './asset-fields'

interface LinkAssetDialogProps {
  readonly model: FeatureModel
  readonly catalog: AssetCatalog
  /** O arquivo escolhido no diálogo nativo, relativo à pasta do projeto. */
  readonly path: string
  readonly anchor: string
  readonly onClose: () => void
}

/**
 * Vincular um arquivo (SPEC §7): tipo sugerido pela extensão, nome opcional e o ID sugerido
 * pelo nome do arquivo, que só pode ser ajustado aqui (ADR 0004).
 */
export function LinkAssetDialog({
  model,
  catalog,
  path,
  anchor: initialAnchor,
  onClose
}: LinkAssetDialogProps): React.JSX.Element {
  const linkAsset = useProjectStore((state) => state.linkAsset)
  const [kind, setKind] = useState<AssetKind>(suggestAssetKind(path))
  const [name, setName] = useState('')
  const [id, setId] = useState(suggestAssetId(catalog, path))
  const [anchor, setAnchor] = useState(initialAnchor)
  const problem = checkNewAssetId(catalog, id)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (problem === null && linkAsset({ id, path, kind, anchor, name })) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Vincular arquivo</DialogTitle>
            <DialogDescription className="break-all font-mono">{path}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-asset-kind">Tipo</Label>
            <KindSelect id="link-asset-kind" value={kind} onChange={setKind} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-asset-name">Nome</Label>
            <Input
              id="link-asset-name"
              autoFocus
              placeholder="Opcional"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-asset-id">ID</Label>
            <Input
              id="link-asset-id"
              className="font-mono"
              value={id}
              onChange={(event) => setId(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sugerido pelo nome do arquivo. Pode ser ajustado agora; depois do vínculo, não muda.
            </p>
            {problem !== null && <p className="text-xs text-destructive">{problem}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-asset-anchor">Âncora</Label>
            <AnchorSelect
              id="link-asset-anchor"
              model={model}
              value={anchor}
              onChange={setAnchor}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={problem !== null}>
              Vincular
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Passo 12: Criar `src/renderer/src/ui/screens/assets/AssetProperties.tsx`**

```tsx
import { ExternalLink, FileSearch } from 'lucide-react'
import * as cmd from '@/application/editing/commands'
import { fileNameOf, type Asset } from '@/domain/assets/asset-catalog'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { CommitField } from '@/ui/components/CommitField'
import { Button } from '@/ui/components/ui/button'
import { Field } from '@/ui/screens/project/properties/Field'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AnchorSelect, ConditionField, KindSelect } from './asset-fields'
import { FileStatusBadge } from './FileStatusBadge'
import { useFileStatus } from './use-file-status'

/** Painel direito da aba Assets (SPEC §7). Cada alteração vira um comando do histórico. */
export function AssetProperties({
  model,
  asset
}: {
  readonly model: FeatureModel
  readonly asset: Asset
}): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const openAsset = useProjectStore((state) => state.openAsset)
  const relinkAsset = useProjectStore((state) => state.relinkAsset)
  const status = useFileStatus(asset.path)

  return (
    <section className="space-y-4" data-asset-properties={asset.id}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Asset</h2>

      <Field label="ID">
        <p className="text-sm">
          <code>{asset.id}</code>{' '}
          <span className="text-xs text-muted-foreground">escolhido ao vincular; não muda</span>
        </p>
      </Field>

      <Field label="Arquivo">
        <div className="flex items-start gap-2">
          <code className="min-w-0 flex-1 break-all text-sm">{asset.path}</code>
          <FileStatusBadge path={asset.path} />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={status === 'missing'}
            onClick={() => void openAsset(asset.path)}
          >
            <ExternalLink /> Abrir
          </Button>
          <Button size="sm" variant="outline" onClick={() => void relinkAsset(asset.id)}>
            <FileSearch /> Trocar arquivo…
          </Button>
        </div>
      </Field>

      <Field label="Nome" htmlFor="asset-name">
        <CommitField
          id="asset-name"
          value={asset.name ?? ''}
          placeholder={`Opcional (sem nome, aparece "${fileNameOf(asset.path)}")`}
          onCommit={(name) => run(cmd.renameAsset(asset.id, name))}
        />
      </Field>

      <Field label="Tipo" htmlFor="asset-kind">
        <KindSelect
          id="asset-kind"
          value={asset.kind}
          onChange={(kind) => run(cmd.setAssetKind(asset.id, kind))}
        />
      </Field>

      <Field label="Âncora" htmlFor="asset-anchor">
        <AnchorSelect
          id="asset-anchor"
          model={model}
          value={asset.anchor}
          onChange={(anchor) => run(cmd.setAssetAnchor(asset.id, anchor))}
        />
      </Field>

      <Field label="Condição de presença" htmlFor="asset-condition">
        <ConditionField model={model} asset={asset} />
      </Field>
    </section>
  )
}
```

- [ ] **Passo 13: Criar `src/renderer/src/ui/screens/assets/AssetList.tsx`**

```tsx
import { ArrowDown, ArrowUp, ExternalLink, FileCode2, Paperclip, Unlink } from 'lucide-react'
import { cn } from 'cn'
import * as cmd from '@/application/editing/commands'
import { assetLabel, type Asset } from '@/domain/assets/asset-catalog'
import type { AnchorGroup } from '@/domain/assets/asset-groups'
import { printExpression } from '@/domain/expression/printer'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { FileStatusBadge } from './FileStatusBadge'
import { useFileStatus } from './use-file-status'

/** Os assets agrupados por âncora, na ordem do modelo (SPEC §7). */
export function AssetList({
  groups
}: {
  readonly groups: readonly AnchorGroup[]
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      {groups.map(({ feature, assets }) => (
        <section key={feature.id} data-anchor={feature.id} className="space-y-1">
          <h3 className="text-sm font-medium">
            {feature.name} <code className="text-xs text-muted-foreground">{feature.id}</code>
          </h3>
          <ul className="divide-y rounded-md border">
            {assets.map((asset, index) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                first={index === 0}
                last={index === assets.length - 1}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

interface AssetRowProps {
  readonly asset: Asset
  /** Primeiro e último da âncora: não sobem nem descem. */
  readonly first: boolean
  readonly last: boolean
}

function AssetRow({ asset, first, last }: AssetRowProps): React.JSX.Element {
  const selected = useProjectStore((state) => state.selectedAssetId === asset.id)
  const selectAsset = useProjectStore((state) => state.selectAsset)
  const run = useProjectStore((state) => state.run)
  const openAsset = useProjectStore((state) => state.openAsset)
  const status = useFileStatus(asset.path)
  const label = assetLabel(asset)
  const Icon = asset.kind === 'fragment' ? FileCode2 : Paperclip

  return (
    <li
      data-asset-id={asset.id}
      aria-selected={selected}
      className={cn('flex items-center gap-2 px-2 py-1.5', selected && 'bg-accent')}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-2 text-left"
        onClick={() => selectAsset(asset.id)}
      >
        <Icon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-label={asset.kind === 'fragment' ? 'Fragmento' : 'Recurso'}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{label}</span>
          <code className="block truncate text-xs text-muted-foreground">{asset.path}</code>
          {asset.condition !== undefined && (
            <span className="block truncate text-xs text-muted-foreground">
              se <code>{printExpression(asset.condition)}</code>
            </span>
          )}
        </span>
        <FileStatusBadge path={asset.path} />
      </button>
      <Button
        size="icon-sm"
        variant="ghost"
        title="Abrir no programa padrão"
        disabled={status === 'missing'}
        onClick={() => void openAsset(asset.path)}
      >
        <ExternalLink />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        title="Mover para cima"
        disabled={first}
        onClick={() => run(cmd.reorderAsset(asset.id, -1))}
      >
        <ArrowUp />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        title="Mover para baixo"
        disabled={last}
        onClick={() => run(cmd.reorderAsset(asset.id, 1))}
      >
        <ArrowDown />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        title="Desvincular (o arquivo continua no disco)"
        onClick={() => run(cmd.unlinkAsset(asset.id, label))}
      >
        <Unlink />
      </Button>
    </li>
  )
}
```

- [ ] **Passo 14: Criar `src/renderer/src/ui/screens/assets/AssetsWorkspace.tsx`**

A chave `asset.id` no painel zera o texto dos campos ao trocar de asset.

```tsx
import { useEffect } from 'react'
import { Link2, RefreshCw } from 'lucide-react'
import { groupAssetsByAnchor } from '@/domain/assets/asset-groups'
import type { Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { selectedAsset } from '@/ui/stores/assets-actions'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AssetList } from './AssetList'
import { AssetProperties } from './AssetProperties'
import { useLinkAsset } from './use-link-asset'

interface AssetsWorkspaceProps {
  readonly project: Project
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/**
 * Aba Assets (SPEC §7): os assets agrupados por âncora no centro e as propriedades do
 * selecionado à direita. Entrar na aba confere os arquivos no disco.
 */
export function AssetsWorkspace({
  project,
  onOpenDialog
}: AssetsWorkspaceProps): React.JSX.Element {
  const asset = useProjectStore(selectedAsset)
  const selectedFeatureId = useProjectStore((state) => state.selectedFeatureId)
  const assetFiles = useProjectStore((state) => state.assetFiles)
  const checkAssetFiles = useProjectStore((state) => state.checkAssetFiles)
  const startLink = useLinkAsset(onOpenDialog)
  const { model, assets } = project

  useEffect(() => {
    void checkAssetFiles()
  }, [checkAssetFiles])

  const groups = groupAssetsByAnchor(model, assets)
  const missing = assets.assets.filter((item) => assetFiles.get(item.path) === 'missing').length
  // A âncora sugerida: a do asset selecionado ou, sem ele, a feature selecionada no modelo.
  const anchor = asset?.anchor ?? selectedFeatureId ?? model.root.id

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_24rem]">
      <section className="flex min-h-0 flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void startLink(anchor)}>
            <Link2 /> Vincular arquivo…
          </Button>
          <Button size="sm" variant="outline" onClick={() => void checkAssetFiles()}>
            <RefreshCw /> Atualizar
          </Button>
          <span data-assets-summary className="ml-auto text-sm text-muted-foreground">
            {assets.assets.length} {assets.assets.length === 1 ? 'asset' : 'assets'}
            {missing > 0 && ` · ${missing} ${missing === 1 ? 'ausente' : 'ausentes'}`}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {groups.length === 0 ? (
            <p className="max-w-prose text-sm text-muted-foreground">
              Nenhum asset vinculado. Um asset liga um arquivo do projeto a uma feature (a âncora):
              um fragmento XML entra no produto gerado, e um recurso é copiado para a saída.
            </p>
          ) : (
            <AssetList groups={groups} />
          )}
        </div>
      </section>
      <aside className="min-h-0 overflow-auto border-l p-4">
        {asset === null ? (
          <p className="text-sm text-muted-foreground">Escolha um asset na lista.</p>
        ) : (
          <AssetProperties key={asset.id} model={model} asset={asset} />
        )}
      </aside>
    </div>
  )
}
```

- [ ] **Passo 15: Assets ancorados no painel da feature**

`src/renderer/src/ui/screens/project/properties/AnchoredAssetsSection.tsx`:

```tsx
import { Link2 } from 'lucide-react'
import { assetLabel, type AssetCatalog } from '@/domain/assets/asset-catalog'
import { assetsAnchoredAt } from '@/domain/assets/asset-groups'
import { Button } from '@/ui/components/ui/button'
import { FileStatusBadge } from '@/ui/screens/assets/FileStatusBadge'
import { useLinkAsset } from '@/ui/screens/assets/use-link-asset'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'

interface AnchoredAssetsSectionProps {
  readonly catalog: AssetCatalog
  readonly featureId: string
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/** Os assets ancorados na feature (SPEC §7), com o estado do arquivo e o atalho para vincular. */
export function AnchoredAssetsSection({
  catalog,
  featureId,
  onOpenDialog
}: AnchoredAssetsSectionProps): React.JSX.Element {
  const startLink = useLinkAsset(onOpenDialog)
  const anchored = assetsAnchoredAt(catalog, featureId)

  return (
    <section className="space-y-2" data-anchored-assets>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Assets ancorados ({anchored.length})</h3>
        <Button size="sm" variant="ghost" onClick={() => void startLink(featureId)}>
          <Link2 /> Vincular arquivo…
        </Button>
      </div>
      {anchored.length > 0 && (
        <ul className="space-y-1">
          {anchored.map((asset) => (
            <li key={asset.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate" title={asset.path}>
                {assetLabel(asset)}
              </span>
              <FileStatusBadge path={asset.path} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

`src/renderer/src/ui/screens/project/properties/FeatureProperties.tsx`:

Troque:

<!-- prettier-ignore -->
```tsx
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AttributesSection } from './AttributesSection'
import { Field } from './Field'
```

por:

<!-- prettier-ignore -->
```tsx
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import type { EditorDialog } from '../editor-dialog'
import { AnchoredAssetsSection } from './AnchoredAssetsSection'
import { AttributesSection } from './AttributesSection'
import { Field } from './Field'
```

Troque:

<!-- prettier-ignore -->
```tsx

/** Propriedades da feature selecionada (SPEC §7). Cada alteração vira um comando. */
export function FeatureProperties({ project }: { readonly project: Project }): React.JSX.Element {
  const selectedId = useProjectStore((state) => state.selectedFeatureId)
  const run = useProjectStore((state) => state.run)
```

por:

<!-- prettier-ignore -->
```tsx

/** Propriedades da feature selecionada (SPEC §7). Cada alteração vira um comando. */
interface FeaturePropertiesProps {
  readonly project: Project
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

export function FeatureProperties({
  project,
  onOpenDialog
}: FeaturePropertiesProps): React.JSX.Element {
  const selectedId = useProjectStore((state) => state.selectedFeatureId)
  const run = useProjectStore((state) => state.run)
```

Troque:

<!-- prettier-ignore -->
```tsx

      <AttributesSection project={project} feature={feature} />
    </section>
  )
```

por:

<!-- prettier-ignore -->
```tsx

      <AttributesSection project={project} feature={feature} />
      <AnchoredAssetsSection
        catalog={project.assets}
        featureId={feature.id}
        onOpenDialog={onOpenDialog}
      />
    </section>
  )
```

`src/renderer/src/ui/screens/project/ModelWorkspace.tsx`:

Troque:

<!-- prettier-ignore -->
```tsx
      </section>
      <aside className="min-h-0 space-y-8 overflow-auto border-l p-4">
        <FeatureProperties project={project} />
        <ConstraintsPanel model={project.model} />
      </aside>
```

por:

<!-- prettier-ignore -->
```tsx
      </section>
      <aside className="min-h-0 space-y-8 overflow-auto border-l p-4">
        <FeatureProperties project={project} onOpenDialog={onOpenDialog} />
        <ConstraintsPanel model={project.model} />
      </aside>
```

- [ ] **Passo 16: A terceira aba e o diálogo de vincular**

`src/renderer/src/ui/screens/project/ViewRail.tsx`:

Troque:

<!-- prettier-ignore -->
```tsx
import { ListChecks, Network } from 'lucide-react'
import { cn } from 'cn'

/** As abas da barra lateral (SPEC §7). A de assets chega na Fase 4. */
export type ProjectView = 'model' | 'configurations'

const VIEWS = [
  { view: 'model', label: 'Modelo', Icon: Network },
  { view: 'configurations', label: 'Configurações', Icon: ListChecks }
] as const
```

por:

<!-- prettier-ignore -->
```tsx
import { ListChecks, Network, Paperclip } from 'lucide-react'
import { cn } from 'cn'

/** As abas da barra lateral (SPEC §7). */
export type ProjectView = 'model' | 'configurations' | 'assets'

const VIEWS = [
  { view: 'model', label: 'Modelo', Icon: Network },
  { view: 'configurations', label: 'Configurações', Icon: ListChecks },
  { view: 'assets', label: 'Assets', Icon: Paperclip }
] as const
```

`src/renderer/src/ui/screens/project/editor-dialog.ts`:

Troque:

<!-- prettier-ignore -->
```ts
  | { readonly kind: 'duplicate-configuration'; readonly key: string }
  | { readonly kind: 'delete-configuration'; readonly key: string }
  | null
```

por:

<!-- prettier-ignore -->
```ts
  | { readonly kind: 'duplicate-configuration'; readonly key: string }
  | { readonly kind: 'delete-configuration'; readonly key: string }
  /** Depois do diálogo nativo: o arquivo já escolhido, dentro do projeto. */
  | { readonly kind: 'link-asset'; readonly path: string; readonly anchor: string }
  | null
```

- [ ] **Passo 17: Atalhos com três escopos em `src/renderer/src/ui/screens/project/use-editor-shortcuts.ts`**

Troque:

<!-- prettier-ignore -->
```ts
  /** Com um diálogo aberto, nenhum atalho vale: as teclas são do diálogo. */
  readonly enabled: boolean
  /** Fora da aba Modelo, só Ctrl+S vale: a estrutura não se edita no configurador. */
  readonly editing: boolean
}
```

por:

<!-- prettier-ignore -->
```ts
  /** Com um diálogo aberto, nenhum atalho vale: as teclas são do diálogo. */
  readonly enabled: boolean
  /** Desfazer e refazer: nas abas Modelo e Assets, que editam pelo histórico (SPEC §4.5). */
  readonly history: boolean
  /** Tab, Enter, F2, Delete e Alt+↑/↓ editam a estrutura: só na aba Modelo. */
  readonly editing: boolean
}
```

Troque:

<!-- prettier-ignore -->
```ts
export function useEditorShortcuts(
  openDialog: (dialog: EditorDialog) => void,
  { enabled, editing }: ShortcutScope
): void {
  const store = useProjectStoreApi()
```

por:

<!-- prettier-ignore -->
```ts
export function useEditorShortcuts(
  openDialog: (dialog: EditorDialog) => void,
  { enabled, history, editing }: ShortcutScope
): void {
  const store = useProjectStoreApi()
```

Troque:

<!-- prettier-ignore -->
```ts
      const shortcut = shortcutFor(event)
      if (shortcut === undefined || state.session === null || state.conflicts.length > 0) return
      if (shortcut !== 'save' && (!editing || isTyping(event.target))) return

      if (shortcut === 'save' || shortcut === 'undo' || shortcut === 'redo') {
        event.preventDefault()
        if (shortcut === 'save') void state.save()
```

por:

<!-- prettier-ignore -->
```ts
      const shortcut = shortcutFor(event)
      if (shortcut === undefined || state.session === null || state.conflicts.length > 0) return
      if (shortcut !== 'save' && isTyping(event.target, shortcut)) return
      const isHistory = shortcut === 'undo' || shortcut === 'redo'
      if (isHistory ? !history : shortcut !== 'save' && !editing) return

      if (shortcut === 'save' || isHistory) {
        event.preventDefault()
        if (shortcut === 'save') void state.save()
```

Troque:

<!-- prettier-ignore -->
```ts
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [store, openDialog, enabled, editing])
}
```

por:

<!-- prettier-ignore -->
```ts
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [store, openDialog, enabled, history, editing])
}
```

Troque:

<!-- prettier-ignore -->
```ts
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
```

por:

<!-- prettier-ignore -->
```ts
}

/**
 * Num campo de texto, as teclas são do campo (inclusive o Ctrl+Z dele). Numa lista de opções
 * não há o que desfazer ali: Ctrl+Z e Ctrl+Y vão para o histórico, e as demais teclas ficam nela.
 */
function isTyping(target: EventTarget | null, shortcut: Shortcut): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)) return true
  return target.tagName === 'SELECT' && shortcut !== 'undo' && shortcut !== 'redo'
}
```

- [ ] **Passo 18: A dica do desfazer em `src/renderer/src/ui/screens/project/ProjectHeader.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
interface ProjectHeaderProps {
  readonly session: ProjectSession
  /** Desfazer e refazer valem só para o modelo; o configurador não tem histórico (SPEC §2). */
  readonly historyEnabled: boolean
  readonly onClose: () => void
```

por:

<!-- prettier-ignore -->
```tsx
interface ProjectHeaderProps {
  readonly session: ProjectSession
  /** Desfazer e refazer valem para o modelo e os assets; o configurador não tem histórico (SPEC §2). */
  readonly historyEnabled: boolean
  readonly onClose: () => void
```

Troque:

<!-- prettier-ignore -->
```tsx
  shortcut: string
): string {
  if (!enabled) return `${action} vale só na aba Modelo`
  if (label === undefined) return `Nada para ${action.toLowerCase()}`
  return `${action}: ${label} (${shortcut})`
```

por:

<!-- prettier-ignore -->
```tsx
  shortcut: string
): string {
  if (!enabled) return `${action} vale só nas abas Modelo e Assets`
  if (label === undefined) return `Nada para ${action.toLowerCase()}`
  return `${action}: ${label} (${shortcut})`
```

- [ ] **Passo 19: Criar `src/renderer/src/ui/screens/project/use-window-focus.ts`**

```ts
import { useEffect } from 'react'

/** Chama `onFocus` quando a janela do app volta a ter o foco (por exemplo, vindo do Explorer). */
export function useWindowFocus(onFocus: () => void): void {
  useEffect(() => {
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [onFocus])
}
```

- [ ] **Passo 20: Juntar tudo em `src/renderer/src/ui/screens/project/ProjectScreen.tsx`**

Sobre o arquivo como ficou na Tarefa 3:

Troque:

<!-- prettier-ignore -->
```tsx
import { ConfigurationDialogs } from '@/ui/screens/configurator/ConfigurationDialogs'
import { ConfigurationStatusBar } from '@/ui/screens/configurator/ConfigurationStatusBar'
import { ConfiguratorWorkspace } from '@/ui/screens/configurator/ConfiguratorWorkspace'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
```

por:

<!-- prettier-ignore -->
```tsx
import { ConfigurationDialogs } from '@/ui/screens/configurator/ConfigurationDialogs'
import { ConfigurationStatusBar } from '@/ui/screens/configurator/ConfigurationStatusBar'
import { AssetsWorkspace } from '@/ui/screens/assets/AssetsWorkspace'
import { LinkAssetDialog } from '@/ui/screens/assets/LinkAssetDialog'
import { ConfiguratorWorkspace } from '@/ui/screens/configurator/ConfiguratorWorkspace'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
```

Troque:

<!-- prettier-ignore -->
```tsx
import { ProjectHeader } from './ProjectHeader'
import { useEditorShortcuts } from './use-editor-shortcuts'
import { ViewRail, type ProjectView } from './ViewRail'
```

por:

<!-- prettier-ignore -->
```tsx
import { ProjectHeader } from './ProjectHeader'
import { useEditorShortcuts } from './use-editor-shortcuts'
import { useWindowFocus } from './use-window-focus'
import { ViewRail, type ProjectView } from './ViewRail'
```

Troque:

<!-- prettier-ignore -->
```tsx
  const unsaved = useProjectStore(hasUnsavedChanges)
  const close = useProjectStore((state) => state.close)
  const [view, setView] = useState<ProjectView>('model')
  const [dialog, setDialog] = useState<EditorDialog>(null)
  const openDialog = useCallback((next: EditorDialog) => setDialog(next), [])
  useEditorShortcuts(openDialog, { enabled: dialog === null, editing: view === 'model' })
  const actions = useMemo<FeatureActions>(
    () => ({
```

por:

<!-- prettier-ignore -->
```tsx
  const unsaved = useProjectStore(hasUnsavedChanges)
  const close = useProjectStore((state) => state.close)
  const checkAssetFiles = useProjectStore((state) => state.checkAssetFiles)
  const [view, setView] = useState<ProjectView>('model')
  const [dialog, setDialog] = useState<EditorDialog>(null)
  const openDialog = useCallback((next: EditorDialog) => setDialog(next), [])
  useEditorShortcuts(openDialog, {
    enabled: dialog === null,
    history: view !== 'configurations',
    editing: view === 'model'
  })
  // Um arquivo pode ter sido renomeado fora do app enquanto a janela estava em segundo plano.
  const onWindowFocus = useCallback(() => void checkAssetFiles(), [checkAssetFiles])
  useWindowFocus(onWindowFocus)
  const actions = useMemo<FeatureActions>(
    () => ({
```

Troque:

<!-- prettier-ignore -->
```tsx
  return (
    <main className="flex h-screen flex-col">
      <ProjectHeader session={session} historyEnabled={view === 'model'} onClose={requestClose} />

      {notice !== null && (
```

por:

<!-- prettier-ignore -->
```tsx
  return (
    <main className="flex h-screen flex-col">
      <ProjectHeader
        session={session}
        historyEnabled={view !== 'configurations'}
        onClose={requestClose}
      />

      {notice !== null && (
```

Troque:

<!-- prettier-ignore -->
```tsx
      <div className="flex min-h-0 flex-1">
        <ViewRail view={view} onChange={setView} />
        {view === 'model' ? (
          <ModelWorkspace session={session} actions={actions} onOpenDialog={openDialog} />
        ) : (
          <ConfiguratorWorkspace project={project} onOpenDialog={openDialog} />
        )}
      </div>

      <footer className="border-t px-4 py-1 text-xs text-muted-foreground">
        {view === 'model' ? (
          `${project.assets.assets.length} assets · ${project.configurations.length} configurações`
        ) : (
          <ConfigurationStatusBar />
        )}
      </footer>
```

por:

<!-- prettier-ignore -->
```tsx
      <div className="flex min-h-0 flex-1">
        <ViewRail view={view} onChange={setView} />
        {view === 'model' && (
          <ModelWorkspace session={session} actions={actions} onOpenDialog={openDialog} />
        )}
        {view === 'configurations' && (
          <ConfiguratorWorkspace project={project} onOpenDialog={openDialog} />
        )}
        {view === 'assets' && <AssetsWorkspace project={project} onOpenDialog={openDialog} />}
      </div>

      <footer className="border-t px-4 py-1 text-xs text-muted-foreground">
        {view === 'configurations' ? (
          <ConfigurationStatusBar />
        ) : (
          `${project.assets.assets.length} assets · ${project.configurations.length} configurações`
        )}
      </footer>
```

Troque:

<!-- prettier-ignore -->
```tsx
      )}
      {dialog?.kind === 'close-project' && <CloseProjectDialog onCancel={() => setDialog(null)} />}
      <ConfigurationDialogs
        dialog={dialog}
```

por:

<!-- prettier-ignore -->
```tsx
      )}
      {dialog?.kind === 'close-project' && <CloseProjectDialog onCancel={() => setDialog(null)} />}
      {dialog?.kind === 'link-asset' && (
        <LinkAssetDialog
          model={project.model}
          catalog={project.assets}
          path={dialog.path}
          anchor={dialog.anchor}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfigurationDialogs
        dialog={dialog}
```

- [ ] **Passo 21: Checagens e build**

```bash
npm run typecheck
npm run lint
npm run build
```

Esperado: sem erros. O build avisa três vezes "Use of eval … is strongly discouraged" (`logic-solver`, esperado desde a Fase 3).

- [ ] **Passo 22: Rodar o roteiro da aba**

Combine o momento com o usuário: o app abre e fecha na tela dele.

```bash
bash .checks/run-ui.sh dev .checks/assets-ui.mjs 9229
```

Esperado, exatamente:

```
1. grupos                            → loja(doc_loja:ok) busca(doc_busca:ok doc_busca_app:ok) pag_pix(doc_pix:ok img_pix:ok) pag_boleto(doc_boleto:ok)
   resumo                            → 6 assets
   painel sem seleção                → Escolha um asset na lista.
2. antes de voltar o foco            → ok
   depois de voltar o foco           → missing
   resumo                            → 6 assets · 1 ausente
   abrir desligado                   → true
   Atualizar                         → doc_loja missing | 6 assets · 2 ausentes
   de volta                          → doc_loja ok | 6 assets · 1 ausente
3. trocar arquivo                    → docs/pagamento/boleto-renomeado.xml | ok
   diálogo                           → Trocar o arquivo do asset | começa no projeto: true | openFile
   desfazer                          → Desfazer: Trocar arquivo por "boleto-renomeado.xml" (Ctrl+Z)
   Ctrl+Z na aba Assets              → docs/pagamento/boleto.xml | missing
   Ctrl+Y                            → docs/pagamento/boleto-renomeado.xml | ok
4. condição                          → busca and mobile
   erro ao sair                      → Coluna 10: A expressão terminou antes da hora: falta um operando.
   na lista                          → Busca no app docs/busca/busca-app.xml se busca and mobile ok
   Enter grava                       → Busca no app docs/busca/busca-app.xml se busca and not mobile ok
   Esc descarta                      → busca and not mobile | Desfazer: Editar condição (Ctrl+Z)
   sugestão                          → "busca and mobile " | foco no campo: true
   de volta ao exemplo               → Busca no app docs/busca/busca-app.xml se busca and mobile ok
5. sem nome                          → busca-app.xml docs/busca/busca-app.xml se busca and mobile ok
   recurso                           → Recurso
   âncora mobile                     → loja(doc_loja:ok) busca(doc_busca:ok) mobile(doc_busca_app:ok) pag_pix(doc_pix:ok img_pix:ok) pag_boleto(doc_boleto:ok)
   subir                             → loja(doc_loja:ok) busca(doc_busca_app:ok doc_busca:ok) pag_pix(doc_pix:ok img_pix:ok) pag_boleto(doc_boleto:ok)
   o primeiro não sobe               → true
   depois de desfazer                → loja(doc_loja:ok) busca(doc_busca:ok doc_busca_app:ok) pag_pix(doc_pix:ok img_pix:ok) pag_boleto(doc_boleto:ok)
6. desvincular                       → loja(doc_loja:ok) busca(doc_busca:ok doc_busca_app:ok) pag_pix(doc_pix:ok) pag_boleto(doc_boleto:ok) | painel: Escolha um asset na lista.
   desfazer                          → Desfazer: Desvincular "Fluxo do PIX" (Ctrl+Z)
   depois de desfazer                → loja(doc_loja:ok) busca(doc_busca:ok doc_busca_app:ok) pag_pix(doc_pix:ok img_pix:ok) pag_boleto(doc_boleto:ok)
7. arquivo de fora                   → Arquivo recusado: O arquivo precisa estar dentro da pasta do projeto. Copie-o para dentro e vincule de novo. | diálogo: false
   cancelado                         → diálogo: false | aviso: (sem aviso)
   diálogo de vincular               → docs/img/pix-fluxo.svg | resource | pix_fluxo | pag_pix
   ID repetido                       → Já existe um asset com o ID "img_pix". | botão desligado: true
   vinculado                         → loja(doc_loja:ok) busca(doc_busca:ok doc_busca_app:ok) pag_pix(doc_pix:ok img_pix:ok img_pix_capa:ok) pag_boleto(doc_boleto:ok) | selecionado: img_pix_capa
8. abrir                             → <projeto>\docs\pagamento\pix.xml
   falha ao abrir                    → Não foi possível abrir "pix-fluxo.svg": Nenhum programa associado (simulado).
9. Tab e Delete na aba Assets        → diálogo: false
10. assets ancorados                 → Assets ancorados (3) Vincular arquivo… Guia do PIX ok Fluxo do PIX ok Capa do PIX ok
   vincular cancelado                → diálogo: false
10b. restrição com erro              → Coluna 15: A expressão terminou antes da hora: falta um operando. | botão desligado: true
   sugestão                          → "pag_boleto implies busca "
   feature inexistente               → Features inexistentes: fantasma | botão desligado: true
   adicionada                        → RESTRIÇÕES (2)
   Ctrl+Z                            → RESTRIÇÕES (1)
11. desfazer no configurador         → Desfazer vale só nas abas Modelo e Assets
12. salvo                            → Loja Online — mdd
   no disco                          → true | true
erros no console                     → nenhum
app fechado
```

O que o roteiro mostra, em resumo:

- os 6 assets agrupados por âncora; `boleto.xml` renomeado fora fica ausente quando a janela volta ao foco, e o botão Abrir desliga; "Atualizar" pega outra renomeação e a volta do arquivo;
- "Trocar arquivo…" abre o diálogo na raiz do projeto; Ctrl+Z e Ctrl+Y valem na aba Assets, e o estado acompanha o caminho;
- a condição: erro de sintaxe não grava, Enter grava, Esc descarta, a sugestão mantém o foco;
- nome, tipo (com o foco na lista de opções), âncora e reordenar, cada um desfeito com Ctrl+Z;
- desvincular e desfazer; arquivo de fora recusado; cancelar não faz nada; vincular com ID repetido é recusado no próprio campo;
- abrir registra o caminho absoluto; a falha vira aviso;
- Tab e Delete não fazem nada na aba Assets; o painel da feature lista os assets ancorados;
- o editor de restrições continua igual (passo 10b);
- no configurador, o desfazer fica desligado; salvar grava o `assets.xml`.

- [ ] **Passo 23: Regressão da 2A, da 2B e da Fase 3**

O `ui-check.mjs` é o roteiro da 2A com as duas mudanças do plano da 2B (Tarefa 4, Passo 6): a emulação de foco logo depois de abrir a conexão e o seletor `'[data-feature-id][aria-current=true]'` na função `selected`. Confira que o seu `.checks/ui-check.mjs` já as tem.

```bash
bash .checks/run-ui.sh dev .checks/ui-check.mjs
bash .checks/run-ui.sh dev .checks/diagrama-ui.mjs
bash .checks/run-ui.sh dev .checks/configurador-ui.mjs
```

Esperado:

- `ui-check.mjs`: exatamente a saída do plano da 2B (Tarefa 4, Passo 6), 19 linhas, mais `app fechado`;
- `diagrama-ui.mjs`: exatamente a saída do plano da 2B (Tarefa 3, Passo 12), 27 linhas, mais `app fechado`. Os arrastos e o clique logo depois de "Ajustar à tela" são instáveis, também na versão de antes da Fase 4 (veja o item 13 de "O que o protótipo respondeu"): se a saída divergir a partir de um arrasto ou parar em `não achei`, rode de novo até sair igual;
- `configurador-ui.mjs`: exatamente a saída do plano da Fase 3 (Tarefa 4, Passo 15), 49 linhas, mais `app fechado`, com uma diferença prevista:

```
botão desfazer                       → true | Desfazer vale só nas abas Modelo e Assets
```

- [ ] **Passo 24: Commit**

```bash
npm run format
git add src/renderer/src/ui
git commit -m "feat(ui): aba Assets com lista por âncora, painel, vincular e assets ancorados no painel da feature

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: Aceitação no app empacotado e documentação

**Arquivos:**

- Modificar: `docs/SPEC.md`, `docs/adr/0004-ids-estaveis-para-features.md`, `docs/superpowers/specs/2026-09-24-fase-4-assets-design.md`, `docs/HANDOFF.md`
- Verificação: `.checks/aceitacao-4.mjs`

**Interfaces:**

- Consome: tudo das Tarefas 1–4.
- Produz: o instalador, o registro da aceitação e a SPEC atualizada com as decisões da fase.

- [ ] **Passo 1: Gerar o instalador**

```bash
npm run build:win
```

Esperado: `building target=nsis file=dist\mdd-0.1.0-setup.exe` sem erro.

- [ ] **Passo 2: Escrever `.checks/aceitacao-4.mjs`**

```js
// Aceitação da Fase 4 (SPEC §9) com entrada real.
// Uso: node .checks/aceitacao-4.mjs <porta-cdp> <porta-inspect> <parte> <pasta-do-projeto>
//   parte 1: a aba mostra os 6 assets do exemplo; boleto.xml renomeado fora do app fica ausente.
//   parte 2: sem o assets.xml, os 6 assets são vinculados pela interface, fora de ordem, e o
//            arquivo salvo sai idêntico ao do exemplo.
import { readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { connect, log, sleep } from './cdp.mjs'
import { connectMain } from './main-process.mjs'

const [port, inspectPort, part, projectDir] = process.argv.slice(2)
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
const { click, press, fill, choose, text, title, js, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))
const row = (id) => `[data-asset-id="${id}"]`
const groups = () =>
  js(`[...document.querySelectorAll('[data-anchor]')].map((group) =>
    group.dataset.anchor + '(' + [...group.querySelectorAll('[data-asset-id]')]
      .map((row) => row.dataset.assetId + ':' + row.querySelector('[data-file-status]').dataset.fileStatus)
      .join(' ') + ')').join(' ')`)
const example = readFileSync('docs/examples/loja-online/assets.xml', 'utf8')

if (part === '2') rmSync(file('assets.xml'))
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Assets' })
await sleep(800)

if (part === '1') {
  log('1. a aba mostra', await groups())
  log('   resumo', await text('[data-assets-summary]'))
  renameSync(file('docs/pagamento/boleto.xml'), file('docs/pagamento/boleto-renomeado.xml'))
  // O Windows não deixa um app em segundo plano tomar o foco: o evento vai direto à página.
  await js(`window.dispatchEvent(new Event('focus'))`)
  await sleep(600)
  log('2. boleto.xml renomeado fora', await groups())
  log('   resumo', await text('[data-assets-summary]'))
}

if (part === '2') {
  log('1. sem assets.xml', await text('[data-assets-summary]'))
  const link = async ({ path, id, name, anchor, kind }) => {
    await main.answerFiles([file(path)])
    await click({ text: 'Vincular arquivo…' })
    await waitFor(`document.querySelector('[role=dialog]') !== null`)
    if (kind !== undefined) await choose('#link-asset-kind', kind)
    await fill('#link-asset-name', name)
    await fill('#link-asset-id', id)
    await choose('#link-asset-anchor', anchor)
    await click({ tag: '[role=dialog] button', text: 'Vincular' })
    await waitFor(`document.querySelector('[role=dialog]') === null`)
  }
  // Fora de ordem de propósito: o arquivo sai na ordem das âncoras no modelo.
  await link({
    path: 'docs/pagamento/boleto.xml',
    id: 'doc_boleto',
    name: 'Guia do boleto',
    anchor: 'pag_boleto'
  })
  await link({
    path: 'docs/busca/busca-app.xml',
    id: 'doc_busca_app',
    name: 'Busca no app',
    anchor: 'busca'
  })
  await link({
    path: 'docs/img/pix-fluxo.svg',
    id: 'img_pix',
    name: 'Fluxo do PIX',
    anchor: 'pag_pix'
  })
  await link({
    path: 'docs/loja/visao-geral.xml',
    id: 'doc_loja',
    name: 'Visão geral',
    anchor: 'loja'
  })
  await link({ path: 'docs/busca/busca.xml', id: 'doc_busca', name: 'Busca', anchor: 'busca' })
  await link({
    path: 'docs/pagamento/pix.xml',
    id: 'doc_pix',
    name: 'Guia do PIX',
    anchor: 'pag_pix'
  })
  log('2. vinculados', await groups())
  await click(`${row('doc_busca')} button[title="Mover para cima"]`)
  await click(`${row('doc_pix')} button[title="Mover para cima"]`)
  await click(`${row('doc_busca_app')} > button`)
  await fill('#asset-condition', 'busca and mobile')
  await press('Enter')
  log('3. reordenados, com a condição', await groups())
  await press('s', { ctrl: true })
  await waitFor(`!document.title.startsWith('•')`)
  log('4. salvo', await title())
  log('   assets.xml igual ao exemplo', readFileSync(file('assets.xml'), 'utf8') === example)
}

log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
main.close()
```

- [ ] **Passo 3: Rodar a aceitação e o roteiro da aba no `mdd.exe`**

Combine o momento com o usuário.

```bash
bash .checks/run-ui.sh ./dist/win-unpacked/mdd.exe .checks/aceitacao-4.mjs 9229 1
bash .checks/run-ui.sh ./dist/win-unpacked/mdd.exe .checks/aceitacao-4.mjs 9229 2
bash .checks/run-ui.sh ./dist/win-unpacked/mdd.exe .checks/assets-ui.mjs 9229
```

Esperado da parte 1, exatamente:

```
1. a aba mostra                      → loja(doc_loja:ok) busca(doc_busca:ok doc_busca_app:ok) pag_pix(doc_pix:ok img_pix:ok) pag_boleto(doc_boleto:ok)
   resumo                            → 6 assets
2. boleto.xml renomeado fora         → loja(doc_loja:ok) busca(doc_busca:ok doc_busca_app:ok) pag_pix(doc_pix:ok img_pix:ok) pag_boleto(doc_boleto:missing)
   resumo                            → 6 assets · 1 ausente
erros no console                     → nenhum
app fechado
```

Da parte 2, exatamente:

```
1. sem assets.xml                    → 0 assets
2. vinculados                        → loja(doc_loja:ok) busca(doc_busca_app:ok doc_busca:ok) pag_pix(img_pix:ok doc_pix:ok) pag_boleto(doc_boleto:ok)
3. reordenados, com a condição       → loja(doc_loja:ok) busca(doc_busca:ok doc_busca_app:ok) pag_pix(doc_pix:ok img_pix:ok) pag_boleto(doc_boleto:ok)
4. salvo                             → Loja Online — mdd
   assets.xml igual ao exemplo       → true
erros no console                     → nenhum
app fechado
```

Na parte 2, os arquivos são vinculados fora de ordem, e o `assets.xml` salvo sai idêntico ao do exemplo. Do `assets-ui.mjs`: a mesma saída da Tarefa 4, Passo 22.

- [ ] **Passo 4: A aceitação à mão, com o usuário**

Os roteiros disparam o evento de foco na página e trocam o `shell.openPath` por um registrador. Falta o caminho de verdade, que depende do Windows. Peça ao usuário, com o `mdd.exe` aberto no exemplo (uma cópia, para não mexer no `docs/examples`):

1. abrir a aba Assets e ver os 6 assets, todos ok;
2. no Explorer, renomear `docs/pagamento/boleto.xml` e voltar ao app com um clique: o asset "Guia do boleto" aparece como **ausente**, e o resumo diz "6 assets · 1 ausente";
3. clicar em Abrir num asset `.svg` ou `.xml`: o arquivo abre no programa padrão.

Registre no handoff o que ele viu.

- [ ] **Passo 5: A SPEC (`docs/SPEC.md`)**

1. Em §4.3, troque o primeiro parágrafo por:

```markdown
Um asset tem `id` único (no mesmo formato de ID de feature), `kind` (`fragment` ou `resource`), `path`, `anchor` (ID de feature) e, opcionalmente, `name` e `condition`. O `id` é sugerido pelo nome do arquivo ao vincular (`pix-fluxo.svg` → `pix_fluxo`) e pode ser ajustado só nesse momento; depois não muda, nem ao trocar o arquivo (ADR 0004).
```

2. Ainda em §4.3, depois do parágrafo **Inclusão**, acrescente:

```markdown
**Ordem no arquivo.** Um asset novo, ou que troca de âncora, entra como o último da âncora, na posição que mantém o `assets.xml` agrupado na ordem das âncoras no modelo (pré-ordem). Assim o arquivo não depende da ordem em que os vínculos foram feitos. Reordenar troca o asset de lugar com o vizinho da mesma âncora.
```

3. Ainda em §4.3, troque o parágrafo **Estado do arquivo** por:

```markdown
**Estado do arquivo** (calculado, não salvo): _ok_ (o caminho é um arquivo que existe), _ausente_ (não existe, é uma pasta ou não pode ser conferido) ou, só para fragmentos e verificado na geração, _XML malformado_.
```

4. Em §6.2, na linha do `ProjectStorage`, troque "Ler, escrever, listar, copiar, renomear e remover arquivos e pastas dentro do projeto." por "Ler, escrever, listar, conferir (`stat`), copiar, renomear e remover arquivos e pastas dentro do projeto."; na linha do `ProjectFolderPicker`, troque a responsabilidade por "Escolher a pasta do projeto."; e acrescente, logo abaixo dela, a linha:

```markdown
| `ProjectFilePicker` | Escolher um arquivo dentro do projeto, num diálogo que começa na raiz. Devolve o caminho relativo e recusa um arquivo de fora. | `ElectronProjectFilePicker` |
```

5. Em §6.3, troque o item **Shell** da lista de canais por:

```markdown
- **Shell:** `openPath` (`shell.openPath`, só para arquivos do projeto)
```

6. Em §7, troque o bloco **Assets** (do título até o fim da seção) por:

```markdown
**Assets:**

- Na aba Assets, a lista fica no centro, agrupada por âncora na ordem do modelo, e as propriedades do asset selecionado ficam à direita.
- Cada linha mostra o tipo, o nome (ou o nome do arquivo), o caminho, a condição e o estado do arquivo (ok / ausente), com as ações abrir (desligada quando ausente), mover para cima ou para baixo dentro da âncora e desvincular (sem confirmação: tem desfazer, e o arquivo fica no disco).
- O painel edita nome, tipo, âncora e condição, e tem "Trocar arquivo…", que muda só o caminho. Trocar a âncora leva o asset para o fim da nova âncora.
- Para vincular, o arquivo é escolhido em um diálogo que começa na pasta do projeto. Um arquivo fora do projeto é recusado com a orientação de copiá-lo para dentro. Depois vem o diálogo com o tipo (sugerido pela extensão: `.xml` → fragmento, demais → recurso), o nome (opcional), o ID (sugerido pelo nome do arquivo e ajustável só ali) e a âncora.
- A condição usa o mesmo editor das restrições; vazio = sem condição. Uma expressão inválida não é gravada.
- O estado dos arquivos é conferido ao abrir o projeto, ao entrar na aba, quando a janela volta ao foco, depois de qualquer mudança nos assets (inclusive desfazer) e no botão "Atualizar".
- Todas as edições de assets são comandos do histórico: desfazer e refazer valem nas abas Modelo e Assets (também com o foco numa lista de opções). Tab, Enter, F2, Delete e Alt+↑/↓ valem só na aba Modelo.
- O painel da feature, na aba Modelo, lista os assets ancorados nela, com o estado de cada arquivo e o botão "Vincular arquivo…".
```

- [ ] **Passo 6: O ADR 0004**

Em `docs/adr/0004-ids-estaveis-para-features.md`, no fim de "Consequences", acrescente:

```markdown
- Os assets seguem a mesma regra (Fase 4): o ID é sugerido pelo nome do arquivo ao vincular, pode ser ajustado nesse momento e depois não muda, nem quando o arquivo do asset é trocado. É o ID que aparece no produto gerado (`<fragment asset="…">`).
```

- [ ] **Passo 7: A spec do desenho**

Em `docs/superpowers/specs/2026-09-24-fase-4-assets-design.md`, logo abaixo da linha "Aprovado em 24/09/2026. …", acrescente:

```markdown
> O protótipo refinou alguns pontos deste desenho: a ordem no `assets.xml`, a conferência depois de qualquer mudança nos assets, Ctrl+Z com o foco numa lista de opções e as funções de edição separadas. Veja "O que o protótipo respondeu" no [plano](../plans/2026-09-24-fase-4-assets.md); a SPEC já reflete esses pontos.
```

- [ ] **Passo 8: O handoff (`docs/HANDOFF.md`)**

- Na tabela "Estado atual", troque as linhas da Fase 4 e da Fase 5 por:

```markdown
| 4. Assets | Concluída | `main`. Plano em [docs/superpowers/plans/2026-09-24-fase-4-assets.md](superpowers/plans/2026-09-24-fase-4-assets.md) |
| **5. Geração** | **A planejar** | — |
```

- Na lista do que o app faz, acrescente: "vincula arquivos do projeto às features na aba Assets, com o estado de cada arquivo (ok ou ausente), trocar arquivo, reordenar, desvincular e abrir no programa padrão, e mostra os assets ancorados no painel da feature".
- Depois de "Aceitação da Fase 3", acrescente a seção "Aceitação da Fase 4 (feita em <data>)". Ela registra o que os Passos 3 e 4 desta tarefa mostraram e a regressão da Tarefa 4, Passo 23. Escreva o que de fato aconteceu; se algo divergir do esperado, registre a divergência.
- Troque a seção "Próximo passo: Fase 4 (assets)" por "Próximo passo: Fase 5 (geração)". Ela descreve a entrega da SPEC §9 (plano, verificação, `XmlProductDeriver`, pasta temporária e troca) e a aceitação da mesma linha. Termina com o pedido para a sessão nova:

> Leia docs/HANDOFF.md e escreva o plano da Fase 5, prototipando e verificando o código numa cópia descartável antes, como nas fases anteriores.

- Em "Como trabalhamos", acrescente aos roteiros da lista: "Os da Fase 4 (`asset-edits-check.mts`, `asset-files-check.mts`, `project-root-check.mts`, `assets-store-check.mts`, `main-process.mjs`, `run-ui.sh`, `assets-ui.mjs` e `aceitacao-4.mjs`) estão no plano da Fase 4. O `run-ui.sh` prepara a cópia do exemplo, abre o app, roda um roteiro e fecha: prefira-o a montar os comandos à mão."
- Em "Armadilhas já encontradas", acrescente:

```markdown
- **Foco da janela nos roteiros:** o Windows não deixa um app em segundo plano tomar o foco de outra janela, então `BrowserWindow.focus()` pelo inspetor não é confiável quando o usuário está usando outra janela (e `blur()` não tira o foco). Para exercitar o que acontece "quando a janela volta ao foco", dispare `window.dispatchEvent(new Event('focus'))` na página. Com uma troca de foco de verdade, o renderer recebe `blur` e `focus`, cada um duas vezes.
- **`shell.openPath` num roteiro:** troque-o por um registrador pelo inspetor do main (`.checks/main-process.mjs`). Um arquivo de extensão sem programa associado não serve de teste "sem janela": o Windows pode abrir o diálogo "Como você deseja abrir este arquivo?".
- **Atalhos e `<select>`:** um `<select>` com foco não tem desfazer próprio. Ctrl+Z e Ctrl+Y vão para o histórico; as demais teclas ficam com a lista.
- **Campo que grava ao sair e Esc:** `blur()` dispara o `onBlur` na hora, com o texto antigo na closure. Marque o cancelamento num `ref` antes do `blur()` (veja o `ConditionField`).
- **Arquivo `.tsx` só exporta componentes** (`react-refresh/only-export-components`): funções e hooks compartilhados vão para um `.ts` ao lado (`expression-check.ts`, `use-file-status.ts`).
- **Arrasto até o arco no `diagrama-ui.mjs`:** instável; falhou uma vez em três rodadas na Fase 4, sem relação com o código. Se falhar, rode de novo.
```

- [ ] **Passo 9: Commit**

```bash
npm run format
git add docs/SPEC.md docs/adr/0004-ids-estaveis-para-features.md docs/superpowers/specs/2026-09-24-fase-4-assets-design.md docs/HANDOFF.md
git commit -m "docs: spec, ADR 0004 e handoff registram a Fase 4

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Depois das checagens, o branch volta para a `main` com merge local, como nas fases anteriores.

---

## Aceitação da Fase 4 (SPEC §9)

- [ ] A aba mostra os 6 assets do exemplo, agrupados por âncora, todos ok (Tarefa 4, Passo 22; Tarefa 5, Passos 3 e 4).
- [ ] Renomear `boleto.xml` fora do app faz o asset aparecer como ausente quando a janela volta ao foco (os mesmos passos; à mão no Passo 4).
- [ ] Recriar os assets do exemplo pela interface, vinculando fora de ordem, e salvar produz um `assets.xml` idêntico ao do exemplo (Tarefa 1, Passo 8; Tarefa 5, Passo 3).
- [ ] Vincular recusa arquivo de fora do projeto; o ID é sugerido e ajustável só no vínculo (Tarefa 4, Passo 22).
- [ ] Editar nome, tipo, âncora e condição, trocar arquivo, reordenar e desvincular, tudo com desfazer (Tarefa 1, Passo 8; Tarefa 4, Passo 22).
- [ ] Abrir no programa padrão (Tarefa 4, Passo 22, registrado; Tarefa 5, Passo 4, de verdade).
- [ ] O painel da feature mostra os assets ancorados (Tarefa 4, Passo 22).
- [ ] As fases anteriores continuam iguais (Tarefa 3, Passo 8; Tarefa 4, Passo 23).
