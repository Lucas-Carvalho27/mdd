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

| Arquivo | Responsabilidade |
| --- | --- |
| `domain/assets/asset-catalog.ts` | `fileNameOf` e `assetLabel` |
| `domain/assets/asset-edits.ts` | Sugestões de ID e tipo; vincular, editar, trocar arquivo, reordenar e desvincular |
| `domain/assets/asset-groups.ts` | Grupos por âncora na pré-ordem; assets de uma âncora |
| `domain/assets/asset-file-status.ts` | Tipo `AssetFileStatus` |
| `application/editing/commands.ts` | Comandos de asset |
| `application/ports/project-storage.ts` | `stat` |
| `application/ports/project-file-picker.ts`, `asset-opener.ts` | Portas novas |
| `application/use-cases/check-asset-files.ts` | Estado do arquivo por caminho |
| `shared/ipc.ts`, `preload/index.ts` | Canais `stat`, `pickFileInProject` e `openPath` |
| `main/project-root.ts` | `toRelative` |
| `main/ipc/file-handlers.ts`, `project-handlers.ts` | Os três canais no main |
| `infrastructure/electron/*` | `stat`, `ElectronProjectFilePicker`, `ElectronAssetOpener` |
| `ui/stores/assets-actions.ts` | Seleção, estado dos arquivos, escolher, vincular, trocar e abrir |
| `ui/stores/project-store.ts` | Monta as ações de assets; aviso com o texto inteiro; confere ao abrir e depois de mudar os assets |
| `ui/app/composition-root.ts` | Injeta os serviços novos |
| `ui/components/expression-check.ts`, `ExpressionInput.tsx` | O editor de expressão compartilhado |
| `ui/screens/project/constraints/ConstraintForm.tsx` | Usa o `ExpressionInput` |
| `ui/screens/assets/*` | A aba Assets |
| `ui/screens/project/properties/AnchoredAssetsSection.tsx`, `FeatureProperties.tsx`, `ModelWorkspace.tsx` | Assets ancorados no painel da feature |
| `ui/screens/project/ViewRail.tsx`, `ProjectScreen.tsx`, `ProjectHeader.tsx`, `editor-dialog.ts`, `use-editor-shortcuts.ts`, `use-window-focus.ts` | Terceira aba, diálogo de vincular, atalhos por escopo, volta do foco |

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

@@FILE .checks/asset-edits-check.mts@@

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

@@FILE src/renderer/src/domain/assets/asset-edits.ts@@

`({ name: _old, ...asset })` tira o campo do objeto; o lint aceita a variável sem uso porque está ao lado do `...resto` (`ignoreRestSiblings`).

- [ ] **Passo 6: Criar `src/renderer/src/domain/assets/asset-groups.ts`**

@@FILE src/renderer/src/domain/assets/asset-groups.ts@@

- [ ] **Passo 7: Comandos em `src/renderer/src/application/editing/commands.ts`**

@@EDITS src/renderer/src/application/editing/commands.ts@@

- [ ] **Passo 8: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/asset-edits-check.mts
```

Esperado, exatamente:

@@OUT asset-edits-check@@

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

@@FILE .checks/asset-files-check.mts@@

- [ ] **Passo 2: Escrever `.checks/project-root-check.mts`**

Ele importa o `ProjectRoot` do main direto, por caminho relativo (o main não usa o alias `@/`).

@@FILE .checks/project-root-check.mts@@

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/asset-files-check.mts
npx tsx .checks/project-root-check.mts
```

Esperado: o primeiro falha ao carregar `@/application/use-cases/check-asset-files`; o segundo, com `root.toRelative is not a function`.

- [ ] **Passo 4: Criar `src/renderer/src/domain/assets/asset-file-status.ts`**

@@FILE src/renderer/src/domain/assets/asset-file-status.ts@@

- [ ] **Passo 5: `stat` na porta `src/renderer/src/application/ports/project-storage.ts`**

@@EDITS src/renderer/src/application/ports/project-storage.ts@@

- [ ] **Passo 6: Criar as portas novas**

`src/renderer/src/application/ports/project-file-picker.ts`:

@@FILE src/renderer/src/application/ports/project-file-picker.ts@@

`src/renderer/src/application/ports/asset-opener.ts`:

@@FILE src/renderer/src/application/ports/asset-opener.ts@@

- [ ] **Passo 7: Criar `src/renderer/src/application/use-cases/check-asset-files.ts`**

@@FILE src/renderer/src/application/use-cases/check-asset-files.ts@@

- [ ] **Passo 8: Contrato do IPC em `src/shared/ipc.ts`**

@@EDITS src/shared/ipc.ts@@

- [ ] **Passo 9: `src/preload/index.ts`**

@@EDITS src/preload/index.ts@@

- [ ] **Passo 10: Substituir `src/main/project-root.ts`**

@@FILE src/main/project-root.ts@@

- [ ] **Passo 11: `stat` e `openPath` em `src/main/ipc/file-handlers.ts`**

@@EDITS src/main/ipc/file-handlers.ts@@

- [ ] **Passo 12: `pickFileInProject` em `src/main/ipc/project-handlers.ts`**

@@EDITS src/main/ipc/project-handlers.ts@@

- [ ] **Passo 13: Adapters**

`src/renderer/src/infrastructure/electron/electron-project-storage.ts`:

@@EDITS src/renderer/src/infrastructure/electron/electron-project-storage.ts@@

`src/renderer/src/infrastructure/electron/electron-project-file-picker.ts`:

@@FILE src/renderer/src/infrastructure/electron/electron-project-file-picker.ts@@

`src/renderer/src/infrastructure/electron/electron-asset-opener.ts`:

@@FILE src/renderer/src/infrastructure/electron/electron-asset-opener.ts@@

- [ ] **Passo 14: Rodar os roteiros**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/asset-files-check.mts
npx tsx .checks/project-root-check.mts
```

Esperado, exatamente:

@@OUT asset-files-check@@

@@OUT project-root-check@@

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

@@FILE .checks/assets-store-check.mts@@

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/assets-store-check.mts
```

Esperado: falha ao carregar `@/ui/stores/assets-actions`.

- [ ] **Passo 3: Criar `src/renderer/src/ui/stores/assets-actions.ts`**

@@FILE src/renderer/src/ui/stores/assets-actions.ts@@

- [ ] **Passo 4: Montar as ações em `src/renderer/src/ui/stores/project-store.ts`**

@@EDITS src/renderer/src/ui/stores/project-store.ts@@

- [ ] **Passo 5: Serviços novos em `src/renderer/src/ui/app/composition-root.ts`**

@@EDITS src/renderer/src/ui/app/composition-root.ts@@

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

@@OUT assets-store-check@@

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

@@FILE .checks/main-process.mjs@@

- [ ] **Passo 2: Escrever `.checks/run-ui.sh`**

Prepara uma cópia limpa do exemplo, abre o app (`dev` = `electron.exe .` sobre o `out/`), espera a lista de recentes aparecer, roda um roteiro e fecha. Para o `configurador-ui.mjs`, acrescenta o `conflito.xml` da Fase 3.

@@FILE .checks/run-ui.sh@@

- [ ] **Passo 3: Escrever `.checks/assets-ui.mjs`**

@@FILE .checks/assets-ui.mjs@@

- [ ] **Passo 4: Rodar e ver falhar**

```bash
npm run build
bash .checks/run-ui.sh dev .checks/assets-ui.mjs 9229
```

Esperado: o roteiro para com `não achei {"text":"Assets"}`: a aba ainda não existe.

- [ ] **Passo 5: Criar `src/renderer/src/ui/components/expression-check.ts`**

@@FILE src/renderer/src/ui/components/expression-check.ts@@

- [ ] **Passo 6: Criar `src/renderer/src/ui/components/ExpressionInput.tsx`**

@@FILE src/renderer/src/ui/components/ExpressionInput.tsx@@

- [ ] **Passo 7: Substituir `src/renderer/src/ui/screens/project/constraints/ConstraintForm.tsx`**

O comportamento não muda; o campo de expressão passa a ser o `ExpressionInput`.

@@FILE src/renderer/src/ui/screens/project/constraints/ConstraintForm.tsx@@

- [ ] **Passo 8: Estado do arquivo na tela**

`src/renderer/src/ui/screens/assets/use-file-status.ts`:

@@FILE src/renderer/src/ui/screens/assets/use-file-status.ts@@

`src/renderer/src/ui/screens/assets/FileStatusBadge.tsx`:

@@FILE src/renderer/src/ui/screens/assets/FileStatusBadge.tsx@@

- [ ] **Passo 9: Criar `src/renderer/src/ui/screens/assets/use-link-asset.ts`**

@@FILE src/renderer/src/ui/screens/assets/use-link-asset.ts@@

- [ ] **Passo 10: Criar `src/renderer/src/ui/screens/assets/asset-fields.tsx`**

Tipo, âncora e condição, usados no diálogo e no painel. A condição grava ao sair do campo ou com Enter, só se for válida.

@@FILE src/renderer/src/ui/screens/assets/asset-fields.tsx@@

- [ ] **Passo 11: Criar `src/renderer/src/ui/screens/assets/LinkAssetDialog.tsx`**

@@FILE src/renderer/src/ui/screens/assets/LinkAssetDialog.tsx@@

- [ ] **Passo 12: Criar `src/renderer/src/ui/screens/assets/AssetProperties.tsx`**

@@FILE src/renderer/src/ui/screens/assets/AssetProperties.tsx@@

- [ ] **Passo 13: Criar `src/renderer/src/ui/screens/assets/AssetList.tsx`**

@@FILE src/renderer/src/ui/screens/assets/AssetList.tsx@@

- [ ] **Passo 14: Criar `src/renderer/src/ui/screens/assets/AssetsWorkspace.tsx`**

A chave `asset.id` no painel zera o texto dos campos ao trocar de asset.

@@FILE src/renderer/src/ui/screens/assets/AssetsWorkspace.tsx@@

- [ ] **Passo 15: Assets ancorados no painel da feature**

`src/renderer/src/ui/screens/project/properties/AnchoredAssetsSection.tsx`:

@@FILE src/renderer/src/ui/screens/project/properties/AnchoredAssetsSection.tsx@@

`src/renderer/src/ui/screens/project/properties/FeatureProperties.tsx`:

@@EDITS src/renderer/src/ui/screens/project/properties/FeatureProperties.tsx@@

`src/renderer/src/ui/screens/project/ModelWorkspace.tsx`:

@@EDITS src/renderer/src/ui/screens/project/ModelWorkspace.tsx@@

- [ ] **Passo 16: A terceira aba e o diálogo de vincular**

`src/renderer/src/ui/screens/project/ViewRail.tsx`:

@@EDITS src/renderer/src/ui/screens/project/ViewRail.tsx@@

`src/renderer/src/ui/screens/project/editor-dialog.ts`:

@@EDITS src/renderer/src/ui/screens/project/editor-dialog.ts@@

- [ ] **Passo 17: Atalhos com três escopos em `src/renderer/src/ui/screens/project/use-editor-shortcuts.ts`**

@@EDITS src/renderer/src/ui/screens/project/use-editor-shortcuts.ts@@

- [ ] **Passo 18: A dica do desfazer em `src/renderer/src/ui/screens/project/ProjectHeader.tsx`**

@@EDITS src/renderer/src/ui/screens/project/ProjectHeader.tsx@@

- [ ] **Passo 19: Criar `src/renderer/src/ui/screens/project/use-window-focus.ts`**

@@FILE src/renderer/src/ui/screens/project/use-window-focus.ts@@

- [ ] **Passo 20: Juntar tudo em `src/renderer/src/ui/screens/project/ProjectScreen.tsx`**

Sobre o arquivo como ficou na Tarefa 3:

@@EDITS src/renderer/src/ui/screens/project/ProjectScreen.tsx depois-da-tarefa-3@@

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

@@OUT assets-ui@@

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

@@FILE .checks/aceitacao-4.mjs@@

- [ ] **Passo 3: Rodar a aceitação e o roteiro da aba no `mdd.exe`**

Combine o momento com o usuário.

```bash
bash .checks/run-ui.sh ./dist/win-unpacked/mdd.exe .checks/aceitacao-4.mjs 9229 1
bash .checks/run-ui.sh ./dist/win-unpacked/mdd.exe .checks/aceitacao-4.mjs 9229 2
bash .checks/run-ui.sh ./dist/win-unpacked/mdd.exe .checks/assets-ui.mjs 9229
```

Esperado da parte 1, exatamente:

@@OUT aceitacao-4-parte1@@

Da parte 2, exatamente:

@@OUT aceitacao-4-parte2@@

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
