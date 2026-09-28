# Fase 8 — Aba Páginas: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** ver, dentro do app, a página da configuração aberta, montada ao vivo a partir do projeto como está na tela, sem gravar nada em `saida/`. A janela ganha a aba **Páginas**. A página roda num `<iframe>` com sandbox, servido pelo esquema próprio `mdd-page:`, e não enxerga o app.

**Arquitetura:**

- **Domínio:** `projectHasPage(catalog)`.
- **Aplicação:** as portas `PagePreviewer` e `PagePreviewHost`, o `EditedFragmentsStorage` (o texto dos fragmentos abertos no lugar do disco) e o caso de uso `PreviewPage`.
- **Infraestrutura:** o `HtmlPageDeriver` passa a montar também a página da visualização, no melhor esforço; o `ElectronPagePreviewHost`.
- **Processo main e IPC:** o esquema `mdd-page:` e o script da visualização (`src/main/page-preview.ts`), o canal `setPreviewPage` e a CSP do app com `frame-src mdd-page:`.
- **Interface:** a store da aba (`pages-actions.ts`), a pasta `ui/screens/pages/`, a aba no `ViewRail` e no `ProjectScreen`, o `GenerateButton` compartilhado, "Abrir no navegador" na faixa verde e abrir um fragmento numa linha.

**Stack:** a das fases anteriores; nenhum pacote novo.

**Spec:** [docs/superpowers/specs/2026-09-28-fase-8-aba-paginas-design.md](../specs/2026-09-28-fase-8-aba-paginas-design.md) (o desenho aprovado, com o que o protótipo respondeu) e as decisões de produto no fim de [docs/superpowers/specs/2026-09-28-fase-7-paginas-html-design.md](../specs/2026-09-28-fase-7-paginas-html-design.md). O ADR 0011 é escrito na Tarefa 4.

## Restrições globais

- **Sem testes automatizados** (ADR 0008): typecheck, lint e scripts descartáveis em `.checks/`, rodados com `npx tsx --tsconfig tsconfig.web.json` (`.mts`) ou `node` (`.mjs`).
- **Roteiros:** os das fases anteriores e os desta estão no branch `prototipo-fase-8`, com as saídas conferidas em `.checks/out/`. Traga-os com `git archive prototipo-fase-8 .checks | tar -x` (`origin/prototipo-fase-8` depois que o usuário enviar o branch).
- **Camadas** (SPEC §6.1): `domain/` não importa nada de fora dele; `application/` só `domain/`; só `ui/app/` conhece `infrastructure/`. A composition root importa `src/shared/ipc.ts` por caminho relativo (daí vem o `PREVIEW_ADDRESS`).
- **Idioma:** identificadores em inglês; textos da interface, mensagens, comentários e documentação em português.
- **Regras do lint:** toda função tem tipo de retorno explícito; as regras de hooks do React 19 estão ligadas (nada de ler um ref durante o render: o `PageFrame` lê a rolagem da store dentro do efeito); um `.tsx` só exporta componentes (por isso o `GenerateButton` ganha um arquivo próprio).
- **Segurança da visualização (ADR 0011):** o `<iframe>` nunca leva `allow-same-origin` nem `allow-top-navigation`; a resposta do esquema não tem CSP própria; o app só aceita mensagens do quadro da aba (`event.source`) e no formato esperado.
- **Commits:** rode `npm run format` antes de cada commit. Os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Shell:** todo comando roda na raiz do repositório com **Git Bash**, no branch `fase-8-aba-paginas`.
- **Roteiros de interface abrem janelas na tela do usuário:** combine o momento com ele antes. Entre duas rodadas do `run-ui.sh`, espere uns segundos.

## O que o protótipo respondeu

O código deste plano foi prototipado e verificado numa cópia descartável do repositório (branch `prototipo-fase-8`). Depois, cada tarefa foi aplicada sozinha, em ordem, sobre o commit `0091dd4` (o último da `main` antes do código), com os roteiros novos falhando antes e dando a saída deste plano depois, e o typecheck e o lint limpos (`.checks/por-tarefa-8.sh`). No fim, o `src/` ficou idêntico ao do protótipo.

1. **O isolamento funciona como previsto:** a página é um alvo `iframe` à parte no protocolo de depuração, em origem opaca (`self.origin` é `null`); `window.mdd` não existe nela; ler o `parent` dá `SecurityError`; as imagens do projeto chegam pelo esquema. Tudo igual no `mdd.exe`.
2. **Os links para fora não passam pelo main:** a CSP do app (`frame-src mdd-page:`) barra a navegação do quadro ainda no renderer, e o `will-frame-navigate` nem é chamado (o quadro caía numa página de erro). O script da visualização abre os links `https:`, `http:` e `mailto:` como janela nova, e o `setWindowOpenHandler` do main os manda para o navegador do sistema.
3. **Ao voltar à aba**, o quadro mostrava por meio segundo a página da última visita, que o main ainda guardava: a montagem ao entrar na aba é imediata.
4. **"Criar moldura"** recusava o caminho quando a lista da aba Fragmentos ainda tinha uma moldura apagada por fora: as pastas são relidas antes, e uma moldura que exista é aberta.
5. **A largura "Celular"** dava 373 px por causa da borda do quadro: um contorno (`ring`) no lugar da borda dá 375.
6. **Na visualização, a moldura não pode ser "o primeiro arquivo preparado"**, como era na geração (lá, qualquer problema parava antes): se ela falhar, o primeiro fragmento viraria moldura. A montagem separa a moldura e cai na padrão.
7. **Os problemas de um arquivo saem na ordem das linhas:** os da conferência vinham antes dos marcadores.

**Regressão no protótipo:** os roteiros sem janela das Fases 3 a 7 saíram iguais; os de interface (`fragmentos-ui`, `geracao-ui`, `assets-ui`, `configurador-ui` e `ui-check`) também; o `paginas-ui.mjs` (Fase 7) mudou só na faixa verde, que ganhou "Abrir no navegador". O `aba-paginas-ui.mjs` deu a mesma saída no modo de desenvolvimento e no `mdd.exe`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `domain/pages/page-assembly.ts`, `domain/generation/generation-plan.ts` | `projectHasPage`, usado pelo plano e pela visualização |
| `application/ports/page-previewer.ts`, `page-preview-host.ts` | As portas da visualização |
| `application/fragments/edited-fragments-storage.ts` | O texto dos fragmentos abertos no lugar do disco |
| `application/use-cases/preview-page.ts` | A página da configuração aberta |
| `infrastructure/html/html-page-deriver.ts` | A mesma montagem para a geração e a visualização |
| `src/main/page-preview.ts`, `src/main/index.ts` | O esquema `mdd-page:`, o script da visualização e as janelas que vão para o sistema |
| `src/shared/ipc.ts`, `src/preload/index.ts`, `src/renderer/index.html` | O canal `setPreviewPage`, o endereço e a CSP |
| `infrastructure/electron/electron-page-preview-host.ts` | Entrega a página ao main |
| `ui/stores/pages-actions.ts`, `project-store.ts`, `generation-actions.ts`, `fragments-actions.ts` | A store da aba, "Abrir no navegador" e abrir um fragmento numa linha |
| `ui/app/composition-root.ts` | Injeta a visualização |
| `ui/screens/pages/*` | A aba: quadro, barra, problemas e a tela |
| `ui/screens/configurator/GenerateButton.tsx`, `ConfiguratorWorkspace.tsx`, `GenerationBanner.tsx`, `ConfigurationList.tsx` | O botão compartilhado, a faixa e a lista só para escolher |
| `ui/screens/project/ViewRail.tsx`, `ProjectScreen.tsx`, `ui/screens/fragments/FragmentEditor.tsx`, `FragmentsWorkspace.tsx` | A aba e a linha pedida pela aba Páginas |
| `docs/adr/0011-visualizacao-da-pagina-isolada.md`, `CONTEXT.md`, `docs/SPEC.md` | A documentação |

(Os caminhos de código sem `src/` ficam em `src/renderer/src/`.)

---

### Tarefa 1: A página na visualização

**Arquivos:**

- Criar: `src/renderer/src/application/ports/page-previewer.ts`, `src/renderer/src/application/ports/page-preview-host.ts`, `src/renderer/src/application/fragments/edited-fragments-storage.ts`, `src/renderer/src/application/use-cases/preview-page.ts`
- Modificar: `src/renderer/src/domain/pages/page-assembly.ts`, `src/renderer/src/domain/generation/generation-plan.ts`, `src/renderer/src/infrastructure/html/html-page-deriver.ts` (reescrito)
- Verificação: `.checks/edited-storage-check.mts`, `.checks/page-preview-check.mts`; regressão da geração

**Interfaces:**

- Produz: `projectHasPage(catalog)`; `PagePreviewer.preview(plan, edited)` e `PagePreview` (`page`, `problems`, `defaultFrame`); `PagePreviewHost` (`address`, `show(html)`); `EditedFragmentsStorage(storage, edited)`; `PreviewPage` e `PreviewPageResult` (`no-configuration`, `no-page`, `blocked`, `page`).

- [ ] **Passo 1: Conferir o branch**

```bash
git switch fase-8-aba-paginas
git status --short
git log --oneline -3
```

Esperado: nada pendente; o último commit é o deste plano, sobre o `0091dd4`.

- [ ] **Passo 2: Escrever o roteiro `.checks/edited-storage-check.mts`**

@@FILE .checks/edited-storage-check.mts@@

- [ ] **Passo 3: Escrever o roteiro `.checks/page-preview-check.mts`**

@@FILE .checks/page-preview-check.mts@@

- [ ] **Passo 4: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/edited-storage-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/page-preview-check.mts
```

Esperado: os dois falham com `ERR_MODULE_NOT_FOUND`.

- [ ] **Passo 5: Criar `src/renderer/src/application/ports/page-previewer.ts`**

@@FILE src/renderer/src/application/ports/page-previewer.ts@@

- [ ] **Passo 6: Criar `src/renderer/src/application/ports/page-preview-host.ts`**

@@FILE src/renderer/src/application/ports/page-preview-host.ts@@

- [ ] **Passo 7: Criar `src/renderer/src/application/fragments/edited-fragments-storage.ts`**

@@FILE src/renderer/src/application/fragments/edited-fragments-storage.ts@@

- [ ] **Passo 8: Criar `src/renderer/src/application/use-cases/preview-page.ts`**

@@FILE src/renderer/src/application/use-cases/preview-page.ts@@

- [ ] **Passo 9: `projectHasPage`, em `src/renderer/src/domain/pages/page-assembly.ts`**

@@EDITS src/renderer/src/domain/pages/page-assembly.ts@@

E o plano da geração passa a usá-lo, em `src/renderer/src/domain/generation/generation-plan.ts`:

@@EDITS src/renderer/src/domain/generation/generation-plan.ts@@

- [ ] **Passo 10: Reescrever `src/renderer/src/infrastructure/html/html-page-deriver.ts`**

A geração e a visualização passam pela mesma montagem (`build`). O arquivo inteiro:

@@FILE src/renderer/src/infrastructure/html/html-page-deriver.ts@@

- [ ] **Passo 11: Rodar os roteiros**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/edited-storage-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/page-preview-check.mts
```

Esperado, `edited-storage-check.mts`:

@@OUT edited-storage-check@@

Esperado, `page-preview-check.mts`:

@@OUT page-preview-check@@

- [ ] **Passo 12: Regressão da geração**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/html-page-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/html-checker-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/herby-generate.mts completa-atibaia
npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/generation-plan-check.mts
```

Esperado: as saídas do plano da Fase 7 (`html-page-check.txt`, `html-checker-check.txt`, `herby-generate.txt`, `generate-product-t2.txt` e `generation-plan-check-base.txt` em `.checks/out/`).

- [ ] **Passo 13: Checagens e commit**

```bash
npm run typecheck
npm run lint
npm run format
git add src/renderer/src
git commit -F - <<'EOF'
feat(pages): a página na visualização, com o texto dos fragmentos abertos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tarefa 2: O esquema no processo main, o canal da página e a store da aba

**Arquivos:**

- Criar: `src/main/page-preview.ts`, `src/renderer/src/infrastructure/electron/electron-page-preview-host.ts`, `src/renderer/src/ui/stores/pages-actions.ts`
- Modificar: `src/main/index.ts`, `src/shared/ipc.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/ui/stores/project-store.ts`, `generation-actions.ts`, `fragments-actions.ts`, `src/renderer/src/ui/app/composition-root.ts`
- Verificação: `.checks/pages-store-check.mts`; regressão das stores

**Interfaces:**

- Produz: `registerPreviewScheme()`, `registerPagePreview(root)` e `isExternalAddress(url)` (`page-preview.ts`); `PREVIEW_SCHEME`, `PREVIEW_HOST`, `PREVIEW_ADDRESS` e `MddApi.setPreviewPage(html)`; `PagesState` (`pagePreview`, `pageWidth`, `pageScroll`, `refreshPage`, `setPageWidth`, `setPageScroll`); `GenerationState.openGeneratedPage()`; `FragmentsState.fragmentReveal`, `showFragmentAt(path, line)` e `clearFragmentReveal()`.

- [ ] **Passo 1: Escrever o roteiro `.checks/pages-store-check.mts`**

@@FILE .checks/pages-store-check.mts@@

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/pages-store-check.mts
```

Esperado: `TypeError: Cannot read properties of undefined (reading 'kind')` (a store ainda não tem o `pagePreview`).

- [ ] **Passo 3: Criar `src/main/page-preview.ts`**

@@FILE src/main/page-preview.ts@@

- [ ] **Passo 4: O esquema e as janelas, em `src/main/index.ts`**

@@EDITS src/main/index.ts@@

- [ ] **Passo 5: O canal e o endereço, em `src/shared/ipc.ts`**

@@EDITS src/shared/ipc.ts@@

Em `src/preload/index.ts`:

@@EDITS src/preload/index.ts@@

E a CSP do app, em `src/renderer/index.html`:

@@EDITS src/renderer/index.html@@

- [ ] **Passo 6: Criar `src/renderer/src/infrastructure/electron/electron-page-preview-host.ts`**

@@FILE src/renderer/src/infrastructure/electron/electron-page-preview-host.ts@@

- [ ] **Passo 7: Criar `src/renderer/src/ui/stores/pages-actions.ts`**

@@FILE src/renderer/src/ui/stores/pages-actions.ts@@

- [ ] **Passo 8: Montar as ações em `src/renderer/src/ui/stores/project-store.ts`**

@@EDITS src/renderer/src/ui/stores/project-store.ts@@

- [ ] **Passo 9: "Abrir no navegador", em `src/renderer/src/ui/stores/generation-actions.ts`**

@@EDITS src/renderer/src/ui/stores/generation-actions.ts@@

- [ ] **Passo 10: Abrir um fragmento numa linha, em `src/renderer/src/ui/stores/fragments-actions.ts`**

@@EDITS src/renderer/src/ui/stores/fragments-actions.ts@@

- [ ] **Passo 11: Injetar a visualização, em `src/renderer/src/ui/app/composition-root.ts`**

@@EDITS src/renderer/src/ui/app/composition-root.ts@@

- [ ] **Passo 12: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/pages-store-check.mts
```

Esperado:

@@OUT pages-store-check@@

- [ ] **Passo 13: Regressão das stores**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/html-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/fragments-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/assets-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/configurator-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
```

Esperado: iguais às saídas guardadas (`html-store-check.txt`, `fragments-store-check.txt`, `assets-store-check-t4.txt`, `configurator-store-check-t4.txt` e `generation-store-check-t4.txt`).

- [ ] **Passo 14: Checagens e commit**

```bash
npm run typecheck
npm run lint
npm run format
git add src
git commit -F - <<'EOF'
feat(pages): o esquema mdd-page no processo main, o canal da página e a store da aba

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tarefa 3: A aba Páginas

**Arquivos:**

- Criar: `src/renderer/src/ui/screens/configurator/GenerateButton.tsx`, `src/renderer/src/ui/screens/pages/PageFrame.tsx`, `PageBar.tsx`, `PageProblems.tsx`, `PagesWorkspace.tsx`
- Modificar: `src/renderer/src/ui/screens/configurator/ConfiguratorWorkspace.tsx`, `GenerationBanner.tsx`, `ConfigurationList.tsx`, `src/renderer/src/ui/screens/project/ViewRail.tsx`, `ProjectScreen.tsx`, `src/renderer/src/ui/screens/fragments/FragmentEditor.tsx`, `FragmentsWorkspace.tsx`
- Verificação: `.checks/aba-paginas-ui.mjs` (com o `main-process.mjs` que registra o `shell.openExternal`); regressão da interface

- [ ] **Passo 1: Criar `src/renderer/src/ui/screens/configurator/GenerateButton.tsx`**

O botão sai do `ConfiguratorWorkspace`, para as abas Configurações e Páginas:

@@FILE src/renderer/src/ui/screens/configurator/GenerateButton.tsx@@

- [ ] **Passo 2: O configurador usa o botão e passa a página à faixa, em `src/renderer/src/ui/screens/configurator/ConfiguratorWorkspace.tsx`**

@@EDITS src/renderer/src/ui/screens/configurator/ConfiguratorWorkspace.tsx@@

- [ ] **Passo 3: "Abrir no navegador", em `src/renderer/src/ui/screens/configurator/GenerationBanner.tsx`**

@@EDITS src/renderer/src/ui/screens/configurator/GenerationBanner.tsx@@

- [ ] **Passo 4: A lista só para escolher, em `src/renderer/src/ui/screens/configurator/ConfigurationList.tsx`**

@@EDITS src/renderer/src/ui/screens/configurator/ConfigurationList.tsx@@

- [ ] **Passo 5: Criar `src/renderer/src/ui/screens/pages/PageFrame.tsx`**

@@FILE src/renderer/src/ui/screens/pages/PageFrame.tsx@@

- [ ] **Passo 6: Criar `src/renderer/src/ui/screens/pages/PageBar.tsx`**

@@FILE src/renderer/src/ui/screens/pages/PageBar.tsx@@

- [ ] **Passo 7: Criar `src/renderer/src/ui/screens/pages/PageProblems.tsx`**

@@FILE src/renderer/src/ui/screens/pages/PageProblems.tsx@@

- [ ] **Passo 8: Criar `src/renderer/src/ui/screens/pages/PagesWorkspace.tsx`**

@@FILE src/renderer/src/ui/screens/pages/PagesWorkspace.tsx@@

- [ ] **Passo 9: A aba, em `src/renderer/src/ui/screens/project/ViewRail.tsx`**

@@EDITS src/renderer/src/ui/screens/project/ViewRail.tsx@@

E em `src/renderer/src/ui/screens/project/ProjectScreen.tsx`:

@@EDITS src/renderer/src/ui/screens/project/ProjectScreen.tsx@@

- [ ] **Passo 10: A linha pedida pela aba Páginas, em `src/renderer/src/ui/screens/fragments/FragmentEditor.tsx`**

@@EDITS src/renderer/src/ui/screens/fragments/FragmentEditor.tsx@@

E em `src/renderer/src/ui/screens/fragments/FragmentsWorkspace.tsx`:

@@EDITS src/renderer/src/ui/screens/fragments/FragmentsWorkspace.tsx@@

- [ ] **Passo 11: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: os dois sem erro.

- [ ] **Passo 12: O `.checks/main-process.mjs` registra também o `shell.openExternal`**

O arquivo inteiro:

@@FILE .checks/main-process.mjs@@

- [ ] **Passo 13: Escrever o roteiro `.checks/aba-paginas-ui.mjs`**

@@FILE .checks/aba-paginas-ui.mjs@@

- [ ] **Passo 14: Rodar os roteiros de interface** (combine com o usuário: abrem janelas na tela dele)

```bash
npm run build
EXAMPLE=herby bash .checks/run-ui.sh dev .checks/aba-paginas-ui.mjs 9229
```

Esperado:

@@OUT aba-paginas-ui@@

Regressão, uma rodada por vez, com uns segundos de pausa:

```bash
EXAMPLE=herby bash .checks/run-ui.sh dev .checks/paginas-ui.mjs 9229
bash .checks/run-ui.sh dev .checks/fragmentos-ui.mjs 9229
bash .checks/run-ui.sh dev .checks/geracao-ui.mjs 9229
bash .checks/run-ui.sh dev .checks/assets-ui.mjs 9229
bash .checks/run-ui.sh dev .checks/configurador-ui.mjs
bash .checks/run-ui.sh dev .checks/ui-check.mjs
```

Esperado: as saídas das fases anteriores (`fragmentos-ui-f7.txt`, `geracao-ui.txt`, `assets-ui.txt`, `configurador-ui.txt` e `ui-check.txt`). O `paginas-ui.mjs` só muda na faixa verde, que ganha "Abrir no navegador":

@@OUT paginas-ui-f8@@

- [ ] **Passo 15: Commit**

```bash
npm run format
git add src/renderer/src
git commit -F - <<'EOF'
feat(ui): aba Páginas, com a página ao vivo num quadro isolado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tarefa 4: Aceitação no app empacotado e documentação

**Arquivos:**

- Criar: `docs/adr/0011-visualizacao-da-pagina-isolada.md`
- Modificar: `CONTEXT.md`, `docs/SPEC.md`, `docs/HANDOFF.md`

- [ ] **Passo 1: Gerar o instalador**

```bash
npm run build:win
```

Esperado: `building target=nsis file=dist\mdd-0.1.0-setup.exe`, só com os avisos de `eval` do `logic-solver`.

- [ ] **Passo 2: O roteiro no `mdd.exe`** (combine com o usuário)

```bash
EXAMPLE=herby bash .checks/run-ui.sh dist/win-unpacked/mdd.exe .checks/aba-paginas-ui.mjs 9229
```

Esperado: a mesma saída do Passo 14 da Tarefa 3. Ela confirma o esquema, o sandbox e o script da visualização dentro do `app.asar`.

- [ ] **Passo 3: Checagem à mão com o usuário**

Com o `dist/win-unpacked/mdd.exe` e uma cópia do exemplo em `.checks/aceitacao-herby` (`cp -r docs/examples/herby .checks/aceitacao-herby`), o usuário:

1. abre a aba Páginas e escolhe "Completa Atibaia": a página aparece, com a capa, o sumário e as imagens;
2. troca as larguras (Celular, Tablet, Largura toda) e vê a página se ajustar;
3. rola até o meio, vai à aba Fragmentos, edita um fragmento sem salvar e volta: a página mostra o texto novo, na mesma altura;
4. clica num link da página que aponta para fora (o site no rodapé): ele abre no navegador do sistema, e a página fica.

- [ ] **Passo 4: O ADR 0011, `docs/adr/0011-visualizacao-da-pagina-isolada.md`**

@@FILE docs/adr/0011-visualizacao-da-pagina-isolada.md@@

- [ ] **Passo 5: O termo novo, em `CONTEXT.md`**

@@EDITS CONTEXT.md@@

- [ ] **Passo 6: A Fase 8 na SPEC, em `docs/SPEC.md`**

@@EDITS docs/SPEC.md@@

- [ ] **Passo 7: Commit da documentação**

```bash
npm run format
git add CONTEXT.md docs/SPEC.md docs/adr/0011-visualizacao-da-pagina-isolada.md
git commit -F - <<'EOF'
docs: SPEC, ADR 0011 e CONTEXT registram a Fase 8

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Passo 8: O handoff**

Em `docs/HANDOFF.md`: a Fase 8 na tabela, uma seção "Aceitação da Fase 8" com os roteiros, o `mdd.exe` e a checagem à mão, e o próximo passo. Commit `docs: handoff registra a aceitação da Fase 8`.
