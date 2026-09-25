# Fase 6 — Editor de fragmentos: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** criar e editar os fragmentos do projeto dentro do app. A janela ganha a aba **Fragmentos**, com a árvore dos `.xml` do projeto e um editor de XML (CodeMirror 6) com realce, números de linha, desfazer, busca e os problemas da mesma conferência da geração. O texto editado entra no "•", no Ctrl+S e na confirmação ao fechar, como o resto do projeto.

**Arquitetura:**

- **Domínio** (puro): os nomes dos arquivos do projeto (`project-layout.ts`), as regras dos caminhos de fragmento (`fragment-path.ts`), o formato do texto, com BOM e quebra de linha (`text-format.ts`), e a codificação (`encoding.ts`).
- **Aplicação:** o `FragmentDocument` (o arquivo aberto no editor), a porta `FragmentChecker` e os casos de uso `FragmentFiles` (listar os fragmentos e conferir um caminho novo), `OpenFragment` e `SaveFragments`.
- **Infraestrutura:** o `XmlFragmentChecker`, com as conferências que estavam no `XmlProductDeriver`. A geração e o editor passam a conferir do mesmo jeito.
- **Interface:** as ações dos fragmentos na store (`fragments-actions.ts`), com o salvar junto do projeto; a pasta `ui/screens/fragments/`, com o editor; a aba no `ViewRail` e no `ProjectScreen`; o botão "Editar" na aba Assets.
- **Processo main e IPC:** nada muda. O editor usa os canais que já existem (`list`, `readText` e `writeText`).

**Stack:** a das fases anteriores, mais o CodeMirror 6 em pacotes separados: `@codemirror/state`, `view`, `commands`, `language`, `lang-xml`, `search` e `lint`, e o `@lezer/highlight` para as cores (ADR 0009, escrito na Tarefa 6).

**Spec:** [docs/superpowers/specs/2026-09-24-fase-6-editor-fragmentos-design.md](../specs/2026-09-24-fase-6-editor-fragmentos-design.md) (o desenho aprovado) e [docs/SPEC.md](../../SPEC.md): §4.4 (a conferência dos fragmentos), §6.2 (portas), §7 (interface), §8 (salvar e alteração externa) e §9. Veja também os ADRs [0006](../../adr/0006-geracao-agnostica-de-vocabulario.md) e [0008](../../adr/0008-camadas-com-lint-sem-testes.md). O protótipo refinou alguns pontos do desenho; eles estão em "O que o protótipo respondeu", e a Tarefa 6 os leva para a spec do desenho e para a SPEC.

## Restrições globais

- **Sem testes automatizados** (ADR 0008).
  - Cada tarefa verifica com `npm run typecheck`, `npm run lint` e scripts descartáveis em `.checks/`.
  - `.checks/` fica fora do git, do ESLint e do Prettier.
  - Os scripts `.mts` rodam com `npx tsx --tsconfig tsconfig.web.json`, por causa do alias `@/`. Os `.mjs` rodam com `node`.
- **Roteiros das fases anteriores** que este plano usa. Num clone novo, recrie-os a partir destes planos:
  - `cdp.mjs`: plano da 2B;
  - `ui-check.mjs`: plano da 2A (Tarefa 7, Passo 8), com as duas mudanças do plano da 2B (Tarefa 4, Passo 6);
  - `quit.mjs`, `configurations-check.mts`, `configurador-ui.mjs` e `configurator-store-check.mts`: plano da Fase 3. O `configurator-store-check.mts` ganha três serviços no plano da Fase 4 (Tarefa 3, Passo 7);
  - `save-safety-check.mts`: correções da Fase 3;
  - `main-process.mjs`, `run-ui.sh`, `assets-ui.mjs` e `assets-store-check.mts`: plano da Fase 4;
  - `generation-support.mts`, `fragment-source-check.mts` e `geracao-ui.mjs`: plano da Fase 5;
  - `generate-product-check.mts` e `generation-store-check.mts`: nas versões das correções da Fase 5.
- **Camadas** (SPEC §6.1): `domain/` não importa nada de fora dele; `application/` só `domain/`; só `ui/app/` conhece `infrastructure/`. O lint barra violações.
- **Imports:** dentro de `domain/`, relativos; nas demais camadas, alias `@/`. A composition root importa `src/shared/ipc.ts` por caminho relativo.
- **Idioma:** identificadores em inglês; textos da interface, mensagens, comentários e documentação em português.
- **Regras do lint:**
  - toda função tem tipo de retorno explícito;
  - as regras de hooks do React 19 estão ligadas: nada de `setState` síncrono dentro de effect, nada de ler ref durante o render;
  - um arquivo `.tsx` só exporta componentes (`react-refresh/only-export-components`): funções, hooks, tipos e constantes compartilhados vão para um `.ts` ao lado.
- **Classes do Tailwind** sempre escritas por inteiro no código (nada de `` `bg-${cor}` ``), senão o Tailwind não as gera.
- **O nome `saida`** só aparece em `OUTPUT_DIRECTORY` (`src/shared/ipc.ts`). A aplicação o recebe da composition root (o `FragmentFiles` o recebe no construtor), porque não importa `shared/`.
- **O CodeMirror fica na interface:** os pacotes `@codemirror/*` e `@lezer/highlight` só aparecem em `ui/screens/fragments/`. O desfazer do texto é do CodeMirror: editar um fragmento não é um comando e não passa pelo histórico do projeto.
- **O BOM no código** é escrito como `'\u{FEFF}'`. Não use a forma de quatro dígitos (barra invertida, `u`, `FEFF`): a ferramenta de escrita pode trocá-la por um BOM literal, que é invisível. Depois de criar `text-format.ts` e `encoding.ts`, confira com `grep -c 'u{FEFF}'`.
- **Commits:** rode `npm run format` antes de cada commit. Os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Shell:** todo comando roda na raiz do repositório com **Git Bash**, no branch `fase-6-editor-fragmentos`.
- **Roteiros de interface abrem janelas na tela do usuário:** combine o momento com ele antes. Para fechar o app, use `.checks/quit.mjs`, nunca `taskkill /IM electron.exe`. Entre duas rodadas do `run-ui.sh`, espere uns segundos (as portas 9229 e 9333 ficam em `TIME_WAIT`). O `generate-product-check.mts` abre um PowerShell escondido por alguns segundos, para segurar um arquivo aberto.

## O que o protótipo respondeu

O código deste plano foi prototipado e verificado numa cópia descartável do repositório. Depois, cada tarefa foi aplicada sozinha, em ordem, sobre o commit `dc1dcd7` (o último deste branch antes do código): os roteiros novos dela falharam antes e deram a saída deste plano depois, e o typecheck e o lint passaram. No fim, o `src/` ficou idêntico ao do protótipo.

**Refinamentos do desenho** (a Tarefa 6 leva para a spec do desenho e para a SPEC):

1. **`FragmentFiles` no lugar de `ListFragmentFiles`:** `list()` e `checkNewPath()` ficam juntos, porque dependem das mesmas regras e do nome da pasta de saída.
2. **A codificação no domínio:** `declaredEncoding`, `firstUndecodedLine` e `encodingProblem` saem do `fragment-source.ts` da geração para `domain/fragments/encoding.ts`, porque o `OpenFragment` também precisa deles. O `.checks/fragment-source-check.mts` troca um import (Tarefa 2, Passo 8).
3. **O `XmlProductDeriver` mantém o construtor `(storage, validator)`** e cria o `XmlFragmentChecker` por dentro. Assim, o `generate-product-check.mts` não muda, e a saída dele continua igual.
4. **Um caminho novo adota a grafia das pastas que já existem:** no Windows, `Docs/Pagamento/cartao.xml` cai em `docs/pagamento/`, e o arquivo passa a ser `docs/pagamento/cartao.xml`, para aparecer na árvore junto com os outros. Um trecho começando com ponto é recusado, porque ficaria fora da árvore.
5. **O aviso "Salvo com erro de XML"** some quando o arquivo é salvo sem problema e ao fechar o projeto. Não some ao descartar, porque o disco continua com o erro (o desenho dizia o contrário).
6. **O desfazer do texto dura enquanto o projeto está aberto**, também ao trocar de aba. O `ProjectScreen` guarda o estado do CodeMirror de cada arquivo (`fragment-editor-states.ts`). Sem isso, ir a Configurações para gerar e voltar perdia o Ctrl+Z.
7. **O app não liga o tema escuro:** nada aplica a classe `.dark`. As cores `--xml-*` têm valores para os dois temas, mas a checagem à mão só pode ver o tema claro.
8. **O "Salvo às …" do cabeçalho** só aparece quando o projeto e os fragmentos foram gravados sem conflito nem erro. O `save` não mexe na sessão se o projeto for fechado ou trocado durante a gravação.
9. **Quebras de linha misturadas**, ou `\r` sozinho: o arquivo só muda se for editado, e aí sai todo em CRLF (ou LF). Um arquivo sem alteração nunca é gravado.
10. **A store** não confere de novo o mesmo texto, e um arquivo novo que apareceu no disco (criado por fora, com qualquer caixa) não se repete na árvore.

**Achados ao rodar a interface:**

11. **Um fragmento novo salvo sumia da árvore** até a próxima leitura das pastas: o `saveFragments` dava a ele a versão salva, mas não o acrescentava à lista do disco. Agora acrescenta, e o `fragments-store-check.mts` mostra a árvore logo depois de salvar.
12. **O roteiro de interface e o CodeMirror:** o `EditorView` sai do DOM por `.cm-content` → `cmTile.root.view` (o `@codemirror/view` 6.43 trocou o `cmView` pelo `cmTile`). O build minifica as cores (`oklch(0.46 0.16 262)` vira `oklch(46% .16 262)`), então a cor do realce é comparada com a cor calculada de um elemento com `color: var(--xml-tag)`, e não com o texto da variável.
13. **Regressão:** o `ui-check.mjs` (2A), o `configurador-ui.mjs` (Fase 3), o `assets-ui.mjs` (Fase 4), o `geracao-ui.mjs` (Fase 5) e os roteiros de store das Fases 3 a 5 saíram iguais. O `diagrama-ui.mjs` (2B) não foi rodado: esta fase não mexe no diagrama nem na aba Modelo.
14. **No `mdd.exe`:** o `fragmentos-ui.mjs` deu a mesma saída do modo de desenvolvimento. O CodeMirror roda dentro do `app.asar`, com a CSP atual.

## Mapa de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `domain/project/project-layout.ts` | `MODEL_PATH`, `ASSETS_PATH` e `CONFIGURATIONS_DIRECTORY` |
| `domain/fragments/fragment-path.ts` | O que entra na árvore e o caminho de um fragmento novo |
| `domain/fragments/text-format.ts` | BOM e quebra de linha: do arquivo para o editor e de volta |
| `domain/fragments/encoding.ts` | Codificação declarada e bytes que não são UTF-8 |
| `application/ports/fragment-checker.ts` | Porta `FragmentChecker` |
| `application/fragments/fragment-document.ts` | `FragmentDocument`, `newFragment` e `isModified` |
| `application/use-cases/fragment-files.ts`, `open-fragment.ts`, `save-fragments.ts` | Listar, abrir e salvar fragmentos |
| `infrastructure/xml/xml-fragment-checker.ts` | As conferências de um fragmento, para a geração e o editor |
| `infrastructure/xml/fragment-source.ts`, `xml-product-deriver.ts` | A geração passa a usar o `XmlFragmentChecker` |
| `infrastructure/xml/xml-repositories.ts`, `application/use-cases/open-project.ts`, `create-project.ts` | Usam os nomes de `project-layout.ts` |
| `ui/stores/fragments-actions.ts`, `project-store.ts` | Estado e ações dos fragmentos, montados na store; o salvar junto do projeto |
| `ui/app/composition-root.ts` | Injeta os serviços novos |
| `ui/app/index.css` | As cores `--xml-*` |
| `ui/screens/fragments/*` | A aba: árvore, barra, editor, problemas, status e diálogos |
| `ui/screens/project/ViewRail.tsx`, `editor-dialog.ts`, `ProjectScreen.tsx` | A aba, os diálogos novos, os atalhos, a volta do foco e os estados do editor |
| `ui/screens/assets/AssetList.tsx`, `AssetsWorkspace.tsx` | O botão "Editar" |

(Os caminhos ficam em `src/renderer/src/`.)

---

### Tarefa 1: Domínio — caminhos de fragmento, formato do texto e nomes do projeto

**Arquivos:**

- Criar: `src/renderer/src/domain/project/project-layout.ts`, `src/renderer/src/domain/fragments/fragment-path.ts`, `src/renderer/src/domain/fragments/text-format.ts`
- Modificar: `src/renderer/src/infrastructure/xml/xml-repositories.ts`, `src/renderer/src/application/use-cases/open-project.ts`, `src/renderer/src/application/use-cases/create-project.ts`
- Verificação: `.checks/fragment-path-check.mts`, `.checks/text-format-check.mts`; regressão com `.checks/configurations-check.mts` e `.checks/save-safety-check.mts`

**Interfaces:**

- Consome: `Result`, `ok`, `err` (`domain/shared/result.ts`).
- Produz:
  - `MODEL_PATH = 'model.xml'`, `ASSETS_PATH = 'assets.xml'` e `CONFIGURATIONS_DIRECTORY = 'configurations'` (`project-layout.ts`)
  - `isFragmentFolder(path, outputDirectory): boolean`, `isFragmentFile(path, outputDirectory): boolean`, `folderOf(path): string` e `checkNewFragmentPath(input, outputDirectory, existing: readonly string[]): Result<string, string>` (`fragment-path.ts`)
  - `TextFormat` (`bom: boolean`, `lineBreak: '\r\n' | '\n'`), `NEW_FILE_FORMAT`, `EditorText` (`text`, `format`), `fromFileContent(content): EditorText` e `toFileContent(text, format): string` (`text-format.ts`)

- [ ] **Passo 1: Conferir o branch**

```bash
git switch fase-6-editor-fragmentos
git status --short
git log --oneline -4
```

Esperado: nada pendente; o branch tem o commit do desenho (`docs: desenho da Fase 6 (editor de fragmentos)`), os do handoff e o deste plano.

- [ ] **Passo 2: Escrever o roteiro `.checks/fragment-path-check.mts`**

Caminhos aceitos e recusados, com o motivo de cada recusa, e o que entra na árvore.

@@FILE .checks/fragment-path-check.mts@@

- [ ] **Passo 3: Escrever o roteiro `.checks/text-format-check.mts`**

Arquivos com e sem BOM, com CRLF, com LF, com quebras misturadas e sem quebra no fim, de ida e volta.

@@FILE .checks/text-format-check.mts@@

- [ ] **Passo 4: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-path-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/text-format-check.mts
```

Esperado, nos dois: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/domain' …`, porque os módulos novos ainda não existem.

- [ ] **Passo 5: Criar `src/renderer/src/domain/project/project-layout.ts`**

@@FILE src/renderer/src/domain/project/project-layout.ts@@

- [ ] **Passo 6: Usar os nomes em `src/renderer/src/infrastructure/xml/xml-repositories.ts`**

@@EDITS src/renderer/src/infrastructure/xml/xml-repositories.ts@@

- [ ] **Passo 7: Usar os nomes em `src/renderer/src/application/use-cases/open-project.ts`**

@@EDITS src/renderer/src/application/use-cases/open-project.ts@@

- [ ] **Passo 8: Usar os nomes em `src/renderer/src/application/use-cases/create-project.ts`**

@@EDITS src/renderer/src/application/use-cases/create-project.ts@@

- [ ] **Passo 9: Criar `src/renderer/src/domain/fragments/fragment-path.ts`**

@@FILE src/renderer/src/domain/fragments/fragment-path.ts@@

- [ ] **Passo 10: Criar `src/renderer/src/domain/fragments/text-format.ts`**

@@FILE src/renderer/src/domain/fragments/text-format.ts@@

Confira o BOM:

```bash
grep -c 'u{FEFF}' src/renderer/src/domain/fragments/text-format.ts
```

Esperado: `1`.

- [ ] **Passo 11: Rodar os roteiros**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-path-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/text-format-check.mts
```

Esperado do `fragment-path-check.mts`, exatamente:

@@OUT fragment-path-check@@

Do `text-format-check.mts`, exatamente:

@@OUT text-format-check@@

- [ ] **Passo 12: Regressão da leitura e do salvar**

Os nomes dos arquivos do projeto passaram a vir de `project-layout.ts`; abrir e salvar continuam iguais.

```bash
npx tsx --tsconfig tsconfig.web.json .checks/configurations-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/save-safety-check.mts
```

Esperado do `configurations-check.mts`, exatamente (a saída do plano da Fase 3):

@@OUT configurations-check-t1@@

Do `save-safety-check.mts`, exatamente (a saída depois da correção, nas correções da Fase 3):

@@OUT save-safety-check-t1@@

- [ ] **Passo 13: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 14: Commit**

```bash
npm run format
git add src/renderer/src
git commit -m "feat(domain): caminhos de fragmento, formato do texto e os nomes dos arquivos do projeto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: A conferência de fragmento, compartilhada pela geração e pelo editor

**Arquivos:**

- Criar: `src/renderer/src/domain/fragments/encoding.ts`, `src/renderer/src/application/ports/fragment-checker.ts`, `src/renderer/src/infrastructure/xml/xml-fragment-checker.ts`
- Modificar: `src/renderer/src/infrastructure/xml/fragment-source.ts`, `src/renderer/src/infrastructure/xml/xml-product-deriver.ts`
- Modificar (roteiro): `.checks/fragment-source-check.mts`, um import
- Verificação: `.checks/fragment-checker-check.mts`; regressão com `.checks/fragment-source-check.mts` e `.checks/generate-product-check.mts`

**Interfaces:**

- Consome: `FileProblem` (`application/file-problem.ts`); `XmlSchemaValidator.validate(schema | null, fileName, content)` (`application/ports/xml-schema-validator.ts`); `extractFragmentRoot(content): Result<string, DecodeProblem[]>` (`fragment-source.ts`); `DecodeProblem` (`infrastructure/xml/xml-reader.ts`); `NodeXmlValidator` (`.checks/generation-support.mts`, só no roteiro).
- Produz:
  - `EncodingProblem` (`line`, `message`), `declaredEncoding(content): string | undefined`, `firstUndecodedLine(content): number | undefined` e `encodingProblem(content): EncodingProblem | undefined` (`encoding.ts`)
  - `FragmentChecker.check(path, content): Promise<FileProblem[]>`, com lista vazia quando o fragmento pode entrar num produto (`fragment-checker.ts`)
  - `XmlFragmentChecker`, com `constructor(validator: XmlSchemaValidator)`, `extractRoot(path, content): Promise<Result<string, DecodeProblem[]>>` e `check(path, content)` (`xml-fragment-checker.ts`)

- [ ] **Passo 1: Escrever o roteiro `.checks/fragment-checker-check.mts`**

A mesma conferência da geração: codificação, bytes que não são UTF-8, XML malformado, prefixo sem declaração e entidade desconhecida, cada um com a linha.

@@FILE .checks/fragment-checker-check.mts@@

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-checker-check.mts
```

Esperado: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/infrastructure' …`.

- [ ] **Passo 3: Criar `src/renderer/src/domain/fragments/encoding.ts`**

@@FILE src/renderer/src/domain/fragments/encoding.ts@@

Confira o BOM:

```bash
grep -c 'u{FEFF}' src/renderer/src/domain/fragments/encoding.ts
```

Esperado: `1`.

- [ ] **Passo 4: Criar a porta `src/renderer/src/application/ports/fragment-checker.ts`**

@@FILE src/renderer/src/application/ports/fragment-checker.ts@@

- [ ] **Passo 5: Criar `src/renderer/src/infrastructure/xml/xml-fragment-checker.ts`**

@@FILE src/renderer/src/infrastructure/xml/xml-fragment-checker.ts@@

- [ ] **Passo 6: Tirar a codificação de `src/renderer/src/infrastructure/xml/fragment-source.ts`**

@@EDITS src/renderer/src/infrastructure/xml/fragment-source.ts@@

- [ ] **Passo 7: A geração passa a usar o `XmlFragmentChecker`, em `src/renderer/src/infrastructure/xml/xml-product-deriver.ts`**

@@EDITS src/renderer/src/infrastructure/xml/xml-product-deriver.ts@@

- [ ] **Passo 8: O import do `.checks/fragment-source-check.mts`**

O `declaredEncoding` saiu do `fragment-source.ts`. No roteiro (plano da Fase 5), troque a linha:

```ts
import { declaredEncoding, extractFragmentRoot } from '@/infrastructure/xml/fragment-source'
```

por:

```ts
import { declaredEncoding } from '@/domain/fragments/encoding'
import { extractFragmentRoot } from '@/infrastructure/xml/fragment-source'
```

- [ ] **Passo 9: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-checker-check.mts
```

Esperado, exatamente:

@@OUT fragment-checker-check@@

- [ ] **Passo 10: Regressão da geração**

As conferências mudaram de lugar, mas não de comportamento.

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-source-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
```

Esperado do `fragment-source-check.mts`, exatamente (a saída do plano da Fase 5):

@@OUT fragment-source-t2@@

Do `generate-product-check.mts`, exatamente (a saída das correções da Fase 5):

@@OUT generate-product-t2@@

- [ ] **Passo 11: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 12: Commit**

```bash
npm run format
git add src/renderer/src
git commit -m "feat(fragments): conferência de fragmento compartilhada pela geração e pelo editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Aplicação — listar, abrir e salvar fragmentos

**Arquivos:**

- Criar: `src/renderer/src/application/fragments/fragment-document.ts`, `src/renderer/src/application/use-cases/fragment-files.ts`, `src/renderer/src/application/use-cases/open-fragment.ts`, `src/renderer/src/application/use-cases/save-fragments.ts`
- Verificação: `.checks/memory-folder.mts` (a pasta em memória, também usada na Tarefa 4) e `.checks/save-fragments-check.mts`

**Interfaces:**

- Consome: `ProjectStorage` (`list`, `readText`, `writeText` com `WritePrecondition`) e `StorageError` (`application/ports/project-storage.ts`); `FileProblem` e `fileError` (`application/file-problem.ts`); `SaveOptions` (`application/use-cases/save-project.ts`); `checkNewFragmentPath`, `isFragmentFile`, `isFragmentFolder`, `fromFileContent`, `toFileContent`, `NEW_FILE_FORMAT` e `TextFormat` (Tarefa 1); `encodingProblem` e `FragmentChecker` (Tarefa 2).
- Produz:
  - `SavedFragment` (`text`, `hash`), `FragmentDocument` (`path`, `text`, `saved: SavedFragment | null`, `format`, `readOnly?`), `NEW_FRAGMENT_TEXT`, `newFragment(path): FragmentDocument` e `isModified(document): boolean` (`fragment-document.ts`)
  - `FragmentFiles`, com `constructor(storage, outputDirectory)`, `list(): Promise<Result<string[], string>>` e `checkNewPath(input, existing): Result<string, string>` (`fragment-files.ts`)
  - `OpenFragment`, com `constructor(storage)` e `execute(path): Promise<Result<FragmentDocument, StorageError>>` (`open-fragment.ts`)
  - `SaveFragmentsResult` (`saved: ReadonlyMap<string, SavedFragment>`, `checked: ReadonlyMap<string, readonly FileProblem[]>`, `conflicts: string[]`, `problems: FileProblem[]`), `SaveFragmentsDependencies` (`storage`, `checker`) e `SaveFragments`, com `execute(documents, options?): Promise<SaveFragmentsResult>` (`save-fragments.ts`)

- [ ] **Passo 1: Escrever `.checks/memory-folder.mts`**

Uma pasta de projeto em memória que imita o Windows e o processo main: nomes sem diferença de caixa e as mesmas pré-condições de gravação.

@@FILE .checks/memory-folder.mts@@

- [ ] **Passo 2: Escrever o roteiro `.checks/save-fragments-check.mts`**

Listar, abrir (com o arquivo só para leitura) e salvar: só os alterados são gravados, arquivo novo, conflito, "Sobrescrever", arquivo apagado por fora, um erro de disco e o formato de cada arquivo.

@@FILE .checks/save-fragments-check.mts@@

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/save-fragments-check.mts
```

Esperado: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/application' …`.

- [ ] **Passo 4: Criar `src/renderer/src/application/fragments/fragment-document.ts`**

@@FILE src/renderer/src/application/fragments/fragment-document.ts@@

- [ ] **Passo 5: Criar `src/renderer/src/application/use-cases/fragment-files.ts`**

@@FILE src/renderer/src/application/use-cases/fragment-files.ts@@

- [ ] **Passo 6: Criar `src/renderer/src/application/use-cases/open-fragment.ts`**

@@FILE src/renderer/src/application/use-cases/open-fragment.ts@@

- [ ] **Passo 7: Criar `src/renderer/src/application/use-cases/save-fragments.ts`**

@@FILE src/renderer/src/application/use-cases/save-fragments.ts@@

- [ ] **Passo 8: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/save-fragments-check.mts
```

Esperado, exatamente:

@@OUT save-fragments-check@@

- [ ] **Passo 9: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 10: Commit**

```bash
npm run format
git add src/renderer/src
git commit -m "feat(application): listar, abrir e salvar fragmentos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: A store — fragmentos salvos junto com o projeto

**Arquivos:**

- Criar: `src/renderer/src/ui/stores/fragments-actions.ts`
- Modificar: `src/renderer/src/ui/stores/project-store.ts`, `src/renderer/src/ui/app/composition-root.ts`
- Verificação: `.checks/fragments-store-check.mts`; regressão com `.checks/assets-store-check.mts`, `.checks/configurator-store-check.mts` e `.checks/generation-store-check.mts`

**Interfaces:**

- Consome: tudo da Tarefa 3; `FragmentChecker` e `XmlFragmentChecker` (Tarefa 2); `SaveOptions`; `OUTPUT_DIRECTORY` (`src/shared/ipc.ts`, só na composition root); `ProjectState` e `createProjectStore` (`project-store.ts`).
- Produz:
  - `FragmentsServices` (`fragmentFiles`, `openFragment`, `saveFragments`, `fragmentChecker`) (`fragments-actions.ts`)
  - `FragmentsState`: os campos `fragmentFiles: readonly string[] | null`, `fragmentDocuments: ReadonlyMap<string, FragmentDocument>`, `shownFragmentPath: string | null`, `fragmentProblems: ReadonlyMap<string, readonly FileProblem[]>` e `fragmentWarnings: ReadonlyMap<string, FileProblem>`, e as ações `loadFragmentFiles()`, `showFragment(path)`, `changeFragmentText(path, text)`, `checkFragment(path)`, `checkNewFragmentPath(input): string | null`, `createFragment(input): string | null`, `discardFragment(path)`, `refreshFragments()` e `saveFragments(options?)`
  - `FRAGMENTS_CLOSED`, `shownFragment(state): FragmentDocument | null`, `hasModifiedFragments(state): boolean`, `fragmentTreePaths(files, documents): string[]` e `createFragmentsActions(set, get, services)`
  - Em `project-store.ts`: `ProjectStoreServices` e `ProjectState` incluem os dos fragmentos; `hasUnsavedChanges` olha os fragmentos; `save` grava os fragmentos depois do projeto; `reload` relê as pastas e o fragmento exibido.

- [ ] **Passo 1: Escrever o roteiro `.checks/fragments-store-check.mts`**

A store sobre a pasta em memória: o "•", o salvar junto com o projeto, os avisos, o arquivo novo, o descartar, o atualizar, o recarregar e o fechar.

@@FILE .checks/fragments-store-check.mts@@

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragments-store-check.mts
```

Esperado: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/ui' …`.

- [ ] **Passo 3: Criar `src/renderer/src/ui/stores/fragments-actions.ts`**

@@FILE src/renderer/src/ui/stores/fragments-actions.ts@@

- [ ] **Passo 4: Montar as ações em `src/renderer/src/ui/stores/project-store.ts`**

@@EDITS src/renderer/src/ui/stores/project-store.ts@@

- [ ] **Passo 5: Injetar os serviços em `src/renderer/src/ui/app/composition-root.ts`**

@@EDITS src/renderer/src/ui/app/composition-root.ts@@

- [ ] **Passo 6: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragments-store-check.mts
```

Esperado, exatamente:

@@OUT fragments-store-check@@

- [ ] **Passo 7: Regressão das stores**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/assets-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/configurator-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
```

Esperado do `assets-store-check.mts`, exatamente (a saída do plano da Fase 4):

@@OUT assets-store-check-t4@@

Do `configurator-store-check.mts`, exatamente (a saída do plano da Fase 3):

@@OUT configurator-store-check-t4@@

Do `generation-store-check.mts`, exatamente (a saída das correções da Fase 5):

@@OUT generation-store-check-t4@@

- [ ] **Passo 8: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 9: Commit**

```bash
npm run format
git add src/renderer/src
git commit -m "feat(store): fragmentos na store, salvos junto com o projeto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: A aba Fragmentos

**Arquivos:**

- Modificar: `package.json` e `package-lock.json` (pelo `npm install`), `src/renderer/src/ui/app/index.css`
- Criar, em `src/renderer/src/ui/screens/fragments/`: `xml-editor-setup.ts`, `fragment-editor-states.ts`, `fragment-tree.ts`, `FragmentTree.tsx`, `FragmentBar.tsx`, `FragmentProblems.tsx`, `FragmentStatusBar.tsx`, `FragmentEditor.tsx`, `FragmentDialogs.tsx` e `FragmentsWorkspace.tsx`
- Modificar: `src/renderer/src/ui/screens/project/ViewRail.tsx`, `src/renderer/src/ui/screens/project/editor-dialog.ts`, `src/renderer/src/ui/screens/assets/AssetList.tsx`, `src/renderer/src/ui/screens/assets/AssetsWorkspace.tsx`, `src/renderer/src/ui/screens/project/ProjectScreen.tsx`
- Verificação: `.checks/fragmentos-ui.mjs`; regressão com `.checks/ui-check.mjs`, `.checks/configurador-ui.mjs`, `.checks/assets-ui.mjs` e `.checks/geracao-ui.mjs`

**Interfaces:**

- Consome: tudo da Tarefa 4 (pelo `useProjectStore`); `FragmentDocument` e `isModified` (Tarefa 3); `folderOf` (Tarefa 1); `FileProblem`; `Asset` e `assetLabel` (`domain/assets/asset-catalog.ts`); `Button`, `Dialog*`, `Input` e `Label` (shadcn); `EditorDialog` com `{ kind: 'link-asset'; path; anchor }`, que abre o `LinkAssetDialog` da Fase 4 sem mudança; `useWindowFocus` e `ProblemList`.
- Produz:
  - `ProjectView` com `'fragments'` (`ViewRail.tsx`)
  - `EditorDialog` com `{ kind: 'new-fragment' }` e `{ kind: 'discard-fragment'; path }` (`editor-dialog.ts`)
  - `createXmlEditorState(text, options: XmlEditorOptions): EditorState` e `diagnosticsFor(doc, problems): Diagnostic[]` (`xml-editor-setup.ts`); `FragmentEditorStates = Map<string, EditorState>` (`fragment-editor-states.ts`); `FragmentFolder`, `FragmentFile` e `buildFragmentTree(paths): FragmentFolder` (`fragment-tree.ts`)
  - os componentes `FragmentsWorkspace({ project, onOpenDialog, editorStates })`, `FragmentTree`, `FragmentBar`, `FragmentProblems`, `FragmentEditor`, `FragmentStatusBar` e `FragmentDialogs({ dialog, onClose })`
  - `AssetsWorkspace` e `AssetList` com `onEditFragment(path)`

- [ ] **Passo 1: Instalar o CodeMirror**

```bash
npm install @codemirror/commands@6.11.1 @codemirror/lang-xml@6.1.0 @codemirror/language@6.12.4 @codemirror/lint@6.9.7 @codemirror/search@6.7.2 @codemirror/state@6.7.6 @codemirror/view@6.43.13 @lezer/highlight@1.2.4
```

Confira que o `npm install` deixou as dependências do `package.json` assim:

@@EDITS package.json@@

- [ ] **Passo 2: As cores do editor em `src/renderer/src/ui/app/index.css`**

@@EDITS src/renderer/src/ui/app/index.css@@

- [ ] **Passo 3: Criar `src/renderer/src/ui/screens/fragments/xml-editor-setup.ts`**

As extensões do CodeMirror, as cores (das variáveis `--xml-*`), o tema e os textos em português.

@@FILE src/renderer/src/ui/screens/fragments/xml-editor-setup.ts@@

- [ ] **Passo 4: Os estados do editor e a árvore**

Crie `src/renderer/src/ui/screens/fragments/fragment-editor-states.ts`:

@@FILE src/renderer/src/ui/screens/fragments/fragment-editor-states.ts@@

Crie `src/renderer/src/ui/screens/fragments/fragment-tree.ts`:

@@FILE src/renderer/src/ui/screens/fragments/fragment-tree.ts@@

- [ ] **Passo 5: A árvore, a barra, os problemas e o status**

Crie `src/renderer/src/ui/screens/fragments/FragmentTree.tsx`:

@@FILE src/renderer/src/ui/screens/fragments/FragmentTree.tsx@@

Crie `src/renderer/src/ui/screens/fragments/FragmentBar.tsx`:

@@FILE src/renderer/src/ui/screens/fragments/FragmentBar.tsx@@

Crie `src/renderer/src/ui/screens/fragments/FragmentProblems.tsx`:

@@FILE src/renderer/src/ui/screens/fragments/FragmentProblems.tsx@@

Crie `src/renderer/src/ui/screens/fragments/FragmentStatusBar.tsx`:

@@FILE src/renderer/src/ui/screens/fragments/FragmentStatusBar.tsx@@

- [ ] **Passo 6: Criar `src/renderer/src/ui/screens/fragments/FragmentEditor.tsx`**

@@FILE src/renderer/src/ui/screens/fragments/FragmentEditor.tsx@@

- [ ] **Passo 7: Criar `src/renderer/src/ui/screens/fragments/FragmentDialogs.tsx`**

@@FILE src/renderer/src/ui/screens/fragments/FragmentDialogs.tsx@@

- [ ] **Passo 8: Criar `src/renderer/src/ui/screens/fragments/FragmentsWorkspace.tsx`**

@@FILE src/renderer/src/ui/screens/fragments/FragmentsWorkspace.tsx@@

- [ ] **Passo 9: A aba em `src/renderer/src/ui/screens/project/ViewRail.tsx`**

@@EDITS src/renderer/src/ui/screens/project/ViewRail.tsx@@

- [ ] **Passo 10: Os diálogos novos em `src/renderer/src/ui/screens/project/editor-dialog.ts`**

@@EDITS src/renderer/src/ui/screens/project/editor-dialog.ts@@

- [ ] **Passo 11: O botão "Editar" na aba Assets**

Em `src/renderer/src/ui/screens/assets/AssetList.tsx`:

@@EDITS src/renderer/src/ui/screens/assets/AssetList.tsx@@

Em `src/renderer/src/ui/screens/assets/AssetsWorkspace.tsx`:

@@EDITS src/renderer/src/ui/screens/assets/AssetsWorkspace.tsx@@

- [ ] **Passo 12: A aba, os atalhos, a volta do foco e os avisos em `src/renderer/src/ui/screens/project/ProjectScreen.tsx`**

@@EDITS src/renderer/src/ui/screens/project/ProjectScreen.tsx@@

- [ ] **Passo 13: Checagens e build**

```bash
npm run typecheck
npm run lint
npm run build
```

Esperado: sem erros. O build avisa três vezes "Use of eval … is strongly discouraged" (`logic-solver`, esperado desde a Fase 3).

- [ ] **Passo 14: Escrever o roteiro `.checks/fragmentos-ui.mjs`**

@@FILE .checks/fragmentos-ui.mjs@@

- [ ] **Passo 15: Rodar o roteiro da aba Fragmentos**

Combine o momento com o usuário: o app abre e fecha na tela dele.

```bash
bash .checks/run-ui.sh dev .checks/fragmentos-ui.mjs 9229
```

Esperado, exatamente:

@@OUT fragmentos-ui@@

Antes do passo 1, o roteiro grava o `visao-geral.xml` com BOM e CRLF, para conferir no passo 9 que o formato fica; por isso ele aparece entre os arquivos diferentes do exemplo. O "Fechar" repetido nos diálogos é o × do próprio diálogo, com o rótulo para leitor de tela.

- [ ] **Passo 16: Regressão das Fases 2A, 3, 4 e 5**

Espere uns segundos entre um roteiro e o seguinte.

```bash
bash .checks/run-ui.sh dev .checks/ui-check.mjs
bash .checks/run-ui.sh dev .checks/configurador-ui.mjs
bash .checks/run-ui.sh dev .checks/assets-ui.mjs 9229
bash .checks/run-ui.sh dev .checks/geracao-ui.mjs 9229
```

Esperado do `ui-check.mjs`, exatamente (a saída do plano da Fase 5, Tarefa 4, Passo 17):

@@OUT ui-check@@

Do `configurador-ui.mjs`, exatamente (a mesma do plano da Fase 5):

@@OUT configurador-ui@@

Do `assets-ui.mjs`, exatamente (a saída do plano da Fase 4):

@@OUT assets-ui@@

Do `geracao-ui.mjs`, exatamente (a saída do plano da Fase 5; a hora aparece como `HH:MM`):

@@OUT geracao-ui@@

O `diagrama-ui.mjs` (2B) não precisa rodar: esta fase não mexe no diagrama nem na aba Modelo.

- [ ] **Passo 17: Commit**

```bash
npm run format
git add package.json package-lock.json src/renderer/src
git commit -m "feat(ui): aba Fragmentos com o editor de XML (CodeMirror 6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 6: Aceitação no app empacotado e documentação

**Arquivos:**

- Criar: `docs/adr/0009-editor-de-fragmentos-com-codemirror.md`
- Modificar: `docs/SPEC.md`, `docs/superpowers/specs/2026-09-24-fase-6-editor-fragmentos-design.md`, `docs/HANDOFF.md`
- Verificação: `.checks/fragmentos-ui.mjs` no `mdd.exe`

**Interfaces:**

- Consome: tudo das Tarefas 1–5.
- Produz: o instalador, o registro da aceitação, o ADR 0009 e a SPEC atualizada com as decisões da fase.

- [ ] **Passo 1: Gerar o instalador**

```bash
npm run build:win
```

Esperado: `building target=nsis file=dist\mdd-0.1.0-setup.exe` sem erro.

- [ ] **Passo 2: O roteiro da aba Fragmentos no `mdd.exe`**

Combine o momento com o usuário.

```bash
bash .checks/run-ui.sh ./dist/win-unpacked/mdd.exe .checks/fragmentos-ui.mjs 9229
```

Esperado: exatamente a saída da Tarefa 5, Passo 15. Ela confirma que o CodeMirror e a conferência dos fragmentos funcionam dentro do `app.asar`, com a CSP.

- [ ] **Passo 3: A checagem à mão, com o usuário**

É o item 5 da aceitação do desenho: o que os roteiros não veem. Prepare uma cópia do exemplo, para não mexer no `docs/examples`:

```bash
rm -rf .checks/aceitacao-manual && cp -r docs/examples/loja-online .checks/aceitacao-manual
```

Peça ao usuário, com o `dist/win-unpacked/mdd.exe` aberto nessa cópia:

1. na aba Fragmentos, abrir `docs/pagamento/pix.xml`: as tags, os atributos e os textos aparecem em cores diferentes e legíveis no tema claro, com os números de linha e a linha atual destacada;
2. apagar o `>` de uma tag: a linha fica sublinhada, com a marca na margem, e o problema aparece embaixo, com a linha; Ctrl+Z desfaz;
3. sem alteração no app, editar o `pix.xml` no Bloco de Notas, salvar e voltar ao app com um clique: o editor mostra o texto novo.

O tema escuro não entra: o app ainda não o liga. Registre no handoff o que ele viu.

- [ ] **Passo 4: Criar o ADR 0009 (`docs/adr/0009-editor-de-fragmentos-com-codemirror.md`)**

@@FILE docs/adr/0009-editor-de-fragmentos-com-codemirror.md@@

- [ ] **Passo 5: A SPEC (`docs/SPEC.md`)**

§1 e §2 (a Fase 6 depois da primeira versão), §6.1 (as pastas), §6.2 (a porta `FragmentChecker`), §7 (a aba Fragmentos e o "Editar" na aba Assets), §8 (os fragmentos no salvar e na alteração externa) e §9 (a linha da Fase 6). A tabela do §9 é realinhada inteira pelo Prettier.

@@EDITS docs/SPEC.md@@

- [ ] **Passo 6: A spec do desenho (`docs/superpowers/specs/2026-09-24-fase-6-editor-fragmentos-design.md`)**

O que o protótipo respondeu (itens 1 a 11 de "O que o protótipo respondeu"), com uma nota no topo.

@@EDITS docs/superpowers/specs/2026-09-24-fase-6-editor-fragmentos-design.md@@

- [ ] **Passo 7: O handoff (`docs/HANDOFF.md`)**

- Na tabela "Estado atual", troque a linha da Fase 6 por:

```markdown
| 6. Editor de fragmentos | Concluída | `main`. Plano em [docs/superpowers/plans/2026-09-24-fase-6-editor-fragmentos.md](superpowers/plans/2026-09-24-fase-6-editor-fragmentos.md) |
```

- Na lista do que o app faz, acrescente: "cria e edita os fragmentos na aba Fragmentos, num editor de XML com realce e a mesma conferência da geração, e os salva junto com o projeto, mantendo o BOM e as quebras de linha de cada arquivo".
- Troque a seção "Fase 6 em andamento" por "Aceitação da Fase 6 (feita em <data>)". Ela registra o que os Passos 2 e 3 desta tarefa mostraram, os roteiros das Tarefas 1 a 5 e a regressão da Tarefa 5, Passo 16. Escreva o que de fato aconteceu; se algo divergir do esperado, registre a divergência.
- Atualize a seção "Próximo passo": com a Fase 6, o que resta são os itens da fase "Depois" da SPEC §9, para o usuário escolher.
- Em "Como trabalhamos", acrescente aos roteiros da lista: "Os da Fase 6 (`fragment-path-check.mts`, `text-format-check.mts`, `fragment-checker-check.mts`, `memory-folder.mts`, `save-fragments-check.mts`, `fragments-store-check.mts` e `fragmentos-ui.mjs`) estão no plano da Fase 6; o `fragment-source-check.mts` da Fase 5 troca um import (Tarefa 2, Passo 8)."
- Em "Armadilhas já encontradas", acrescente:

```markdown
- **O CodeMirror nos roteiros:** o `EditorView` sai do DOM por `document.querySelector('.cm-content').cmTile.root.view` (desde o `@codemirror/view` 6.43; antes era `cmView.view`), como faz o `EditorView.findFromDOM`. É uma propriedade interna: ao atualizar o pacote, confira o `fragmentos-ui.mjs`.
- **Variáveis CSS depois do build:** o build minifica os valores (`oklch(0.46 0.16 262)` vira `oklch(46% .16 262)`), e o `getPropertyValue` devolve o texto minificado. Para comparar uma cor, use a cor calculada de um elemento com `color: var(--nome)`.
- **Roteiro com `connectMain`:** guarde a conexão e chame `main.close()` no fim. Aberta, ela segura o Node, e o `run-ui.sh` nunca chega a fechar o app.
- **O CodeMirror e as quebras de linha:** o editor troca `\r\n` e `\r` por `\n` e não sabe do BOM. O `text-format.ts` guarda o formato do arquivo e o devolve ao gravar; sem isso, salvar trocaria o arquivo inteiro no git.
```

- [ ] **Passo 8: Commit**

```bash
npm run format
git add docs/SPEC.md docs/adr/0009-editor-de-fragmentos-com-codemirror.md docs/superpowers/specs/2026-09-24-fase-6-editor-fragmentos-design.md docs/HANDOFF.md
git commit -m "docs: SPEC, ADR 0009, spec do desenho e handoff registram a Fase 6

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Depois das checagens, o branch volta para a `main` com merge local, como nas fases anteriores.

---

## Aceitação da Fase 6 (SPEC §9)

- [ ] A árvore mostra os 5 `.xml` de `docs/`, sem o `model.xml`, o `assets.xml` e `configurations/` (Tarefa 1, Passo 11; Tarefa 5, Passo 15, passo 1 do roteiro).
- [ ] Trocar o título do `pix.xml` e salvar muda só esse arquivo, e a quebra de linha e o BOM ficam como estavam (Tarefa 1, Passo 11; Tarefa 5, Passo 15, passos 5 e 9 do roteiro).
- [ ] Apagar o `>` de uma tag mostra o problema com a linha, e a geração de `loja-basica` passa a recusar o arquivo (Tarefa 2, Passo 9; Tarefa 5, Passo 15, passos 6 e 7 do roteiro).
- [ ] Criar `docs/pagamento/cartao.xml`, escrever um conteúdo válido, salvar e vinculá-lo a `pag_cartao` pelo editor faz o arquivo aparecer na aba Assets como ok (Tarefa 5, Passo 15, passos 12, 13 e 15 do roteiro).
- [ ] A aparência do editor, as cores do tema claro e a volta do foco depois de editar um arquivo por fora, vistas pelo usuário no `mdd.exe` (Tarefa 6, Passo 3).
- [ ] O editor funciona dentro do app empacotado (Tarefa 6, Passo 2).
- [ ] As fases anteriores continuam iguais (Tarefa 1, Passo 12; Tarefa 2, Passo 10; Tarefa 4, Passo 7; Tarefa 5, Passo 16).
