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

| Arquivo                                                                                                | Responsabilidade                                                             |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `domain/project/project-layout.ts`                                                                     | `MODEL_PATH`, `ASSETS_PATH` e `CONFIGURATIONS_DIRECTORY`                     |
| `domain/fragments/fragment-path.ts`                                                                    | O que entra na árvore e o caminho de um fragmento novo                       |
| `domain/fragments/text-format.ts`                                                                      | BOM e quebra de linha: do arquivo para o editor e de volta                   |
| `domain/fragments/encoding.ts`                                                                         | Codificação declarada e bytes que não são UTF-8                              |
| `application/ports/fragment-checker.ts`                                                                | Porta `FragmentChecker`                                                      |
| `application/fragments/fragment-document.ts`                                                           | `FragmentDocument`, `newFragment` e `isModified`                             |
| `application/use-cases/fragment-files.ts`, `open-fragment.ts`, `save-fragments.ts`                     | Listar, abrir e salvar fragmentos                                            |
| `infrastructure/xml/xml-fragment-checker.ts`                                                           | As conferências de um fragmento, para a geração e o editor                   |
| `infrastructure/xml/fragment-source.ts`, `xml-product-deriver.ts`                                      | A geração passa a usar o `XmlFragmentChecker`                                |
| `infrastructure/xml/xml-repositories.ts`, `application/use-cases/open-project.ts`, `create-project.ts` | Usam os nomes de `project-layout.ts`                                         |
| `ui/stores/fragments-actions.ts`, `project-store.ts`                                                   | Estado e ações dos fragmentos, montados na store; o salvar junto do projeto  |
| `ui/app/composition-root.ts`                                                                           | Injeta os serviços novos                                                     |
| `ui/app/index.css`                                                                                     | As cores `--xml-*`                                                           |
| `ui/screens/fragments/*`                                                                               | A aba: árvore, barra, editor, problemas, status e diálogos                   |
| `ui/screens/project/ViewRail.tsx`, `editor-dialog.ts`, `ProjectScreen.tsx`                             | A aba, os diálogos novos, os atalhos, a volta do foco e os estados do editor |
| `ui/screens/assets/AssetList.tsx`, `AssetsWorkspace.tsx`                                               | O botão "Editar"                                                             |

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

```ts
// Regras dos caminhos de fragmento (plano da Fase 6, Tarefa 1).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/fragment-path-check.mts
import {
  checkNewFragmentPath,
  folderOf,
  isFragmentFile,
  isFragmentFolder
} from '@/domain/fragments/fragment-path'

const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const existing = ['docs/loja/visao-geral.xml', 'docs/pagamento/pix.xml']

console.log('— na árvore')
for (const path of [
  'docs/pagamento/pix.xml',
  'docs/LEIAME.XML',
  'docs/img/pix-fluxo.svg',
  'model.xml',
  'Assets.xml',
  'docs/model.xml',
  'configurations/loja-basica.xml',
  'Saida/loja-basica/product.xml',
  'docs/saida/x.xml',
  '.git/config.xml',
  'docs/.rascunho/a.xml'
]) {
  log(path, isFragmentFile(path, 'saida') ? 'arquivo' : '—')
}
for (const path of [
  'docs',
  'configurations',
  'saida',
  '.git',
  'docs/.cache',
  'docs/configurations'
]) {
  log(`${path}/`, isFragmentFolder(path, 'saida') ? 'pasta' : '—')
}

console.log('— caminho novo')
for (const input of [
  'docs/pagamento/cartao.xml',
  '  docs\\pagamento\\boleto2.xml  ',
  'Docs/Pagamento/cartao.xml',
  'DOCS/novo/a.xml',
  'docs/pagamento/PIX.xml',
  '',
  '/docs/a.xml',
  'C:/docs/a.xml',
  '../fora.xml',
  'docs/../a.xml',
  'docs//a.xml',
  'docs/a?.xml',
  'docs/pasta./a.xml',
  'docs/pasta /a.xml',
  'docs/a.txt',
  'docs/pagamento/',
  'docs/.rascunho/a.xml',
  '.xml',
  'model.xml',
  'ASSETS.XML',
  'configurations/nova.xml',
  'saida/loja/extra.xml'
]) {
  const checked = checkNewFragmentPath(input, 'saida', existing)
  log(JSON.stringify(input), checked.ok ? `ok ${checked.value}` : checked.error)
}

console.log('— pasta do arquivo')
for (const path of ['docs/pagamento/pix.xml', 'raiz.xml']) log(path, JSON.stringify(folderOf(path)))
```

- [ ] **Passo 3: Escrever o roteiro `.checks/text-format-check.mts`**

Arquivos com e sem BOM, com CRLF, com LF, com quebras misturadas e sem quebra no fim, de ida e volta.

```ts
// O texto do editor e o do arquivo (plano da Fase 6, Tarefa 1).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/text-format-check.mts
import { fromFileContent, NEW_FILE_FORMAT, toFileContent } from '@/domain/fragments/text-format'

const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const BOM = '\u{FEFF}'
/** Como JSON, com o BOM à vista. */
const show = (text: string): string => JSON.stringify(text).replace(BOM, '<BOM>')

const cases: [string, string][] = [
  ['LF', '<a>\n  <b/>\n</a>\n'],
  ['CRLF', '<a>\r\n  <b/>\r\n</a>\r\n'],
  ['BOM e CRLF', `${BOM}<a>\r\n</a>\r\n`],
  ['BOM e LF, sem quebra no fim', `${BOM}<a>\n</a>`],
  ['uma linha só', '<a/>'],
  ['vazio', ''],
  // Os dois últimos só mudam se forem editados: um arquivo sem alteração não é gravado.
  ['misturado', '<a>\r\n  <b/>\n</a>\r\n'],
  ['CR sozinho', '<a>\r</a>\r']
]
for (const [name, content] of cases) {
  const { text, format } = fromFileContent(content)
  const back = toFileContent(text, format)
  log(
    name,
    `${show(text)} bom=${format.bom} quebra=${JSON.stringify(format.lineBreak)} volta ${back === content ? 'idêntico' : `como ${show(back)}`}`
  )
}

// Editar e gravar: a linha nova sai no formato do arquivo.
const { text, format } = fromFileContent(`${BOM}<a>\r\n</a>\r\n`)
const edited = text.replace('</a>', '  <novo/>\n</a>')
log('linha nova num arquivo CRLF', show(toFileContent(edited, format)))
log('arquivo novo', show(toFileContent('<?xml version="1.0"?>\n<a/>\n', NEW_FILE_FORMAT)))
```

- [ ] **Passo 4: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-path-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/text-format-check.mts
```

Esperado, nos dois: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/domain' …`, porque os módulos novos ainda não existem.

- [ ] **Passo 5: Criar `src/renderer/src/domain/project/project-layout.ts`**

```ts
/*
 * Os arquivos que o app mantém na pasta do projeto (SPEC §3). A pasta de saída da geração
 * não está aqui: o nome dela vem de `src/shared/ipc.ts`, pela composition root.
 */

export const MODEL_PATH = 'model.xml'
export const ASSETS_PATH = 'assets.xml'
export const CONFIGURATIONS_DIRECTORY = 'configurations'
```

- [ ] **Passo 6: Usar os nomes em `src/renderer/src/infrastructure/xml/xml-repositories.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import type { Configuration } from '@/domain/configuration/configuration'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeAssetCatalog, encodeAssetCatalog } from './assets-codec'
```

por:

<!-- prettier-ignore -->
```ts
import type { Configuration } from '@/domain/configuration/configuration'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { ASSETS_PATH, CONFIGURATIONS_DIRECTORY, MODEL_PATH } from '@/domain/project/project-layout'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeAssetCatalog, encodeAssetCatalog } from './assets-codec'
```

Troque:

<!-- prettier-ignore -->
```ts
import { decodeFeatureModel, encodeFeatureModel } from './feature-model-codec'
import { XmlDocumentFile, type XmlDocumentFormat } from './xml-document-file'

const MODEL_PATH = 'model.xml'
const ASSETS_PATH = 'assets.xml'
const CONFIGURATIONS_DIRECTORY = 'configurations'

const featureModelFormat: XmlDocumentFormat<FeatureModel> = {
```

por:

<!-- prettier-ignore -->
```ts
import { decodeFeatureModel, encodeFeatureModel } from './feature-model-codec'
import { XmlDocumentFile, type XmlDocumentFormat } from './xml-document-file'

const featureModelFormat: XmlDocumentFormat<FeatureModel> = {
```

- [ ] **Passo 7: Usar os nomes em `src/renderer/src/application/use-cases/open-project.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import { validateFeatureModel } from '@/domain/feature-model/validation'
import type { ConfigurationEntry } from '@/domain/project/project'
import { fileError, fromValidationIssues, type FileProblem } from '../file-problem'
import type { PickedFolder, ProjectFolderPicker } from '../ports/project-folder-picker'
```

por:

<!-- prettier-ignore -->
```ts
import { validateFeatureModel } from '@/domain/feature-model/validation'
import type { ConfigurationEntry } from '@/domain/project/project'
import { ASSETS_PATH, MODEL_PATH } from '@/domain/project/project-layout'
import { fileError, fromValidationIssues, type FileProblem } from '../file-problem'
import type { PickedFolder, ProjectFolderPicker } from '../ports/project-folder-picker'
```

Troque:

<!-- prettier-ignore -->
```ts

    const problems: FileProblem[] = fromValidationIssues(
      'model.xml',
      validateFeatureModel(model.value.value)
    )
```

por:

<!-- prettier-ignore -->
```ts

    const problems: FileProblem[] = fromValidationIssues(
      MODEL_PATH,
      validateFeatureModel(model.value.value)
    )
```

Troque:

<!-- prettier-ignore -->
```ts
    const catalog = assets.ok && assets.value !== null ? assets.value.value : EMPTY_ASSET_CATALOG
    problems.push(
      ...fromValidationIssues('assets.xml', validateAssetCatalog(catalog, model.value.value))
    )
```

por:

<!-- prettier-ignore -->
```ts
    const catalog = assets.ok && assets.value !== null ? assets.value.value : EMPTY_ASSET_CATALOG
    problems.push(
      ...fromValidationIssues(ASSETS_PATH, validateAssetCatalog(catalog, model.value.value))
    )
```

- [ ] **Passo 8: Usar os nomes em `src/renderer/src/application/use-cases/create-project.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { createFeatureModel } from '@/domain/feature-model/new-model'
import { fileError, type FileProblem } from '../file-problem'
import type { ProjectFolderPicker } from '../ports/project-folder-picker'
```

por:

<!-- prettier-ignore -->
```ts
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { createFeatureModel } from '@/domain/feature-model/new-model'
import { MODEL_PATH } from '@/domain/project/project-layout'
import { fileError, type FileProblem } from '../file-problem'
import type { ProjectFolderPicker } from '../ports/project-folder-picker'
```

Troque:

<!-- prettier-ignore -->
```ts
  async execute(name: string, rootId?: string): Promise<CreateProjectResult> {
    const model = createFeatureModel(name, rootId)
    if (!model.ok) return { status: 'failed', problems: [fileError('model.xml', model.error)] }

    const picked = await this.deps.picker.pick()
```

por:

<!-- prettier-ignore -->
```ts
  async execute(name: string, rootId?: string): Promise<CreateProjectResult> {
    const model = createFeatureModel(name, rootId)
    if (!model.ok) return { status: 'failed', problems: [fileError(MODEL_PATH, model.error)] }

    const picked = await this.deps.picker.pick()
```

Troque:

<!-- prettier-ignore -->
```ts
      const problem =
        saved.error.kind === 'conflict'
          ? fileError('model.xml', 'Esta pasta já tem um projeto. Use "Abrir projeto".')
          : saved.error.problem
      return { status: 'failed', problems: [problem] }
```

por:

<!-- prettier-ignore -->
```ts
      const problem =
        saved.error.kind === 'conflict'
          ? fileError(MODEL_PATH, 'Esta pasta já tem um projeto. Use "Abrir projeto".')
          : saved.error.problem
      return { status: 'failed', problems: [problem] }
```

- [ ] **Passo 9: Criar `src/renderer/src/domain/fragments/fragment-path.ts`**

```ts
import { ASSETS_PATH, CONFIGURATIONS_DIRECTORY, MODEL_PATH } from '../project/project-layout'
import { err, ok, type Result } from '../shared/result'

/*
 * Os fragmentos que o editor mostra e cria (Fase 6): os `.xml` do projeto, fora os arquivos
 * do app (model.xml, assets.xml e configurations/), a pasta de saída da geração e o que
 * começa com ponto (.git, .vscode…). Os nomes são comparados sem caixa, como no Windows.
 */

const EXTENSION = '.xml'
/** Os caracteres que o Windows não aceita em nomes de arquivo. */
const FORBIDDEN_CHARACTERS = /[<>:"|?*]/
const ENDS_WITH_DOT_OR_SPACE = /[. ]$/
const DRIVE_LETTER = /^[a-z]:/i

/** A pasta aparece na árvore: não é oculta nem é uma pasta do app ou da geração. */
export function isFragmentFolder(path: string, outputDirectory: string): boolean {
  return !path.split('/').some(isHidden) && reservedReason(path, outputDirectory) === null
}

/** O arquivo é um fragmento que o editor mostra. */
export function isFragmentFile(path: string, outputDirectory: string): boolean {
  return path.toLowerCase().endsWith(EXTENSION) && isFragmentFolder(path, outputDirectory)
}

/** A pasta do arquivo, com a barra no fim: "docs/pagamento/pix.xml" → "docs/pagamento/". */
export function folderOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/') + 1)
}

/**
 * Confere o caminho de um fragmento novo, digitado pelo usuário, contra os que já existem
 * (no disco ou só no editor). Devolve o caminho com "/" e com a grafia das pastas que já
 * existem, ou o motivo da recusa.
 */
export function checkNewFragmentPath(
  input: string,
  outputDirectory: string,
  existing: readonly string[]
): Result<string, string> {
  const path = input.trim().replaceAll('\\', '/')
  if (path === '') return err('Informe o caminho do arquivo, como docs/novo.xml.')
  if (path.startsWith('/') || DRIVE_LETTER.test(path)) {
    return err('Use um caminho relativo à pasta do projeto, como docs/novo.xml.')
  }
  const segments = path.split('/')
  if (segments.includes('..')) return err('O caminho não pode sair da pasta do projeto.')
  if (segments.includes('')) return err('O caminho tem um trecho vazio.')
  if (segments.some((segment) => FORBIDDEN_CHARACTERS.test(segment))) {
    return err('O Windows não aceita os caracteres < > : " | ? * em nomes de arquivo.')
  }
  if (segments.some((segment) => ENDS_WITH_DOT_OR_SPACE.test(segment))) {
    return err('Um nome de pasta ou de arquivo não pode terminar em ponto ou espaço.')
  }
  if (!path.toLowerCase().endsWith(EXTENSION)) return err('O arquivo precisa terminar em .xml.')
  if (segments.some(isHidden)) {
    return err('Nomes começando com ponto ficam fora da árvore de fragmentos.')
  }
  const reserved = reservedReason(path, outputDirectory)
  if (reserved !== null) return err(reserved)

  const adopted = withExistingFolders(segments, existing)
  if (existing.some((other) => sameFile(other, adopted))) return err(`"${adopted}" já existe.`)
  return ok(adopted)
}

function isHidden(name: string): boolean {
  return name.startsWith('.')
}

function sameFile(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/** Por que o caminho é do app ou da geração, e não dos fragmentos; `null` quando não é. */
function reservedReason(path: string, outputDirectory: string): string | null {
  if (sameFile(path, MODEL_PATH) || sameFile(path, ASSETS_PATH)) {
    return `"${path}" é um arquivo do app, editado pelas outras abas.`
  }
  const first = path.split('/')[0]
  if (sameFile(first, CONFIGURATIONS_DIRECTORY)) {
    return `A pasta ${CONFIGURATIONS_DIRECTORY}/ é das configurações.`
  }
  if (sameFile(first, outputDirectory)) return `A pasta ${outputDirectory}/ é da geração.`
  return null
}

/**
 * No Windows, "Docs/novo.xml" cai na pasta "docs/" que já existe. O caminho passa a usar a
 * grafia dela, para o arquivo novo aparecer na árvore junto com os outros.
 */
function withExistingFolders(segments: readonly string[], existing: readonly string[]): string {
  const adopted = [...segments]
  for (let depth = 1; depth < adopted.length; depth++) {
    const prefix = `${adopted.slice(0, depth).join('/')}/`
    const match = existing.find((other) => sameFile(other.slice(0, prefix.length), prefix))
    if (match !== undefined) adopted.splice(0, depth, ...match.split('/').slice(0, depth))
  }
  return adopted.join('/')
}
```

- [ ] **Passo 10: Criar `src/renderer/src/domain/fragments/text-format.ts`**

```ts
/*
 * O texto de um fragmento no editor e no disco (Fase 6). O editor trabalha sem BOM e com
 * "\n"; ao gravar, o texto volta ao formato do arquivo. Assim, só muda no disco o que foi
 * editado: o BOM e as quebras de linha ficam como estavam.
 */

const BOM = '\u{FEFF}'
/** "\r\n" e "\r" sozinho: no editor, as duas viram "\n". */
const FOREIGN_LINE_BREAK = /\r\n?/g

export interface TextFormat {
  readonly bom: boolean
  /** CRLF quando o arquivo tem algum "\r\n"; senão, LF. */
  readonly lineBreak: '\r\n' | '\n'
}

/** O formato de um fragmento criado pelo app. */
export const NEW_FILE_FORMAT: TextFormat = { bom: false, lineBreak: '\n' }

export interface EditorText {
  readonly text: string
  readonly format: TextFormat
}

/** O conteúdo do arquivo como o editor o mostra, e o formato para gravá-lo de volta. */
export function fromFileContent(content: string): EditorText {
  const bom = content.startsWith(BOM)
  const body = bom ? content.slice(BOM.length) : content
  return {
    text: body.replace(FOREIGN_LINE_BREAK, '\n'),
    format: { bom, lineBreak: body.includes('\r\n') ? '\r\n' : '\n' }
  }
}

/** O texto do editor no formato do arquivo, pronto para gravar. */
export function toFileContent(text: string, format: TextFormat): string {
  const body = format.lineBreak === '\n' ? text : text.replaceAll('\n', '\r\n')
  return format.bom ? `${BOM}${body}` : body
}
```

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

```
— na árvore
docs/pagamento/pix.xml               → arquivo
docs/LEIAME.XML                      → arquivo
docs/img/pix-fluxo.svg               → —
model.xml                            → —
Assets.xml                           → —
docs/model.xml                       → arquivo
configurations/loja-basica.xml       → —
Saida/loja-basica/product.xml        → —
docs/saida/x.xml                     → arquivo
.git/config.xml                      → —
docs/.rascunho/a.xml                 → —
docs/                                → pasta
configurations/                      → —
saida/                               → —
.git/                                → —
docs/.cache/                         → —
docs/configurations/                 → pasta
— caminho novo
"docs/pagamento/cartao.xml"          → ok docs/pagamento/cartao.xml
"  docs\\pagamento\\boleto2.xml  "   → ok docs/pagamento/boleto2.xml
"Docs/Pagamento/cartao.xml"          → ok docs/pagamento/cartao.xml
"DOCS/novo/a.xml"                    → ok docs/novo/a.xml
"docs/pagamento/PIX.xml"             → "docs/pagamento/PIX.xml" já existe.
""                                   → Informe o caminho do arquivo, como docs/novo.xml.
"/docs/a.xml"                        → Use um caminho relativo à pasta do projeto, como docs/novo.xml.
"C:/docs/a.xml"                      → Use um caminho relativo à pasta do projeto, como docs/novo.xml.
"../fora.xml"                        → O caminho não pode sair da pasta do projeto.
"docs/../a.xml"                      → O caminho não pode sair da pasta do projeto.
"docs//a.xml"                        → O caminho tem um trecho vazio.
"docs/a?.xml"                        → O Windows não aceita os caracteres < > : " | ? * em nomes de arquivo.
"docs/pasta./a.xml"                  → Um nome de pasta ou de arquivo não pode terminar em ponto ou espaço.
"docs/pasta /a.xml"                  → Um nome de pasta ou de arquivo não pode terminar em ponto ou espaço.
"docs/a.txt"                         → O arquivo precisa terminar em .xml.
"docs/pagamento/"                    → O caminho tem um trecho vazio.
"docs/.rascunho/a.xml"               → Nomes começando com ponto ficam fora da árvore de fragmentos.
".xml"                               → Nomes começando com ponto ficam fora da árvore de fragmentos.
"model.xml"                          → "model.xml" é um arquivo do app, editado pelas outras abas.
"ASSETS.XML"                         → "ASSETS.XML" é um arquivo do app, editado pelas outras abas.
"configurations/nova.xml"            → A pasta configurations/ é das configurações.
"saida/loja/extra.xml"               → A pasta saida/ é da geração.
— pasta do arquivo
docs/pagamento/pix.xml               → "docs/pagamento/"
raiz.xml                             → ""
```

Do `text-format-check.mts`, exatamente:

```
LF                                   → "<a>\n  <b/>\n</a>\n" bom=false quebra="\n" volta idêntico
CRLF                                 → "<a>\n  <b/>\n</a>\n" bom=false quebra="\r\n" volta idêntico
BOM e CRLF                           → "<a>\n</a>\n" bom=true quebra="\r\n" volta idêntico
BOM e LF, sem quebra no fim          → "<a>\n</a>" bom=true quebra="\n" volta idêntico
uma linha só                         → "<a/>" bom=false quebra="\n" volta idêntico
vazio                                → "" bom=false quebra="\n" volta idêntico
misturado                            → "<a>\n  <b/>\n</a>\n" bom=false quebra="\r\n" volta como "<a>\r\n  <b/>\r\n</a>\r\n"
CR sozinho                           → "<a>\n</a>\n" bom=false quebra="\n" volta como "<a>\n</a>\n"
linha nova num arquivo CRLF          → "<BOM><a>\r\n  <novo/>\r\n</a>\r\n"
arquivo novo                         → "<?xml version=\"1.0\"?>\n<a/>\n"
```

- [ ] **Passo 12: Regressão da leitura e do salvar**

Os nomes dos arquivos do projeto passaram a vir de `project-layout.ts`; abrir e salvar continuam iguais.

```bash
npx tsx --tsconfig tsconfig.web.json .checks/configurations-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/save-safety-check.mts
```

Esperado do `configurations-check.mts`, exatamente (a saída do plano da Fase 3):

```
ciclo do clique                    → indecisa → selected → deselected → indecisa
pag_pix depois de 1 clique         → deselected
pag_pix depois de 2 cliques        → indecisa
3º clique: arquivo idêntico        → true
decisão igual, mesmo objeto        → true
valores na ordem do modelo         → true
valor fora da faixa                → o mínimo é 10
atributo fixo                      → "loja" não tem o atributo configurável "versao".
vazio remove o valor               → mobile
sem as órfãs                       → busca pag_cartao pag_boleto
chave de "Loja Básica"             → loja-basica
chave com colisão                  → loja-basica-2
chave de "  ***  "                 → configuracao
criar e duplicar                   → loja-basica:4 loja-basica-2:4 loja-completa:0
renomear troca a chave             → loja-economica Loja Econômica
mesmo nome devolve a mesma lista   → true
nome vazio                         → false
arquivos depois de salvar          → configurations/loja-velha.xml configurations/loja-economica.xml
conflitos                          → configurations/loja-velha.xml
hashes das configurações           → loja-velha loja-economica
sobrescrever exclui o alterado     → configurations/loja-economica.xml
hashes depois                      → loja-economica
nome gravado                       → Loja Econômica
removeConfiguration                → 0
```

Do `save-safety-check.mts`, exatamente (a saída depois da correção, nas correções da Fase 3):

```
1. conflitos                             → configurations/loja-premium.xml
   disco depois de salvar                → loja-basica.xml="Loja Básica" loja-premium.xml="Premium de fora"
   disco depois de sobrescrever          → loja-premium.xml="Loja Premium"
   hashes depois                         → loja-premium
2. chave da nova "Loja"                  → loja-2
3. conflitos                             → configurations/loja.xml
   disco depois de salvar                → Loja.xml="Loja antiga"
   disco depois de sobrescrever          → Loja.xml="Loja"
   hashes depois                         → loja
4. chave depois de renomear              → Loja
   conflitos                             → (nenhum)
   disco depois de salvar                → Loja.xml="Loja"
```

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

```ts
// A conferência de um fragmento, igual para a geração e o editor (plano da Fase 6, Tarefa 2).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/fragment-checker-check.mts
import { readFileSync } from 'node:fs'
import { XmlFragmentChecker } from '@/infrastructure/xml/xml-fragment-checker'
import { NodeXmlValidator } from './generation-support.mts'

const checker = new XmlFragmentChecker(new NodeXmlValidator())
const pix = readFileSync('docs/examples/loja-online/docs/pagamento/pix.xml', 'utf8')
const cases: Record<string, string> = {
  'pix.xml do exemplo': pix,
  'tag sem ">"': pix.replace('<title>Pagamento', '<title Pagamento'),
  'tag sem fechar, CRLF': '<?xml version="1.0"?>\r\n<t>\r\n  <p>a\r\n</t>\r\n',
  'arquivo novo': '<?xml version="1.0" encoding="UTF-8"?>\n',
  'Latin-1 declarado': '<?xml version="1.0" encoding="ISO-8859-1"?>\n<t>a</t>\n',
  'bytes que não são UTF-8': '<t>\n  <p>ok</p>\n  <p>a\u{FFFD}b</p>\n</t>\n',
  '&nbsp; com DTD externa':
    '<?xml version="1.0"?>\n<!DOCTYPE t PUBLIC "-//X//DTD T//EN" "t.dtd">\n<t>\n  <p>a&nbsp;b</p>\n</t>\n',
  'prefixo sem declaração': '<t>\n\n  <p:x/></t>'
}
for (const [name, content] of Object.entries(cases)) {
  const problems = await checker.check('docs/x.xml', content)
  console.log(
    name.padEnd(26),
    '→',
    problems.length === 0
      ? 'ok'
      : problems.map((p) => `${p.file}:${p.line ?? '?'} ${p.message}`).join(' | ')
  )
}

const root = await checker.extractRoot('docs/pagamento/pix.xml', pix)
console.log(
  'raiz extraída do pix.xml'.padEnd(26),
  '→',
  root.ok ? root.value.split('\n')[0] : root.error
)
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-checker-check.mts
```

Esperado: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/infrastructure' …`.

- [ ] **Passo 3: Criar `src/renderer/src/domain/fragments/encoding.ts`**

```ts
/*
 * O app lê os fragmentos como UTF-8 (SPEC §4.4). Um arquivo em outra codificação chega com os
 * acentos trocados por U+FFFD, e não pode ir para o produto nem ser gravado de volta.
 */

const BOM = '\u{FEFF}'
const REPLACEMENT_CHARACTER = '\u{FFFD}'
const DECLARED_ENCODING = /^<\?xml\s[^?]*?\bencoding\s*=\s*(["'])(.*?)\1/
const UTF_8 = /^utf-?8$/i
/** As quebras de linha que o @xmldom/xmldom conta: "\r\n", "\r" sozinho e "\n". */
const LINE_BREAK = /\r\n?|\n/g

export interface EncodingProblem {
  readonly line: number
  readonly message: string
}

/** A codificação da declaração XML, se houver. */
export function declaredEncoding(content: string): string | undefined {
  const text = content.startsWith(BOM) ? content.slice(BOM.length) : content
  return DECLARED_ENCODING.exec(text)?.[2]
}

/**
 * A linha do primeiro U+FFFD, se houver: a leitura como UTF-8 põe esse caractere no lugar dos
 * bytes inválidos, como os acentos de um arquivo salvo em Latin-1.
 */
export function firstUndecodedLine(content: string): number | undefined {
  const found = content.indexOf(REPLACEMENT_CHARACTER)
  if (found < 0) return undefined
  return (content.slice(0, found).match(LINE_BREAK)?.length ?? 0) + 1
}

/** Por que o conteúdo, lido como UTF-8, não serve; `undefined` quando serve. */
export function encodingProblem(content: string): EncodingProblem | undefined {
  // Com outra codificação declarada, os acentos já chegam trocados.
  const encoding = declaredEncoding(content)
  if (encoding !== undefined && !UTF_8.test(encoding)) {
    return {
      line: 1,
      message: `A codificação ${encoding} não é suportada: salve o arquivo em UTF-8.`
    }
  }
  // Sem declaração, a outra codificação aparece nos bytes que não são UTF-8.
  const undecoded = firstUndecodedLine(content)
  if (undecoded !== undefined) {
    return { line: undecoded, message: 'O arquivo não está em UTF-8: salve-o em UTF-8.' }
  }
  return undefined
}
```

Confira o BOM:

```bash
grep -c 'u{FEFF}' src/renderer/src/domain/fragments/encoding.ts
```

Esperado: `1`.

- [ ] **Passo 4: Criar a porta `src/renderer/src/application/ports/fragment-checker.ts`**

```ts
import type { FileProblem } from '../file-problem'

/** Confere o texto de um fragmento como a geração confere (SPEC §4.4). */
export interface FragmentChecker {
  /** Lista vazia = o fragmento pode entrar num produto. */
  check(path: string, content: string): Promise<FileProblem[]>
}
```

- [ ] **Passo 5: Criar `src/renderer/src/infrastructure/xml/xml-fragment-checker.ts`**

```ts
import type { FileProblem } from '@/application/file-problem'
import type { FragmentChecker } from '@/application/ports/fragment-checker'
import type { XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import { encodingProblem } from '@/domain/fragments/encoding'
import { err, type Result } from '@/domain/shared/result'
import { extractFragmentRoot } from './fragment-source'
import type { DecodeProblem } from './xml-reader'

/**
 * As conferências de um fragmento (SPEC §4.4), na ordem: a codificação, o xmllint (XML
 * bem-formado) e o @xmldom/xmldom, que extrai a raiz. A geração usa a raiz extraída; o
 * editor de fragmentos, só os problemas.
 */
export class XmlFragmentChecker implements FragmentChecker {
  private readonly validator: XmlSchemaValidator

  constructor(validator: XmlSchemaValidator) {
    this.validator = validator
  }

  /** O texto da raiz, pronto para o product.xml, ou os problemas. */
  async extractRoot(path: string, content: string): Promise<Result<string, DecodeProblem[]>> {
    const encoding = encodingProblem(content)
    if (encoding !== undefined) return err([encoding])
    const issues = await this.validator.validate(null, path, content)
    if (issues.length > 0) return err(issues)
    return extractFragmentRoot(content)
  }

  async check(path: string, content: string): Promise<FileProblem[]> {
    const root = await this.extractRoot(path, content)
    if (root.ok) return []
    return root.error.map((issue) => ({
      file: path,
      line: issue.line,
      severity: 'error',
      message: issue.message
    }))
  }
}
```

- [ ] **Passo 6: Tirar a codificação de `src/renderer/src/infrastructure/xml/fragment-source.ts`**

Troque:

<!-- prettier-ignore -->
```ts

const BOM = '\u{FEFF}'
const REPLACEMENT_CHARACTER = '\u{FFFD}'
const DECLARED_ENCODING = /^<\?xml\s[^?]*?\bencoding\s*=\s*(["'])(.*?)\1/
const ENTITY_NOT_FOUND = /^entity not found:(&[^;\s]+;)/
/** As quebras de linha que o @xmldom/xmldom conta: "\r\n", "\r" sozinho e "\n". */
const LINE_BREAK = /\r\n?|\n/g

/** A codificação da declaração XML, se houver. O app só lê fragmentos em UTF-8. */
export function declaredEncoding(content: string): string | undefined {
  return DECLARED_ENCODING.exec(withoutBom(content))?.[2]
}

/**
 * A linha do primeiro U+FFFD, se houver: a leitura como UTF-8 põe esse caractere no lugar dos
 * bytes inválidos, como os acentos de um arquivo salvo em Latin-1.
 */
export function firstUndecodedLine(content: string): number | undefined {
  const found = content.indexOf(REPLACEMENT_CHARACTER)
  if (found < 0) return undefined
  return (content.slice(0, found).match(LINE_BREAK)?.length ?? 0) + 1
}

/** O texto do elemento raiz, pronto para entrar num `<fragment>`, ou os problemas encontrados. */
```

por:

<!-- prettier-ignore -->
```ts

const BOM = '\u{FEFF}'
const ENTITY_NOT_FOUND = /^entity not found:(&[^;\s]+;)/
/** As quebras de linha que o @xmldom/xmldom conta: "\r\n", "\r" sozinho e "\n". */
const LINE_BREAK = /\r\n?|\n/g

/** O texto do elemento raiz, pronto para entrar num `<fragment>`, ou os problemas encontrados. */
```

- [ ] **Passo 7: A geração passa a usar o `XmlFragmentChecker`, em `src/renderer/src/infrastructure/xml/xml-product-deriver.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import type { GenerationPlan, PlannedSection } from '@/domain/generation/generation-plan'
import { err, ok, type Result } from '@/domain/shared/result'
import { declaredEncoding, extractFragmentRoot, firstUndecodedLine } from './fragment-source'
import type { DecodeProblem } from './xml-reader'
import { element, rawXml, textElement, writeXmlDocument, type XmlElement } from './xml-writer'
```

por:

<!-- prettier-ignore -->
```ts
import type { GenerationPlan, PlannedSection } from '@/domain/generation/generation-plan'
import { err, ok, type Result } from '@/domain/shared/result'
import { XmlFragmentChecker } from './xml-fragment-checker'
import type { DecodeProblem } from './xml-reader'
import { element, rawXml, textElement, writeXmlDocument, type XmlElement } from './xml-writer'
```

Troque:

<!-- prettier-ignore -->
```ts
export class XmlProductDeriver implements ProductDeriver {
  private readonly storage: ProjectStorage
  private readonly validator: XmlSchemaValidator

  constructor(storage: ProjectStorage, validator: XmlSchemaValidator) {
    this.storage = storage
    this.validator = validator
  }
```

por:

<!-- prettier-ignore -->
```ts
export class XmlProductDeriver implements ProductDeriver {
  private readonly storage: ProjectStorage
  private readonly fragments: XmlFragmentChecker

  constructor(storage: ProjectStorage, validator: XmlSchemaValidator) {
    this.storage = storage
    this.fragments = new XmlFragmentChecker(validator)
  }
```

Troque:

<!-- prettier-ignore -->
```ts
      return err([problem(asset, { message })])
    }
    const content = read.value.content
    // O conteúdo foi lido como UTF-8; com outra codificação, os acentos já chegam trocados.
    const encoding = declaredEncoding(content)
    if (encoding !== undefined && !/^utf-?8$/i.test(encoding)) {
      return err([
        problem(asset, {
          line: 1,
          message: `A codificação ${encoding} não é suportada: salve o arquivo em UTF-8.`
        })
      ])
    }
    // Sem declaração, a outra codificação aparece nos bytes que não são UTF-8.
    const undecoded = firstUndecodedLine(content)
    if (undecoded !== undefined) {
      return err([
        problem(asset, {
          line: undecoded,
          message: 'O arquivo não está em UTF-8: salve-o em UTF-8.'
        })
      ])
    }
    const issues = await this.validator.validate(null, asset.path, content)
    if (issues.length > 0) return err(issues.map((issue) => problem(asset, issue)))
    const root = extractFragmentRoot(content)
    return root.ok ? root : err(root.error.map((issue) => problem(asset, issue)))
  }
```

por:

<!-- prettier-ignore -->
```ts
      return err([problem(asset, { message })])
    }
    const root = await this.fragments.extractRoot(asset.path, read.value.content)
    return root.ok ? root : err(root.error.map((issue) => problem(asset, issue)))
  }
```

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

```
pix.xml do exemplo         → ok
tag sem ">"                → docs/x.xml:3 Specification mandates value for attribute Pagamento | docs/x.xml:3 attributes construct error | docs/x.xml:3 Couldn't find end of Start Tag title line 3 | docs/x.xml:3 Opening and ending tag mismatch: topic line 2 and title
tag sem fechar, CRLF       → docs/x.xml:4 Opening and ending tag mismatch: p line 3 and t
arquivo novo               → docs/x.xml:2 Start tag expected, '<' not found
Latin-1 declarado          → docs/x.xml:1 A codificação ISO-8859-1 não é suportada: salve o arquivo em UTF-8.
bytes que não são UTF-8    → docs/x.xml:3 O arquivo não está em UTF-8: salve-o em UTF-8.
&nbsp; com DTD externa     → docs/x.xml:4 A entidade &nbsp; não é suportada: use o próprio caractere ou uma referência numérica, como &#160;.
prefixo sem declaração     → docs/x.xml:3 Há um prefixo de namespace sem declaração (xmlns:…).
raiz extraída do pix.xml   → <topic xmlns="urn:exemplo:doc">
```

- [ ] **Passo 10: Regressão da geração**

As conferências mudaram de lugar, mas não de comportamento.

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-source-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
```

Esperado do `fragment-source-check.mts`, exatamente (a saída do plano da Fase 5):

```
simples                    → "<topic xmlns=\"urn:x\">\n  <p>a</p>\n</topic>"
sem namespace              → "<topic xmlns=\"\">\n  <p>a</p>\n</topic>"
prefixo na raiz            → "<d:topic xmlns=\"\" xmlns:d=\"urn:d\"><p/></d:topic>"
BOM e CRLF                 → "<t xmlns=\"\" a=\"1\">\r\n  <p/>\r\n</t>"
DOCTYPE interno            → "<t xmlns=\"\"><![CDATA[</t>]]><!-- </t> --></t>"
CR sozinho                 → "<t xmlns=\"\">\r<p/></t>"
emoji antes                → "<t xmlns=\"\"/>"
raiz vazia                 → "<t xmlns=\"\"/>"
DOCTYPE externo e &nbsp;   → linha 4: A entidade &nbsp; não é suportada: use o próprio caractere ou uma referência numérica, como &#160;. | linha 5: A entidade &copy; não é suportada: use o próprio caractere ou uma referência numérica, como &#160;.
entidade interna           → linha 6: A entidade &e; não é suportada: use o próprio caractere ou uma referência numérica, como &#160;.
prefixo sem declaração     → linha 3: Há um prefixo de namespace sem declaração (xmlns:…).
referências válidas        → "<t xmlns=\"\">&amp;&lt;&gt;&quot;&apos;&#233;&#xE9;</t>"
--- codificação declarada
"<?xml version=\"1.0\" encoding=\"UTF-8\"?><t" → UTF-8
"<BOM><?xml version='1.0' encoding='iso-8859-" → iso-8859-1
"<?xml version=\"1.0\"?><t/>"                  → undefined
"<t/>"                                         → undefined
```

Do `generate-product-check.mts`, exatamente (a saída das correções da Fase 5):

```
1. gerar loja-basica                     → gerado em saida/loja-basica às 2026-09-24T14:03:05.123Z
   arquivos em saida/                    → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
   igual ao esperado (sem espaços)       → true
   conforme o product.xsd                → sim
   generatedAt                           → 2026-09-24T14:03:05Z
   .svg idêntico                         → true
   fragmentos intactos no product.xml    → true
<?xml version="1.0" encoding="UTF-8"?>
<product xmlns="urn:mdd:product" schemaVersion="1" name="Loja Básica" model="Loja Online" generatedAt="2026-09-24T14:03:05Z">
  <features>
    <feature id="loja" name="Loja Online">
      <attribute id="versao">1.0</attribute>
    </feature>
    <feature id="catalogo" name="Catálogo"/>
    <feature id="busca" name="Busca">
      <attribute id="max_resultados">100</attribute>
    </feature>
    <feature id="mobile" name="App mobile">
      <attribute id="plataforma">android</attribute>
2. gerar de novo                         → precisa confirmar: saida/loja-basica
   pasta intacta                         → true
3. substituir                            → gerado em saida/loja-basica às 2026-09-24T15:00:00.000Z
   arquivos em saida/                    → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
   generatedAt                           → 2026-09-24T15:00:00Z
4. boleto ausente                        → problems
                                           docs/pagamento/boleto.xml [doc_boleto] Arquivo ausente.
   saida/ existe?                        → false
5. vários problemas                      → problems
                                           docs/loja/visao-geral.xml:1 [doc_loja] A codificação ISO-8859-1 não é suportada: salve o arquivo em UTF-8.
                                           docs/busca/busca.xml:4 [doc_busca] A entidade &nbsp; não é suportada: use o próprio caractere ou uma referência numérica, como &#160;.
                                           docs/pagamento/pix.xml:4 [doc_pix] Opening and ending tag mismatch: title line 3 and topic
                                           docs/img/pix-fluxo.svg [img_pix] Arquivo ausente.
   saida/ existe?                        → false
6. sem namespace                         → gerado em saida/loja-basica às 2026-09-24T14:03:05.123Z
   o fragmento no product.xml            → "          <topic xmlns=\"\" id=\"app\">\r\n  <pre>  linha 1\r\n    linha 2</pre>\r\n</topic>"
   namespace do <topic> embutido         → null
   conforme o product.xsd                → sim
7. troca falha                           → write-failed
                                           saida/loja-basica/ Não foi possível colocar o produto em saida/loja-basica/: falha simulada
   arquivos em saida/                    → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
8. troca e volta falham                  → write-failed (anterior em saida/.loja-basica.old/)
                                           saida/loja-basica/ Não foi possível colocar o produto em saida/loja-basica/: falha simulada
   arquivos em saida/                    → .loja-basica.old/docs/img/pix-fluxo.svg, .loja-basica.old/product.xml
9. arquivo aberto                        → write-failed
                                           saida/loja-basica/ Não foi possível substituir saida/loja-basica/: feche os arquivos dessa pasta e gere de novo.
   arquivos em saida/                    → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
   product.xml anterior intacto          → true
10. chave inexistente                    → problems
                                           configurations/nao-existe.xml A configuração não existe mais.
    incompleta                           → problems
                                           configurations/loja-basica.xml A configuração precisa estar completa para gerar o produto.
11. gerar depois da falha                → precisa confirmar: saida/loja-basica
    arquivos em saida/                   → loja-basica/a-mao.txt, loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
    substituir                           → gerado em saida/loja-basica às 2026-09-24T17:00:00.000Z
    arquivos em saida/                   → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
12. a volta da .old falha                → write-failed (anterior em saida/.loja-basica.old/)
                                           saida/.loja-basica.old/ Não foi possível pôr a versão anterior de volta em saida/loja-basica/: falha simulada
    arquivos em saida/                   → .loja-basica.old/docs/img/pix-fluxo.svg, .loja-basica.old/product.xml, .loja-basica.tmp/product.xml
13. fragmento em Latin-1                 → problems
                                           docs/busca/busca.xml:3 [doc_busca] O arquivo não está em UTF-8: salve-o em UTF-8.
    saida/ existe?                       → false
14. gravação falha                       → write-failed
                                           saida/.loja-basica.tmp/product.xml Não foi possível gravar saida/.loja-basica.tmp/product.xml: disco cheio
    arquivos em saida/                   → (não existe)
15. 14 fragmentos                        → problems
                                           docs/extra/extra-02.xml:3 [extra_02] Opening and ending tag mismatch: p line 2 and topic
                                           docs/extra/extra-09.xml [extra_09] Arquivo ausente.
    conferências ao mesmo tempo          → 4
    corrigidos                           → gerado em saida/loja-basica às 2026-09-24T14:03:05.123Z
    conferências ao mesmo tempo          → 4
    ordem no product.xml                 → doc_loja extra_01 extra_02 extra_03 extra_04 extra_05 extra_06 extra_07 extra_08 extra_09 extra_10 doc_busca doc_busca_app doc_pix
```

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

```ts
// Pasta de projeto em memória para os roteiros da Fase 6. Imita o Windows e o processo main:
// "Docs/a.xml" e "docs/a.xml" são o mesmo arquivo, que guarda a caixa com que foi criado, e
// as gravações seguem as mesmas pré-condições de hash do main.
import { createHash } from 'node:crypto'
import type {
  ProjectStorage,
  StorageEntry,
  StorageError
} from '@/application/ports/project-storage'
import { err, ok } from '@/domain/shared/result'

export const hash = (content: string): string =>
  createHash('sha256').update(content, 'utf8').digest('hex')

export function memoryFolder(initial: Record<string, string>) {
  const files = new Map<string, { name: string; content: string }>()
  /** Caminhos cuja gravação falha com um erro de disco. */
  const failing = new Set<string>()
  const put = (path: string, content: string): void => {
    const name = files.get(path.toLowerCase())?.name ?? path
    files.set(path.toLowerCase(), { name, content })
  }
  for (const [path, content] of Object.entries(initial)) put(path, content)
  const get = (path: string): string | undefined => files.get(path.toLowerCase())?.content
  const changed = (path: string): StorageError => ({
    code: 'changed-externally',
    message: `"${path}" foi alterado fora do app.`
  })
  const missing = (path: string): StorageError => ({
    code: 'not-found',
    message: `"${path}" não existe.`
  })

  const storage: ProjectStorage = {
    async readText(path) {
      const content = get(path)
      return content === undefined ? err(missing(path)) : ok({ content, hash: hash(content) })
    },
    async writeText(path, content, precondition) {
      if (failing.has(path)) {
        return err({ code: 'io', message: `Erro ao acessar "${path}": EPERM` })
      }
      const current = get(path)
      const violated =
        (precondition.kind === 'must-not-exist' && current !== undefined) ||
        (precondition.kind === 'hash' &&
          (current === undefined || hash(current) !== precondition.expectedHash))
      if (violated) return err(changed(path))
      put(path, content)
      return ok(hash(content))
    },
    async list(directory) {
      const prefix = directory === '' ? '' : `${directory.toLowerCase()}/`
      const entries = new Map<string, StorageEntry>()
      for (const { name } of files.values()) {
        if (!name.toLowerCase().startsWith(prefix)) continue
        const rest = name.slice(prefix.length).split('/')
        const kind = rest.length === 1 ? 'file' : 'directory'
        entries.set(rest[0].toLowerCase(), { name: rest[0], kind })
      }
      return entries.size === 0 && directory !== ''
        ? err(missing(directory))
        : ok([...entries.values()])
    },
    async remove(path) {
      files.delete(path.toLowerCase())
      return ok(null)
    },
    async stat(path) {
      return get(path) === undefined ? err(missing(path)) : ok('file')
    },
    copy: async () => err({ code: 'io', message: 'não usado' }),
    rename: async () => err({ code: 'io', message: 'não usado' }),
    removeDirectory: async () => err({ code: 'io', message: 'não usado' })
  }

  return {
    storage,
    failing,
    /** O conteúdo no disco, como JSON, com o BOM à vista; `(não existe)` quando falta. */
    show: (path: string): string => {
      const content = get(path)
      return content === undefined
        ? '(não existe)'
        : JSON.stringify(content).replace('\u{FEFF}', '<BOM>')
    },
    /** Muda o arquivo "fora do app". */
    write: (path: string, content: string): void => put(path, content),
    /** Apaga o arquivo "fora do app". */
    delete: (path: string): void => void files.delete(path.toLowerCase()),
    names: (): string[] => [...files.values()].map((file) => file.name).sort()
  }
}
```

- [ ] **Passo 2: Escrever o roteiro `.checks/save-fragments-check.mts`**

Listar, abrir (com o arquivo só para leitura) e salvar: só os alterados são gravados, arquivo novo, conflito, "Sobrescrever", arquivo apagado por fora, um erro de disco e o formato de cada arquivo.

```ts
// Listar, abrir e salvar fragmentos (plano da Fase 6, Tarefa 3).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/save-fragments-check.mts
import type { FragmentDocument } from '@/application/fragments/fragment-document'
import { newFragment } from '@/application/fragments/fragment-document'
import { FragmentFiles } from '@/application/use-cases/fragment-files'
import { OpenFragment } from '@/application/use-cases/open-fragment'
import { SaveFragments, type SaveFragmentsResult } from '@/application/use-cases/save-fragments'
import { XmlFragmentChecker } from '@/infrastructure/xml/xml-fragment-checker'
import { NodeXmlValidator } from './generation-support.mts'
import { memoryFolder } from './memory-folder.mts'

const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const BOM = '\u{FEFF}'
const folder = memoryFolder({
  'model.xml': '<model/>',
  'assets.xml': '<assets/>',
  'configurations/loja-basica.xml': '<configuration/>',
  'docs/loja/visao-geral.xml': '<?xml version="1.0"?>\n<topic>\n  <title>Loja</title>\n</topic>\n',
  'docs/pagamento/pix.xml': `${BOM}<?xml version="1.0"?>\r\n<topic>\r\n  <title>PIX</title>\r\n</topic>\r\n`,
  'docs/pagamento/latin1.xml': '<?xml version="1.0"?>\n<t>Informa\u{FFFD}\u{FFFD}o</t>\n',
  'docs/img/pix-fluxo.svg': '<svg/>',
  'saida/loja-basica/product.xml': '<product/>',
  '.git/info.xml': '<x/>',
  'raiz.xml': '<raiz/>'
})
const files = new FragmentFiles(folder.storage, 'saida')
const open = new OpenFragment(folder.storage)
const save = new SaveFragments({
  storage: folder.storage,
  checker: new XmlFragmentChecker(new NodeXmlValidator())
})
const opened = async (path: string): Promise<FragmentDocument> => {
  const result = await open.execute(path)
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}
const summary = (result: SaveFragmentsResult): string => {
  const problems = [...result.checked].map(
    ([path, found]) =>
      `${path}: ${found.length === 0 ? 'ok' : found.map((p) => `linha ${p.line} ${p.message}`).join('; ')}`
  )
  return [
    `gravados [${[...result.saved.keys()].join(', ')}]`,
    `conflitos [${result.conflicts.join(', ')}]`,
    `erros [${result.problems.map((p) => `${p.file} ${p.message}`).join(', ')}]`,
    ...problems.map((line) => `  ${line}`)
  ].join('\n    ')
}

console.log('— listar')
const listed = await files.list()
log('fragmentos', listed.ok ? listed.value.sort().join(' ') : listed.error)
const existing = listed.ok ? listed.value : []
const cartaoPath = files.checkNewPath('Docs/Pagamento/cartao.xml', existing)
log('caminho novo Docs/Pagamento/…', cartaoPath.ok ? cartaoPath.value : cartaoPath.error)
const repeated = files.checkNewPath('docs/pagamento/PIX.xml', existing)
log('caminho novo docs/pagamento/PIX…', repeated.ok ? repeated.value : repeated.error)

console.log('— abrir')
const pix = await opened('docs/pagamento/pix.xml')
log(
  'pix.xml',
  `${JSON.stringify(pix.text)} bom=${pix.format.bom} quebra=${JSON.stringify(pix.format.lineBreak)}`
)
log('pix.xml só leitura?', pix.readOnly ?? 'não')
const latin1 = await opened('docs/pagamento/latin1.xml')
log('latin1.xml só leitura?', latin1.readOnly ?? 'não')
const absent = await open.execute('docs/nada.xml')
log('arquivo que não existe', absent.ok ? 'abriu?!' : absent.error.code)

console.log('— salvar só os alterados')
const visao = await opened('docs/loja/visao-geral.xml')
const pixEdited = { ...pix, text: pix.text.replace('PIX', 'Pagamento com PIX') }
const cartao = {
  ...newFragment(cartaoPath.ok ? cartaoPath.value : ''),
  text: '<?xml version="1.0" encoding="UTF-8"?>\n<topic>\n  <title>Cartão</title>\n</topic>\n'
}
const latin1Edited = { ...latin1, text: `${latin1.text}<!-- editado -->` }
const first = await save.execute([visao, pixEdited, cartao, latin1Edited])
log('resultado', summary(first))
log('pix.xml no disco', folder.show('docs/pagamento/pix.xml'))
log('cartao.xml no disco', folder.show('docs/pagamento/cartao.xml'))
log('latin1.xml no disco', folder.show('docs/pagamento/latin1.xml'))

console.log('— salvar de novo, sem mudança')
const pixSaved = { ...pixEdited, saved: first.saved.get(pixEdited.path) ?? null }
log('resultado', summary(await save.execute([pixSaved, visao])))

console.log('— com erro de XML')
const broken = { ...pixSaved, text: pixSaved.text.replace('</title>', '</titulo>') }
const brokenResult = await save.execute([broken])
log('resultado', summary(brokenResult))
const pixBroken = { ...broken, saved: brokenResult.saved.get(broken.path) ?? null }

console.log('— alterado fora do app')
folder.write(
  'docs/pagamento/pix.xml',
  `${BOM}<?xml version="1.0"?>\r\n<topic>\r\n  <title>git pull</title>\r\n</topic>\r\n`
)
const mine = { ...pixBroken, text: pixBroken.text.replace('</titulo>', '</title>') }
log('salvar', summary(await save.execute([mine])))
log('pix.xml no disco', folder.show('docs/pagamento/pix.xml'))
log('Sobrescrever', summary(await save.execute([mine], { overwrite: true })))
log('pix.xml no disco', folder.show('docs/pagamento/pix.xml'))

console.log('— arquivo novo que apareceu por fora')
const novo = { ...newFragment('docs/novo.xml'), text: '<novo/>\n' }
folder.write('DOCS/NOVO.XML', '<de-fora/>\n')
log('salvar', summary(await save.execute([novo])))
log('Sobrescrever', summary(await save.execute([novo], { overwrite: true })))
log(
  'no disco',
  folder
    .names()
    .filter((name) => name.toLowerCase().includes('novo'))
    .join(' ')
)

console.log('— apagado por fora, com alteração')
const visaoEdited = { ...visao, text: visao.text.replace('Loja', 'A loja') }
folder.delete('docs/loja/visao-geral.xml')
log('salvar', summary(await save.execute([visaoEdited])))
log('Sobrescrever', summary(await save.execute([visaoEdited], { overwrite: true })))

console.log('— erro de disco')
folder.failing.add('raiz.xml')
const raiz = await opened('raiz.xml')
log('salvar', summary(await save.execute([{ ...raiz, text: '<raiz a="1"/>' }])))
```

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/save-fragments-check.mts
```

Esperado: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/application' …`.

- [ ] **Passo 4: Criar `src/renderer/src/application/fragments/fragment-document.ts`**

```ts
import { NEW_FILE_FORMAT, type TextFormat } from '@/domain/fragments/text-format'

/** O fragmento como está no disco, na última leitura ou gravação. */
export interface SavedFragment {
  /** No formato do editor, para comparar com o texto atual. */
  readonly text: string
  readonly hash: string
}

/** Um fragmento aberto no editor (Fase 6). */
export interface FragmentDocument {
  readonly path: string
  /** O texto no editor: sem BOM e com "\n". */
  readonly text: string
  /** `null` num arquivo novo, que ainda não existe no disco. */
  readonly saved: SavedFragment | null
  /** O BOM e a quebra de linha do arquivo, para gravá-lo do mesmo jeito. */
  readonly format: TextFormat
  /** Por que o arquivo só pode ser lido, quando é o caso. */
  readonly readOnly?: string
}

/** Um fragmento novo começa só com a declaração XML e uma linha em branco. */
export const NEW_FRAGMENT_TEXT = '<?xml version="1.0" encoding="UTF-8"?>\n'

export function newFragment(path: string): FragmentDocument {
  return { path, text: NEW_FRAGMENT_TEXT, saved: null, format: NEW_FILE_FORMAT }
}

/** Tem alteração não salva: um arquivo novo sempre tem. */
export function isModified(document: FragmentDocument): boolean {
  return document.text !== document.saved?.text
}
```

- [ ] **Passo 5: Criar `src/renderer/src/application/use-cases/fragment-files.ts`**

```ts
import {
  checkNewFragmentPath,
  isFragmentFile,
  isFragmentFolder
} from '@/domain/fragments/fragment-path'
import { err, ok, type Result } from '@/domain/shared/result'
import type { ProjectStorage } from '../ports/project-storage'

/**
 * Os fragmentos na pasta do projeto (Fase 6): a lista da árvore e o caminho de um arquivo
 * novo. As duas coisas dependem das mesmas regras e do nome da pasta de saída.
 */
export class FragmentFiles {
  private readonly storage: ProjectStorage
  private readonly outputDirectory: string

  constructor(storage: ProjectStorage, outputDirectory: string) {
    this.storage = storage
    this.outputDirectory = outputDirectory
  }

  /** Os caminhos de todos os fragmentos do projeto, pasta por pasta; ou o motivo da falha. */
  async list(): Promise<Result<string[], string>> {
    const found: string[] = []
    const folders = ['']
    for (let index = 0; index < folders.length; index++) {
      const folder = folders[index]
      const listed = await this.storage.list(folder)
      if (!listed.ok) {
        // Uma pasta apagada enquanto a lista era lida.
        if (listed.error.code === 'not-found' && folder !== '') continue
        return err(listed.error.message)
      }
      for (const entry of listed.value) {
        const path = folder === '' ? entry.name : `${folder}/${entry.name}`
        if (entry.kind === 'directory') {
          if (isFragmentFolder(path, this.outputDirectory)) folders.push(path)
        } else if (isFragmentFile(path, this.outputDirectory)) {
          found.push(path)
        }
      }
    }
    return ok(found)
  }

  /** O caminho de um fragmento novo, conferido contra os que já existem; ou o motivo da recusa. */
  checkNewPath(input: string, existing: readonly string[]): Result<string, string> {
    return checkNewFragmentPath(input, this.outputDirectory, existing)
  }
}
```

- [ ] **Passo 6: Criar `src/renderer/src/application/use-cases/open-fragment.ts`**

```ts
import { encodingProblem } from '@/domain/fragments/encoding'
import { fromFileContent } from '@/domain/fragments/text-format'
import { ok, type Result } from '@/domain/shared/result'
import type { FragmentDocument } from '../fragments/fragment-document'
import type { ProjectStorage, StorageError } from '../ports/project-storage'

const NOT_UTF_8 =
  'Este arquivo não está em UTF-8. Salve-o em UTF-8 em outro editor para poder editar aqui.'

/**
 * Lê um fragmento para o editor. Um arquivo em outra codificação fica só para leitura: os
 * acentos já chegaram trocados, e gravá-lo de volta os perderia de vez.
 */
export class OpenFragment {
  private readonly storage: ProjectStorage

  constructor(storage: ProjectStorage) {
    this.storage = storage
  }

  async execute(path: string): Promise<Result<FragmentDocument, StorageError>> {
    const read = await this.storage.readText(path)
    if (!read.ok) return read
    const { content, hash } = read.value
    const { text, format } = fromFileContent(content)
    const document: FragmentDocument = { path, text, format, saved: { text, hash } }
    return ok(
      encodingProblem(content) === undefined ? document : { ...document, readOnly: NOT_UTF_8 }
    )
  }
}
```

- [ ] **Passo 7: Criar `src/renderer/src/application/use-cases/save-fragments.ts`**

```ts
import { toFileContent } from '@/domain/fragments/text-format'
import { fileError, type FileProblem } from '../file-problem'
import {
  isModified,
  type FragmentDocument,
  type SavedFragment
} from '../fragments/fragment-document'
import type { FragmentChecker } from '../ports/fragment-checker'
import type { ProjectStorage, WritePrecondition } from '../ports/project-storage'
import type { SaveOptions } from './save-project'

export interface SaveFragmentsResult {
  /** O que foi gravado, por caminho. */
  readonly saved: ReadonlyMap<string, SavedFragment>
  /** A conferência de cada fragmento gravado; lista vazia = sem problema. */
  readonly checked: ReadonlyMap<string, readonly FileProblem[]>
  /** Fragmentos alterados fora do app, que não foram gravados (SPEC §8). */
  readonly conflicts: string[]
  /** Outros erros de gravação. */
  readonly problems: FileProblem[]
}

export interface SaveFragmentsDependencies {
  readonly storage: ProjectStorage
  readonly checker: FragmentChecker
}

/**
 * Grava os fragmentos alterados no formato de cada arquivo, com as precondições do resto do
 * projeto: o disco precisa estar como na última leitura, e um arquivo novo não pode existir.
 * Um fragmento com erro de XML é gravado mesmo assim; a conferência vai junto no resultado.
 */
export class SaveFragments {
  private readonly deps: SaveFragmentsDependencies

  constructor(deps: SaveFragmentsDependencies) {
    this.deps = deps
  }

  async execute(
    documents: readonly FragmentDocument[],
    options: SaveOptions = { overwrite: false }
  ): Promise<SaveFragmentsResult> {
    const saved = new Map<string, SavedFragment>()
    const checked = new Map<string, readonly FileProblem[]>()
    const conflicts: string[] = []
    const problems: FileProblem[] = []

    for (const document of documents) {
      if (!isModified(document) || document.readOnly !== undefined) continue
      const content = toFileContent(document.text, document.format)
      const written = await this.deps.storage.writeText(
        document.path,
        content,
        preconditionFor(document, options)
      )
      if (!written.ok) {
        if (written.error.code === 'changed-externally') conflicts.push(document.path)
        else problems.push(fileError(document.path, written.error.message))
        continue
      }
      saved.set(document.path, { text: document.text, hash: written.value })
      checked.set(document.path, await this.deps.checker.check(document.path, content))
    }
    return { saved, checked, conflicts, problems }
  }
}

function preconditionFor(document: FragmentDocument, options: SaveOptions): WritePrecondition {
  if (options.overwrite) return { kind: 'overwrite' }
  if (document.saved === null) return { kind: 'must-not-exist' }
  return { kind: 'hash', expectedHash: document.saved.hash }
}
```

- [ ] **Passo 8: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/save-fragments-check.mts
```

Esperado, exatamente:

```
— listar
fragmentos                           → docs/loja/visao-geral.xml docs/pagamento/latin1.xml docs/pagamento/pix.xml raiz.xml
caminho novo Docs/Pagamento/…        → docs/pagamento/cartao.xml
caminho novo docs/pagamento/PIX…     → "docs/pagamento/PIX.xml" já existe.
— abrir
pix.xml                              → "<?xml version=\"1.0\"?>\n<topic>\n  <title>PIX</title>\n</topic>\n" bom=true quebra="\r\n"
pix.xml só leitura?                  → não
latin1.xml só leitura?               → Este arquivo não está em UTF-8. Salve-o em UTF-8 em outro editor para poder editar aqui.
arquivo que não existe               → not-found
— salvar só os alterados
resultado                            → gravados [docs/pagamento/pix.xml, docs/pagamento/cartao.xml]
    conflitos []
    erros []
      docs/pagamento/pix.xml: ok
      docs/pagamento/cartao.xml: ok
pix.xml no disco                     → "<BOM><?xml version=\"1.0\"?>\r\n<topic>\r\n  <title>Pagamento com PIX</title>\r\n</topic>\r\n"
cartao.xml no disco                  → "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<topic>\n  <title>Cartão</title>\n</topic>\n"
latin1.xml no disco                  → "<?xml version=\"1.0\"?>\n<t>Informa��o</t>\n"
— salvar de novo, sem mudança
resultado                            → gravados []
    conflitos []
    erros []
— com erro de XML
resultado                            → gravados [docs/pagamento/pix.xml]
    conflitos []
    erros []
      docs/pagamento/pix.xml: linha 3 Opening and ending tag mismatch: title line 3 and titulo
— alterado fora do app
salvar                               → gravados []
    conflitos [docs/pagamento/pix.xml]
    erros []
pix.xml no disco                     → "<BOM><?xml version=\"1.0\"?>\r\n<topic>\r\n  <title>git pull</title>\r\n</topic>\r\n"
Sobrescrever                         → gravados [docs/pagamento/pix.xml]
    conflitos []
    erros []
      docs/pagamento/pix.xml: ok
pix.xml no disco                     → "<BOM><?xml version=\"1.0\"?>\r\n<topic>\r\n  <title>Pagamento com PIX</title>\r\n</topic>\r\n"
— arquivo novo que apareceu por fora
salvar                               → gravados []
    conflitos [docs/novo.xml]
    erros []
Sobrescrever                         → gravados [docs/novo.xml]
    conflitos []
    erros []
      docs/novo.xml: ok
no disco                             → DOCS/NOVO.XML
— apagado por fora, com alteração
salvar                               → gravados []
    conflitos [docs/loja/visao-geral.xml]
    erros []
Sobrescrever                         → gravados [docs/loja/visao-geral.xml]
    conflitos []
    erros []
      docs/loja/visao-geral.xml: ok
— erro de disco
salvar                               → gravados []
    conflitos []
    erros [raiz.xml Erro ao acessar "raiz.xml": EPERM]
```

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

```ts
// Store da aba Fragmentos sobre uma pasta em memória (plano da Fase 6, Tarefa 4).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/fragments-store-check.mts
import { readFileSync } from 'node:fs'
import type { ProjectSession } from '@/application/project-session'
import { FragmentFiles } from '@/application/use-cases/fragment-files'
import { OpenFragment } from '@/application/use-cases/open-fragment'
import { SaveFragments } from '@/application/use-cases/save-fragments'
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { XmlFragmentChecker } from '@/infrastructure/xml/xml-fragment-checker'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { fragmentTreePaths, shownFragment } from '@/ui/stores/fragments-actions'
import { createProjectStore, hasUnsavedChanges } from '@/ui/stores/project-store'
import { NodeXmlValidator } from './generation-support.mts'
import { memoryFolder } from './memory-folder.mts'

const example = (path: string): string => readFileSync(`docs/examples/loja-online/${path}`, 'utf8')
const model = decodeFeatureModel(parseXmlRoot(example('model.xml')))
if (!model.ok) throw new Error('o exemplo não abriu')
const folder = memoryFolder({
  'model.xml': example('model.xml'),
  'docs/loja/visao-geral.xml': example('docs/loja/visao-geral.xml'),
  'docs/pagamento/pix.xml': example('docs/pagamento/pix.xml'),
  'docs/pagamento/boleto.xml': example('docs/pagamento/boleto.xml'),
  'docs/antigo.xml':
    '<?xml version="1.0" encoding="ISO-8859-1"?>\n<t>Informa\u{FFFD}\u{FFFD}o</t>\n'
})
const session = (): ProjectSession => ({
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: { model: model.value, assets: EMPTY_ASSET_CATALOG, configurations: [] },
  hashes: { model: 'x', assets: null, configurations: {} }
})
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}
const checker = new XmlFragmentChecker(new NodeXmlValidator())
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session: session(), warnings: [] }),
    reopen: async () => ({ status: 'opened', session: session(), warnings: [] })
  },
  createProject: { execute: notUsed },
  saveProject: { execute: async (current) => ({ session: current, conflicts: [], problems: [] }) },
  resolveConfiguration: { execute: () => notUsed() as never },
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} },
  checkAssetFiles: { execute: async () => new Map() },
  filePicker: { pickFile: notUsed },
  assetOpener: { open: notUsed },
  generateProduct: { execute: notUsed },
  outputFolderOpener: { open: notUsed },
  fragmentFiles: new FragmentFiles(folder.storage, 'saida'),
  openFragment: new OpenFragment(folder.storage),
  saveFragments: new SaveFragments({ storage: folder.storage, checker }),
  fragmentChecker: checker
})
const state = () => store.getState()
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const tree = (): string =>
  fragmentTreePaths(state().fragmentFiles, state().fragmentDocuments).sort().join(' ')
const problems = (path: string): string => {
  const found = state().fragmentProblems.get(path)
  if (found === undefined) return '(não conferido)'
  return found.length === 0 ? 'ok' : found.map((p) => `linha ${p.line} ${p.message}`).join(' | ')
}
const unsaved = (): string => (hasUnsavedChanges(state()) ? '•' : 'salvo')
const text = (path: string): string => JSON.stringify(state().fragmentDocuments.get(path)?.text)
const PIX = 'docs/pagamento/pix.xml'

console.log('— abrir o projeto e a aba')
await state().open()
await state().refreshFragments()
log('antes da aba, Atualizar', state().fragmentFiles === null ? 'não lê as pastas' : 'leu?!')
await state().loadFragmentFiles()
log('árvore', tree())
await state().showFragment(PIX)
log('exibido', shownFragment(state())?.path)
log('problemas', problems(PIX))
log('título', unsaved())

console.log('— editar e salvar')
const original = state().fragmentDocuments.get(PIX)!.text
state().changeFragmentText(PIX, original.replace('Pagamento com PIX', 'Pague com PIX'))
log('depois de digitar', unsaved())
state().changeFragmentText(PIX, original)
log('voltando ao texto do disco', unsaved())
state().changeFragmentText(PIX, original.replace('Pagamento com PIX', 'Pague com PIX'))
await state().save()
log(
  'depois do Ctrl+S',
  `${unsaved()} · conflitos ${state().conflicts.length} · avisos ${state().fragmentWarnings.size}`
)
log('no disco', folder.show(PIX).includes('Pague com PIX') ? 'título novo' : 'título antigo')

console.log('— com erro de XML')
const saved = state().fragmentDocuments.get(PIX)!.text
state().changeFragmentText(PIX, saved.replace('</title>', '</titulo>'))
await state().checkFragment(PIX)
log('problemas', problems(PIX))
await state().save()
log(
  'depois do Ctrl+S',
  `${unsaved()} · avisos: ${[...state().fragmentWarnings.values()].map((w) => `${w.file}:${w.line} ${w.message}`).join(' | ')}`
)
state().changeFragmentText(PIX, saved)
await state().save()
log(
  'corrigido e salvo',
  `${unsaved()} · avisos ${state().fragmentWarnings.size} · problemas ${problems(PIX)}`
)

console.log('— só para leitura')
await state().showFragment('docs/antigo.xml')
log('antigo.xml', state().fragmentDocuments.get('docs/antigo.xml')?.readOnly)
state().changeFragmentText('docs/antigo.xml', 'texto novo')
log('digitar nele', `${text('docs/antigo.xml')} · ${unsaved()}`)
log('problemas', problems('docs/antigo.xml'))

console.log('— fragmento novo')
log('caminho docs/pagamento/PIX.xml', state().checkNewFragmentPath('docs/pagamento/PIX.xml'))
log('criar configurations/x.xml', state().createFragment('configurations/x.xml'))
log(
  'criar Docs/Pagamento/cartao.xml',
  state().createFragment('Docs/Pagamento/cartao.xml') ?? 'criado'
)
await state().checkFragment('docs/pagamento/cartao.xml')
log('exibido', `${shownFragment(state())?.path} · ${text('docs/pagamento/cartao.xml')}`)
log('problemas', problems('docs/pagamento/cartao.xml'))
log('árvore', tree())
log('título', unsaved())
log('criar o mesmo de novo', state().createFragment('docs/pagamento/cartao.xml'))
state().discardFragment('docs/pagamento/cartao.xml')
log(
  'descartado',
  `exibido ${shownFragment(state())?.path ?? '(nenhum)'} · ${unsaved()} · árvore ${tree()}`
)
state().createFragment('docs/pagamento/cartao.xml')
state().changeFragmentText(
  'docs/pagamento/cartao.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<topic xmlns="urn:exemplo:doc">\n  <title>Cartão</title>\n</topic>\n'
)
await state().save()
log(
  'salvo',
  `${unsaved()} · no disco ${folder.show('docs/pagamento/cartao.xml').includes('Cartão') ? 'o texto digitado' : 'outro'} · árvore ${tree()}`
)

console.log('— descartar alterações')
await state().showFragment('docs/loja/visao-geral.xml')
const visao = text('docs/loja/visao-geral.xml')
state().changeFragmentText('docs/loja/visao-geral.xml', 'rascunho')
log('alterado', unsaved())
state().discardFragment('docs/loja/visao-geral.xml')
log(
  'descartado',
  `${unsaved()} · texto ${text('docs/loja/visao-geral.xml') === visao ? 'do disco' : 'outro'}`
)

console.log('— mudanças fora do app, e a janela volta ao foco')
folder.write('docs/loja/visao-geral.xml', '<topic>\n  <title>Mudou por fora</title>\n</topic>\n')
folder.write('docs/busca/busca.xml', '<topic/>\n')
await state().showFragment('docs/pagamento/boleto.xml')
folder.delete('docs/pagamento/boleto.xml')
state().changeFragmentText(PIX, `${state().fragmentDocuments.get(PIX)!.text}<!-- minha -->\n`)
folder.write(PIX, '<topic>\n  <title>git pull</title>\n</topic>\n')
await state().showFragment('docs/loja/visao-geral.xml')
await state().refreshFragments()
log('árvore', tree())
log('visao-geral.xml (sem alteração)', text('docs/loja/visao-geral.xml'))
log(
  'pix.xml (com alteração)',
  state().fragmentDocuments.get(PIX)?.text.includes('minha') ? 'mantido' : 'trocado'
)
log('problemas do exibido', problems('docs/loja/visao-geral.xml'))
await state().save()
log('Ctrl+S', `conflitos [${state().conflicts.join(', ')}] · ${unsaved()}`)
await state().save({ overwrite: true })
log('Sobrescrever', `conflitos [${state().conflicts.join(', ')}] · ${unsaved()}`)
log('pix.xml no disco', folder.show(PIX).includes('minha') ? 'o meu' : 'o de fora')

console.log('— apagado por fora: exibido sem alteração, e com alteração')
await state().showFragment('docs/busca/busca.xml')
folder.delete('docs/busca/busca.xml')
await state().refreshFragments()
log('busca.xml', `exibido ${shownFragment(state())?.path ?? '(nenhum)'} · árvore ${tree()}`)
await state().showFragment('docs/loja/visao-geral.xml')
state().changeFragmentText('docs/loja/visao-geral.xml', '<topic/>\n')
folder.delete('docs/loja/visao-geral.xml')
await state().refreshFragments()
log(
  'visao-geral.xml',
  `novo? ${state().fragmentDocuments.get('docs/loja/visao-geral.xml')?.saved === null} · árvore ${tree()}`
)
await state().save()
log(
  'Ctrl+S',
  `conflitos [${state().conflicts.join(', ')}] · ${unsaved()} · no disco ${folder.show('docs/loja/visao-geral.xml')}`
)

console.log('— recarregar e fechar')
state().changeFragmentText('docs/loja/visao-geral.xml', '<topic>rascunho</topic>\n')
await state().reload()
log(
  'Recarregar',
  `exibido ${shownFragment(state())?.path} · ${text('docs/loja/visao-geral.xml')} · ${unsaved()}`
)
state().changeFragmentText('docs/loja/visao-geral.xml', '<topic>outro</topic>\n')
state().close()
log(
  'Fechar',
  `${state().fragmentDocuments.size} abertos · aba ${state().fragmentFiles === null ? 'zerada' : 'não zerada'}`
)
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragments-store-check.mts
```

Esperado: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/ui' …`.

- [ ] **Passo 3: Criar `src/renderer/src/ui/stores/fragments-actions.ts`**

```ts
import type { StoreApi } from 'zustand/vanilla'
import type { FileProblem } from '@/application/file-problem'
import {
  isModified,
  newFragment,
  type FragmentDocument
} from '@/application/fragments/fragment-document'
import type { FragmentChecker } from '@/application/ports/fragment-checker'
import type { StorageError } from '@/application/ports/project-storage'
import type { SaveFragmentsResult } from '@/application/use-cases/save-fragments'
import type { SaveOptions } from '@/application/use-cases/save-project'
import type { Result } from '@/domain/shared/result'
import type { ProjectState } from './project-store'

/** Os serviços da aba Fragmentos; a composition root entrega as implementações. */
export interface FragmentsServices {
  readonly fragmentFiles: {
    list(): Promise<Result<string[], string>>
    checkNewPath(input: string, existing: readonly string[]): Result<string, string>
  }
  readonly openFragment: {
    execute(path: string): Promise<Result<FragmentDocument, StorageError>>
  }
  readonly saveFragments: {
    execute(
      documents: readonly FragmentDocument[],
      options?: SaveOptions
    ): Promise<SaveFragmentsResult>
  }
  readonly fragmentChecker: FragmentChecker
}

/**
 * Estado e ações da aba Fragmentos (Fase 6). O texto editado entra no "•" e no Ctrl+S do
 * projeto; o desfazer do texto fica com o editor, fora do histórico.
 */
export interface FragmentsState {
  /** Os fragmentos no disco, na última leitura das pastas; `null` antes de a aba ser aberta. */
  readonly fragmentFiles: readonly string[] | null
  /** Os fragmentos abertos, por caminho: os lidos do disco e os novos. */
  readonly fragmentDocuments: ReadonlyMap<string, FragmentDocument>
  /** O fragmento no editor. */
  readonly shownFragmentPath: string | null
  /** A última conferência de cada fragmento aberto. */
  readonly fragmentProblems: ReadonlyMap<string, readonly FileProblem[]>
  /** Os fragmentos salvos com erro de XML, com o primeiro problema, para a faixa de avisos. */
  readonly fragmentWarnings: ReadonlyMap<string, FileProblem>

  /** Lê as pastas do projeto (ao entrar na aba). */
  loadFragmentFiles(): Promise<void>
  /** Mostra o fragmento no editor, lendo-o do disco se ainda não estiver aberto. */
  showFragment(path: string): Promise<void>
  changeFragmentText(path: string, text: string): void
  /** Confere o texto atual. Se outra conferência do mesmo arquivo começou depois, esta é descartada. */
  checkFragment(path: string): Promise<void>
  /** O motivo da recusa do caminho de um fragmento novo, ou `null` quando ele serve. */
  checkNewFragmentPath(input: string): string | null
  /** Cria o fragmento só no editor (vai para o disco no Ctrl+S) e o mostra; ou o motivo da recusa. */
  createFragment(input: string): string | null
  /** Volta ao texto do disco; um fragmento novo sai da lista. */
  discardFragment(path: string): void
  /** Relê as pastas e os fragmentos sem alteração (a janela voltou ao foco, ou "Atualizar"). */
  refreshFragments(): Promise<void>
  /** Grava os fragmentos alterados, como parte do Ctrl+S; devolve os conflitos e os erros. */
  saveFragments(options?: SaveOptions): Promise<Pick<SaveFragmentsResult, 'conflicts' | 'problems'>>
}

export const FRAGMENTS_CLOSED = {
  fragmentFiles: null,
  fragmentDocuments: new Map<string, FragmentDocument>(),
  shownFragmentPath: null,
  fragmentProblems: new Map<string, readonly FileProblem[]>(),
  fragmentWarnings: new Map<string, FileProblem>()
} satisfies Partial<FragmentsState>

/** O fragmento no editor, se houver. */
export function shownFragment(state: ProjectState): FragmentDocument | null {
  const path = state.shownFragmentPath
  return path === null ? null : (state.fragmentDocuments.get(path) ?? null)
}

export function hasModifiedFragments(state: ProjectState): boolean {
  return [...state.fragmentDocuments.values()].some(isModified)
}

/**
 * Os caminhos da árvore: os do disco e os fragmentos novos, que só existem no editor. Um novo
 * que apareceu no disco (criado por fora, com qualquer caixa) não se repete.
 */
export function fragmentTreePaths(
  files: readonly string[] | null,
  documents: ReadonlyMap<string, FragmentDocument>
): string[] {
  const onDisk = files ?? []
  const known = new Set(onDisk.map((path) => path.toLowerCase()))
  const created = [...documents.values()]
    .filter((document) => document.saved === null && !known.has(document.path.toLowerCase()))
    .map((document) => document.path)
  return [...onDisk, ...created]
}

type SetState = StoreApi<ProjectState>['setState']

export function createFragmentsActions(
  set: SetState,
  get: () => ProjectState,
  services: FragmentsServices
): Omit<FragmentsState, keyof typeof FRAGMENTS_CLOSED> {
  // Cada leitura das pastas e cada conferência recebem um número; só a última é usada.
  let lastListing = 0
  const lastCheck = new Map<string, number>()
  /** O texto da última conferência de cada fragmento, para não conferir o mesmo texto de novo. */
  const checkedText = new Map<string, string>()

  const setDocument = (document: FragmentDocument): void => {
    const documents = new Map(get().fragmentDocuments)
    documents.set(document.path, document)
    set({ fragmentDocuments: documents })
  }

  const removeDocument = (path: string): void => {
    const { fragmentDocuments, fragmentProblems, shownFragmentPath } = get()
    const documents = new Map(fragmentDocuments)
    documents.delete(path)
    const problems = new Map(fragmentProblems)
    problems.delete(path)
    set({
      fragmentDocuments: documents,
      fragmentProblems: problems,
      shownFragmentPath: shownFragmentPath === path ? null : shownFragmentPath
    })
  }

  /** Lê as pastas; `null` se a leitura falhou (o motivo vai para a faixa) ou ficou velha. */
  const listFiles = async (): Promise<readonly string[] | null> => {
    const session = get().session
    if (session === null) return null
    const listing = ++lastListing
    const listed = await services.fragmentFiles.list()
    if (listing !== lastListing || get().session?.folder !== session.folder) return null
    if (!listed.ok) {
      set({ notice: `Não foi possível ler as pastas do projeto: ${listed.error}` })
      return null
    }
    set({ fragmentFiles: listed.value })
    return listed.value
  }

  /** Os caminhos que um fragmento novo não pode repetir. */
  const existingPaths = (): string[] => [
    ...(get().fragmentFiles ?? []),
    ...get().fragmentDocuments.keys()
  ]

  return {
    async loadFragmentFiles() {
      await listFiles()
    },

    async showFragment(path) {
      const session = get().session
      if (session === null) return
      if (!get().fragmentDocuments.has(path)) {
        const opened = await services.openFragment.execute(path)
        if (get().session?.folder !== session.folder) return
        if (!opened.ok) {
          set({ notice: `Não foi possível abrir "${path}": ${opened.error.message}` })
          // O arquivo sumiu depois da última leitura das pastas.
          if (opened.error.code === 'not-found') void listFiles()
          return
        }
        // Se outro clique já o abriu enquanto este lia, fica o que já estava.
        if (!get().fragmentDocuments.has(path)) setDocument(opened.value)
      }
      set({ shownFragmentPath: path })
      await get().checkFragment(path)
    },

    changeFragmentText(path, text) {
      const document = get().fragmentDocuments.get(path)
      if (document === undefined || document.readOnly !== undefined || document.text === text) {
        return
      }
      setDocument({ ...document, text })
    },

    async checkFragment(path) {
      const session = get().session
      const document = get().fragmentDocuments.get(path)
      if (session === null || document === undefined) return
      if (get().fragmentProblems.has(path) && checkedText.get(path) === document.text) return
      const check = (lastCheck.get(path) ?? 0) + 1
      lastCheck.set(path, check)
      const problems = await services.fragmentChecker.check(path, document.text)
      if (lastCheck.get(path) !== check || get().session?.folder !== session.folder) return
      if (!get().fragmentDocuments.has(path)) return
      const all = new Map(get().fragmentProblems)
      all.set(path, problems)
      checkedText.set(path, document.text)
      set({ fragmentProblems: all })
    },

    checkNewFragmentPath(input) {
      const checked = services.fragmentFiles.checkNewPath(input, existingPaths())
      return checked.ok ? null : checked.error
    },

    createFragment(input) {
      const checked = services.fragmentFiles.checkNewPath(input, existingPaths())
      if (!checked.ok) return checked.error
      setDocument(newFragment(checked.value))
      void get().showFragment(checked.value)
      return null
    },

    discardFragment(path) {
      const document = get().fragmentDocuments.get(path)
      if (document === undefined) return
      if (document.saved === null) removeDocument(path)
      else setDocument({ ...document, text: document.saved.text })
    },

    async refreshFragments() {
      const { session, fragmentFiles } = get()
      // Só depois de a aba ter sido aberta com este projeto.
      if (session === null || fragmentFiles === null) return
      if ((await listFiles()) === null) return
      for (const document of get().fragmentDocuments.values()) {
        if (document.saved === null) continue
        const reread = await services.openFragment.execute(document.path)
        if (get().session?.folder !== session.folder) return
        const current = get().fragmentDocuments.get(document.path)
        if (current === undefined) continue
        if (!reread.ok) {
          if (reread.error.code !== 'not-found') continue
          // Apagado fora do app: sem alteração, sai da lista; com alteração, vira novo.
          if (isModified(current)) setDocument({ ...current, saved: null })
          else removeDocument(current.path)
          continue
        }
        // Mudou fora do app: sem alteração no app, o editor passa a mostrar o texto novo. Com
        // alteração, fica como está, e o conflito aparece ao salvar.
        if (!isModified(current) && reread.value.saved?.hash !== current.saved?.hash) {
          setDocument(reread.value)
        }
      }
      const shown = get().shownFragmentPath
      if (shown !== null) await get().checkFragment(shown)
    },

    async saveFragments(options) {
      const session = get().session
      const documents = [...get().fragmentDocuments.values()].filter(isModified)
      if (session === null || documents.length === 0) return { conflicts: [], problems: [] }
      const result = await services.saveFragments.execute(documents, options)
      if (get().session?.folder !== session.folder) return { conflicts: [], problems: [] }

      const saved = new Map(get().fragmentDocuments)
      const problems = new Map(get().fragmentProblems)
      const warnings = new Map(get().fragmentWarnings)
      // Um fragmento novo gravado já está no disco: entra na lista das pastas agora, senão sairia
      // da árvore até a próxima leitura.
      const files = get().fragmentFiles
      const known = new Set(files?.map((path) => path.toLowerCase()))
      const created: string[] = []
      for (const [path, written] of result.saved) {
        const current = saved.get(path)
        if (current === undefined) continue
        if (current.saved === null && !known.has(path.toLowerCase())) created.push(path)
        // Uma edição feita durante a gravação é mantida: o fragmento continua alterado.
        saved.set(path, { ...current, saved: written })
        const found = result.checked.get(path) ?? []
        if (current.text === written.text) {
          problems.set(path, found)
          checkedText.set(path, written.text)
        }
        if (found.length === 0) warnings.delete(path)
        else {
          warnings.set(path, {
            ...found[0],
            severity: 'warning',
            message: `Salvo com erro de XML: ${found[0].message}`
          })
        }
      }
      set({
        fragmentFiles: files === null ? null : [...files, ...created],
        fragmentDocuments: saved,
        fragmentProblems: problems,
        fragmentWarnings: warnings
      })
      return { conflicts: result.conflicts, problems: result.problems }
    }
  }
}
```

- [ ] **Passo 4: Montar as ações em `src/renderer/src/ui/stores/project-store.ts`**

Troque:

<!-- prettier-ignore -->
```ts
} from './assets-actions'
import {
  createGenerationActions,
  GENERATION_CLOSED,
```

por:

<!-- prettier-ignore -->
```ts
} from './assets-actions'
import {
  createFragmentsActions,
  FRAGMENTS_CLOSED,
  hasModifiedFragments,
  type FragmentsServices,
  type FragmentsState
} from './fragments-actions'
import {
  createGenerationActions,
  GENERATION_CLOSED,
```

Troque:

<!-- prettier-ignore -->
```ts

/** Casos de uso e serviços de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices extends AssetsServices, GenerationServices {
  readonly openProject: {
    execute(): Promise<OpenProjectResult>
```

por:

<!-- prettier-ignore -->
```ts

/** Casos de uso e serviços de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices
  extends AssetsServices, GenerationServices, FragmentsServices {
  readonly openProject: {
    execute(): Promise<OpenProjectResult>
```

Troque:

<!-- prettier-ignore -->
```ts
}

export interface ProjectState extends AssetsState, GenerationState {
  readonly session: ProjectSession | null
  /** O projeto como está no disco; comparar com a sessão diz se há alterações. */
```

por:

<!-- prettier-ignore -->
```ts
}

export interface ProjectState extends AssetsState, GenerationState, FragmentsState {
  readonly session: ProjectSession | null
  /** O projeto como está no disco; comparar com a sessão diz se há alterações. */
```

Troque:

<!-- prettier-ignore -->
```ts
    model !== state.saved.model ||
    assets !== state.saved.assets ||
    configurations !== state.saved.configurations
  )
}
```

por:

<!-- prettier-ignore -->
```ts
    model !== state.saved.model ||
    assets !== state.saved.assets ||
    configurations !== state.saved.configurations ||
    hasModifiedFragments(state)
  )
}
```

Troque:

<!-- prettier-ignore -->
```ts
  lastSavedAt: null,
  ...ASSETS_CLOSED,
  ...GENERATION_CLOSED
} satisfies Partial<ProjectState>
```

por:

<!-- prettier-ignore -->
```ts
  lastSavedAt: null,
  ...ASSETS_CLOSED,
  ...GENERATION_CLOSED,
  ...FRAGMENTS_CLOSED
} satisfies Partial<ProjectState>
```

Troque:

<!-- prettier-ignore -->
```ts
      ...createAssetsActions(set, get, services),
      ...createGenerationActions(set, get, services),

      async loadRecents() {
```

por:

<!-- prettier-ignore -->
```ts
      ...createAssetsActions(set, get, services),
      ...createGenerationActions(set, get, services),
      ...createFragmentsActions(set, get, services),

      async loadRecents() {
```

Troque:

<!-- prettier-ignore -->
```ts
        set({ busy: true, problems: [], conflicts: [] })
        const result = await services.saveProject.execute(session, options)
        const complete = result.conflicts.length === 0 && result.problems.length === 0
        set({
          busy: false,
          // Da sessão, só os hashes mudam: uma edição feita durante a gravação é mantida.
          session: { ...get().session!, hashes: result.session.hashes },
          conflicts: result.conflicts,
          problems: result.problems,
          ...(complete ? { saved: session.project, lastSavedAt: new Date() } : {})
        })
      },

      async reload() {
        const { session, openConfigurationKey } = get()
        if (session === null) return
        set({ busy: true, problems: [], conflicts: [] })
```

por:

<!-- prettier-ignore -->
```ts
        set({ busy: true, problems: [], conflicts: [] })
        const result = await services.saveProject.execute(session, options)
        // Os fragmentos vão depois dos arquivos do projeto, no mesmo Ctrl+S.
        const fragments = await get().saveFragments(options)
        // O projeto foi fechado ou trocado durante a gravação.
        if (get().session?.folder !== session.folder) {
          set({ busy: false })
          return
        }
        const projectSaved = result.conflicts.length === 0 && result.problems.length === 0
        const complete =
          projectSaved && fragments.conflicts.length === 0 && fragments.problems.length === 0
        set({
          busy: false,
          // Da sessão, só os hashes mudam: uma edição feita durante a gravação é mantida.
          session: { ...get().session!, hashes: result.session.hashes },
          conflicts: [...result.conflicts, ...fragments.conflicts],
          problems: [...result.problems, ...fragments.problems],
          ...(projectSaved ? { saved: session.project } : {}),
          ...(complete ? { lastSavedAt: new Date() } : {})
        })
      },

      async reload() {
        const { session, openConfigurationKey, fragmentFiles, shownFragmentPath } = get()
        if (session === null) return
        set({ busy: true, problems: [], conflicts: [] })
```

Troque:

<!-- prettier-ignore -->
```ts
        if (reopened?.some((entry) => entry.key === openConfigurationKey)) {
          set({ openConfigurationKey })
        }
      },
```

por:

<!-- prettier-ignore -->
```ts
        if (reopened?.some((entry) => entry.key === openConfigurationKey)) {
          set({ openConfigurationKey })
        }
        // A aba Fragmentos relê as pastas, e o fragmento exibido volta, relido do disco.
        if (fragmentFiles === null || get().session === null) return
        await get().loadFragmentFiles()
        if (shownFragmentPath !== null && get().fragmentFiles?.includes(shownFragmentPath)) {
          await get().showFragment(shownFragmentPath)
        }
      },
```

- [ ] **Passo 5: Injetar os serviços em `src/renderer/src/ui/app/composition-root.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import { CheckAssetFiles } from '@/application/use-cases/check-asset-files'
import { CreateProject } from '@/application/use-cases/create-project'
import { GenerateProduct } from '@/application/use-cases/generate-product'
import { OpenProject } from '@/application/use-cases/open-project'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { SaveProject } from '@/application/use-cases/save-project'
import { WriteProductFolder } from '@/application/use-cases/write-product-folder'
```

por:

<!-- prettier-ignore -->
```ts
import { CheckAssetFiles } from '@/application/use-cases/check-asset-files'
import { CreateProject } from '@/application/use-cases/create-project'
import { FragmentFiles } from '@/application/use-cases/fragment-files'
import { GenerateProduct } from '@/application/use-cases/generate-product'
import { OpenFragment } from '@/application/use-cases/open-fragment'
import { OpenProject } from '@/application/use-cases/open-project'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { SaveFragments } from '@/application/use-cases/save-fragments'
import { SaveProject } from '@/application/use-cases/save-project'
import { WriteProductFolder } from '@/application/use-cases/write-product-folder'
```

Troque:

<!-- prettier-ignore -->
```ts
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import { createProjectStore, type ProjectStore } from '@/ui/stores/project-store'
```

por:

<!-- prettier-ignore -->
```ts
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'
import { XmlFragmentChecker } from '@/infrastructure/xml/xml-fragment-checker'
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import { createProjectStore, type ProjectStore } from '@/ui/stores/project-store'
```

Troque:

<!-- prettier-ignore -->
```ts
  // Uma só resolução para a tela e a geração: o resultado guardado serve às duas.
  const resolveConfiguration = new ResolveConfiguration(new LogicSolverConstraintSolver())
  return createProjectStore({
    openProject: new OpenProject({ picker, recents, ...repositories }),
```

por:

<!-- prettier-ignore -->
```ts
  // Uma só resolução para a tela e a geração: o resultado guardado serve às duas.
  const resolveConfiguration = new ResolveConfiguration(new LogicSolverConstraintSolver())
  // O editor de fragmentos confere como a geração confere.
  const fragmentChecker = new XmlFragmentChecker(validator)
  return createProjectStore({
    openProject: new OpenProject({ picker, recents, ...repositories }),
```

Troque:

<!-- prettier-ignore -->
```ts
      clock: new SystemClock()
    }),
    outputFolderOpener: new ElectronOutputFolderOpener()
  })
}
```

por:

<!-- prettier-ignore -->
```ts
      clock: new SystemClock()
    }),
    outputFolderOpener: new ElectronOutputFolderOpener(),
    fragmentFiles: new FragmentFiles(storage, OUTPUT_DIRECTORY),
    openFragment: new OpenFragment(storage),
    saveFragments: new SaveFragments({ storage, checker: fragmentChecker }),
    fragmentChecker
  })
}
```

- [ ] **Passo 6: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragments-store-check.mts
```

Esperado, exatamente:

```
— abrir o projeto e a aba
antes da aba, Atualizar              → não lê as pastas
árvore                               → docs/antigo.xml docs/loja/visao-geral.xml docs/pagamento/boleto.xml docs/pagamento/pix.xml
exibido                              → docs/pagamento/pix.xml
problemas                            → ok
título                               → salvo
— editar e salvar
depois de digitar                    → •
voltando ao texto do disco           → salvo
depois do Ctrl+S                     → salvo · conflitos 0 · avisos 0
no disco                             → título novo
— com erro de XML
problemas                            → linha 3 Opening and ending tag mismatch: title line 3 and titulo
depois do Ctrl+S                     → salvo · avisos: docs/pagamento/pix.xml:3 Salvo com erro de XML: Opening and ending tag mismatch: title line 3 and titulo
corrigido e salvo                    → salvo · avisos 0 · problemas ok
— só para leitura
antigo.xml                           → Este arquivo não está em UTF-8. Salve-o em UTF-8 em outro editor para poder editar aqui.
digitar nele                         → "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>\n<t>Informa��o</t>\n" · salvo
problemas                            → linha 1 A codificação ISO-8859-1 não é suportada: salve o arquivo em UTF-8.
— fragmento novo
caminho docs/pagamento/PIX.xml       → "docs/pagamento/PIX.xml" já existe.
criar configurations/x.xml           → A pasta configurations/ é das configurações.
criar Docs/Pagamento/cartao.xml      → criado
exibido                              → docs/pagamento/cartao.xml · "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
problemas                            → linha 2 Start tag expected, '<' not found
árvore                               → docs/antigo.xml docs/loja/visao-geral.xml docs/pagamento/boleto.xml docs/pagamento/cartao.xml docs/pagamento/pix.xml
título                               → •
criar o mesmo de novo                → "docs/pagamento/cartao.xml" já existe.
descartado                           → exibido (nenhum) · salvo · árvore docs/antigo.xml docs/loja/visao-geral.xml docs/pagamento/boleto.xml docs/pagamento/pix.xml
salvo                                → salvo · no disco o texto digitado · árvore docs/antigo.xml docs/loja/visao-geral.xml docs/pagamento/boleto.xml docs/pagamento/cartao.xml docs/pagamento/pix.xml
— descartar alterações
alterado                             → •
descartado                           → salvo · texto do disco
— mudanças fora do app, e a janela volta ao foco
árvore                               → docs/antigo.xml docs/busca/busca.xml docs/loja/visao-geral.xml docs/pagamento/cartao.xml docs/pagamento/pix.xml
visao-geral.xml (sem alteração)      → "<topic>\n  <title>Mudou por fora</title>\n</topic>\n"
pix.xml (com alteração)              → mantido
problemas do exibido                 → ok
Ctrl+S                               → conflitos [docs/pagamento/pix.xml] · •
Sobrescrever                         → conflitos [] · salvo
pix.xml no disco                     → o meu
— apagado por fora: exibido sem alteração, e com alteração
busca.xml                            → exibido (nenhum) · árvore docs/antigo.xml docs/loja/visao-geral.xml docs/pagamento/cartao.xml docs/pagamento/pix.xml
visao-geral.xml                      → novo? true · árvore docs/antigo.xml docs/loja/visao-geral.xml docs/pagamento/cartao.xml docs/pagamento/pix.xml
Ctrl+S                               → conflitos [] · salvo · no disco "<topic/>\n"
— recarregar e fechar
Recarregar                           → exibido docs/loja/visao-geral.xml · "<topic/>\n" · salvo
Fechar                               → 0 abertos · aba zerada
```

- [ ] **Passo 7: Regressão das stores**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/assets-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/configurator-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
```

Esperado do `assets-store-check.mts`, exatamente (a saída do plano da Fase 4):

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

Do `configurator-store-check.mts`, exatamente (a saída do plano da Fase 3):

```
ao abrir                             → aberta null | alterações false
loja-basica                          → resolved | completa true | indecisas 0 | mobile propagated selected
mesma resolução enquanto nada muda   → true
clique em mobile (travada)           → propagated selected | alterações false
1º clique em pag_pix                 → manual deselected | mobile indecisa
2º clique em pag_pix                 → indecisa | mobile indecisa | resolved | completa false | indecisas 2
alterações pendentes                 → true
mobile manual + pag_pix              → mobile manual selected | pag_pix manual selected
clique em mobile pula o conflito     → mobile propagated selected | resolved | completa true | indecisas 0
valor inválido                       → o máximo é 500
valor válido                         → null
valor gravado                        → busca=200 mobile=android
criar sem nome                       → Informe o nome.
criar                                → loja-basica(Loja Básica) loja-completa(Loja Completa) | aberta loja-completa | resolved | completa false | indecisas 5
renomear a aberta                    → loja-basica(Loja Básica) loja-premium(Loja Premium) | aberta loja-premium
duplicar                             → loja-basica(Loja Básica) loja-basica-2(Loja Básica) loja-premium(Loja Premium) | aberta loja-basica-2
excluir a aberta                     → loja-basica(Loja Básica) loja-premium(Loja Premium) | aberta null
órfãs depois de excluir pag_pix      → pag_pix
depois de remover as órfãs           → 0 | resolved | completa false | indecisas 1
salvo                                → loja-basica loja-premium | alterações false
recarregar                           → aberta loja-basica
```

Do `generation-store-check.mts`, exatamente (a saída das correções da Fase 5):

```
1. sem projeto aberto                → null
   chamadas                          → 0
2. durante: gerando                  → true
   segundo clique                    → null
   resultado                         → generated
   depois: gerando                   → false
   última geração                    → loja-basica → saida/loja-basica
   alterações não salvas             → false
   chamadas                          → loja-basica
3. de novo                           → needs-confirmation
   substituir                        → generated
   chamadas                          → loja-basica, loja-basica (substituir)
4. problemas                         → problems
   última geração                    → loja-basica → saida/loja-basica
5. abriu                             → saida/loja-basica
   aviso                             → Não foi possível abrir saida/sumiu/: não existe
6. depois do ×                       → (nenhuma)
7. recarregado no meio               → null
   gerando                           → false
   última geração                    → (nenhuma)
8. depois de fechar                  → (nenhuma)
9. configuração aberta               → loja-outra
   substituir loja-basica            → generated
   chamada                           → loja-basica (substituir)
   última geração                    → loja-basica → saida/loja-basica
10. renomear outra                   → loja-basica → saida/loja-basica
    renomear a gerada                → (nenhuma)
    nome de volta                    → loja-basica, loja-outra-2 | (nenhuma)
11. excluir outra                    → loja-basica → saida/loja-basica
    excluir a gerada                 → (nenhuma)
    nova com a mesma chave           → loja-basica | (nenhuma)
12. falha na escrita de outra        → write-failed | loja-basica → saida/loja-basica
    falha na escrita da gerada       → write-failed | (nenhuma)
13. o caso de uso lança              → rejeitou: falha inesperada
    gerando                          → false
```

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

Troque:

<!-- prettier-ignore -->
```json
  },
  "dependencies": {
    "@electron-toolkit/utils": "^4.0.0",
    "@xmldom/xmldom": "^0.9.12",
    "@xyflow/react": "^12.11.6",
```

por:

<!-- prettier-ignore -->
```json
  },
  "dependencies": {
    "@codemirror/commands": "^6.11.1",
    "@codemirror/lang-xml": "^6.1.0",
    "@codemirror/language": "^6.12.4",
    "@codemirror/lint": "^6.9.7",
    "@codemirror/search": "^6.7.2",
    "@codemirror/state": "^6.7.6",
    "@codemirror/view": "^6.43.13",
    "@electron-toolkit/utils": "^4.0.0",
    "@lezer/highlight": "^1.2.4",
    "@xmldom/xmldom": "^0.9.12",
    "@xyflow/react": "^12.11.6",
```

- [ ] **Passo 2: As cores do editor em `src/renderer/src/ui/app/index.css`**

Troque:

<!-- prettier-ignore -->
```css
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}
```

por:

<!-- prettier-ignore -->
```css
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  /* Cores do editor de fragmentos (xml-editor-setup.ts). */
  --xml-tag: oklch(0.46 0.16 262);
  --xml-attribute: oklch(0.52 0.13 55);
  --xml-string: oklch(0.5 0.13 150);
  --xml-entity: oklch(0.55 0.18 25);
  --xml-comment: oklch(0.556 0 0);
  --xml-meta: oklch(0.5 0.14 320);
}
```

Troque:

<!-- prettier-ignore -->
```css
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}
```

por:

<!-- prettier-ignore -->
```css
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --xml-tag: oklch(0.75 0.12 250);
  --xml-attribute: oklch(0.8 0.11 70);
  --xml-string: oklch(0.78 0.13 150);
  --xml-entity: oklch(0.75 0.15 25);
  --xml-comment: oklch(0.65 0 0);
  --xml-meta: oklch(0.75 0.12 320);
}
```

- [ ] **Passo 3: Criar `src/renderer/src/ui/screens/fragments/xml-editor-setup.ts`**

As extensões do CodeMirror, as cores (das variáveis `--xml-*`), o tema e os textos em português.

```ts
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { xml } from '@codemirror/lang-xml'
import { HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { lintGutter, lintKeymap, type Diagnostic } from '@codemirror/lint'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { EditorState, type Text } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { FileProblem } from '@/application/file-problem'

/** Os textos do CodeMirror em português: o painel de busca, a lista de problemas… */
const PHRASES: Record<string, string> = {
  Find: 'Buscar',
  Replace: 'Substituir',
  next: 'próximo',
  previous: 'anterior',
  all: 'todos',
  'match case': 'maiúsculas',
  'by word': 'palavra inteira',
  regexp: 'expressão regular',
  replace: 'substituir',
  'replace all': 'substituir todos',
  close: 'fechar',
  'current match': 'ocorrência atual',
  'on line': 'na linha',
  'replaced match on line $': 'ocorrência substituída na linha $',
  'replaced $ matches': '$ ocorrências substituídas',
  'Go to line': 'Ir para a linha',
  go: 'ir',
  Diagnostics: 'Problemas',
  'No diagnostics': 'Nenhum problema',
  'Selection deleted': 'Seleção apagada',
  'Control character': 'Caractere de controle'
}

/** As cores vêm das variáveis do tema (index.css), que mudam no tema escuro. */
const XML_COLORS = HighlightStyle.define([
  { tag: [tags.tagName, tags.angleBracket], color: 'var(--xml-tag)' },
  { tag: tags.attributeName, color: 'var(--xml-attribute)' },
  { tag: [tags.attributeValue, tags.special(tags.string)], color: 'var(--xml-string)' },
  { tag: tags.character, color: 'var(--xml-entity)' },
  { tag: tags.blockComment, color: 'var(--xml-comment)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.documentMeta], color: 'var(--xml-meta)' },
  { tag: tags.invalid, color: 'var(--destructive)' }
])

const THEME = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    color: 'var(--foreground)',
    backgroundColor: 'var(--background)'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace' },
  '.cm-content': { caretColor: 'var(--foreground)' },
  '.cm-gutters': {
    color: 'var(--muted-foreground)',
    backgroundColor: 'var(--muted)',
    borderRight: '1px solid var(--border)'
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklch, var(--accent) 60%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--accent)' },
  '.cm-panels': { color: 'var(--foreground)', backgroundColor: 'var(--muted)' }
})

export interface XmlEditorOptions {
  readonly readOnly: boolean
  /** O texto mudou: digitação, colar, desfazer… */
  readonly onChange: (text: string) => void
}

/** O estado do CodeMirror para um fragmento: o texto, o histórico de desfazer e a seleção. */
export function createXmlEditorState(text: string, options: XmlEditorOptions): EditorState {
  return EditorState.create({
    doc: text,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      drawSelection(),
      indentOnInput(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      xml(),
      syntaxHighlighting(XML_COLORS),
      search({ top: true }),
      lintGutter(),
      keymap.of([
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...lintKeymap,
        indentWithTab
      ]),
      EditorState.phrases.of(PHRASES),
      EditorState.readOnly.of(options.readOnly),
      EditorView.editable.of(!options.readOnly),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange(update.state.doc.toString())
      }),
      THEME
    ]
  })
}

/** Os problemas da conferência como marcas do editor, cada um na linha inteira. */
export function diagnosticsFor(doc: Text, problems: readonly FileProblem[]): Diagnostic[] {
  return problems.map((problem) => {
    const line = doc.line(Math.min(Math.max(problem.line ?? 1, 1), doc.lines))
    return { from: line.from, to: line.to, severity: 'error', message: problem.message }
  })
}
```

- [ ] **Passo 4: Os estados do editor e a árvore**

Crie `src/renderer/src/ui/screens/fragments/fragment-editor-states.ts`:

```ts
import type { EditorState } from '@codemirror/state'

/**
 * O estado do CodeMirror de cada fragmento, com o desfazer e a seleção, por caminho. A tela do
 * projeto o guarda enquanto o projeto está aberto: trocar de arquivo ou de aba e voltar mantém
 * o histórico do texto.
 */
export type FragmentEditorStates = Map<string, EditorState>
```

Crie `src/renderer/src/ui/screens/fragments/fragment-tree.ts`:

```ts
export interface FragmentFolder {
  readonly name: string
  readonly path: string
  readonly folders: readonly FragmentFolder[]
  readonly files: readonly FragmentFile[]
}

export interface FragmentFile {
  readonly name: string
  readonly path: string
}

interface GrowingFolder {
  readonly name: string
  readonly path: string
  readonly folders: Map<string, GrowingFolder>
  readonly files: FragmentFile[]
}

/**
 * As pastas dos caminhos, com as pastas antes dos arquivos e cada grupo em ordem alfabética.
 * Como no Windows, "Docs/" e "docs/" são a mesma pasta.
 */
export function buildFragmentTree(paths: readonly string[]): FragmentFolder {
  const root: GrowingFolder = { name: '', path: '', folders: new Map(), files: [] }
  for (const path of paths) {
    const segments = path.split('/')
    let folder = root
    for (let depth = 1; depth < segments.length; depth++) {
      const key = segments[depth - 1].toLowerCase()
      let child = folder.folders.get(key)
      if (child === undefined) {
        const childPath = segments.slice(0, depth).join('/')
        child = { name: segments[depth - 1], path: childPath, folders: new Map(), files: [] }
        folder.folders.set(key, child)
      }
      folder = child
    }
    folder.files.push({ name: segments[segments.length - 1], path })
  }
  return sorted(root)
}

function sorted(folder: GrowingFolder): FragmentFolder {
  const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name)
  return {
    name: folder.name,
    path: folder.path,
    folders: [...folder.folders.values()].map(sorted).sort(byName),
    files: [...folder.files].sort(byName)
  }
}
```

- [ ] **Passo 5: A árvore, a barra, os problemas e o status**

Crie `src/renderer/src/ui/screens/fragments/FragmentTree.tsx`:

```tsx
import { FileCode2, Folder, Paperclip } from 'lucide-react'
import { cn } from 'cn'
import { isModified, type FragmentDocument } from '@/application/fragments/fragment-document'
import type { FragmentFile, FragmentFolder } from './fragment-tree'

interface FragmentTreeProps {
  readonly root: FragmentFolder
  readonly documents: ReadonlyMap<string, FragmentDocument>
  /** Os caminhos que são arquivo de algum asset. */
  readonly linked: ReadonlySet<string>
  readonly shownPath: string | null
  readonly onShow: (path: string) => void
}

/** As pastas do projeto com os fragmentos, todas abertas (Fase 6). */
export function FragmentTree(props: FragmentTreeProps): React.JSX.Element {
  return (
    <ul aria-label="Fragmentos do projeto" className="text-sm">
      <FolderContents folder={props.root} depth={0} {...props} />
    </ul>
  )
}

interface FolderContentsProps extends FragmentTreeProps {
  readonly folder: FragmentFolder
  readonly depth: number
}

function FolderContents({ folder, depth, ...props }: FolderContentsProps): React.JSX.Element {
  const indent = { paddingLeft: `${0.5 + depth * 0.875}rem` }
  return (
    <>
      {folder.folders.map((child) => (
        <li key={child.path}>
          <div
            data-fragment-folder={child.path}
            className="flex items-center gap-1.5 py-0.5 pr-2 text-muted-foreground"
            style={indent}
          >
            <Folder className="size-4 shrink-0" />
            <span className="truncate">{child.name}</span>
          </div>
          <ul>
            <FolderContents folder={child} depth={depth + 1} {...props} />
          </ul>
        </li>
      ))}
      {folder.files.map((file) => (
        <FileItem key={file.path} file={file} indent={indent} {...props} />
      ))}
    </>
  )
}

interface FileItemProps extends FragmentTreeProps {
  readonly file: FragmentFile
  readonly indent: React.CSSProperties
}

function FileItem({
  file,
  indent,
  documents,
  linked,
  shownPath,
  onShow
}: FileItemProps): React.JSX.Element {
  const document = documents.get(file.path)
  const shown = file.path === shownPath
  return (
    <li>
      <button
        type="button"
        data-fragment-path={file.path}
        aria-current={shown ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-1.5 py-0.5 pr-2 text-left',
          shown ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-accent/50'
        )}
        style={indent}
        onClick={() => onShow(file.path)}
      >
        <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
        {document !== undefined && isModified(document) && (
          <span title="Alterações não salvas">•</span>
        )}
        {document?.saved === null && (
          <span className="text-xs text-muted-foreground" title="Ainda não existe no disco">
            novo
          </span>
        )}
        {linked.has(file.path) && (
          <Paperclip
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-label="Vinculado a um asset"
          />
        )}
      </button>
    </li>
  )
}
```

Crie `src/renderer/src/ui/screens/fragments/FragmentBar.tsx`:

```tsx
import { Link2, Paperclip, Undo2 } from 'lucide-react'
import { isModified, type FragmentDocument } from '@/application/fragments/fragment-document'
import { assetLabel, type Asset } from '@/domain/assets/asset-catalog'
import { Button } from '@/ui/components/ui/button'

interface FragmentBarProps {
  readonly document: FragmentDocument
  /** Os assets deste arquivo, na ordem do assets.xml. */
  readonly assets: readonly Asset[]
  readonly onLink: () => void
  readonly onDiscard: () => void
}

/** A barra acima do editor: o caminho, o vínculo (ou "Vincular…") e "Descartar alterações". */
export function FragmentBar({
  document,
  assets,
  onLink,
  onDiscard
}: FragmentBarProps): React.JSX.Element {
  const [first] = assets
  return (
    <>
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <code data-fragment-bar className="min-w-0 flex-1 truncate text-sm">
          {document.path}
          {isModified(document) && <span title="Alterações não salvas"> •</span>}
        </code>
        {first !== undefined ? (
          <span
            data-fragment-link
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <Paperclip className="size-3.5" />
            {assetLabel(first)} · <code>{first.anchor}</code>
            {assets.length > 1 && ` +${assets.length - 1}`}
          </span>
        ) : (
          <Button size="sm" variant="outline" disabled={document.saved === null} onClick={onLink}>
            <Link2 /> Vincular a uma feature…
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={!isModified(document)} onClick={onDiscard}>
          <Undo2 /> Descartar alterações
        </Button>
      </div>
      {document.readOnly !== undefined && (
        <p className="border-b bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {document.readOnly}
        </p>
      )}
    </>
  )
}
```

Crie `src/renderer/src/ui/screens/fragments/FragmentProblems.tsx`:

```tsx
import type { FileProblem } from '@/application/file-problem'

interface FragmentProblemsProps {
  /** `undefined` enquanto a primeira conferência não respondeu. */
  readonly problems: readonly FileProblem[] | undefined
  readonly onGoToLine: (line: number) => void
}

/** A conferência do fragmento, a mesma da geração; clicar num problema leva até a linha. */
export function FragmentProblems({
  problems,
  onGoToLine
}: FragmentProblemsProps): React.JSX.Element {
  if (problems === undefined || problems.length === 0) {
    return (
      <p data-fragment-problems className="border-t px-3 py-2 text-xs text-muted-foreground">
        {problems === undefined
          ? 'Conferindo…'
          : 'Nenhum problema: o fragmento pode entrar num produto.'}
      </p>
    )
  }
  return (
    <ul data-fragment-problems className="max-h-40 overflow-auto border-t py-1 text-sm">
      {problems.map((problem, index) => (
        <li key={index}>
          <button
            type="button"
            className="flex w-full gap-3 px-3 py-0.5 text-left hover:bg-accent"
            onClick={() => onGoToLine(problem.line ?? 1)}
          >
            <span className="shrink-0 font-mono text-xs leading-5 text-destructive">
              linha {problem.line ?? '?'}
            </span>
            <span>{problem.message}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
```

Crie `src/renderer/src/ui/screens/fragments/FragmentStatusBar.tsx`:

```tsx
import { useMemo } from 'react'
import { isModified } from '@/application/fragments/fragment-document'
import { fragmentTreePaths } from '@/ui/stores/fragments-actions'
import { useProjectStore } from '@/ui/stores/project-store-context'

/** Barra de status da aba Fragmentos: quantos há e quantos têm alteração não salva. */
export function FragmentStatusBar(): React.JSX.Element {
  const files = useProjectStore((state) => state.fragmentFiles)
  const documents = useProjectStore((state) => state.fragmentDocuments)
  const count = useMemo(() => fragmentTreePaths(files, documents).length, [files, documents])
  const modified = useMemo(() => [...documents.values()].filter(isModified).length, [documents])
  return (
    <span data-fragments-summary>
      {count} {count === 1 ? 'fragmento' : 'fragmentos'}
      {modified > 0 && ` · ${modified} com alterações`}
    </span>
  )
}
```

- [ ] **Passo 6: Criar `src/renderer/src/ui/screens/fragments/FragmentEditor.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { setDiagnostics } from '@codemirror/lint'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { FileProblem } from '@/application/file-problem'
import type { FragmentDocument } from '@/application/fragments/fragment-document'
import type { FragmentEditorStates } from './fragment-editor-states'
import { FragmentProblems } from './FragmentProblems'
import { createXmlEditorState, diagnosticsFor } from './xml-editor-setup'

interface FragmentEditorProps {
  readonly document: FragmentDocument
  /** `undefined` enquanto a primeira conferência não respondeu. */
  readonly problems: readonly FileProblem[] | undefined
  /** Onde fica o estado de cada arquivo quando ele não está no editor. */
  readonly states: FragmentEditorStates
  readonly onChange: (path: string, text: string) => void
}

/**
 * O editor de um fragmento, com o CodeMirror. Ao trocar de arquivo ou sair da aba, o estado do
 * arquivo (com o desfazer e a seleção) fica guardado em `states`, e volta com ele. Um texto que
 * mudou fora do editor (descartar, atualizar, recarregar) recomeça o estado daquele arquivo.
 */
export function FragmentEditor({
  document,
  problems,
  states,
  onChange
}: FragmentEditorProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const shownPath = useRef<string | null>(null)
  const { path, text } = document
  const readOnly = document.readOnly !== undefined

  useEffect(() => {
    const created = new EditorView({ parent: host.current ?? undefined })
    view.current = created
    return () => {
      if (shownPath.current !== null) states.set(shownPath.current, created.state)
      created.destroy()
      view.current = null
      shownPath.current = null
    }
  }, [states])

  // Mostra o arquivo: o estado guardado, se o texto ainda for o mesmo, ou um estado novo.
  useEffect(() => {
    const current = view.current
    if (current === null) return
    if (shownPath.current !== null) states.set(shownPath.current, current.state)
    let next = states.get(path)
    if (next === undefined || next.doc.toString() !== text || next.readOnly !== readOnly) {
      next = createXmlEditorState(text, {
        readOnly,
        onChange: (changed) => onChange(path, changed)
      })
    }
    if (next !== current.state) current.setState(next)
    states.set(path, next)
    shownPath.current = path
  }, [states, path, text, readOnly, onChange])

  // As marcas dos problemas; um estado novo começa sem elas.
  useEffect(() => {
    const current = view.current
    if (current === null) return
    current.dispatch(
      setDiagnostics(current.state, diagnosticsFor(current.state.doc, problems ?? []))
    )
  }, [states, path, text, readOnly, problems])

  const goToLine = (line: number): void => {
    const current = view.current
    if (current === null) return
    const { doc } = current.state
    const target = doc.line(Math.min(Math.max(line, 1), doc.lines))
    current.dispatch({
      selection: EditorSelection.cursor(target.from),
      effects: EditorView.scrollIntoView(target.from, { y: 'center' })
    })
    current.focus()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={host} data-fragment-editor className="min-h-0 flex-1 overflow-hidden" />
      <FragmentProblems problems={problems} onGoToLine={goToLine} />
    </div>
  )
}
```

- [ ] **Passo 7: Criar `src/renderer/src/ui/screens/fragments/FragmentDialogs.tsx`**

```tsx
import { useState } from 'react'
import { folderOf } from '@/domain/fragments/fragment-path'
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
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface FragmentDialogsProps {
  readonly dialog: EditorDialog
  readonly onClose: () => void
}

/** Criar um fragmento e descartar as alterações de um (Fase 6). */
export function FragmentDialogs({
  dialog,
  onClose
}: FragmentDialogsProps): React.JSX.Element | null {
  switch (dialog?.kind) {
    case 'new-fragment':
      return <NewFragmentDialog onClose={onClose} />
    case 'discard-fragment':
      return <DiscardFragmentDialog path={dialog.path} onClose={onClose} />
    default:
      return null
  }
}

/** O caminho começa na pasta do fragmento exibido; o arquivo só vai para o disco no Ctrl+S. */
function NewFragmentDialog({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  const shownPath = useProjectStore((state) => state.shownFragmentPath)
  const checkPath = useProjectStore((state) => state.checkNewFragmentPath)
  const create = useProjectStore((state) => state.createFragment)
  const [path, setPath] = useState(() => (shownPath === null ? '' : folderOf(shownPath)))
  const problem = checkPath(path)
  // Enquanto só a pasta está digitada, ainda não é hora de reclamar.
  const typing = path.trim() === '' || path.endsWith('/')

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (create(path) === null) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Novo fragmento</DialogTitle>
            <DialogDescription>
              O arquivo é criado ao salvar, com as pastas que faltarem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fragment-path">Caminho</Label>
            <Input
              id="fragment-path"
              autoFocus
              className="font-mono"
              placeholder="docs/novo.xml"
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Relativo à pasta do projeto, terminando em .xml.
            </p>
            {problem !== null && !typing && <p className="text-xs text-destructive">{problem}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={problem !== null}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DiscardFragmentDialogProps {
  readonly path: string
  readonly onClose: () => void
}

function DiscardFragmentDialog({
  path,
  onClose
}: DiscardFragmentDialogProps): React.JSX.Element | null {
  const document = useProjectStore((state) => state.fragmentDocuments.get(path))
  const discard = useProjectStore((state) => state.discardFragment)
  if (document === undefined) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar alterações?</DialogTitle>
          <DialogDescription>
            {document.saved === null ? (
              <>
                O arquivo novo <code>{path}</code> sai da lista e não será criado.
              </>
            ) : (
              <>
                O texto de <code>{path}</code> volta a ser o que está no disco.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              discard(path)
              onClose()
            }}
          >
            Descartar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Passo 8: Criar `src/renderer/src/ui/screens/fragments/FragmentsWorkspace.tsx`**

```tsx
import { useEffect, useMemo } from 'react'
import { FilePlus2, RefreshCw } from 'lucide-react'
import type { Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { fragmentTreePaths, shownFragment } from '@/ui/stores/fragments-actions'
import { useProjectStore, useProjectStoreApi } from '@/ui/stores/project-store-context'
import { FragmentBar } from './FragmentBar'
import { FragmentEditor } from './FragmentEditor'
import type { FragmentEditorStates } from './fragment-editor-states'
import { FragmentTree } from './FragmentTree'
import { buildFragmentTree } from './fragment-tree'

/** Quanto esperar depois da última tecla para conferir o fragmento. */
const CHECK_DELAY_MS = 500

interface FragmentsWorkspaceProps {
  readonly project: Project
  readonly onOpenDialog: (dialog: EditorDialog) => void
  /** O estado do editor de cada arquivo, guardado pela tela do projeto. */
  readonly editorStates: FragmentEditorStates
}

/**
 * Aba Fragmentos (Fase 6): a árvore dos `.xml` do projeto à esquerda e o editor do arquivo
 * exibido no centro, com a barra do arquivo e a lista de problemas.
 */
export function FragmentsWorkspace({
  project,
  onOpenDialog,
  editorStates
}: FragmentsWorkspaceProps): React.JSX.Element {
  const store = useProjectStoreApi()
  const files = useProjectStore((state) => state.fragmentFiles)
  const documents = useProjectStore((state) => state.fragmentDocuments)
  const shown = useProjectStore(shownFragment)
  const problems = useProjectStore((state) =>
    state.shownFragmentPath === null
      ? undefined
      : state.fragmentProblems.get(state.shownFragmentPath)
  )
  const selectedFeatureId = useProjectStore((state) => state.selectedFeatureId)
  const showFragment = useProjectStore((state) => state.showFragment)
  const changeText = useProjectStore((state) => state.changeFragmentText)
  const checkFragment = useProjectStore((state) => state.checkFragment)
  const refresh = useProjectStore((state) => state.refreshFragments)

  // Entrar na aba lê as pastas; nas outras vezes, também relê os fragmentos sem alteração.
  useEffect(() => {
    const state = store.getState()
    void (state.fragmentFiles === null ? state.loadFragmentFiles() : state.refreshFragments())
  }, [store])

  // Confere o texto um pouco depois da última tecla.
  const shownPath = shown?.path
  const shownText = shown?.text
  useEffect(() => {
    if (shownPath === undefined || shownText === undefined) return
    const timer = setTimeout(() => void checkFragment(shownPath), CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [shownPath, shownText, checkFragment])

  const tree = useMemo(
    () => buildFragmentTree(fragmentTreePaths(files, documents)),
    [files, documents]
  )
  const linked = useMemo(
    () => new Set(project.assets.assets.map((asset) => asset.path)),
    [project.assets]
  )
  const hasFiles = tree.folders.length > 0 || tree.files.length > 0
  const newFragment = (): void => onOpenDialog({ kind: 'new-fragment' })

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[16rem_1fr]">
      <aside className="flex min-h-0 flex-col border-r">
        <div className="flex items-center gap-1 border-b p-2">
          <Button size="sm" onClick={newFragment}>
            <FilePlus2 /> Novo fragmento
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="ml-auto"
            title="Atualizar"
            onClick={() => void refresh()}
          >
            <RefreshCw />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto py-1">
          {files === null ? (
            <p className="p-3 text-sm text-muted-foreground">Lendo as pastas…</p>
          ) : hasFiles ? (
            <FragmentTree
              root={tree}
              documents={documents}
              linked={linked}
              shownPath={shown?.path ?? null}
              onShow={(path) => void showFragment(path)}
            />
          ) : (
            <p className="p-3 text-sm text-muted-foreground">Nenhum fragmento no projeto.</p>
          )}
        </div>
      </aside>
      <section className="flex min-h-0 flex-col">
        {shown === null ? (
          <div className="max-w-prose space-y-3 p-6 text-sm text-muted-foreground">
            <p>
              Um fragmento é um arquivo XML de documentação. Vinculado a uma feature como asset, ele
              entra no produto gerado das configurações que selecionam a feature.
            </p>
            <p>Escolha um arquivo à esquerda ou crie um novo.</p>
            <Button size="sm" onClick={newFragment}>
              <FilePlus2 /> Novo fragmento
            </Button>
          </div>
        ) : (
          <>
            <FragmentBar
              document={shown}
              assets={project.assets.assets.filter((asset) => asset.path === shown.path)}
              onLink={() =>
                onOpenDialog({
                  kind: 'link-asset',
                  path: shown.path,
                  anchor: selectedFeatureId ?? project.model.root.id
                })
              }
              onDiscard={() => onOpenDialog({ kind: 'discard-fragment', path: shown.path })}
            />
            <FragmentEditor
              document={shown}
              problems={problems}
              states={editorStates}
              onChange={changeText}
            />
          </>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Passo 9: A aba em `src/renderer/src/ui/screens/project/ViewRail.tsx`**

Troque:

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

por:

<!-- prettier-ignore -->
```tsx
import { FileCode2, ListChecks, Network, Paperclip } from 'lucide-react'
import { cn } from 'cn'

/** As abas da barra lateral (SPEC §7). */
export type ProjectView = 'model' | 'configurations' | 'assets' | 'fragments'

const VIEWS = [
  { view: 'model', label: 'Modelo', Icon: Network },
  { view: 'configurations', label: 'Configurações', Icon: ListChecks },
  { view: 'assets', label: 'Assets', Icon: Paperclip },
  { view: 'fragments', label: 'Fragmentos', Icon: FileCode2 }
] as const
```

- [ ] **Passo 10: Os diálogos novos em `src/renderer/src/ui/screens/project/editor-dialog.ts`**

Troque:

<!-- prettier-ignore -->
```ts
      readonly note: string
    }
  | null
```

por:

<!-- prettier-ignore -->
```ts
      readonly note: string
    }
  | { readonly kind: 'new-fragment' }
  | { readonly kind: 'discard-fragment'; readonly path: string }
  | null
```

- [ ] **Passo 11: O botão "Editar" na aba Assets**

Em `src/renderer/src/ui/screens/assets/AssetList.tsx`:

Troque:

<!-- prettier-ignore -->
```tsx
import { ArrowDown, ArrowUp, ExternalLink, FileCode2, Paperclip, Unlink } from 'lucide-react'
import { cn } from 'cn'
import * as cmd from '@/application/editing/commands'
```

por:

<!-- prettier-ignore -->
```tsx
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileCode2,
  Paperclip,
  Pencil,
  Unlink
} from 'lucide-react'
import { cn } from 'cn'
import * as cmd from '@/application/editing/commands'
```

Troque:

<!-- prettier-ignore -->
```tsx
/** Os assets agrupados por âncora, na ordem do modelo (SPEC §7). */
export function AssetList({
  groups
}: {
  readonly groups: readonly AnchorGroup[]
}): React.JSX.Element {
  return (
```

por:

<!-- prettier-ignore -->
```tsx
/** Os assets agrupados por âncora, na ordem do modelo (SPEC §7). */
export function AssetList({
  groups,
  onEditFragment
}: {
  readonly groups: readonly AnchorGroup[]
  readonly onEditFragment: (path: string) => void
}): React.JSX.Element {
  return (
```

Troque:

<!-- prettier-ignore -->
```tsx
                first={index === 0}
                last={index === assets.length - 1}
              />
            ))}
```

por:

<!-- prettier-ignore -->
```tsx
                first={index === 0}
                last={index === assets.length - 1}
                onEditFragment={onEditFragment}
              />
            ))}
```

Troque:

<!-- prettier-ignore -->
```tsx
  readonly first: boolean
  readonly last: boolean
}

function AssetRow({ asset, first, last }: AssetRowProps): React.JSX.Element {
  const selected = useProjectStore((state) => state.selectedAssetId === asset.id)
  const selectAsset = useProjectStore((state) => state.selectAsset)
```

por:

<!-- prettier-ignore -->
```tsx
  readonly first: boolean
  readonly last: boolean
  readonly onEditFragment: (path: string) => void
}

function AssetRow({ asset, first, last, onEditFragment }: AssetRowProps): React.JSX.Element {
  const selected = useProjectStore((state) => state.selectedAssetId === asset.id)
  const selectAsset = useProjectStore((state) => state.selectAsset)
```

Troque:

<!-- prettier-ignore -->
```tsx
        <FileStatusBadge path={asset.path} />
      </button>
      <Button
        size="icon-sm"
```

por:

<!-- prettier-ignore -->
```tsx
        <FileStatusBadge path={asset.path} />
      </button>
      {asset.kind === 'fragment' && (
        <Button
          size="icon-sm"
          variant="ghost"
          title="Editar na aba Fragmentos"
          disabled={status === 'missing'}
          onClick={() => onEditFragment(asset.path)}
        >
          <Pencil />
        </Button>
      )}
      <Button
        size="icon-sm"
```

Em `src/renderer/src/ui/screens/assets/AssetsWorkspace.tsx`:

Troque:

<!-- prettier-ignore -->
```tsx
  readonly project: Project
  readonly onOpenDialog: (dialog: EditorDialog) => void
}
```

por:

<!-- prettier-ignore -->
```tsx
  readonly project: Project
  readonly onOpenDialog: (dialog: EditorDialog) => void
  /** Abre o fragmento na aba Fragmentos. */
  readonly onEditFragment: (path: string) => void
}
```

Troque:

<!-- prettier-ignore -->
```tsx
export function AssetsWorkspace({
  project,
  onOpenDialog
}: AssetsWorkspaceProps): React.JSX.Element {
  const asset = useProjectStore(selectedAsset)
```

por:

<!-- prettier-ignore -->
```tsx
export function AssetsWorkspace({
  project,
  onOpenDialog,
  onEditFragment
}: AssetsWorkspaceProps): React.JSX.Element {
  const asset = useProjectStore(selectedAsset)
```

Troque:

<!-- prettier-ignore -->
```tsx
            </p>
          ) : (
            <AssetList groups={groups} />
          )}
        </div>
```

por:

<!-- prettier-ignore -->
```tsx
            </p>
          ) : (
            <AssetList groups={groups} onEditFragment={onEditFragment} />
          )}
        </div>
```

- [ ] **Passo 12: A aba, os atalhos, a volta do foco e os avisos em `src/renderer/src/ui/screens/project/ProjectScreen.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
import { ConfiguratorWorkspace } from '@/ui/screens/configurator/ConfiguratorWorkspace'
import { GenerationDialogs } from '@/ui/screens/configurator/GenerationDialogs'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
```

por:

<!-- prettier-ignore -->
```tsx
import { ConfiguratorWorkspace } from '@/ui/screens/configurator/ConfiguratorWorkspace'
import { GenerationDialogs } from '@/ui/screens/configurator/GenerationDialogs'
import { FragmentDialogs } from '@/ui/screens/fragments/FragmentDialogs'
import type { FragmentEditorStates } from '@/ui/screens/fragments/fragment-editor-states'
import { FragmentStatusBar } from '@/ui/screens/fragments/FragmentStatusBar'
import { FragmentsWorkspace } from '@/ui/screens/fragments/FragmentsWorkspace'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
```

Troque:

<!-- prettier-ignore -->
```tsx
  const problems = useProjectStore((state) => state.problems)
  const warnings = useProjectStore((state) => state.warnings)
  const notice = useProjectStore((state) => state.notice)
  const dismissNotice = useProjectStore((state) => state.dismissNotice)
```

por:

<!-- prettier-ignore -->
```tsx
  const problems = useProjectStore((state) => state.problems)
  const warnings = useProjectStore((state) => state.warnings)
  const fragmentWarnings = useProjectStore((state) => state.fragmentWarnings)
  const notice = useProjectStore((state) => state.notice)
  const dismissNotice = useProjectStore((state) => state.dismissNotice)
```

Troque:

<!-- prettier-ignore -->
```tsx
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

por:

<!-- prettier-ignore -->
```tsx
  const close = useProjectStore((state) => state.close)
  const checkAssetFiles = useProjectStore((state) => state.checkAssetFiles)
  const refreshFragments = useProjectStore((state) => state.refreshFragments)
  const showFragment = useProjectStore((state) => state.showFragment)
  const [view, setView] = useState<ProjectView>('model')
  const [dialog, setDialog] = useState<EditorDialog>(null)
  // O desfazer do texto de cada fragmento dura enquanto o projeto está aberto.
  const [editorStates] = useState<FragmentEditorStates>(() => new Map())
  const openDialog = useCallback((next: EditorDialog) => setDialog(next), [])
  // Na aba Fragmentos, desfazer e refazer são do texto, e ficam com o editor.
  const historyEnabled = view === 'model' || view === 'assets'
  useEditorShortcuts(openDialog, {
    enabled: dialog === null,
    history: historyEnabled,
    editing: view === 'model'
  })
  // Um arquivo pode ter sido renomeado ou editado fora do app com a janela em segundo plano.
  const onWindowFocus = useCallback(() => {
    void checkAssetFiles()
    void refreshFragments()
  }, [checkAssetFiles, refreshFragments])
  useWindowFocus(onWindowFocus)
  const editFragment = useCallback(
    (path: string) => {
      setView('fragments')
      void showFragment(path)
    },
    [showFragment]
  )
  const allWarnings = useMemo(
    () => [...warnings, ...fragmentWarnings.values()],
    [warnings, fragmentWarnings]
  )
  const actions = useMemo<FeatureActions>(
    () => ({
```

Troque:

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

por:

<!-- prettier-ignore -->
```tsx
  return (
    <main className="flex h-screen flex-col">
      <ProjectHeader session={session} historyEnabled={historyEnabled} onClose={requestClose} />

      {notice !== null && (
```

Troque:

<!-- prettier-ignore -->
```tsx
      )}

      {(problems.length > 0 || warnings.length > 0) && (
        <div className="space-y-2 border-b p-4">
          <ProblemList title="Não foi possível salvar" tone="error" problems={problems} />
          <ProblemList title="Avisos" tone="warning" problems={warnings} />
        </div>
      )}
```

por:

<!-- prettier-ignore -->
```tsx
      )}

      {(problems.length > 0 || allWarnings.length > 0) && (
        <div className="space-y-2 border-b p-4">
          <ProblemList title="Não foi possível salvar" tone="error" problems={problems} />
          <ProblemList title="Avisos" tone="warning" problems={allWarnings} />
        </div>
      )}
```

Troque:

<!-- prettier-ignore -->
```tsx
          <ConfiguratorWorkspace project={project} onOpenDialog={openDialog} />
        )}
        {view === 'assets' && <AssetsWorkspace project={project} onOpenDialog={openDialog} />}
      </div>
```

por:

<!-- prettier-ignore -->
```tsx
          <ConfiguratorWorkspace project={project} onOpenDialog={openDialog} />
        )}
        {view === 'assets' && (
          <AssetsWorkspace
            project={project}
            onOpenDialog={openDialog}
            onEditFragment={editFragment}
          />
        )}
        {view === 'fragments' && (
          <FragmentsWorkspace
            project={project}
            onOpenDialog={openDialog}
            editorStates={editorStates}
          />
        )}
      </div>
```

Troque:

<!-- prettier-ignore -->
```tsx
        {view === 'configurations' ? (
          <ConfigurationStatusBar />
        ) : (
          `${project.assets.assets.length} assets · ${project.configurations.length} configurações`
```

por:

<!-- prettier-ignore -->
```tsx
        {view === 'configurations' ? (
          <ConfigurationStatusBar />
        ) : view === 'fragments' ? (
          <FragmentStatusBar />
        ) : (
          `${project.assets.assets.length} assets · ${project.configurations.length} configurações`
```

Troque:

<!-- prettier-ignore -->
```tsx
        onClose={() => setDialog(null)}
      />
      <ConflictDialog />
    </main>
```

por:

<!-- prettier-ignore -->
```tsx
        onClose={() => setDialog(null)}
      />
      <FragmentDialogs dialog={dialog} onClose={() => setDialog(null)} />
      <ConflictDialog />
    </main>
```

- [ ] **Passo 13: Checagens e build**

```bash
npm run typecheck
npm run lint
npm run build
```

Esperado: sem erros. O build avisa três vezes "Use of eval … is strongly discouraged" (`logic-solver`, esperado desde a Fase 3).

- [ ] **Passo 14: Escrever o roteiro `.checks/fragmentos-ui.mjs`**

```js
// Roteiro da aba Fragmentos com entrada real (plano da Fase 6, Tarefa 5).
// Uso: bash .checks/run-ui.sh <app.exe | dev> .checks/fragmentos-ui.mjs 9229
// O app precisa estar aberto com --remote-debugging-port e --inspect.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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
const { click, press, fill, choose, text, title, js, send, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))
const BOM = '\u{FEFF}'
const show = (content) => JSON.stringify(content).replace(BOM, '<BOM>')

// O EditorView do CodeMirror, pelo DOM, como no `EditorView.findFromDOM` (o `cmTile` do conteúdo).
const VIEW = `document.querySelector('.cm-content').cmTile.root.view`
const editorText = () => js(`${VIEW}.state.doc.toString()`)
const tree = () =>
  js(
    `[...document.querySelectorAll('[data-fragment-path]')].map((b) => b.dataset.fragmentPath + (b.innerText.includes('•') ? ' •' : '') + (b.innerText.includes('novo') ? ' novo' : '') + (b.querySelector('[aria-label="Vinculado a um asset"]') ? ' 📎' : '')).join(' | ')`
  )
const problems = () => text('[data-fragment-problems]')
const summary = () => text('[data-fragments-summary]')
const bar = () => text('[data-fragment-bar]')
const dialog = () =>
  js(
    `document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '(sem diálogo)'`
  )
const warnings = () =>
  js(
    `[...document.querySelectorAll('main section h2')].find((h) => h.innerText === 'Avisos')?.parentElement.innerText.replace(/\\s+/g, ' ').trim() ?? '(sem avisos)'`
  )
const mouse = (type, x, y, clickCount) =>
  send('Input.dispatchMouseEvent', {
    type,
    x,
    y,
    button: 'left',
    buttons: type === 'mouseReleased' ? 0 : 1,
    clickCount
  })
/** Clica no editor na posição do texto `needle` (+ `delta` caracteres); duas vezes seleciona a palavra. */
const clickText = async (needle, { delta = 0, clicks = 1 } = {}) => {
  const box = await js(`(() => {
    const view = ${VIEW}
    const found = view.state.doc.toString().indexOf(${JSON.stringify(needle)})
    if (found < 0) return null
    const at = view.coordsAtPos(found + ${delta})
    return { x: at.left + 2, y: (at.top + at.bottom) / 2 }
  })()`)
  if (box === null) throw new Error(`não achei ${needle} no editor`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y })
  for (let count = 1; count <= clicks; count++) {
    await mouse('mousePressed', box.x, box.y, count)
    await mouse('mouseReleased', box.x, box.y, count)
  }
  await sleep(200)
}
const type = async (content) => {
  await send('Input.insertText', { text: content })
  await sleep(300)
}
const key = async (keyName, code, vk, modifiers = 0) => {
  const base = { key: keyName, code, windowsVirtualKeyCode: vk, modifiers }
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  await sleep(250)
}
/** Espera a conferência do texto atual (meio segundo depois da última tecla). */
const settle = () => sleep(1500)
const fromExample = () => {
  const changed = []
  const walk = (dir) => {
    for (const name of readdirSync(join(projectDir, dir))) {
      const rel = dir === '' ? name : `${dir}/${name}`
      if (statSync(file(rel)).isDirectory()) walk(rel)
      else {
        let original = null
        try {
          original = readFileSync(join('docs/examples/loja-online', ...rel.split('/')))
        } catch {
          // Arquivo novo.
        }
        if (original === null || !original.equals(readFileSync(file(rel)))) changed.push(rel)
      }
    }
  }
  walk('')
  return changed.join(' ') || '(nenhum)'
}

// A visão geral passa a ter BOM e CRLF, para conferir que o formato fica.
const visaoOriginal = readFileSync(file('docs/loja/visao-geral.xml'), 'utf8')
writeFileSync(file('docs/loja/visao-geral.xml'), BOM + visaoOriginal.replaceAll('\n', '\r\n'))

// 1. A aba e a árvore
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Fragmentos' })
await waitFor(`document.querySelectorAll('[data-fragment-path]').length > 0`)
log('1. árvore', await tree())
log('   status', await summary())

// 2. Abrir o pix.xml: a barra, o realce e a conferência
await click('[data-fragment-path="docs/pagamento/pix.xml"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Pagamento com PIX')`)
await settle()
log('2. barra', await bar())
log('   vínculo', await text('[data-fragment-link]'))
log(
  '   realce da tag',
  await js(`(() => {
    const token = [...document.querySelectorAll('.cm-line span')].find((s) => s.textContent === 'title')
    // A variável sai minificada do build ("oklch(46% .16 262)"): compara com a cor calculada.
    const probe = document.createElement('span')
    probe.style.color = 'var(--xml-tag)'
    document.body.append(probe)
    const tag = getComputedStyle(probe).color
    probe.remove()
    return token && getComputedStyle(token).color === tag ? 'cor de --xml-tag' : 'sem cor'
  })()`)
)
log('   problemas', await problems())

// 3. Digitar: o "•" no título, na árvore, na barra e no status
await clickText('PIX</title>', { clicks: 2 })
await type('Pix')
log('3. título da janela', await title())
log('   árvore', await tree())
log('   status', await summary())

// 4. Ctrl+Z e Ctrl+Y ficam com o editor
log(
  '   desfazer do cabeçalho',
  await js(
    `document.querySelector('header button[title^="Desfazer"]').disabled ? 'desligado' : 'ligado'`
  )
)
await press('z', { ctrl: true })
log(
  '4. Ctrl+Z',
  `${(await editorText()).includes('com PIX</title>') ? 'PIX de volta' : 'não voltou'} · ${await title()}`
)
await press('y', { ctrl: true })
log('   Ctrl+Y', (await editorText()).includes('com Pix</title>') ? 'Pix de novo' : 'não refez')

// 5. Ctrl+S: só esse arquivo muda
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log('5. Ctrl+S', `${await title()} · status ${await summary()}`)
log('   diferentes do exemplo', fromExample())

// 6. Apagar o ">" de uma tag: o problema com a linha, a marca e o clique que leva até ela
await clickText('<title>', { delta: 6 })
await press('Delete')
await settle()
log('6. problemas', await problems())
log(
  '   marcas no editor',
  await js(
    `document.querySelectorAll('.cm-lintRange-error').length + ' sublinhado(s), ' + document.querySelectorAll('.cm-lint-marker-error').length + ' na margem'`
  )
)
await clickText('<p>')
await click('[data-fragment-problems] button')
log('   linha do cursor', await js(`document.querySelector('.cm-activeLine')?.textContent.trim()`))

// 7. Salvar com erro: o aviso, e a geração recusa o arquivo
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log('7. avisos', await warnings())
await click({ text: 'Configurações' })
await click('[data-configuration-key="loja-basica"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await click({ text: 'Gerar produto' })
await waitFor(`document.querySelector('[role=dialog]') !== null`, 20000)
log('   gerar loja-basica', await dialog())
await press('Escape')

// 8. De volta: o desfazer do texto sobreviveu à troca de aba
await click({ text: 'Fragmentos' })
await waitFor(`document.querySelector('.cm-content') !== null`)
await clickText('<p>')
await press('z', { ctrl: true })
await settle()
log(
  '8. Ctrl+Z depois de trocar de aba',
  `${(await editorText()).includes('<title>Pagamento com Pix') ? '">" de volta' : 'não voltou'} · ${await problems()}`
)
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log('   salvo sem erro', await warnings())

// 9. Arquivo com BOM e CRLF: editar e salvar mantém o formato
await click('[data-fragment-path="docs/loja/visao-geral.xml"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('loja')`)
const visaoWord = (await editorText()).match(/<title>(\S+)/)[1]
await clickText(`<title>${visaoWord}`, { delta: 8, clicks: 2 })
await type('Panorama')
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
const visao = readFileSync(file('docs/loja/visao-geral.xml'), 'utf8')
log(
  '9. visao-geral.xml no disco',
  `BOM ${visao.startsWith(BOM) ? 'sim' : 'não'} · ${visao.split('\r\n').length - 1} CRLF, ${visao.replaceAll('\r\n', '').split('\n').length - 1} LF sozinho · título ${visao.match(/<title>([^<]+)/)[1]}`
)

// 10. Alterado fora do app: sem alteração no app, o editor mostra o texto novo
writeFileSync(
  file('docs/loja/visao-geral.xml'),
  '<topic>\n  <title>Mudou por fora</title>\n</topic>\n'
)
await js(`window.dispatchEvent(new Event('focus'))`)
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Mudou por fora')`)
log('10. volta do foco', `${(await editorText()).split('\n')[1].trim()} · ${await title()}`)

// 11. Com alteração no app e fora dele: o conflito
await clickText('Mudou por fora', { clicks: 2 })
await type('Editado')
writeFileSync(file('docs/loja/visao-geral.xml'), '<topic>\n  <title>git pull</title>\n</topic>\n')
await press('s', { ctrl: true })
await waitFor(`document.querySelector('[role=dialog]') !== null`)
log('11. Ctrl+S', await dialog())
await click({ text: 'Sobrescrever' })
await waitFor(`!document.title.startsWith('•')`)
log(
  '    Sobrescrever',
  readFileSync(file('docs/loja/visao-geral.xml'), 'utf8').split('\n')[1].trim()
)

// 12. Novo fragmento: o caminho sugerido, a recusa e a criação
await click({ text: 'Novo fragmento' })
log('12. caminho sugerido', await ui.value('#fragment-path'))
await fill('#fragment-path', 'configurations/x.xml')
log('    configurations/x.xml', await dialog())
await fill('#fragment-path', 'Docs/Pagamento/cartao.xml')
await click({ text: 'Criar' })
await waitFor(`document.querySelector('[data-fragment-path="docs/pagamento/cartao.xml"]') !== null`)
await settle()
log('    árvore', await tree())
log('    editor', JSON.stringify(await editorText()))
log('    problemas', await problems())
log(
  '    Vincular…',
  await js(
    `[...document.querySelectorAll('button')].find((b) => b.innerText.includes('Vincular a uma feature'))?.disabled ? 'desligado' : 'ligado'`
  )
)
await clickText('<?xml')
await key('End', 'End', 35, 2)
await type('<topic xmlns="urn:exemplo:doc">\n  <title>Pagamento com cartão</title>\n</topic>\n')
await settle()
log('    digitado', await problems())
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log(
  '    salvo',
  `${await tree()} · ${show(readFileSync(file('docs/pagamento/cartao.xml'), 'utf8').slice(0, 40))}…`
)

// 13. Vincular a uma feature pelo editor
await click({ startsWith: 'Vincular a uma feature' })
await choose('#link-asset-anchor', 'pag_cartao')
await fill('#link-asset-name', 'Guia do cartão')
await click({ text: 'Vincular' })
await sleep(300)
log('13. vínculo', await text('[data-fragment-link]'))
log('    árvore', await tree())

// 14. Ctrl+Z no editor desfaz o texto, não o vínculo
await clickText('Pagamento com cartão', { delta: 14, clicks: 2 })
await type('crédito')
await press('z', { ctrl: true })
log(
  '14. Ctrl+Z no texto',
  `${(await editorText()).includes('com cartão') ? 'texto de volta' : 'não voltou'} · vínculo ${await text('[data-fragment-link]')}`
)

// 15. "Editar" na aba Assets
await click({ text: 'Assets' })
await waitFor(
  `document.querySelector('[data-asset-id="cartao"]') !== null && document.querySelectorAll('[data-file-status=checking]').length === 0`
)
log(
  '15. na aba Assets',
  await js(
    `[...document.querySelectorAll('[data-asset-id]')].map((row) => row.dataset.assetId + ':' + row.querySelector('[data-file-status]').dataset.fileStatus + ' ' + (row.querySelector('button[title="Editar na aba Fragmentos"]') ? 'editar' : '-')).join(' | ')`
  )
)
await click('[data-asset-id="doc_boleto"] button[title="Editar na aba Fragmentos"]')
await waitFor(`document.querySelector('[data-fragment-bar]')?.innerText.includes('boleto')`)
log('    Editar doc_boleto', await bar())

// 16. Descartar alterações
await clickText('<title>', { delta: 7, clicks: 2 })
await type('Rascunho')
log('16. antes', `${await bar()} · ${await summary()}`)
await click({ startsWith: 'Descartar alterações' })
log('    diálogo', await dialog())
await click({ text: 'Descartar' })
log('    depois', `${await bar()} · ${await summary()} · ${await title()}`)

await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log('17. Ctrl+S, diferentes do exemplo', fromExample())
log('erros no console', errors.length === 0 ? 'nenhum' : errors.join(' | '))
ui.close()
main.close()
```

- [ ] **Passo 15: Rodar o roteiro da aba Fragmentos**

Combine o momento com o usuário: o app abre e fecha na tela dele.

```bash
bash .checks/run-ui.sh dev .checks/fragmentos-ui.mjs 9229
```

Esperado, exatamente:

```
1. árvore                            → docs/busca/busca-app.xml 📎 | docs/busca/busca.xml 📎 | docs/loja/visao-geral.xml 📎 | docs/pagamento/boleto.xml 📎 | docs/pagamento/pix.xml 📎
   status                            → 5 fragmentos
2. barra                             → docs/pagamento/pix.xml
   vínculo                           → Guia do PIX · pag_pix
   realce da tag                     → cor de --xml-tag
   problemas                         → Nenhum problema: o fragmento pode entrar num produto.
3. título da janela                  → • Loja Online — mdd
   árvore                            → docs/busca/busca-app.xml 📎 | docs/busca/busca.xml 📎 | docs/loja/visao-geral.xml 📎 | docs/pagamento/boleto.xml 📎 | docs/pagamento/pix.xml • 📎
   status                            → 5 fragmentos · 1 com alterações
   desfazer do cabeçalho             → desligado
4. Ctrl+Z                            → PIX de volta · Loja Online — mdd
   Ctrl+Y                            → Pix de novo
5. Ctrl+S                            → Loja Online — mdd · status 5 fragmentos
   diferentes do exemplo             → docs/loja/visao-geral.xml docs/pagamento/pix.xml
6. problemas                         → linha 3 Specification mandates value for attribute com linha 3 attributes construct error linha 3 Couldn't find end of Start Tag titlePagamento line 3 linha 3 Opening and ending tag mismatch: topic line 2 and title
   marcas no editor                  → 1 sublinhado(s), 1 na margem
   linha do cursor                   → <titlePagamento com Pix</title>
7. avisos                            → Avisos docs/pagamento/pix.xml:3 Salvo com erro de XML: Specification mandates value for attribute com
   gerar loja-basica                 → Não foi possível gerar Nada foi gravado. Problemas docs/pagamento/pix.xml:3 [doc_pix] Specification mandates value for attribute com docs/pagamento/pix.xml:3 [doc_pix] attributes construct error docs/pagamento/pix.xml:3 [doc_pix] Couldn't find end of Start Tag titlePagamento line 3 docs/pagamento/pix.xml:3 [doc_pix] Opening and ending tag mismatch: topic line 2 and title Fechar Fechar
8. Ctrl+Z depois de trocar de aba    → ">" de volta · Nenhum problema: o fragmento pode entrar num produto.
   salvo sem erro                    → (sem avisos)
9. visao-geral.xml no disco          → BOM sim · 5 CRLF, 0 LF sozinho · título Panorama geral da loja
10. volta do foco                    → <title>Mudou por fora</title> · Loja Online — mdd
11. Ctrl+S                           → Arquivos alterados fora do app Estes arquivos mudaram no disco desde que foram abertos (por exemplo, depois de um git pull) e não foram gravados: docs/loja/visao-geral.xml Cancelar Recarregar (descarta minhas alterações) Sobrescrever Fechar
    Sobrescrever                     → <title>Editado por fora</title>
12. caminho sugerido                 → docs/loja/
    configurations/x.xml             → Novo fragmento O arquivo é criado ao salvar, com as pastas que faltarem. Caminho Relativo à pasta do projeto, terminando em .xml. A pasta configurations/ é das configurações. Cancelar Criar Fechar
    árvore                           → docs/busca/busca-app.xml 📎 | docs/busca/busca.xml 📎 | docs/loja/visao-geral.xml 📎 | docs/pagamento/boleto.xml 📎 | docs/pagamento/cartao.xml • novo | docs/pagamento/pix.xml 📎
    editor                           → "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
    problemas                        → linha 2 Start tag expected, '<' not found
    Vincular…                        → desligado
    digitado                         → Nenhum problema: o fragmento pode entrar num produto.
    salvo                            → docs/busca/busca-app.xml 📎 | docs/busca/busca.xml 📎 | docs/loja/visao-geral.xml 📎 | docs/pagamento/boleto.xml 📎 | docs/pagamento/cartao.xml | docs/pagamento/pix.xml 📎 · "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<"…
13. vínculo                          → Guia do cartão · pag_cartao
    árvore                           → docs/busca/busca-app.xml 📎 | docs/busca/busca.xml 📎 | docs/loja/visao-geral.xml 📎 | docs/pagamento/boleto.xml 📎 | docs/pagamento/cartao.xml 📎 | docs/pagamento/pix.xml 📎
14. Ctrl+Z no texto                  → texto de volta · vínculo Guia do cartão · pag_cartao
15. na aba Assets                    → doc_loja:ok editar | doc_busca:ok editar | doc_busca_app:ok editar | cartao:ok editar | doc_pix:ok editar | img_pix:ok - | doc_boleto:ok editar
    Editar doc_boleto                → docs/pagamento/boleto.xml
16. antes                            → docs/pagamento/boleto.xml • · 6 fragmentos · 1 com alterações
    diálogo                          → Descartar alterações? O texto de docs/pagamento/boleto.xml volta a ser o que está no disco. Cancelar Descartar Fechar
    depois                           → docs/pagamento/boleto.xml · 6 fragmentos · • Loja Online — mdd
17. Ctrl+S, diferentes do exemplo    → assets.xml docs/loja/visao-geral.xml docs/pagamento/cartao.xml docs/pagamento/pix.xml
erros no console                     → nenhum
app fechado
```

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

```
título ao abrir                    → Loja Online — mdd
árvore                             → loja catalogo busca mobile pagamento pag_cartao pag_pix pag_boleto
Tab abre o diálogo                 → Nova filha de “Busca”
ID sugerido                        → relatorio
ID repetido                        → O ID "busca" já existe no modelo.
filha criada e selecionada         → busca_relatorio | título: • Loja Online — mdd
renomear                           → Relatório mensal busca_relatorio
Ctrl+Z desfaz o nome               → Relatório busca_relatorio
Ctrl+Z remove a feature            → removida | título: Loja Online — mdd
diálogo de impacto                 → Excluir “PIX”? Dá para desfazer com Ctrl+Z enquanto o projeto estiver aberto. Features excluídas (1) PIX Restrições removidas inteiras (1) pag_pix implies mobile Assets desvinculados (os arquivos continuam no disco) (2) docs/pagamento/pix.xml docs/img/pix-fluxo.svg Configurações que vão abrir como desatualizadas (1) Loja Básica Cancelar Excluir Fechar
depois de excluir                  → loja catalogo busca mobile pagamento pag_cartao pag_boleto | RESTRIÇÕES (0)
Ctrl+Z restaura                    → true | RESTRIÇÕES (1)
Alt+↑ em busca                     → loja busca catalogo mobile pagamento pag_cartao pag_pix pag_boleto
grupo [4..*] recusado              → Edição recusada: O mínimo do grupo (4) passa do número de membros (3).
Ctrl+S                             → Loja Online — mdd | busca antes de catalogo no disco: true
conflito ao salvar                 → Arquivos alterados fora do app Estes arquivos mudaram no disco desde que foram abertos (por exemplo, depois de um git pull) e não foram gravados: model.xml Cancelar Recarregar (descarta minhas alterações) Sobrescrever Fechar
recarregar                         → loja busca catalogo mobile pagamento pag_cartao pag_pix pag_boleto | título: Loja Online — mdd
fechar com alteração               → Fechar com alterações não salvas? Se fechar sem salvar, as alterações serão perdidas. Cancelar Fechar sem salvar Salvar e fechar Fechar
tela inicial                       → mdd
app fechado
```

Do `configurador-ui.mjs`, exatamente (a mesma do plano da Fase 5):

```
aba                                  → Configurações
rótulo da aba cortado                → false
lista                                → conflito loja-basica
centro sem configuração aberta       → Escolha uma configuração na lista.
barra de status                      → 2 configurações
estados                              → loja+🔒 catalogo+🔒 busca+ mobile+🔒 pagamento+🔒 pag_cartao+ pag_pix+ pag_boleto-
barra de status                      → Loja Básica: Válida · completa
dica de mobile                       → Decidido pelo modelo
mobile aria-disabled                 → true
faixas                               → nenhuma
título                               → Loja Online — mdd
clique em mobile                     → loja+🔒 catalogo+🔒 busca+ mobile+🔒 pagamento+🔒 pag_cartao+ pag_pix+ pag_boleto- | Loja Online — mdd
1º clique em pag_pix                 → loja+🔒 catalogo+🔒 busca+ mobile? pagamento+🔒 pag_cartao+ pag_pix- pag_boleto-
2º clique em pag_pix                 → loja+🔒 catalogo+🔒 busca+ mobile? pagamento+🔒 pag_cartao+ pag_pix? pag_boleto-
barra de status                      → Loja Básica: Válida · incompleta (2 indecisas)
título                               → • Loja Online — mdd
3º clique em pag_pix                 → loja+🔒 catalogo+🔒 busca+ mobile+🔒 pagamento+🔒 pag_cartao+ pag_pix+ pag_boleto-
Tab no configurador                  → nada
botão desfazer                       → true | Desfazer vale só nas abas Modelo e Assets
painel de valores                    → busca mobile
valor fora da faixa                  → 100 | o máximo é 500
valor válido                         → 200 | erro: (nada)
plataforma sem valor                 → Loja Básica: Válida · incompleta (1 atributo sem valor) | Escolha um valor para a configuração ficar completa.
plataforma ios                       → Loja Básica: Válida · completa
arquivo sugerido                     → configurations/loja-basica-2.xml
criada e aberta                      → conflito loja-basica loja-completa* | Loja Completa: Válida · incompleta (5 indecisas)
renomeada                            → conflito loja-basica loja-premium*
nome sugerido na cópia               → Loja Premium (cópia)
duplicada                            → conflito loja-basica loja-premium loja-premium-copia*
diálogo de exclusão                  → O arquivo configurations/loja-premium-copia.xml será apagado quando você salvar. Até lá, fechar o projeto sem salvar mantém a configuração.
excluída                             → conflito loja-basica loja-premium | Escolha uma configuração na lista.
título depois de salvar              → Loja Online — mdd
loja-basica.xml                      → <value feature="busca" attribute="max_resultados">200</value> <value feature="mobile" attribute="plataforma">ios</value>
loja-premium.xml                     → <configuration xmlns="urn:mdd:configuration" schemaVersion="1" name="Loja Premium"/>
cópia no disco                       → (não existe)
impacto                              → Features excluídas (1) PIX Restrições removidas inteiras (1) pag_pix implies mobile Assets desvinculados (os arquivos continuam no disco) (2) docs/pagamento/pix.xml docs/img/pix-fluxo.svg Configurações que vão abrir como desatualizadas (1) Loja Básica
desatualizada: faixas                → orphans
referência órfã                      → Decisão sobre “pag_pix” (selecionada): a feature não existe mais.
estados                              → loja+🔒 catalogo+🔒 busca+ mobile? pagamento+🔒 pag_cartao+ pag_boleto-
barra de status                      → Loja Básica: Válida · incompleta (1 indecisa) · desatualizada
depois de remover                    → nenhuma | Loja Básica: Válida · incompleta (1 indecisa) | • Loja Online — mdd
conflito: faixas                     → conflict
decisões listadas                    → Catálogo — desselecionada Remover Busca — selecionada Remover
estados em conflito                  → loja? catalogo- busca+ mobile? pagamento? pag_cartao? pag_boleto?
nó em conflito responde?             → true
painel de valores                    → Resolva o problema indicado acima do diagrama para editar os valores.
depois de remover a decisão          → nenhuma | Conflito: Válida · incompleta (3 indecisas)
estados                              → loja+🔒 catalogo+🔒 busca+ mobile? pagamento+🔒 pag_cartao? pag_boleto?
erros no console                     → nenhum
app fechado
```

Do `assets-ui.mjs`, exatamente (a saída do plano da Fase 4):

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

Do `geracao-ui.mjs`, exatamente (a saída do plano da Fase 5; a hora aparece como `HH:MM`):

```
1. botão                             → ligado
   saida/ existe?                    → false
2. pag_pix desselecionada            → desligado | dica: Complete a configuração para gerar: 1 indecisa.
   pag_pix de volta                  → ligado
3. faixa                             → Produto gerado em saida/loja-basica/ às HH:MM Abrir pasta
   arquivos                          → product.xml sim, pix-fluxo.svg sim
   título igual ao de antes          → true
4. abriu                             → <projeto>\saida\loja-basica
5. em "Outra": faixa                 → (sem faixa)
   botão                             → desligado | dica: Complete a configuração para gerar: 5 indecisas.
   de volta: faixa                   → Produto gerado em saida/loja-basica/ às HH:MM Abrir pasta
6. diálogo                           → Substituir saida/loja-basica/? A pasta já existe e será trocada pelo produto novo. O que você tiver colocado nela à mão será perdido. Cancelar Substituir Fechar
   Cancelar: generatedAt igual       → true
   Substituir: generatedAt mudou     → true
   faixa                             → Produto gerado em saida/loja-basica/ às HH:MM Abrir pasta
7. diálogo                           → Não foi possível gerar Nada foi gravado. Problemas docs/pagamento/pix.xml [doc_pix] Arquivo ausente. Fechar Fechar
   generatedAt igual                 → true
8. depois do ×                       → (sem faixa)
erros no console                     → nenhum
app fechado
```

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

```markdown
# Editor de fragmentos com CodeMirror 6

Os fragmentos são editados dentro do app (Fase 6), num editor de XML com realce de sintaxe, números de linha, desfazer, busca e sublinhado de erros. Usamos o **CodeMirror 6**, uma biblioteca feita para editores de código no navegador. Ela é leve, não usa `eval` nem web workers e roda dentro do `app.asar` com a CSP atual (`style-src` já aceita `'unsafe-inline'`). Os pacotes entram um a um (`@codemirror/state`, `view`, `commands`, `language`, `lang-xml`, `search` e `lint`, mais o `@lezer/highlight` para as cores), em vez do pacote `codemirror` completo, para levar só o necessário.

## Considered Options

- **Monaco** (o editor do VS Code): pesa vários MB, depende de web workers e exige configuração própria de empacotamento no electron-vite. É demais para um editor simples com cores.
- **Feito à mão** (uma `<textarea>` transparente sobre um `<pre>` pintado por um tokenizador próprio): sem dependência, mas a sincronia da rolagem e da seleção é frágil e fica lenta em arquivos grandes. Os números de linha, a busca e o desfazer por arquivo teriam de ser feitos do zero.

## Consequences

- O CodeMirror só fica na interface (`ui/screens/fragments/`). O texto que ele edita é um `FragmentDocument` da aplicação, e a conferência é a mesma da geração (`FragmentChecker`), com os problemas mostrados como diagnósticos do `@codemirror/lint`.
- O CodeMirror troca toda quebra de linha por `\n` e não sabe do BOM. O domínio guarda o formato do arquivo (`text-format.ts`) e o devolve ao gravar, para que só mude no disco o que foi editado.
- O desfazer é do próprio CodeMirror, fora do histórico de comandos do projeto (ADR 0008): o `EditorState` de cada arquivo fica guardado enquanto o projeto está aberto, e Ctrl+Z na aba Fragmentos desfaz o texto, nunca o modelo.
- As cores vêm de variáveis CSS do tema (`--xml-*`), com valores para o tema claro e o escuro.
- Os textos do editor (busca, problemas, "Ir para a linha") são traduzidos por `EditorState.phrases`. Uma versão nova do CodeMirror pode trazer textos novos, que aparecem em inglês até entrarem na lista.
- Os roteiros de interface chegam ao `EditorView` por uma propriedade interna do DOM (`cmTile` desde a versão 6.43; antes, `cmView`). Ao atualizar o `@codemirror/view`, confira o `fragmentos-ui.mjs`.
```

- [ ] **Passo 5: A SPEC (`docs/SPEC.md`)**

§1 e §2 (a Fase 6 depois da primeira versão), §6.1 (as pastas), §6.2 (a porta `FragmentChecker`), §7 (a aba Fragmentos e o "Editar" na aba Assets), §8 (os fragmentos no salvar e na alteração externa) e §9 (a linha da Fase 6). A tabela do §9 é realinhada inteira pelo Prettier.

Troque:

<!-- prettier-ignore -->
```markdown
3. **Vincular assets** (arquivos do projeto) às features.
4. **Gerar** o `product.xml` de documentação de cada produto, que ferramentas externas convertem depois para as mídias finais.

A arquitetura é em camadas, com SOLID e Clean Code. Não há testes automatizados na primeira versão (ADR 0008); a aceitação de cada fase é manual, com o projeto de exemplo (§9).
```

por:

<!-- prettier-ignore -->
```markdown
3. **Vincular assets** (arquivos do projeto) às features.
4. **Gerar** o `product.xml` de documentação de cada produto, que ferramentas externas convertem depois para as mídias finais.
5. **Editar os fragmentos** dentro do app, num editor de XML (Fase 6).

A arquitetura é em camadas, com SOLID e Clean Code. Não há testes automatizados na primeira versão (ADR 0008); a aceitação de cada fase é manual, com o projeto de exemplo (§9).
```

Troque:

<!-- prettier-ignore -->
```markdown
- Assets com âncora e condição de presença.
- Geração do produto: `product.xml` com fragmentos embutidos mais os recursos copiados.

**Fora da primeira versão (fase "Depois"):** clones, restrições com atributos, análises do modelo (`ModelAnalyzer`: features mortas etc.), variabilidade anotativa, renderers por mídia, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes automatizados.
```

por:

<!-- prettier-ignore -->
```markdown
- Assets com âncora e condição de presença.
- Geração do produto: `product.xml` com fragmentos embutidos mais os recursos copiados.

**Depois da primeira versão:**

- Fase 6: editor de fragmentos, para criar e editar os fragmentos do projeto dentro do app, com realce de XML e a conferência da geração (ADR 0009). Ele não edita `model.xml`, `assets.xml` nem as configurações como texto, não renomeia nem exclui arquivos e só abre `.xml`.

**Fora da primeira versão (fase "Depois"):** clones, restrições com atributos, análises do modelo (`ModelAnalyzer`: features mortas etc.), variabilidade anotativa, renderers por mídia, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes automatizados.
```

Troque:

<!-- prettier-ignore -->
```markdown
      assets/              Asset, AssetCatalog, inclusão
      generation/          GenerationPlan (§4.4 passo 1)
    application/           Importa só domain/.
      ports/               interfaces (§6.2)
      commands/            EditorCommand, CommandHistory, comandos concretos
      use-cases/           abrir/salvar projeto, resolver configuração, gerar produto…
```

por:

<!-- prettier-ignore -->
```markdown
      assets/              Asset, AssetCatalog, inclusão
      generation/          GenerationPlan (§4.4 passo 1)
      fragments/           caminho de um fragmento novo, formato do texto (BOM e quebra de linha), codificação
    application/           Importa só domain/.
      ports/               interfaces (§6.2)
      fragments/           FragmentDocument, o fragmento aberto no editor
      commands/            EditorCommand, CommandHistory, comandos concretos
      use-cases/           abrir/salvar projeto, resolver configuração, gerar produto…
```

Troque:

<!-- prettier-ignore -->
```markdown
      app/                 composition root: instancia adapters e injeta via Context
      stores/              Zustand: estado de tela que chama use cases
      screens/             start, editor, configurator, assets, generation
      diagram/             nós e arestas do React Flow, layout com elkjs
      components/ui/       componentes shadcn/ui
```

por:

<!-- prettier-ignore -->
```markdown
      app/                 composition root: instancia adapters e injeta via Context
      stores/              Zustand: estado de tela que chama use cases
      screens/             start, editor, configurator, assets, generation, fragments
      diagram/             nós e arestas do React Flow, layout com elkjs
      components/ui/       componentes shadcn/ui
```

Troque:

<!-- prettier-ignore -->
```markdown
| `ProjectFolderPicker`                                                         | Escolher a pasta do projeto.                                                                                                                                                                                                                            | `ElectronProjectFolderPicker`                               |
| `ProjectFilePicker`                                                           | Escolher um arquivo dentro do projeto, num diálogo que começa na raiz. Devolve o caminho relativo e recusa um arquivo de fora.                                                                                                                          | `ElectronProjectFilePicker`                                 |
| `XmlSchemaValidator`                                                          | Etapas 1 e 2 da leitura (§5): XML bem-formado e conforme o XSD. Sem schema, só XML bem-formado (fragmentos da geração).                                                                                                                                 | `ElectronXmlSchemaValidator` (IPC → `xmllint-wasm` no main) |
| `Clock`                                                                       | Data e hora atuais (para `generatedAt`).                                                                                                                                                                                                                | `SystemClock`                                               |
```

por:

<!-- prettier-ignore -->
```markdown
| `ProjectFolderPicker`                                                         | Escolher a pasta do projeto.                                                                                                                                                                                                                            | `ElectronProjectFolderPicker`                               |
| `ProjectFilePicker`                                                           | Escolher um arquivo dentro do projeto, num diálogo que começa na raiz. Devolve o caminho relativo e recusa um arquivo de fora.                                                                                                                          | `ElectronProjectFilePicker`                                 |
| `XmlSchemaValidator`                                                          | Etapas 1 e 2 da leitura (§5): XML bem-formado e conforme o XSD. Sem schema, só XML bem-formado (fragmentos).                                                                                                                                            | `ElectronXmlSchemaValidator` (IPC → `xmllint-wasm` no main) |
| `FragmentChecker`                                                             | Conferir o texto de um fragmento como a geração confere (§4.4): a codificação, o XML bem-formado e a leitura com `@xmldom/xmldom`. Devolve os problemas, com a linha; lista vazia quando o fragmento pode entrar num produto.                           | `XmlFragmentChecker` (o `XmlProductDeriver` usa o mesmo)    |
| `Clock`                                                                       | Data e hora atuais (para `generatedAt`).                                                                                                                                                                                                                | `SystemClock`                                               |
```

Troque:

<!-- prettier-ignore -->
```markdown
**Janela do projeto:**

- barra lateral com as abas **Modelo**, **Configurações** e **Assets**;
- área central com o diagrama;
- painel direito de propriedades;
```

por:

<!-- prettier-ignore -->
```markdown
**Janela do projeto:**

- barra lateral com as abas **Modelo**, **Configurações**, **Assets** e **Fragmentos**;
- área central com o diagrama;
- painel direito de propriedades;
```

Troque:

<!-- prettier-ignore -->
```markdown
- Todas as edições de assets são comandos do histórico: desfazer e refazer valem nas abas Modelo e Assets (também com o foco numa lista de opções). Tab, Enter, F2, Delete e Alt+↑/↓ valem só na aba Modelo.
- O painel da feature, na aba Modelo, lista os assets ancorados nela, com o estado de cada arquivo e o botão "Vincular arquivo…".

## 8. Comportamentos transversais

- **Salvar é manual** (Ctrl+S) e grava tudo o que tiver alteração (modelo, assets e configurações, inclusive apagando os arquivos das configurações excluídas ou renomeadas). Os arquivos só são apagados depois que todas as configurações foram gravadas; se alguma gravação falhar, a exclusão fica para o próximo salvar. Como no Windows `Loja.xml` e `loja.xml` são o mesmo arquivo, duas chaves de configuração que só diferem na caixa contam como a mesma. O título da janela mostra `•` quando há algo não salvo. Fechar a janela ou o projeto com alterações pendentes pede confirmação.
- **Alteração externa:** o app guarda o hash de cada arquivo ao ler. Ao salvar, se o arquivo no disco mudou (por exemplo, depois de um `git pull`), ele pergunta se deve **sobrescrever**, **recarregar** (descartando as alterações locais daquele arquivo) ou **cancelar**. Nunca sobrescreve em silêncio.
- **Erros** de leitura seguem §5. Erros de disco e de geração aparecem em diálogo com todos os itens.
- **Interface em português. Empacotamento para Windows** (electron-builder, instalador NSIS).
```

por:

<!-- prettier-ignore -->
```markdown
- Todas as edições de assets são comandos do histórico: desfazer e refazer valem nas abas Modelo e Assets (também com o foco numa lista de opções). Tab, Enter, F2, Delete e Alt+↑/↓ valem só na aba Modelo.
- O painel da feature, na aba Modelo, lista os assets ancorados nela, com o estado de cada arquivo e o botão "Vincular arquivo…".
- Os assets do tipo fragmento têm o botão **Editar**, desligado quando o arquivo está ausente, que abre o arquivo na aba Fragmentos.

**Fragmentos** (Fase 6, ADR 0009):

- À esquerda, a árvore dos `.xml` do projeto, com as pastas todas abertas, as pastas antes dos arquivos e cada grupo em ordem alfabética. Ficam de fora `model.xml`, `assets.xml`, `configurations/` e `saida/`, os nomes começando com ponto (como `.git`) e as pastas sem nenhum `.xml`. Cada arquivo mostra `•` quando tem alteração não salva, "novo" quando ainda não existe no disco e um clipe quando é o arquivo de algum asset. No topo, **Novo fragmento** e **Atualizar**.
- No centro, o editor: realce de XML, números de linha, linha atual destacada, fechamento automático de tags, Tab para indentar (Esc e depois Tab tira o foco do editor) e Ctrl+F para buscar, com os textos em português. As cores vêm de variáveis do tema.
- Acima do editor, a barra do arquivo:
  - o caminho;
  - o vínculo ("Guia do PIX · `pag_pix`", com "+N" quando o arquivo é de mais de um asset) ou **Vincular a uma feature…**, ligado só quando o arquivo existe no disco, que abre o diálogo de vínculo da aba Assets com o caminho preenchido;
  - **Descartar alterações**, com confirmação: volta ao texto do disco, e um arquivo novo sai da lista.
- Abaixo do editor, os problemas do arquivo, cada um com a linha e a mensagem; clicar leva o cursor até a linha. As mesmas linhas ficam sublinhadas no editor, com a marca na margem. A conferência é a da geração (§4.4): roda ao abrir o arquivo e meio segundo depois da última tecla, e uma conferência que termina depois de outra mais nova é descartada.
- Um arquivo que não está em UTF-8 (pela declaração ou por bytes inválidos) abre só para leitura, com uma faixa que pede para salvá-lo em UTF-8 em outro editor. O app lê os arquivos como UTF-8, e os acentos já chegam trocados: gravar de volta os perderia.
- **Novo fragmento** pede o caminho, sugerindo a pasta do arquivo aberto. O caminho aceita `/` ou `\`, é gravado com `/` e adota a grafia das pastas que já existem (`Docs/Pagamento/cartao.xml` vira `docs/pagamento/cartao.xml`). É recusado, com o motivo, quando:
  - está vazio, é absoluto, tem `..` ou não termina em `.xml`;
  - tem um trecho vazio (`docs//a.xml`), um caractere que o Windows não aceita (`< > : " | ? *`), um trecho terminado em ponto ou espaço, ou um trecho começando com ponto;
  - é `model.xml` ou `assets.xml`, ou fica em `configurations/` ou `saida/`;
  - já existe no disco ou entre os arquivos novos, sem diferenciar maiúsculas de minúsculas.

  O arquivo começa só com a declaração `<?xml version="1.0" encoding="UTF-8"?>` e uma linha em branco. O app não inventa um elemento raiz, porque a geração não impõe vocabulário (ADR 0006). Como as configurações novas, o arquivo só chega ao disco no Ctrl+S, com as pastas que faltarem.

- Ctrl+Z e Ctrl+Y desfazem e refazem o texto. O histórico de cada arquivo dura enquanto o projeto está aberto, também ao trocar de arquivo ou de aba, e recomeça quando o texto é relido do disco (descartar, atualizar, recarregar). Os botões de desfazer e refazer do cabeçalho ficam desligados, e os atalhos de edição do modelo não valem.
- Sem arquivo aberto, o centro explica o que é um fragmento e mostra o botão "Novo fragmento".
- Barra de status: "N fragmentos · M com alterações".

## 8. Comportamentos transversais

- **Salvar é manual** (Ctrl+S) e grava tudo o que tiver alteração (modelo, assets e configurações, e depois os fragmentos, inclusive apagando os arquivos das configurações excluídas ou renomeadas). Os arquivos só são apagados depois que todas as configurações foram gravadas; se alguma gravação falhar, a exclusão fica para o próximo salvar. Como no Windows `Loja.xml` e `loja.xml` são o mesmo arquivo, duas chaves de configuração que só diferem na caixa contam como a mesma. O título da janela mostra `•` quando há algo não salvo. Fechar a janela ou o projeto com alterações pendentes pede confirmação.
- **Alteração externa:** o app guarda o hash de cada arquivo ao ler. Ao salvar, se o arquivo no disco mudou (por exemplo, depois de um `git pull`), ele pergunta se deve **sobrescrever**, **recarregar** (descartando as alterações locais daquele arquivo) ou **cancelar**. Nunca sobrescreve em silêncio.
- **Fragmentos** (Fase 6):
  - Só os fragmentos com alteração são gravados: abrir um arquivo e não mexer nunca o regrava. Cada um só é gravado se o disco ainda estiver como na última leitura, e um arquivo novo, se ainda não existir. Um fragmento alterado fora do app entra no mesmo diálogo de conflito; "Recarregar" relê o projeto, os fragmentos abertos saem da lista, e o exibido continua, relido do disco, se ainda existir.
  - **Erro de XML não impede salvar.** Um fragmento gravado com problema gera o aviso "Salvo com erro de XML: …", com o arquivo, a linha e o primeiro problema. O aviso some quando o arquivo é salvo sem problema e ao fechar o projeto; descartar não o tira, porque o disco continua com o erro. A geração continua recusando o fragmento.
  - O BOM e a quebra de linha ficam como estavam: CRLF quando o arquivo tem algum `\r\n`, senão LF. Um arquivo com quebras misturadas, ou com `\r` sozinho, só muda se for editado, e aí sai todo com a quebra dele.
  - Quando a janela volta ao foco (se a aba Fragmentos já foi aberta com o projeto) e no botão Atualizar, a árvore é relida. Um fragmento aberto sem alteração no app é relido do disco; com alteração, fica como está, e o conflito aparece ao salvar. Um arquivo apagado por fora sai da lista se não tinha alteração, e passa a contar como novo se tinha.
- **Erros** de leitura seguem §5. Erros de disco e de geração aparecem em diálogo com todos os itens.
- **Interface em português. Empacotamento para Windows** (electron-builder, instalador NSIS).
```

Troque:

<!-- prettier-ignore -->
```markdown
A aceitação de cada fase é manual e usa `docs/examples/loja-online`.

| Fase                          | Entrega                                                                                                                                                                                                                        | Aceitação                                                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0. Fundação**               | electron-vite + React + TS, Tailwind + shadcn/ui, ESLint + boundaries + Prettier, estrutura de pastas, IPC seguro com a raiz do projeto, empacotamento Windows                                                                 | `npm run dev` abre a janela. Um import proibido (React dentro de `domain/`) gera erro de lint. `npm run build:win` gera o instalador.                                                                                                                  |
| **1. Domínio e persistência** | Domínio completo do modelo, das expressões, das configurações e dos assets. Codecs XML dos três arquivos. Leitura em três etapas. Abrir e salvar projeto. Visualização provisória em lista.                                    | Abrir o exemplo mostra a árvore. Salvar sem alterações gera arquivos idênticos byte a byte. Um ID duplicado, um ID com hífen ou `max="0"` geram erro com arquivo e linha.                                                                              |
| **2A. Edição do modelo**      | Operações de edição no domínio, comandos com desfazer/refazer, árvore em lista selecionável, painéis de propriedades e de restrições, diálogos de impacto, de grupo, de conflito e de fechar, atalhos, projeto novo e recentes | Recriar o modelo do exemplo do zero pela interface (escolhendo os IDs na criação) e salvar produz um arquivo igual ao exemplo. Excluir `pag_pix` mostra: 1 restrição removida, 2 assets desvinculados, 1 configuração afetada. Desfazer restaura tudo. |
| **2B. Diagrama**              | Diagrama com React Flow e layout automático no lugar da lista, menu de contexto, arrastar e soltar para mover, subárvores recolhíveis                                                                                          | A aceitação da 2A, feita pelo diagrama.                                                                                                                                                                                                                |
| **3. Configurador**           | Adapter do solver, resolução, modo configuração no diagrama, valores de atributos, lista de configurações, configuração desatualizada                                                                                          | `loja-basica` abre completa, com `mobile` selecionada por propagação e travada. Remover a decisão de `pag_pix` deixa `mobile` indecisa. Depois de excluir `pag_pix` no modelo e salvar, `loja-basica` abre como desatualizada, com a referência órfã.  |
| **4. Assets**                 | Aba de assets, vínculo com âncora e condição, estado do arquivo, abrir no programa padrão                                                                                                                                      | A aba mostra os 6 assets do exemplo. Renomear `boleto.xml` fora do app faz o asset aparecer como ausente.                                                                                                                                              |
| **5. Geração**                | Plano, verificação, `XmlProductDeriver`, pasta temporária e troca                                                                                                                                                              | Gerar `loja-basica` produz o equivalente a `produto-esperado/loja-basica/` (mais `docs/img/pix-fluxo.svg`). Com `pag_boleto` selecionado e `boleto.xml` ausente, a geração falha e não grava nada.                                                     |
| **Depois**                    | `ModelAnalyzer`, variabilidade anotativa, renderers por mídia, restrições com atributos, clones, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes                                           | —                                                                                                                                                                                                                                                      |

## 10. Em aberto
```

por:

<!-- prettier-ignore -->
```markdown
A aceitação de cada fase é manual e usa `docs/examples/loja-online`.

| Fase                          | Entrega                                                                                                                                                                                                                        | Aceitação                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0. Fundação**               | electron-vite + React + TS, Tailwind + shadcn/ui, ESLint + boundaries + Prettier, estrutura de pastas, IPC seguro com a raiz do projeto, empacotamento Windows                                                                 | `npm run dev` abre a janela. Um import proibido (React dentro de `domain/`) gera erro de lint. `npm run build:win` gera o instalador.                                                                                                                                                                                                                                                                                                             |
| **1. Domínio e persistência** | Domínio completo do modelo, das expressões, das configurações e dos assets. Codecs XML dos três arquivos. Leitura em três etapas. Abrir e salvar projeto. Visualização provisória em lista.                                    | Abrir o exemplo mostra a árvore. Salvar sem alterações gera arquivos idênticos byte a byte. Um ID duplicado, um ID com hífen ou `max="0"` geram erro com arquivo e linha.                                                                                                                                                                                                                                                                         |
| **2A. Edição do modelo**      | Operações de edição no domínio, comandos com desfazer/refazer, árvore em lista selecionável, painéis de propriedades e de restrições, diálogos de impacto, de grupo, de conflito e de fechar, atalhos, projeto novo e recentes | Recriar o modelo do exemplo do zero pela interface (escolhendo os IDs na criação) e salvar produz um arquivo igual ao exemplo. Excluir `pag_pix` mostra: 1 restrição removida, 2 assets desvinculados, 1 configuração afetada. Desfazer restaura tudo.                                                                                                                                                                                            |
| **2B. Diagrama**              | Diagrama com React Flow e layout automático no lugar da lista, menu de contexto, arrastar e soltar para mover, subárvores recolhíveis                                                                                          | A aceitação da 2A, feita pelo diagrama.                                                                                                                                                                                                                                                                                                                                                                                                           |
| **3. Configurador**           | Adapter do solver, resolução, modo configuração no diagrama, valores de atributos, lista de configurações, configuração desatualizada                                                                                          | `loja-basica` abre completa, com `mobile` selecionada por propagação e travada. Remover a decisão de `pag_pix` deixa `mobile` indecisa. Depois de excluir `pag_pix` no modelo e salvar, `loja-basica` abre como desatualizada, com a referência órfã.                                                                                                                                                                                             |
| **4. Assets**                 | Aba de assets, vínculo com âncora e condição, estado do arquivo, abrir no programa padrão                                                                                                                                      | A aba mostra os 6 assets do exemplo. Renomear `boleto.xml` fora do app faz o asset aparecer como ausente.                                                                                                                                                                                                                                                                                                                                         |
| **5. Geração**                | Plano, verificação, `XmlProductDeriver`, pasta temporária e troca                                                                                                                                                              | Gerar `loja-basica` produz o equivalente a `produto-esperado/loja-basica/` (mais `docs/img/pix-fluxo.svg`). Com `pag_boleto` selecionado e `boleto.xml` ausente, a geração falha e não grava nada.                                                                                                                                                                                                                                                |
| **6. Editor de fragmentos**   | Aba Fragmentos com o CodeMirror 6 (ADR 0009): árvore dos `.xml`, editor com realce e a conferência da geração, novo fragmento, vínculo pelo editor, "Editar" na aba Assets, salvar junto com o projeto                         | A árvore mostra os 5 `.xml` de `docs/`, sem o `model.xml`, o `assets.xml` e `configurations/`. Trocar o título do `pix.xml` e salvar muda só esse arquivo, com a quebra de linha e o BOM de antes. Apagar o `>` de uma tag mostra o problema com a linha, e a geração de `loja-basica` passa a recusar o arquivo. Criar `docs/pagamento/cartao.xml`, salvar e vinculá-lo a `pag_cartao` pelo editor faz o arquivo aparecer na aba Assets como ok. |
| **Depois**                    | `ModelAnalyzer`, variabilidade anotativa, renderers por mídia, restrições com atributos, clones, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## 10. Em aberto
```

- [ ] **Passo 6: A spec do desenho (`docs/superpowers/specs/2026-09-24-fase-6-editor-fragmentos-design.md`)**

O que o protótipo respondeu (itens 1 a 11 de "O que o protótipo respondeu"), com uma nota no topo.

Troque:

<!-- prettier-ignore -->
```markdown

Aprovado em 24/09/2026. É a primeira fase depois da primeira versão (SPEC §9). Não estava no roadmap: o usuário pediu um editor de XML dentro do app para criar e editar os fragmentos sem outro programa.

## Objetivo
```

por:

<!-- prettier-ignore -->
```markdown

Aprovado em 24/09/2026. É a primeira fase depois da primeira versão (SPEC §9). Não estava no roadmap: o usuário pediu um editor de XML dentro do app para criar e editar os fragmentos sem outro programa.

> O protótipo refinou alguns pontos deste desenho, já corrigidos abaixo: o `FragmentFiles` no lugar do `ListFragmentFiles`, a codificação no domínio, a grafia das pastas num caminho novo, o aviso que não some ao descartar, o desfazer que dura também ao trocar de aba e o tema escuro, que o app ainda não liga. Veja "O que o protótipo respondeu" no [plano](../plans/2026-09-24-fase-6-editor-fragmentos.md); a SPEC já reflete esses pontos.

## Objetivo
```

Troque:

<!-- prettier-ignore -->
```markdown
3. Apagar o `>` de uma tag: o problema aparece com a linha, e a geração de `loja-basica` também passa a recusar o arquivo.
4. Criar `docs/pagamento/cartao.xml`, escrever um conteúdo válido, salvar e vincular à feature `pag_cartao` (que hoje não tem asset) pelo editor: o arquivo aparece na aba Assets como ok.
5. Checagem à mão com o usuário no `mdd.exe`: a aparência do editor, as cores nos temas claro e escuro e a volta do foco depois de editar um arquivo por fora.

**Não muda:**
```

por:

<!-- prettier-ignore -->
```markdown
3. Apagar o `>` de uma tag: o problema aparece com a linha, e a geração de `loja-basica` também passa a recusar o arquivo.
4. Criar `docs/pagamento/cartao.xml`, escrever um conteúdo válido, salvar e vincular à feature `pag_cartao` (que hoje não tem asset) pelo editor: o arquivo aparece na aba Assets como ok.
5. Checagem à mão com o usuário no `mdd.exe`: a aparência do editor, as cores do tema claro e a volta do foco depois de editar um arquivo por fora. O tema escuro não entra: o app ainda não o liga (nada aplica a classe `.dark`).

**Não muda:**
```

Troque:

<!-- prettier-ignore -->
```markdown
  - Tab indenta (Esc e depois Tab tira o foco do editor, como manda o CodeMirror para acessibilidade);
  - Ctrl+F abre a busca, com os textos do painel em português (`EditorState.phrases`);
  - Ctrl+Z e Ctrl+Y desfazem e refazem o texto. O histórico de cada arquivo é mantido ao trocar de arquivo, e se perde quando o texto é relido do disco (descartar, atualizar, recarregar);
  - as cores seguem as variáveis de tema do app, nos temas claro e escuro.
- **Acima do editor, a barra do arquivo:** o caminho e:
  - o vínculo, se o arquivo é de algum asset: o nome do asset e a âncora ("Guia do PIX · `pag_pix`"), com "+N" quando há mais de um;
```

por:

<!-- prettier-ignore -->
```markdown
  - Tab indenta (Esc e depois Tab tira o foco do editor, como manda o CodeMirror para acessibilidade);
  - Ctrl+F abre a busca, com os textos do painel em português (`EditorState.phrases`);
  - Ctrl+Z e Ctrl+Y desfazem e refazem o texto. O histórico de cada arquivo dura enquanto o projeto está aberto, também ao trocar de arquivo ou de aba (ir a Configurações para gerar e voltar não o perde), e se perde quando o texto é relido do disco (descartar, atualizar, recarregar);
  - as cores vêm das variáveis de tema do app (`--xml-*`), com valores para o tema claro e o escuro.
- **Acima do editor, a barra do arquivo:** o caminho e:
  - o vínculo, se o arquivo é de algum asset: o nome do asset e a âncora ("Guia do PIX · `pag_pix`"), com "+N" quando há mais de um;
```

Troque:

<!-- prettier-ignore -->
```markdown
### Novo fragmento

Um diálogo pede o caminho, sugerindo a pasta do arquivo aberto (por exemplo, `docs/pagamento/`). O caminho aceita `/` ou `\` e é gravado com `/`. É recusado, com o motivo, quando:

- está vazio, não termina em `.xml`, é absoluto ou tem `..`;
- tem um trecho vazio (`docs//a.xml`), um caractere que o Windows não aceita (`< > : " | ? *`) ou um trecho terminado em ponto ou espaço;
- é `model.xml` ou `assets.xml`, ou fica em `configurations/` ou `saida/`;
- já existe no disco ou entre os arquivos novos, sem diferenciar maiúsculas de minúsculas (no Windows, `Pix.xml` e `pix.xml` são o mesmo arquivo).
```

por:

<!-- prettier-ignore -->
```markdown
### Novo fragmento

Um diálogo pede o caminho, sugerindo a pasta do arquivo aberto (por exemplo, `docs/pagamento/`). O caminho aceita `/` ou `\` e é gravado com `/`. Ele adota a grafia das pastas que já existem: no Windows, `Docs/Pagamento/cartao.xml` cai na pasta `docs/pagamento/`, e o arquivo novo passa a ser `docs/pagamento/cartao.xml`, para aparecer na árvore junto com os outros. É recusado, com o motivo, quando:

- está vazio, não termina em `.xml`, é absoluto ou tem `..`;
- tem um trecho vazio (`docs//a.xml`), um caractere que o Windows não aceita (`< > : " | ? *`), um trecho terminado em ponto ou espaço, ou um trecho começando com ponto (ficaria fora da árvore);
- é `model.xml` ou `assets.xml`, ou fica em `configurations/` ou `saida/`;
- já existe no disco ou entre os arquivos novos, sem diferenciar maiúsculas de minúsculas (no Windows, `Pix.xml` e `pix.xml` são o mesmo arquivo).
```

Troque:

<!-- prettier-ignore -->
```markdown
- Um fragmento alterado fora do app entra no **diálogo de conflito que já existe**, junto com os arquivos do projeto. "Sobrescrever" grava por cima; "Recarregar" relê tudo do disco e descarta as alterações, inclusive as dos fragmentos.
- Uma edição feita durante a gravação é mantida, como no `SaveProject`: o arquivo continua com "•".
- **Erro de XML não impede salvar.** Cada fragmento gravado com problema gera um aviso na faixa de avisos, com o arquivo, a linha e a mensagem do primeiro problema: "Salvo com erro de XML: …". O aviso do arquivo some quando ele é salvo sem problema, ao descartar e ao fechar o projeto. A geração continua recusando o fragmento quebrado.

### Não estragar o arquivo

- **BOM e quebra de linha:** ao abrir, o app guarda se o arquivo tinha BOM e se usava CRLF ou LF (CRLF quando aparece algum `\r\n`). O editor trabalha sem BOM e com `\n`. Ao gravar, o texto volta para o formato original. Sem isso, o CodeMirror trocaria tudo por LF, e o arquivo mudaria inteiro no git.
- **Codificação:** veja "Arquivo só para leitura".
```

por:

<!-- prettier-ignore -->
```markdown
- Um fragmento alterado fora do app entra no **diálogo de conflito que já existe**, junto com os arquivos do projeto. "Sobrescrever" grava por cima; "Recarregar" relê tudo do disco e descarta as alterações, inclusive as dos fragmentos.
- Uma edição feita durante a gravação é mantida, como no `SaveProject`: o arquivo continua com "•".
- **Erro de XML não impede salvar.** Cada fragmento gravado com problema gera um aviso na faixa de avisos, com o arquivo, a linha e a mensagem do primeiro problema: "Salvo com erro de XML: …". O aviso do arquivo some quando ele é salvo sem problema e ao fechar o projeto. Descartar não o tira, porque o disco continua com o erro. A geração continua recusando o fragmento quebrado.
- Um fragmento novo gravado continua na árvore, agora como arquivo do disco.
- O "Salvo às …" do cabeçalho só aparece quando o projeto e os fragmentos foram gravados sem conflito nem erro. Se o projeto for fechado ou trocado durante a gravação, o resultado não mexe na sessão nova.

### Não estragar o arquivo

- **BOM e quebra de linha:** ao abrir, o app guarda se o arquivo tinha BOM e se usava CRLF ou LF (CRLF quando aparece algum `\r\n`). O editor trabalha sem BOM e com `\n`. Ao gravar, o texto volta para o formato original. Sem isso, o CodeMirror trocaria tudo por LF, e o arquivo mudaria inteiro no git. Um arquivo com quebras misturadas, ou com `\r` sozinho, só muda se for editado: ao gravar, sai todo em CRLF (ou LF). Um arquivo sem alteração nunca é gravado.
- **Codificação:** veja "Arquivo só para leitura".
```

Troque:

<!-- prettier-ignore -->
```markdown
- `domain/fragments/fragment-path.ts`: as regras de um caminho de fragmento novo (acima) e quais arquivos e pastas aparecem na árvore.
- `domain/fragments/text-format.ts`: identifica o BOM e a quebra de linha, converte o conteúdo do arquivo para o texto do editor e o texto do editor de volta para o formato do arquivo.

**Aplicação:**
```

por:

<!-- prettier-ignore -->
```markdown
- `domain/fragments/fragment-path.ts`: as regras de um caminho de fragmento novo (acima) e quais arquivos e pastas aparecem na árvore.
- `domain/fragments/text-format.ts`: identifica o BOM e a quebra de linha, converte o conteúdo do arquivo para o texto do editor e o texto do editor de volta para o formato do arquivo.
- `domain/fragments/encoding.ts`: a codificação declarada, a linha do primeiro byte que não é UTF-8 e o problema que isso dá. Saiu do `fragment-source.ts` da geração, porque o `OpenFragment` também precisa dela.

**Aplicação:**
```

Troque:

<!-- prettier-ignore -->
```markdown
- `application/fragments/fragment-document.ts`: o arquivo aberto. Guarda o caminho, o texto atual, o texto salvo (`null` num arquivo novo), o hash da última leitura ou gravação, o formato (BOM e quebra de linha) e o motivo de ficar só para leitura, quando houver. `isModified(document)` compara o texto atual com o salvo.
- Porta `FragmentChecker`: `check(path, content)` devolve os problemas (`FileProblem[]`), lista vazia quando está tudo certo.
- `ListFragmentFiles`: percorre as pastas pela porta `ProjectStorage` e devolve os caminhos que entram na árvore.
- `OpenFragment`: lê o arquivo, identifica o formato e decide se fica só para leitura.
- `SaveFragments`: grava os documentos alterados com as precondições e devolve os documentos atualizados, os conflitos e os problemas, no formato do `SaveProject`, para a store juntar os dois.
```

por:

<!-- prettier-ignore -->
```markdown
- `application/fragments/fragment-document.ts`: o arquivo aberto. Guarda o caminho, o texto atual, o texto salvo (`null` num arquivo novo), o hash da última leitura ou gravação, o formato (BOM e quebra de linha) e o motivo de ficar só para leitura, quando houver. `isModified(document)` compara o texto atual com o salvo.
- Porta `FragmentChecker`: `check(path, content)` devolve os problemas (`FileProblem[]`), lista vazia quando está tudo certo.
- `FragmentFiles`: `list()` percorre as pastas pela porta `ProjectStorage` e devolve os caminhos que entram na árvore; `checkNewPath()` confere o caminho de um fragmento novo. As duas dependem das mesmas regras e do nome da pasta de saída, que vem da composition root.
- `OpenFragment`: lê o arquivo, identifica o formato e decide se fica só para leitura.
- `SaveFragments`: grava os documentos alterados com as precondições e devolve os documentos atualizados, os conflitos e os problemas, no formato do `SaveProject`, para a store juntar os dois.
```

Troque:

<!-- prettier-ignore -->
```markdown
**Infraestrutura:**

- `XmlFragmentChecker`: recebe as conferências que hoje estão em `XmlProductDeriver.loadFragment` (codificação, "�", `xmllint`, `@xmldom/xmldom` e a extração da raiz). Implementa a porta `FragmentChecker` e dá ao `XmlProductDeriver` a raiz extraída. Assim o editor e a geração conferem do mesmo jeito. A saída do `generate-product-check.mts` tem de continuar igual.

**Interface:**
```

por:

<!-- prettier-ignore -->
```markdown
**Infraestrutura:**

- `XmlFragmentChecker`: recebe as conferências que hoje estão em `XmlProductDeriver.loadFragment` (codificação, "�", `xmllint`, `@xmldom/xmldom` e a extração da raiz). Implementa a porta `FragmentChecker` e dá ao `XmlProductDeriver` a raiz extraída. Assim o editor e a geração conferem do mesmo jeito. O `XmlProductDeriver` mantém o construtor `(storage, validator)` e cria o `XmlFragmentChecker` por dentro, então a saída do `generate-product-check.mts` continua igual, sem mudar o roteiro.

**Interface:**
```

Troque:

<!-- prettier-ignore -->
```markdown
- `ui/stores/fragments-actions.ts`, no molde do `assets-actions.ts`: os caminhos da árvore, os documentos abertos, o caminho exibido, os problemas por arquivo, e as ações listar, abrir, editar, criar, descartar e atualizar.
- `project-store.ts`: o `hasUnsavedChanges` passa a olhar os fragmentos; o `save` chama o `SaveFragments` depois do `SaveProject` e junta conflitos, problemas e avisos; fechar e recarregar limpam os documentos.
- `ui/screens/fragments/`: `FragmentsWorkspace`, `FragmentTree`, `FragmentBar`, `FragmentProblems`, `FragmentEditor` (guarda o estado do CodeMirror de cada arquivo, o que mantém o desfazer ao trocar de arquivo), `xml-editor-setup.ts` (extensões, tema e textos em português), `NewFragmentDialog` e `DiscardFragmentDialog`.
- Telas que já existem: `ViewRail` (a aba), `ProjectScreen` (a aba, os atalhos, a barra de status e a volta do foco), `AssetList` (o botão "Editar"). O `LinkAssetDialog` é reaproveitado sem mudança.

## Verificação
```

por:

<!-- prettier-ignore -->
```markdown
- `ui/stores/fragments-actions.ts`, no molde do `assets-actions.ts`: os caminhos da árvore, os documentos abertos, o caminho exibido, os problemas por arquivo, e as ações listar, abrir, editar, criar, descartar e atualizar.
- `project-store.ts`: o `hasUnsavedChanges` passa a olhar os fragmentos; o `save` chama o `SaveFragments` depois do `SaveProject` e junta conflitos, problemas e avisos; fechar e recarregar limpam os documentos.
- `ui/screens/fragments/`: `FragmentsWorkspace`, `FragmentTree` (com a árvore montada em `fragment-tree.ts`), `FragmentBar`, `FragmentProblems`, `FragmentStatusBar`, `FragmentEditor` (troca o estado do CodeMirror de cada arquivo ao mudar de arquivo), `fragment-editor-states.ts` (o tipo do mapa desses estados), `xml-editor-setup.ts` (extensões, tema e textos em português) e `FragmentDialogs.tsx` (`NewFragmentDialog` e `DiscardFragmentDialog`).
- Telas que já existem: `ViewRail` (a aba), `ProjectScreen` (a aba, os atalhos, a barra de status, a volta do foco e o mapa dos estados do editor, que dura enquanto o projeto está aberto), `AssetsWorkspace` e `AssetList` (o botão "Editar"). O `LinkAssetDialog` é reaproveitado sem mudança.

## Verificação
```

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
