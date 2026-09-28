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

| Arquivo                                                                                                       | Responsabilidade                                                  |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `domain/fragments/fragment-format.ts`                                                                         | O formato pela extensão e o texto de um fragmento novo            |
| `domain/pages/page-layout.ts`                                                                                 | `moldura.html`, `index.html`, `product.xml` e a moldura padrão    |
| `domain/pages/markers.ts`                                                                                     | Os marcadores: achar, conferir contra o modelo, contar e resolver |
| `domain/pages/page-paths.ts`                                                                                  | Os caminhos citados e o endereço na página                        |
| `domain/pages/page-assembly.ts`                                                                               | O escape do HTML, as seções e o sumário                           |
| `domain/shared/text-lines.ts`                                                                                 | A linha de uma posição no texto                                   |
| `domain/fragments/fragment-path.ts`, `domain/assets/asset-edits.ts`                                           | `.html` na árvore, no caminho novo e no tipo sugerido             |
| `domain/feature-model/traversal.ts`, `domain/generation/generation-plan.ts`                                   | `attributeIdsByFeature`; `hasPage` e `modelAttributes` no plano   |
| `application/fragments/fragment-document.ts`                                                                  | O texto inicial pelo formato                                      |
| `application/generation/combined-product-deriver.ts`                                                          | Os dois formatos do produto juntos                                |
| `application/fragments/fragment-checker-by-format.ts`                                                         | O checker pela extensão                                           |
| `infrastructure/html/html-source.ts`, `html-fragment-checker.ts`, `html-page-deriver.ts`                      | A leitura com o parse5, a conferência e a página                  |
| `infrastructure/xml/xml-product-deriver.ts`                                                                   | Ignora os fragmentos `.html`                                      |
| `ui/app/composition-root.ts`                                                                                  | Injeta o deriver e o checker compostos                            |
| `ui/screens/fragments/fragment-editor-setup.ts` (era `xml-editor-setup.ts`)                                   | A linguagem pela extensão, a cor e a sugestão dos marcadores      |
| `ui/screens/fragments/FragmentEditor.tsx`, `FragmentsWorkspace.tsx`, `FragmentBar.tsx`, `FragmentDialogs.tsx` | Os marcadores do modelo, o texto sem arquivo, a moldura e a dica  |
| `ui/stores/fragments-actions.ts`, `ui/app/index.css`                                                          | Os IDs dos marcadores contra o modelo, o aviso e as cores         |
| `docs/examples/herby/`, `docs/examples/produto-esperado/herby-completa-atibaia/`                              | O exemplo da fase e a página esperada                             |
| `docs/adr/0010-paginas-html-como-segunda-saida.md`, `CONTEXT.md`, `docs/SPEC.md`                              | A documentação                                                    |

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

```ts
// Os marcadores (Fase 7): sintaxe, escape, espaços, IDs contra o modelo e valores contra o plano.
//   npx tsx --tsconfig tsconfig.web.json .checks/markers-check.mts
import type { GenerationPlan } from '@/domain/generation/generation-plan'
import {
  findMarkers,
  frameCountProblems,
  markerIdProblem,
  markerLabel,
  markerValue
} from '@/domain/pages/markers'

const show = (text: string): void => {
  const found = findMarkers(text)
  const markers = found.markers.map(
    (marker) => `${markerLabel(marker.target)}@${marker.start}-${marker.end}`
  )
  const problems = found.problems.map((problem) => `${problem.offset}: ${problem.message}`)
  console.log(
    `${JSON.stringify(text)} → [${markers.join(', ')}]${problems.length ? ` problemas: ${problems.join(' | ')}` : ''}`
  )
}

console.log('--- sintaxe')
show('Olá {{loja.versao}}!')
show('{{ loja.versao }} e {{produto}}')
show('\\{{loja.versao}} fica literal')
show('{{loja.versao')
show('{{ a {{loja.versao}}')
show('{{Loja.Versao}} {{loja-versao}} {{a.b.c}}')
show('{{contuedo}} {{conteudo}} {{sumario}}')
show('sem marcador { } }} {')

const modelAttributes = new Map([
  ['loja', ['versao']],
  ['mobile', ['plataforma']]
])
console.log('--- IDs')
for (const text of [
  '{{loja.versao}}',
  '{{loja.nome}}',
  '{{carrinho.total}}',
  '{{conteudo}}',
  '{{produto}}'
]) {
  const target = findMarkers(text).markers[0].target
  console.log(`${text}: ${markerIdProblem(target, modelAttributes) ?? 'ok'}`)
}

console.log('--- contagem na moldura')
for (const text of [
  '<body>{{conteudo}}</body>',
  '<body></body>',
  '{{conteudo}}{{conteudo}}{{sumario}}{{sumario}}'
]) {
  const problems = frameCountProblems(findMarkers(text).markers)
  console.log(
    `${text} → ${problems.map((problem) => `${problem.offset}: ${problem.message}`).join(' | ') || 'ok'}`
  )
}

console.log('--- valores')
const plan = {
  productName: 'Loja <Básica>',
  modelName: 'Loja',
  features: [{ id: 'loja', name: 'Loja', attributes: [{ id: 'versao', value: '1.0 & "beta"' }] }],
  root: { featureId: 'loja', fragments: [], children: [] },
  resources: [],
  hasPage: true,
  modelAttributes
} satisfies GenerationPlan
for (const text of [
  '{{loja.versao}}',
  '{{produto}}',
  '\\{{',
  '{{mobile.plataforma}}',
  '{{loja.nome}}',
  '{{sumario}}'
]) {
  const value = markerValue(findMarkers(text).markers[0].target, plan)
  console.log(`${text} → ${value.ok ? JSON.stringify(value.value) : `problema: ${value.error}`}`)
}
```

- [ ] **Passo 3: Escrever o roteiro `.checks/page-paths-check.mts`**

Os caminhos citados: relativos, com `?` e `#`, com espaço, saindo do projeto, começando com `/`, os que ficam como estão, e o `srcset`.

```ts
// Os caminhos citados pela página (Fase 7): relativos à pasta do arquivo, reescritos para o index.html.
//   npx tsx --tsconfig tsconfig.web.json .checks/page-paths-check.mts
import { formatSrcset, pageUrl, resolveCitedUrl, srcsetCandidates } from '@/domain/pages/page-paths'

const cases: [string, string][] = [
  ['docs/pagamento/pix.html', '../img/pix-fluxo.svg'],
  ['docs/pagamento/pix.html', 'img/a.png?v=2#topo'],
  ['docs/pagamento/pix.html', './guia.pdf'],
  ['docs/pagamento/pix.html', 'Slides%20por%20Feature/06.pptx'],
  ['docs/pagamento/pix.html', '..\\img\\b.png'],
  ['moldura.html', 'css/site.css'],
  ['moldura.html', '  css/site.css  '],
  ['docs/pix.html', '../../fora.png'],
  ['docs/pix.html', '/img/a.png'],
  ['docs/pix.html', 'https://exemplo.com/a.png'],
  ['docs/pix.html', '//cdn.exemplo.com/a.js'],
  ['docs/pix.html', 'mailto:a@b.com'],
  ['docs/pix.html', 'tel:+5532999'],
  ['docs/pix.html', 'data:image/png;base64,AAAA'],
  ['docs/pix.html', 'javascript:void(0)'],
  ['docs/pix.html', '#pagamento'],
  ['docs/pix.html', '?aba=2'],
  ['docs/pix.html', ''],
  ['docs/pix.html', '..']
]
for (const [from, url] of cases) {
  const cited = resolveCitedUrl(from, url)
  const shown =
    cited.kind === 'file' ? `file ${cited.path} → ${pageUrl(cited.path, cited.suffix)}` : cited.kind
  console.log(`${from} + ${JSON.stringify(url)} → ${shown}`)
}
console.log(`pageUrl: ${pageUrl('Slides por Feature/06 - Acesso à Plataforma.pptx', '')}`)
console.log(`pageUrl: ${pageUrl('docs/100%/a#b?.png', '#x')}`)
const candidates = srcsetCandidates(' img/a.png 1x,img/b.png   2x , img/c.png ')
console.log(`srcset: ${JSON.stringify(candidates)} → ${formatSrcset(candidates)}`)
```

- [ ] **Passo 4: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/markers-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/page-paths-check.mts
```

Esperado: os dois falham com `ERR_MODULE_NOT_FOUND` (os módulos de `domain/pages/` não existem).

- [ ] **Passo 5: Criar `src/renderer/src/domain/pages/page-layout.ts`**

```ts
/*
 * Os nomes fixos da página (SPEC §4.4, Fase 7): a moldura, opcional, fica na raiz do projeto,
 * e a página gerada fica na raiz da pasta do produto, ao lado do product.xml.
 */

export const FRAME_PATH = 'moldura.html'
export const PAGE_PATH = 'index.html'
export const PRODUCT_PATH = 'product.xml'

/** A moldura quando o projeto não tem `moldura.html`, e o texto de uma moldura nova. */
export const DEFAULT_FRAME = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{produto}}</title>
</head>
<body>
{{conteudo}}
</body>
</html>
`

/** O arquivo é a moldura (na raiz, sem diferenciar caixa, como no Windows). */
export function isFramePath(path: string): boolean {
  return path.toLowerCase() === FRAME_PATH
}
```

- [ ] **Passo 6: Criar `src/renderer/src/domain/fragments/fragment-format.ts`**

```ts
import { DEFAULT_FRAME, isFramePath } from '../pages/page-layout'

/*
 * Os dois formatos de fragmento (Fase 7): o XML, embutido no product.xml, e o HTML, que monta
 * a página. O formato sai da extensão, sem diferenciar caixa.
 */

export type FragmentFormat = 'xml' | 'html'

const EXTENSIONS: Readonly<Record<FragmentFormat, string>> = { xml: '.xml', html: '.html' }

/** O formato do arquivo, ou `null` quando ele não é um fragmento. */
export function fragmentFormat(path: string): FragmentFormat | null {
  const lower = path.toLowerCase()
  if (lower.endsWith(EXTENSIONS.xml)) return 'xml'
  if (lower.endsWith(EXTENSIONS.html)) return 'html'
  return null
}

/**
 * O texto de um fragmento novo. O XML começa só com a declaração: o app não inventa uma raiz,
 * porque a geração não impõe vocabulário (ADR 0006). O HTML começa vazio, e a moldura, com a
 * moldura padrão.
 */
export function initialFragmentText(path: string): string {
  if (isFramePath(path)) return DEFAULT_FRAME
  return fragmentFormat(path) === 'html' ? '' : '<?xml version="1.0" encoding="UTF-8"?>\n'
}
```

- [ ] **Passo 7: Criar `src/renderer/src/domain/shared/text-lines.ts`**

```ts
/** As quebras de linha, contadas como no editor e no @xmldom/xmldom: "\r\n", "\r" sozinho e "\n". */
const LINE_BREAK = /\r\n?|\n/g

/** A linha (a partir de 1) da posição `offset` do texto. */
export function lineAt(text: string, offset: number): number {
  return (text.slice(0, offset).match(LINE_BREAK)?.length ?? 0) + 1
}
```

- [ ] **Passo 8: Criar `src/renderer/src/domain/pages/markers.ts`**

```ts
import type { GenerationPlan } from '../generation/generation-plan'
import { err, ok, type Result } from '../shared/result'

/*
 * Os marcadores dos fragmentos HTML e da moldura (SPEC §4.4, Fase 7): `{{feature.atributo}}`
 * vira o valor do atributo; `{{produto}}`, o nome da configuração; `{{conteudo}}` e
 * `{{sumario}}`, só na moldura, as seções e o sumário. Espaços dentro das chaves valem, e
 * `\{{` escreve `{{`. Aqui fica só o texto: onde cada marcador pode estar no HTML (numa tag,
 * num `<script>`) é conferido por quem lê o HTML.
 */

export type ReservedMarker = 'conteudo' | 'sumario' | 'produto'

export type MarkerTarget =
  | { readonly kind: 'attribute'; readonly featureId: string; readonly attributeId: string }
  | { readonly kind: 'reserved'; readonly name: ReservedMarker }
  /** `\{{`, que vira `{{`. */
  | { readonly kind: 'escape' }

export interface Marker {
  /** A posição do primeiro caractere (a `\` num escape). */
  readonly start: number
  /** A posição logo depois do último caractere. */
  readonly end: number
  readonly target: MarkerTarget
}

export interface MarkerProblem {
  readonly offset: number
  readonly message: string
}

export interface FoundMarkers {
  readonly markers: readonly Marker[]
  readonly problems: readonly MarkerProblem[]
}

/** Em que arquivo o marcador está: `{{conteudo}}` e `{{sumario}}` só valem na moldura. */
export type MarkerRole = 'fragment' | 'frame'

const OPEN = '{{'
const CLOSE = '}}'
const ESCAPE = '\\'
const NAME = /^([a-z][a-z0-9_]*)(?:\.([a-z][a-z0-9_]*))?$/
const RESERVED: readonly ReservedMarker[] = ['conteudo', 'sumario', 'produto']
const FRAME_ONLY: ReadonlySet<ReservedMarker> = new Set(['conteudo', 'sumario'])

export function findMarkers(text: string): FoundMarkers {
  const markers: Marker[] = []
  const problems: MarkerProblem[] = []
  let from = 0
  for (;;) {
    const start = text.indexOf(OPEN, from)
    if (start < 0) break
    if (start > 0 && text[start - 1] === ESCAPE) {
      markers.push({ start: start - 1, end: start + OPEN.length, target: { kind: 'escape' } })
      from = start + OPEN.length
      continue
    }
    const close = text.indexOf(CLOSE, start + OPEN.length)
    const inner = close < 0 ? '' : text.slice(start + OPEN.length, close)
    // Sem fechamento, ou com outro `{{` antes dele: o problema é deste `{{`, e a busca segue.
    if (close < 0 || inner.includes(OPEN)) {
      problems.push({ offset: start, message: 'Falta o }} que fecha o marcador.' })
      from = start + OPEN.length
      continue
    }
    from = close + CLOSE.length
    const name = NAME.exec(inner.trim())
    const written = text.slice(start, from)
    if (name === null) {
      problems.push({
        offset: start,
        message: `Marcador inválido: ${written}. Use {{feature.atributo}}, e \\{{ para escrever {{.`
      })
    } else if (name[2] !== undefined) {
      markers.push({
        start,
        end: from,
        target: { kind: 'attribute', featureId: name[1], attributeId: name[2] }
      })
    } else if ((RESERVED as readonly string[]).includes(name[1])) {
      markers.push({
        start,
        end: from,
        target: { kind: 'reserved', name: name[1] as ReservedMarker }
      })
    } else {
      problems.push({
        offset: start,
        message: `Marcador desconhecido: ${written}. Use {{feature.atributo}} ou {{produto}}.`
      })
    }
  }
  return { markers, problems }
}

/** O marcador escrito na forma canônica, para as mensagens. */
export function markerLabel(target: MarkerTarget): string {
  switch (target.kind) {
    case 'attribute':
      return `{{${target.featureId}.${target.attributeId}}}`
    case 'reserved':
      return `{{${target.name}}}`
    case 'escape':
      return '\\{{'
  }
}

/**
 * O que está errado num marcador de atributo independentemente da configuração: a feature ou
 * o atributo que não existem no modelo. `null` quando está certo, e nos demais marcadores
 * (onde eles podem ficar é conferido por quem lê o HTML).
 */
export function markerIdProblem(
  target: MarkerTarget,
  modelAttributes: ReadonlyMap<string, readonly string[]>
): string | null {
  if (target.kind !== 'attribute') return null
  const attributes = modelAttributes.get(target.featureId)
  if (attributes === undefined) return `A feature ${target.featureId} não existe no modelo.`
  if (!attributes.includes(target.attributeId)) {
    return `A feature ${target.featureId} não tem o atributo ${target.attributeId}.`
  }
  return null
}

/** Os problemas dos IDs dos marcadores de atributo do texto, contra o modelo (para o editor). */
export function modelMarkerProblems(
  text: string,
  modelAttributes: ReadonlyMap<string, readonly string[]>
): MarkerProblem[] {
  return findMarkers(text).markers.flatMap((marker) => {
    const message = markerIdProblem(marker.target, modelAttributes)
    return message === null ? [] : [{ offset: marker.start, message }]
  })
}

/**
 * Os problemas de contagem da moldura: `{{conteudo}}` uma vez só, e `{{sumario}}` no máximo
 * uma. `markers` são os que valem, na ordem do texto.
 */
export function frameCountProblems(markers: readonly Marker[]): MarkerProblem[] {
  const problems: MarkerProblem[] = []
  const occurrences = (name: ReservedMarker): Marker[] =>
    markers.filter((marker) => marker.target.kind === 'reserved' && marker.target.name === name)
  const content = occurrences('conteudo')
  if (content.length === 0) {
    problems.push({
      offset: 0,
      message: 'A moldura precisa de {{conteudo}}, onde entram as seções.'
    })
  }
  for (const repeated of content.slice(1)) {
    problems.push({ offset: repeated.start, message: '{{conteudo}} só pode aparecer uma vez.' })
  }
  for (const repeated of occurrences('sumario').slice(1)) {
    problems.push({ offset: repeated.start, message: '{{sumario}} só pode aparecer uma vez.' })
  }
  return problems
}

/**
 * O valor de um marcador de atributo ou de `{{produto}}` numa configuração: o mesmo valor do
 * product.xml. `{{conteudo}}` e `{{sumario}}` são montados por quem monta a página.
 */
export function markerValue(target: MarkerTarget, plan: GenerationPlan): Result<string, string> {
  switch (target.kind) {
    case 'escape':
      return ok(OPEN)
    case 'reserved':
      return FRAME_ONLY.has(target.name)
        ? err(`${markerLabel(target)} só vale na moldura.`)
        : ok(plan.productName)
    case 'attribute': {
      const problem = markerIdProblem(target, plan.modelAttributes)
      if (problem !== null) return err(problem)
      const feature = plan.features.find((candidate) => candidate.id === target.featureId)
      if (feature === undefined) {
        return err(
          `${markerLabel(target)}: a feature ${target.featureId} não está selecionada nesta configuração. Use uma condição de presença no fragmento.`
        )
      }
      const attribute = feature.attributes.find((candidate) => candidate.id === target.attributeId)
      // Numa configuração completa, todo atributo de feature selecionada tem valor.
      return attribute === undefined
        ? err(`${markerLabel(target)} está sem valor nesta configuração.`)
        : ok(attribute.value)
    }
  }
}
```

- [ ] **Passo 9: Criar `src/renderer/src/domain/pages/page-paths.ts`**

```ts
import { folderOf } from '../fragments/fragment-path'

/*
 * Os caminhos que os fragmentos HTML e a moldura citam em `src`, `href`, `srcset` e `poster`
 * (SPEC §4.4, Fase 7). Um caminho relativo é relativo à pasta do arquivo, como no XML. A
 * página fica na raiz da pasta do produto, e os arquivos citados são copiados para o mesmo
 * caminho que têm no projeto: o caminho na página é o caminho no projeto.
 */

/** Os atributos com caminhos. `srcset` tem uma lista: veja `srcsetCandidates`. */
export const URL_ATTRIBUTES: ReadonlySet<string> = new Set(['src', 'href', 'srcset', 'poster'])

export type CitedUrl =
  /** Fica como está, sem cópia: outro esquema (`https:`, `mailto:`…), `//…`, `#…`, `?…` ou vazio. */
  | { readonly kind: 'kept' }
  /** Começa com "/": na pasta gerada, apontaria para a raiz do disco. */
  | { readonly kind: 'absolute' }
  /** Sai da pasta do projeto. */
  | { readonly kind: 'outside' }
  /** Um arquivo do projeto: `path` é o caminho nele, e `suffix`, o `?…` e o `#…` do original. */
  | { readonly kind: 'file'; readonly path: string; readonly suffix: string }

const SCHEME = /^[a-z][a-z0-9+.-]*:/i
/** Os espaços que o navegador tira do começo e do fim de um endereço. */
const SURROUNDING_SPACE = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g
/** O que precisa ser codificado num trecho do caminho, além dos controles e do espaço. */
const UNSAFE_CHARACTERS = new Set([...'%#?"<>\\^`{|}'])
const DELETE = 0x7f

export function resolveCitedUrl(fromFile: string, url: string): CitedUrl {
  const trimmed = url.replace(SURROUNDING_SPACE, '').replaceAll('\\', '/')
  if (trimmed === '' || SCHEME.test(trimmed) || trimmed.startsWith('//')) return { kind: 'kept' }
  if (trimmed.startsWith('#') || trimmed.startsWith('?')) return { kind: 'kept' }
  if (trimmed.startsWith('/')) return { kind: 'absolute' }

  const cut = trimmed.search(/[?#]/)
  const pathPart = cut < 0 ? trimmed : trimmed.slice(0, cut)
  const suffix = cut < 0 ? '' : trimmed.slice(cut)
  const segments = folderOf(fromFile)
    .split('/')
    .filter((segment) => segment !== '')
  for (const raw of pathPart.split('/')) {
    const segment = decodeSegment(raw)
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (segments.length === 0) return { kind: 'outside' }
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  if (segments.length === 0) return { kind: 'kept' }
  return { kind: 'file', path: segments.join('/'), suffix }
}

/**
 * O endereço do arquivo do projeto na página, que fica na raiz da pasta do produto. Só o que
 * quebraria o endereço é codificado (um espaço vira %20); os acentos ficam como estão.
 */
export function pageUrl(path: string, suffix: string): string {
  return path.split('/').map(encodeSegment).join('/') + suffix
}

function encodeSegment(segment: string): string {
  return [...segment]
    .map((character) => (isUnsafe(character) ? percent(character) : character))
    .join('')
}

function isUnsafe(character: string): boolean {
  const code = character.codePointAt(0) ?? 0
  return code <= 0x20 || code === DELETE || UNSAFE_CHARACTERS.has(character)
}

function percent(character: string): string {
  return [...new TextEncoder().encode(character)]
    .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`)
    .join('')
}

export interface SrcsetCandidate {
  readonly url: string
  /** O que vem depois do endereço, como " 2x" ou " 480w", com o espaço. */
  readonly descriptor: string
}

/** Os candidatos de um `srcset`: "a.png 1x, b.png 2x". */
export function srcsetCandidates(value: string): SrcsetCandidate[] {
  return value
    .split(',')
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate !== '')
    .map((candidate) => {
      const space = candidate.search(/\s/)
      return space < 0
        ? { url: candidate, descriptor: '' }
        : { url: candidate.slice(0, space), descriptor: candidate.slice(space) }
    })
}

export function formatSrcset(candidates: readonly SrcsetCandidate[]): string {
  return candidates.map((candidate) => candidate.url + candidate.descriptor).join(', ')
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
```

- [ ] **Passo 10: Criar `src/renderer/src/domain/pages/page-assembly.ts`**

```ts
import type { Asset } from '../assets/asset-catalog'
import { fragmentFormat } from '../fragments/fragment-format'
import type { GenerationPlan, PlannedSection } from '../generation/generation-plan'

/*
 * A montagem do conteúdo da página (SPEC §4.4, Fase 7): as seções aninhadas como a árvore,
 * com os fragmentos HTML, e o sumário. Os textos dos fragmentos já chegam prontos (marcadores
 * e caminhos trocados): aqui só se junta, sem recuo, para não mudar o conteúdo de um `<pre>`.
 */

export function escapeHtmlText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function escapeHtmlAttribute(text: string): string {
  return escapeHtmlText(text).replaceAll('"', '&quot;')
}

/** Os fragmentos HTML da seção, na ordem do assets.xml. */
export function htmlFragmentsOf(section: PlannedSection): Asset[] {
  return section.fragments.filter((asset) => fragmentFormat(asset.path) === 'html')
}

/** Todos os fragmentos HTML do plano, na ordem da página. */
export function planHtmlFragments(section: PlannedSection): Asset[] {
  return [...htmlFragmentsOf(section), ...section.children.flatMap(planHtmlFragments)]
}

/**
 * As seções, a partir da `section`: um `<section id>` por feature selecionada, também sem
 * conteúdo, com os fragmentos e depois as seções das filhas. `textOf` dá o texto pronto de
 * cada fragmento, sem quebra de linha no fim.
 */
export function sectionsHtml(section: PlannedSection, textOf: (asset: Asset) => string): string {
  const parts = [
    `<section id="${escapeHtmlAttribute(section.featureId)}">`,
    ...htmlFragmentsOf(section).map(textOf),
    ...section.children.map((child) => sectionsHtml(child, textOf)),
    '</section>'
  ]
  return parts.join('\n')
}

/** A subárvore tem algum fragmento HTML: só assim a feature entra no sumário. */
function hasContent(section: PlannedSection): boolean {
  return htmlFragmentsOf(section).length > 0 || section.children.some(hasContent)
}

/** O sumário: as features selecionadas com conteúdo, menos a raiz, aninhadas como a árvore. */
export function tableOfContents(plan: GenerationPlan): string {
  const names = new Map(plan.features.map((feature) => [feature.id, feature.name]))
  const list = (sections: readonly PlannedSection[]): string[] => {
    const shown = sections.filter(hasContent)
    if (shown.length === 0) return []
    return [
      '<ol>',
      ...shown.flatMap((section) => {
        const link = `<a href="#${escapeHtmlAttribute(section.featureId)}">${escapeHtmlText(names.get(section.featureId) ?? section.featureId)}</a>`
        const children = list(section.children)
        return children.length === 0 ? [`<li>${link}</li>`] : [`<li>${link}`, ...children, '</li>']
      }),
      '</ol>'
    ]
  }
  return ['<nav class="sumario">', ...list(plan.root.children), '</nav>'].join('\n')
}
```

- [ ] **Passo 11: `.html` nos caminhos de fragmento, em `src/renderer/src/domain/fragments/fragment-path.ts`**

Troque:

<!-- prettier-ignore -->
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
```

por:

<!-- prettier-ignore -->
```ts
import { ASSETS_PATH, CONFIGURATIONS_DIRECTORY, MODEL_PATH } from '../project/project-layout'
import { err, ok, type Result } from '../shared/result'
import { fragmentFormat } from './fragment-format'

/*
 * Os fragmentos que o editor mostra e cria (Fases 6 e 7): os `.xml` e os `.html` do projeto,
 * fora os arquivos do app (model.xml, assets.xml e configurations/), a pasta de saída da
 * geração e o que começa com ponto (.git, .vscode…). Os nomes são comparados sem caixa, como
 * no Windows.
 */

/** Os caracteres que o Windows não aceita em nomes de arquivo. */
const FORBIDDEN_CHARACTERS = /[<>:"|?*]/
```

Troque:

<!-- prettier-ignore -->
```ts
/** O arquivo é um fragmento que o editor mostra. */
export function isFragmentFile(path: string, outputDirectory: string): boolean {
  return path.toLowerCase().endsWith(EXTENSION) && isFragmentFolder(path, outputDirectory)
}
```

por:

<!-- prettier-ignore -->
```ts
/** O arquivo é um fragmento que o editor mostra. */
export function isFragmentFile(path: string, outputDirectory: string): boolean {
  return fragmentFormat(path) !== null && isFragmentFolder(path, outputDirectory)
}
```

Troque:

<!-- prettier-ignore -->
```ts
    return err('Um nome de pasta ou de arquivo não pode terminar em ponto ou espaço.')
  }
  if (!path.toLowerCase().endsWith(EXTENSION)) return err('O arquivo precisa terminar em .xml.')
  if (segments.some(isHidden)) {
    return err('Nomes começando com ponto ficam fora da árvore de fragmentos.')
```

por:

<!-- prettier-ignore -->
```ts
    return err('Um nome de pasta ou de arquivo não pode terminar em ponto ou espaço.')
  }
  if (fragmentFormat(path) === null) return err('O arquivo precisa terminar em .xml ou .html.')
  if (segments.some(isHidden)) {
    return err('Nomes começando com ponto ficam fora da árvore de fragmentos.')
```

- [ ] **Passo 12: `.html` sugerido como fragmento, em `src/renderer/src/domain/assets/asset-edits.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import type { FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import { generateId } from '../shared/identifier-generator'
import { err, ok, type Result } from '../shared/result'
```

por:

<!-- prettier-ignore -->
```ts
import type { FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import { fragmentFormat } from '../fragments/fragment-format'
import { generateId } from '../shared/identifier-generator'
import { err, ok, type Result } from '../shared/result'
```

Troque:

<!-- prettier-ignore -->
```ts
}

/** `.xml` vira fragmento; as demais extensões, recurso (SPEC §7). */
export function suggestAssetKind(path: string): AssetKind {
  return path.toLowerCase().endsWith('.xml') ? 'fragment' : 'resource'
}
```

por:

<!-- prettier-ignore -->
```ts
}

/** `.xml` e `.html` viram fragmento; as demais extensões, recurso (SPEC §7). */
export function suggestAssetKind(path: string): AssetKind {
  return fragmentFormat(path) !== null ? 'fragment' : 'resource'
}
```

- [ ] **Passo 13: O texto inicial pelo formato, em `src/renderer/src/application/fragments/fragment-document.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import { NEW_FILE_FORMAT, type TextFormat } from '@/domain/fragments/text-format'
```

por:

<!-- prettier-ignore -->
```ts
import { initialFragmentText } from '@/domain/fragments/fragment-format'
import { NEW_FILE_FORMAT, type TextFormat } from '@/domain/fragments/text-format'
```

Troque:

<!-- prettier-ignore -->
```ts
}

/** Um fragmento novo começa só com a declaração XML e uma linha em branco. */
export const NEW_FRAGMENT_TEXT = '<?xml version="1.0" encoding="UTF-8"?>\n'

export function newFragment(path: string): FragmentDocument {
  return { path, text: NEW_FRAGMENT_TEXT, saved: null, format: NEW_FILE_FORMAT }
}
```

por:

<!-- prettier-ignore -->
```ts
}

/** Um fragmento novo começa com o texto do formato dele (`initialFragmentText`). */
export function newFragment(path: string): FragmentDocument {
  return { path, text: initialFragmentText(path), saved: null, format: NEW_FILE_FORMAT }
}
```

- [ ] **Passo 14: `attributeIdsByFeature`, em `src/renderer/src/domain/feature-model/traversal.ts`**

Troque:

<!-- prettier-ignore -->
```ts
  return [root, ...childFeatures(root).flatMap(featuresInPreOrder)]
}
```

por:

<!-- prettier-ignore -->
```ts
  return [root, ...childFeatures(root).flatMap(featuresInPreOrder)]
}

/** Os IDs dos atributos de cada feature do modelo, em pré-ordem. */
export function attributeIdsByFeature(root: Feature): Map<string, readonly string[]> {
  return new Map(
    featuresInPreOrder(root).map((feature) => [
      feature.id,
      feature.attributes.map((attribute) => attribute.id)
    ])
  )
}
```

- [ ] **Passo 15: A página no plano, em `src/renderer/src/domain/generation/generation-plan.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import { configurationStatus, isSelected, type Resolution } from '../configuration/resolution'
import type { Feature, FeatureModel } from '../feature-model/feature-model'
import { childFeatures, featuresInPreOrder } from '../feature-model/traversal'
import { err, ok, type Result } from '../shared/result'
```

por:

<!-- prettier-ignore -->
```ts
import { configurationStatus, isSelected, type Resolution } from '../configuration/resolution'
import type { Feature, FeatureModel } from '../feature-model/feature-model'
import {
  attributeIdsByFeature,
  childFeatures,
  featuresInPreOrder
} from '../feature-model/traversal'
import { fragmentFormat } from '../fragments/fragment-format'
import { err, ok, type Result } from '../shared/result'
```

Troque:

<!-- prettier-ignore -->
```ts
   */
  readonly resources: readonly Asset[]
}
```

por:

<!-- prettier-ignore -->
```ts
   */
  readonly resources: readonly Asset[]
  /** Gera a página (Fase 7): o projeto tem algum asset fragmento `.html`, incluído ou não. */
  readonly hasPage: boolean
  /**
   * Todas as features do modelo, com os IDs dos atributos, e não só as selecionadas: um
   * marcador de uma feature que existe mas não foi selecionada tem uma mensagem própria.
   */
  readonly modelAttributes: ReadonlyMap<string, readonly string[]>
}
```

Troque:

<!-- prettier-ignore -->
```ts
      .map((feature) => plannedFeature(feature, configuration)),
    root: sectionOf(model.root),
    resources: firstPerPath(included.filter((asset) => asset.kind === 'resource'))
  })
}
```

por:

<!-- prettier-ignore -->
```ts
      .map((feature) => plannedFeature(feature, configuration)),
    root: sectionOf(model.root),
    resources: firstPerPath(included.filter((asset) => asset.kind === 'resource')),
    hasPage: catalog.assets.some(
      (asset) => asset.kind === 'fragment' && fragmentFormat(asset.path) === 'html'
    ),
    modelAttributes: attributeIdsByFeature(model.root)
  })
}
```

- [ ] **Passo 16: Os casos `.html`, `.htm` e `moldura.html` no `.checks/fragment-path-check.mts`**

```ts
// Regras dos caminhos de fragmento (plano da Fase 6, Tarefa 1; `.html` na Fase 7).
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
  'docs/pagamento/pix.html',
  'moldura.html',
  'docs/velho.htm',
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
  'docs/pagamento/cartao.html',
  'moldura.html',
  'docs/velho.htm',
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

- [ ] **Passo 17: Rodar os roteiros**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/markers-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/page-paths-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/fragment-path-check.mts
```

Esperado, `markers-check.mts`:

```
--- sintaxe
"Olá {{loja.versao}}!" → [{{loja.versao}}@4-19]
"{{ loja.versao }} e {{produto}}" → [{{loja.versao}}@0-17, {{produto}}@20-31]
"\\{{loja.versao}} fica literal" → [\{{@0-3]
"{{loja.versao" → [] problemas: 0: Falta o }} que fecha o marcador.
"{{ a {{loja.versao}}" → [{{loja.versao}}@5-20] problemas: 0: Falta o }} que fecha o marcador.
"{{Loja.Versao}} {{loja-versao}} {{a.b.c}}" → [] problemas: 0: Marcador inválido: {{Loja.Versao}}. Use {{feature.atributo}}, e \{{ para escrever {{. | 16: Marcador inválido: {{loja-versao}}. Use {{feature.atributo}}, e \{{ para escrever {{. | 32: Marcador inválido: {{a.b.c}}. Use {{feature.atributo}}, e \{{ para escrever {{.
"{{contuedo}} {{conteudo}} {{sumario}}" → [{{conteudo}}@13-25, {{sumario}}@26-37] problemas: 0: Marcador desconhecido: {{contuedo}}. Use {{feature.atributo}} ou {{produto}}.
"sem marcador { } }} {" → []
--- IDs
{{loja.versao}}: ok
{{loja.nome}}: A feature loja não tem o atributo nome.
{{carrinho.total}}: A feature carrinho não existe no modelo.
{{conteudo}}: ok
{{produto}}: ok
--- contagem na moldura
<body>{{conteudo}}</body> → ok
<body></body> → 0: A moldura precisa de {{conteudo}}, onde entram as seções.
{{conteudo}}{{conteudo}}{{sumario}}{{sumario}} → 12: {{conteudo}} só pode aparecer uma vez. | 35: {{sumario}} só pode aparecer uma vez.
--- valores
{{loja.versao}} → "1.0 & \"beta\""
{{produto}} → "Loja <Básica>"
\{{ → "{{"
{{mobile.plataforma}} → problema: {{mobile.plataforma}}: a feature mobile não está selecionada nesta configuração. Use uma condição de presença no fragmento.
{{loja.nome}} → problema: A feature loja não tem o atributo nome.
{{sumario}} → problema: {{sumario}} só vale na moldura.
```

Esperado, `page-paths-check.mts`:

```
docs/pagamento/pix.html + "../img/pix-fluxo.svg" → file docs/img/pix-fluxo.svg → docs/img/pix-fluxo.svg
docs/pagamento/pix.html + "img/a.png?v=2#topo" → file docs/pagamento/img/a.png → docs/pagamento/img/a.png?v=2#topo
docs/pagamento/pix.html + "./guia.pdf" → file docs/pagamento/guia.pdf → docs/pagamento/guia.pdf
docs/pagamento/pix.html + "Slides%20por%20Feature/06.pptx" → file docs/pagamento/Slides por Feature/06.pptx → docs/pagamento/Slides%20por%20Feature/06.pptx
docs/pagamento/pix.html + "..\\img\\b.png" → file docs/img/b.png → docs/img/b.png
moldura.html + "css/site.css" → file css/site.css → css/site.css
moldura.html + "  css/site.css  " → file css/site.css → css/site.css
docs/pix.html + "../../fora.png" → outside
docs/pix.html + "/img/a.png" → absolute
docs/pix.html + "https://exemplo.com/a.png" → kept
docs/pix.html + "//cdn.exemplo.com/a.js" → kept
docs/pix.html + "mailto:a@b.com" → kept
docs/pix.html + "tel:+5532999" → kept
docs/pix.html + "data:image/png;base64,AAAA" → kept
docs/pix.html + "javascript:void(0)" → kept
docs/pix.html + "#pagamento" → kept
docs/pix.html + "?aba=2" → kept
docs/pix.html + "" → kept
docs/pix.html + ".." → kept
pageUrl: Slides%20por%20Feature/06%20-%20Acesso%20à%20Plataforma.pptx
pageUrl: docs/100%25/a%23b%3F.png#x
srcset: [{"url":"img/a.png","descriptor":" 1x"},{"url":"img/b.png","descriptor":"   2x"},{"url":"img/c.png","descriptor":""}] → img/a.png 1x, img/b.png   2x, img/c.png
```

Esperado, `fragment-path-check.mts` (a saída da Fase 6, com os seis casos novos e a mensagem "precisa terminar em .xml ou .html"):

```
— na árvore
docs/pagamento/pix.xml               → arquivo
docs/LEIAME.XML                      → arquivo
docs/pagamento/pix.html              → arquivo
moldura.html                         → arquivo
docs/velho.htm                       → —
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
"docs/pagamento/cartao.html"         → ok docs/pagamento/cartao.html
"moldura.html"                       → ok moldura.html
"docs/velho.htm"                     → O arquivo precisa terminar em .xml ou .html.
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
"docs/a.txt"                         → O arquivo precisa terminar em .xml ou .html.
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

- [ ] **Passo 18: Regressão do plano da geração e da leitura**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generation-plan-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/configurations-check.mts
```

Esperado: as saídas dos planos das Fases 5 e 3, iguais às de antes da tarefa. O `generation-plan-check.mts`:

```
produto                          → Loja Básica | modelo Loja Online
  feature loja                   → Loja Online | versao=1.0
  feature catalogo               → Catálogo
  feature busca                  → Busca | max_resultados=100
  feature mobile                 → App mobile | plataforma=android
  feature pagamento              → Pagamento
  feature pag_cartao             → Cartão
  feature pag_pix                → PIX
  seção loja [doc_loja]
  seção   catalogo
  seção   busca [doc_busca] [doc_busca_app]
  seção   mobile
  seção   pagamento
  seção     pag_cartao
  seção     pag_pix [doc_pix]
recursos                         → img_pix docs/img/pix-fluxo.svg
sem mobile: seções               → loja [doc_loja] | catalogo | busca [doc_busca] | pagamento | pag_cartao | pag_boleto [doc_boleto]
sem mobile: recursos             → 0
sem mobile: atributos da busca   → [ { id: 'max_resultados', value: '100' } ]
incompleta                       → A configuração precisa estar completa para gerar o produto.
recurso repetido                 → img_pix
  a and b                        → true
  a and c                        → false
  a or c                         → true
  not c                          → true
  c implies a                    → true
  a implies c                    → false
  a iff b                        → true
  a iff c                        → false
  true and not false             → true
  not (a and c) and (c or b)     → true
```

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

```ts
// A conferência de um fragmento HTML e da moldura (Fase 7), como o editor a mostra.
//   npx tsx --tsconfig tsconfig.web.json .checks/html-checker-check.mts
import { HtmlFragmentChecker } from '@/infrastructure/html/html-fragment-checker'
import { DEFAULT_FRAME } from '@/domain/pages/page-layout'

const checker = new HtmlFragmentChecker()
const check = async (name: string, path: string, content: string): Promise<void> => {
  const problems = await checker.check(path, content)
  const shown = problems.map((problem) => `${problem.line}: ${problem.message}`)
  console.log(shown.length === 0 ? `${name}: ok` : `${name}:\n    ${shown.join('\n    ')}`)
}

const fragment = 'docs/a.html'
await check(
  'HTML normal',
  fragment,
  '<h2>Título</h2>\n<p>Um<br>dois &nbsp; <img src=a.png alt=x>\n<p>três\n<ul><li>a<li>b</ul>\n'
)
await check('div aberto', fragment, '<h2>T</h2>\n<div class="caixa">\n<p>x</p>\n')
await check('section a mais', fragment, '<p>a</p>\n</section>\n<p>b</p>\n')
await check('fora de ordem', fragment, '<p><b><i>x</b></i></p>\n')
await check('html e body', fragment, '<html>\n<body>\n<p>x</p>\n</body>\n</html>\n')
await check('doctype', fragment, '<!doctype html>\n<p>x</p>\n')
await check('td fora da tabela', fragment, '<p>x</p>\n<td>y</td>\n')
await check('div/', fragment, '<div/>\n<p>x</p>\n')
await check('sintaxe', fragment, '<img src="a" src="b">\n<p>&foo; &copy e 1 < 2</p>\n')
await check('svg', fragment, '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>\n')
await check(
  'template',
  fragment,
  '<template data-perfis="a">\n  <section class="secao"><p>x</p></section>\n</template>\n'
)
await check(
  'texto com < em script e style',
  fragment,
  '<script>if (a < b) { x = "</div>" }</script>\n<style>p > a { color: red }</style>\n'
)
await check('comentário', fragment, '<!-- </div> {{loja.versao}} -->\n<p>x</p>\n')
await check('UTF-8', fragment, '<p>Pagamento com cart\u{FFFD}o</p>\n')
await check('BOM e CRLF', fragment, '\u{FEFF}<p>a</p>\r\n<div>\r\n')

console.log('--- marcadores')
await check(
  'lugares que valem',
  fragment,
  '<p title="{{loja.versao}}">{{loja.versao}}</p>\n<a href="tel:{{loja.fone}}">{{ loja.fone }}</a>\n<style>p { color: {{tema.cor}} }</style>\n'
)
await check('dentro da tag', fragment, '<p {{loja.versao}}>x</p>\n')
await check('dentro do script', fragment, '<script>const v = "{{loja.versao}}"</script>\n')
await check(
  'sintaxe e reservados',
  fragment,
  '<p>{{loja.versao</p>\n<p>{{contuedo}} {{conteudo}} {{sumario}} \\{{</p>\n'
)

console.log('--- moldura')
await check('moldura padrão', 'moldura.html', DEFAULT_FRAME)
await check(
  'moldura sem </body> nem conteúdo',
  'moldura.html',
  '<!doctype html>\n<html>\n<head>\n<title>{{produto}}</title>\n</head>\n<body>\n<p>x</p>\n'
)
await check(
  'conteúdo fora do body',
  'moldura.html',
  '<!doctype html>\n<html>\n<head>\n<title>{{conteudo}}</title>\n</head>\n<body>\n<p class="{{sumario}}">x</p>\n{{conteudo}}\n</body>\n</html>\n'
)
await check(
  'conteúdo repetido',
  'Moldura.HTML',
  '<html><head></head><body>{{conteudo}} {{conteudo}} {{sumario}}</body></html>'
)
```

- [ ] **Passo 2: Escrever o roteiro `.checks/html-page-check.mts`**

A página montada num projeto pequeno em memória, e todos os problemas de uma vez.

```ts
// A página montada (Fase 7), num projeto pequeno em memória: moldura, seções, sumário,
// marcadores, caminhos, CSS e JS automáticos, cópias e os problemas da geração.
//   npx tsx --tsconfig tsconfig.web.json .checks/html-page-check.mts
import { CombinedProductDeriver } from '@/application/generation/combined-product-deriver'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import type { Configuration } from '@/domain/configuration/configuration'
import { planGeneration } from '@/domain/generation/generation-plan'
import { HtmlPageDeriver } from '@/infrastructure/html/html-page-deriver'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import { NodeXmlValidator } from './generation-support.mts'
import { memoryFolder } from './memory-folder.mts'

const model = decodeFeatureModel(
  parseXmlRoot(`<featureModel xmlns="urn:mdd:feature-model" schemaVersion="1" name="Loja">
  <feature id="loja" name="Loja &amp; Cia">
    <attribute id="versao" name="Versão" type="string" default="1.0"/>
    <feature id="busca" name="Busca" variability="optional"/>
    <feature id="tema_escuro" name="Tema escuro" variability="optional">
      <attribute id="cor" name="Cor" type="string" default="#222"/>
    </feature>
    <feature id="mobile" name="Mobile" variability="optional">
      <attribute id="plataforma" name="Plataforma" type="string" default="android"/>
    </feature>
  </feature>
</featureModel>`)
)
const assetsXml = (extra: string): string => `<assets xmlns="urn:mdd:assets" schemaVersion="1">
  <asset id="doc_loja" kind="fragment" path="docs/loja.html" anchor="loja"/>
  <asset id="site_css" kind="resource" path="css/site.css" anchor="loja"/>
  <asset id="app_js" kind="resource" path="js/app.js" anchor="loja"/>
  <asset id="doc_xml" kind="fragment" path="docs/topico.xml" anchor="loja"/>
  <asset id="doc_busca" kind="fragment" path="docs/busca/busca.html" anchor="busca"/>
  <asset id="escuro_css" kind="resource" path="css/escuro.css" anchor="tema_escuro"/>
  <asset id="doc_mobile" kind="fragment" path="docs/mobile.html" anchor="mobile"/>${extra}
</assets>`
if (!model.ok) throw new Error('modelo')

const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const configuration: Configuration = {
  name: 'Loja <Escura>',
  decisions: [
    { featureId: 'busca', state: 'selected' },
    { featureId: 'tema_escuro', state: 'selected' },
    { featureId: 'mobile', state: 'deselected' }
  ],
  values: [{ featureId: 'tema_escuro', attributeId: 'cor', value: '#000' }]
}

async function derive(files: Record<string, string>, extraAssets = '', config = configuration) {
  const assets = decodeAssetCatalog(parseXmlRoot(assetsXml(extraAssets)))
  if (!assets.ok || !model.ok) throw new Error('assets')
  const plan = planGeneration(
    model.value,
    assets.value,
    config,
    resolver.execute(model.value, config)
  )
  if (!plan.ok) throw new Error(plan.error)
  const { storage } = memoryFolder(files)
  const deriver = new CombinedProductDeriver([
    new XmlProductDeriver(storage, new NodeXmlValidator()),
    new HtmlPageDeriver(storage)
  ])
  return deriver.derive(plan.value, new Date('2026-09-28T12:00:00Z'))
}

const base: Record<string, string> = {
  'moldura.html': `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>{{produto}} — v{{loja.versao}}</title>
<link rel="stylesheet" href="css/site.css">
</head>
<body>
<header><a href="docs/guia.pdf?v=2#p3">Guia</a> <img src="img/logo.png" srcset="img/logo.png 1x, img/logo@2x.png 2x" alt=""></header>
{{sumario}}
{{conteudo}}
<footer>\\{{ literal }} · <a href="https://exemplo.com">site</a> · <a href="#busca">busca</a></footer>
</body>
</html>
`,
  'docs/loja.html':
    '\n\n<h2>Bem-vindo à {{ produto }}</h2>\n<p title="v{{loja.versao}}">Versão {{loja.versao}} &amp; mais.</p>\n<pre>\n  recuo\n</pre>\n\n',
  'docs/busca/busca.html':
    '<h3>Busca</h3>\n<img src="../../img/lupa.svg" alt="lupa">\n<style>.busca { color: {{tema_escuro.cor}} }</style>\n',
  'docs/mobile.html': '<p>{{mobile.plataforma}}</p>\n',
  'docs/topico.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<topic><title>XML</title></topic>\n',
  'css/site.css': 'body {}',
  'css/escuro.css': 'body { background: black }',
  'js/app.js': '',
  'docs/guia.pdf': '%PDF',
  'img/logo.png': 'png',
  'img/logo@2x.png': 'png',
  'img/lupa.svg': '<svg/>'
}

const show = (name: string, result: Awaited<ReturnType<typeof derive>>): void => {
  console.log(`=== ${name}`)
  if (!result.ok) {
    for (const problem of result.error) {
      console.log(
        `  ${problem.file}${problem.line ? `:${problem.line}` : ''} [${problem.subject ?? ''}] ${problem.message}`
      )
    }
    return
  }
  for (const file of result.value) {
    console.log(`  ${file.kind} ${file.path}`)
    if (file.kind === 'text' && file.path === 'index.html') {
      const lines = file.content.split('\n')
      console.log(lines.map((line) => (line === '' ? '    |' : `    | ${line}`)).join('\n'))
    }
  }
}

show('página com moldura', await derive(base))

const withoutFrame = { ...base }
delete withoutFrame['moldura.html']
const plain = await derive(withoutFrame)
show('sem moldura (a padrão)', plain)

show(
  'problemas',
  await derive(
    {
      ...base,
      'moldura.html': base['moldura.html'].replace(
        '<footer>',
        '<footer>{{mobile.plataforma}} <a href="/sobre.html">sobre</a>'
      ),
      'docs/loja.html':
        '<div>\n<p>{{loja.nome}}</p>\n<img src="img/falta.png">\n<a href="../../fora.html">fora</a>\n<a href="../index.html">início</a>\n',
      'docs/busca/busca.html': '<style>.busca { color: {{tema_escuro.cor}} }</style>\n',
      'index.html': '<p>index do projeto</p>'
    },
    '',
    {
      ...configuration,
      values: [{ featureId: 'tema_escuro', attributeId: 'cor', value: 'a</style><script>' }]
    }
  )
)

show(
  'recurso chamado index.html',
  await derive(
    { ...base, 'index.html': '<p>x</p>' },
    '\n  <asset id="index" kind="resource" path="index.html" anchor="loja"/>'
  )
)
show(
  'fragmento ausente',
  await derive({ ...base, 'docs/busca/busca.html': undefined as unknown as string })
)
```

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

```ts
import {
  defaultTreeAdapter,
  html,
  parse,
  parseFragment,
  type DefaultTreeAdapterTypes,
  type ParserError
} from 'parse5'
import type { Marker, MarkerRole } from '@/domain/pages/markers'
import { URL_ATTRIBUTES } from '@/domain/pages/page-paths'

/*
 * A leitura de um fragmento HTML ou da moldura com o parse5 (SPEC §4.4, Fase 7). O parse5
 * monta a árvore como o navegador, com a posição de cada tag no texto. Dela saem os problemas
 * (tags abertas, tags que o navegador descarta, erros de sintaxe), o lugar de cada marcador e
 * os atributos com caminhos. O texto não é reescrito aqui: quem monta a página troca só os
 * trechos que precisa, e o resto fica como o autor escreveu.
 */

type Node = DefaultTreeAdapterTypes.Node
type Element = DefaultTreeAdapterTypes.Element
type ParentNode = DefaultTreeAdapterTypes.ParentNode

export interface HtmlProblem {
  readonly offset: number
  readonly message: string
}

/** Onde o marcador está, e portanto como o valor entra. */
export type MarkerPlace =
  /** No texto: o valor entra escapado. `inBody` diz se está no `<body>` da moldura. */
  | { readonly kind: 'text'; readonly inBody: boolean }
  /** Dentro de `<style>`: o valor entra como está, e um `<` é problema. */
  | { readonly kind: 'raw' }
  | { readonly kind: 'comment' }
  /** No valor de um atributo: quem reescreve é o atributo inteiro (`HtmlAttribute`). */
  | { readonly kind: 'attribute' }

/** Um atributo que precisa ser olhado: tem caminho ou tem marcador no valor. */
export interface HtmlAttribute {
  readonly name: string
  /** O valor já decodificado (`&amp;` → `&`). */
  readonly value: string
  /** O trecho do atributo inteiro, `nome="valor"`, que é trocado quando o valor muda. */
  readonly start: number
  readonly end: number
}

export interface HtmlSource {
  readonly problems: readonly HtmlProblem[]
  /** O lugar de cada marcador, pela posição de início; sem os que já deram problema. */
  readonly places: ReadonlyMap<number, MarkerPlace>
  readonly attributes: readonly HtmlAttribute[]
  /** Na moldura, a posição do `</head>` e do `</body>`, onde entram o CSS e o JS. */
  readonly headEnd?: number
  readonly bodyEnd?: number
}

/** Tags sem fechamento. */
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])
/** Tags que o HTML deixa sem fechar. */
const OPTIONAL_END = new Set([
  'html',
  'head',
  'body',
  'p',
  'li',
  'dt',
  'dd',
  'option',
  'optgroup',
  'rb',
  'rt',
  'rtc',
  'rp',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'colgroup',
  'caption'
])
/** Tags cujo texto não tem tags dentro (o `<` é texto). */
const RAW_TEXT = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'plaintext'
])
const DOCUMENT_ONLY = new Set(['html', 'head', 'body'])
/** Um `<` que, no texto, sempre abre uma tag, um comentário ou um doctype. */
const TAG_START = /<(\/?[A-Za-z]|!)/g
/** Erros de sintaxe que não atrapalham: a moldura não precisa de doctype. */
const IGNORED_ERRORS = new Set(['missing-doctype', 'non-conforming-doctype'])

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'duplicate-attribute': 'Atributo repetido na mesma tag.',
  'unknown-named-character-reference': 'Entidade desconhecida (como &foo;).',
  'missing-semicolon-after-character-reference': 'Falta o ; no fim da entidade.',
  'non-void-html-element-start-tag-with-trailing-solidus':
    'No HTML, /> não fecha esta tag: escreva a tag de fechamento.',
  'eof-in-tag': 'A tag não termina com > antes do fim do arquivo.',
  'eof-in-comment': 'O comentário não termina com -->.',
  'missing-attribute-value': 'Falta o valor do atributo depois do =.',
  'missing-whitespace-between-attributes': 'Falta um espaço entre os atributos.',
  'unexpected-character-in-attribute-name': 'Caractere inesperado no nome do atributo.',
  'unexpected-character-in-unquoted-attribute-value':
    'Caractere inesperado num valor sem aspas: use aspas.',
  'unexpected-equals-sign-before-attribute-name': 'Um = antes do nome do atributo.',
  'invalid-first-character-of-tag-name': 'Um < solto: escreva &lt;.',
  'end-tag-with-attributes': 'Uma tag de fechamento não tem atributos.',
  'missing-end-tag-name': 'Tag de fechamento sem nome (</>).',
  'eof-before-tag-name': 'Um < solto no fim do arquivo: escreva &lt;.',
  'incorrectly-opened-comment': 'Comentário mal aberto: use <!-- … -->.',
  'abrupt-closing-of-empty-comment': 'Comentário mal fechado: use <!-- … -->.',
  'nested-comment': 'Comentário dentro de comentário.'
}

/**
 * Lê o texto como fragmento (dentro de um `<section>`, como ele fica na página) ou como a
 * moldura (um documento inteiro), e acha o lugar de cada marcador.
 */
export function readHtmlSource(
  text: string,
  role: MarkerRole,
  markers: readonly Marker[]
): HtmlSource {
  const problems: HtmlProblem[] = []
  const onParseError = (error: ParserError): void => {
    if (IGNORED_ERRORS.has(error.code)) return
    problems.push({
      offset: error.startOffset,
      message: ERROR_MESSAGES[error.code] ?? `Erro de sintaxe do HTML (${error.code}).`
    })
  }
  const options = { sourceCodeLocationInfo: true, onParseError }
  const root: ParentNode =
    role === 'frame'
      ? parse(text, options)
      : parseFragment(defaultTreeAdapter.createElement('section', html.NS.HTML, []), text, options)

  const nodes = allNodes(root)
  const elements = nodes.filter(isElement)
  problems.push(...unclosedTags(text, elements))
  problems.push(...droppedTags(text, nodes, role))

  const source: HtmlSource = {
    problems,
    places: new Map(),
    attributes: attributesToCheck(elements, markers)
  }
  if (role === 'frame') {
    const head = elements.find((element) => element.tagName === 'head')
    const body = elements.find((element) => element.tagName === 'body')
    const headEnd = head?.sourceCodeLocation?.endTag?.startOffset
    const bodyEnd = body?.sourceCodeLocation?.endTag?.startOffset
    if (headEnd === undefined)
      problems.push({ offset: 0, message: 'A moldura precisa ter </head>.' })
    if (bodyEnd === undefined)
      problems.push({ offset: 0, message: 'A moldura precisa ter </body>.' })
    Object.assign(source, { headEnd, bodyEnd })
  }
  placeMarkers(text, nodes, markers, role, source.places as Map<number, MarkerPlace>, problems)
  problems.sort((a, b) => a.offset - b.offset)
  return source
}

function isElement(node: Node): node is Element {
  return 'tagName' in node
}

/** Todos os nós, na ordem do texto, inclusive o conteúdo dos `<template>`. */
function allNodes(root: ParentNode): Node[] {
  const nodes: Node[] = []
  const visit = (parent: ParentNode): void => {
    for (const child of parent.childNodes) {
      nodes.push(child)
      if ('childNodes' in child) visit(child)
      if ('content' in child) visit(child.content)
    }
  }
  visit(root)
  return nodes
}

function unclosedTags(text: string, elements: readonly Element[]): HtmlProblem[] {
  return elements.flatMap((element): HtmlProblem[] => {
    const location = element.sourceCodeLocation
    const start = location?.startTag
    const end = location?.endTag
    if (start === undefined && end !== undefined) {
      return [{ offset: end.startOffset, message: `</${element.tagName}> sem a tag de abertura.` }]
    }
    if (start === undefined || end !== undefined) return []
    if (VOID.has(element.tagName) || OPTIONAL_END.has(element.tagName)) return []
    // No SVG e no MathML, <circle/> fecha a tag.
    const selfClosing = text.slice(start.startOffset, start.endOffset).endsWith('/>')
    if (selfClosing && element.namespaceURI !== html.NS.HTML) return []
    return [
      {
        offset: start.startOffset,
        message: `A tag <${element.tagName}> é aberta aqui e não é fechada neste arquivo.`
      }
    ]
  })
}

/**
 * As tags que o navegador descarta: um `</section>` a mais, um `<td>` fora da tabela, um
 * `<body>` num fragmento. Elas não aparecem na árvore. Estão nos trechos que nenhum nó cobre
 * ou, quando ficam entre dois textos, dentro do trecho do texto (o parse5 junta os dois).
 */
function droppedTags(text: string, nodes: readonly Node[], role: MarkerRole): HtmlProblem[] {
  const covered: [number, number][] = []
  const inText: [number, number][] = []
  for (const node of nodes) {
    const location = node.sourceCodeLocation
    if (location === undefined || location === null) continue
    if (isElement(node)) {
      const { startTag, endTag } = node.sourceCodeLocation ?? {}
      if (startTag) covered.push([startTag.startOffset, startTag.endOffset])
      if (endTag) covered.push([endTag.startOffset, endTag.endOffset])
      continue
    }
    covered.push([location.startOffset, location.endOffset])
    const parent = 'parentNode' in node ? node.parentNode : null
    const rawParent = parent !== null && isElement(parent) && RAW_TEXT.has(parent.tagName)
    if (node.nodeName === '#text' && !rawParent)
      inText.push([location.startOffset, location.endOffset])
  }
  covered.sort((a, b) => a[0] - b[0])

  const starts: number[] = []
  let position = 0
  for (const [start, end] of covered) {
    if (start > position) starts.push(...tagStartsIn(text, position, start))
    position = Math.max(position, end)
  }
  if (position < text.length) starts.push(...tagStartsIn(text, position, text.length))
  // Um texto juntado pode passar por cima de tags que estão na árvore, como o </body> de uma
  // moldura (o texto depois dele vai para o body): o começo de uma tag da árvore não conta.
  const tagStarts = new Set(covered.map(([start]) => start))
  for (const [start, end] of inText) {
    starts.push(...tagStartsIn(text, start, end).filter((offset) => !tagStarts.has(offset)))
  }

  return [...new Set(starts)].map((offset) => ({
    offset,
    message: droppedMessage(text, offset, role)
  }))
}

function tagStartsIn(text: string, from: number, to: number): number[] {
  const slice = text.slice(from, to)
  return [...slice.matchAll(TAG_START)].map((match) => from + (match.index ?? 0))
}

function droppedMessage(text: string, offset: number, role: MarkerRole): string {
  const tag = /^<(\/?)(!doctype|[A-Za-z][^\s/>]*)/i.exec(text.slice(offset))
  if (tag === null) return 'O navegador ignora este trecho.'
  const [, slash, rawName] = tag
  const name = rawName.toLowerCase()
  if (role === 'fragment' && (name === '!doctype' || DOCUMENT_ONLY.has(name))) {
    return 'Um fragmento não pode ter <!doctype>, <html>, <head> nem <body>: eles ficam na moldura.'
  }
  if (slash === '/') return `</${name}> sem a tag de abertura, ou fechada fora de ordem.`
  return `O navegador ignora a tag <${name}> neste lugar.`
}

/** Os atributos com caminho e os que têm marcador no valor. */
function attributesToCheck(
  elements: readonly Element[],
  markers: readonly Marker[]
): HtmlAttribute[] {
  return elements.flatMap((element) => {
    const locations = element.sourceCodeLocation?.attrs
    if (locations === undefined) return []
    return element.attrs.flatMap((attribute): HtmlAttribute[] => {
      const location = locations[attribute.name]
      if (location === undefined) return []
      const { startOffset: start, endOffset: end } = location
      const hasMarker = markers.some((marker) => marker.start >= start && marker.start < end)
      if (!URL_ATTRIBUTES.has(attribute.name) && !hasMarker) return []
      return [{ name: attribute.name, value: attribute.value, start, end }]
    })
  })
}

function placeMarkers(
  text: string,
  nodes: readonly Node[],
  markers: readonly Marker[],
  role: MarkerRole,
  places: Map<number, MarkerPlace>,
  problems: HtmlProblem[]
): void {
  for (const marker of markers) {
    const place = placeOf(text, nodes, marker.start)
    const reserved = marker.target.kind === 'reserved' ? marker.target.name : null
    const problem = (message: string): void => {
      problems.push({ offset: marker.start, message })
    }
    if (place === 'tag') {
      problem('Um marcador não pode ficar dentro da tag, fora do valor de um atributo.')
    } else if (place === 'script') {
      problem('Marcadores não valem dentro de <script>.')
    } else if (place === null) {
      problem('O navegador ignora o trecho onde está este marcador.')
    } else if ((reserved === 'conteudo' || reserved === 'sumario') && role === 'fragment') {
      problem(`{{${reserved}}} só vale na moldura.`)
    } else if (
      (reserved === 'conteudo' || reserved === 'sumario') &&
      !(place.kind === 'text' && place.inBody)
    ) {
      problem(`{{${reserved}}} precisa ficar no texto do <body>.`)
    } else {
      places.set(marker.start, place)
    }
  }
}

function placeOf(
  text: string,
  nodes: readonly Node[],
  offset: number
): MarkerPlace | 'tag' | 'script' | null {
  for (const node of nodes) {
    if (isElement(node)) {
      const startTag = node.sourceCodeLocation?.startTag
      if (startTag && offset >= startTag.startOffset && offset < startTag.endOffset) {
        const attrs = node.sourceCodeLocation?.attrs ?? {}
        // Só no valor, depois do "=": no nome, o marcador viraria um atributo com esse nome.
        const inAttribute = Object.values(attrs).some((location) => {
          const equals = text.indexOf('=', location.startOffset)
          return (
            equals >= 0 &&
            equals < location.endOffset &&
            offset > equals &&
            offset < location.endOffset
          )
        })
        return inAttribute ? { kind: 'attribute' } : 'tag'
      }
      continue
    }
    const location = node.sourceCodeLocation
    if (!location || offset < location.startOffset || offset >= location.endOffset) continue
    if (node.nodeName === '#comment') return { kind: 'comment' }
    if (node.nodeName !== '#text') return null
    const parent = 'parentNode' in node ? node.parentNode : null
    const parentTag = parent !== null && isElement(parent) ? parent.tagName : null
    if (parentTag === 'script') return 'script'
    if (parentTag === 'style') return { kind: 'raw' }
    return { kind: 'text', inBody: isInBody(node) }
  }
  return null
}

function isInBody(node: Node): boolean {
  for (let current: Node | null = node; current !== null;) {
    if (isElement(current) && current.tagName === 'body') return true
    current = 'parentNode' in current ? current.parentNode : null
  }
  return false
}
```

- [ ] **Passo 6: Criar `src/renderer/src/infrastructure/html/html-fragment-checker.ts`**

```ts
import type { FileProblem } from '@/application/file-problem'
import type { FragmentChecker } from '@/application/ports/fragment-checker'
import { encodingProblem, type EncodingProblem } from '@/domain/fragments/encoding'
import {
  findMarkers,
  frameCountProblems,
  type Marker,
  type MarkerRole
} from '@/domain/pages/markers'
import { isFramePath } from '@/domain/pages/page-layout'
import { err, ok, type Result } from '@/domain/shared/result'
import { lineAt } from '@/domain/shared/text-lines'
import { readHtmlSource, type HtmlProblem, type HtmlSource } from './html-source'

const BOM = '\u{FEFF}'

/** O fragmento HTML ou a moldura lidos: o texto (sem BOM), os marcadores e a leitura do HTML. */
export interface InspectedHtml {
  readonly text: string
  readonly role: MarkerRole
  /** Os marcadores que valem, fora os que já deram problema pelo lugar. */
  readonly markers: readonly Marker[]
  readonly source: HtmlSource
  /** Os problemas que não dependem do modelo nem da configuração, na ordem do texto. */
  readonly problems: readonly HtmlProblem[]
}

/**
 * As conferências de um fragmento HTML ou da moldura (SPEC §4.4, Fase 7), na ordem: a
 * codificação, os marcadores e o HTML. Os IDs dos marcadores dependem do modelo, e a feature
 * selecionada e os arquivos citados, da configuração e do disco: ficam com quem os tem.
 */
export function inspectHtml(path: string, content: string): Result<InspectedHtml, EncodingProblem> {
  const encoding = encodingProblem(content)
  if (encoding !== undefined) return err(encoding)
  const text = content.startsWith(BOM) ? content.slice(BOM.length) : content
  const role: MarkerRole = isFramePath(path) ? 'frame' : 'fragment'
  const found = findMarkers(text)
  const source = readHtmlSource(text, role, found.markers)
  const markers = found.markers.filter((marker) => source.places.has(marker.start))
  const problems = [
    ...found.problems,
    ...source.problems,
    ...(role === 'frame' ? frameCountProblems(markers) : [])
  ].sort((a, b) => a.offset - b.offset)
  return ok({ text, role, markers, source, problems })
}

/** Confere um fragmento HTML ou a moldura, no editor (Fase 7). */
export class HtmlFragmentChecker implements FragmentChecker {
  async check(path: string, content: string): Promise<FileProblem[]> {
    const inspected = inspectHtml(path, content)
    if (!inspected.ok) return [{ file: path, severity: 'error', ...inspected.error }]
    const { text, problems } = inspected.value
    return problems.map((problem) => problemAt(path, text, problem))
  }
}

export function problemAt(
  file: string,
  text: string,
  problem: HtmlProblem,
  subject?: string
): FileProblem {
  return {
    file,
    line: lineAt(text, problem.offset),
    subject,
    severity: 'error',
    message: problem.message
  }
}
```

- [ ] **Passo 7: Criar `src/renderer/src/infrastructure/html/html-page-deriver.ts`**

```ts
import type { FileProblem } from '@/application/file-problem'
import type { ProductDeriver, ProductFile } from '@/application/ports/product-deriver'
import type { ProjectStorage } from '@/application/ports/project-storage'
import { firstPerPath, type Asset } from '@/domain/assets/asset-catalog'
import type { GenerationPlan } from '@/domain/generation/generation-plan'
import { findMarkers, markerLabel, markerValue, type Marker } from '@/domain/pages/markers'
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  planHtmlFragments,
  sectionsHtml,
  tableOfContents
} from '@/domain/pages/page-assembly'
import { DEFAULT_FRAME, FRAME_PATH, PAGE_PATH, PRODUCT_PATH } from '@/domain/pages/page-layout'
import { formatSrcset, pageUrl, resolveCitedUrl, srcsetCandidates } from '@/domain/pages/page-paths'
import { err, ok, type Result } from '@/domain/shared/result'
import { inspectHtml, problemAt } from './html-fragment-checker'
import type { HtmlAttribute, HtmlSource } from './html-source'

/** Um trecho do texto trocado por outro. */
interface Edit {
  readonly start: number
  readonly end: number
  readonly text: string
}

/** Um arquivo do projeto citado por um fragmento ou pela moldura, que vai para a saída. */
interface Cited {
  readonly path: string
  readonly offset: number
}

/** Um fragmento ou a moldura, com os marcadores e os caminhos já resolvidos, sem aplicar. */
interface Prepared {
  readonly file: string
  readonly subject?: string
  readonly text: string
  readonly source: HtmlSource
  readonly edits: readonly Edit[]
  readonly cited: readonly Cited[]
  /** `{{conteudo}}` e `{{sumario}}` da moldura, montados depois. */
  readonly reserved: readonly Marker[]
}

/**
 * A página do produto (SPEC §4.4, Fase 7): a moldura com as seções das features selecionadas,
 * os marcadores trocados, os caminhos corrigidos para o `index.html`, o sumário e o CSS e o JS
 * incluídos. Devolve o `index.html` e as cópias dos arquivos citados, ou todos os problemas.
 * Os recursos são copiados pelo `XmlProductDeriver`, como antes.
 */
export class HtmlPageDeriver implements ProductDeriver {
  private readonly storage: ProjectStorage

  constructor(storage: ProjectStorage) {
    this.storage = storage
  }

  async derive(plan: GenerationPlan): Promise<Result<readonly ProductFile[], FileProblem[]>> {
    if (!plan.hasPage) return ok([])
    const fragments = firstPerPath(planHtmlFragments(plan.root))
    const loaded = await Promise.all([
      this.loadFrame(),
      ...fragments.map((asset) => this.loadFragment(asset))
    ])
    const problems: FileProblem[] = []
    const prepared: Prepared[] = []
    loaded.forEach((result, index) => {
      if (!result.ok) {
        problems.push(...result.error)
        return
      }
      const subject = index === 0 ? undefined : fragments[index - 1].id
      const done = prepare(result.value.file, result.value.content, plan, subject)
      problems.push(...done.problems)
      if (done.prepared !== null) prepared.push(done.prepared)
    })
    // Os arquivos citados são conferidos também num arquivo com problema: todos de uma vez.
    problems.push(...(await this.checkCited(prepared)))
    if (problems.length > 0) return err(problems)

    const [frame, ...parts] = prepared
    const textByPath = new Map(
      parts.map((part) => [part.file, trimmed(apply(part.text, part.edits))])
    )
    const page = assemble(frame, plan, (asset) => textByPath.get(asset.path) ?? '')
    const copies = uniquePaths(prepared.flatMap((part) => part.cited.map((cited) => cited.path)))
    return ok([
      { kind: 'text', path: PAGE_PATH, content: page },
      ...copies.map((path): ProductFile => ({ kind: 'copy', path }))
    ])
  }

  private async loadFrame(): Promise<Result<{ file: string; content: string }, FileProblem[]>> {
    const read = await this.storage.readText(FRAME_PATH)
    if (read.ok) return ok({ file: FRAME_PATH, content: read.value.content })
    if (read.error.code === 'not-found') return ok({ file: FRAME_PATH, content: DEFAULT_FRAME })
    return err([{ file: FRAME_PATH, severity: 'error', message: read.error.message }])
  }

  private async loadFragment(
    asset: Asset
  ): Promise<Result<{ file: string; content: string }, FileProblem[]>> {
    const read = await this.storage.readText(asset.path)
    if (read.ok) return ok({ file: asset.path, content: read.value.content })
    const message = read.error.code === 'not-found' ? 'Arquivo ausente.' : read.error.message
    return err([{ file: asset.path, subject: asset.id, severity: 'error', message }])
  }

  /** Cada arquivo citado precisa existir e ser um arquivo; é conferido uma vez só. */
  private async checkCited(prepared: readonly Prepared[]): Promise<FileProblem[]> {
    const seen = new Set<string>()
    const checks = prepared.flatMap((part) =>
      part.cited.flatMap((cited) => {
        const key = cited.path.toLowerCase()
        if (seen.has(key)) return []
        seen.add(key)
        return [{ part, cited }]
      })
    )
    const results = await Promise.all(
      checks.map(async ({ part, cited }): Promise<FileProblem[]> => {
        const generated = [PAGE_PATH, PRODUCT_PATH].find(
          (path) => path === cited.path.toLowerCase()
        )
        if (generated !== undefined) {
          const message = `O arquivo ${cited.path} do projeto substituiria o ${generated} gerado: mude o nome dele.`
          return [problemAt(part.file, part.text, { offset: cited.offset, message }, part.subject)]
        }
        const entry = await this.storage.stat(cited.path)
        if (entry.ok && entry.value === 'file') return []
        const message =
          entry.ok && entry.value === 'directory'
            ? `O caminho aponta para uma pasta: ${cited.path}.`
            : `O arquivo citado não existe: ${cited.path}.`
        return [problemAt(part.file, part.text, { offset: cited.offset, message }, part.subject)]
      })
    )
    return results.flat()
  }
}

/**
 * Resolve os marcadores e os caminhos de um fragmento ou da moldura, sem aplicar as trocas, e
 * junta os problemas. Só não há `prepared` quando o arquivo não está em UTF-8.
 */
function prepare(
  file: string,
  content: string,
  plan: GenerationPlan,
  subject: string | undefined
): { readonly prepared: Prepared | null; readonly problems: readonly FileProblem[] } {
  // As posições valem para o texto com "\n", que é o que vai para a página.
  const inspected = inspectHtml(file, content.replace(/\r\n?/g, '\n'))
  if (!inspected.ok) {
    return { prepared: null, problems: [{ file, subject, severity: 'error', ...inspected.error }] }
  }
  const { text, source, markers } = inspected.value
  const problems: FileProblem[] = inspected.value.problems.map((problem) =>
    problemAt(file, text, problem, subject)
  )
  const problem = (offset: number, message: string): void => {
    problems.push(problemAt(file, text, { offset, message }, subject))
  }

  const edits: Edit[] = []
  const reserved: Marker[] = []
  for (const marker of markers) {
    const place = source.places.get(marker.start)
    if (place === undefined || place.kind === 'attribute') continue
    const { target } = marker
    if (target.kind === 'reserved' && target.name !== 'produto') {
      reserved.push(marker)
      continue
    }
    const value = markerValue(target, plan)
    if (!value.ok) {
      problem(marker.start, value.error)
    } else if (place.kind === 'raw' && value.value.includes('<')) {
      problem(
        marker.start,
        `O valor de ${markerLabel(target)} tem <, que não pode entrar num <style>.`
      )
    } else {
      const replacement = place.kind === 'raw' ? value.value : escapeHtmlText(value.value)
      edits.push({ start: marker.start, end: marker.end, text: replacement })
    }
  }

  const cited: Cited[] = []
  for (const attribute of source.attributes) {
    const value = attributeValue(attribute, plan, file, cited, (message) =>
      problem(attribute.start, message)
    )
    if (value !== attribute.value) {
      edits.push({
        start: attribute.start,
        end: attribute.end,
        text: `${attribute.name}="${escapeHtmlAttribute(value)}"`
      })
    }
  }
  return { prepared: { file, subject, text, source, edits, cited, reserved }, problems }
}

/**
 * O valor novo do atributo: os marcadores trocados pelo valor e, num atributo de caminho, os
 * caminhos do projeto reescritos para a página. Os arquivos citados vão para `cited`.
 */
function attributeValue(
  attribute: HtmlAttribute,
  plan: GenerationPlan,
  file: string,
  cited: Cited[],
  problem: (message: string) => void
): string {
  const found = findMarkers(attribute.value)
  for (const syntax of found.problems) problem(syntax.message)
  let value = attribute.value
  for (const marker of [...found.markers].reverse()) {
    const resolved = markerValue(marker.target, plan)
    if (!resolved.ok) {
      problem(resolved.error)
      continue
    }
    value = value.slice(0, marker.start) + resolved.value + value.slice(marker.end)
  }

  const rewrite = (url: string): string => {
    const resolved = resolveCitedUrl(file, url)
    switch (resolved.kind) {
      case 'kept':
        return url
      case 'absolute':
        problem(`Use um caminho relativo em vez de ${url}: na pasta gerada, "/" é a raiz do disco.`)
        return url
      case 'outside':
        problem(`O caminho ${url} sai da pasta do projeto.`)
        return url
      case 'file':
        cited.push({ path: resolved.path, offset: attribute.start })
        return pageUrl(resolved.path, resolved.suffix)
    }
  }
  switch (attribute.name) {
    case 'srcset':
      return formatSrcset(
        srcsetCandidates(value).map((candidate) => ({ ...candidate, url: rewrite(candidate.url) }))
      )
    case 'src':
    case 'href':
    case 'poster':
      return rewrite(value)
    default:
      return value
  }
}

/** A página: a moldura com as seções, o sumário, o CSS e o JS. */
function assemble(frame: Prepared, plan: GenerationPlan, textOf: (asset: Asset) => string): string {
  const edits: Edit[] = [...frame.edits]
  for (const marker of frame.reserved) {
    const isContent = marker.target.kind === 'reserved' && marker.target.name === 'conteudo'
    const text = isContent ? sectionsHtml(plan.root, textOf) : tableOfContents(plan)
    edits.push({ start: marker.start, end: marker.end, text })
  }
  // O CSS e o JS incluídos entram sozinhos, menos os que a moldura já cita.
  const citedByFrame = new Set(frame.cited.map((cited) => cited.path.toLowerCase()))
  const resources = plan.resources.filter((asset) => !citedByFrame.has(asset.path.toLowerCase()))
  const withExtension = (extension: string): Asset[] =>
    resources.filter((asset) => asset.path.toLowerCase().endsWith(extension))
  const styles = withExtension('.css').map(
    (asset) => `<link rel="stylesheet" href="${escapeHtmlAttribute(pageUrl(asset.path, ''))}">\n`
  )
  const scripts = withExtension('.js').map(
    (asset) => `<script src="${escapeHtmlAttribute(pageUrl(asset.path, ''))}"></script>\n`
  )
  const { headEnd, bodyEnd } = frame.source
  if (headEnd !== undefined && styles.length > 0) {
    edits.push({ start: headEnd, end: headEnd, text: styles.join('') })
  }
  if (bodyEnd !== undefined && scripts.length > 0) {
    edits.push({ start: bodyEnd, end: bodyEnd, text: scripts.join('') })
  }
  const page = apply(frame.text, edits)
  return page.endsWith('\n') ? page : `${page}\n`
}

/** Aplica as trocas do fim para o começo, para as posições continuarem valendo. */
function apply(text: string, edits: readonly Edit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end),
      text
    )
}

/** O fragmento sem as linhas em branco do começo e sem os espaços do fim. */
function trimmed(text: string): string {
  return text.replace(/^\n+/, '').replace(/\s+$/, '')
}

function uniquePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>()
  return paths.filter((path) => {
    const key = path.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
```

- [ ] **Passo 8: Criar `src/renderer/src/application/generation/combined-product-deriver.ts`**

```ts
import type { GenerationPlan } from '@/domain/generation/generation-plan'
import { err, ok, type Result } from '@/domain/shared/result'
import type { FileProblem } from '../file-problem'
import type { ProductDeriver, ProductFile } from '../ports/product-deriver'

/**
 * Os formatos do produto juntos (Fase 7): o product.xml e a página. Confere todos e devolve
 * todos os problemas de uma vez. Um arquivo copiado por mais de um formato é copiado uma vez;
 * um arquivo copiado com o nome de um arquivo gerado (como `index.html` na raiz) é problema,
 * porque o substituiria.
 */
export class CombinedProductDeriver implements ProductDeriver {
  private readonly derivers: readonly ProductDeriver[]

  constructor(derivers: readonly ProductDeriver[]) {
    this.derivers = derivers
  }

  async derive(
    plan: GenerationPlan,
    generatedAt: Date
  ): Promise<Result<readonly ProductFile[], FileProblem[]>> {
    const results = await Promise.all(
      this.derivers.map((deriver) => deriver.derive(plan, generatedAt))
    )
    const problems = results.flatMap((result) => (result.ok ? [] : result.error))
    if (problems.length > 0) return err(problems)

    const files = results.flatMap((result) => (result.ok ? result.value : []))
    const texts = files.filter((file) => file.kind === 'text')
    const generated = new Set(texts.map((file) => file.path.toLowerCase()))
    const copied = new Set<string>()
    const copies: ProductFile[] = []
    for (const file of files) {
      if (file.kind !== 'copy') continue
      const key = file.path.toLowerCase()
      if (generated.has(key)) {
        problems.push({
          file: file.path,
          severity: 'error',
          message: `O arquivo ${file.path} do projeto substituiria o ${file.path} gerado: mude o nome dele.`
        })
      } else if (!copied.has(key)) {
        copied.add(key)
        copies.push(file)
      }
    }
    return problems.length > 0 ? err(problems) : ok([...texts, ...copies])
  }
}
```

- [ ] **Passo 9: Criar `src/renderer/src/application/fragments/fragment-checker-by-format.ts`**

```ts
import { fragmentFormat, type FragmentFormat } from '@/domain/fragments/fragment-format'
import type { FileProblem } from '../file-problem'
import type { FragmentChecker } from '../ports/fragment-checker'

/** Confere cada fragmento com o checker do formato dele, pela extensão (Fase 7). */
export class FragmentCheckerByFormat implements FragmentChecker {
  private readonly checkers: Readonly<Record<FragmentFormat, FragmentChecker>>

  constructor(checkers: Readonly<Record<FragmentFormat, FragmentChecker>>) {
    this.checkers = checkers
  }

  check(path: string, content: string): Promise<FileProblem[]> {
    return this.checkers[fragmentFormat(path) ?? 'xml'].check(path, content)
  }
}
```

- [ ] **Passo 10: O `product.xml` sem os fragmentos HTML, em `src/renderer/src/infrastructure/xml/xml-product-deriver.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import type { XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import { firstPerPath, type Asset } from '@/domain/assets/asset-catalog'
import type { GenerationPlan, PlannedSection } from '@/domain/generation/generation-plan'
import { err, ok, type Result } from '@/domain/shared/result'
```

por:

<!-- prettier-ignore -->
```ts
import type { XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import { firstPerPath, type Asset } from '@/domain/assets/asset-catalog'
import { fragmentFormat } from '@/domain/fragments/fragment-format'
import type { GenerationPlan, PlannedSection } from '@/domain/generation/generation-plan'
import { err, ok, type Result } from '@/domain/shared/result'
```

Troque:

<!-- prettier-ignore -->
```ts

/**
 * O produto em XML (SPEC §4.4, ADR 0006): o product.xml com cada fragmento embutido e os
 * recursos copiados. Confere todas as fontes antes e devolve todos os problemas de uma vez.
 */
export class XmlProductDeriver implements ProductDeriver {
```

por:

<!-- prettier-ignore -->
```ts

/**
 * O produto em XML (SPEC §4.4, ADR 0006): o product.xml com cada fragmento XML embutido e os
 * recursos copiados. Confere todas as fontes antes e devolve todos os problemas de uma vez.
 * Os fragmentos HTML ficam com a página (`HtmlPageDeriver`).
 */
export class XmlProductDeriver implements ProductDeriver {
```

Troque:

<!-- prettier-ignore -->
```ts
}

function fragmentsOf(section: PlannedSection): Asset[] {
  return [...section.fragments, ...section.children.flatMap(fragmentsOf)]
}
```

por:

<!-- prettier-ignore -->
```ts
}

function xmlFragments(section: PlannedSection): Asset[] {
  return section.fragments.filter((asset) => fragmentFormat(asset.path) === 'xml')
}

function fragmentsOf(section: PlannedSection): Asset[] {
  return [...xmlFragments(section), ...section.children.flatMap(fragmentsOf)]
}
```

Troque:

<!-- prettier-ignore -->
```ts
      [['feature', section.featureId]],
      [
        ...section.fragments.map((asset) =>
          element(
            'fragment',
```

por:

<!-- prettier-ignore -->
```ts
      [['feature', section.featureId]],
      [
        ...xmlFragments(section).map((asset) =>
          element(
            'fragment',
```

- [ ] **Passo 11: Injetar o deriver e o checker compostos, em `src/renderer/src/ui/app/composition-root.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import { CheckAssetFiles } from '@/application/use-cases/check-asset-files'
import { CreateProject } from '@/application/use-cases/create-project'
```

por:

<!-- prettier-ignore -->
```ts
import { FragmentCheckerByFormat } from '@/application/fragments/fragment-checker-by-format'
import { CombinedProductDeriver } from '@/application/generation/combined-product-deriver'
import { CheckAssetFiles } from '@/application/use-cases/check-asset-files'
import { CreateProject } from '@/application/use-cases/create-project'
```

Troque:

<!-- prettier-ignore -->
```ts
import { ElectronUnsavedChangesIndicator } from '@/infrastructure/electron/electron-unsaved-changes-indicator'
import { ElectronXmlSchemaValidator } from '@/infrastructure/electron/electron-xml-schema-validator'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { SystemClock } from '@/infrastructure/system/system-clock'
```

por:

<!-- prettier-ignore -->
```ts
import { ElectronUnsavedChangesIndicator } from '@/infrastructure/electron/electron-unsaved-changes-indicator'
import { ElectronXmlSchemaValidator } from '@/infrastructure/electron/electron-xml-schema-validator'
import { HtmlFragmentChecker } from '@/infrastructure/html/html-fragment-checker'
import { HtmlPageDeriver } from '@/infrastructure/html/html-page-deriver'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { SystemClock } from '@/infrastructure/system/system-clock'
```

Troque:

<!-- prettier-ignore -->
```ts
  // Uma só resolução para a tela e a geração: o resultado guardado serve às duas.
  const resolveConfiguration = new ResolveConfiguration(new LogicSolverConstraintSolver())
  // O editor de fragmentos confere como a geração confere.
  const fragmentChecker = new XmlFragmentChecker(validator)
  return createProjectStore({
    openProject: new OpenProject({ picker, recents, ...repositories }),
```

por:

<!-- prettier-ignore -->
```ts
  // Uma só resolução para a tela e a geração: o resultado guardado serve às duas.
  const resolveConfiguration = new ResolveConfiguration(new LogicSolverConstraintSolver())
  // O editor de fragmentos confere como a geração confere, com o checker de cada formato.
  const fragmentChecker = new FragmentCheckerByFormat({
    xml: new XmlFragmentChecker(validator),
    html: new HtmlFragmentChecker()
  })
  return createProjectStore({
    openProject: new OpenProject({ picker, recents, ...repositories }),
```

Troque:

<!-- prettier-ignore -->
```ts
    generateProduct: new GenerateProduct({
      resolveConfiguration,
      deriver: new XmlProductDeriver(storage, validator),
      writer: new WriteProductFolder(storage, OUTPUT_DIRECTORY),
      clock: new SystemClock()
```

por:

<!-- prettier-ignore -->
```ts
    generateProduct: new GenerateProduct({
      resolveConfiguration,
      deriver: new CombinedProductDeriver([
        new XmlProductDeriver(storage, validator),
        new HtmlPageDeriver(storage)
      ]),
      writer: new WriteProductFolder(storage, OUTPUT_DIRECTORY),
      clock: new SystemClock()
```

- [ ] **Passo 12: Rodar os roteiros**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/html-checker-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/html-page-check.mts
```

Esperado, `html-checker-check.mts`:

```
HTML normal: ok
div aberto:
    2: A tag <div> é aberta aqui e não é fechada neste arquivo.
section a mais:
    2: </section> sem a tag de abertura, ou fechada fora de ordem.
fora de ordem:
    1: A tag <i> é aberta aqui e não é fechada neste arquivo.
    1: </i> sem a tag de abertura, ou fechada fora de ordem.
html e body:
    1: Um fragmento não pode ter <!doctype>, <html>, <head> nem <body>: eles ficam na moldura.
    2: Um fragmento não pode ter <!doctype>, <html>, <head> nem <body>: eles ficam na moldura.
    4: Um fragmento não pode ter <!doctype>, <html>, <head> nem <body>: eles ficam na moldura.
    5: Um fragmento não pode ter <!doctype>, <html>, <head> nem <body>: eles ficam na moldura.
doctype:
    1: Um fragmento não pode ter <!doctype>, <html>, <head> nem <body>: eles ficam na moldura.
td fora da tabela:
    2: O navegador ignora a tag <td> neste lugar.
    2: </td> sem a tag de abertura, ou fechada fora de ordem.
div/:
    1: No HTML, /> não fecha esta tag: escreva a tag de fechamento.
    1: A tag <div> é aberta aqui e não é fechada neste arquivo.
sintaxe:
    1: Atributo repetido na mesma tag.
    2: Entidade desconhecida (como &foo;).
    2: Falta o ; no fim da entidade.
    2: Um < solto: escreva &lt;.
svg: ok
template: ok
texto com < em script e style: ok
comentário: ok
UTF-8:
    1: O arquivo não está em UTF-8: salve-o em UTF-8.
BOM e CRLF:
    2: A tag <div> é aberta aqui e não é fechada neste arquivo.
--- marcadores
lugares que valem: ok
dentro da tag:
    1: Um marcador não pode ficar dentro da tag, fora do valor de um atributo.
dentro do script:
    1: Marcadores não valem dentro de <script>.
sintaxe e reservados:
    1: Falta o }} que fecha o marcador.
    2: Marcador desconhecido: {{contuedo}}. Use {{feature.atributo}} ou {{produto}}.
    2: {{conteudo}} só vale na moldura.
    2: {{sumario}} só vale na moldura.
--- moldura
moldura padrão: ok
moldura sem </body> nem conteúdo:
    1: A moldura precisa ter </body>.
    1: A moldura precisa de {{conteudo}}, onde entram as seções.
conteúdo fora do body:
    4: {{conteudo}} precisa ficar no texto do <body>.
    7: {{sumario}} precisa ficar no texto do <body>.
conteúdo repetido:
    1: {{conteudo}} só pode aparecer uma vez.
```

Esperado, `html-page-check.mts`:

```
=== página com moldura
  text product.xml
  text index.html
    | <!doctype html>
    | <html lang="pt-BR">
    | <head>
    | <meta charset="utf-8">
    | <title>Loja &lt;Escura&gt; — v1.0</title>
    | <link rel="stylesheet" href="css/site.css">
    | <link rel="stylesheet" href="css/escuro.css">
    | </head>
    | <body>
    | <header><a href="docs/guia.pdf?v=2#p3">Guia</a> <img src="img/logo.png" srcset="img/logo.png 1x, img/logo@2x.png 2x" alt=""></header>
    | <nav class="sumario">
    | <ol>
    | <li><a href="#busca">Busca</a></li>
    | </ol>
    | </nav>
    | <section id="loja">
    | <h2>Bem-vindo à Loja &lt;Escura&gt;</h2>
    | <p title="v1.0">Versão 1.0 &amp; mais.</p>
    | <pre>
    |   recuo
    | </pre>
    | <section id="busca">
    | <h3>Busca</h3>
    | <img src="img/lupa.svg" alt="lupa">
    | <style>.busca { color: #000 }</style>
    | </section>
    | <section id="tema_escuro">
    | </section>
    | </section>
    | <footer>{{ literal }} · <a href="https://exemplo.com">site</a> · <a href="#busca">busca</a></footer>
    | <script src="js/app.js"></script>
    | </body>
    | </html>
    |
  copy css/site.css
  copy js/app.js
  copy css/escuro.css
  copy docs/guia.pdf
  copy img/logo.png
  copy img/logo@2x.png
  copy img/lupa.svg
=== sem moldura (a padrão)
  text product.xml
  text index.html
    | <!doctype html>
    | <html lang="pt-BR">
    | <head>
    | <meta charset="utf-8">
    | <meta name="viewport" content="width=device-width, initial-scale=1">
    | <title>Loja &lt;Escura&gt;</title>
    | <link rel="stylesheet" href="css/site.css">
    | <link rel="stylesheet" href="css/escuro.css">
    | </head>
    | <body>
    | <section id="loja">
    | <h2>Bem-vindo à Loja &lt;Escura&gt;</h2>
    | <p title="v1.0">Versão 1.0 &amp; mais.</p>
    | <pre>
    |   recuo
    | </pre>
    | <section id="busca">
    | <h3>Busca</h3>
    | <img src="img/lupa.svg" alt="lupa">
    | <style>.busca { color: #000 }</style>
    | </section>
    | <section id="tema_escuro">
    | </section>
    | </section>
    | <script src="js/app.js"></script>
    | </body>
    | </html>
    |
  copy css/site.css
  copy js/app.js
  copy css/escuro.css
  copy img/lupa.svg
=== problemas
  moldura.html:12 [] {{mobile.plataforma}}: a feature mobile não está selecionada nesta configuração. Use uma condição de presença no fragmento.
  moldura.html:12 [] Use um caminho relativo em vez de /sobre.html: na pasta gerada, "/" é a raiz do disco.
  docs/loja.html:1 [doc_loja] A tag <div> é aberta aqui e não é fechada neste arquivo.
  docs/loja.html:2 [doc_loja] A feature loja não tem o atributo nome.
  docs/loja.html:4 [doc_loja] O caminho ../../fora.html sai da pasta do projeto.
  docs/busca/busca.html:1 [doc_busca] O valor de {{tema_escuro.cor}} tem <, que não pode entrar num <style>.
  docs/loja.html:3 [doc_loja] O arquivo citado não existe: docs/img/falta.png.
  docs/loja.html:5 [doc_loja] O arquivo index.html do projeto substituiria o index.html gerado: mude o nome dele.
=== recurso chamado index.html
  index.html [] O arquivo index.html do projeto substituiria o index.html gerado: mude o nome dele.
=== fragmento ausente
  docs/busca/busca.html [doc_busca] Arquivo ausente.
```

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

```ts
/*
 * Converte o herby original (XML, em C:/Users/lucas/Desktop/herby) no exemplo
 * docs/examples/herby (HTML), conforme a spec da Fase 7. O original só é lido.
 *
 *   npx tsx --tsconfig tsconfig.web.json .checks/herby-convert.mts tabela
 *     mostra a tabela perfil × features e o estado de cada configuração; não grava nada.
 *   npx tsx --tsconfig tsconfig.web.json .checks/herby-convert.mts gravar
 *     grava o exemplo (menos a moldura.html e o css/herby.css, escritos à mão).
 *   … fragmentos
 *     como gravar, mas sem as configurações.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import type { Element, Node } from '@xmldom/xmldom'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import type { Asset } from '@/domain/assets/asset-catalog'
import type {
  AttributeValue,
  Configuration,
  ManualDecision
} from '@/domain/configuration/configuration'
import {
  configurationStatus,
  isSelected,
  type ConfigurationStatus
} from '@/domain/configuration/resolution'
import type {
  Attribute,
  Feature,
  FeatureChild,
  FeatureModel
} from '@/domain/feature-model/feature-model'
import { childFeatures, featuresInPreOrder } from '@/domain/feature-model/traversal'
import { validateFeatureModel } from '@/domain/feature-model/validation'
import { configurationKey } from '@/domain/project/configuration-entries'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { decodeAssetCatalog, encodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { encodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel, encodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'

const ORIGINAL = 'C:/Users/lucas/Desktop/herby'
const ORIGINAL_FRAGMENTS = `${ORIGINAL}/Fragmentos XML`
const TARGET = 'docs/examples/herby'
const FRAGMENTS_DIRECTORY = 'fragmentos'
const mode = process.argv[2] ?? 'tabela'

/** O arquivo do fragmento (sem .xml) → a feature do modelo. */
const FEATURE_OF: Record<string, string> = {
  plataforma: 'herby',
  preparacao: 'preparacao',
  'acesso-plataforma': 'acesso_a_plataforma',
  'informacoes-gerais': 'informacoes_gerais',
  'gestao-base-dados': 'gestao_da_base_de_dados',
  lixeira: 'lixeira',
  'sincronizacao-dados': 'sincronizacao_rede_estadual',
  'template-dados': 'template_de_dados',
  impressao: 'impressao_dos_cartoes',
  'impressao-herby': 'impressao_na_herby',
  'impressao-sistema-externo': 'impressao_no_saev',
  'aplicacao-correcao': 'aplicacao_e_correcao',
  'processamento-foto': 'processamento_por_foto',
  'educacao-especial': 'educacao_especial',
  'avaliacao-fluencia': 'avaliacao_de_fluencia_audio',
  'correcao-ia-fluencia': 'correcao_por_ia',
  'monitoramento-resultados': 'monitoramento_e_resultados',
  progresso: 'progresso',
  resultados: 'resultados',
  'resultados-detalhados': 'resultados_detalhados',
  relatorios: 'relatorios',
  graficos: 'graficos',
  'qrcode-resultados': 'qr_code_de_resultados'
}

/** A correção do nome e do ID (Q41). */
const RENAMED = { from: 'educacao_especia', to: 'educacao_especial', name: 'Educação Especial' }

/** Obrigatórias no original, mas seis decks não as têm (Q43): viram opcionais. */
const MADE_OPTIONAL = new Set(['preparacao', 'acesso_a_plataforma', 'impressao_dos_cartoes'])

/** Onde fica cada variável (Q34); as que não estão aqui ficam na raiz. */
const OWNER_OF_VARIABLE: Record<string, string> = {
  avaliacao: 'informacoes_gerais',
  data_treinamento: 'informacoes_gerais',
  prazo_envio_template: 'informacoes_gerais',
  data_liberacao_cartoes: 'informacoes_gerais',
  url_template: 'template_de_dados',
  contato_operacoes: 'template_de_dados'
}
const ROOT = 'herby'

/** O nome de exibição de cada perfil; a chave da configuração sai dele, como no app. */
const PROFILE_NAMES: Record<string, string> = {
  completa: 'Completa',
  'completa-atibaia': 'Completa Atibaia',
  'rondonia-primeiros-passos': 'Rondônia Primeiros Passos',
  'rondonia-paic-proalfa': 'Rondônia PAIC PROALFA',
  epv: 'EPV',
  'fgv-formularios': 'FGV Formulários',
  'fluencia-saev': 'Fluência SAEV',
  'fluencia-legado': 'Fluência Legado',
  'sed-com-detalhes': 'SED com detalhes',
  'sed-sem-detalhes': 'SED sem detalhes',
  'sem-gestao-base': 'Sem gestão da base',
  'sem-resultados-detalhados': 'Sem resultados detalhados',
  'resultados-ia-fluencia': 'Resultados da IA de Fluência'
}

// ---------- leitura do original ----------

function readXml(path: string): Element {
  return parseXmlRoot(readFileSync(path, 'utf8'))
}

function elements(parent: Element): Element[] {
  const result: Element[] = []
  for (let index = 0; index < parent.childNodes.length; index++) {
    const node = parent.childNodes[index]
    if (node.nodeType === 1) result.push(node as Element)
  }
  return result
}

function attr(element: Element, name: string): string | undefined {
  return element.hasAttribute(name) ? element.getAttribute(name)! : undefined
}

interface Variable {
  readonly name: string
  readonly defaultValue: string
  readonly description: string
  readonly byProfile: ReadonlyMap<string, string>
}

const variables: Variable[] = elements(readXml(`${ORIGINAL_FRAGMENTS}/_variaveis.xml`)).map(
  (node) => ({
    name: attr(node, 'nome')!,
    defaultValue: attr(node, 'padrao') ?? '',
    description: attr(node, 'descricao') ?? attr(node, 'nome')!,
    byProfile: new Map(
      elements(node).map((value) => [attr(value, 'perfil')!, value.textContent ?? ''])
    )
  })
)
const variableByName = new Map(variables.map((variable) => [variable.name, variable]))
const ownerOf = (name: string): string => OWNER_OF_VARIABLE[name] ?? ROOT

interface SourceFragment {
  readonly base: string
  readonly featureId: string
  readonly root: Element
  /** Os perfis citados no <origem slides="perfil#n …"> de qualquer bloco. */
  readonly profiles: ReadonlySet<string>
}

const sources: SourceFragment[] = readdirSync(ORIGINAL_FRAGMENTS)
  .filter((name) => name.endsWith('.xml') && !name.startsWith('_'))
  .map((name) => {
    const base = name.slice(0, -'.xml'.length)
    const featureId = FEATURE_OF[base]
    if (featureId === undefined) throw new Error(`Fragmento sem feature: ${name}`)
    const root = readXml(`${ORIGINAL_FRAGMENTS}/${name}`)
    const profiles = new Set<string>()
    for (const origin of Array.from(root.getElementsByTagName('origem'))) {
      for (const slide of (attr(origin, 'slides') ?? '').split(/\s+/).filter(Boolean)) {
        profiles.add(slide.split('#')[0])
      }
    }
    return { base, featureId, root, profiles }
  })

// ---------- modelo ----------

function withVariables(feature: Feature): Feature {
  const renamed = {
    ...(feature.id === RENAMED.from ? { ...feature, id: RENAMED.to, name: RENAMED.name } : feature),
    ...(MADE_OPTIONAL.has(feature.id) ? { variability: 'optional' as const } : {})
  }
  const attributes: Attribute[] = variables
    .filter((variable) => ownerOf(variable.name) === renamed.id)
    .map((variable) => ({
      id: variable.name,
      name: variable.description,
      type: 'string',
      defaultValue: variable.defaultValue,
      configurable: true,
      options: []
    }))
  const children: FeatureChild[] = renamed.children.map((child) =>
    child.kind === 'feature'
      ? { kind: 'feature', feature: withVariables(child.feature) }
      : {
          kind: 'group',
          group: { ...child.group, members: child.group.members.map(withVariables) }
        }
  )
  return { ...renamed, attributes: [...renamed.attributes, ...attributes], children }
}

const decodedModel = decodeFeatureModel(readXml(`${ORIGINAL}/model.xml`))
if (!decodedModel.ok) throw new Error(JSON.stringify(decodedModel.error))
const model: FeatureModel = { ...decodedModel.value, root: withVariables(decodedModel.value.root) }
const modelIssues = validateFeatureModel(model)
if (modelIssues.length > 0) throw new Error(`Modelo inválido: ${JSON.stringify(modelIssues)}`)

const preorder = featuresInPreOrder(model.root)
const depthOf = new Map<string, number>()
const parentOf = new Map<string, string>()
const measure = (feature: Feature, depth: number): void => {
  depthOf.set(feature.id, depth)
  for (const child of childFeatures(feature)) {
    parentOf.set(child.id, feature.id)
    measure(child, depth + 1)
  }
}
measure(model.root, 0)
for (const source of sources) {
  if (!depthOf.has(source.featureId)) throw new Error(`Feature inexistente: ${source.featureId}`)
}

// ---------- fragmentos HTML ----------

const escapeText = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const escapeAttribute = (text: string): string => escapeText(text).replaceAll('"', '&quot;')
const indent = (line: string): string => (line === '' ? '' : `  ${line}`)

function marker(name: string): string {
  if (!variableByName.has(name)) throw new Error(`Variável desconhecida: ${name}`)
  return `{{${ownerOf(name)}.${name}}}`
}

/** O conteúdo de um elemento de texto: texto, <destaque>, <ui> e <var>. */
function inline(element: Element): string {
  let html = ''
  for (let index = 0; index < element.childNodes.length; index++) {
    const node: Node = element.childNodes[index]
    if (node.nodeType === 3) {
      html += escapeText((node.nodeValue ?? '').replace(/\s*\n\s*/g, ' '))
      continue
    }
    if (node.nodeType !== 1) continue
    const child = node as Element
    switch (child.localName) {
      case 'destaque':
        html += `<strong>${inline(child)}</strong>`
        break
      case 'ui':
        html += `<span class="ui">${inline(child)}</span>`
        break
      case 'var':
        html += marker(attr(child, 'nome')!)
        break
      default:
        throw new Error(`Elemento inesperado no texto: <${child.localName}>`)
    }
  }
  return html.trim()
}

/** O elemento com `perfis` vai para dentro de um <template>, que o navegador não mostra (Q37). */
function withProfiles(element: Element, lines: string[]): string[] {
  const profiles = attr(element, 'perfis')
  if (profiles === undefined) return lines
  return [
    `<template data-perfis="${escapeAttribute(profiles)}">`,
    ...lines.map(indent),
    '</template>'
  ]
}

function image(element: Element): string[] {
  const img = `<img src="${escapeAttribute(attr(element, 'src')!)}" alt="${escapeAttribute(attr(element, 'alt') ?? '')}">`
  const caption = elements(element).find((child) => child.localName === 'legenda')
  const lines = caption
    ? ['<figure>', indent(img), indent(`<figcaption>${inline(caption)}</figcaption>`), '</figure>']
    : [img]
  return withProfiles(element, lines)
}

function list(element: Element): string[] {
  const tag = attr(element, 'tipo') === 'numerada' ? 'ol' : 'ul'
  return [
    `<${tag}>`,
    ...elements(element).map((item) => indent(`<li>${inline(item)}</li>`)),
    `</${tag}>`
  ]
}

function table(element: Element): string[] {
  const row = (cells: Element[], tag: string): string[] => [
    '<tr>',
    ...cells.map((cell) => indent(`<${tag}>${inline(cell)}</${tag}>`)),
    '</tr>'
  ]
  const header = elements(element).filter((child) => child.localName === 'cabecalho')
  const rows = elements(element).filter((child) => child.localName === 'linha')
  return [
    '<table>',
    ...(header.length > 0
      ? [
          indent('<thead>'),
          ...header.flatMap((line) => row(elements(line), 'th')).map((l) => indent(indent(l))),
          indent('</thead>')
        ]
      : []),
    indent('<tbody>'),
    ...rows.flatMap((line) => row(elements(line), 'td')).map((l) => indent(indent(l))),
    indent('</tbody>'),
    '</table>'
  ]
}

function contents(element: Element): string[] {
  return elements(element).flatMap((child): string[] => {
    switch (child.localName) {
      case 'texto':
        return [`<p>${inline(child)}</p>`]
      case 'imagem':
        return image(child)
      case 'lista':
        return list(child)
      case 'tabela':
        return table(child)
      case 'legenda':
        return [`<p class="legenda">${inline(child)}</p>`]
      case 'origem':
        return []
      default:
        throw new Error(`Elemento inesperado em <${element.localName}>: <${child.localName}>`)
    }
  })
}

function block(element: Element, level: number): string[] {
  const id = escapeAttribute(attr(element, 'id')!)
  const heading = (text: string): string => `<h${level}>${text}</h${level}>`
  const title = attr(element, 'titulo')
  let lines: string[]
  switch (element.localName) {
    case 'secao':
      lines = [
        `<section class="secao" id="${id}">`,
        ...(title !== undefined ? [indent(heading(escapeText(title)))] : []),
        ...contents(element).map(indent),
        '</section>'
      ]
      break
    case 'passo':
      lines = [
        `<section class="passo" id="${id}">`,
        indent(heading(`Passo ${escapeText(attr(element, 'n')!)} — ${escapeText(title ?? '')}`)),
        ...contents(element).map(indent),
        '</section>'
      ]
      break
    case 'aviso':
      lines = [
        `<aside class="aviso ${escapeAttribute(attr(element, 'tipo') ?? '')}" id="${id}">`,
        ...contents(element).map(indent),
        '</aside>'
      ]
      break
    default:
      throw new Error(`Bloco inesperado: <${element.localName}>`)
  }
  return withProfiles(element, lines)
}

function toHtml(source: SourceFragment): string {
  const level = Math.min(2 + depthOf.get(source.featureId)!, 5)
  const lines: string[] = []
  for (const child of elements(source.root)) {
    switch (child.localName) {
      case 'titulo':
        lines.push(`<h${level}>${inline(child)}</h${level}>`)
        break
      case 'resumo':
        lines.push(`<p class="resumo">${inline(child)}</p>`)
        break
      default:
        lines.push('', ...block(child, Math.min(level + 1, 6)))
    }
  }
  return `${lines.join('\n')}\n`
}

/** O texto do título, com as variáveis no valor padrão: vira o nome do asset. */
function plainTitle(source: SourceFragment): string {
  const title = elements(source.root).find((child) => child.localName === 'titulo')!
  return inline(title).replace(
    /\{\{[a-z_]+\.([a-z_]+)\}\}/g,
    (_, name: string) => variableByName.get(name)!.defaultValue
  )
}

// ---------- assets ----------

const decodedAssets = decodeAssetCatalog(readXml(`${ORIGINAL}/assets.xml`))
if (!decodedAssets.ok) throw new Error(JSON.stringify(decodedAssets.error))
const fragmentAssets: Asset[] = sources.map((source) => ({
  id: source.base.replaceAll('-', '_'),
  kind: 'fragment',
  path: `${FRAGMENTS_DIRECTORY}/${source.base}.html`,
  anchor: source.featureId,
  name: plainTitle(source)
}))
const cssAsset: Asset = {
  id: 'css_herby',
  kind: 'resource',
  path: 'css/herby.css',
  anchor: ROOT,
  name: 'Estilo da página'
}
/** Agrupados pela âncora, na pré-ordem do modelo (SPEC §4.3). */
const assets: Asset[] = preorder.flatMap((feature) => [
  ...fragmentAssets.filter((asset) => asset.anchor === feature.id),
  ...(feature.id === ROOT ? [cssAsset] : []),
  ...decodedAssets.value.assets.filter((asset) => asset.anchor === feature.id)
])

// ---------- configurações ----------

const allProfiles = [
  ...new Set([
    ...Object.keys(PROFILE_NAMES),
    ...sources.flatMap((source) => [...source.profiles]),
    ...variables.flatMap((variable) => [...variable.byProfile.keys()])
  ])
]

/** As features do perfil pelo <origem>, com os ancestrais (um filho implica o pai) e a raiz. */
function wantedFeatures(profile: string): Set<string> {
  const wanted = new Set<string>([ROOT])
  for (const source of sources) {
    if (!source.profiles.has(profile)) continue
    for (let id: string | undefined = source.featureId; id !== undefined; id = parentOf.get(id))
      wanted.add(id)
  }
  return wanted
}

interface BuiltConfiguration {
  readonly profile: string
  readonly key: string
  readonly configuration: Configuration
  readonly wanted: ReadonlySet<string>
  readonly selected: ReadonlySet<string>
  readonly notes: readonly string[]
  readonly status: ConfigurationStatus
}

const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const takenKeys = new Set<string>()

function buildConfiguration(profile: string): BuiltConfiguration {
  const name = PROFILE_NAMES[profile] ?? profile
  const key = configurationKey(name, takenKeys)
  takenKeys.add(key)
  const wanted = wantedFeatures(profile)
  const values: AttributeValue[] = []
  for (const feature of preorder) {
    if (!wanted.has(feature.id)) continue
    for (const attribute of feature.attributes) {
      const value = variableByName.get(attribute.id)?.byProfile.get(profile)
      if (value !== undefined)
        values.push({ featureId: feature.id, attributeId: attribute.id, value })
    }
  }
  let decisions: ManualDecision[] = []
  const notes: string[] = []
  const configurationWith = (list: ManualDecision[]): Configuration => ({
    name,
    decisions: list,
    values
  })

  // Em pré-ordem, decide só o que continua indeciso: o arquivo fica com as decisões mínimas.
  for (const feature of preorder) {
    const resolution = resolver.execute(model, configurationWith(decisions))
    if (resolution.kind !== 'resolved') break
    const status = resolution.features.get(feature.id)!
    const want = wanted.has(feature.id)
    if (status.kind === 'undecided') {
      const attempt = [
        ...decisions,
        { featureId: feature.id, state: want ? 'selected' : 'deselected' } as const
      ]
      if (resolver.execute(model, configurationWith(attempt)).kind === 'conflict') {
        notes.push(`${feature.id}: ${want ? 'selecionar' : 'excluir'} dá conflito com o modelo`)
      } else {
        decisions = attempt
      }
    } else if (isSelected(status) !== want) {
      notes.push(
        `${feature.id}: o modelo ${isSelected(status) ? 'obriga a ter' : 'impede'}, mas o <origem> ${want ? 'tem' : 'não tem'} slides do perfil`
      )
    }
  }
  const configuration = configurationWith(decisions)
  const resolution = resolver.execute(model, configuration)
  const selected = new Set(
    resolution.kind === 'resolved'
      ? [...resolution.features].filter(([, status]) => isSelected(status)).map(([id]) => id)
      : []
  )
  return {
    profile,
    key,
    configuration,
    wanted,
    selected,
    notes,
    status: configurationStatus(resolution)
  }
}

const configurations = allProfiles.map(buildConfiguration)

// ---------- saída ----------

function printTable(): void {
  const header = configurations.map((_, index) => `${index + 1}`)
  console.log(`| Feature | ${header.join(' | ')} |`)
  console.log(`| --- | ${header.map(() => ':-:').join(' | ')} |`)
  for (const feature of preorder) {
    const cells = configurations.map((built) => {
      const want = built.wanted.has(feature.id)
      const has = built.selected.has(feature.id)
      if (want === has) return has ? '✓' : '·'
      return has ? '✓!' : '✗!'
    })
    const label = `${'  '.repeat(depthOf.get(feature.id)!)}${feature.name}`
    console.log(`| ${label} | ${cells.join(' | ')} |`)
  }
  console.log('')
  configurations.forEach((built, index) => {
    const { status } = built
    const state = !status.valid
      ? 'em conflito'
      : status.complete
        ? 'completa'
        : `incompleta (${status.undecidedCount} indecisas, ${status.missingValueCount} sem valor)`
    console.log(
      `${index + 1}. ${built.configuration.name} (${built.key}.xml, perfil "${built.profile}"): ${state}`
    )
    for (const note of built.notes) console.log(`   - ${note}`)
    for (const value of built.configuration.values)
      console.log(`   · ${value.featureId}.${value.attributeId} = ${value.value}`)
  })
  const hidden = sources.reduce(
    (total, source) => total + source.root.getElementsByTagName('*').length,
    0
  )
  console.log(
    `\n${sources.length} fragmentos, ${hidden} elementos, ${assets.length} assets, ${allProfiles.length} perfis.`
  )
}

function copyTree(from: string, to: string): number {
  let count = 0
  for (const name of readdirSync(from)) {
    const source = join(from, name)
    const target = join(to, name)
    if (statSync(source).isDirectory()) {
      count += copyTree(source, target)
    } else {
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(source, target)
      count++
    }
  }
  return count
}

function write(): void {
  const write = (path: string, content: string): void => {
    const full = `${TARGET}/${path}`
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content, 'utf8')
  }
  // A moldura e o CSS são escritos à mão: sobrevivem a uma nova conversão.
  for (const generated of [
    'model.xml',
    'assets.xml',
    'configurations',
    FRAGMENTS_DIRECTORY,
    'Slides por Feature'
  ]) {
    rmSync(`${TARGET}/${generated}`, { recursive: true, force: true })
  }
  write('model.xml', encodeFeatureModel(model))
  write('assets.xml', encodeAssetCatalog({ assets }))
  const written = mode === 'gravar' ? configurations : []
  for (const built of written)
    write(`configurations/${built.key}.xml`, encodeConfiguration(built.configuration))
  for (const source of sources) write(`${FRAGMENTS_DIRECTORY}/${source.base}.html`, toHtml(source))
  const images = copyTree(`${ORIGINAL_FRAGMENTS}/img`, `${TARGET}/${FRAGMENTS_DIRECTORY}/img`)
  const slides = copyTree(`${ORIGINAL}/Slides por Feature`, `${TARGET}/Slides por Feature`)
  console.log(
    `gravado: ${sources.length} fragmentos, ${written.length} configurações, ${images} imagens, ${slides} arquivos de slides`
  )
  for (const handWritten of ['moldura.html', 'css/herby.css']) {
    if (!existsSync(`${TARGET}/${handWritten}`)) console.log(`falta escrever à mão: ${handWritten}`)
  }
}

if (mode === 'tabela') printTable()
else if (mode === 'gravar' || mode === 'fragmentos') write()
else throw new Error(`Modo desconhecido: ${mode}`)
```

- [ ] **Passo 2: Escrever o roteiro `.checks/herby-open-check.mts`**

```ts
// Abre o exemplo herby como o app abre (XML, XSD e regras do domínio), sem a interface.
//   npx tsx --tsconfig tsconfig.web.json .checks/herby-open-check.mts
import { resolve } from 'node:path'
import { OpenProject } from '@/application/use-cases/open-project'
import { ok } from '@/domain/shared/result'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'
import { DiskStorage, NodeXmlValidator } from './generation-support.mts'

const folder = resolve('docs/examples/herby')
const storage = new DiskStorage(folder)
const validator = new NodeXmlValidator()
const open = new OpenProject({
  picker: { pick: async () => ok({ rootPath: folder, name: 'herby' }) },
  recents: { list: async () => [], reopen: async () => ok({ rootPath: folder, name: 'herby' }) },
  models: new XmlFeatureModelRepository(storage, validator),
  assets: new XmlAssetCatalogRepository(storage, validator),
  configurations: new XmlConfigurationRepository(storage, validator)
} as never)
const result = await open.execute()
console.log(result.status)
if (result.status === 'opened') {
  const { project } = result.session
  console.log(
    `${project.assets.assets.length} assets, ${project.configurations.length} configurações, avisos: ${result.warnings.length}`
  )
} else {
  console.log(JSON.stringify(result, null, 1).slice(0, 1500))
  process.exitCode = 1
}
```

- [ ] **Passo 3: Escrever o roteiro `.checks/herby-generate.mts`**

Gera uma configuração numa cópia do exemplo, pelo `GenerateProduct`, e compara a página com a esperada.

```ts
// Gera uma configuração do exemplo herby numa cópia em .checks/geracao/herby, pelo mesmo
// caminho do app (GenerateProduct com o product.xml e a página), e mostra o resultado.
//   npx tsx --tsconfig tsconfig.web.json .checks/herby-generate.mts [configuração]
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CombinedProductDeriver } from '@/application/generation/combined-product-deriver'
import { GenerateProduct } from '@/application/use-cases/generate-product'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { WriteProductFolder } from '@/application/use-cases/write-product-folder'
import { HtmlPageDeriver } from '@/infrastructure/html/html-page-deriver'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import { DiskStorage, NodeXmlValidator } from './generation-support.mts'

const key = process.argv[2] ?? 'completa-atibaia'
const folder = resolve('.checks/geracao/herby')
rmSync(folder, { recursive: true, force: true })
cpSync('docs/examples/herby', folder, { recursive: true })

const read = (path: string) => parseXmlRoot(readFileSync(join(folder, path), 'utf8'))
const model = decodeFeatureModel(read('model.xml'))
const assets = decodeAssetCatalog(read('assets.xml'))
if (!model.ok || !assets.ok) throw new Error('o exemplo não abriu')
const configurations = readdirSync(join(folder, 'configurations')).map((name) => {
  const decoded = decodeConfiguration(read(`configurations/${name}`))
  if (!decoded.ok) throw new Error(`${name} não abriu`)
  return { key: name.slice(0, -'.xml'.length), configuration: decoded.value }
})

const storage = new DiskStorage(folder)
const validator = new NodeXmlValidator()
const generate = new GenerateProduct({
  resolveConfiguration: new ResolveConfiguration(new LogicSolverConstraintSolver()),
  deriver: new CombinedProductDeriver([
    new XmlProductDeriver(storage, validator),
    new HtmlPageDeriver(storage)
  ]),
  writer: new WriteProductFolder(storage, 'saida'),
  clock: { now: () => new Date('2026-09-28T12:00:00Z') }
})
const result = await generate.execute(
  { model: model.value, assets: assets.value, configurations },
  key
)
console.log(`${key}: ${result.kind}`)
if (result.kind === 'problems' || result.kind === 'write-failed') {
  for (const problem of result.problems) {
    console.log(
      `  ${problem.file}${problem.line ? `:${problem.line}` : ''} [${problem.subject ?? ''}] ${problem.message}`
    )
  }
}
if (result.kind === 'generated') {
  const list = (directory: string, prefix = ''): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? list(join(directory, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`]
    )
  const files = list(join(folder, 'saida', key))
  console.log(
    `  ${files.length} arquivos: ${files.filter((file) => !file.includes('/img/')).join(', ')} e ${files.filter((file) => file.includes('/img/')).length} imagens`
  )
  const expected = `docs/examples/produto-esperado/herby-${key}/index.html`
  if (existsSync(expected)) {
    const same = readFileSync(join(folder, 'saida', key, 'index.html')).equals(
      readFileSync(expected)
    )
    console.log(`  index.html: ${same ? 'idêntico ao esperado' : 'DIFERENTE do esperado'}`)
  }
}
```

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

```
| Feature | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Herby | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
|   Preparação | ✓ | ✓ | ✓ | ✓ | · | · | · | · | ✓ | ✓ | ✓ | ✓ | · |
|     Acesso à Plataforma | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | ✓ | · |
|     Informações Gerais | · | ✓ | · | ✓ | · | · | · | · | · | · | · | · | · |
|     Gestão da Base de Dados | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | ✓ | · | ✓ | · |
|       Lixeira | ✓ | · | ✓ | · | · | · | · | · | · | · | · | ✓ | · |
|       Sincronização (rede estadual) | ✓ | ✓ | · | · | · | · | · | · | ✓ | ✓ | · | · | · |
|     Template de Dados | · | · | · | ✓ | · | · | · | · | · | · | · | · | · |
|   Impressão dos Cartões | ✓ | ✓ | ✓ | · | ✓ | · | ✓ | · | ✓ | ✓ | ✓ | ✓ | · |
|     Impressão na Herby | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | ✓ | · |
|     Impressão no SAEV | · | · | · | · | ✓ | · | ✓ | · | · | · | · | · | · |
|   Aplicação e Correção | ✓ | ✓ | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
|     Processamento por Foto | ✓ | ✓ | ✓ | · | ✓ | ✓ | · | · | ✓ | ✓ | ✓ | ✓ | · |
|       Educação Especial | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | · | · |
|     Avaliação de Fluência (áudio) | · | · | · | · | · | · | ✓ | ✓ | · | · | · | · | ✓ |
|       Correção por IA | · | · | · | · | · | · | · | · | · | · | · | · | ✓ |
|   Monitoramento e Resultados | ✓ | ✓ | ✓ | · | ✓ | ✓ | · | · | ✓ | ✓ | ✓ | ✓ | · |
|     Progresso | ✓ | ✓ | ✓ | · | ✓ | ✓ | · | · | ✓ | ✓ | ✓ | ✓ | · |
|     Resultados | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | ✓ | · |
|       Resultados Detalhados | ✓ | ✓ | · | · | · | · | · | · | ✓ | · | ✓ | · | · |
|       Relatórios | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | ✓ | · |
|       Gráficos | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | ✓ | · |
|       QR Code de Resultados | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | ✓ | ✓ | ✓ | · |

1. Completa (completa.xml, perfil "completa"): completa
2. Completa Atibaia (completa-atibaia.xml, perfil "completa-atibaia"): completa
   · herby.titulo_tutorial = Avaliação Formativa - SAEMA 2026
   · herby.rede = Atibaia
   · informacoes_gerais.avaliacao = SAEMA 2026
3. Rondônia Primeiros Passos (rondonia-primeiros-passos.xml, perfil "rondonia-primeiros-passos"): completa
   · herby.titulo_tutorial = Primeiros Passos
   · herby.rede = Rondônia
4. Rondônia PAIC PROALFA (rondonia-paic-proalfa.xml, perfil "rondonia-paic-proalfa"): completa
   · herby.titulo_tutorial = Preenchimento do template de dados (Rede Municipal)
   · herby.rede = Rondônia · PAIC/PROALFA
   · informacoes_gerais.avaliacao = Avaliação Diagnóstica PAIC/PROALFA 2026
5. EPV (epv.xml, perfil "epv"): completa
   · herby.titulo_tutorial = Ferramenta Herby
6. FGV Formulários (fgv-formularios.xml, perfil "fgv-formularios"): completa
   · herby.titulo_tutorial = Processamento dos formulários
7. Fluência SAEV (fluencia-saev.xml, perfil "fluencia-saev"): completa
   · herby.titulo_tutorial = Avaliação de Fluência - EPV
8. Fluência Legado (fluencia-legado.xml, perfil "fluencia-legado"): completa
   · herby.titulo_tutorial = Avaliação de Fluência
9. SED com detalhes (sed-com-detalhes.xml, perfil "sed-com-detalhes"): completa
10. SED sem detalhes (sed-sem-detalhes.xml, perfil "sed-sem-detalhes"): completa
11. Sem gestão da base (sem-gestao-da-base.xml, perfil "sem-gestao-base"): completa
12. Sem resultados detalhados (sem-resultados-detalhados.xml, perfil "sem-resultados-detalhados"): completa
13. Resultados da IA de Fluência (resultados-da-ia-de-fluencia.xml, perfil "resultados-ia-fluencia"): completa

23 fragmentos, 680 elementos, 30 assets, 13 perfis.
```

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
```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{herby.titulo_tutorial}} — {{produto}}</title>
</head>
<body>
<header class="capa">
  <p class="sobretitulo">Orientações para o uso da plataforma</p>
  <h1>{{herby.titulo_tutorial}}</h1>
  <p class="subtitulo"><span class="rede">{{herby.rede}}</span><span class="ano">{{herby.ano}}</span></p>
</header>
<main>
<section class="agenda">
  <h2>Funcionalidades</h2>
{{sumario}}
</section>
{{conteudo}}
</main>
<footer class="encerramento">
  <h2>Obrigado(a)!</h2>
  <ul class="contatos">
    <li><a href="https://{{herby.site}}">{{herby.site}}</a></li>
    <li>Nosso número de WhatsApp: {{herby.contato_whatsapp}}</li>
    <li>Nosso e-mail para contato: <a href="mailto:{{herby.contato_email}}">{{herby.contato_email}}</a></li>
  </ul>
</footer>
</body>
</html>
```

- [ ] **Passo 8: Criar `docs/examples/herby/css/herby.css`**

<!-- prettier-ignore -->
```css
/* O visual dos tutoriais da Herby: sóbrio, com o azul-marinho da plataforma. */

:root {
  --marinho: #0d2c4f;
  --marinho-claro: #e8eef5;
  --texto: #1f2933;
  --texto-suave: #52606d;
  --borda: #d9e2ec;
  --atencao: #b7791f;
  --atencao-fundo: #fdf6e3;
  --sucesso: #2f855a;
  --sucesso-fundo: #eef8f2;
  --importante: #c53030;
  --importante-fundo: #fdf0f0;
  --lembrete: #2b6cb0;
  --lembrete-fundo: #edf4fb;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #fff;
  color: var(--texto);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
}

/* Capa e encerramento: faixas azuis de ponta a ponta, com o texto na largura da página. */

.capa,
.encerramento {
  background: var(--marinho);
  color: #fff;
  padding: 3rem 1.5rem 2.5rem;
}

.capa > *,
.encerramento > * {
  max-width: 46rem;
  margin-inline: auto;
}

.sobretitulo {
  margin-top: 0;
  margin-bottom: 0;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  opacity: 0.8;
  text-transform: uppercase;
}

.capa h1 {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  line-height: 1.2;
}

.subtitulo {
  margin-top: 0;
  margin-bottom: 0;
  opacity: 0.9;
}

/* Sem rede, o subtítulo fica só com o ano, sem o separador. */
.rede:not(:empty)::after {
  content: ' · ';
}

.encerramento {
  margin-top: 3rem;
  padding-block: 2rem;
}

.encerramento h2 {
  margin-top: 0;
  color: #fff;
}

.encerramento a {
  color: #fff;
}

.contatos {
  padding: 0;
  list-style: none;
}

/* O conteúdo */

main {
  max-width: 46rem;
  margin: 0 auto;
  padding: 1.5rem;
}

h2,
h3,
h4,
h5,
h6 {
  margin: 2rem 0 0.5rem;
  color: var(--marinho);
  line-height: 1.3;
}

h2 {
  font-size: 1.6rem;
}

h3 {
  padding-bottom: 0.25rem;
  border-bottom: 2px solid var(--borda);
  font-size: 1.35rem;
}

h4 {
  font-size: 1.2rem;
}

h5 {
  font-size: 1.05rem;
}

h6 {
  font-size: 1rem;
}

section[id] {
  scroll-margin-top: 1rem;
}

.resumo {
  margin-top: 0;
  color: var(--texto-suave);
  font-size: 1.05rem;
}

img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1rem 0;
  border: 1px solid var(--borda);
  border-radius: 6px;
}

figure {
  margin: 1rem 0;
}

figure img {
  margin: 0;
}

figcaption,
.legenda {
  margin-top: 0.35rem;
  color: var(--texto-suave);
  font-size: 0.9rem;
  white-space: pre-wrap;
}

/* Nomes de botões e telas da plataforma. */
.ui {
  padding: 0 0.3em;
  border-radius: 4px;
  background: var(--marinho-claro);
  color: var(--marinho);
  font-weight: 600;
}

.aviso {
  margin: 1.25rem 0;
  padding: 0.75rem 1rem;
  border-left: 4px solid var(--lembrete);
  border-radius: 0 6px 6px 0;
  background: var(--lembrete-fundo);
}

.aviso > :first-child {
  margin-top: 0;
}

.aviso > :last-child {
  margin-bottom: 0;
}

.aviso.atencao {
  border-left-color: var(--atencao);
  background: var(--atencao-fundo);
}

.aviso.sucesso {
  border-left-color: var(--sucesso);
  background: var(--sucesso-fundo);
}

.aviso.importante {
  border-left-color: var(--importante);
  background: var(--importante-fundo);
}

table {
  display: block;
  width: 100%;
  margin: 1rem 0;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 0.95rem;
}

th,
td {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--borda);
  text-align: left;
  vertical-align: top;
}

th {
  background: var(--marinho-claro);
  color: var(--marinho);
}

/* A agenda ("Funcionalidades"), montada pelo sumário. */

.agenda {
  margin: 1rem 0 2rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  background: var(--marinho-claro);
}

.agenda h2 {
  margin-top: 0;
}

.sumario ol {
  margin: 0.25rem 0;
  padding-left: 1.25rem;
}

.sumario > ol > li {
  font-weight: 600;
}

.sumario ol ol {
  font-weight: 400;
}

.sumario a {
  color: var(--marinho);
  text-decoration: none;
}

.sumario a:hover {
  text-decoration: underline;
}

@media (max-width: 600px) {
  main {
    padding: 1rem;
  }

  .capa,
  .encerramento {
    padding-inline: 1rem;
  }
}
```

E o exemplo fora do Prettier, em `.prettierignore`: os arquivos dele são dados, comparados byte a byte, e o `npm run format` reformataria o HTML e o CSS (o XML dos exemplos escapava só porque o Prettier não formata XML).

Troque:

<!-- prettier-ignore -->
```
tsconfig.*.json
.checks
```

por:

<!-- prettier-ignore -->
```
tsconfig.*.json
.checks
docs/examples
```

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

```
opened
30 assets, 13 configurações, avisos: 0
```

Esperado, `herby-generate.mts`:

```
completa-atibaia: generated
  60 arquivos: css/herby.css, index.html, product.xml, Slides por Feature/01 - Informações Gerais da Avaliação e Cronograma.pptx, Slides por Feature/06 - Acesso à Plataforma.pptx, Slides por Feature/07 - Gestão da Base de Dados.pptx, Slides por Feature/09 - Sincronização de Dados (Rede Estadual).pptx e 53 imagens
  index.html: idêntico ao esperado
```

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

```ts
// A aba Fragmentos com HTML (Fase 7), sobre uma pasta em memória: a conferência por formato, os
// IDs dos marcadores contra o modelo (conferidos de novo quando o modelo muda), o texto inicial
// de um .html e da moldura, e o aviso ao salvar com erro.
//   npx tsx --tsconfig tsconfig.web.json .checks/html-store-check.mts
import { readFileSync } from 'node:fs'
import { removeAttribute } from '@/application/editing/commands'
import { FragmentCheckerByFormat } from '@/application/fragments/fragment-checker-by-format'
import type { ProjectSession } from '@/application/project-session'
import { FragmentFiles } from '@/application/use-cases/fragment-files'
import { OpenFragment } from '@/application/use-cases/open-fragment'
import { SaveFragments } from '@/application/use-cases/save-fragments'
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { HtmlFragmentChecker } from '@/infrastructure/html/html-fragment-checker'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { XmlFragmentChecker } from '@/infrastructure/xml/xml-fragment-checker'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { fragmentTreePaths } from '@/ui/stores/fragments-actions'
import { createProjectStore } from '@/ui/stores/project-store'
import { NodeXmlValidator } from './generation-support.mts'
import { memoryFolder } from './memory-folder.mts'

const example = (path: string): string => readFileSync(`docs/examples/loja-online/${path}`, 'utf8')
const model = decodeFeatureModel(parseXmlRoot(example('model.xml')))
if (!model.ok) throw new Error('o exemplo não abriu')
const folder = memoryFolder({
  'model.xml': example('model.xml'),
  'docs/pagamento/pix.xml': example('docs/pagamento/pix.xml'),
  'docs/loja.html':
    '<h2>Loja {{loja.versao}}</h2>\n<p>{{mobile.plataforma}} {{carrinho.total}}</p>\n'
})
const session = (): ProjectSession => ({
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: { model: model.value, assets: EMPTY_ASSET_CATALOG, configurations: [] },
  hashes: { model: 'x', assets: null, configurations: {} }
})
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}
const checker = new FragmentCheckerByFormat({
  xml: new XmlFragmentChecker(new NodeXmlValidator()),
  html: new HtmlFragmentChecker()
})
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
const problems = (path: string): string => {
  const found = state().fragmentProblems.get(path)
  if (found === undefined) return '(não conferido)'
  return found.length === 0 ? 'ok' : found.map((p) => `linha ${p.line} ${p.message}`).join(' | ')
}
const LOJA = 'docs/loja.html'

await state().open()
await state().loadFragmentFiles()
log('árvore', fragmentTreePaths(state().fragmentFiles, state().fragmentDocuments).sort().join(' '))
await state().showFragment(LOJA)
log('problemas do .html', problems(LOJA))
await state().showFragment('docs/pagamento/pix.xml')
log('problemas do .xml', problems('docs/pagamento/pix.xml'))

console.log('— o modelo muda: loja perde o atributo versao')
log('comando', state().run(removeAttribute('loja', 'versao')) ? 'feito' : 'recusado')
await state().checkFragment(LOJA)
log('problemas do .html', problems(LOJA))
state().undo()
await state().checkFragment(LOJA)
log('depois de desfazer', problems(LOJA))

console.log('— arquivos novos')
log('novo .html', state().createFragment('docs/novo.html') ?? 'criado')
log('texto', JSON.stringify(state().fragmentDocuments.get('docs/novo.html')?.text))
log('nova moldura', state().createFragment('moldura.html') ?? 'criada')
log('texto', JSON.stringify(state().fragmentDocuments.get('moldura.html')?.text))
log('.htm', state().createFragment('docs/velho.htm') ?? 'criado')

console.log('— salvar com erro')
state().changeFragmentText('docs/novo.html', '<div>\n<p>sem fechar\n')
await state().save()
log('aviso', [...state().fragmentWarnings.values()].map((warning) => warning.message).join(' | '))
log('no disco', folder.show('docs/novo.html'))
```

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

```ts
import {
  autocompletion,
  completionKeymap,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { xml } from '@codemirror/lang-xml'
import { HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { lintGutter, lintKeymap, type Diagnostic } from '@codemirror/lint'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { EditorState, type Extension, type Text } from '@codemirror/state'
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  MatchDecorator,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { FileProblem } from '@/application/file-problem'
import { fragmentFormat } from '@/domain/fragments/fragment-format'
import { isFramePath } from '@/domain/pages/page-layout'

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
  'Control character': 'Caractere de controle',
  Completions: 'Sugestões'
}

/**
 * As cores vêm das variáveis do tema (index.css), que mudam no tema escuro. O HTML usa as
 * mesmas do XML, e o CSS e o JavaScript de dentro dele, as mais próximas.
 */
const COLORS = HighlightStyle.define([
  { tag: [tags.tagName, tags.angleBracket], color: 'var(--xml-tag)' },
  { tag: [tags.attributeName, tags.propertyName], color: 'var(--xml-attribute)' },
  {
    tag: [tags.attributeValue, tags.string, tags.special(tags.string)],
    color: 'var(--xml-string)'
  },
  { tag: [tags.character, tags.number], color: 'var(--xml-entity)' },
  { tag: [tags.blockComment, tags.lineComment], color: 'var(--xml-comment)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.documentMeta, tags.keyword], color: 'var(--xml-meta)' },
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
  '.cm-panels': { color: 'var(--foreground)', backgroundColor: 'var(--muted)' },
  '.cm-marker': {
    color: 'var(--xml-meta)',
    backgroundColor: 'color-mix(in oklch, var(--xml-meta) 12%, transparent)',
    borderRadius: '3px'
  },
  '.cm-tooltip': { color: 'var(--foreground)', backgroundColor: 'var(--popover)' }
})

/** Os marcadores, como `{{loja.versao}}` e `\{{`, com cor própria (Fase 7). */
const MARKERS = new MatchDecorator({
  regexp: /\\?\{\{[^{}\n]*\}\}|\\\{\{/g,
  decoration: Decoration.mark({ class: 'cm-marker' })
})
const markerHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = MARKERS.createDeco(view)
    }
    update(update: ViewUpdate): void {
      this.decorations = MARKERS.updateDeco(update, this.decorations)
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

/** Depois de `{{`, sugere os marcadores que valem neste arquivo. */
function markerCompletions(names: () => readonly string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const typed = context.matchBefore(/\{\{\s*[a-z0-9_.]*/)
    if (typed === null) return null
    const start = typed.from + typed.text.search(/[a-z0-9_.]*$/)
    const closed = context.state.sliceDoc(context.pos, context.pos + 2) === '}}'
    return {
      from: start,
      options: names().map((label) => ({ label, apply: closed ? label : `${label}}}` })),
      validFor: /^[a-z0-9_.]*$/
    }
  }
}

export interface FragmentEditorOptions {
  readonly readOnly: boolean
  /** O texto mudou: digitação, colar, desfazer… */
  readonly onChange: (text: string) => void
  /** Os marcadores de atributo do modelo (`feature.atributo`), lidos na hora da sugestão. */
  readonly attributeMarkers: () => readonly string[]
}

/**
 * O estado do CodeMirror para um fragmento: o texto, o histórico de desfazer e a seleção. A
 * linguagem vem da extensão; num `.html`, os marcadores têm cor e sugestão.
 */
export function createFragmentEditorState(
  path: string,
  text: string,
  options: FragmentEditorOptions
): EditorState {
  const isHtml = fragmentFormat(path) === 'html'
  const reserved = isFramePath(path) ? ['produto', 'conteudo', 'sumario'] : ['produto']
  // Uma fonte só por estado: o CodeMirror reconhece a fonte pela identidade da função, e uma
  // função nova a cada consulta faria ele descartar a resposta da anterior.
  const markerSource = markerCompletions(() => [...options.attributeMarkers(), ...reserved])
  const language: Extension[] = isHtml
    ? [
        html(),
        markerHighlight,
        // Mais uma fonte de sugestões, ao lado das tags e dos atributos do próprio HTML.
        EditorState.languageData.of(() => [{ autocomplete: markerSource }]),
        autocompletion({ icons: false })
      ]
    : [xml()]
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
      language,
      syntaxHighlighting(COLORS),
      search({ top: true }),
      lintGutter(),
      keymap.of([
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...lintKeymap,
        ...completionKeymap,
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

- [ ] **Passo 5: O editor pelo caminho, em `src/renderer/src/ui/screens/fragments/FragmentEditor.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
import type { FragmentEditorStates } from './fragment-editor-states'
import { FragmentProblems } from './FragmentProblems'
import { createXmlEditorState, diagnosticsFor } from './xml-editor-setup'

interface FragmentEditorProps {
```

por:

<!-- prettier-ignore -->
```tsx
import type { FragmentEditorStates } from './fragment-editor-states'
import { FragmentProblems } from './FragmentProblems'
import { createFragmentEditorState, diagnosticsFor } from './fragment-editor-setup'

interface FragmentEditorProps {
```

Troque:

<!-- prettier-ignore -->
```tsx
  readonly states: FragmentEditorStates
  readonly onChange: (path: string, text: string) => void
}
```

por:

<!-- prettier-ignore -->
```tsx
  readonly states: FragmentEditorStates
  readonly onChange: (path: string, text: string) => void
  /** Os marcadores de atributo do modelo (`feature.atributo`), sugeridos nos fragmentos HTML. */
  readonly attributeMarkers: readonly string[]
}
```

Troque:

<!-- prettier-ignore -->
```tsx
  problems,
  states,
  onChange
}: FragmentEditorProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const shownPath = useRef<string | null>(null)
```

por:

<!-- prettier-ignore -->
```tsx
  problems,
  states,
  onChange,
  attributeMarkers
}: FragmentEditorProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  // O estado de cada arquivo dura mais que uma renderização: a sugestão lê o modelo da vez.
  const markers = useRef(attributeMarkers)
  useEffect(() => {
    markers.current = attributeMarkers
  }, [attributeMarkers])
  const view = useRef<EditorView | null>(null)
  const shownPath = useRef<string | null>(null)
```

Troque:

<!-- prettier-ignore -->
```tsx
    let next = states.get(path)
    if (next === undefined || next.doc.toString() !== text || next.readOnly !== readOnly) {
      next = createXmlEditorState(text, {
        readOnly,
        onChange: (changed) => onChange(path, changed)
      })
    }
```

por:

<!-- prettier-ignore -->
```tsx
    let next = states.get(path)
    if (next === undefined || next.doc.toString() !== text || next.readOnly !== readOnly) {
      next = createFragmentEditorState(path, text, {
        readOnly,
        onChange: (changed) => onChange(path, changed),
        attributeMarkers: () => markers.current
      })
    }
```

- [ ] **Passo 6: Os marcadores do modelo e o texto sem arquivo, em `src/renderer/src/ui/screens/fragments/FragmentsWorkspace.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
import { useEffect, useMemo } from 'react'
import { FilePlus2, RefreshCw } from 'lucide-react'
import type { Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
```

por:

<!-- prettier-ignore -->
```tsx
import { useEffect, useMemo } from 'react'
import { FilePlus2, RefreshCw } from 'lucide-react'
import { featuresInPreOrder } from '@/domain/feature-model/traversal'
import type { Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
```

Troque:

<!-- prettier-ignore -->
```tsx
    [project.assets]
  )
  const hasFiles = tree.folders.length > 0 || tree.files.length > 0
  const newFragment = (): void => onOpenDialog({ kind: 'new-fragment' })
```

por:

<!-- prettier-ignore -->
```tsx
    [project.assets]
  )
  const attributeMarkers = useMemo(
    () =>
      featuresInPreOrder(project.model.root).flatMap((feature) =>
        feature.attributes.map((attribute) => `${feature.id}.${attribute.id}`)
      ),
    [project.model]
  )
  const hasFiles = tree.folders.length > 0 || tree.files.length > 0
  const newFragment = (): void => onOpenDialog({ kind: 'new-fragment' })
```

Troque:

<!-- prettier-ignore -->
```tsx
          <div className="max-w-prose space-y-3 p-6 text-sm text-muted-foreground">
            <p>
              Um fragmento é um arquivo XML de documentação. Vinculado a uma feature como asset, ele
              entra no produto gerado das configurações que selecionam a feature.
            </p>
            <p>Escolha um arquivo à esquerda ou crie um novo.</p>
```

por:

<!-- prettier-ignore -->
```tsx
          <div className="max-w-prose space-y-3 p-6 text-sm text-muted-foreground">
            <p>
              Um fragmento é um arquivo XML ou HTML. Vinculado a uma feature como asset, ele entra
              no produto gerado das configurações que selecionam a feature: o XML no product.xml, e
              o HTML na página index.html.
            </p>
            <p>
              A página usa a moldura.html da raiz do projeto, se houver, com {'{{conteudo}}'} onde
              entram as seções. Nos fragmentos HTML e na moldura, {'{{feature.atributo}}'} vira o
              valor do atributo na configuração.
            </p>
            <p>Escolha um arquivo à esquerda ou crie um novo.</p>
```

Troque:

<!-- prettier-ignore -->
```tsx
              states={editorStates}
              onChange={changeText}
            />
          </>
```

por:

<!-- prettier-ignore -->
```tsx
              states={editorStates}
              onChange={changeText}
              attributeMarkers={attributeMarkers}
            />
          </>
```

- [ ] **Passo 7: A moldura na barra, em `src/renderer/src/ui/screens/fragments/FragmentBar.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
import { Link2, Paperclip, Undo2 } from 'lucide-react'
import { isModified, type FragmentDocument } from '@/application/fragments/fragment-document'
import { assetLabel, type Asset } from '@/domain/assets/asset-catalog'
import { Button } from '@/ui/components/ui/button'
```

por:

<!-- prettier-ignore -->
```tsx
import { LayoutTemplate, Link2, Paperclip, Undo2 } from 'lucide-react'
import { isModified, type FragmentDocument } from '@/application/fragments/fragment-document'
import { assetLabel, type Asset } from '@/domain/assets/asset-catalog'
import { isFramePath } from '@/domain/pages/page-layout'
import { Button } from '@/ui/components/ui/button'
```

Troque:

<!-- prettier-ignore -->
```tsx
}

/** A barra acima do editor: o caminho, o vínculo (ou "Vincular…") e "Descartar alterações". */
export function FragmentBar({
  document,
```

por:

<!-- prettier-ignore -->
```tsx
}

/**
 * A barra acima do editor: o caminho, o vínculo (ou "Vincular…"; na moldura, "Moldura da
 * página", que não é asset) e "Descartar alterações".
 */
export function FragmentBar({
  document,
```

Troque:

<!-- prettier-ignore -->
```tsx
          {isModified(document) && <span title="Alterações não salvas"> •</span>}
        </code>
        {first !== undefined ? (
          <span
            data-fragment-link
```

por:

<!-- prettier-ignore -->
```tsx
          {isModified(document) && <span title="Alterações não salvas"> •</span>}
        </code>
        {isFramePath(document.path) ? (
          <span
            data-fragment-frame
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <LayoutTemplate className="size-3.5" />
            Moldura da página
          </span>
        ) : first !== undefined ? (
          <span
            data-fragment-link
```

- [ ] **Passo 8: A dica do caminho, em `src/renderer/src/ui/screens/fragments/FragmentDialogs.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
            />
            <p className="text-xs text-muted-foreground">
              Relativo à pasta do projeto, terminando em .xml.
            </p>
            {problem !== null && !typing && <p className="text-xs text-destructive">{problem}</p>}
```

por:

<!-- prettier-ignore -->
```tsx
            />
            <p className="text-xs text-muted-foreground">
              Relativo à pasta do projeto, terminando em .xml ou .html.
            </p>
            {problem !== null && !typing && <p className="text-xs text-destructive">{problem}</p>}
```

- [ ] **Passo 9: Os IDs dos marcadores e o aviso, em `src/renderer/src/ui/stores/fragments-actions.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import type { SaveFragmentsResult } from '@/application/use-cases/save-fragments'
import type { SaveOptions } from '@/application/use-cases/save-project'
import type { Result } from '@/domain/shared/result'
import type { ProjectState } from './project-store'
```

por:

<!-- prettier-ignore -->
```ts
import type { SaveFragmentsResult } from '@/application/use-cases/save-fragments'
import type { SaveOptions } from '@/application/use-cases/save-project'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { attributeIdsByFeature } from '@/domain/feature-model/traversal'
import { fragmentFormat } from '@/domain/fragments/fragment-format'
import { modelMarkerProblems } from '@/domain/pages/markers'
import type { Result } from '@/domain/shared/result'
import { lineAt } from '@/domain/shared/text-lines'
import type { ProjectState } from './project-store'
```

Troque:

<!-- prettier-ignore -->
```ts
  let lastListing = 0
  const lastCheck = new Map<string, number>()
  /** O texto da última conferência de cada fragmento, para não conferir o mesmo texto de novo. */
  const checkedText = new Map<string, string>()

  const setDocument = (document: FragmentDocument): void => {
```

por:

<!-- prettier-ignore -->
```ts
  let lastListing = 0
  const lastCheck = new Map<string, number>()
  /**
   * O texto e o modelo da última conferência de cada fragmento, para não conferir de novo o
   * mesmo texto com o mesmo modelo (os IDs dos marcadores dependem do modelo).
   */
  const checked = new Map<string, { readonly text: string; readonly model?: FeatureModel }>()
  const currentModel = (): FeatureModel | undefined => get().session?.project.model
  const isChecked = (path: string, text: string): boolean => {
    const last = checked.get(path)
    return last !== undefined && last.text === text && last.model === currentModel()
  }
  /** Os problemas do checker e, num fragmento HTML, os dos IDs dos marcadores contra o modelo. */
  const withModelProblems = (
    path: string,
    text: string,
    problems: readonly FileProblem[]
  ): FileProblem[] => {
    const model = currentModel()
    if (model === undefined || fragmentFormat(path) !== 'html') return [...problems]
    const markers = modelMarkerProblems(text, attributeIdsByFeature(model.root)).map(
      (problem): FileProblem => ({
        file: path,
        line: lineAt(text, problem.offset),
        severity: 'error',
        message: problem.message
      })
    )
    return [...problems, ...markers].sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
  }

  const setDocument = (document: FragmentDocument): void => {
```

Troque:

<!-- prettier-ignore -->
```ts
      const document = get().fragmentDocuments.get(path)
      if (session === null || document === undefined) return
      if (get().fragmentProblems.has(path) && checkedText.get(path) === document.text) return
      const check = (lastCheck.get(path) ?? 0) + 1
      lastCheck.set(path, check)
```

por:

<!-- prettier-ignore -->
```ts
      const document = get().fragmentDocuments.get(path)
      if (session === null || document === undefined) return
      if (get().fragmentProblems.has(path) && isChecked(path, document.text)) return
      const check = (lastCheck.get(path) ?? 0) + 1
      lastCheck.set(path, check)
```

Troque:

<!-- prettier-ignore -->
```ts
      if (!get().fragmentDocuments.has(path)) return
      const all = new Map(get().fragmentProblems)
      all.set(path, problems)
      checkedText.set(path, document.text)
      set({ fragmentProblems: all })
    },
```

por:

<!-- prettier-ignore -->
```ts
      if (!get().fragmentDocuments.has(path)) return
      const all = new Map(get().fragmentProblems)
      all.set(path, withModelProblems(path, document.text, problems))
      checked.set(path, { text: document.text, model: currentModel() })
      set({ fragmentProblems: all })
    },
```

Troque:

<!-- prettier-ignore -->
```ts
        const found = result.checked.get(path) ?? []
        if (current.text === written.text) {
          problems.set(path, found)
          checkedText.set(path, written.text)
        }
        if (found.length === 0) warnings.delete(path)
```

por:

<!-- prettier-ignore -->
```ts
        const found = result.checked.get(path) ?? []
        if (current.text === written.text) {
          problems.set(path, withModelProblems(path, written.text, found))
          checked.set(path, { text: written.text, model: currentModel() })
        }
        if (found.length === 0) warnings.delete(path)
```

Troque:

<!-- prettier-ignore -->
```ts
            ...found[0],
            severity: 'warning',
            message: `Salvo com erro de XML: ${found[0].message}`
          })
        }
```

por:

<!-- prettier-ignore -->
```ts
            ...found[0],
            severity: 'warning',
            message: `Salvo com erro de ${fragmentFormat(path) === 'html' ? 'HTML' : 'XML'}: ${found[0].message}`
          })
        }
```

E o comentário das cores, em `src/renderer/src/ui/app/index.css`:

Troque:

<!-- prettier-ignore -->
```css
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  /* Cores do editor de fragmentos (xml-editor-setup.ts). */
  --xml-tag: oklch(0.46 0.16 262);
  --xml-attribute: oklch(0.52 0.13 55);
```

por:

<!-- prettier-ignore -->
```css
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  /* Cores do editor de fragmentos (fragment-editor-setup.ts), no XML e no HTML. */
  --xml-tag: oklch(0.46 0.16 262);
  --xml-attribute: oklch(0.52 0.13 55);
```

- [ ] **Passo 10: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/html-store-check.mts
```

Esperado:

```
árvore                               → docs/loja.html docs/pagamento/pix.xml
problemas do .html                   → linha 2 A feature carrinho não existe no modelo.
problemas do .xml                    → ok
— o modelo muda: loja perde o atributo versao
comando                              → feito
problemas do .html                   → linha 1 A feature loja não tem o atributo versao. | linha 2 A feature carrinho não existe no modelo.
depois de desfazer                   → linha 2 A feature carrinho não existe no modelo.
— arquivos novos
novo .html                           → criado
texto                                → ""
nova moldura                         → criada
texto                                → "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>{{produto}}</title>\n</head>\n<body>\n{{conteudo}}\n</body>\n</html>\n"
.htm                                 → O arquivo precisa terminar em .xml ou .html.
— salvar com erro
aviso                                → Salvo com erro de HTML: A tag <div> é aberta aqui e não é fechada neste arquivo.
no disco                             → "<div>\n<p>sem fechar\n"
```

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

```bash
#!/usr/bin/env bash
# Prepara uma cópia limpa do exemplo, abre o app, roda um roteiro de interface e fecha o app.
# Uso: bash .checks/run-ui.sh <app.exe | dev> <roteiro> [argumentos extras do roteiro...]
# Com EXAMPLE=herby, a cópia é do exemplo herby (Fase 7), em .checks/herby-ui.
set -u
app="$1"; script="$2"; shift 2
example="${EXAMPLE:-loja-online}"
copy=.checks/loja-ui
[ "$example" = "herby" ] && copy=.checks/herby-ui
rm -rf .checks/ui-data "$copy" && mkdir -p .checks/ui-data
cp -r "docs/examples/$example" "$copy"
if [ "$script" = ".checks/configurador-ui.mjs" ]; then
  cat > .checks/loja-ui/configurations/conflito.xml <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<configuration xmlns="urn:mdd:configuration" schemaVersion="1" name="Conflito">
  <decision feature="catalogo" state="deselected"/>
  <decision feature="busca" state="selected"/>
</configuration>
XML
fi
dir="$(cygpath -w "$PWD/$copy")"
node -e "require('fs').writeFileSync('.checks/ui-data/recent-projects.json', JSON.stringify([{ rootPath: process.argv[1], name: process.argv[2] }]))" "$dir" "$(basename "$copy")"
if [ "$app" = "dev" ]; then exe=./node_modules/electron/dist/electron.exe; first=.; else exe="$app"; first=; fi
"$exe" $first --inspect=9229 --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/ui-data")" > /dev/null 2>&1 &
for i in $(seq 1 30); do curl -s http://127.0.0.1:9333/json > /dev/null 2>&1 && break; sleep 1; done
# Logo depois de um build, a tela inicial demora mais: espera a lista de recentes aparecer.
node -e "import('./.checks/cdp.mjs').then(async ({ connect }) => { const ui = await connect(9333); await ui.waitFor(\"document.querySelector('main section ul button') !== null\", 30000); ui.close() })"
node "$script" 9333 "$@" "$dir"
node .checks/quit.mjs 9333
sleep 2
```

- [ ] **Passo 14: Escrever o roteiro `.checks/paginas-ui.mjs`**

```js
// Roteiro das páginas HTML com entrada real (Fase 7), sobre uma cópia do exemplo herby:
// o editor de HTML, os marcadores (cor, sugestão e IDs), a moldura, o fragmento novo e a geração.
// Uso: EXAMPLE=herby bash .checks/run-ui.sh <app.exe | dev> .checks/paginas-ui.mjs 9229
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, log, sleep } from './cdp.mjs'

const [port, , projectDir] = process.argv.slice(2)
const ui = await connect(port)
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
const { click, fill, text, js, send, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))

const VIEW = `document.querySelector('.cm-content').cmTile.root.view`
const editorLine = (line) => js(`${VIEW}.state.doc.line(${line}).text`)
const paths = () =>
  js(`[...document.querySelectorAll('[data-fragment-path]')].map((b) => b.dataset.fragmentPath)`)
const problems = () => text('[data-fragment-problems]')
const bar = () =>
  js(
    `document.querySelector('[data-fragment-bar]')?.parentElement.innerText.replace(/\\s+/g, ' ').trim()`
  )
const dialog = () =>
  js(
    `document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '(sem diálogo)'`
  )
const banner = () =>
  js(
    `document.querySelector('[data-banner=generated]')?.innerText.replace(/\\s+/g, ' ').replace(/\\d{2}:\\d{2}/, 'HH:MM').trim() ?? '(sem faixa)'`
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
/** Clica no editor logo depois do texto `needle`. */
const clickAfter = async (needle) => {
  const box = await js(`(() => {
    const view = ${VIEW}
    const found = view.state.doc.toString().indexOf(${JSON.stringify(needle)})
    if (found < 0) return null
    const at = view.coordsAtPos(found + ${needle.length})
    return { x: at.left, y: (at.top + at.bottom) / 2 }
  })()`)
  if (box === null) throw new Error(`não achei ${needle} no editor`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y })
  await mouse('mousePressed', box.x, box.y, 1)
  await mouse('mouseReleased', box.x, box.y, 1)
  await sleep(200)
}
const type = async (content) => {
  await send('Input.insertText', { text: content })
  await sleep(400)
}
const key = async (keyName, code, vk, modifiers = 0) => {
  const base = { key: keyName, code, windowsVirtualKeyCode: vk, modifiers }
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  await sleep(200)
}
const settle = () => sleep(1500)
const discard = async () => {
  await click({ startsWith: 'Descartar alterações' })
  await click({ text: 'Descartar' })
  await waitFor(`document.querySelector('[role=dialog]') === null`)
}
/** A cor calculada de um trecho do editor, comparada com a de uma variável do tema. */
const colorOf = (needle, variable) =>
  js(`(() => {
    const span = [...document.querySelectorAll('.cm-content span')].find((s) => s.innerText === ${JSON.stringify(needle)})
    const probe = document.createElement('span')
    probe.style.color = 'var(${variable})'
    document.body.append(probe)
    const expected = getComputedStyle(probe).color
    probe.remove()
    return span ? (getComputedStyle(span).color === expected ? '${variable}' : getComputedStyle(span).color) : '(não achei)'
  })()`)

// 1. A aba Fragmentos com os .html e a moldura
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Fragmentos' })
await waitFor(`document.querySelectorAll('[data-fragment-path]').length > 0`)
const listed = await paths()
log(
  '1. árvore',
  `${listed.length} arquivos, ${listed.filter((path) => path.endsWith('.html')).length} .html, moldura: ${listed.includes('moldura.html') ? 'sim' : 'não'}`
)

// 2. Um fragmento HTML: realce, marcador e conferência
await click('[data-fragment-path="fragmentos/plataforma.html"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Como funciona')`)
await settle()
log('2. barra', await bar())
log('   cor da tag h2', await colorOf('h2', '--xml-tag'))
log(
  '   marcadores com cor',
  await js(`[...document.querySelectorAll('.cm-marker')].map((m) => m.innerText).join(' ')`)
)
log('   problemas', await problems())

// 3. A sugestão depois de {{
await clickAfter('</h2>')
await type(' {{herby.contato_w')
await waitFor(`document.querySelector('.cm-tooltip-autocomplete') !== null`)
log(
  '3. sugestões',
  await js(
    `[...document.querySelectorAll('.cm-tooltip-autocomplete li')].map((li) => li.innerText).join(' | ')`
  )
)
await key('Enter', 'Enter', 13)
log('   linha 1', await editorLine(1))

// 4. Um ID que não existe
await type(' {{herby.nada}}')
await settle()
log('4. problemas', await problems())
await discard()
log('   depois de descartar', await editorLine(1))

// 5. Uma tag que fica aberta
await click('[data-fragment-path="fragmentos/acesso-plataforma.html"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Link de acesso')`)
await clickAfter('</section>')
for (let count = 0; count < '</section>'.length; count++) await key('Backspace', 'Backspace', 8)
await settle()
log('5. problemas', await problems())
await discard()
await settle()
log('   depois de descartar', await problems())

// 6. A moldura
await click('[data-fragment-path="moldura.html"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('{{conteudo}}')`)
await settle()
log('6. barra', await bar())
log('   problemas', await problems())

// 7. Fragmento novo: .htm recusado, .html começa vazio
await click({ text: 'Novo fragmento' })
await fill('#fragment-path', 'fragmentos/velho.htm')
log('7. .htm', await dialog())
await fill('#fragment-path', 'fragmentos/novo.html')
await click({ text: 'Criar' })
await waitFor(`document.querySelector('[data-fragment-path="fragmentos/novo.html"]') !== null`)
await settle()
log('   editor', JSON.stringify(await js(`${VIEW}.state.doc.toString()`)))
log('   problemas', await problems())
await discard()

// 8. Gerar completa-atibaia
await click({ text: 'Configurações' })
await click('[data-configuration-key="completa-atibaia"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await click({ text: 'Gerar produto' })
await waitFor(`document.querySelector('[data-banner=generated]') !== null`, 60000)
log('8. faixa', await banner())
const page = file('saida/completa-atibaia/index.html')
const expected = 'docs/examples/produto-esperado/herby-completa-atibaia/index.html'
log(
  '   index.html',
  existsSync(page)
    ? readFileSync(page).equals(readFileSync(expected))
      ? 'idêntico ao esperado'
      : 'DIFERENTE do esperado'
    : '(não existe)'
)
const count = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce(
    (total, entry) => total + (entry.isDirectory() ? count(join(dir, entry.name)) : 1),
    0
  )
log('   arquivos na saída', count(file('saida/completa-atibaia')))
log('   título', await js('document.title'))
log('erros no console', errors.length === 0 ? 'nenhum' : errors.join(' | '))
ui.close()
```

- [ ] **Passo 15: Rodar os roteiros de interface** (combine com o usuário: abrem janelas na tela dele)

```bash
npm run build
EXAMPLE=herby bash .checks/run-ui.sh dev .checks/paginas-ui.mjs 9229
```

Esperado:

```
1. árvore                            → 24 arquivos, 24 .html, moldura: sim
2. barra                             → fragmentos/plataforma.html Herby · herby Descartar alterações
   cor da tag h2                     → --xml-tag
   marcadores com cor                → {{herby.produto}}
   problemas                         → Nenhum problema: o fragmento pode entrar num produto.
3. sugestões                         → herby.contato_whatsapp
   linha 1                           → <h2>{{herby.produto}}</h2> {{herby.contato_whatsapp}}
4. problemas                         → linha 1 A feature herby não tem o atributo nada.
   depois de descartar               → <h2>{{herby.produto}}</h2>
5. problemas                         → linha 4 A tag <section> é aberta aqui e não é fechada neste arquivo.
   depois de descartar               → Nenhum problema: o fragmento pode entrar num produto.
6. barra                             → moldura.html Moldura da página Descartar alterações
   problemas                         → Nenhum problema: o fragmento pode entrar num produto.
7. .htm                              → Novo fragmento O arquivo é criado ao salvar, com as pastas que faltarem. Caminho Relativo à pasta do projeto, terminando em .xml ou .html. O arquivo precisa terminar em .xml ou .html. Cancelar Criar Fechar
   editor                            → ""
   problemas                         → Nenhum problema: o fragmento pode entrar num produto.
8. faixa                             → Produto gerado em saida/completa-atibaia/ às HH:MM Abrir pasta
   index.html                        → idêntico ao esperado
   arquivos na saída                 → 60
   título                            → Herby — mdd
erros no console                     → nenhum
app fechado
```

Regressão, uma rodada por vez, com uns segundos de pausa:

```bash
bash .checks/run-ui.sh dev .checks/fragmentos-ui.mjs 9229
bash .checks/run-ui.sh dev .checks/geracao-ui.mjs 9229
bash .checks/run-ui.sh dev .checks/assets-ui.mjs 9229
bash .checks/run-ui.sh dev .checks/configurador-ui.mjs
bash .checks/run-ui.sh dev .checks/ui-check.mjs
```

Esperado: as mesmas saídas das fases anteriores, com uma única diferença, na linha 27 do `fragmentos-ui.mjs`, onde a dica do diálogo passa a dizer "terminando em .xml ou .html":

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
    configurations/x.xml             → Novo fragmento O arquivo é criado ao salvar, com as pastas que faltarem. Caminho Relativo à pasta do projeto, terminando em .xml ou .html. A pasta configurations/ é das configurações. Cancelar Criar Fechar
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

Prepare uma cópia do exemplo em `.checks/aceitacao-herby` (`cp -r docs/examples/herby .checks/aceitacao-herby`; a `.checks/aceitacao-manual/` já tem a cópia do `loja-online`, e o herby dentro dela apareceria no projeto da loja). Com o `dist/win-unpacked/mdd.exe`, o usuário:

1. abre a cópia, vai à aba Fragmentos e abre `fragmentos/plataforma.html`: o realce de HTML e o marcador `{{herby.produto}}` com cor própria;
2. digita `{{herby.` numa linha e vê a lista de sugestões; escolhe uma com Enter;
3. na aba Configurações, abre `Completa Atibaia` e clica em "Gerar produto";
4. abre `saida\completa-atibaia\index.html` no navegador: a capa azul com "Avaliação Formativa - SAEMA 2026" e "Atibaia · 2026", o sumário "Funcionalidades", as seções com as imagens e o rodapé com os contatos;
5. estreita a janela do navegador até a largura de um celular: o texto e as imagens se ajustam, sem rolagem lateral.

O tema escuro não entra: o app ainda não o liga. A aparência é o que só o usuário pode conferir.

- [ ] **Passo 4: O ADR 0010, `docs/adr/0010-paginas-html-como-segunda-saida.md`**

```markdown
# Páginas HTML como segunda saída da geração

Além do `product.xml`, a geração monta uma página, `saida/<nome>/index.html`, quando o projeto tem fragmentos HTML (Fase 7). Os fragmentos HTML são escritos à mão, em arquivos `.html` só com o conteúdo, e a página é a moldura do projeto (`moldura.html`, opcional) com as seções das features selecionadas. O app continua sem conhecer vocabulário nenhum: o HTML é o próprio formato de saída. A página é mais um `ProductDeriver` (`HtmlPageDeriver`), ao lado do `XmlProductDeriver`, e o `CombinedProductDeriver` junta os dois sem mudar a porta.

## Considered Options

- **Converter os fragmentos XML em HTML**, com uma folha XSLT (ou um mapeamento) guardada no projeto. O XML continuaria a fonte, mas cada projeto teria de escrever e manter a conversão, e o app precisaria de uma biblioteca de XSLT. No herby, o exemplo desta fase, o XML não alimentava mais nada, e ele passou a ter o HTML como fonte.
- **XHTML** (HTML com a sintaxe rígida do XML), embutido no `product.xml`. Obrigaria a escrever `<br/>` e a fechar toda tag, sem ganho.

## Consequences

- **Os marcadores são a exceção ao "fragmento intacto" (ADR 0006), só no HTML.** `{{feature.atributo}}` vira o valor do atributo, com o escape do HTML; `{{produto}}`, o nome da configuração; `{{conteudo}}` e `{{sumario}}`, na moldura, as seções e o sumário. O resto do texto entra como o autor escreveu: a geração troca só os trechos dos marcadores e dos caminhos. O fragmento XML continua entrando intacto no `product.xml`.
- **Os caminhos dos fragmentos HTML são relativos à pasta do arquivo**, como os do XML com o `xml:base`. A geração os reescreve para o `index.html`, que fica na raiz da pasta do produto, nos atributos `src`, `href`, `srcset` e `poster`, porque ali o app sabe quais atributos são links (no XML, não sabe).
- **Os arquivos citados vão para a saída sem precisar de asset.** Uma imagem citada por um fragmento entra quando o fragmento entra. Os recursos continuam servindo para o que não é citado, como um `.css` ancorado numa feature, que entra sozinho no `<head>` quando ela está selecionada.
- **A conferência de um fragmento HTML usa o parse5**, o parser de HTML do padrão, com as posições no texto. O HTML normal é aceito (`<br>`, `&nbsp;`, atributo sem aspas), mas uma tag aberta e não fechada no arquivo é problema, porque engoliria as seções seguintes da página. O parse5 não acusa as tags que descarta (um `</section>` a mais, um `<body>` num fragmento): elas são achadas pelo que a árvore não cobre.
- **O editor de fragmentos abre também `.html`**, com o `@codemirror/lang-html`, a cor dos marcadores e a sugestão depois de `{{` (ADR 0009). O `.css` e o `.js` continuam abrindo fora do app.
- **O `index.html` não leva a hora da geração**: duas gerações iguais dão arquivos idênticos, e a aceitação compara byte a byte.
- A visualização da Fase 8 reaproveita o `HtmlPageDeriver`, montando a mesma página na memória.
```

- [ ] **Passo 5: Os termos novos, em `CONTEXT.md`**

Troque:

<!-- prettier-ignore -->
```markdown

**Fragmento**:
Asset que é um arquivo XML bem-formado e é embutido no produto gerado.
_Avoid_: trecho, snippet, capítulo
```

por:

<!-- prettier-ignore -->
```markdown

**Fragmento**:
Asset que é um arquivo XML bem-formado ou um trecho de HTML, e é embutido no produto gerado: o XML no `product.xml`, o HTML na página.
_Avoid_: trecho, snippet, capítulo
```

Troque:

<!-- prettier-ignore -->
```markdown

**Produto gerado**:
Pasta de saída com o `product.xml` e os recursos copiados, correspondente a uma configuração.
_Avoid_: produto (sem qualificador), release, pacote

**Seção**:
```

por:

<!-- prettier-ignore -->
```markdown

**Produto gerado**:
Pasta de saída com o `product.xml`, a página (quando o projeto tem fragmentos HTML) e os arquivos copiados, correspondente a uma configuração.
_Avoid_: produto (sem qualificador), release, pacote

**Página**:
O `index.html` do produto gerado: a moldura com as seções das features selecionadas, montada a partir dos fragmentos HTML.
_Avoid_: site, template, documento HTML

**Moldura**:
O arquivo `moldura.html` na raiz do projeto, com o que fica em volta das seções na página: o `<head>`, o cabeçalho e o rodapé.
_Avoid_: modelo (é o Feature Model), template, layout

**Marcador**:
Trecho `{{…}}` de um fragmento HTML ou da moldura que a geração troca: pelo valor de um atributo (`{{feature.atributo}}`), pelo nome da configuração (`{{produto}}`), pelas seções (`{{conteudo}}`) ou pelo sumário (`{{sumario}}`).
_Avoid_: variável, placeholder, tag

**Sumário**:
Lista aninhada de links para as seções da página, com as features selecionadas que têm conteúdo.
_Avoid_: índice, agenda, menu

**Seção**:
```

- [ ] **Passo 6: A Fase 7 na SPEC, em `docs/SPEC.md`**

Troque:

<!-- prettier-ignore -->
```markdown
4. **Gerar** o `product.xml` de documentação de cada produto, que ferramentas externas convertem depois para as mídias finais.
5. **Editar os fragmentos** dentro do app, num editor de XML (Fase 6).

A arquitetura é em camadas, com SOLID e Clean Code. Não há testes automatizados na primeira versão (ADR 0008); a aceitação de cada fase é manual, com o projeto de exemplo (§9).
```

por:

<!-- prettier-ignore -->
```markdown
4. **Gerar** o `product.xml` de documentação de cada produto, que ferramentas externas convertem depois para as mídias finais.
5. **Editar os fragmentos** dentro do app, num editor de XML (Fase 6).
6. **Gerar a página** `index.html` de cada produto, a partir de fragmentos em HTML (Fase 7, ADR 0010).

A arquitetura é em camadas, com SOLID e Clean Code. Não há testes automatizados na primeira versão (ADR 0008); a aceitação de cada fase é manual, com o projeto de exemplo (§9).
```

Troque:

<!-- prettier-ignore -->
```markdown
**Depois da primeira versão:**

- Fase 6: editor de fragmentos, para criar e editar os fragmentos do projeto dentro do app, com realce de XML e a conferência da geração (ADR 0009). Ele não edita `model.xml`, `assets.xml` nem as configurações como texto, não renomeia nem exclui arquivos e só abre `.xml`.

**Fora da primeira versão (fase "Depois"):** clones, restrições com atributos, análises do modelo (`ModelAnalyzer`: features mortas etc.), variabilidade anotativa, renderers por mídia, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes automatizados.
```

por:

<!-- prettier-ignore -->
```markdown
**Depois da primeira versão:**

- Fase 6: editor de fragmentos, para criar e editar os fragmentos do projeto dentro do app, com realce de XML e a conferência da geração (ADR 0009). Ele não edita `model.xml`, `assets.xml` nem as configurações como texto, não renomeia nem exclui arquivos e só abre `.xml` e, desde a Fase 7, `.html`.
- Fase 7: páginas HTML (ADR 0010). Fragmentos em HTML, a moldura, os marcadores de atributo e o sumário; a geração passa a montar também o `index.html`. O desenho está em [docs/superpowers/specs/2026-09-28-fase-7-paginas-html-design.md](superpowers/specs/2026-09-28-fase-7-paginas-html-design.md).
- Fase 8: a aba Páginas, com a página ao vivo. As decisões já tomadas estão no fim do desenho da Fase 7.

**Fora da primeira versão (fase "Depois"):** clones, restrições com atributos, análises do modelo (`ModelAnalyzer`: features mortas etc.), variabilidade anotativa, renderers por mídia, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes automatizados.
```

Troque:

<!-- prettier-ignore -->
````markdown
  assets.xml                 opcional — ausente = nenhum asset (criado ao salvar)
  configurations/*.xml       opcional — uma configuração por arquivo
  saida/<configuração>/      criado pela geração
  …                          fragmentos e recursos, em qualquer subpasta
```
````

por:

<!-- prettier-ignore -->
````markdown
  assets.xml                 opcional — ausente = nenhum asset (criado ao salvar)
  configurations/*.xml       opcional — uma configuração por arquivo
  moldura.html               opcional — a moldura da página (Fase 7)
  saida/<configuração>/      criado pela geração: product.xml e, com fragmentos HTML, index.html
  …                          fragmentos (.xml e .html) e recursos, em qualquer subpasta
```
````

Troque:

<!-- prettier-ignore -->
```markdown
### 4.3 Assets

Um asset tem `id` único (no mesmo formato de ID de feature), `kind` (`fragment` ou `resource`), `path`, `anchor` (ID de feature) e, opcionalmente, `name` e `condition`. O `id` é sugerido pelo nome do arquivo ao vincular (`pix-fluxo.svg` → `pix_fluxo`) e pode ser ajustado só nesse momento; depois não muda, nem ao trocar o arquivo (ADR 0004).

**Invariantes:** A1 — `path` é relativo e fica dentro do projeto. A2 — `anchor` existe no modelo. A3 — `condition`, se existir, é uma expressão válida que só referencia features existentes.
```

por:

<!-- prettier-ignore -->
```markdown
### 4.3 Assets

Um asset tem `id` único (no mesmo formato de ID de feature), `kind` (`fragment` ou `resource`), `path`, `anchor` (ID de feature) e, opcionalmente, `name` e `condition`. Um fragmento é XML (`.xml`) ou HTML (`.html`), pela extensão (Fase 7). O `id` é sugerido pelo nome do arquivo ao vincular (`pix-fluxo.svg` → `pix_fluxo`) e pode ser ajustado só nesse momento; depois não muda, nem ao trocar o arquivo (ADR 0004).

**Invariantes:** A1 — `path` é relativo e fica dentro do projeto. A2 — `anchor` existe no modelo. A3 — `condition`, se existir, é uma expressão válida que só referencia features existentes.
```

Troque:

<!-- prettier-ignore -->
```markdown

Referência de resultado: [docs/examples/produto-esperado/loja-basica/](examples/produto-esperado/loja-basica/). A comparação ignora espaços em branco e `generatedAt`.

### 4.5 Edição e evolução do modelo
```

por:

<!-- prettier-ignore -->
```markdown

Referência de resultado: [docs/examples/produto-esperado/loja-basica/](examples/produto-esperado/loja-basica/). A comparação ignora espaços em branco e `generatedAt`.

**A página** (Fase 7, ADR 0010). Quando o projeto tem pelo menos um asset fragmento `.html`, incluído ou não, a geração grava também `index.html` na pasta do produto. Os fragmentos HTML ficam fora do `product.xml`. As regras completas estão no desenho da Fase 7; em resumo:

- A página é a moldura (`moldura.html` na raiz, ou a moldura padrão) com `{{conteudo}}` trocado pelas seções: um `<section id="<feature>">` por feature selecionada, aninhado como no `product.xml`, com os fragmentos HTML na ordem do `assets.xml`. O texto de cada fragmento entra como está, sem recuo, com as quebras em LF; o `index.html` sai em UTF-8, sem BOM e sem a hora da geração.
- `{{feature.atributo}}` vira o valor final do atributo, escapado; `{{produto}}`, o nome da configuração; `{{sumario}}`, na moldura, uma lista aninhada de links para as features com conteúdo. `\{{` escreve `{{`. Um marcador de feature ou atributo que não existe é erro; de uma feature não selecionada, problema na geração.
- Os caminhos de `src`, `href`, `srcset` e `poster` são relativos à pasta do arquivo e são reescritos para a página. Todo arquivo do projeto citado assim é copiado, sem precisar de asset. Os `.css` e `.js` incluídos entram sozinhos antes do `</head>` e do `</body>`, sem repetir o que a moldura cita.
- A conferência de um fragmento HTML (a mesma do editor): UTF-8, erros de sintaxe do parser, tag aberta e não fechada no arquivo, as tags que o navegador descartaria (como um `</section>` a mais) e `<!doctype>`, `<html>`, `<head>` e `<body>` num fragmento.

Referência da página: [docs/examples/produto-esperado/herby-completa-atibaia/index.html](examples/produto-esperado/herby-completa-atibaia/index.html), comparada byte a byte.

### 4.5 Edição e evolução do modelo
```

Troque:

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

por:

<!-- prettier-ignore -->
```markdown
      assets/              Asset, AssetCatalog, inclusão
      generation/          GenerationPlan (§4.4 passo 1)
      fragments/           formato (XML ou HTML), caminho de um fragmento novo, formato do texto (BOM e quebra de linha), codificação
      pages/               a página: moldura, marcadores, caminhos citados, seções e sumário (Fase 7)
    application/           Importa só domain/.
      ports/               interfaces (§6.2)
      fragments/           FragmentDocument, o fragmento aberto no editor, e o checker por formato
      generation/          CombinedProductDeriver, que junta os formatos do produto
      commands/            EditorCommand, CommandHistory, comandos concretos
      use-cases/           abrir/salvar projeto, resolver configuração, gerar produto…
```

Troque:

<!-- prettier-ignore -->
```markdown
      electron/            adapters sobre window.mdd
      xml/                 codecs por arquivo, escritor determinístico, leitura com @xmldom/xmldom
      solver/              LogicSolverConstraintSolver + logic-solver.d.ts
    ui/                    React. Importa application/ e domain/; infrastructure/ só em ui/app/.
```

por:

<!-- prettier-ignore -->
```markdown
      electron/            adapters sobre window.mdd
      xml/                 codecs por arquivo, escritor determinístico, leitura com @xmldom/xmldom
      html/                leitura do HTML com o parse5, a conferência e a página (Fase 7)
      solver/              LogicSolverConstraintSolver + logic-solver.d.ts
    ui/                    React. Importa application/ e domain/; infrastructure/ só em ui/app/.
```

Troque:

<!-- prettier-ignore -->
```markdown
### 6.2 Ports (em `application/ports`)

| Port                                                                          | Responsabilidade                                                                                                                                                                                                                                        | Adapter v1                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `ProjectStorage`                                                              | Ler, escrever, listar, conferir (`stat`), copiar, renomear e remover arquivos e pastas dentro do projeto; renomear e apagar pastas só dentro de `saida/`. A escrita recebe o hash esperado para detectar alteração externa (§8).                        | `ElectronProjectStorage`                                    |
| `FeatureModelRepository`, `AssetCatalogRepository`, `ConfigurationRepository` | Carregar e salvar cada tipo de arquivo, devolvendo erros de leitura estruturados (§5).                                                                                                                                                                  | `Xml*Repository` (codecs + `ProjectStorage`)                |
| `ConstraintSolver`                                                            | Carregar uma `Formula` e responder a satisfatibilidade sob uma suposição (um literal), devolvendo uma solução. Cada resolução carrega a fórmula num solver novo (ADR 0002).                                                                             | `LogicSolverConstraintSolver`                               |
| `ProductDeriver`                                                              | Receber um `GenerationPlan` e a hora da geração, conferir as fontes e devolver os arquivos do produto (textos e cópias), ou todos os problemas. A pasta temporária e a troca ficam com o caso de uso `WriteProductFolder`, igual para qualquer formato. | `XmlProductDeriver`                                         |
| `AssetOpener`                                                                 | Abrir um arquivo no programa padrão do sistema.                                                                                                                                                                                                         | `ElectronAssetOpener`                                       |
| `OutputFolderOpener`                                                          | Abrir uma pasta gerada (`saida/<nome>`) no gerenciador de arquivos.                                                                                                                                                                                     | `ElectronOutputFolderOpener`                                |
| `ProjectFolderPicker`                                                         | Escolher a pasta do projeto.                                                                                                                                                                                                                            | `ElectronProjectFolderPicker`                               |
| `ProjectFilePicker`                                                           | Escolher um arquivo dentro do projeto, num diálogo que começa na raiz. Devolve o caminho relativo e recusa um arquivo de fora.                                                                                                                          | `ElectronProjectFilePicker`                                 |
| `XmlSchemaValidator`                                                          | Etapas 1 e 2 da leitura (§5): XML bem-formado e conforme o XSD. Sem schema, só XML bem-formado (fragmentos).                                                                                                                                            | `ElectronXmlSchemaValidator` (IPC → `xmllint-wasm` no main) |
| `FragmentChecker`                                                             | Conferir o texto de um fragmento como a geração confere (§4.4): a codificação, o XML bem-formado e a leitura com `@xmldom/xmldom`. Devolve os problemas, com a linha; lista vazia quando o fragmento pode entrar num produto.                           | `XmlFragmentChecker` (o `XmlProductDeriver` usa o mesmo)    |
| `Clock`                                                                       | Data e hora atuais (para `generatedAt`).                                                                                                                                                                                                                | `SystemClock`                                               |

### 6.3 Processo main e IPC
```

por:

<!-- prettier-ignore -->
```markdown
### 6.2 Ports (em `application/ports`)

| Port                                                                          | Responsabilidade                                                                                                                                                                                                                                                        | Adapter v1                                                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `ProjectStorage`                                                              | Ler, escrever, listar, conferir (`stat`), copiar, renomear e remover arquivos e pastas dentro do projeto; renomear e apagar pastas só dentro de `saida/`. A escrita recebe o hash esperado para detectar alteração externa (§8).                                        | `ElectronProjectStorage`                                                                       |
| `FeatureModelRepository`, `AssetCatalogRepository`, `ConfigurationRepository` | Carregar e salvar cada tipo de arquivo, devolvendo erros de leitura estruturados (§5).                                                                                                                                                                                  | `Xml*Repository` (codecs + `ProjectStorage`)                                                   |
| `ConstraintSolver`                                                            | Carregar uma `Formula` e responder a satisfatibilidade sob uma suposição (um literal), devolvendo uma solução. Cada resolução carrega a fórmula num solver novo (ADR 0002).                                                                                             | `LogicSolverConstraintSolver`                                                                  |
| `ProductDeriver`                                                              | Receber um `GenerationPlan` e a hora da geração, conferir as fontes e devolver os arquivos do produto (textos e cópias), ou todos os problemas. A pasta temporária e a troca ficam com o caso de uso `WriteProductFolder`, igual para qualquer formato.                 | `CombinedProductDeriver` (`XmlProductDeriver` e `HtmlPageDeriver`)                             |
| `AssetOpener`                                                                 | Abrir um arquivo no programa padrão do sistema.                                                                                                                                                                                                                         | `ElectronAssetOpener`                                                                          |
| `OutputFolderOpener`                                                          | Abrir uma pasta gerada (`saida/<nome>`) no gerenciador de arquivos.                                                                                                                                                                                                     | `ElectronOutputFolderOpener`                                                                   |
| `ProjectFolderPicker`                                                         | Escolher a pasta do projeto.                                                                                                                                                                                                                                            | `ElectronProjectFolderPicker`                                                                  |
| `ProjectFilePicker`                                                           | Escolher um arquivo dentro do projeto, num diálogo que começa na raiz. Devolve o caminho relativo e recusa um arquivo de fora.                                                                                                                                          | `ElectronProjectFilePicker`                                                                    |
| `XmlSchemaValidator`                                                          | Etapas 1 e 2 da leitura (§5): XML bem-formado e conforme o XSD. Sem schema, só XML bem-formado (fragmentos).                                                                                                                                                            | `ElectronXmlSchemaValidator` (IPC → `xmllint-wasm` no main)                                    |
| `FragmentChecker`                                                             | Conferir o texto de um fragmento como a geração confere (§4.4): no XML, a codificação, o XML bem-formado e a leitura com `@xmldom/xmldom`; no HTML, a conferência da página. Devolve os problemas, com a linha; lista vazia quando o fragmento pode entrar num produto. | `FragmentCheckerByFormat` (`XmlFragmentChecker` e `HtmlFragmentChecker`, os mesmos da geração) |
| `Clock`                                                                       | Data e hora atuais (para `generatedAt`).                                                                                                                                                                                                                                | `SystemClock`                                                                                  |

### 6.3 Processo main e IPC
```

Troque:

<!-- prettier-ignore -->
```markdown
- Cada linha mostra o tipo, o nome (ou o nome do arquivo), o caminho, a condição e o estado do arquivo (ok / ausente), com as ações abrir (desligada quando ausente), mover para cima ou para baixo dentro da âncora e desvincular (sem confirmação: tem desfazer, e o arquivo fica no disco).
- O painel edita nome, tipo, âncora e condição, e tem "Trocar arquivo…", que muda só o caminho. Trocar a âncora leva o asset para o fim da nova âncora.
- Para vincular, o arquivo é escolhido em um diálogo que começa na pasta do projeto. Um arquivo fora do projeto é recusado com a orientação de copiá-lo para dentro. Depois vem o diálogo com o tipo (sugerido pela extensão: `.xml` → fragmento, demais → recurso), o nome (opcional), o ID (sugerido pelo nome do arquivo e ajustável só ali) e a âncora.
- A condição usa o mesmo editor das restrições; vazio = sem condição. Uma expressão inválida não é gravada.
- O estado dos arquivos é conferido ao abrir o projeto, ao entrar na aba, quando a janela volta ao foco, depois de qualquer mudança nos assets (inclusive desfazer) e no botão "Atualizar".
```

por:

<!-- prettier-ignore -->
```markdown
- Cada linha mostra o tipo, o nome (ou o nome do arquivo), o caminho, a condição e o estado do arquivo (ok / ausente), com as ações abrir (desligada quando ausente), mover para cima ou para baixo dentro da âncora e desvincular (sem confirmação: tem desfazer, e o arquivo fica no disco).
- O painel edita nome, tipo, âncora e condição, e tem "Trocar arquivo…", que muda só o caminho. Trocar a âncora leva o asset para o fim da nova âncora.
- Para vincular, o arquivo é escolhido em um diálogo que começa na pasta do projeto. Um arquivo fora do projeto é recusado com a orientação de copiá-lo para dentro. Depois vem o diálogo com o tipo (sugerido pela extensão: `.xml` e `.html` → fragmento, demais → recurso), o nome (opcional), o ID (sugerido pelo nome do arquivo e ajustável só ali) e a âncora.
- A condição usa o mesmo editor das restrições; vazio = sem condição. Uma expressão inválida não é gravada.
- O estado dos arquivos é conferido ao abrir o projeto, ao entrar na aba, quando a janela volta ao foco, depois de qualquer mudança nos assets (inclusive desfazer) e no botão "Atualizar".
```

Troque:

<!-- prettier-ignore -->
```markdown
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
```

por:

<!-- prettier-ignore -->
```markdown
**Fragmentos** (Fase 6, ADR 0009):

- À esquerda, a árvore dos `.xml` e dos `.html` do projeto (inclusive a `moldura.html`), com as pastas todas abertas, as pastas antes dos arquivos e cada grupo em ordem alfabética. Ficam de fora `model.xml`, `assets.xml`, `configurations/` e `saida/`, os nomes começando com ponto (como `.git`) e as pastas sem nenhum `.xml`. Cada arquivo mostra `•` quando tem alteração não salva, "novo" quando ainda não existe no disco e um clipe quando é o arquivo de algum asset. No topo, **Novo fragmento** e **Atualizar**.
- No centro, o editor: realce de XML ou de HTML, pela extensão, números de linha, linha atual destacada, fechamento automático de tags, Tab para indentar (Esc e depois Tab tira o foco do editor) e Ctrl+F para buscar, com os textos em português. As cores vêm de variáveis do tema.
- Acima do editor, a barra do arquivo:
  - o caminho;
  - o vínculo ("Guia do PIX · `pag_pix`", com "+N" quando o arquivo é de mais de um asset) ou **Vincular a uma feature…**, ligado só quando o arquivo existe no disco, que abre o diálogo de vínculo da aba Assets com o caminho preenchido;
  - **Descartar alterações**, com confirmação: volta ao texto do disco, e um arquivo novo sai da lista.
- Num `.html`, os marcadores aparecem com cor própria, e depois de `{{` o editor sugere os `feature.atributo` do modelo, `produto` e, na moldura, `conteudo` e `sumario`. Um ID de marcador que não existe no modelo aparece entre os problemas, e é conferido de novo quando o modelo muda. Na moldura, a barra do arquivo mostra "Moldura da página" no lugar do vínculo (Fase 7).
- Abaixo do editor, os problemas do arquivo, cada um com a linha e a mensagem; clicar leva o cursor até a linha. As mesmas linhas ficam sublinhadas no editor, com a marca na margem. A conferência é a da geração (§4.4): roda ao abrir o arquivo e meio segundo depois da última tecla, e uma conferência que termina depois de outra mais nova é descartada.
- Um arquivo que não está em UTF-8 (pela declaração ou por bytes inválidos) abre só para leitura, com uma faixa que pede para salvá-lo em UTF-8 em outro editor. O app lê os arquivos como UTF-8, e os acentos já chegam trocados: gravar de volta os perderia.
- **Novo fragmento** pede o caminho, sugerindo a pasta do arquivo aberto. O caminho aceita `/` ou `\`, é gravado com `/` e adota a grafia das pastas que já existem (`Docs/Pagamento/cartao.xml` vira `docs/pagamento/cartao.xml`). É recusado, com o motivo, quando:
  - está vazio, é absoluto, tem `..` ou não termina em `.xml` nem em `.html`;
  - tem um trecho vazio (`docs//a.xml`), um caractere que o Windows não aceita (`< > : " | ? *`), um trecho terminado em ponto ou espaço, ou um trecho começando com ponto;
  - é `model.xml` ou `assets.xml`, ou fica em `configurations/` ou `saida/`;
  - já existe no disco ou entre os arquivos novos, sem diferenciar maiúsculas de minúsculas.

  Um `.xml` começa só com a declaração `<?xml version="1.0" encoding="UTF-8"?>` e uma linha em branco. O app não inventa um elemento raiz, porque a geração não impõe vocabulário (ADR 0006). Um `.html` começa vazio, e a `moldura.html` na raiz, com a moldura padrão (Fase 7). Como as configurações novas, o arquivo só chega ao disco no Ctrl+S, com as pastas que faltarem.

- Ctrl+Z e Ctrl+Y desfazem e refazem o texto. O histórico de cada arquivo dura enquanto o projeto está aberto, também ao trocar de arquivo ou de aba, e recomeça quando o texto é relido do disco (descartar, atualizar, recarregar). Os botões de desfazer e refazer do cabeçalho ficam desligados, e os atalhos de edição do modelo não valem.
```

Troque:

<!-- prettier-ignore -->
```markdown
- **Fragmentos** (Fase 6):
  - Só os fragmentos com alteração são gravados: abrir um arquivo e não mexer nunca o regrava. Cada um só é gravado se o disco ainda estiver como na última leitura, e um arquivo novo, se ainda não existir. Um fragmento alterado fora do app entra no mesmo diálogo de conflito; "Recarregar" relê o projeto, os fragmentos abertos saem da lista, e o exibido continua, relido do disco, se ainda existir.
  - **Erro de XML não impede salvar.** Um fragmento gravado com problema gera o aviso "Salvo com erro de XML: …", com o arquivo, a linha e o primeiro problema. O aviso some quando o arquivo é salvo sem problema e ao fechar o projeto; descartar não o tira, porque o disco continua com o erro. A geração continua recusando o fragmento.
  - O BOM e a quebra de linha ficam como estavam: CRLF quando o arquivo tem algum `\r\n`, senão LF. Um arquivo com quebras misturadas, ou com `\r` sozinho, só muda se for editado, e aí sai todo com a quebra dele.
  - Quando a janela volta ao foco (se a aba Fragmentos já foi aberta com o projeto) e no botão Atualizar, a árvore é relida. Um fragmento aberto sem alteração no app é relido do disco; com alteração, fica como está, e o conflito aparece ao salvar. Um arquivo apagado por fora sai da lista se não tinha alteração, e passa a contar como novo se tinha.
```

por:

<!-- prettier-ignore -->
```markdown
- **Fragmentos** (Fase 6):
  - Só os fragmentos com alteração são gravados: abrir um arquivo e não mexer nunca o regrava. Cada um só é gravado se o disco ainda estiver como na última leitura, e um arquivo novo, se ainda não existir. Um fragmento alterado fora do app entra no mesmo diálogo de conflito; "Recarregar" relê o projeto, os fragmentos abertos saem da lista, e o exibido continua, relido do disco, se ainda existir.
  - **Erro de XML ou de HTML não impede salvar.** Um fragmento gravado com problema gera o aviso "Salvo com erro de XML: …" (ou "de HTML"), com o arquivo, a linha e o primeiro problema. O aviso some quando o arquivo é salvo sem problema e ao fechar o projeto; descartar não o tira, porque o disco continua com o erro. A geração continua recusando o fragmento.
  - O BOM e a quebra de linha ficam como estavam: CRLF quando o arquivo tem algum `\r\n`, senão LF. Um arquivo com quebras misturadas, ou com `\r` sozinho, só muda se for editado, e aí sai todo com a quebra dele.
  - Quando a janela volta ao foco (se a aba Fragmentos já foi aberta com o projeto) e no botão Atualizar, a árvore é relida. Um fragmento aberto sem alteração no app é relido do disco; com alteração, fica como está, e o conflito aparece ao salvar. Um arquivo apagado por fora sai da lista se não tinha alteração, e passa a contar como novo se tinha.
```

Troque:

<!-- prettier-ignore -->
```markdown
| **5. Geração**                | Plano, verificação, `XmlProductDeriver`, pasta temporária e troca                                                                                                                                                              | Gerar `loja-basica` produz o equivalente a `produto-esperado/loja-basica/` (mais `docs/img/pix-fluxo.svg`). Com `pag_boleto` selecionado e `boleto.xml` ausente, a geração falha e não grava nada.                                                                                                                                                                                                                                                |
| **6. Editor de fragmentos**   | Aba Fragmentos com o CodeMirror 6 (ADR 0009): árvore dos `.xml`, editor com realce e a conferência da geração, novo fragmento, vínculo pelo editor, "Editar" na aba Assets, salvar junto com o projeto                         | A árvore mostra os 5 `.xml` de `docs/`, sem o `model.xml`, o `assets.xml` e `configurations/`. Trocar o título do `pix.xml` e salvar muda só esse arquivo, com a quebra de linha e o BOM de antes. Apagar o `>` de uma tag mostra o problema com a linha, e a geração de `loja-basica` passa a recusar o arquivo. Criar `docs/pagamento/cartao.xml`, salvar e vinculá-lo a `pag_cartao` pelo editor faz o arquivo aparecer na aba Assets como ok. |
| **Depois**                    | `ModelAnalyzer`, variabilidade anotativa, renderers por mídia, restrições com atributos, clones, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## 10. Em aberto

- **Mídias prioritárias** para os renderers (fase "Depois"): a definir.
- **Vocabulário de documentação padrão** (DITA, DocBook ou nenhum): adiado de propósito (ADR 0006).
- **Tamanho alvo de modelo** para desempenho do solver: sem requisito; a referência informal é algumas centenas de features.
```

por:

<!-- prettier-ignore -->
```markdown
| **5. Geração**                | Plano, verificação, `XmlProductDeriver`, pasta temporária e troca                                                                                                                                                              | Gerar `loja-basica` produz o equivalente a `produto-esperado/loja-basica/` (mais `docs/img/pix-fluxo.svg`). Com `pag_boleto` selecionado e `boleto.xml` ausente, a geração falha e não grava nada.                                                                                                                                                                                                                                                |
| **6. Editor de fragmentos**   | Aba Fragmentos com o CodeMirror 6 (ADR 0009): árvore dos `.xml`, editor com realce e a conferência da geração, novo fragmento, vínculo pelo editor, "Editar" na aba Assets, salvar junto com o projeto                         | A árvore mostra os 5 `.xml` de `docs/`, sem o `model.xml`, o `assets.xml` e `configurations/`. Trocar o título do `pix.xml` e salvar muda só esse arquivo, com a quebra de linha e o BOM de antes. Apagar o `>` de uma tag mostra o problema com a linha, e a geração de `loja-basica` passa a recusar o arquivo. Criar `docs/pagamento/cartao.xml`, salvar e vinculá-lo a `pag_cartao` pelo editor faz o arquivo aparecer na aba Assets como ok. |
| **7. Páginas HTML**           | Fragmentos HTML, moldura, marcadores, sumário, a página `index.html` na geração, o editor de HTML e o exemplo `herby` (ADR 0010)                                                                                               | Sobre o exemplo `herby`: gerar `completa-atibaia` produz um `index.html` idêntico ao de `produto-esperado/herby-completa-atibaia/`. Uma tag aberta num fragmento e um marcador de feature não selecionada fazem a geração recusar, com o arquivo e a linha. Gerar `loja-basica` do `loja-online` continua sem `index.html`.                                                                                                                       |
| **8. Aba Páginas**            | A página ao vivo dentro do app (decisões no desenho da Fase 7)                                                                                                                                                                 | A definir no desenho da Fase 8.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Depois**                    | `ModelAnalyzer`, variabilidade anotativa, renderers por mídia, restrições com atributos, clones, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## 10. Em aberto

- **Mídias prioritárias** para os renderers (fase "Depois"): a primeira é a página HTML (Fase 7, ADR 0010); as demais, a definir.
- **Variabilidade anotativa** (os `perfis` do herby, guardados em `<template data-perfis>`): prevista para depois da aba Páginas, começando por decidir o que cada perfil significa em features.
- **Vocabulário de documentação padrão** (DITA, DocBook ou nenhum): adiado de propósito (ADR 0006).
- **Tamanho alvo de modelo** para desempenho do solver: sem requisito; a referência informal é algumas centenas de features.
```

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
