# Fase 7 — Páginas HTML: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** escrever fragmentos em HTML e gerar, para cada configuração completa, a página `saida/<nome>/index.html`: a moldura do projeto com as seções das features selecionadas, os valores dos atributos no texto (marcadores), o sumário e os arquivos que a página cita. O XML continua como está. O exemplo da fase é o **herby**, o projeto real do usuário, convertido de XML para HTML.

**Arquitetura:**

- **Domínio** (puro): o formato do fragmento pela extensão (`fragment-format.ts`) e a pasta `domain/pages/`: os nomes da moldura e da página (`page-layout.ts`), os marcadores (`markers.ts`), os caminhos citados (`page-paths.ts`) e a montagem das seções e do sumário (`page-assembly.ts`). O plano da geração passa a dizer se há página e a levar os atributos do modelo.
- **Aplicação:** o `CombinedProductDeriver`, que junta o `product.xml` e a página, e o `FragmentCheckerByFormat`, que escolhe o checker pela extensão. As portas não mudam.
- **Infraestrutura:** a pasta `infrastructure/html/`, com o **parse5**: a leitura do HTML (`html-source.ts`), a conferência (`HtmlFragmentChecker`) e a página (`HtmlPageDeriver`). O `XmlProductDeriver` passa a ignorar os fragmentos `.html`.
- **Interface:** o editor de fragmentos abre `.html`, com a cor e a sugestão dos marcadores; a store confere os IDs dos marcadores contra o modelo; a barra mostra a moldura.
- **Processo main e IPC:** nada muda.

**Stack:** a das fases anteriores, mais o `parse5` (Tarefa 2) e o `@codemirror/lang-html` e o `@codemirror/autocomplete` (Tarefa 4).

**Spec:** [docs/superpowers/specs/2026-09-28-fase-7-paginas-html-design.md](../specs/2026-09-28-fase-7-paginas-html-design.md) (o desenho aprovado, com o que o protótipo respondeu) e [docs/SPEC.md](../../SPEC.md): §4.4 (a geração), §6 (arquitetura), §7 (interface), §8 e §9. Veja também os ADRs [0006](../../adr/0006-geracao-agnostica-de-vocabulario.md), [0008](../../adr/0008-camadas-com-lint-sem-testes.md) e [0009](../../adr/0009-editor-de-fragmentos-com-codemirror.md); o ADR 0010 é escrito na Tarefa 5.

## Restrições globais

- **Sem testes automatizados** (ADR 0008).
  - Cada tarefa verifica com `npm run typecheck`, `npm run lint` e scripts descartáveis em `.checks/`.
  - `.checks/` fica fora do git, do ESLint e do Prettier.
  - Os scripts `.mts` rodam com `npx tsx --tsconfig tsconfig.web.json`, por causa do alias `@/`. Os `.mjs` rodam com `node`.
- **Roteiros das fases anteriores** que este plano usa: `cdp.mjs` (2B), `ui-check.mjs` (2A, com as mudanças da 2B), `quit.mjs`, `configurations-check.mts`, `configurador-ui.mjs` e `configurator-store-check.mts` (Fase 3, este com os serviços da Fase 4), `save-safety-check.mts` (correções da Fase 3), `main-process.mjs`, `run-ui.sh`, `assets-ui.mjs` e `assets-store-check.mts` (Fase 4), `generation-support.mts`, `generation-plan-check.mts`, `fragment-source-check.mts` e `geracao-ui.mjs` (Fase 5), `generate-product-check.mts` e `generation-store-check.mts` (correções da Fase 5), `memory-folder.mts`, `fragment-checker-check.mts`, `fragments-store-check.mts` e `fragmentos-ui.mjs` (Fase 6). Mais rápido que recriá-los: `git archive origin/prototipo-fase-7 .checks | tar -x` traz todos, inclusive os desta fase, com as saídas conferidas em `.checks/out/`.
- **Camadas** (SPEC §6.1): `domain/` não importa nada de fora dele; `application/` só `domain/`; só `ui/app/` conhece `infrastructure/`. O lint barra violações.
- **Imports:** dentro de `domain/`, relativos; nas demais camadas, alias `@/`.
- **Idioma:** identificadores em inglês; textos da interface, mensagens, comentários e documentação em português.
- **Regras do lint:** toda função tem tipo de retorno explícito; as regras de hooks do React 19 estão ligadas; um `.tsx` só exporta componentes; `no-control-regex` (por isso o `page-paths.ts` confere os caracteres pelo código, e não por uma regex com `\u0000`).
- **O parse5 fica em `infrastructure/html/`**, e o CodeMirror, em `ui/screens/fragments/`.
- **O herby original**, em `C:\Users\lucas\Desktop\herby`, é só lido pela conversão (Tarefa 3). Ele não está no git: **nunca o altere**.
- **`package.json`:** muda em duas tarefas, pelos comandos `npm install` de cada uma, e não por trechos.
- **Commits:** rode `npm run format` antes de cada commit. Os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Shell:** todo comando roda na raiz do repositório com **Git Bash**, no branch `fase-7-paginas-html`.
- **Roteiros de interface abrem janelas na tela do usuário:** combine o momento com ele antes. Para fechar o app, use `.checks/quit.mjs`. Entre duas rodadas do `run-ui.sh`, espere uns segundos (as portas 9229 e 9333 ficam em `TIME_WAIT`).

## O que o protótipo respondeu

O código deste plano foi prototipado e verificado numa cópia descartável do repositório (branch `prototipo-fase-7`, que também guarda os roteiros). Depois, cada tarefa foi aplicada sozinha, em ordem, sobre o commit `e3c0c18` (o último da `main` antes do código): os roteiros novos dela falharam antes e deram a saída deste plano depois, e o typecheck e o lint passaram. No fim, o `src/`, o `package.json`, o `package-lock.json` e o exemplo `docs/examples/herby/` ficaram idênticos aos do protótipo.

**O que mudou no desenho** (já está na spec do desenho, em "O que o protótipo respondeu"):

1. **O parse5 não acusa as tags que descarta.** Um `</section>` a mais, um `<td>` fora da tabela e o `<body>` de um fragmento somem da árvore sem erro. O `html-source.ts` as acha pelo que a árvore não cobre: os trechos fora de todo nó e, dentro de um texto, um `<` seguido de letra, `/` ou `!` (o parse5 junta dois textos vizinhos num só, e o trecho do texto passa por cima da tag descartada). O começo de uma tag da árvore não conta: o texto depois do `</body>` de uma moldura vai para dentro do `body` e passa por cima dele.
2. **Um marcador só vale no valor de um atributo**, depois do `=`. No nome (`<p {{a.b}}>`), o parser o leria como um atributo com esse nome.
3. **Nos comentários, os marcadores também são trocados e conferidos**, como no texto. Assim a conferência dos IDs contra o modelo (`modelMarkerProblems`) não precisa ler o HTML.
4. **A fonte de sugestões do editor é a mesma função durante todo o estado.** O CodeMirror reconhece a fonte pela identidade, e uma função nova a cada consulta fazia ele descartar a resposta: a lista não aparecia ao digitar.
5. **Os arquivos citados são conferidos também num fragmento que já tem outro problema**, para a geração listar tudo de uma vez. Um arquivo citado com o nome `index.html` ou `product.xml` na raiz é problema com a linha; um recurso com esse nome, no `CombinedProductDeriver`.

**Achados ao aplicar as tarefas:**

6. O `herby-open-check.mts` sai com código 1 quando o projeto não abre, para falhar antes da Tarefa 3.
7. Antes da Tarefa 4, o `html-store-check.mts` roda, mas com outra saída: a store ainda não confere os IDs dos marcadores e o aviso diz "de XML". O Passo 2 da Tarefa 4 mostra a diferença.

**Resultados no protótipo:** as 13 configurações do herby geram sem problema, e a página não tem rolagem lateral nem em 375 px. Os roteiros de interface das Fases 2A a 6 (`ui-check`, `configurador-ui`, `assets-ui`, `geracao-ui` e `fragmentos-ui`) saíram iguais aos das fases anteriores, com uma única diferença prevista: a dica "terminando em .xml ou .html" no diálogo de fragmento novo. O `diagrama-ui.mjs` (2B) não foi rodado: a fase não mexe no diagrama. O `paginas-ui.mjs` deu a mesma saída no modo de desenvolvimento e no `mdd.exe`: o parse5 e o `lang-html` rodam dentro do `app.asar`, com a CSP atual.

## Mapa de arquivos

| Arquivo                                                                                             | Responsabilidade                                                        |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `domain/fragments/fragment-format.ts`                                                               | O formato pela extensão e o texto de um fragmento novo                  |
| `domain/pages/page-layout.ts`                                                                       | `moldura.html`, `index.html`, `product.xml` e a moldura padrão          |
| `domain/pages/markers.ts`                                                                           | Os marcadores: achar, conferir contra o modelo, contar e resolver       |
| `domain/pages/page-paths.ts`                                                                        | Os caminhos citados e o endereço na página                              |
| `domain/pages/page-assembly.ts`                                                                     | O escape do HTML, as seções e o sumário                                 |
| `domain/shared/text-lines.ts`                                                                       | A linha de uma posição no texto                                         |
| `domain/fragments/fragment-path.ts`, `domain/assets/asset-edits.ts`                                 | `.html` na árvore, no caminho novo e no tipo sugerido                   |
| `domain/feature-model/traversal.ts`, `domain/generation/generation-plan.ts`                         | `attributeIdsByFeature`; `hasPage` e `modelAttributes` no plano         |
| `application/fragments/fragment-document.ts`                                                        | O texto inicial pelo formato                                            |
| `application/generation/combined-product-deriver.ts`                                                | Os dois formatos do produto juntos                                      |
| `application/fragments/fragment-checker-by-format.ts`                                               | O checker pela extensão                                                 |
| `infrastructure/html/html-source.ts`, `html-fragment-checker.ts`, `html-page-deriver.ts`            | A leitura com o parse5, a conferência e a página                        |
| `infrastructure/xml/xml-product-deriver.ts`                                                         | Ignora os fragmentos `.html`                                            |
| `ui/app/composition-root.ts`                                                                        | Injeta o deriver e o checker compostos                                  |
| `ui/screens/fragments/fragment-editor-setup.ts` (era `xml-editor-setup.ts`)                         | A linguagem pela extensão, a cor e a sugestão dos marcadores            |
| `ui/screens/fragments/FragmentEditor.tsx`, `FragmentsWorkspace.tsx`, `FragmentBar.tsx`, `FragmentDialogs.tsx` | Os marcadores do modelo, o texto sem arquivo, a moldura e a dica |
| `ui/stores/fragments-actions.ts`, `ui/app/index.css`                                                | Os IDs dos marcadores contra o modelo, o aviso e as cores               |
| `docs/examples/herby/`, `docs/examples/produto-esperado/herby-completa-atibaia/`                    | O exemplo da fase e a página esperada                                   |
| `docs/adr/0010-paginas-html-como-segunda-saida.md`, `CONTEXT.md`, `docs/SPEC.md`                    | A documentação                                                          |

(Os caminhos de código ficam em `src/renderer/src/`.)

---

### Tarefa 1: Domínio — formato do fragmento, marcadores, caminhos e montagem da página

**Arquivos:**

- Criar: `src/renderer/src/domain/pages/page-layout.ts`, `src/renderer/src/domain/fragments/fragment-format.ts`, `src/renderer/src/domain/shared/text-lines.ts`, `src/renderer/src/domain/pages/markers.ts`, `src/renderer/src/domain/pages/page-paths.ts`, `src/renderer/src/domain/pages/page-assembly.ts`
- Modificar: `src/renderer/src/domain/fragments/fragment-path.ts`, `src/renderer/src/domain/assets/asset-edits.ts`, `src/renderer/src/application/fragments/fragment-document.ts`, `src/renderer/src/domain/feature-model/traversal.ts`, `src/renderer/src/domain/generation/generation-plan.ts`
- Verificação: `.checks/markers-check.mts`, `.checks/page-paths-check.mts`, `.checks/fragment-path-check.mts` (com os casos novos); regressão com `.checks/generation-plan-check.mts` e `.checks/configurations-check.mts`

**Interfaces:**

- Consome: `Result`, `ok`, `err`, `folderOf`, `featuresInPreOrder`, os tipos do plano da geração.
- Produz:
  - `FRAME_PATH`, `PAGE_PATH`, `PRODUCT_PATH`, `DEFAULT_FRAME` e `isFramePath(path)` (`page-layout.ts`)
  - `FragmentFormat`, `fragmentFormat(path): FragmentFormat | null` e `initialFragmentText(path)` (`fragment-format.ts`)
  - `lineAt(text, offset)` (`text-lines.ts`)
  - `Marker`, `MarkerTarget`, `MarkerRole`, `MarkerProblem`, `findMarkers(text)`, `markerLabel(target)`, `markerIdProblem(target, modelAttributes)`, `modelMarkerProblems(text, modelAttributes)`, `frameCountProblems(markers)` e `markerValue(target, plan)` (`markers.ts`)
  - `URL_ATTRIBUTES`, `CitedUrl`, `resolveCitedUrl(fromFile, url)`, `pageUrl(path, suffix)`, `srcsetCandidates(value)` e `formatSrcset(candidates)` (`page-paths.ts`)
  - `escapeHtmlText`, `escapeHtmlAttribute`, `htmlFragmentsOf(section)`, `planHtmlFragments(section)`, `sectionsHtml(section, textOf)` e `tableOfContents(plan)` (`page-assembly.ts`)
  - `attributeIdsByFeature(root)` (`traversal.ts`); `GenerationPlan.hasPage` e `GenerationPlan.modelAttributes`

- [ ] **Passo 1: Conferir o branch**

```bash
git switch fase-7-paginas-html
git status --short
git log --oneline -3
```

Esperado: nada pendente; o último commit é o deste plano, sobre o `e3c0c18`.

- [ ] **Passo 2: Escrever o roteiro `.checks/markers-check.mts`**

A sintaxe dos marcadores, o escape, os espaços, os IDs contra o modelo, a contagem da moldura e os valores contra um plano.

@@FILE .checks/markers-check.mts@@

- [ ] **Passo 3: Escrever o roteiro `.checks/page-paths-check.mts`**

Os caminhos citados: relativos, com `?` e `#`, com espaço, saindo do projeto, começando com `/`, os que ficam como estão, e o `srcset`.

@@FILE .checks/page-paths-check.mts@@

- [ ] **Passo 4: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/markers-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/page-paths-check.mts
```

Esperado: os dois falham com `ERR_MODULE_NOT_FOUND` (os módulos de `domain/pages/` não existem).

- [ ] **Passo 5: Criar `src/renderer/src/domain/pages/page-layout.ts`**

@@FILE src/renderer/src/domain/pages/page-layout.ts@@

- [ ] **Passo 6: Criar `src/renderer/src/domain/fragments/fragment-format.ts`**

@@FILE src/renderer/src/domain/fragments/fragment-format.ts@@

- [ ] **Passo 7: Criar `src/renderer/src/domain/shared/text-lines.ts`**

@@FILE src/renderer/src/domain/shared/text-lines.ts@@

- [ ] **Passo 8: Criar `src/renderer/src/domain/pages/markers.ts`**

@@FILE src/renderer/src/domain/pages/markers.ts@@

- [ ] **Passo 9: Criar `src/renderer/src/domain/pages/page-paths.ts`**

@@FILE src/renderer/src/domain/pages/page-paths.ts@@

- [ ] **Passo 10: Criar `src/renderer/src/domain/pages/page-assembly.ts`**

@@FILE src/renderer/src/domain/pages/page-assembly.ts@@

- [ ] **Passo 11: `.html` nos caminhos de fragmento, em `src/renderer/src/domain/fragments/fragment-path.ts`**

@@EDITS src/renderer/src/domain/fragments/fragment-path.ts@@

- [ ] **Passo 12: `.html` sugerido como fragmento, em `src/renderer/src/domain/assets/asset-edits.ts`**

@@EDITS src/renderer/src/domain/assets/asset-edits.ts@@

- [ ] **Passo 13: O texto inicial pelo formato, em `src/renderer/src/application/fragments/fragment-document.ts`**

@@EDITS src/renderer/src/application/fragments/fragment-document.ts@@

- [ ] **Passo 14: `attributeIdsByFeature`, em `src/renderer/src/domain/feature-model/traversal.ts`**

@@EDITS src/renderer/src/domain/feature-model/traversal.ts@@

- [ ] **Passo 15: A página no plano, em `src/renderer/src/domain/generation/generation-plan.ts`**

@@EDITS src/renderer/src/domain/generation/generation-plan.ts@@

- [ ] **Passo 16: Os casos `.html`, `.htm` e `moldura.html` no `.checks/fragment-path-check.mts`**

@@FILE .checks/fragment-path-check.mts@@

- [ ] **Passo 17: Rodar os roteiros**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/markers-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/page-paths-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/fragment-path-check.mts
```

Esperado, `markers-check.mts`:

@@OUT markers-check@@

Esperado, `page-paths-check.mts`:

@@OUT page-paths-check@@

Esperado, `fragment-path-check.mts` (a saída da Fase 6, com os seis casos novos e a mensagem "precisa terminar em .xml ou .html"):

@@OUT fragment-path-check-f7@@

- [ ] **Passo 18: Regressão do plano da geração e da leitura**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generation-plan-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/configurations-check.mts
```

Esperado: as saídas dos planos das Fases 5 e 3, iguais às de antes da tarefa. O `generation-plan-check.mts`:

@@OUT generation-plan-check-base@@

- [ ] **Passo 19: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: os dois sem erro.

- [ ] **Passo 20: Commit**

```bash
npm run format
git add src/renderer/src/domain src/renderer/src/application/fragments/fragment-document.ts
git commit -F - <<'EOF'
feat(domain): formato do fragmento, marcadores, caminhos e montagem da página

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tarefa 2: A página — parse5, a conferência e o `HtmlPageDeriver`

**Arquivos:**

- Criar: `src/renderer/src/infrastructure/html/html-source.ts`, `src/renderer/src/infrastructure/html/html-fragment-checker.ts`, `src/renderer/src/infrastructure/html/html-page-deriver.ts`, `src/renderer/src/application/generation/combined-product-deriver.ts`, `src/renderer/src/application/fragments/fragment-checker-by-format.ts`
- Modificar: `package.json` e `package-lock.json` (pelo `npm install`), `src/renderer/src/infrastructure/xml/xml-product-deriver.ts`, `src/renderer/src/ui/app/composition-root.ts`
- Verificação: `.checks/html-checker-check.mts`, `.checks/html-page-check.mts`; regressão com `.checks/generate-product-check.mts`, `.checks/fragment-checker-check.mts` e `.checks/fragment-source-check.mts`

**Interfaces:**

- Consome: tudo o que a Tarefa 1 produz; as portas `ProductDeriver`, `FragmentChecker` e `ProjectStorage`; `encodingProblem`.
- Produz:
  - `readHtmlSource(text, role, markers): HtmlSource`, com `problems`, `places`, `attributes`, `headEnd` e `bodyEnd` (`html-source.ts`)
  - `inspectHtml(path, content)`, `HtmlFragmentChecker` e `problemAt(file, text, problem, subject?)` (`html-fragment-checker.ts`)
  - `HtmlPageDeriver(storage)` (`html-page-deriver.ts`)
  - `CombinedProductDeriver(derivers)` e `FragmentCheckerByFormat({ xml, html })`

- [ ] **Passo 1: Escrever o roteiro `.checks/html-checker-check.mts`**

A conferência de um fragmento HTML e da moldura, como o editor a mostra.

@@FILE .checks/html-checker-check.mts@@

- [ ] **Passo 2: Escrever o roteiro `.checks/html-page-check.mts`**

A página montada num projeto pequeno em memória, e todos os problemas de uma vez.

@@FILE .checks/html-page-check.mts@@

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/html-checker-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/html-page-check.mts
```

Esperado: os dois falham com `ERR_MODULE_NOT_FOUND` (`infrastructure/html/` não existe).

- [ ] **Passo 4: Instalar o parse5**

```bash
npm install parse5@^8.0.1
```

Esperado: o `package.json` ganha `"parse5": "^8.0.1"` nas dependências.

- [ ] **Passo 5: Criar `src/renderer/src/infrastructure/html/html-source.ts`**

@@FILE src/renderer/src/infrastructure/html/html-source.ts@@

- [ ] **Passo 6: Criar `src/renderer/src/infrastructure/html/html-fragment-checker.ts`**

@@FILE src/renderer/src/infrastructure/html/html-fragment-checker.ts@@

- [ ] **Passo 7: Criar `src/renderer/src/infrastructure/html/html-page-deriver.ts`**

@@FILE src/renderer/src/infrastructure/html/html-page-deriver.ts@@

- [ ] **Passo 8: Criar `src/renderer/src/application/generation/combined-product-deriver.ts`**

@@FILE src/renderer/src/application/generation/combined-product-deriver.ts@@

- [ ] **Passo 9: Criar `src/renderer/src/application/fragments/fragment-checker-by-format.ts`**

@@FILE src/renderer/src/application/fragments/fragment-checker-by-format.ts@@

- [ ] **Passo 10: O `product.xml` sem os fragmentos HTML, em `src/renderer/src/infrastructure/xml/xml-product-deriver.ts`**

@@EDITS src/renderer/src/infrastructure/xml/xml-product-deriver.ts@@

- [ ] **Passo 11: Injetar o deriver e o checker compostos, em `src/renderer/src/ui/app/composition-root.ts`**

@@EDITS src/renderer/src/ui/app/composition-root.ts@@

- [ ] **Passo 12: Rodar os roteiros**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/html-checker-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/html-page-check.mts
```

Esperado, `html-checker-check.mts`:

@@OUT html-checker-check@@

Esperado, `html-page-check.mts`:

@@OUT html-page-check@@

- [ ] **Passo 13: Regressão da geração e da conferência de XML**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/fragment-checker-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/fragment-source-check.mts
```

Esperado: as mesmas saídas da Fase 6 (`generate-product-t2.txt`, `fragment-checker-check.txt` e `fragment-source-t2.txt` em `.checks/out/`). O `generate-product-check.mts` abre um PowerShell escondido por alguns segundos.

- [ ] **Passo 14: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: os dois sem erro.

- [ ] **Passo 15: Commit**

```bash
npm run format
git add package.json package-lock.json src/renderer/src
git commit -F - <<'EOF'
feat(generation): a página index.html dos fragmentos HTML, com a moldura e os marcadores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tarefa 3: O exemplo herby

**Arquivos:**

- Criar: `docs/examples/herby/` (pela conversão, mais a `moldura.html` e o `css/herby.css`, escritos à mão) e `docs/examples/produto-esperado/herby-completa-atibaia/index.html`
- Modificar: `.prettierignore`
- Verificação: `.checks/herby-convert.mts`, `.checks/herby-open-check.mts`, `.checks/herby-generate.mts`

**Interfaces:**

- Consome: os codecs, o `validateFeatureModel`, o `configurationKey`, o `ResolveConfiguration` e, para gerar, o `CombinedProductDeriver` e o `HtmlPageDeriver` da Tarefa 2.
- Produz: o projeto de exemplo, com 23 fragmentos `.html`, 30 assets e 13 configurações.

- [ ] **Passo 1: Escrever o roteiro `.checks/herby-convert.mts`**

A conversão do herby original (só leitura) para `docs/examples/herby/`: o modelo com as variáveis como atributos, os fragmentos em HTML, os assets e uma configuração por perfil. O modo `tabela` só mostra a tabela perfil × features e o estado de cada configuração.

@@FILE .checks/herby-convert.mts@@

- [ ] **Passo 2: Escrever o roteiro `.checks/herby-open-check.mts`**

@@FILE .checks/herby-open-check.mts@@

- [ ] **Passo 3: Escrever o roteiro `.checks/herby-generate.mts`**

Gera uma configuração numa cópia do exemplo, pelo `GenerateProduct`, e compara a página com a esperada.

@@FILE .checks/herby-generate.mts@@

- [ ] **Passo 4: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/herby-open-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/herby-generate.mts completa-atibaia
```

Esperado: o primeiro sai com código 1 (o projeto não abre: a pasta não existe), e o segundo falha com `ENOENT`.

- [ ] **Passo 5: A tabela de perfis**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/herby-convert.mts tabela
```

Esperado: a tabela que o usuário conferiu em 28/09/2026, com as 13 configurações completas e nenhuma nota de divergência:

@@OUT herby-convert-tabela@@

- [ ] **Passo 6: Converter**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/herby-convert.mts gravar
```

Esperado:

```
gravado: 23 fragmentos, 13 configurações, 85 imagens, 20 arquivos de slides
falta escrever à mão: moldura.html
falta escrever à mão: css/herby.css
```

- [ ] **Passo 7: Criar `docs/examples/herby/moldura.html`**

<!-- prettier-ignore -->
@@FILE docs/examples/herby/moldura.html@@

- [ ] **Passo 8: Criar `docs/examples/herby/css/herby.css`**

<!-- prettier-ignore -->
@@FILE docs/examples/herby/css/herby.css@@

E o exemplo fora do Prettier, em `.prettierignore`: os arquivos dele são dados, comparados byte a byte, e o `npm run format` reformataria o HTML e o CSS (o XML dos exemplos escapava só porque o Prettier não formata XML).

@@EDITS .prettierignore@@

- [ ] **Passo 9: Gerar a página esperada**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/herby-generate.mts completa-atibaia
mkdir -p docs/examples/produto-esperado/herby-completa-atibaia
cp .checks/geracao/herby/saida/completa-atibaia/index.html docs/examples/produto-esperado/herby-completa-atibaia/index.html
```

Esperado: `completa-atibaia: generated`, com 60 arquivos.

- [ ] **Passo 10: Rodar os roteiros**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/herby-open-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/herby-generate.mts completa-atibaia
```

Esperado, `herby-open-check.mts`:

@@OUT herby-open-check@@

Esperado, `herby-generate.mts`:

@@OUT herby-generate@@

- [ ] **Passo 11: Conferir contra o protótipo**

```bash
git add docs/examples .prettierignore
git diff --cached --stat origin/prototipo-fase-7 -- docs/examples
npx prettier --check .
```

Esperado: nenhuma diferença para o protótipo (a conversão, a moldura, o CSS e a página esperada são os dele), e o Prettier sem nada a formatar.

- [ ] **Passo 12: Commit**

```bash
git commit -F - <<'EOF'
docs: exemplo herby, convertido de XML para HTML, com a saída esperada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tarefa 4: A aba Fragmentos com HTML

**Arquivos:**

- Renomear e reescrever: `src/renderer/src/ui/screens/fragments/xml-editor-setup.ts` → `fragment-editor-setup.ts`
- Modificar: `package.json` e `package-lock.json` (pelo `npm install`), `src/renderer/src/ui/screens/fragments/FragmentEditor.tsx`, `FragmentsWorkspace.tsx`, `FragmentBar.tsx`, `FragmentDialogs.tsx`, `src/renderer/src/ui/stores/fragments-actions.ts`, `src/renderer/src/ui/app/index.css`
- Verificação: `.checks/html-store-check.mts`; regressão das stores; os roteiros de interface `.checks/paginas-ui.mjs` (novo, com o `run-ui.sh` que aceita o herby) e os das fases anteriores

**Interfaces:**

- Consome: `fragmentFormat`, `isFramePath`, `modelMarkerProblems`, `attributeIdsByFeature`, `lineAt`, `featuresInPreOrder` e o `FragmentCheckerByFormat` da Tarefa 2.
- Produz: `createFragmentEditorState(path, text, options)` e `FragmentEditorOptions` (com `attributeMarkers`), no lugar do `createXmlEditorState`.

- [ ] **Passo 1: Escrever o roteiro `.checks/html-store-check.mts`**

A aba Fragmentos com HTML numa pasta em memória: a conferência por formato, os IDs dos marcadores contra o modelo (conferidos de novo quando o modelo muda), o texto inicial de um `.html` e da moldura, e o aviso ao salvar com erro.

@@FILE .checks/html-store-check.mts@@

- [ ] **Passo 2: Rodar e ver a diferença**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/html-store-check.mts
```

Esperado: o roteiro roda, mas a store ainda não confere os IDs dos marcadores, e o aviso diz "de XML". Comparado com a saída do Passo 10:

```
2c2
< problemas do .html                   → linha 2 A feature carrinho não existe no modelo.
---
> problemas do .html                   → ok
6,7c6,7
< problemas do .html                   → linha 1 A feature loja não tem o atributo versao. | linha 2 A feature carrinho não existe no modelo.
< depois de desfazer                   → linha 2 A feature carrinho não existe no modelo.
---
> problemas do .html                   → ok
> depois de desfazer                   → ok
15c15
< aviso                                → Salvo com erro de HTML: A tag <div> é aberta aqui e não é fechada neste arquivo.
---
> aviso                                → Salvo com erro de XML: A tag <div> é aberta aqui e não é fechada neste arquivo.
```

- [ ] **Passo 3: Instalar o realce de HTML e a sugestão**

```bash
npm install @codemirror/lang-html@^6.4.12 @codemirror/autocomplete@^6.20.3
```

- [ ] **Passo 4: `git mv` e reescrever `src/renderer/src/ui/screens/fragments/fragment-editor-setup.ts`**

```bash
git mv src/renderer/src/ui/screens/fragments/xml-editor-setup.ts src/renderer/src/ui/screens/fragments/fragment-editor-setup.ts
```

O arquivo inteiro:

@@FILE src/renderer/src/ui/screens/fragments/fragment-editor-setup.ts@@

- [ ] **Passo 5: O editor pelo caminho, em `src/renderer/src/ui/screens/fragments/FragmentEditor.tsx`**

@@EDITS src/renderer/src/ui/screens/fragments/FragmentEditor.tsx@@

- [ ] **Passo 6: Os marcadores do modelo e o texto sem arquivo, em `src/renderer/src/ui/screens/fragments/FragmentsWorkspace.tsx`**

@@EDITS src/renderer/src/ui/screens/fragments/FragmentsWorkspace.tsx@@

- [ ] **Passo 7: A moldura na barra, em `src/renderer/src/ui/screens/fragments/FragmentBar.tsx`**

@@EDITS src/renderer/src/ui/screens/fragments/FragmentBar.tsx@@

- [ ] **Passo 8: A dica do caminho, em `src/renderer/src/ui/screens/fragments/FragmentDialogs.tsx`**

@@EDITS src/renderer/src/ui/screens/fragments/FragmentDialogs.tsx@@

- [ ] **Passo 9: Os IDs dos marcadores e o aviso, em `src/renderer/src/ui/stores/fragments-actions.ts`**

@@EDITS src/renderer/src/ui/stores/fragments-actions.ts@@

E o comentário das cores, em `src/renderer/src/ui/app/index.css`:

@@EDITS src/renderer/src/ui/app/index.css@@

- [ ] **Passo 10: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/html-store-check.mts
```

Esperado:

@@OUT html-store-check@@

- [ ] **Passo 11: Regressão das stores**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragments-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/assets-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/configurator-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
```

Esperado: iguais às saídas da Fase 6 (`fragments-store-check.txt`, `assets-store-check-t4.txt`, `configurator-store-check-t4.txt` e `generation-store-check-t4.txt` em `.checks/out/`).

- [ ] **Passo 12: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: os dois sem erro.

- [ ] **Passo 13: O `run-ui.sh` aceita o exemplo herby**

Com `EXAMPLE=herby`, a cópia é do herby, em `.checks/herby-ui`. O arquivo inteiro:

@@FILE .checks/run-ui.sh@@

- [ ] **Passo 14: Escrever o roteiro `.checks/paginas-ui.mjs`**

@@FILE .checks/paginas-ui.mjs@@

- [ ] **Passo 15: Rodar os roteiros de interface** (combine com o usuário: abrem janelas na tela dele)

```bash
npm run build
EXAMPLE=herby bash .checks/run-ui.sh dev .checks/paginas-ui.mjs 9229
```

Esperado:

@@OUT paginas-ui@@

Regressão, uma rodada por vez, com uns segundos de pausa:

```bash
bash .checks/run-ui.sh dev .checks/fragmentos-ui.mjs 9229
bash .checks/run-ui.sh dev .checks/geracao-ui.mjs 9229
bash .checks/run-ui.sh dev .checks/assets-ui.mjs 9229
bash .checks/run-ui.sh dev .checks/configurador-ui.mjs
bash .checks/run-ui.sh dev .checks/ui-check.mjs
```

Esperado: as mesmas saídas das fases anteriores, com uma única diferença, na linha 27 do `fragmentos-ui.mjs`, onde a dica do diálogo passa a dizer "terminando em .xml ou .html":

@@OUT fragmentos-ui-f7@@

- [ ] **Passo 16: Commit**

```bash
npm run format
git add package.json package-lock.json src/renderer/src
git commit -F - <<'EOF'
feat(ui): fragmentos HTML na aba Fragmentos, com os marcadores e a moldura

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tarefa 5: Aceitação no app empacotado e documentação

**Arquivos:**

- Criar: `docs/adr/0010-paginas-html-como-segunda-saida.md`
- Modificar: `CONTEXT.md`, `docs/SPEC.md`, `docs/HANDOFF.md`

- [ ] **Passo 1: Gerar o instalador**

```bash
npm run build:win
```

Esperado: `building target=nsis file=dist\mdd-0.1.0-setup.exe`, só com os três avisos de `eval` do `logic-solver`.

- [ ] **Passo 2: O roteiro no `mdd.exe`** (combine com o usuário)

```bash
EXAMPLE=herby bash .checks/run-ui.sh dist/win-unpacked/mdd.exe .checks/paginas-ui.mjs 9229
```

Esperado: a mesma saída do Passo 15 da Tarefa 4. Ela confirma que o parse5 e o `lang-html` rodam dentro do `app.asar`, com a CSP.

- [ ] **Passo 3: Checagem à mão com o usuário**

Prepare uma cópia do exemplo em `.checks/aceitacao-manual/herby` (`cp -r docs/examples/herby .checks/aceitacao-manual/herby`). Com o `dist/win-unpacked/mdd.exe`, o usuário:

1. abre a cópia, vai à aba Fragmentos e abre `fragmentos/plataforma.html`: o realce de HTML e o marcador `{{herby.produto}}` com cor própria;
2. digita `{{herby.` numa linha e vê a lista de sugestões; escolhe uma com Enter;
3. na aba Configurações, abre `Completa Atibaia` e clica em "Gerar produto";
4. abre `saida\completa-atibaia\index.html` no navegador: a capa azul com "Avaliação Formativa - SAEMA 2026" e "Atibaia · 2026", o sumário "Funcionalidades", as seções com as imagens e o rodapé com os contatos;
5. estreita a janela do navegador até a largura de um celular: o texto e as imagens se ajustam, sem rolagem lateral.

O tema escuro não entra: o app ainda não o liga. A aparência é o que só o usuário pode conferir.

- [ ] **Passo 4: O ADR 0010, `docs/adr/0010-paginas-html-como-segunda-saida.md`**

@@FILE docs/adr/0010-paginas-html-como-segunda-saida.md@@

- [ ] **Passo 5: Os termos novos, em `CONTEXT.md`**

@@EDITS CONTEXT.md@@

- [ ] **Passo 6: A Fase 7 na SPEC, em `docs/SPEC.md`**

@@EDITS docs/SPEC.md@@

- [ ] **Passo 7: Commit da documentação**

```bash
npm run format
git add CONTEXT.md docs/SPEC.md docs/adr/0010-paginas-html-como-segunda-saida.md
git commit -F - <<'EOF'
docs: SPEC, ADR 0010 e CONTEXT registram a Fase 7

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Passo 8: O handoff**

Em `docs/HANDOFF.md`: a Fase 7 como concluída na tabela, uma seção "Aceitação da Fase 7" com os roteiros, o `mdd.exe` e a checagem à mão, e o próximo passo (a Fase 8, com o desenho próprio a partir das decisões registradas na spec da Fase 7). Commit `docs: handoff registra a aceitação da Fase 7`.
