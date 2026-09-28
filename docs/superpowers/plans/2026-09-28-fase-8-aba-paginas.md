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

| Arquivo                                                                                                                     | Responsabilidade                                                                    |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `domain/pages/page-assembly.ts`, `domain/generation/generation-plan.ts`                                                     | `projectHasPage`, usado pelo plano e pela visualização                              |
| `application/ports/page-previewer.ts`, `page-preview-host.ts`                                                               | As portas da visualização                                                           |
| `application/fragments/edited-fragments-storage.ts`                                                                         | O texto dos fragmentos abertos no lugar do disco                                    |
| `application/use-cases/preview-page.ts`                                                                                     | A página da configuração aberta                                                     |
| `infrastructure/html/html-page-deriver.ts`                                                                                  | A mesma montagem para a geração e a visualização                                    |
| `src/main/page-preview.ts`, `src/main/index.ts`                                                                             | O esquema `mdd-page:`, o script da visualização e as janelas que vão para o sistema |
| `src/shared/ipc.ts`, `src/preload/index.ts`, `src/renderer/index.html`                                                      | O canal `setPreviewPage`, o endereço e a CSP                                        |
| `infrastructure/electron/electron-page-preview-host.ts`                                                                     | Entrega a página ao main                                                            |
| `ui/stores/pages-actions.ts`, `project-store.ts`, `generation-actions.ts`, `fragments-actions.ts`                           | A store da aba, "Abrir no navegador" e abrir um fragmento numa linha                |
| `ui/app/composition-root.ts`                                                                                                | Injeta a visualização                                                               |
| `ui/screens/pages/*`                                                                                                        | A aba: quadro, barra, problemas e a tela                                            |
| `ui/screens/configurator/GenerateButton.tsx`, `ConfiguratorWorkspace.tsx`, `GenerationBanner.tsx`, `ConfigurationList.tsx`  | O botão compartilhado, a faixa e a lista só para escolher                           |
| `ui/screens/project/ViewRail.tsx`, `ProjectScreen.tsx`, `ui/screens/fragments/FragmentEditor.tsx`, `FragmentsWorkspace.tsx` | A aba e a linha pedida pela aba Páginas                                             |
| `docs/adr/0011-visualizacao-da-pagina-isolada.md`, `CONTEXT.md`, `docs/SPEC.md`                                             | A documentação                                                                      |

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

```ts
// O armazenamento da visualização (Fase 8): o texto do editor no lugar do disco, só para os
// fragmentos abertos com alteração.
//   npx tsx --tsconfig tsconfig.web.json .checks/edited-storage-check.mts
import { EditedFragmentsStorage } from '@/application/fragments/edited-fragments-storage'
import { memoryFolder } from './memory-folder.mts'

const folder = memoryFolder({
  'docs/a.html': '<p>disco</p>',
  'docs/b.html': '<p>b no disco</p>',
  'img/x.png': 'png'
})
const storage = new EditedFragmentsStorage(
  folder.storage,
  new Map([
    ['docs/a.html', '<p>editor</p>'],
    ['Docs/Novo.html', '<p>novo, só no editor</p>']
  ])
)
const read = async (path: string): Promise<string> => {
  const result = await storage.readText(path)
  return result.ok ? JSON.stringify(result.value.content) : `erro ${result.error.code}`
}
const kind = async (path: string): Promise<string> => {
  const result = await storage.stat(path)
  return result.ok ? result.value : `erro ${result.error.code}`
}
const log = (label: string, value: unknown): void => console.log(label.padEnd(28), '→', value)

log('docs/a.html (editado)', await read('docs/a.html'))
log('DOCS/A.HTML (sem caixa)', await read('DOCS/A.HTML'))
log('docs/b.html (só no disco)', await read('docs/b.html'))
log('docs/novo.html (novo)', await read('docs/novo.html'))
log('docs/falta.html', await read('docs/falta.html'))
log('stat docs/novo.html', await kind('docs/novo.html'))
log('stat img/x.png', await kind('img/x.png'))
log('stat img/falta.png', await kind('img/falta.png'))
log('disco de a.html, intacto', folder.show('docs/a.html'))
```

- [ ] **Passo 3: Escrever o roteiro `.checks/page-preview-check.mts`**

```ts
// A página da visualização (Fase 8) sobre uma cópia do herby: igual à página gerada, com o
// texto do editor, com problemas (a página sai assim mesmo), incompleta, sem página e com a
// moldura padrão.
//   npx tsx --tsconfig tsconfig.web.json .checks/page-preview-check.mts
import { cpSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { PagePreviewHost } from '@/application/ports/page-preview-host'
import { PreviewPage } from '@/application/use-cases/preview-page'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import type { Project } from '@/domain/project/project'
import { HtmlPageDeriver } from '@/infrastructure/html/html-page-deriver'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { DiskStorage } from './generation-support.mts'

function copyOf(example: string, name: string): string {
  const folder = resolve('.checks/geracao', name)
  rmSync(folder, { recursive: true, force: true })
  cpSync(`docs/examples/${example}`, folder, { recursive: true })
  return folder
}

function readProject(folder: string): Project {
  const read = (path: string) => parseXmlRoot(readFileSync(join(folder, path), 'utf8'))
  const model = decodeFeatureModel(read('model.xml'))
  const assets = decodeAssetCatalog(read('assets.xml'))
  if (!model.ok || !assets.ok) throw new Error('o exemplo não abriu')
  const configurations = readdirSync(join(folder, 'configurations')).map((name) => {
    const decoded = decodeConfiguration(read(`configurations/${name}`))
    if (!decoded.ok) throw new Error(`${name} não abriu`)
    return { key: name.slice(0, -'.xml'.length), configuration: decoded.value }
  })
  return { model: model.value, assets: assets.value, configurations }
}

/** O main de mentira: guarda a última página entregue. */
const shown: string[] = []
const host: PagePreviewHost = {
  address: 'mdd-page://pagina/index.html',
  show: async (html) => void shown.push(html)
}
const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const previewIn = (folder: string): PreviewPage =>
  new PreviewPage({
    resolveConfiguration: resolver,
    previewer: new HtmlPageDeriver(new DiskStorage(folder)),
    host
  })
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const describe = (result: Awaited<ReturnType<PreviewPage['execute']>>): string =>
  result.kind === 'page'
    ? `página em ${result.address}, moldura padrão: ${result.defaultFrame ? 'sim' : 'não'}, ${result.problems.length} problema(s)`
    : result.kind

const herby = copyOf('herby', 'visualizacao-herby')
const project = readProject(herby)
const preview = previewIn(herby)
const expected = readFileSync(
  'docs/examples/produto-esperado/herby-completa-atibaia/index.html',
  'utf8'
)
const PLATAFORMA = 'fragmentos/plataforma.html'
const original = readFileSync(join(herby, PLATAFORMA), 'utf8')

console.log('— a configuração da aceitação')
log('completa-atibaia', describe(await preview.execute(project, 'completa-atibaia', new Map())))
log('igual à página gerada', shown.at(-1) === expected ? 'sim' : 'NÃO')

console.log('— o texto do editor, sem salvar')
const edited = original.replace('Como funciona', 'Como funciona (editado no app)')
log(
  'resultado',
  describe(await preview.execute(project, 'completa-atibaia', new Map([[PLATAFORMA, edited]])))
)
log(
  'a página tem o texto editado',
  shown.at(-1)?.includes('Como funciona (editado no app)') ? 'sim' : 'NÃO'
)
log(
  'o disco continua igual',
  readFileSync(join(herby, PLATAFORMA), 'utf8') === original ? 'sim' : 'NÃO'
)

console.log('— com problemas, a página sai assim mesmo')
const broken = original.replace(
  '<h2>{{herby.produto}}</h2>',
  '<h2>{{herby.nada}}</h2>\n<div class="aberto">'
)
const withProblems = await preview.execute(
  project,
  'completa-atibaia',
  new Map([[PLATAFORMA, broken]])
)
log('resultado', describe(withProblems))
if (withProblems.kind === 'page') {
  for (const problem of withProblems.problems) {
    log(`   ${problem.file}:${problem.line}`, problem.message)
  }
}
log(
  'o marcador fica como está escrito',
  shown.at(-1)?.includes('<h2>{{herby.nada}}</h2>') ? 'sim' : 'NÃO'
)
log('o resto da página continua', shown.at(-1)?.includes('Acesso à Plataforma') ? 'sim' : 'NÃO')

console.log('— sem página')
const incomplete = {
  ...project,
  configurations: [
    ...project.configurations,
    { key: 'vazia', configuration: { name: 'Vazia', decisions: [], values: [] } }
  ]
}
log('configuração incompleta', describe(await preview.execute(incomplete, 'vazia', new Map())))
log('nenhuma configuração aberta', describe(await preview.execute(project, null, new Map())))
const loja = copyOf('loja-online', 'visualizacao-loja')
log(
  'loja-online (sem fragmento HTML)',
  describe(await previewIn(loja).execute(readProject(loja), 'loja-basica', new Map()))
)

console.log('— a moldura padrão')
rmSync(join(herby, 'moldura.html'))
log('sem moldura.html', describe(await preview.execute(project, 'completa-atibaia', new Map())))
log('a página começa com', JSON.stringify(shown.at(-1)?.split('\n').slice(0, 6).join(' ')))
log(
  'moldura.html nova, só no editor',
  describe(
    await preview.execute(
      project,
      'completa-atibaia',
      new Map([
        [
          'moldura.html',
          '<!doctype html><html><head></head><body><main>{{conteudo}}</main></body></html>'
        ]
      ])
    )
  )
)
```

- [ ] **Passo 4: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/edited-storage-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/page-preview-check.mts
```

Esperado: os dois falham com `ERR_MODULE_NOT_FOUND`.

- [ ] **Passo 5: Criar `src/renderer/src/application/ports/page-previewer.ts`**

```ts
import type { GenerationPlan } from '@/domain/generation/generation-plan'
import type { FileProblem } from '../file-problem'

/** A página da visualização e o que há de errado nela. */
export interface PagePreview {
  /** O `index.html`, como a geração o gravaria, mesmo com problemas (no melhor esforço). */
  readonly page: string
  readonly problems: readonly FileProblem[]
  /** O projeto não tem `moldura.html`: a página usa a moldura padrão. */
  readonly defaultFrame: boolean
}

/**
 * Monta a página de um plano para a visualização (Fase 8). Os fragmentos com texto em
 * `edited` (os abertos no editor com alteração, por caminho) entram com esse texto, e não com
 * o do disco. Com problemas, a página sai assim mesmo: um marcador que não resolve fica como
 * está escrito, e um arquivo que falta fica como falta.
 */
export interface PagePreviewer {
  preview(plan: GenerationPlan, edited: ReadonlyMap<string, string>): Promise<PagePreview>
}
```

- [ ] **Passo 6: Criar `src/renderer/src/application/ports/page-preview-host.ts`**

```ts
/**
 * Quem mostra a página da visualização (Fase 8): no app, o processo main, que a serve num
 * esquema próprio, isolada do app (ADR 0011).
 */
export interface PagePreviewHost {
  /** O endereço em que a última página entregue fica disponível. */
  readonly address: string
  /** Entrega a página; o endereço passa a servi-la. */
  show(html: string): Promise<void>
}
```

- [ ] **Passo 7: Criar `src/renderer/src/application/fragments/edited-fragments-storage.ts`**

```ts
import { ok, type Result } from '@/domain/shared/result'
import type {
  ProjectStorage,
  RemovePrecondition,
  StorageEntry,
  StorageEntryKind,
  StorageError,
  StoredText,
  WritePrecondition
} from '../ports/project-storage'

/**
 * O projeto com os fragmentos abertos no editor (Fase 8): um arquivo com texto em `edited`
 * (por caminho, comparado sem caixa, como no Windows) é lido com esse texto, e existe mesmo
 * que ainda não esteja no disco. O resto passa direto para o armazenamento de baixo. Serve
 * só para ler: a visualização nunca grava.
 */
export class EditedFragmentsStorage implements ProjectStorage {
  private readonly storage: ProjectStorage
  private readonly edited: ReadonlyMap<string, string>

  constructor(storage: ProjectStorage, edited: ReadonlyMap<string, string>) {
    this.storage = storage
    this.edited = new Map([...edited].map(([path, text]) => [path.toLowerCase(), text]))
  }

  readText(path: string): Promise<Result<StoredText, StorageError>> {
    const text = this.edited.get(path.toLowerCase())
    // Sem hash: um texto do editor nunca é gravado por aqui.
    return text === undefined
      ? this.storage.readText(path)
      : Promise.resolve(ok({ content: text, hash: '' }))
  }

  stat(path: string): Promise<Result<StorageEntryKind, StorageError>> {
    return this.edited.has(path.toLowerCase())
      ? Promise.resolve(ok('file'))
      : this.storage.stat(path)
  }

  list(directory: string): Promise<Result<StorageEntry[], StorageError>> {
    return this.storage.list(directory)
  }

  writeText(
    path: string,
    content: string,
    precondition: WritePrecondition
  ): Promise<Result<string, StorageError>> {
    return this.storage.writeText(path, content, precondition)
  }

  remove(path: string, precondition: RemovePrecondition): Promise<Result<null, StorageError>> {
    return this.storage.remove(path, precondition)
  }

  copy(from: string, to: string): Promise<Result<null, StorageError>> {
    return this.storage.copy(from, to)
  }

  rename(from: string, to: string): Promise<Result<null, StorageError>> {
    return this.storage.rename(from, to)
  }

  removeDirectory(path: string): Promise<Result<null, StorageError>> {
    return this.storage.removeDirectory(path)
  }
}
```

- [ ] **Passo 8: Criar `src/renderer/src/application/use-cases/preview-page.ts`**

```ts
import type { Configuration } from '@/domain/configuration/configuration'
import type { Resolution } from '@/domain/configuration/resolution'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { planGeneration } from '@/domain/generation/generation-plan'
import { projectHasPage } from '@/domain/pages/page-assembly'
import type { Project } from '@/domain/project/project'
import type { FileProblem } from '../file-problem'
import type { PagePreviewHost } from '../ports/page-preview-host'
import type { PagePreviewer } from '../ports/page-previewer'

export type PreviewPageResult =
  | { readonly kind: 'no-configuration' }
  /** O projeto não tem fragmento HTML: não há página. */
  | { readonly kind: 'no-page' }
  /** A configuração não está completa (ou está em conflito, ou o modelo é vazio). */
  | { readonly kind: 'blocked' }
  | {
      readonly kind: 'page'
      /** Onde a página ficou disponível. */
      readonly address: string
      readonly problems: readonly FileProblem[]
      readonly defaultFrame: boolean
    }

export interface PreviewPageDependencies {
  readonly resolveConfiguration: {
    execute(model: FeatureModel, configuration: Configuration): Resolution
  }
  readonly previewer: PagePreviewer
  readonly host: PagePreviewHost
}

/**
 * A página da configuração aberta, do projeto como está na tela (Fase 8): com as decisões e
 * os valores não salvos e com o texto dos fragmentos abertos no editor (`edited`). Entrega a
 * página a quem a mostra; não grava nada em `saida/`.
 */
export class PreviewPage {
  private readonly deps: PreviewPageDependencies

  constructor(deps: PreviewPageDependencies) {
    this.deps = deps
  }

  async execute(
    project: Project,
    key: string | null,
    edited: ReadonlyMap<string, string>
  ): Promise<PreviewPageResult> {
    const entry = project.configurations.find((candidate) => candidate.key === key)
    if (entry === undefined) return { kind: 'no-configuration' }
    if (!projectHasPage(project.assets)) return { kind: 'no-page' }
    const { model, assets } = project
    const resolution = this.deps.resolveConfiguration.execute(model, entry.configuration)
    const plan = planGeneration(model, assets, entry.configuration, resolution)
    if (!plan.ok) return { kind: 'blocked' }

    const preview = await this.deps.previewer.preview(plan.value, edited)
    await this.deps.host.show(preview.page)
    return {
      kind: 'page',
      address: this.deps.host.address,
      problems: preview.problems,
      defaultFrame: preview.defaultFrame
    }
  }
}
```

- [ ] **Passo 9: `projectHasPage`, em `src/renderer/src/domain/pages/page-assembly.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import type { Asset } from '../assets/asset-catalog'
import { fragmentFormat } from '../fragments/fragment-format'
import type { GenerationPlan, PlannedSection } from '../generation/generation-plan'
```

por:

<!-- prettier-ignore -->
```ts
import type { Asset, AssetCatalog } from '../assets/asset-catalog'
import { fragmentFormat } from '../fragments/fragment-format'
import type { GenerationPlan, PlannedSection } from '../generation/generation-plan'
```

Troque:

<!-- prettier-ignore -->
```ts
export function escapeHtmlAttribute(text: string): string {
  return escapeHtmlText(text).replaceAll('"', '&quot;')
}
```

por:

<!-- prettier-ignore -->
```ts
export function escapeHtmlAttribute(text: string): string {
  return escapeHtmlText(text).replaceAll('"', '&quot;')
}

/** O projeto tem página: algum asset fragmento `.html`, incluído ou não na configuração. */
export function projectHasPage(catalog: AssetCatalog): boolean {
  return catalog.assets.some(
    (asset) => asset.kind === 'fragment' && fragmentFormat(asset.path) === 'html'
  )
}
```

E o plano da geração passa a usá-lo, em `src/renderer/src/domain/generation/generation-plan.ts`:

Troque:

<!-- prettier-ignore -->
```ts
  featuresInPreOrder
} from '../feature-model/traversal'
import { fragmentFormat } from '../fragments/fragment-format'
import { err, ok, type Result } from '../shared/result'
```

por:

<!-- prettier-ignore -->
```ts
  featuresInPreOrder
} from '../feature-model/traversal'
import { projectHasPage } from '../pages/page-assembly'
import { err, ok, type Result } from '../shared/result'
```

Troque:

<!-- prettier-ignore -->
```ts
    root: sectionOf(model.root),
    resources: firstPerPath(included.filter((asset) => asset.kind === 'resource')),
    hasPage: catalog.assets.some(
      (asset) => asset.kind === 'fragment' && fragmentFormat(asset.path) === 'html'
    ),
    modelAttributes: attributeIdsByFeature(model.root)
  })
```

por:

<!-- prettier-ignore -->
```ts
    root: sectionOf(model.root),
    resources: firstPerPath(included.filter((asset) => asset.kind === 'resource')),
    hasPage: projectHasPage(catalog),
    modelAttributes: attributeIdsByFeature(model.root)
  })
```

- [ ] **Passo 10: Reescrever `src/renderer/src/infrastructure/html/html-page-deriver.ts`**

A geração e a visualização passam pela mesma montagem (`build`). O arquivo inteiro:

```ts
import type { FileProblem } from '@/application/file-problem'
import { EditedFragmentsStorage } from '@/application/fragments/edited-fragments-storage'
import type { PagePreview, PagePreviewer } from '@/application/ports/page-previewer'
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

/** O que sai de uma montagem: a página, os arquivos citados e os problemas. */
interface Built {
  readonly page: string
  readonly copies: readonly string[]
  readonly problems: readonly FileProblem[]
  readonly defaultFrame: boolean
}

/**
 * A página do produto (SPEC §4.4, Fases 7 e 8): a moldura com as seções das features
 * selecionadas, os marcadores trocados, os caminhos corrigidos para o `index.html`, o sumário
 * e o CSS e o JS incluídos. Na geração, devolve o `index.html` e as cópias dos arquivos
 * citados, ou todos os problemas; os recursos são copiados pelo `XmlProductDeriver`. Na
 * visualização, monta a página mesmo com problemas, com o texto dos fragmentos abertos.
 */
export class HtmlPageDeriver implements ProductDeriver, PagePreviewer {
  private readonly storage: ProjectStorage

  constructor(storage: ProjectStorage) {
    this.storage = storage
  }

  async derive(plan: GenerationPlan): Promise<Result<readonly ProductFile[], FileProblem[]>> {
    if (!plan.hasPage) return ok([])
    const built = await this.build(plan, this.storage, 'generation')
    if (built.problems.length > 0) return err([...built.problems])
    return ok([
      { kind: 'text', path: PAGE_PATH, content: built.page },
      ...built.copies.map((path): ProductFile => ({ kind: 'copy', path }))
    ])
  }

  async preview(plan: GenerationPlan, edited: ReadonlyMap<string, string>): Promise<PagePreview> {
    const built = await this.build(
      plan,
      new EditedFragmentsStorage(this.storage, edited),
      'preview'
    )
    return { page: built.page, problems: built.problems, defaultFrame: built.defaultFrame }
  }

  /**
   * Monta a página. Na visualização, os arquivos citados não são conferidos (o navegador
   * mostra a falta), e uma moldura que não pôde ser lida dá lugar à moldura padrão.
   */
  private async build(
    plan: GenerationPlan,
    storage: ProjectStorage,
    mode: 'generation' | 'preview'
  ): Promise<Built> {
    const fragments = firstPerPath(planHtmlFragments(plan.root))
    const [frameRead, ...fragmentReads] = await Promise.all([
      loadFrame(storage),
      ...fragments.map((asset) => loadFragment(storage, asset))
    ])
    const problems: FileProblem[] = []
    const prepareRead = (
      read: Result<Loaded, FileProblem[]>,
      subject: string | undefined
    ): Prepared | null => {
      if (!read.ok) {
        problems.push(...read.error)
        return null
      }
      const done = prepare(read.value.file, read.value.content, plan, subject)
      problems.push(...done.problems)
      return done.prepared
    }
    const frame =
      prepareRead(frameRead, undefined) ??
      prepare(FRAME_PATH, DEFAULT_FRAME, plan, undefined).prepared
    const parts = fragmentReads.flatMap((read, index) => {
      const part = prepareRead(read, fragments[index].id)
      return part === null ? [] : [part]
    })
    const prepared = frame === null ? parts : [frame, ...parts]
    // Os arquivos citados são conferidos também num arquivo com problema: todos de uma vez.
    if (mode === 'generation') problems.push(...(await checkCited(storage, prepared)))

    const textByPath = new Map(
      parts.map((part) => [part.file, trimmed(apply(part.text, part.edits))])
    )
    const textOf = (asset: Asset): string => textByPath.get(asset.path) ?? ''
    return {
      page: frame === null ? '' : assemble(frame, plan, textOf),
      copies: uniquePaths(prepared.flatMap((part) => part.cited.map((cited) => cited.path))),
      problems,
      defaultFrame: frameRead.ok && frameRead.value.missing
    }
  }
}

/** Um arquivo lido, e se era a moldura que não existe (e veio a padrão no lugar). */
interface Loaded {
  readonly file: string
  readonly content: string
  readonly missing: boolean
}

async function loadFrame(storage: ProjectStorage): Promise<Result<Loaded, FileProblem[]>> {
  const read = await storage.readText(FRAME_PATH)
  if (read.ok) return ok({ file: FRAME_PATH, content: read.value.content, missing: false })
  if (read.error.code === 'not-found') {
    return ok({ file: FRAME_PATH, content: DEFAULT_FRAME, missing: true })
  }
  return err([{ file: FRAME_PATH, severity: 'error', message: read.error.message }])
}

async function loadFragment(
  storage: ProjectStorage,
  asset: Asset
): Promise<Result<Loaded, FileProblem[]>> {
  const read = await storage.readText(asset.path)
  if (read.ok) return ok({ file: asset.path, content: read.value.content, missing: false })
  const message = read.error.code === 'not-found' ? 'Arquivo ausente.' : read.error.message
  return err([{ file: asset.path, subject: asset.id, severity: 'error', message }])
}

/** Cada arquivo citado precisa existir e ser um arquivo; é conferido uma vez só. */
async function checkCited(
  storage: ProjectStorage,
  prepared: readonly Prepared[]
): Promise<FileProblem[]> {
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
      const generated = [PAGE_PATH, PRODUCT_PATH].find((path) => path === cited.path.toLowerCase())
      if (generated !== undefined) {
        const message = `O arquivo ${cited.path} do projeto substituiria o ${generated} gerado: mude o nome dele.`
        return [problemAt(part.file, part.text, { offset: cited.offset, message }, part.subject)]
      }
      const entry = await storage.stat(cited.path)
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
  // Os problemas do arquivo na ordem das linhas: os da conferência vêm antes dos marcadores.
  problems.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
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

- [ ] **Passo 11: Rodar os roteiros**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/edited-storage-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/page-preview-check.mts
```

Esperado, `edited-storage-check.mts`:

```
docs/a.html (editado)        → "<p>editor</p>"
DOCS/A.HTML (sem caixa)      → "<p>editor</p>"
docs/b.html (só no disco)    → "<p>b no disco</p>"
docs/novo.html (novo)        → "<p>novo, só no editor</p>"
docs/falta.html              → erro not-found
stat docs/novo.html          → file
stat img/x.png               → file
stat img/falta.png           → erro not-found
disco de a.html, intacto     → "<p>disco</p>"
```

Esperado, `page-preview-check.mts`:

```
— a configuração da aceitação
completa-atibaia                     → página em mdd-page://pagina/index.html, moldura padrão: não, 0 problema(s)
igual à página gerada                → sim
— o texto do editor, sem salvar
resultado                            → página em mdd-page://pagina/index.html, moldura padrão: não, 0 problema(s)
a página tem o texto editado         → sim
o disco continua igual               → sim
— com problemas, a página sai assim mesmo
resultado                            → página em mdd-page://pagina/index.html, moldura padrão: não, 2 problema(s)
   fragmentos/plataforma.html:1      → A feature herby não tem o atributo nada.
   fragmentos/plataforma.html:2      → A tag <div> é aberta aqui e não é fechada neste arquivo.
o marcador fica como está escrito    → sim
o resto da página continua           → sim
— sem página
configuração incompleta              → blocked
nenhuma configuração aberta          → no-configuration
loja-online (sem fragmento HTML)     → no-page
— a moldura padrão
sem moldura.html                     → página em mdd-page://pagina/index.html, moldura padrão: sim, 0 problema(s)
a página começa com                  → "<!doctype html> <html lang=\"pt-BR\"> <head> <meta charset=\"utf-8\"> <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> <title>Completa Atibaia</title>"
moldura.html nova, só no editor      → página em mdd-page://pagina/index.html, moldura padrão: não, 0 problema(s)
```

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

```ts
// A store da aba Páginas (Fase 8): montagens pedidas durante outra se juntam numa só, a mais
// nova é a que fica, a rolagem volta ao topo ao trocar de configuração, e uma montagem que
// termina depois de fechar o projeto é descartada.
//   npx tsx --tsconfig tsconfig.web.json .checks/pages-store-check.mts
import { readFileSync } from 'node:fs'
import type { ProjectSession } from '@/application/project-session'
import type { PreviewPageResult } from '@/application/use-cases/preview-page'
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { createProjectStore } from '@/ui/stores/project-store'

const model = decodeFeatureModel(
  parseXmlRoot(readFileSync('docs/examples/loja-online/model.xml', 'utf8'))
)
if (!model.ok) throw new Error('o exemplo não abriu')
const configuration = { name: 'A', decisions: [], values: [] }
const session = (): ProjectSession => ({
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: {
    model: model.value,
    assets: EMPTY_ASSET_CATALOG,
    configurations: [
      { key: 'a', configuration },
      { key: 'b', configuration: { ...configuration, name: 'B' } }
    ]
  },
  hashes: { model: 'x', assets: null, configurations: {} }
})
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}

/** A montagem de mentira: cada chamada espera um pouco e anota o que recebeu. */
const calls: string[] = []
let delay = 50
const previewPage = {
  async execute(
    _project: unknown,
    key: string | null,
    edited: ReadonlyMap<string, string>
  ): Promise<PreviewPageResult> {
    calls.push(`${key} (${[...edited.keys()].join(', ') || 'sem editados'})`)
    await new Promise((resolve) => setTimeout(resolve, delay))
    return key === null
      ? { kind: 'no-configuration' }
      : { kind: 'page', address: 'mdd-page://pagina/index.html', problems: [], defaultFrame: false }
  }
}
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session: session(), warnings: [] }),
    reopen: async () => ({ status: 'opened', session: session(), warnings: [] })
  },
  createProject: { execute: notUsed },
  saveProject: { execute: async (current) => ({ session: current, conflicts: [], problems: [] }) },
  resolveConfiguration: {
    execute: () => ({ kind: 'empty-model', orphans: [], invalidValues: [] })
  },
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} },
  checkAssetFiles: { execute: async () => new Map() },
  filePicker: { pickFile: notUsed },
  assetOpener: { open: notUsed },
  generateProduct: { execute: notUsed },
  outputFolderOpener: { open: notUsed },
  fragmentFiles: { list: notUsed, checkNewPath: () => notUsed() as never },
  openFragment: { execute: notUsed },
  saveFragments: { execute: notUsed },
  fragmentChecker: { check: async () => [] },
  previewPage
})
const state = () => store.getState()
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const shown = (): string => {
  const preview = state().pagePreview
  return preview.kind === 'page' ? `página, versão ${preview.version}` : preview.kind
}

await state().open()
log('antes de montar', shown())
await state().refreshPage()
log('sem configuração aberta', `${shown()} | chamadas: ${calls.splice(0).join(' ; ')}`)

state().openConfiguration('a')
await state().refreshPage()
log('configuração a', `${shown()} | chamadas: ${calls.splice(0).join(' ; ')}`)
state().setPageScroll(900)

console.log('— três pedidos seguidos')
const first = state().refreshPage()
void state().refreshPage()
const last = state().refreshPage()
await Promise.all([first, last])
log('montagens', `${calls.length}: ${calls.splice(0).join(' ; ')}`)
log('fica a mais nova', shown())
log('a rolagem continua', state().pageScroll)

console.log('— outra configuração')
state().openConfiguration('b')
await state().refreshPage()
log('configuração b', `${shown()} | rolagem: ${state().pageScroll}`)
calls.splice(0)

console.log('— fechar durante a montagem')
delay = 200
const pending = state().refreshPage()
await new Promise((resolve) => setTimeout(resolve, 50))
state().close()
await pending
log(
  'depois de fechar',
  `${shown()} | largura: ${state().pageWidth} | rolagem: ${state().pageScroll}`
)
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/pages-store-check.mts
```

Esperado: `TypeError: Cannot read properties of undefined (reading 'kind')` (a store ainda não tem o `pagePreview`).

- [ ] **Passo 3: Criar `src/main/page-preview.ts`**

```ts
import { ipcMain, net, protocol } from 'electron'
import { stat } from 'fs/promises'
import { pathToFileURL } from 'url'
import { IpcChannel, PREVIEW_HOST, PREVIEW_SCHEME } from '../shared/ipc'
import type { ProjectRoot } from './project-root'

/*
 * A visualização da página (Fase 8, ADR 0011). O renderer monta a página e a entrega por
 * `setPreviewPage`; o main a serve no esquema próprio `mdd-page:`, com os arquivos do projeto
 * aberto (só leitura). A página roda num <iframe> com sandbox, numa origem opaca: os scripts e
 * a internet funcionam, mas ela não enxerga o app. Sem CSP na resposta, a do app não vale nela.
 * A do app (`frame-src mdd-page:`) barra o quadro de navegar para fora do esquema: um link para
 * fora é aberto pelo script da visualização como janela nova, que o `setWindowOpenHandler` manda
 * para o navegador do sistema.
 */

/** Os endereços que saem da página e abrem no programa padrão do sistema. */
const EXTERNAL = /^(https?|mailto):/i
const NO_STORE = { 'cache-control': 'no-store' }

/**
 * O script que só a visualização leva, antes do `</body>`: devolve a rolagem guardada (o
 * `?y=` do endereço), avisa o app de cada rolagem, repassa o Ctrl+S (com o foco dentro da
 * página, as teclas não chegam ao app) e abre os links para fora como janela nova, que vai para
 * o navegador do sistema. O index.html gerado não o leva.
 */
const PREVIEW_SCRIPT = `<script>
(() => {
  const saved = Number(new URLSearchParams(location.search).get('y')) || 0
  const restore = () => { if (saved > 0) scrollTo(0, saved) }
  addEventListener('DOMContentLoaded', restore)
  addEventListener('load', restore)
  let last = -1
  addEventListener('scroll', () => {
    if (scrollY === last) return
    last = scrollY
    parent.postMessage({ mddPreview: 'scroll', y: scrollY }, '*')
  }, { passive: true })
  addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (link === null || !/^(https?|mailto):$/.test(new URL(link.href).protocol)) return
    event.preventDefault()
    open(link.href, '_blank', 'noopener')
  }, true)
  addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      parent.postMessage({ mddPreview: 'save' }, '*')
    }
  })
})()
</script>
`

/** Antes do `app.whenReady`: o esquema é padrão (endereços relativos) e seguro. */
export function registerPreviewScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: PREVIEW_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

/** Depois do `app.whenReady`: o canal que recebe a página e a resposta do esquema. */
export function registerPagePreview(root: ProjectRoot): void {
  let page = ''
  ipcMain.handle(IpcChannel.setPreviewPage, (_event, html: string) => {
    page = withPreviewScript(html)
  })
  protocol.handle(PREVIEW_SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.host !== PREVIEW_HOST) return new Response(null, { status: 404 })
    const path = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    if (path === 'index.html') {
      return new Response(page, {
        headers: { 'content-type': 'text/html; charset=utf-8', ...NO_STORE }
      })
    }
    const absolute = root.current === null ? null : root.resolve(path)
    if (absolute === null || !(await isFile(absolute))) return new Response(null, { status: 404 })
    // Sem cache: "Recarregar" precisa pegar um arquivo mudado por fora.
    const file = await net.fetch(pathToFileURL(absolute).toString())
    const headers = new Headers(file.headers)
    headers.set('cache-control', 'no-store')
    return new Response(file.body, { status: file.status, headers })
  })
}

/** Um endereço aberto com `target="_blank"` ou `window.open`: só os de fora, no sistema. */
export function isExternalAddress(url: string): boolean {
  return EXTERNAL.test(url)
}

function withPreviewScript(html: string): string {
  const end = html.toLowerCase().lastIndexOf('</body>')
  return end < 0 ? html + PREVIEW_SCRIPT : html.slice(0, end) + PREVIEW_SCRIPT + html.slice(end)
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}
```

- [ ] **Passo 4: O esquema e as janelas, em `src/main/index.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import { registerProjectHandlers } from './ipc/project-handlers'
import { registerXmlHandlers } from './ipc/xml-handlers'

function createWindow(): void {
```

por:

<!-- prettier-ignore -->
```ts
import { registerProjectHandlers } from './ipc/project-handlers'
import { registerXmlHandlers } from './ipc/xml-handlers'
import { isExternalAddress, registerPagePreview, registerPreviewScheme } from './page-preview'

// O esquema da visualização precisa ser registrado antes de o app ficar pronto.
registerPreviewScheme()

function createWindow(): void {
```

Troque:

<!-- prettier-ignore -->
```ts
  confirmCloseWithUnsavedChanges(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
```

por:

<!-- prettier-ignore -->
```ts
  confirmCloseWithUnsavedChanges(mainWindow)

  // Um link com target="_blank" (na página da visualização, por exemplo) abre no sistema, e
  // só se for de fora do app.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isExternalAddress(details.url)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })
```

Troque:

<!-- prettier-ignore -->
```ts
  registerFileHandlers(projectRoot)
  registerXmlHandlers()
  registerUnsavedChangesHandler()
```

por:

<!-- prettier-ignore -->
```ts
  registerFileHandlers(projectRoot)
  registerXmlHandlers()
  registerPagePreview(projectRoot)
  registerUnsavedChangesHandler()
```

- [ ] **Passo 5: O canal e o endereço, em `src/shared/ipc.ts`**

Troque:

<!-- prettier-ignore -->
```ts
 */
export const OUTPUT_DIRECTORY = 'saida'

export interface XmlSchemaIssue {
```

por:

<!-- prettier-ignore -->
```ts
 */
export const OUTPUT_DIRECTORY = 'saida'

/**
 * O esquema próprio da visualização da página (Fase 8, ADR 0011): o main serve nele a página
 * montada pelo renderer (`index.html`) e os arquivos do projeto aberto, só para leitura.
 */
export const PREVIEW_SCHEME = 'mdd-page'
export const PREVIEW_HOST = 'pagina'
export const PREVIEW_ADDRESS = `${PREVIEW_SCHEME}://${PREVIEW_HOST}/index.html`

export interface XmlSchemaIssue {
```

Troque:

<!-- prettier-ignore -->
```ts
    content: string
  ): Promise<IpcResult<XmlSchemaIssue[]>>
}
```

por:

<!-- prettier-ignore -->
```ts
    content: string
  ): Promise<IpcResult<XmlSchemaIssue[]>>
  /** Entrega a página da visualização, que o main passa a servir em `PREVIEW_ADDRESS`. */
  setPreviewPage(html: string): Promise<void>
}
```

Troque:

<!-- prettier-ignore -->
```ts
  pickFileInProject: 'mdd:pick-file-in-project',
  openPath: 'mdd:open-path',
  validateXml: 'mdd:validate-xml'
} as const
```

por:

<!-- prettier-ignore -->
```ts
  pickFileInProject: 'mdd:pick-file-in-project',
  openPath: 'mdd:open-path',
  validateXml: 'mdd:validate-xml',
  setPreviewPage: 'mdd:set-preview-page'
} as const
```

Em `src/preload/index.ts`:

Troque:

<!-- prettier-ignore -->
```ts
  openPath: (relativePath) => ipcRenderer.invoke(IpcChannel.openPath, relativePath),
  validateXml: (schema, fileName, content) =>
    ipcRenderer.invoke(IpcChannel.validateXml, schema, fileName, content)
}
```

por:

<!-- prettier-ignore -->
```ts
  openPath: (relativePath) => ipcRenderer.invoke(IpcChannel.openPath, relativePath),
  validateXml: (schema, fileName, content) =>
    ipcRenderer.invoke(IpcChannel.validateXml, schema, fileName, content),
  setPreviewPage: (html) => ipcRenderer.invoke(IpcChannel.setPreviewPage, html)
}
```

E a CSP do app, em `src/renderer/index.html`:

Troque:

<!-- prettier-ignore -->
```html
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
    />
  </head>
```

por:

<!-- prettier-ignore -->
```html
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src mdd-page:"
    />
  </head>
```

- [ ] **Passo 6: Criar `src/renderer/src/infrastructure/electron/electron-page-preview-host.ts`**

```ts
import type { PagePreviewHost } from '@/application/ports/page-preview-host'

/** O processo main serve a página no esquema próprio da visualização (ADR 0011). */
export class ElectronPagePreviewHost implements PagePreviewHost {
  readonly address: string

  /** `address` vem da composition root (`PREVIEW_ADDRESS`, em `src/shared/ipc.ts`). */
  constructor(address: string) {
    this.address = address
  }

  show(html: string): Promise<void> {
    return window.mdd.setPreviewPage(html)
  }
}
```

- [ ] **Passo 7: Criar `src/renderer/src/ui/stores/pages-actions.ts`**

```ts
import type { StoreApi } from 'zustand/vanilla'
import type { FileProblem } from '@/application/file-problem'
import { isModified } from '@/application/fragments/fragment-document'
import type { PreviewPageResult } from '@/application/use-cases/preview-page'
import type { Project } from '@/domain/project/project'
import type { ProjectState } from './project-store'

/** Os serviços da aba Páginas; a composition root entrega as implementações. */
export interface PagesServices {
  readonly previewPage: {
    execute(
      project: Project,
      key: string | null,
      edited: ReadonlyMap<string, string>
    ): Promise<PreviewPageResult>
  }
}

export type PageWidth = 'mobile' | 'tablet' | 'full'

/** O que a aba Páginas mostra. */
export type PagePreviewState =
  /** Nada montado ainda. */
  | { readonly kind: 'idle' }
  | { readonly kind: 'no-configuration' }
  | { readonly kind: 'no-page' }
  | { readonly kind: 'blocked' }
  | {
      readonly kind: 'page'
      readonly address: string
      /** Muda a cada montagem: o quadro recarrega. */
      readonly version: number
      readonly problems: readonly FileProblem[]
      readonly defaultFrame: boolean
    }

/**
 * Estado e ações da aba Páginas (Fase 8): a página da configuração aberta, montada do projeto
 * como está na tela, a largura e a rolagem guardada entre as montagens.
 */
export interface PagesState {
  readonly pagePreview: PagePreviewState
  readonly pageWidth: PageWidth
  /** A rolagem da página, que a próxima montagem devolve. */
  readonly pageScroll: number

  /**
   * Monta a página de novo. Uma montagem pedida durante outra espera ela acabar: a página
   * entregue ao main é sempre a mais nova.
   */
  refreshPage(): Promise<void>
  setPageWidth(width: PageWidth): void
  setPageScroll(y: number): void
}

export const PAGES_CLOSED = {
  pagePreview: { kind: 'idle' },
  pageWidth: 'full',
  pageScroll: 0
} satisfies Partial<PagesState>

type SetState = StoreApi<ProjectState>['setState']

export function createPagesActions(
  set: SetState,
  get: () => ProjectState,
  services: PagesServices
): Omit<PagesState, keyof typeof PAGES_CLOSED> {
  let running: Promise<void> | null = null
  let again = false
  let version = 0
  /** A configuração da última página: trocar de configuração volta ao topo. */
  let lastKey: string | null = null

  const build = async (): Promise<void> => {
    const { session, openConfigurationKey, fragmentDocuments } = get()
    if (session === null) return
    const edited = new Map(
      [...fragmentDocuments.values()]
        .filter(isModified)
        .map((document) => [document.path, document.text])
    )
    const result = await services.previewPage.execute(session.project, openConfigurationKey, edited)
    // O projeto foi fechado ou trocado enquanto a página era montada.
    if (get().session?.folder !== session.folder) return
    if (openConfigurationKey !== lastKey) {
      lastKey = openConfigurationKey
      set({ pageScroll: 0 })
    }
    set({
      pagePreview: result.kind === 'page' ? { ...result, version: ++version } : result
    })
  }

  return {
    async refreshPage() {
      if (running !== null) {
        again = true
        return running
      }
      running = (async () => {
        do {
          again = false
          await build()
        } while (again)
      })()
      try {
        await running
      } finally {
        running = null
      }
    },

    setPageWidth(width) {
      set({ pageWidth: width })
    },

    setPageScroll(y) {
      set({ pageScroll: y })
    }
  }
}
```

- [ ] **Passo 8: Montar as ações em `src/renderer/src/ui/stores/project-store.ts`**

Troque:

<!-- prettier-ignore -->
```ts
} from './fragments-actions'
import {
  createGenerationActions,
  GENERATION_CLOSED,
```

por:

<!-- prettier-ignore -->
```ts
} from './fragments-actions'
import {
  createPagesActions,
  PAGES_CLOSED,
  type PagesServices,
  type PagesState
} from './pages-actions'
import {
  createGenerationActions,
  GENERATION_CLOSED,
```

Troque:

<!-- prettier-ignore -->
```ts
/** Casos de uso e serviços de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices
  extends AssetsServices, GenerationServices, FragmentsServices {
  readonly openProject: {
    execute(): Promise<OpenProjectResult>
```

por:

<!-- prettier-ignore -->
```ts
/** Casos de uso e serviços de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices
  extends AssetsServices, GenerationServices, FragmentsServices, PagesServices {
  readonly openProject: {
    execute(): Promise<OpenProjectResult>
```

Troque:

<!-- prettier-ignore -->
```ts
}

export interface ProjectState extends AssetsState, GenerationState, FragmentsState {
  readonly session: ProjectSession | null
  /** O projeto como está no disco; comparar com a sessão diz se há alterações. */
```

por:

<!-- prettier-ignore -->
```ts
}

export interface ProjectState extends AssetsState, GenerationState, FragmentsState, PagesState {
  readonly session: ProjectSession | null
  /** O projeto como está no disco; comparar com a sessão diz se há alterações. */
```

Troque:

<!-- prettier-ignore -->
```ts
  ...ASSETS_CLOSED,
  ...GENERATION_CLOSED,
  ...FRAGMENTS_CLOSED
} satisfies Partial<ProjectState>
```

por:

<!-- prettier-ignore -->
```ts
  ...ASSETS_CLOSED,
  ...GENERATION_CLOSED,
  ...FRAGMENTS_CLOSED,
  ...PAGES_CLOSED
} satisfies Partial<ProjectState>
```

Troque:

<!-- prettier-ignore -->
```ts
      ...createGenerationActions(set, get, services),
      ...createFragmentsActions(set, get, services),

      async loadRecents() {
```

por:

<!-- prettier-ignore -->
```ts
      ...createGenerationActions(set, get, services),
      ...createFragmentsActions(set, get, services),
      ...createPagesActions(set, get, services),

      async loadRecents() {
```

- [ ] **Passo 9: "Abrir no navegador", em `src/renderer/src/ui/stores/generation-actions.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import type { StoreApi } from 'zustand/vanilla'
import type { OutputFolderOpener } from '@/application/ports/output-folder-opener'
import type {
```

por:

<!-- prettier-ignore -->
```ts
import type { StoreApi } from 'zustand/vanilla'
import type { AssetOpener } from '@/application/ports/asset-opener'
import type { OutputFolderOpener } from '@/application/ports/output-folder-opener'
import type {
```

Troque:

<!-- prettier-ignore -->
```ts
  GenerateProductResult
} from '@/application/use-cases/generate-product'
import type { Project } from '@/domain/project/project'
import type { ProjectState } from './project-store'
```

por:

<!-- prettier-ignore -->
```ts
  GenerateProductResult
} from '@/application/use-cases/generate-product'
import { PAGE_PATH } from '@/domain/pages/page-layout'
import type { Project } from '@/domain/project/project'
import type { ProjectState } from './project-store'
```

Troque:

<!-- prettier-ignore -->
```ts
  }
  readonly outputFolderOpener: OutputFolderOpener
}
```

por:

<!-- prettier-ignore -->
```ts
  }
  readonly outputFolderOpener: OutputFolderOpener
  /** Abre a página gerada no navegador padrão, como qualquer arquivo do projeto (Fase 8). */
  readonly assetOpener: AssetOpener
}
```

Troque:

<!-- prettier-ignore -->
```ts
  generateProduct(key: string, options?: GenerateOptions): Promise<GenerateProductResult | null>
  openGeneratedFolder(): Promise<void>
  dismissLastGeneration(): void
}
```

por:

<!-- prettier-ignore -->
```ts
  generateProduct(key: string, options?: GenerateOptions): Promise<GenerateProductResult | null>
  openGeneratedFolder(): Promise<void>
  /** Abre o `index.html` da última geração no programa padrão do sistema (Fase 8). */
  openGeneratedPage(): Promise<void>
  dismissLastGeneration(): void
}
```

Troque:

<!-- prettier-ignore -->
```ts
    },

    dismissLastGeneration() {
      set({ lastGeneration: null })
```

por:

<!-- prettier-ignore -->
```ts
    },

    async openGeneratedPage() {
      const last = get().lastGeneration
      if (last === null) return
      const page = `${last.folder}/${PAGE_PATH}`
      const opened = await services.assetOpener.open(page)
      if (!opened.ok) set({ notice: `Não foi possível abrir ${page}: ${opened.error.message}` })
    },

    dismissLastGeneration() {
      set({ lastGeneration: null })
```

- [ ] **Passo 10: Abrir um fragmento numa linha, em `src/renderer/src/ui/stores/fragments-actions.ts`**

Troque:

<!-- prettier-ignore -->
```ts
  /** Os fragmentos salvos com erro de XML, com o primeiro problema, para a faixa de avisos. */
  readonly fragmentWarnings: ReadonlyMap<string, FileProblem>

  /** Lê as pastas do projeto (ao entrar na aba). */
```

por:

<!-- prettier-ignore -->
```ts
  /** Os fragmentos salvos com erro de XML, com o primeiro problema, para a faixa de avisos. */
  readonly fragmentWarnings: ReadonlyMap<string, FileProblem>
  /** Uma linha a mostrar no editor quando o arquivo aparecer (um problema da aba Páginas). */
  readonly fragmentReveal: { readonly path: string; readonly line: number } | null

  /** Lê as pastas do projeto (ao entrar na aba). */
```

Troque:

<!-- prettier-ignore -->
```ts
  /** Mostra o fragmento no editor, lendo-o do disco se ainda não estiver aberto. */
  showFragment(path: string): Promise<void>
  changeFragmentText(path: string, text: string): void
  /** Confere o texto atual. Se outra conferência do mesmo arquivo começou depois, esta é descartada. */
```

por:

<!-- prettier-ignore -->
```ts
  /** Mostra o fragmento no editor, lendo-o do disco se ainda não estiver aberto. */
  showFragment(path: string): Promise<void>
  /** Mostra o fragmento com o cursor na linha (Fase 8). */
  showFragmentAt(path: string, line: number): Promise<void>
  /** O editor já levou o cursor até a linha pedida. */
  clearFragmentReveal(): void
  changeFragmentText(path: string, text: string): void
  /** Confere o texto atual. Se outra conferência do mesmo arquivo começou depois, esta é descartada. */
```

Troque:

<!-- prettier-ignore -->
```ts
  shownFragmentPath: null,
  fragmentProblems: new Map<string, readonly FileProblem[]>(),
  fragmentWarnings: new Map<string, FileProblem>()
} satisfies Partial<FragmentsState>
```

por:

<!-- prettier-ignore -->
```ts
  shownFragmentPath: null,
  fragmentProblems: new Map<string, readonly FileProblem[]>(),
  fragmentWarnings: new Map<string, FileProblem>(),
  fragmentReveal: null
} satisfies Partial<FragmentsState>
```

Troque:

<!-- prettier-ignore -->
```ts
    },

    changeFragmentText(path, text) {
      const document = get().fragmentDocuments.get(path)
```

por:

<!-- prettier-ignore -->
```ts
    },

    async showFragmentAt(path, line) {
      set({ fragmentReveal: { path, line } })
      await get().showFragment(path)
    },

    clearFragmentReveal() {
      set({ fragmentReveal: null })
    },

    changeFragmentText(path, text) {
      const document = get().fragmentDocuments.get(path)
```

- [ ] **Passo 11: Injetar a visualização, em `src/renderer/src/ui/app/composition-root.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import { OpenFragment } from '@/application/use-cases/open-fragment'
import { OpenProject } from '@/application/use-cases/open-project'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { SaveFragments } from '@/application/use-cases/save-fragments'
```

por:

<!-- prettier-ignore -->
```ts
import { OpenFragment } from '@/application/use-cases/open-fragment'
import { OpenProject } from '@/application/use-cases/open-project'
import { PreviewPage } from '@/application/use-cases/preview-page'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { SaveFragments } from '@/application/use-cases/save-fragments'
```

Troque:

<!-- prettier-ignore -->
```ts
import { ElectronAssetOpener } from '@/infrastructure/electron/electron-asset-opener'
import { ElectronOutputFolderOpener } from '@/infrastructure/electron/electron-output-folder-opener'
import { ElectronProjectFilePicker } from '@/infrastructure/electron/electron-project-file-picker'
import { ElectronProjectFolderPicker } from '@/infrastructure/electron/electron-project-folder-picker'
```

por:

<!-- prettier-ignore -->
```ts
import { ElectronAssetOpener } from '@/infrastructure/electron/electron-asset-opener'
import { ElectronOutputFolderOpener } from '@/infrastructure/electron/electron-output-folder-opener'
import { ElectronPagePreviewHost } from '@/infrastructure/electron/electron-page-preview-host'
import { ElectronProjectFilePicker } from '@/infrastructure/electron/electron-project-file-picker'
import { ElectronProjectFolderPicker } from '@/infrastructure/electron/electron-project-folder-picker'
```

Troque:

<!-- prettier-ignore -->
```ts
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import { createProjectStore, type ProjectStore } from '@/ui/stores/project-store'
import { OUTPUT_DIRECTORY } from '../../../../shared/ipc'

/**
```

por:

<!-- prettier-ignore -->
```ts
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import { createProjectStore, type ProjectStore } from '@/ui/stores/project-store'
import { OUTPUT_DIRECTORY, PREVIEW_ADDRESS } from '../../../../shared/ipc'

/**
```

Troque:

<!-- prettier-ignore -->
```ts
    html: new HtmlFragmentChecker()
  })
  return createProjectStore({
    openProject: new OpenProject({ picker, recents, ...repositories }),
```

por:

<!-- prettier-ignore -->
```ts
    html: new HtmlFragmentChecker()
  })
  // A mesma página da geração serve a visualização da aba Páginas.
  const pageDeriver = new HtmlPageDeriver(storage)
  return createProjectStore({
    openProject: new OpenProject({ picker, recents, ...repositories }),
```

Troque:

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

por:

<!-- prettier-ignore -->
```ts
    generateProduct: new GenerateProduct({
      resolveConfiguration,
      deriver: new CombinedProductDeriver([new XmlProductDeriver(storage, validator), pageDeriver]),
      writer: new WriteProductFolder(storage, OUTPUT_DIRECTORY),
      clock: new SystemClock()
```

Troque:

<!-- prettier-ignore -->
```ts
    openFragment: new OpenFragment(storage),
    saveFragments: new SaveFragments({ storage, checker: fragmentChecker }),
    fragmentChecker
  })
}
```

por:

<!-- prettier-ignore -->
```ts
    openFragment: new OpenFragment(storage),
    saveFragments: new SaveFragments({ storage, checker: fragmentChecker }),
    fragmentChecker,
    previewPage: new PreviewPage({
      resolveConfiguration,
      previewer: pageDeriver,
      host: new ElectronPagePreviewHost(PREVIEW_ADDRESS)
    })
  })
}
```

- [ ] **Passo 12: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/pages-store-check.mts
```

Esperado:

```
antes de montar                      → idle
sem configuração aberta              → no-configuration | chamadas: null (sem editados)
configuração a                       → página, versão 1 | chamadas: a (sem editados)
— três pedidos seguidos
montagens                            → 2: a (sem editados) ; a (sem editados)
fica a mais nova                     → página, versão 3
a rolagem continua                   → 900
— outra configuração
configuração b                       → página, versão 4 | rolagem: 0
— fechar durante a montagem
depois de fechar                     → idle | largura: full | rolagem: 0
```

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

```tsx
import { FileOutput } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { generationBlockedReason } from './configuration-texts'
import { useGenerateProduct } from './use-generate-product'

/**
 * "Gerar produto" (SPEC §7), nas abas Configurações e Páginas: só com a configuração
 * completa; a dica diz o que falta.
 */
export function GenerateButton({
  configurationKey,
  onOpenDialog
}: {
  readonly configurationKey: string
  readonly onOpenDialog: (dialog: EditorDialog) => void
}): React.JSX.Element {
  const resolution = useProjectStore((state) => state.openResolution())
  const generating = useProjectStore((state) => state.generating)
  const generate = useGenerateProduct(onOpenDialog)
  const blocked = resolution === null ? null : generationBlockedReason(resolution)

  return (
    // Um botão desligado não mostra a dica: ela fica no elemento de fora.
    <span title={blocked ?? undefined}>
      <Button
        size="sm"
        disabled={resolution === null || blocked !== null || generating}
        onClick={() => void generate(configurationKey)}
      >
        <FileOutput /> {generating ? 'Gerando…' : 'Gerar produto'}
      </Button>
    </span>
  )
}
```

- [ ] **Passo 2: O configurador usa o botão e passa a página à faixa, em `src/renderer/src/ui/screens/configurator/ConfiguratorWorkspace.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
import { Copy, FileOutput, Pencil, Trash2 } from 'lucide-react'
import type { ConfigurationEntry, Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
```

por:

<!-- prettier-ignore -->
```tsx
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { projectHasPage } from '@/domain/pages/page-assembly'
import type { ConfigurationEntry, Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
```

Troque:

<!-- prettier-ignore -->
```tsx
import { ConfigurationList } from './ConfigurationList'
import { ConfigurationProblems } from './ConfigurationProblems'
import { generationBlockedReason } from './configuration-texts'
import { GenerationBanner } from './GenerationBanner'
import { useGenerateProduct } from './use-generate-product'

const CONFIGURE: DiagramMode = { kind: 'configure' }
```

por:

<!-- prettier-ignore -->
```tsx
import { ConfigurationList } from './ConfigurationList'
import { ConfigurationProblems } from './ConfigurationProblems'
import { GenerateButton } from './GenerateButton'
import { GenerationBanner } from './GenerationBanner'

const CONFIGURE: DiagramMode = { kind: 'configure' }
```

Troque:

<!-- prettier-ignore -->
```tsx
          <>
            <ConfigurationToolbar entry={entry} onOpenDialog={onOpenDialog} />
            <GenerationBanner configurationKey={entry.key} />
            <ConfigurationProblems model={project.model} />
            <div className="min-h-0 flex-1 rounded-md border">
```

por:

<!-- prettier-ignore -->
```tsx
          <>
            <ConfigurationToolbar entry={entry} onOpenDialog={onOpenDialog} />
            <GenerationBanner
              configurationKey={entry.key}
              hasPage={projectHasPage(project.assets)}
            />
            <ConfigurationProblems model={project.model} />
            <div className="min-h-0 flex-1 rounded-md border">
```

Troque:

<!-- prettier-ignore -->
```tsx
  )
}

/** "Gerar produto" (SPEC §7): só com a configuração completa; a dica diz o que falta. */
function GenerateButton({
  configurationKey,
  onOpenDialog
}: {
  readonly configurationKey: string
  readonly onOpenDialog: (dialog: EditorDialog) => void
}): React.JSX.Element {
  const resolution = useProjectStore((state) => state.openResolution())
  const generating = useProjectStore((state) => state.generating)
  const generate = useGenerateProduct(onOpenDialog)
  const blocked = resolution === null ? null : generationBlockedReason(resolution)

  return (
    // Um botão desligado não mostra a dica: ela fica no elemento de fora.
    <span title={blocked ?? undefined}>
      <Button
        size="sm"
        disabled={resolution === null || blocked !== null || generating}
        onClick={() => void generate(configurationKey)}
      >
        <FileOutput /> {generating ? 'Gerando…' : 'Gerar produto'}
      </Button>
    </span>
  )
}
```

por:

<!-- prettier-ignore -->
```tsx
  )
}
```

- [ ] **Passo 3: "Abrir no navegador", em `src/renderer/src/ui/screens/configurator/GenerationBanner.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
import { CircleCheck, FolderOpen, X } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'

/**
 * A faixa verde da última geração (SPEC §7). Só aparece com a configuração gerada aberta:
 * some ao trocar de configuração e volta ao voltar para ela.
 */
export function GenerationBanner({
  configurationKey
}: {
  readonly configurationKey: string
}): React.JSX.Element | null {
  const last = useProjectStore((state) => state.lastGeneration)
  const openFolder = useProjectStore((state) => state.openGeneratedFolder)
  const dismiss = useProjectStore((state) => state.dismissLastGeneration)
  if (last === null || last.key !== configurationKey) return null
```

por:

<!-- prettier-ignore -->
```tsx
import { CircleCheck, FolderOpen, Globe, X } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'

/**
 * A faixa verde da última geração (SPEC §7), nas abas Configurações e Páginas. Só aparece com
 * a configuração gerada aberta: some ao trocar de configuração e volta ao voltar para ela.
 * Com página no projeto, abre também o `index.html` no navegador (Fase 8).
 */
export function GenerationBanner({
  configurationKey,
  hasPage
}: {
  readonly configurationKey: string
  readonly hasPage: boolean
}): React.JSX.Element | null {
  const last = useProjectStore((state) => state.lastGeneration)
  const openFolder = useProjectStore((state) => state.openGeneratedFolder)
  const openPage = useProjectStore((state) => state.openGeneratedPage)
  const dismiss = useProjectStore((state) => state.dismissLastGeneration)
  if (last === null || last.key !== configurationKey) return null
```

Troque:

<!-- prettier-ignore -->
```tsx
        <FolderOpen /> Abrir pasta
      </Button>
      <Button size="icon-sm" variant="ghost" title="Dispensar" onClick={dismiss}>
        <X />
```

por:

<!-- prettier-ignore -->
```tsx
        <FolderOpen /> Abrir pasta
      </Button>
      {hasPage && (
        <Button size="sm" variant="outline" onClick={() => void openPage()}>
          <Globe /> Abrir no navegador
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" title="Dispensar" onClick={dismiss}>
        <X />
```

- [ ] **Passo 4: A lista só para escolher, em `src/renderer/src/ui/screens/configurator/ConfigurationList.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
interface ConfigurationListProps {
  readonly configurations: readonly ConfigurationEntry[]
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/** A lista de configurações do projeto; um clique abre a configuração no diagrama. */
export function ConfigurationList({
  configurations,
```

por:

<!-- prettier-ignore -->
```tsx
interface ConfigurationListProps {
  readonly configurations: readonly ConfigurationEntry[]
  /** Sem ele, a lista só serve para escolher, sem "Nova" (a aba Páginas). */
  readonly onOpenDialog?: (dialog: EditorDialog) => void
}

/**
 * A lista de configurações do projeto; um clique abre a configuração, a mesma nas abas
 * Configurações e Páginas.
 */
export function ConfigurationList({
  configurations,
```

Troque:

<!-- prettier-ignore -->
```tsx
          Configurações
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpenDialog({ kind: 'new-configuration' })}
        >
          <Plus /> Nova
        </Button>
      </div>
      {configurations.length === 0 && (
```

por:

<!-- prettier-ignore -->
```tsx
          Configurações
        </h2>
        {onOpenDialog !== undefined && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenDialog({ kind: 'new-configuration' })}
          >
            <Plus /> Nova
          </Button>
        )}
      </div>
      {configurations.length === 0 && (
```

- [ ] **Passo 5: Criar `src/renderer/src/ui/screens/pages/PageFrame.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { cn } from 'cn'
import type { PageWidth } from '@/ui/stores/pages-actions'
import { useProjectStoreApi } from '@/ui/stores/project-store-context'

/** As larguras da página: celular, tablet e a largura toda. */
const WIDTH_CLASS: Readonly<Record<PageWidth, string>> = {
  mobile: 'w-[375px]',
  tablet: 'w-[768px]',
  full: 'w-full'
}

/**
 * O sandbox da página (ADR 0011): scripts, formulários, alertas e janelas (que o main manda
 * para o navegador do sistema). Sem `allow-same-origin`, a página fica numa origem opaca e não
 * enxerga o app; sem `allow-top-navigation`, não troca a janela do app.
 */
const SANDBOX = 'allow-scripts allow-popups allow-forms allow-modals'

interface PageFrameProps {
  readonly address: string
  /** Muda a cada montagem: o quadro recarrega, com a rolagem guardada. */
  readonly version: number
  readonly width: PageWidth
}

/** A página da configuração, num quadro isolado do app. */
export function PageFrame({ address, version, width }: PageFrameProps): React.JSX.Element {
  const frame = useRef<HTMLIFrameElement>(null)
  const store = useProjectStoreApi()

  useEffect(() => {
    const current = frame.current
    if (current === null) return
    const y = Math.round(store.getState().pageScroll)
    current.src = `${address}?y=${y}&v=${version}`
  }, [address, version, store])

  // As mensagens do script da visualização: a rolagem e o Ctrl+S (a página não enxerga o app,
  // e com o foco nela as teclas não chegam a ele). Só valem as que vêm deste quadro.
  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (frame.current === null || event.source !== frame.current.contentWindow) return
      const data: unknown = event.data
      if (typeof data !== 'object' || data === null || !('mddPreview' in data)) return
      const message = data as { readonly mddPreview: unknown; readonly y?: unknown }
      const state = store.getState()
      if (message.mddPreview === 'scroll' && typeof message.y === 'number') {
        state.setPageScroll(message.y)
      } else if (message.mddPreview === 'save') {
        void state.save()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [store])

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-muted p-3">
      <iframe
        ref={frame}
        title="Página da configuração"
        data-page-frame
        sandbox={SANDBOX}
        className={cn(
          'h-full shrink-0 rounded-md bg-white shadow-sm ring-1 ring-border',
          WIDTH_CLASS[width]
        )}
      />
    </div>
  )
}
```

- [ ] **Passo 6: Criar `src/renderer/src/ui/screens/pages/PageBar.tsx`**

```tsx
import { LayoutTemplate, Monitor, RotateCw, Smartphone, Tablet } from 'lucide-react'
import type { ConfigurationEntry } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { GenerateButton } from '@/ui/screens/configurator/GenerateButton'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'

const WIDTHS = [
  { width: 'mobile', label: 'Celular', Icon: Smartphone },
  { width: 'tablet', label: 'Tablet', Icon: Tablet },
  { width: 'full', label: 'Largura toda', Icon: Monitor }
] as const

interface PageBarProps {
  readonly entry: ConfigurationEntry
  readonly defaultFrame: boolean
  readonly onOpenDialog: (dialog: EditorDialog) => void
  readonly onCreateFrame: () => void
}

/** A barra acima da página: a configuração, as larguras, "Recarregar" e "Gerar produto". */
export function PageBar({
  entry,
  defaultFrame,
  onOpenDialog,
  onCreateFrame
}: PageBarProps): React.JSX.Element {
  const width = useProjectStore((state) => state.pageWidth)
  const setWidth = useProjectStore((state) => state.setPageWidth)
  const refresh = useProjectStore((state) => state.refreshPage)

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <div className="mr-auto min-w-0">
          <h2 className="truncate font-semibold">{entry.configuration.name}</h2>
          <p className="truncate font-mono text-xs text-muted-foreground">
            configurations/{entry.key}.xml
          </p>
        </div>
        <div role="group" aria-label="Largura da página" className="flex gap-0.5">
          {WIDTHS.map(({ width: target, label, Icon }) => (
            <Button
              key={target}
              size="sm"
              variant={width === target ? 'secondary' : 'ghost'}
              aria-pressed={width === target}
              onClick={() => setWidth(target)}
            >
              <Icon /> {label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          <RotateCw /> Recarregar
        </Button>
        <GenerateButton configurationKey={entry.key} onOpenDialog={onOpenDialog} />
      </div>
      {defaultFrame && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LayoutTemplate className="size-3.5" />
          Sem moldura.html: a página usa a moldura padrão.
          <Button size="xs" variant="link" className="h-auto p-0" onClick={onCreateFrame}>
            Criar moldura
          </Button>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Passo 7: Criar `src/renderer/src/ui/screens/pages/PageProblems.tsx`**

```tsx
import type { FileProblem } from '@/application/file-problem'

interface PageProblemsProps {
  readonly problems: readonly FileProblem[]
  /** Abre o arquivo na aba Fragmentos, com o cursor na linha. */
  readonly onOpen: (file: string, line: number) => void
}

/**
 * Os problemas da página (Fase 8): a página aparece assim mesmo, e a geração os recusa.
 * Clicar num problema abre o arquivo na linha.
 */
export function PageProblems({ problems, onOpen }: PageProblemsProps): React.JSX.Element | null {
  if (problems.length === 0) return null
  return (
    <section className="rounded-md border border-destructive/40">
      <h3 className="border-b px-3 py-1 text-xs font-medium text-destructive">
        {problems.length === 1 ? '1 problema' : `${problems.length} problemas`}: a página aparece
        assim mesmo, mas a geração recusa
      </h3>
      <ul data-page-problems className="max-h-40 overflow-auto py-1 text-sm">
        {problems.map((problem, index) => (
          <li key={index}>
            <button
              type="button"
              className="flex w-full gap-3 px-3 py-0.5 text-left hover:bg-accent"
              onClick={() => onOpen(problem.file, problem.line ?? 1)}
            >
              <span className="shrink-0 font-mono text-xs leading-5 text-destructive">
                {problem.file}
                {problem.line !== undefined && `:${problem.line}`}
              </span>
              <span>{problem.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Passo 8: Criar `src/renderer/src/ui/screens/pages/PagesWorkspace.tsx`**

```tsx
import { useCallback, useEffect, useRef } from 'react'
import { FilePlus2 } from 'lucide-react'
import type { Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { ConfigurationList } from '@/ui/screens/configurator/ConfigurationList'
import { generationBlockedReason } from '@/ui/screens/configurator/configuration-texts'
import { GenerationBanner } from '@/ui/screens/configurator/GenerationBanner'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useWindowFocus } from '@/ui/screens/project/use-window-focus'
import { openConfigurationEntry } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { PageBar } from './PageBar'
import { PageFrame } from './PageFrame'
import { PageProblems } from './PageProblems'

/** A página é montada de novo meio segundo depois da última mudança no que entra nela. */
const REFRESH_DELAY_MS = 500

interface PagesWorkspaceProps {
  readonly project: Project
  readonly onOpenDialog: (dialog: EditorDialog) => void
  /** Leva à aba Fragmentos com o arquivo aberto na linha. */
  readonly onShowFragmentAt: (path: string, line: number) => void
  /** Leva à aba Fragmentos com o diálogo "Novo fragmento". */
  readonly onNewFragment: () => void
  /** Cria a `moldura.html` com a moldura padrão e a abre na aba Fragmentos. */
  readonly onCreateFrame: () => Promise<void>
}

/**
 * Aba Páginas (Fase 8): a lista de configurações só para escolher, e a página da configuração
 * aberta, montada ao vivo do projeto como está na tela, num quadro isolado do app.
 */
export function PagesWorkspace({
  project,
  onOpenDialog,
  onShowFragmentAt,
  onNewFragment,
  onCreateFrame
}: PagesWorkspaceProps): React.JSX.Element {
  const entry = useProjectStore(openConfigurationEntry)
  const preview = useProjectStore((state) => state.pagePreview)
  const width = useProjectStore((state) => state.pageWidth)
  const documents = useProjectStore((state) => state.fragmentDocuments)
  const resolution = useProjectStore((state) => state.openResolution())
  const refresh = useProjectStore((state) => state.refreshPage)

  // O projeto (modelo, assets e configurações), a configuração aberta e o texto dos
  // fragmentos abertos: qualquer mudança monta a página de novo, um pouco depois. Ao entrar na
  // aba, na hora: o main ainda guarda a página da última visita.
  const entered = useRef(false)
  useEffect(() => {
    if (!entered.current) {
      entered.current = true
      void refresh()
      return
    }
    const timer = setTimeout(() => void refresh(), REFRESH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [project, entry, documents, refresh])
  // Um arquivo pode ter mudado fora do app, com a janela em segundo plano.
  useWindowFocus(useCallback(() => void refresh(), [refresh]))

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[15rem_1fr]">
      <ConfigurationList configurations={project.configurations} />
      <section data-pages className="flex min-h-0 flex-col gap-3 p-4">
        {preview.kind === 'page' && entry !== null ? (
          <>
            <PageBar
              entry={entry}
              defaultFrame={preview.defaultFrame}
              onOpenDialog={onOpenDialog}
              onCreateFrame={() => void onCreateFrame()}
            />
            <GenerationBanner configurationKey={entry.key} hasPage />
            <PageFrame address={preview.address} version={preview.version} width={width} />
            <PageProblems problems={preview.problems} onOpen={onShowFragmentAt} />
          </>
        ) : (
          <div data-page-empty className="max-w-prose space-y-3 text-sm text-muted-foreground">
            {preview.kind === 'no-page' ? (
              <>
                <p>
                  Este projeto ainda não tem página. Ela é montada a partir dos fragmentos HTML:
                  vincule um arquivo <code>.html</code> a uma feature, e cada configuração ganha uma
                  página com as seções das features selecionadas.
                </p>
                <Button size="sm" onClick={onNewFragment}>
                  <FilePlus2 /> Novo fragmento
                </Button>
              </>
            ) : preview.kind === 'blocked' && resolution !== null ? (
              <p>
                A página aparece quando a configuração estiver completa.{' '}
                {generationBlockedReason(resolution)}
              </p>
            ) : preview.kind === 'idle' || (preview.kind === 'page' && entry === null) ? (
              <p>Montando a página…</p>
            ) : (
              <p>
                {project.configurations.length === 0
                  ? 'Crie uma configuração na aba Configurações para ver a página dela.'
                  : 'Escolha uma configuração à esquerda.'}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Passo 9: A aba, em `src/renderer/src/ui/screens/project/ViewRail.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
import { FileCode2, ListChecks, Network, Paperclip } from 'lucide-react'
import { cn } from 'cn'

/** As abas da barra lateral (SPEC §7). */
export type ProjectView = 'model' | 'configurations' | 'assets' | 'fragments'

const VIEWS = [
```

por:

<!-- prettier-ignore -->
```tsx
import { FileCode2, Globe, ListChecks, Network, Paperclip } from 'lucide-react'
import { cn } from 'cn'

/** As abas da barra lateral (SPEC §7). */
export type ProjectView = 'model' | 'configurations' | 'assets' | 'fragments' | 'pages'

const VIEWS = [
```

Troque:

<!-- prettier-ignore -->
```tsx
  { view: 'configurations', label: 'Configurações', Icon: ListChecks },
  { view: 'assets', label: 'Assets', Icon: Paperclip },
  { view: 'fragments', label: 'Fragmentos', Icon: FileCode2 }
] as const
```

por:

<!-- prettier-ignore -->
```tsx
  { view: 'configurations', label: 'Configurações', Icon: ListChecks },
  { view: 'assets', label: 'Assets', Icon: Paperclip },
  { view: 'fragments', label: 'Fragmentos', Icon: FileCode2 },
  { view: 'pages', label: 'Páginas', Icon: Globe }
] as const
```

E em `src/renderer/src/ui/screens/project/ProjectScreen.tsx`:

Troque:

<!-- prettier-ignore -->
```tsx
import { X } from 'lucide-react'
import type { ProjectSession } from '@/application/project-session'
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
```

por:

<!-- prettier-ignore -->
```tsx
import { X } from 'lucide-react'
import type { ProjectSession } from '@/application/project-session'
import { FRAME_PATH } from '@/domain/pages/page-layout'
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
```

Troque:

<!-- prettier-ignore -->
```tsx
import { FragmentStatusBar } from '@/ui/screens/fragments/FragmentStatusBar'
import { FragmentsWorkspace } from '@/ui/screens/fragments/FragmentsWorkspace'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
```

por:

<!-- prettier-ignore -->
```tsx
import { FragmentStatusBar } from '@/ui/screens/fragments/FragmentStatusBar'
import { FragmentsWorkspace } from '@/ui/screens/fragments/FragmentsWorkspace'
import { PagesWorkspace } from '@/ui/screens/pages/PagesWorkspace'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
```

Troque:

<!-- prettier-ignore -->
```tsx
  const refreshFragments = useProjectStore((state) => state.refreshFragments)
  const showFragment = useProjectStore((state) => state.showFragment)
  const [view, setView] = useState<ProjectView>('model')
  const [dialog, setDialog] = useState<EditorDialog>(null)
```

por:

<!-- prettier-ignore -->
```tsx
  const refreshFragments = useProjectStore((state) => state.refreshFragments)
  const showFragment = useProjectStore((state) => state.showFragment)
  const showFragmentAt = useProjectStore((state) => state.showFragmentAt)
  const createFragment = useProjectStore((state) => state.createFragment)
  const [view, setView] = useState<ProjectView>('model')
  const [dialog, setDialog] = useState<EditorDialog>(null)
```

Troque:

<!-- prettier-ignore -->
```tsx
    [showFragment]
  )
  const allWarnings = useMemo(
    () => [...warnings, ...fragmentWarnings.values()],
```

por:

<!-- prettier-ignore -->
```tsx
    [showFragment]
  )
  // Da aba Páginas: um problema, "Novo fragmento" e "Criar moldura" levam à aba Fragmentos.
  const showFragmentAtLine = useCallback(
    (path: string, line: number) => {
      setView('fragments')
      void showFragmentAt(path, line)
    },
    [showFragmentAt]
  )
  const newFragmentFromPages = useCallback(() => {
    setView('fragments')
    openDialog({ kind: 'new-fragment' })
  }, [openDialog])
  // As pastas são relidas antes: a lista pode ter uma moldura apagada por fora. Se ela existir
  // de fato, é aberta.
  const createFrame = useCallback(async () => {
    await refreshFragments()
    if (createFragment(FRAME_PATH) !== null) void showFragment(FRAME_PATH)
    setView('fragments')
  }, [refreshFragments, createFragment, showFragment])
  const allWarnings = useMemo(
    () => [...warnings, ...fragmentWarnings.values()],
```

Troque:

<!-- prettier-ignore -->
```tsx
          />
        )}
      </div>

      <footer className="border-t px-4 py-1 text-xs text-muted-foreground">
        {view === 'configurations' ? (
          <ConfigurationStatusBar />
        ) : view === 'fragments' ? (
```

por:

<!-- prettier-ignore -->
```tsx
          />
        )}
        {view === 'pages' && (
          <PagesWorkspace
            project={project}
            onOpenDialog={openDialog}
            onShowFragmentAt={showFragmentAtLine}
            onNewFragment={newFragmentFromPages}
            onCreateFrame={createFrame}
          />
        )}
      </div>

      <footer className="border-t px-4 py-1 text-xs text-muted-foreground">
        {view === 'configurations' || view === 'pages' ? (
          <ConfigurationStatusBar />
        ) : view === 'fragments' ? (
```

- [ ] **Passo 10: A linha pedida pela aba Páginas, em `src/renderer/src/ui/screens/fragments/FragmentEditor.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
import { useEffect, useRef } from 'react'
import { setDiagnostics } from '@codemirror/lint'
import { EditorSelection } from '@codemirror/state'
```

por:

<!-- prettier-ignore -->
```tsx
import { useCallback, useEffect, useRef } from 'react'
import { setDiagnostics } from '@codemirror/lint'
import { EditorSelection } from '@codemirror/state'
```

Troque:

<!-- prettier-ignore -->
```tsx
  /** Os marcadores de atributo do modelo (`feature.atributo`), sugeridos nos fragmentos HTML. */
  readonly attributeMarkers: readonly string[]
}
```

por:

<!-- prettier-ignore -->
```tsx
  /** Os marcadores de atributo do modelo (`feature.atributo`), sugeridos nos fragmentos HTML. */
  readonly attributeMarkers: readonly string[]
  /** Uma linha a mostrar quando este arquivo estiver no editor (um problema da aba Páginas). */
  readonly reveal: { readonly path: string; readonly line: number } | null
  readonly onRevealed: () => void
}
```

Troque:

<!-- prettier-ignore -->
```tsx
  states,
  onChange,
  attributeMarkers
}: FragmentEditorProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
```

por:

<!-- prettier-ignore -->
```tsx
  states,
  onChange,
  attributeMarkers,
  reveal,
  onRevealed
}: FragmentEditorProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
```

Troque:

<!-- prettier-ignore -->
```tsx
  }, [states, path, text, readOnly, problems])

  const goToLine = (line: number): void => {
    const current = view.current
    if (current === null) return
```

por:

<!-- prettier-ignore -->
```tsx
  }, [states, path, text, readOnly, problems])

  const goToLine = useCallback((line: number): void => {
    const current = view.current
    if (current === null) return
```

Troque:

<!-- prettier-ignore -->
```tsx
    })
    current.focus()
  }

  return (
```

por:

<!-- prettier-ignore -->
```tsx
    })
    current.focus()
  }, [])

  // A linha pedida pela aba Páginas, quando o arquivo dela já está no editor.
  useEffect(() => {
    if (reveal === null || reveal.path !== path) return
    goToLine(reveal.line)
    onRevealed()
  }, [reveal, path, text, goToLine, onRevealed])

  return (
```

E em `src/renderer/src/ui/screens/fragments/FragmentsWorkspace.tsx`:

Troque:

<!-- prettier-ignore -->
```tsx
  const checkFragment = useProjectStore((state) => state.checkFragment)
  const refresh = useProjectStore((state) => state.refreshFragments)

  // Entrar na aba lê as pastas; nas outras vezes, também relê os fragmentos sem alteração.
```

por:

<!-- prettier-ignore -->
```tsx
  const checkFragment = useProjectStore((state) => state.checkFragment)
  const refresh = useProjectStore((state) => state.refreshFragments)
  const reveal = useProjectStore((state) => state.fragmentReveal)
  const clearReveal = useProjectStore((state) => state.clearFragmentReveal)

  // Entrar na aba lê as pastas; nas outras vezes, também relê os fragmentos sem alteração.
```

Troque:

<!-- prettier-ignore -->
```tsx
              onChange={changeText}
              attributeMarkers={attributeMarkers}
            />
          </>
```

por:

<!-- prettier-ignore -->
```tsx
              onChange={changeText}
              attributeMarkers={attributeMarkers}
              reveal={reveal}
              onRevealed={clearReveal}
            />
          </>
```

- [ ] **Passo 11: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: os dois sem erro.

- [ ] **Passo 12: O `.checks/main-process.mjs` registra também o `shell.openExternal`**

O arquivo inteiro:

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
    globalThis.__main = { files: [], opened: [], failOpen: [], external: [] }
    const state = globalThis.__main
    dialog.showOpenDialog = async (...args) => {
      const options = args.at(-1)
      const answer = state.files.shift()
      state.lastDialog = { title: options.title, defaultPath: options.defaultPath, properties: options.properties }
      return answer === undefined ? { canceled: true, filePaths: [] } : { canceled: false, filePaths: [answer] }
    }
    shell.openExternal = async (url) => {
      state.external.push(url)
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
    /** Os endereços que o app mandou para o navegador do sistema, desde a última leitura. */
    external: () => evaluate('globalThis.__main.external.splice(0).join(" | ")'),
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

- [ ] **Passo 13: Escrever o roteiro `.checks/aba-paginas-ui.mjs`**

```js
// Roteiro da aba Páginas com entrada real (Fase 8), sobre uma cópia do exemplo herby: o quadro
// isolado, as larguras, a atualização ao editar, os problemas, a moldura padrão, gerar e abrir
// no navegador, e o Ctrl+S com o foco na página.
// Uso: EXAMPLE=herby bash .checks/run-ui.sh <app.exe | dev> .checks/aba-paginas-ui.mjs 9229
import { readFileSync, rmSync } from 'node:fs'
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
const { click, fill, press, js, send, title, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))

/** O quadro da página: um alvo à parte no protocolo, porque a página fica em outra origem. */
async function frame() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    const target = targets.find((t) => t.url.startsWith('mdd-page://'))
    if (target) {
      const ws = new WebSocket(target.webSocketDebuggerUrl)
      await new Promise((resolve) => ws.addEventListener('open', resolve))
      let id = 0
      const evaluate = (expression) =>
        new Promise((resolve) => {
          const mine = ++id
          ws.addEventListener('message', function on(event) {
            const message = JSON.parse(event.data)
            if (message.id !== mine) return
            ws.removeEventListener('message', on)
            resolve(
              message.result?.result?.value ??
                message.result?.exceptionDetails?.exception?.description ??
                message.error?.message
            )
          })
          ws.send(
            JSON.stringify({
              id: mine,
              method: 'Runtime.evaluate',
              params: { expression, returnByValue: true, awaitPromise: true }
            })
          )
        })
      // A página pode estar recarregando: espera o documento completo.
      for (
        let wait = 0;
        wait < 40 && (await evaluate('document.readyState')) !== 'complete';
        wait++
      ) {
        await sleep(100)
      }
      return { evaluate, close: () => ws.close() }
    }
    await sleep(250)
  }
  throw new Error('não achei o quadro da página')
}
/** A versão da página no quadro (o `v=` do endereço); 0 sem quadro. */
const version = () =>
  js(
    `Number(new URL(document.querySelector('[data-page-frame]')?.src || 'x:?v=0').searchParams.get('v'))`
  )
/** Espera uma montagem mais nova que a versão `than` e devolve o quadro com ela. */
async function newer(than) {
  await waitFor(
    `Number(new URL(document.querySelector('[data-page-frame]')?.src || 'x:?v=0').searchParams.get('v')) > ${than}`,
    20000
  )
  await sleep(800)
  return frame()
}
const empty = () =>
  js(
    `document.querySelector('[data-page-empty]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '(página)'`
  )
const bar = () =>
  js(`document.querySelector('[data-pages] > div')?.innerText.replace(/\\s+/g, ' ').trim()`)
const problems = () =>
  js(
    `[...document.querySelectorAll('[data-page-problems] button')].map((b) => b.innerText.replace(/\\s+/g, ' ')).join(' | ') || '(nenhum)'`
  )
const VIEW = `document.querySelector('.cm-content').cmTile.root.view`
const clickAfter = async (needle) => {
  const box = await js(`(() => {
    const view = ${VIEW}
    const found = view.state.doc.toString().indexOf(${JSON.stringify(needle)})
    if (found < 0) return null
    const at = view.coordsAtPos(found + ${needle.length})
    return { x: at.left, y: (at.top + at.bottom) / 2 }
  })()`)
  if (box === null) throw new Error(`não achei ${needle} no editor`)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type,
      x: box.x,
      y: box.y,
      button: 'left',
      buttons: type === 'mousePressed' ? 1 : 0,
      clickCount: 1
    })
  }
  await sleep(200)
}
const discard = async () => {
  await click({ startsWith: 'Descartar alterações' })
  await click({ text: 'Descartar' })
  await waitFor(`document.querySelector('[role=dialog]') === null`)
}

// 1. A aba, sem configuração aberta
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Páginas' })
await sleep(800)
log('1. sem configuração', await empty())

// 2. A página de completa-atibaia, isolada do app
await click('[data-configuration-key="completa-atibaia"]')
await waitFor(`document.querySelector('[data-page-frame]')?.src.startsWith('mdd-page://')`, 20000)
let page = await frame()
log('2. barra', await bar())
log('   título da página', await page.evaluate('document.title'))
log('   window.mdd na página', await page.evaluate('typeof window.mdd'))
log(
  '   ler o parent',
  await page.evaluate(
    `(() => { try { return parent.document.title } catch (e) { return e.name } })()`
  )
)
log(
  '   imagens visíveis, quebradas',
  await page.evaluate(
    `(() => { const shown = [...document.images].filter((i) => !i.closest('template')); return shown.length + ', ' + shown.filter((i) => !i.complete || i.naturalWidth === 0).length })()`
  )
)
log('   problemas', await problems())

// 3. As larguras, com as media queries do CSS da página
for (const label of ['Celular', 'Tablet', 'Largura toda']) {
  await click({ startsWith: label })
  await sleep(400)
  log(
    `3. ${label}`,
    `${await page.evaluate('innerWidth')} px, celular no CSS: ${await page.evaluate(`matchMedia('(max-width: 600px)').matches`)}`
  )
}

// 4. Um link para fora vai para o navegador do sistema; a página fica
await page.evaluate(
  `(() => { const a = document.createElement('a'); a.href = 'https://example.com/ajuda'; document.body.append(a); a.click(); return 'ok' })()`
)
await sleep(800)
log('4. navegador do sistema', await main.external())
log('   o quadro continua em', String(await page.evaluate('location.href')).replace(/\?.*/, ''))

// 5. Editar um fragmento sem salvar: a página muda, na mesma rolagem
await page.evaluate('scrollTo(0, 900)')
await sleep(500)
page.close()
let seen = await version()
await click({ text: 'Fragmentos' })
await waitFor(`document.querySelectorAll('[data-fragment-path]').length > 0`)
await click('[data-fragment-path="fragmentos/plataforma.html"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Como funciona')`)
await clickAfter('Como funciona')
await send('Input.insertText', { text: ' (editado no app)' })
await sleep(300)
await click({ text: 'Páginas' })
page = await newer(seen)
log(
  '5. título da seção',
  await page.evaluate(`document.querySelector('#plataforma-01 h3').innerText`)
)
log('   rolagem', await page.evaluate('Math.round(scrollY)'))
log('   janela', await title())

// 6. Ctrl+S com o foco na página salva o projeto
await page.evaluate(`dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))`)
await waitFor(`!document.title.startsWith('•')`, 10000)
log(
  '6. Ctrl+S na página',
  `${await title()} | no disco: ${readFileSync(file('fragmentos/plataforma.html'), 'utf8').includes('(editado no app)') ? 'editado' : 'original'}`
)
page.close()

// 7. Um valor de atributo no configurador
await click({ text: 'Configurações' })
await waitFor(`document.querySelector('#value-herby-rede') !== null`)
await fill('#value-herby-rede', 'Atibaia (SP)')
await press('Enter')
await sleep(300)
seen = await version()
await click({ text: 'Páginas' })
page = await newer(seen)
log('7. subtítulo', await page.evaluate(`document.querySelector('.subtitulo').innerText`))
page.close()

// 8. Configuração incompleta: a página dá lugar ao que falta
await click({ text: 'Configurações' })
await click('[data-feature-id="lixeira"]')
await sleep(300)
await click({ text: 'Páginas' })
await sleep(1200)
log('8. incompleta', await empty())
await click({ text: 'Configurações' })
await click('[data-feature-id="lixeira"]')
await click('[data-feature-id="lixeira"]')
await sleep(300)

// 9. Um problema: a página aparece assim mesmo, e o clique leva à linha
await click({ text: 'Fragmentos' })
await click('[data-fragment-path="fragmentos/plataforma.html"]')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('Como funciona')`)
await clickAfter('<h2>{{herby.produto}}</h2>')
await send('Input.insertText', { text: '\n<div class="aberto">' })
await sleep(300)
await click({ text: 'Páginas' })
await waitFor(`document.querySelectorAll('[data-page-problems] button').length > 0`, 20000)
log('9. problemas', await problems())
page = await frame()
log('   a página continua', await page.evaluate(`document.querySelector('.capa h1').innerText`))
page.close()
await click('[data-page-problems] button')
await waitFor(`document.querySelector('.cm-content')?.innerText.includes('aberto')`)
await sleep(400)
log(
  '   cursor na linha',
  await js(`${VIEW}.state.doc.lineAt(${VIEW}.state.selection.main.head).number`)
)
await discard()

// 10. Sem moldura.html: a moldura padrão e "Criar moldura"
rmSync(file('moldura.html'))
await click({ text: 'Páginas' })
await waitFor(`document.querySelector('[data-page-frame]')?.src.startsWith('mdd-page://')`, 20000)
await sleep(1000)
seen = await version()
await click({ text: 'Recarregar' })
page = await newer(seen)
log('10. barra', await bar())
log('    título da página', await page.evaluate('document.title'))
page.close()
await click({ text: 'Criar moldura' })
await waitFor(`document.querySelector('[data-fragment-bar]')?.innerText.includes('moldura.html')`)
log(
  '    aba Fragmentos',
  await js(`document.querySelector('[data-fragment-bar]').innerText.replace(/\\s+/g, ' ')`)
)
await discard()

// 11. Gerar e abrir no navegador
await click({ text: 'Páginas' })
await waitFor(`document.querySelector('[data-page-frame]')?.src.startsWith('mdd-page://')`, 20000)
await click({ text: 'Gerar produto' })
await waitFor(`document.querySelector('[data-banner=generated]') !== null`, 60000)
await click({ text: 'Abrir no navegador' })
await sleep(500)
log(
  '11. faixa',
  await js(
    `document.querySelector('[data-banner=generated]').innerText.replace(/\\s+/g, ' ').replace(/\\d{2}:\\d{2}/, 'HH:MM')`
  )
)
log('    aberto no sistema', String(await main.opened()).replace(projectDir, '<projeto>'))

log('erros no console', errors.length === 0 ? 'nenhum' : errors.join(' | '))
ui.close()
main.close()
```

- [ ] **Passo 14: Rodar os roteiros de interface** (combine com o usuário: abrem janelas na tela dele)

```bash
npm run build
EXAMPLE=herby bash .checks/run-ui.sh dev .checks/aba-paginas-ui.mjs 9229
```

Esperado:

```
1. sem configuração                  → Escolha uma configuração à esquerda.
2. barra                             → Completa Atibaia configurations/completa-atibaia.xml Celular Tablet Largura toda Recarregar Gerar produto
   título da página                  → Avaliação Formativa - SAEMA 2026 — Completa Atibaia
   window.mdd na página              → undefined
   ler o parent                      → SecurityError
   imagens visíveis, quebradas       → 23, 0
   problemas                         → (nenhum)
3. Celular                           → 375 px, celular no CSS: true
3. Tablet                            → 768 px, celular no CSS: false
3. Largura toda                      → 874 px, celular no CSS: false
4. navegador do sistema              → https://example.com/ajuda
   o quadro continua em              → mdd-page://pagina/index.html
5. título da seção                   → Como funciona (editado no app)
   rolagem                           → 900
   janela                            → • Herby — mdd
6. Ctrl+S na página                  → Herby — mdd | no disco: editado
7. subtítulo                         → Atibaia (SP)2026
8. incompleta                        → A página aparece quando a configuração estiver completa. Complete a configuração para gerar: 1 indecisa.
9. problemas                         → fragmentos/plataforma.html:2 A tag <div> é aberta aqui e não é fechada neste arquivo.
   a página continua                 → Avaliação Formativa - SAEMA 2026
   cursor na linha                   → 2
10. barra                            → Completa Atibaia configurations/completa-atibaia.xml Celular Tablet Largura toda Recarregar Gerar produto Sem moldura.html: a página usa a moldura padrão. Criar moldura
    título da página                 → Completa Atibaia
    aba Fragmentos                   → moldura.html •
11. faixa                            → Produto gerado em saida/completa-atibaia/ às HH:MM Abrir pasta Abrir no navegador
    aberto no sistema                → <projeto>\saida\completa-atibaia\index.html
erros no console                     → nenhum
app fechado
```

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
8. faixa                             → Produto gerado em saida/completa-atibaia/ às HH:MM Abrir pasta Abrir no navegador
   index.html                        → idêntico ao esperado
   arquivos na saída                 → 60
   título                            → Herby — mdd
erros no console                     → nenhum
app fechado
```

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

```markdown
# Visualização da página num quadro isolado, servido por um esquema próprio

A aba Páginas (Fase 8) mostra a página da configuração aberta dentro do app, ao vivo. A página é do usuário: pode ter scripts e carregar recursos da internet, e não pode enxergar o app (`window.mdd`) nem o disco. Ela roda num `<iframe>` com `sandbox="allow-scripts allow-popups allow-forms allow-modals"`, sem `allow-same-origin`, servido pelo esquema próprio `mdd-page:`. O processo main registra o esquema (padrão e seguro) e responde a ele com a última página que o renderer montou (`mdd-page://pagina/index.html`, entregue pelo canal `setPreviewPage`) e com os arquivos do projeto aberto, só para leitura.

## Considered Options

- **`<iframe srcdoc>` ou uma URL `blob:`:** herdam a CSP do app (`script-src 'self'`), e a página perderia os scripts e as fontes da internet.
- **`WebContentsView`** (a página num processo à parte, posicionado sobre a aba): o isolamento é o mais forte, mas a vista fica por cima de tudo, inclusive dos diálogos e menus do app, e a posição e o tamanho teriam de acompanhar a aba a cada redimensionamento.
- **`<webview>`:** o Electron o desaconselha, e ele exige ligar o `webviewTag`.

## Consequences

- **A página fica numa origem opaca** (`self.origin` é `null`): ler o `parent` dá `SecurityError`, e o preload só existe no quadro principal, então `window.mdd` não existe nela. A resposta do esquema não tem CSP própria, e a do app não vale dentro do quadro: os scripts e a internet funcionam.
- **A CSP do app ganha só `frame-src mdd-page:`.** Ela também barra o quadro de navegar para fora do esquema, ainda no renderer, antes de o main ser consultado. Por isso os links para fora (`https:`, `http:` e `mailto:`) são abertos pelo script da visualização como janela nova, que o `setWindowOpenHandler` manda para o navegador do sistema. Uma navegação para fora feita por script da página fica barrada.
- **Um script pequeno entra só na página servida**, antes do `</body>`: guarda e devolve a rolagem entre as montagens (o app não consegue lê-la numa origem opaca), repassa o Ctrl+S ao app e abre os links para fora. O app só aceita mensagens do quadro da aba e no formato esperado. O `index.html` gerado não leva esse script.
- **A página da visualização é a da geração, no melhor esforço:** o `HtmlPageDeriver` monta as duas pelo mesmo caminho. Na visualização, os fragmentos abertos com alteração entram com o texto do editor, os arquivos citados não são conferidos (o navegador mostra a falta), e a página sai mesmo com problemas, que a aba lista.
- **Os arquivos do projeto são servidos sem cache**, para "Recarregar" pegar um arquivo mudado por fora.
- Os roteiros de interface chegam à página pelo protocolo de depuração: o quadro é um alvo `iframe` próprio, com o endereço `mdd-page://pagina/index.html`.
```

- [ ] **Passo 5: O termo novo, em `CONTEXT.md`**

Troque:

<!-- prettier-ignore -->
```markdown
_Avoid_: variável, placeholder, tag

**Sumário**:
Lista aninhada de links para as seções da página, com as features selecionadas que têm conteúdo.
```

por:

<!-- prettier-ignore -->
```markdown
_Avoid_: variável, placeholder, tag

**Visualização**:
A página da configuração aberta, montada ao vivo na aba Páginas a partir do projeto como está na tela, sem gravar nada.
_Avoid_: preview, prévia, página gerada (é a da pasta de saída)

**Sumário**:
Lista aninhada de links para as seções da página, com as features selecionadas que têm conteúdo.
```

- [ ] **Passo 6: A Fase 8 na SPEC, em `docs/SPEC.md`**

Troque:

<!-- prettier-ignore -->
```markdown
5. **Editar os fragmentos** dentro do app, num editor de XML (Fase 6).
6. **Gerar a página** `index.html` de cada produto, a partir de fragmentos em HTML (Fase 7, ADR 0010).

A arquitetura é em camadas, com SOLID e Clean Code. Não há testes automatizados na primeira versão (ADR 0008); a aceitação de cada fase é manual, com o projeto de exemplo (§9).
```

por:

<!-- prettier-ignore -->
```markdown
5. **Editar os fragmentos** dentro do app, num editor de XML (Fase 6).
6. **Gerar a página** `index.html` de cada produto, a partir de fragmentos em HTML (Fase 7, ADR 0010).
7. **Ver a página** da configuração aberta dentro do app, ao vivo (Fase 8, ADR 0011).

A arquitetura é em camadas, com SOLID e Clean Code. Não há testes automatizados na primeira versão (ADR 0008); a aceitação de cada fase é manual, com o projeto de exemplo (§9).
```

Troque:

<!-- prettier-ignore -->
```markdown
- Fase 6: editor de fragmentos, para criar e editar os fragmentos do projeto dentro do app, com realce de XML e a conferência da geração (ADR 0009). Ele não edita `model.xml`, `assets.xml` nem as configurações como texto, não renomeia nem exclui arquivos e só abre `.xml` e, desde a Fase 7, `.html`.
- Fase 7: páginas HTML (ADR 0010). Fragmentos em HTML, a moldura, os marcadores de atributo e o sumário; a geração passa a montar também o `index.html`. O desenho está em [docs/superpowers/specs/2026-09-28-fase-7-paginas-html-design.md](superpowers/specs/2026-09-28-fase-7-paginas-html-design.md).
- Fase 8: a aba Páginas, com a página ao vivo. As decisões já tomadas estão no fim do desenho da Fase 7.

**Fora da primeira versão (fase "Depois"):** clones, restrições com atributos, análises do modelo (`ModelAnalyzer`: features mortas etc.), variabilidade anotativa, renderers por mídia, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes automatizados.
```

por:

<!-- prettier-ignore -->
```markdown
- Fase 6: editor de fragmentos, para criar e editar os fragmentos do projeto dentro do app, com realce de XML e a conferência da geração (ADR 0009). Ele não edita `model.xml`, `assets.xml` nem as configurações como texto, não renomeia nem exclui arquivos e só abre `.xml` e, desde a Fase 7, `.html`.
- Fase 7: páginas HTML (ADR 0010). Fragmentos em HTML, a moldura, os marcadores de atributo e o sumário; a geração passa a montar também o `index.html`. O desenho está em [docs/superpowers/specs/2026-09-28-fase-7-paginas-html-design.md](superpowers/specs/2026-09-28-fase-7-paginas-html-design.md).
- Fase 8: a aba Páginas, com a página da configuração aberta ao vivo, num quadro isolado do app (ADR 0011). O desenho está em [docs/superpowers/specs/2026-09-28-fase-8-aba-paginas-design.md](superpowers/specs/2026-09-28-fase-8-aba-paginas-design.md).

**Fora da primeira versão (fase "Depois"):** clones, restrições com atributos, análises do modelo (`ModelAnalyzer`: features mortas etc.), variabilidade anotativa, renderers por mídia, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes automatizados.
```

Troque:

<!-- prettier-ignore -->
```markdown
  - **Projetos recentes:** `listRecentProjects` e `reopenProject` (os 10 últimos, gravados em `userData`; só pastas da lista podem ser reabertas sem o diálogo)
  - **Janela:** `setUnsavedChanges` (o main pergunta antes de fechar a janela com alterações não salvas)

O solver roda no renderer, de forma síncrona. Se ficar lento em modelos grandes, ele passa para um Web Worker trocando só o adapter.
```

por:

<!-- prettier-ignore -->
```markdown
  - **Projetos recentes:** `listRecentProjects` e `reopenProject` (os 10 últimos, gravados em `userData`; só pastas da lista podem ser reabertas sem o diálogo)
  - **Janela:** `setUnsavedChanges` (o main pergunta antes de fechar a janela com alterações não salvas)
  - **Visualização:** `setPreviewPage` (a página da aba Páginas, que o main serve em `mdd-page://pagina/index.html`, Fase 8)
- O esquema próprio `mdd-page:` (ADR 0011) serve a página da visualização e os arquivos do projeto aberto, só para leitura e sem cache. A página roda num `<iframe>` com sandbox, sem `allow-same-origin`: numa origem opaca, sem acesso ao app. A CSP do app aceita só esse esquema em quadros (`frame-src mdd-page:`). Uma janela aberta pela página vai para o navegador do sistema só se for `https:`, `http:` ou `mailto:`.

O solver roda no renderer, de forma síncrona. Se ficar lento em modelos grandes, ele passa para um Web Worker trocando só o adapter.
```

Troque:

<!-- prettier-ignore -->
```markdown
**Janela do projeto:**

- barra lateral com as abas **Modelo**, **Configurações**, **Assets** e **Fragmentos**;
- área central com o diagrama;
- painel direito de propriedades;
```

por:

<!-- prettier-ignore -->
```markdown
**Janela do projeto:**

- barra lateral com as abas **Modelo**, **Configurações**, **Assets**, **Fragmentos** e **Páginas**;
- área central com o diagrama;
- painel direito de propriedades;
```

Troque:

<!-- prettier-ignore -->
```markdown
- Barra de status: "N fragmentos · M com alterações".

## 8. Comportamentos transversais
```

por:

<!-- prettier-ignore -->
```markdown
- Barra de status: "N fragmentos · M com alterações".

**Páginas** (Fase 8, ADR 0011):

- À esquerda, a lista de configurações, só para escolher: é a mesma configuração aberta da aba Configurações. No centro, a página da configuração, montada ao vivo a partir do projeto como está na tela, com as decisões e os valores não salvos e com o texto dos fragmentos abertos no editor. Nada é gravado em `saida/`.
- A página é montada ao entrar na aba e meio segundo depois da última mudança no que entra nela (um fragmento aberto, a moldura, o modelo, os assets, a configuração), quando a janela volta ao foco e no botão **Recarregar**. A rolagem continua onde estava.
- A barra: o nome da configuração, as larguras **Celular** (375 px), **Tablet** (768 px) e **Largura toda**, **Recarregar** e **Gerar produto**. Sem `moldura.html`, a barra avisa que a página usa a moldura padrão e oferece **Criar moldura**, que cria o arquivo com a moldura padrão e o abre na aba Fragmentos.
- Com problemas, a página aparece mesmo assim, no melhor esforço (um marcador que não resolve fica como está escrito), com a lista embaixo; clicar num problema abre o arquivo na aba Fragmentos, na linha. A geração continua recusando.
- Sem página, o centro explica o motivo: nenhuma configuração aberta; a configuração incompleta, com o texto da dica de "Gerar produto"; ou o projeto sem fragmento HTML, com o botão "Novo fragmento".
- Um link para fora da página (`https:`, `http:`, `mailto:`) abre no navegador do sistema; o Ctrl+S com o foco na página salva o projeto.
- A faixa verde da geração, nas abas Configurações e Páginas, tem **Abrir no navegador**, que abre o `index.html` gerado no programa padrão, quando o projeto tem página.

## 8. Comportamentos transversais
```

Troque:

<!-- prettier-ignore -->
```markdown
| **6. Editor de fragmentos**   | Aba Fragmentos com o CodeMirror 6 (ADR 0009): árvore dos `.xml`, editor com realce e a conferência da geração, novo fragmento, vínculo pelo editor, "Editar" na aba Assets, salvar junto com o projeto                         | A árvore mostra os 5 `.xml` de `docs/`, sem o `model.xml`, o `assets.xml` e `configurations/`. Trocar o título do `pix.xml` e salvar muda só esse arquivo, com a quebra de linha e o BOM de antes. Apagar o `>` de uma tag mostra o problema com a linha, e a geração de `loja-basica` passa a recusar o arquivo. Criar `docs/pagamento/cartao.xml`, salvar e vinculá-lo a `pag_cartao` pelo editor faz o arquivo aparecer na aba Assets como ok. |
| **7. Páginas HTML**           | Fragmentos HTML, moldura, marcadores, sumário, a página `index.html` na geração, o editor de HTML e o exemplo `herby` (ADR 0010)                                                                                               | Sobre o exemplo `herby`: gerar `completa-atibaia` produz um `index.html` idêntico ao de `produto-esperado/herby-completa-atibaia/`. Uma tag aberta num fragmento e um marcador de feature não selecionada fazem a geração recusar, com o arquivo e a linha. Gerar `loja-basica` do `loja-online` continua sem `index.html`.                                                                                                                       |
| **8. Aba Páginas**            | A página ao vivo dentro do app (decisões no desenho da Fase 7)                                                                                                                                                                 | A definir no desenho da Fase 8.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Depois**                    | `ModelAnalyzer`, variabilidade anotativa, renderers por mídia, restrições com atributos, clones, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
```

por:

<!-- prettier-ignore -->
```markdown
| **6. Editor de fragmentos**   | Aba Fragmentos com o CodeMirror 6 (ADR 0009): árvore dos `.xml`, editor com realce e a conferência da geração, novo fragmento, vínculo pelo editor, "Editar" na aba Assets, salvar junto com o projeto                         | A árvore mostra os 5 `.xml` de `docs/`, sem o `model.xml`, o `assets.xml` e `configurations/`. Trocar o título do `pix.xml` e salvar muda só esse arquivo, com a quebra de linha e o BOM de antes. Apagar o `>` de uma tag mostra o problema com a linha, e a geração de `loja-basica` passa a recusar o arquivo. Criar `docs/pagamento/cartao.xml`, salvar e vinculá-lo a `pag_cartao` pelo editor faz o arquivo aparecer na aba Assets como ok. |
| **7. Páginas HTML**           | Fragmentos HTML, moldura, marcadores, sumário, a página `index.html` na geração, o editor de HTML e o exemplo `herby` (ADR 0010)                                                                                               | Sobre o exemplo `herby`: gerar `completa-atibaia` produz um `index.html` idêntico ao de `produto-esperado/herby-completa-atibaia/`. Uma tag aberta num fragmento e um marcador de feature não selecionada fazem a geração recusar, com o arquivo e a linha. Gerar `loja-basica` do `loja-online` continua sem `index.html`.                                                                                                                       |
| **8. Aba Páginas**            | A aba Páginas, com a página da configuração aberta ao vivo num `<iframe>` isolado, servido pelo esquema `mdd-page:` (ADR 0011)                                                                                                 | Sobre o exemplo `herby`: a página de `completa-atibaia` aparece na aba, sem acesso ao app (`window.mdd` não existe nela). Editar um fragmento sem salvar muda a página, na mesma rolagem. As larguras de 375 e 768 px acionam as media queries. Um link `https:` abre no navegador do sistema. "Abrir no navegador" abre o `index.html` gerado.                                                                                                   |
| **Depois**                    | `ModelAnalyzer`, variabilidade anotativa, renderers por mídia, restrições com atributos, clones, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
```

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
