# Fase 5 — Geração: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** gerar o produto de uma configuração completa. O configurador ganha o botão **Gerar produto**, que grava `saida/<chave>/product.xml`, com os fragmentos embutidos, e copia os recursos. Antes de gravar, confere todas as fontes; com qualquer problema, não grava nada.

**Arquitetura:**

- **Domínio** (puro): o avaliador de expressões, a inclusão de assets e o plano de geração (SPEC §4.4, passo 1).
- **Aplicação:** as portas `Clock`, `ProductDeriver` e `OutputFolderOpener`; `ProjectStorage` com `copy`, `rename` e `removeDirectory`; `XmlSchemaValidator` sem schema; o caso de uso `WriteProductFolder` (pasta temporária e troca, igual para qualquer formato) e o `GenerateProduct`, que junta tudo.
- **Infraestrutura:** o `XmlProductDeriver` (a verificação dos fragmentos e dos recursos e o `product.xml`), a extração da raiz dos fragmentos, o nó de texto cru no escritor de XML, o `SystemClock` e os adapters do Electron.
- **Processo main e IPC:** canais `copy`, `rename` e `removeDirectory`; renomear e apagar pastas só dentro de `saida/`; `openPath` abre pastas de `saida/`; `validateXml` sem schema.
- **Interface:** as ações de geração da store num arquivo próprio; o botão na barra da configuração; a faixa verde da última geração; os diálogos de substituir e de problemas.

**Stack:** a das fases anteriores. Sem dependências novas: o `@xmldom/xmldom` e o `xmllint-wasm` já estão no projeto.

**Spec:** [docs/superpowers/specs/2026-09-24-fase-5-geracao-design.md](../specs/2026-09-24-fase-5-geracao-design.md) (o desenho aprovado) e [docs/SPEC.md](../../SPEC.md): §3 (a pasta `saida/`), §4.3 (inclusão), §4.4 (geração), §6.2 e §6.3 (portas e canais), §7 (o botão "Gerar produto") e §9 (linha da Fase 5). Veja também os ADRs [0006](../../adr/0006-geracao-agnostica-de-vocabulario.md) e [0008](../../adr/0008-camadas-com-lint-sem-testes.md). O protótipo refinou alguns pontos do desenho; eles estão em "O que o protótipo respondeu", e a Tarefa 5 os leva para a spec do desenho e para a SPEC.

## Restrições globais

- **Sem testes automatizados** (ADR 0008).
  - Cada tarefa verifica com `npm run typecheck`, `npm run lint` e scripts descartáveis em `.checks/`.
  - `.checks/` fica fora do git, do ESLint e do Prettier.
  - Os scripts `.mts` rodam com `npx tsx --tsconfig tsconfig.web.json`, por causa do alias `@/`. Os `.mjs` rodam com `node`.
  - Os roteiros da interface usam `.checks/cdp.mjs` (plano da 2B, Tarefa 3, Passo 12), `.checks/quit.mjs` (plano da Fase 3, Tarefa 4, Passo 15), `.checks/main-process.mjs` e `.checks/run-ui.sh` (plano da Fase 4, Tarefa 4, Passos 1 e 2). Num clone novo, recrie-os a partir desses planos.
- **Camadas** (SPEC §6.1): `domain/` não importa nada de fora dele; `application/` só `domain/`; só `ui/app/` conhece `infrastructure/`. O lint barra violações.
- **Imports:** dentro de `domain/`, relativos; nas demais camadas, alias `@/`. A composition root importa `src/shared/ipc.ts` por caminho relativo.
- **Idioma:** identificadores em inglês; textos da interface, mensagens, comentários e documentação em português.
- **Regras do lint:**
  - toda função tem tipo de retorno explícito;
  - as regras de hooks do React 19 estão ligadas: nada de `setState` síncrono dentro de effect, nada de ler ref durante o render;
  - um arquivo `.tsx` só exporta componentes (`react-refresh/only-export-components`): funções, hooks e constantes compartilhadas vão para um `.ts` ao lado.
- **Classes do Tailwind** sempre escritas por inteiro no código (nada de `` `bg-${cor}` ``), senão o Tailwind não as gera.
- **O nome `saida`** só aparece em `OUTPUT_DIRECTORY` (`src/shared/ipc.ts`). O main o usa na proteção; a aplicação o recebe da composition root, porque não importa `shared/`.
- **O BOM no código** é escrito como `'\u{FEFF}'`. Não use a forma de quatro dígitos (barra invertida, `u`, `FEFF`): a ferramenta de escrita pode trocá-la por um BOM literal, que é invisível. Depois de criar `fragment-source.ts` e os roteiros, confira com `grep -c 'u{FEFF}'`.
- **Gerar não é uma edição:** não passa pelo histórico de desfazer e não mexe no "•" de não salvo.
- **Commits:** rode `npm run format` antes de cada commit. Os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Shell:** todo comando roda na raiz do repositório com **Git Bash**, no branch `fase-5-geracao`.
- **Roteiros de interface abrem janelas na tela do usuário:** combine o momento com ele antes. Para fechar o app, use `.checks/quit.mjs`, nunca `taskkill /IM electron.exe`. O `generate-product-check.mts` também abre um PowerShell escondido por alguns segundos, para segurar um arquivo aberto.

## O que o protótipo respondeu

O código deste plano foi prototipado e verificado numa cópia descartável do repositório. Cada tarefa foi aplicada sozinha sobre o commit do desenho: o roteiro dela falhou antes e deu a saída deste plano depois, e o typecheck e o lint passaram.

**Os seis riscos do desenho:**

1. **`xmllint-wasm` sem schema.** A chamada é `validateXML({ xml, schema: [] })`, e o erro vem com a linha certa. Num arquivo com DOCTYPE de DTD externa (comum em DITA), o `xmllint` não carrega a DTD e aceita `&nbsp;` sem reclamar. Por isso as entidades são conferidas depois, pelo `@xmldom/xmldom`.
2. **Extração da raiz.**
   - O `xmldom` dá linha e coluna de todos os nós de fora da raiz. O fim da raiz é o começo do nó seguinte (espaço, comentário ou instrução), o que resolve um CDATA ou comentário com `</t>` dentro.
   - O `xmldom` converte as quebras de linha antes de ler, inclusive `\r` sozinho, e aí as posições não batem com o texto original. Com `normalizeLineEndings` devolvendo o texto como está, e a conta de linhas igual à dele (`\r\n`, `\r` e `\n`), a posição cai no lugar certo.
   - O `xmldom` recusa o BOM: ele sai antes.
   - Numa entidade, o `xmldom` aponta o começo do texto, que pode estar linhas acima. A linha certa é a da primeira ocorrência da entidade a partir dali.
   - O `xmllint` aceita um prefixo de namespace sem declaração: só registra um "namespace error" no `rawOutput`, sem invalidar. O `xmldom` recusa. Em compensação, o `xmldom` aceita erros de sintaxe que o `xmllint` pega (`&` solto, atributo sem aspas ou sem valor, `]]>` no texto, caractere de controle). Por isso a ordem é: `xmllint` primeiro, `xmldom` depois.
3. **`xmlns=""`.** O `product.xml` gerado passa no `product.xsd` (com o `xml.xsd` pré-carregado), e o `<topic>` embutido de um fragmento sem namespace continua sem namespace quando o produto é lido.
4. **Renomear pasta no Windows.** Com um arquivo da pasta aberto em outro processo, renomear falha com `EPERM`, mesmo que o arquivo tenha sido aberto com permissão de exclusão. Com a pasta como diretório atual de outro processo, falha com `EBUSY`. Um roteiro reproduz isso (um PowerShell segura o arquivo), e a checagem à mão da trava virou o caso 9 do `generate-product-check.mts`. A mensagem não traz o erro do sistema, que tem os caminhos absolutos inteiros.
5. **Proteção de `saida/`.** O `path.relative` do Windows ignora maiúsculas: `SAIDA/x` é aceito, porque é a mesma pasta. `saida/..loja` é um nome válido, e `../loja/saida/x` aponta para a mesma pasta. São recusados `saida`, `saida/.`, `Saida/..`, `saida/../model.xml`, `saida2/x`, `docs/saida/x` e caminhos absolutos.
6. **A comparação com o esperado.** Uma forma canônica ignora comentários, espaços entre elementos, a quantidade de espaços dentro dos textos, as declarações de namespace e o `generatedAt`, e compara os elementos pelo namespace de verdade. Para não esconder uma diferença no texto dos fragmentos, o roteiro confere à parte que cada fragmento aparece byte a byte no `product.xml`.

**Achados pelo caminho** (a Tarefa 5 leva para a spec do desenho e para a SPEC):

7. **Recursos do plano:** um asset por caminho, e não só o caminho, para o problema citar o asset. A função `firstPerPath` fica no catálogo de assets e serve ao plano e ao deriver.
8. **`GenerateProduct` não depende do `ProjectStorage` direto:** pergunta ao `WriteProductFolder` (`exists`), que sabe onde fica a pasta.
9. **Uma só `ResolveConfiguration`** na composition root, para a tela e para a geração: o resultado guardado serve às duas.
10. **A store devolve o resultado da geração** em vez de guardar o diálogo. O hook `useGenerateProduct` escolhe o diálogo pelo resultado e é usado pelo botão e pelo "Substituir". Os dois diálogos ficam num componente próprio, `GenerationDialogs`.
11. **`generating`** impede um segundo clique. Fechar ou recarregar o projeto no meio zera o estado da geração (`GENERATION_CLOSED` entra no `CLOSED`), e o resultado que chega depois é descartado, como nas ações de assets.
12. **A dica do botão desligado** fica num `span` em volta dele, porque um botão desligado não recebe os eventos do mouse.
13. **Mensagens:** "Arquivo ausente." para fragmento e recurso; a codificação aponta a linha 1; a entidade tem mensagem em português; os erros de sintaxe do `xmllint` ficam em inglês, como na leitura do projeto.
14. **Regressão:** o `ui-check.mjs` (2A), o `configurador-ui.mjs` (Fase 3), o `assets-ui.mjs` (Fase 4) e os roteiros de store das Fases 3 e 4 saíram iguais. O `diagrama-ui.mjs` (2B) não foi rodado: esta fase não mexe no diagrama nem na aba Modelo.

## Mapa de arquivos

| Arquivo                                                                       | Responsabilidade                                                                                               |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `domain/expression/evaluator.ts`                                              | `evaluateExpression`                                                                                           |
| `domain/assets/asset-inclusion.ts`                                            | `isAssetIncluded`                                                                                              |
| `domain/assets/asset-catalog.ts`                                              | `firstPerPath`                                                                                                 |
| `domain/generation/generation-plan.ts`                                        | `GenerationPlan` e `planGeneration`                                                                            |
| `shared/ipc.ts`, `preload/index.ts`                                           | `OUTPUT_DIRECTORY`; canais `copy`, `rename` e `removeDirectory`; `validateXml` sem schema                      |
| `main/project-root.ts`                                                        | `resolveInOutput`                                                                                              |
| `main/ipc/file-handlers.ts`                                                   | Os três canais; `openPath` com pastas de `saida/`                                                              |
| `main/ipc/xml-handlers.ts`, `main/xml/schema-validator.ts`                    | Validação sem schema                                                                                           |
| `application/ports/project-storage.ts`, `xml-schema-validator.ts`             | As operações novas nas portas                                                                                  |
| `application/ports/clock.ts`, `product-deriver.ts`, `output-folder-opener.ts` | Portas novas                                                                                                   |
| `application/use-cases/write-product-folder.ts`                               | Pasta temporária e troca                                                                                       |
| `application/use-cases/generate-product.ts`                                   | Planejar, derivar, perguntar e gravar                                                                          |
| `infrastructure/xml/xml-writer.ts`                                            | Nó de texto cru                                                                                                |
| `infrastructure/xml/fragment-source.ts`                                       | Codificação declarada e extração da raiz                                                                       |
| `infrastructure/xml/xml-product-deriver.ts`                                   | Verificação das fontes e `product.xml`                                                                         |
| `infrastructure/system/system-clock.ts`                                       | `SystemClock`                                                                                                  |
| `infrastructure/electron/*`                                                   | As operações novas no `ElectronProjectStorage` e no `ElectronXmlSchemaValidator`; `ElectronOutputFolderOpener` |
| `ui/stores/generation-actions.ts`, `project-store.ts`                         | Ações de geração, montadas na store                                                                            |
| `ui/screens/configurator/*`                                                   | Botão, faixa, diálogos, textos e o hook `useGenerateProduct`                                                   |
| `ui/screens/project/editor-dialog.ts`, `ProjectScreen.tsx`                    | Os dois diálogos novos                                                                                         |
| `ui/app/composition-root.ts`                                                  | Injeta os serviços novos                                                                                       |

(Os caminhos em `domain/`, `application/`, `infrastructure/` e `ui/` ficam em `src/renderer/src/`; os de `shared/`, `preload/` e `main/`, em `src/`.)

---

### Tarefa 1: Domínio — o plano de geração

**Arquivos:**

- Criar: `src/renderer/src/domain/expression/evaluator.ts`, `src/renderer/src/domain/assets/asset-inclusion.ts`, `src/renderer/src/domain/generation/generation-plan.ts`
- Modificar: `src/renderer/src/domain/assets/asset-catalog.ts`
- Verificação: `.checks/generation-plan-check.mts`

**Interfaces:**

- Consome: `Expression` (`domain/expression/ast.ts`); `Asset`, `AssetCatalog` (`domain/assets/asset-catalog.ts`); `storedValue(configuration, featureId, attributeId)` (`domain/configuration/attribute-values.ts`); `configurationStatus`, `isSelected`, `Resolution` (`domain/configuration/resolution.ts`); `childFeatures`, `featuresInPreOrder` (`domain/feature-model/traversal.ts`); `Result`, `ok`, `err` (`domain/shared/result.ts`); `ResolveConfiguration` e `LogicSolverConstraintSolver` (só no roteiro).
- Produz:
  - `evaluateExpression(expression: Expression, trueIds: ReadonlySet<string>): boolean` (`evaluator.ts`)
  - `isAssetIncluded(asset: Asset, selected: ReadonlySet<string>): boolean` (`asset-inclusion.ts`)
  - `firstPerPath(assets: readonly Asset[]): Asset[]` (`asset-catalog.ts`)
  - `PlannedAttribute` (`id`, `value`), `PlannedFeature` (`id`, `name`, `attributes`), `PlannedSection` (`featureId`, `fragments: readonly Asset[]`, `children`), `GenerationPlan` (`productName`, `modelName`, `features`, `root`, `resources: readonly Asset[]`) e `planGeneration(model, catalog, configuration, resolution): Result<GenerationPlan, string>` (`generation-plan.ts`)

- [ ] **Passo 1: Conferir o branch**

```bash
git switch fase-5-geracao
git log --oneline -3
```

Esperado: o branch tem o commit do desenho (`docs: desenho da Fase 5 (geração)`) e o deste plano.

- [ ] **Passo 2: Escrever o roteiro `.checks/generation-plan-check.mts`**

Confere o plano da `loja-basica` (features, atributos, seções e recursos), a condição do `doc_busca_app`, a recusa de uma configuração incompleta, o recurso repetido e o avaliador.

```ts
// Plano de geração sobre docs/examples/loja-online (plano da Fase 5, Tarefa 1).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/generation-plan-check.mts
import { readFileSync } from 'node:fs'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import type { Configuration } from '@/domain/configuration/configuration'
import { evaluateExpression } from '@/domain/expression/evaluator'
import { parseExpression } from '@/domain/expression/parser'
import { planGeneration, type PlannedSection } from '@/domain/generation/generation-plan'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'

const read = (path: string) =>
  parseXmlRoot(readFileSync(`docs/examples/loja-online/${path}`, 'utf8'))
const decodedModel = decodeFeatureModel(read('model.xml'))
const decodedAssets = decodeAssetCatalog(read('assets.xml'))
const decodedConfiguration = decodeConfiguration(read('configurations/loja-basica.xml'))
if (!decodedModel.ok || !decodedAssets.ok || !decodedConfiguration.ok) {
  throw new Error('o exemplo não abriu')
}
const model = decodedModel.value
const catalog = decodedAssets.value
const basica = decodedConfiguration.value
const log = (label: string, value: unknown): void => console.log(label.padEnd(32), '→', value)
const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const plan = (configuration: Configuration) =>
  planGeneration(model, catalog, configuration, resolver.execute(model, configuration))
const sections = (section: PlannedSection, depth = 0): string[] => [
  `${'  '.repeat(depth)}${section.featureId}${section.fragments.map((a) => ` [${a.id}]`).join('')}`,
  ...section.children.flatMap((child) => sections(child, depth + 1))
]

// 1. loja-basica: as features, os atributos, as seções e os recursos
const p1 = plan(basica)
if (!p1.ok) throw new Error(p1.error)
log('produto', `${p1.value.productName} | modelo ${p1.value.modelName}`)
for (const feature of p1.value.features) {
  const attributes = feature.attributes.map((a) => `${a.id}=${a.value}`).join(' ')
  log(`  feature ${feature.id}`, `${feature.name}${attributes === '' ? '' : ` | ${attributes}`}`)
}
for (const line of sections(p1.value.root)) console.log(`  seção ${line}`)
log('recursos', p1.value.resources.map((a) => `${a.id} ${a.path}`).join(', '))

// 2. busca sem mobile: doc_busca_app (condição "busca and mobile") fica de fora
const semMobile: Configuration = {
  ...basica,
  decisions: [
    { featureId: 'busca', state: 'selected' },
    { featureId: 'mobile', state: 'deselected' },
    { featureId: 'pag_cartao', state: 'selected' },
    { featureId: 'pag_pix', state: 'deselected' },
    { featureId: 'pag_boleto', state: 'selected' }
  ],
  values: [{ featureId: 'busca', attributeId: 'max_resultados', value: '100' }]
}
const p2 = plan(semMobile)
if (!p2.ok) throw new Error(p2.error)
log(
  'sem mobile: seções',
  sections(p2.value.root)
    .map((line) => line.trim())
    .join(' | ')
)
log('sem mobile: recursos', p2.value.resources.length)
log('sem mobile: atributos da busca', p2.value.features.find((f) => f.id === 'busca')?.attributes)

// 3. configuração incompleta é recusada
const incompleta: Configuration = { ...basica, decisions: basica.decisions.slice(1) }
const p3 = plan(incompleta)
log('incompleta', p3.ok ? 'aceita (ERRADO)' : p3.error)

// 4. mesmo caminho em dois recursos: copiado uma vez só
const dobrado = {
  assets: [
    ...catalog.assets,
    { ...catalog.assets.find((a) => a.id === 'img_pix')!, id: 'img_pix_2', anchor: 'loja' }
  ]
}
const p4 = planGeneration(model, dobrado, basica, resolver.execute(model, basica))
log('recurso repetido', p4.ok ? p4.value.resources.map((a) => a.id).join(', ') : p4.error)

// 5. o avaliador de expressões
const verdade = new Set(['a', 'b'])
for (const source of [
  'a and b',
  'a and c',
  'a or c',
  'not c',
  'c implies a',
  'a implies c',
  'a iff b',
  'a iff c',
  'true and not false',
  'not (a and c) and (c or b)'
]) {
  const parsed = parseExpression(source)
  if (!parsed.ok) throw new Error(source)
  log(`  ${source}`, evaluateExpression(parsed.value, verdade))
}
```

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generation-plan-check.mts
```

Esperado: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/domain' …`, porque os módulos novos ainda não existem.

- [ ] **Passo 4: Criar `src/renderer/src/domain/expression/evaluator.ts`**

```ts
import type { Expression } from './ast'

/**
 * O valor da expressão com as features do conjunto verdadeiras e as demais falsas.
 * Usado nas condições de presença dos assets (SPEC §4.3).
 */
export function evaluateExpression(expression: Expression, trueIds: ReadonlySet<string>): boolean {
  switch (expression.kind) {
    case 'var':
      return trueIds.has(expression.id)
    case 'const':
      return expression.value
    case 'not':
      return !evaluateExpression(expression.operand, trueIds)
    case 'binary': {
      const left = evaluateExpression(expression.left, trueIds)
      const right = evaluateExpression(expression.right, trueIds)
      switch (expression.operator) {
        case 'and':
          return left && right
        case 'or':
          return left || right
        case 'implies':
          return !left || right
        case 'iff':
          return left === right
      }
    }
  }
}
```

- [ ] **Passo 5: `src/renderer/src/domain/assets/asset-catalog.ts`**

Troque:

<!-- prettier-ignore -->
```ts
}

/** Como o asset aparece na interface: o nome, ou o nome do arquivo quando não tem nome. */
export function assetLabel(asset: Asset): string {
```

por:

<!-- prettier-ignore -->
```ts
}

/** Um asset por caminho, o primeiro: a mesma imagem vinculada em duas âncoras conta uma vez. */
export function firstPerPath(assets: readonly Asset[]): Asset[] {
  const seen = new Set<string>()
  return assets.filter((asset) => {
    if (seen.has(asset.path)) return false
    seen.add(asset.path)
    return true
  })
}

/** Como o asset aparece na interface: o nome, ou o nome do arquivo quando não tem nome. */
export function assetLabel(asset: Asset): string {
```

- [ ] **Passo 6: Criar `src/renderer/src/domain/assets/asset-inclusion.ts`**

```ts
import { evaluateExpression } from '../expression/evaluator'
import type { Asset } from './asset-catalog'

/**
 * O asset entra no produto quando a âncora está selecionada e a condição, se houver, é
 * verdadeira para as features selecionadas (SPEC §4.3).
 */
export function isAssetIncluded(asset: Asset, selected: ReadonlySet<string>): boolean {
  if (!selected.has(asset.anchor)) return false
  return asset.condition === undefined || evaluateExpression(asset.condition, selected)
}
```

- [ ] **Passo 7: Criar `src/renderer/src/domain/generation/generation-plan.ts`**

```ts
import { firstPerPath, type Asset, type AssetCatalog } from '../assets/asset-catalog'
import { isAssetIncluded } from '../assets/asset-inclusion'
import { storedValue } from '../configuration/attribute-values'
import type { Configuration } from '../configuration/configuration'
import { configurationStatus, isSelected, type Resolution } from '../configuration/resolution'
import type { Feature, FeatureModel } from '../feature-model/feature-model'
import { childFeatures, featuresInPreOrder } from '../feature-model/traversal'
import { err, ok, type Result } from '../shared/result'

/*
 * Passo 1 da geração (SPEC §4.4): o que vai para o produto, calculado só a partir do modelo,
 * dos assets e da configuração. Nada aqui lê o disco; a hora da geração também fica de fora.
 */

export interface PlannedAttribute {
  readonly id: string
  /** O valor final: o `default` num atributo fixo; num configurável, o da configuração ou o `default`. */
  readonly value: string
}

export interface PlannedFeature {
  readonly id: string
  readonly name: string
  /** Na ordem do modelo. */
  readonly attributes: readonly PlannedAttribute[]
}

/** Uma seção por feature selecionada, aninhada como na árvore. */
export interface PlannedSection {
  readonly featureId: string
  /** Os fragmentos incluídos, na ordem do assets.xml. */
  readonly fragments: readonly Asset[]
  readonly children: readonly PlannedSection[]
}

export interface GenerationPlan {
  /** O nome da configuração. */
  readonly productName: string
  readonly modelName: string
  /** As features selecionadas, em pré-ordem. */
  readonly features: readonly PlannedFeature[]
  readonly root: PlannedSection
  /**
   * Os recursos incluídos, um por caminho (o primeiro asset que o usa), na ordem do
   * assets.xml. Não aparecem no product.xml: só são copiados.
   */
  readonly resources: readonly Asset[]
}

export function planGeneration(
  model: FeatureModel,
  catalog: AssetCatalog,
  configuration: Configuration,
  resolution: Resolution
): Result<GenerationPlan, string> {
  if (resolution.kind !== 'resolved' || !configurationStatus(resolution).complete) {
    return err('A configuração precisa estar completa para gerar o produto.')
  }
  const selected = new Set(
    [...resolution.features].filter(([, status]) => isSelected(status)).map(([id]) => id)
  )
  const included = catalog.assets.filter((asset) => isAssetIncluded(asset, selected))

  const sectionOf = (feature: Feature): PlannedSection => ({
    featureId: feature.id,
    fragments: included.filter((asset) => asset.kind === 'fragment' && asset.anchor === feature.id),
    children: childFeatures(feature)
      .filter((child) => selected.has(child.id))
      .map(sectionOf)
  })

  return ok({
    productName: configuration.name,
    modelName: model.name,
    features: featuresInPreOrder(model.root)
      .filter((feature) => selected.has(feature.id))
      .map((feature) => plannedFeature(feature, configuration)),
    root: sectionOf(model.root),
    resources: firstPerPath(included.filter((asset) => asset.kind === 'resource'))
  })
}

function plannedFeature(feature: Feature, configuration: Configuration): PlannedFeature {
  return {
    id: feature.id,
    name: feature.name,
    attributes: feature.attributes.flatMap((attribute) => {
      const chosen = attribute.configurable
        ? storedValue(configuration, feature.id, attribute.id)
        : undefined
      // Numa configuração completa, todo atributo tem valor; o filtro só protege o tipo.
      const value = chosen ?? attribute.defaultValue
      return value === undefined ? [] : [{ id: attribute.id, value }]
    })
  }
}
```

- [ ] **Passo 8: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generation-plan-check.mts
```

Esperado, exatamente:

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

As features, os atributos e as seções são os do `docs/examples/produto-esperado/loja-basica/product.xml`.

- [ ] **Passo 9: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 10: Commit**

```bash
npm run format
git add src/renderer/src/domain
git commit -m "feat(domain): plano de geração, avaliador de expressões e inclusão de assets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: Processo main, IPC e as portas de arquivo

**Arquivos:**

- Modificar: `src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/project-root.ts`, `src/main/ipc/file-handlers.ts`, `src/main/ipc/xml-handlers.ts`, `src/main/xml/schema-validator.ts`
- Modificar: `src/renderer/src/application/ports/project-storage.ts`, `src/renderer/src/application/ports/xml-schema-validator.ts`, `src/renderer/src/infrastructure/electron/electron-project-storage.ts`, `src/renderer/src/infrastructure/electron/electron-xml-schema-validator.ts`
- Verificação: `.checks/output-guard-check.mts`

**Interfaces:**

- Consome: `ProjectRoot` (`resolve`, `requireRoot`, `escapesRoot`); `withinProject`, `fail`, `ok` (`main/ipc/`); `validateXML` (`xmllint-wasm`).
- Produz:
  - `OUTPUT_DIRECTORY = 'saida'`; `IpcChannel.copy`, `IpcChannel.rename`, `IpcChannel.removeDirectory`; na `MddApi`, `copy(fromPath, toPath)`, `rename(fromPath, toPath)` e `removeDirectory(relativePath)`, todos `Promise<IpcResult<null>>`, e `validateXml(schema: XmlSchemaName | null, fileName, content)` (`shared/ipc.ts`)
  - `ProjectRoot.resolveInOutput(relativePath): string | null` (`main/project-root.ts`)
  - `ProjectStorage.copy(from, to)`, `rename(from, to)` e `removeDirectory(path)`, todos `Promise<Result<null, StorageError>>` (`application/ports/project-storage.ts`)
  - `XmlSchemaValidator.validate(schema: XmlSchema | null, fileName, content)` (`application/ports/xml-schema-validator.ts`)

- [ ] **Passo 1: Escrever o roteiro `.checks/output-guard-check.mts`**

```ts
// A proteção de saida/ no processo main (plano da Fase 5, Tarefa 2).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/output-guard-check.mts
import { ProjectRoot } from '../src/main/project-root'

const root = new ProjectRoot()
root.open('C:/proj/loja')
for (const path of [
  'saida/loja-basica',
  'saida/.loja-basica.tmp',
  'saida/loja-basica/docs/img',
  'SAIDA/Loja-Basica',
  'saida/..loja',
  'saida',
  'saida/',
  'saida/.',
  'Saida/..',
  'saida/../model.xml',
  'saida2/x',
  'docs/saida/x',
  '../loja/saida/x',
  '../outra/saida/x',
  'C:/proj/loja/saida/x',
  'D:/saida/x'
]) {
  const absolute = root.resolveInOutput(path)
  console.log(path.padEnd(28), '→', absolute === null ? 'recusado' : `aceito (${absolute})`)
}
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/output-guard-check.mts
```

Esperado: `TypeError: root.resolveInOutput is not a function`.

- [ ] **Passo 3: `src/shared/ipc.ts`**

Troque:

<!-- prettier-ignore -->
```ts
export type XmlSchemaName = 'feature-model' | 'assets' | 'configuration'

export interface XmlSchemaIssue {
  line?: number
```

por:

<!-- prettier-ignore -->
```ts
export type XmlSchemaName = 'feature-model' | 'assets' | 'configuration'

/**
 * Pasta do projeto onde a geração grava os produtos (SPEC §3). Só dentro dela o main aceita
 * renomear e apagar pastas, e abrir uma pasta no gerenciador de arquivos.
 */
export const OUTPUT_DIRECTORY = 'saida'

export interface XmlSchemaIssue {
  line?: number
```

Troque:

<!-- prettier-ignore -->
```ts
  /** Se o caminho é um arquivo ou uma pasta; `not-found` quando não existe. */
  stat(relativePath: string): Promise<IpcResult<EntryKind>>
  /**
   * Diálogo nativo para escolher um arquivo, começando na pasta do projeto. Devolve o caminho
```

por:

<!-- prettier-ignore -->
```ts
  /** Se o caminho é um arquivo ou uma pasta; `not-found` quando não existe. */
  stat(relativePath: string): Promise<IpcResult<EntryKind>>
  /** Copia um arquivo, criando as pastas do destino e substituindo o que já estiver lá. */
  copy(fromPath: string, toPath: string): Promise<IpcResult<null>>
  /** Renomeia um arquivo ou uma pasta; os dois caminhos ficam dentro de `saida/`. */
  rename(fromPath: string, toPath: string): Promise<IpcResult<null>>
  /** Apaga a pasta com tudo o que tem dentro, só dentro de `saida/`. Se não existe, conta como apagada. */
  removeDirectory(relativePath: string): Promise<IpcResult<null>>
  /**
   * Diálogo nativo para escolher um arquivo, começando na pasta do projeto. Devolve o caminho
```

Troque:

<!-- prettier-ignore -->
```ts
   */
  pickFileInProject(title: string): Promise<IpcResult<string | null>>
  /** Abre o arquivo do projeto no programa padrão do sistema. */
  openPath(relativePath: string): Promise<IpcResult<null>>
  /** Confere se o conteúdo é XML bem-formado e segue o XSD. Lista vazia = válido. */
  validateXml(
    schema: XmlSchemaName,
    fileName: string,
    content: string
```

por:

<!-- prettier-ignore -->
```ts
   */
  pickFileInProject(title: string): Promise<IpcResult<string | null>>
  /**
   * Abre o arquivo do projeto no programa padrão do sistema, ou uma pasta de `saida/` no
   * gerenciador de arquivos.
   */
  openPath(relativePath: string): Promise<IpcResult<null>>
  /**
   * Confere se o conteúdo é XML bem-formado e segue o XSD; sem schema (`null`), só se é
   * bem-formado. Lista vazia = válido.
   */
  validateXml(
    schema: XmlSchemaName | null,
    fileName: string,
    content: string
```

Troque:

<!-- prettier-ignore -->
```ts
  remove: 'mdd:remove',
  stat: 'mdd:stat',
  pickFileInProject: 'mdd:pick-file-in-project',
  openPath: 'mdd:open-path',
```

por:

<!-- prettier-ignore -->
```ts
  remove: 'mdd:remove',
  stat: 'mdd:stat',
  copy: 'mdd:copy',
  rename: 'mdd:rename',
  removeDirectory: 'mdd:remove-directory',
  pickFileInProject: 'mdd:pick-file-in-project',
  openPath: 'mdd:open-path',
```

- [ ] **Passo 4: `src/preload/index.ts`**

Troque:

<!-- prettier-ignore -->
```ts
    ipcRenderer.invoke(IpcChannel.remove, relativePath, precondition),
  stat: (relativePath) => ipcRenderer.invoke(IpcChannel.stat, relativePath),
  pickFileInProject: (title) => ipcRenderer.invoke(IpcChannel.pickFileInProject, title),
  openPath: (relativePath) => ipcRenderer.invoke(IpcChannel.openPath, relativePath),
```

por:

<!-- prettier-ignore -->
```ts
    ipcRenderer.invoke(IpcChannel.remove, relativePath, precondition),
  stat: (relativePath) => ipcRenderer.invoke(IpcChannel.stat, relativePath),
  copy: (fromPath, toPath) => ipcRenderer.invoke(IpcChannel.copy, fromPath, toPath),
  rename: (fromPath, toPath) => ipcRenderer.invoke(IpcChannel.rename, fromPath, toPath),
  removeDirectory: (relativePath) => ipcRenderer.invoke(IpcChannel.removeDirectory, relativePath),
  pickFileInProject: (title) => ipcRenderer.invoke(IpcChannel.pickFileInProject, title),
  openPath: (relativePath) => ipcRenderer.invoke(IpcChannel.openPath, relativePath),
```

- [ ] **Passo 5: `src/main/project-root.ts`**

Troque:

<!-- prettier-ignore -->
```ts
import { isAbsolute, join, relative, resolve, sep } from 'path'

/**
```

por:

<!-- prettier-ignore -->
```ts
import { isAbsolute, join, relative, resolve, sep } from 'path'
import { OUTPUT_DIRECTORY } from '../shared/ipc'

/**
```

Troque:

<!-- prettier-ignore -->
```ts

  /**
   * O caminho relativo à raiz, com "/" como separador, de um arquivo escolhido no diálogo.
   * `null` para o que fica fora do projeto (outro disco, pasta vizinha) ou para a própria raiz.
```

por:

<!-- prettier-ignore -->
```ts

  /**
   * Como `resolve`, mas só para caminhos dentro da pasta de saída (`saida/`), nunca a própria
   * pasta. É o limite das operações que apagam ou movem pastas inteiras. No Windows, o
   * `relative` ignora maiúsculas: `SAIDA/x` fica dentro de `saida/`.
   */
  resolveInOutput(relativePath: string): string | null {
    const absolute = this.resolve(relativePath)
    if (absolute === null) return null
    const fromOutput = relative(join(this.requireRoot(), OUTPUT_DIRECTORY), absolute)
    return fromOutput === '' || escapesRoot(fromOutput) ? null : absolute
  }

  /**
   * O caminho relativo à raiz, com "/" como separador, de um arquivo escolhido no diálogo.
   * `null` para o que fica fora do projeto (outro disco, pasta vizinha) ou para a própria raiz.
```

- [ ] **Passo 6: `src/main/ipc/file-handlers.ts`**

`rename` e `removeDirectory` só aceitam caminhos dentro de `saida/`. O `openPath` passa a abrir pastas, mas só as de `saida/`.

Troque:

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
```

por:

<!-- prettier-ignore -->
```ts
import { createHash } from 'crypto'
import { ipcMain, shell } from 'electron'
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile
} from 'fs/promises'
import { dirname } from 'path'
import {
  IpcChannel,
  OUTPUT_DIRECTORY,
  type DirectoryEntry,
  type EntryKind,
```

Troque:

<!-- prettier-ignore -->
```ts
    return fail('io', `Erro ao acessar "${relativePath}": ${(error as Error).message}`)
  }
}
```

por:

<!-- prettier-ignore -->
```ts
    return fail('io', `Erro ao acessar "${relativePath}": ${(error as Error).message}`)
  }
}

/**
 * Como `withinProject`, para as operações que mexem em pastas inteiras: o caminho precisa
 * ficar dentro de `saida/`.
 */
function withinOutput<T>(
  root: ProjectRoot,
  relativePath: string,
  operation: (absolutePath: string) => Promise<IpcResult<T>>
): Promise<IpcResult<T>> {
  return withinProject<T>(root, relativePath, async () => {
    const absolutePath = root.resolveInOutput(relativePath)
    return absolutePath === null ? outsideOutput(relativePath) : operation(absolutePath)
  })
}

function outsideOutput<T>(relativePath: string): IpcResult<T> {
  return fail('outside-project', `"${relativePath}" fica fora da pasta ${OUTPUT_DIRECTORY}/.`)
}
```

Troque:

<!-- prettier-ignore -->
```ts
  )

  ipcMain.handle(IpcChannel.openPath, (_event, relativePath: string) =>
    withinProject<null>(root, relativePath, async (path) => {
      if ((await stat(path)).isDirectory()) {
        return fail('io', `"${relativePath}" é uma pasta, não um arquivo.`)
      }
```

por:

<!-- prettier-ignore -->
```ts
  )

  ipcMain.handle(IpcChannel.copy, (_event, fromPath: string, toPath: string) =>
    withinProject<null>(root, fromPath, async (source) => {
      const target = root.resolve(toPath)
      if (target === null) {
        return fail('outside-project', `O caminho "${toPath}" fica fora do projeto.`)
      }
      if ((await stat(source)).isDirectory()) {
        return fail('io', `"${fromPath}" é uma pasta, não um arquivo.`)
      }
      await mkdir(dirname(target), { recursive: true })
      await copyFile(source, target)
      return ok(null)
    })
  )

  ipcMain.handle(IpcChannel.rename, (_event, fromPath: string, toPath: string) =>
    withinOutput<null>(root, fromPath, async (source) => {
      const target = root.resolveInOutput(toPath)
      if (target === null) return outsideOutput(toPath)
      await rename(source, target)
      return ok(null)
    })
  )

  ipcMain.handle(IpcChannel.removeDirectory, (_event, relativePath: string) =>
    withinOutput<null>(root, relativePath, async (path) => {
      await rm(path, { recursive: true, force: true })
      return ok(null)
    })
  )

  ipcMain.handle(IpcChannel.openPath, (_event, relativePath: string) =>
    withinProject<null>(root, relativePath, async (path) => {
      // Pastas, só as geradas: o "Abrir pasta" da faixa de sucesso da geração.
      const isFolder = (await stat(path)).isDirectory()
      if (isFolder && root.resolveInOutput(relativePath) === null) {
        return fail('io', `"${relativePath}" é uma pasta, não um arquivo.`)
      }
```

- [ ] **Passo 7: Validação sem schema no main**

Em `src/main/xml/schema-validator.ts`:

Troque:

<!-- prettier-ignore -->
```ts
const MESSAGE_PREFIX = /^(Schemas validity error|Schemas parser error|parser error)\s*:\s*/

export async function validateAgainstSchema(
  schema: XmlSchemaName,
  fileName: string,
  content: string
```

por:

<!-- prettier-ignore -->
```ts
const MESSAGE_PREFIX = /^(Schemas validity error|Schemas parser error|parser error)\s*:\s*/

/** Sem schema (`null`), só confere se o conteúdo é XML bem-formado (fragmentos, SPEC §4.4). */
export async function validateAgainstSchema(
  schema: XmlSchemaName | null,
  fileName: string,
  content: string
```

Troque:

<!-- prettier-ignore -->
```ts
  const result = await validateXML({
    xml: [{ fileName, contents: content }],
    schema: [SCHEMAS[schema]]
  })
  if (result.valid) return []
```

por:

<!-- prettier-ignore -->
```ts
  const result = await validateXML({
    xml: [{ fileName, contents: content }],
    schema: schema === null ? [] : [SCHEMAS[schema]]
  })
  if (result.valid) return []
```

Em `src/main/ipc/xml-handlers.ts`:

Troque:

<!-- prettier-ignore -->
```ts
    async (
      _event,
      schema: XmlSchemaName,
      fileName: string,
      content: string
```

por:

<!-- prettier-ignore -->
```ts
    async (
      _event,
      schema: XmlSchemaName | null,
      fileName: string,
      content: string
```

- [ ] **Passo 8: As portas**

Em `src/renderer/src/application/ports/project-storage.ts`:

Troque:

<!-- prettier-ignore -->
```ts
  /** Se o caminho é um arquivo ou uma pasta; `not-found` quando não existe. */
  stat(path: string): Promise<Result<StorageEntryKind, StorageError>>
}
```

por:

<!-- prettier-ignore -->
```ts
  /** Se o caminho é um arquivo ou uma pasta; `not-found` quando não existe. */
  stat(path: string): Promise<Result<StorageEntryKind, StorageError>>
  /** Copia um arquivo byte a byte, criando as pastas do destino e substituindo o que houver lá. */
  copy(from: string, to: string): Promise<Result<null, StorageError>>
  /**
   * Renomeia um arquivo ou uma pasta. Como apagar pastas, só vale dentro da pasta de saída
   * da geração (SPEC §3); fora dela, `outside-project`.
   */
  rename(from: string, to: string): Promise<Result<null, StorageError>>
  /** Apaga a pasta com tudo o que tem dentro, só dentro da pasta de saída; se não existe, conta como apagada. */
  removeDirectory(path: string): Promise<Result<null, StorageError>>
}
```

Em `src/renderer/src/application/ports/xml-schema-validator.ts`:

Troque:

<!-- prettier-ignore -->
```ts
/** Etapas 1 e 2 da leitura (SPEC §5): XML bem-formado e conforme o XSD. */
export interface XmlSchemaValidator {
  /** Lista vazia = documento válido. */
  validate(schema: XmlSchema, fileName: string, content: string): Promise<XmlSchemaIssue[]>
}
```

por:

<!-- prettier-ignore -->
```ts
/** Etapas 1 e 2 da leitura (SPEC §5): XML bem-formado e conforme o XSD. */
export interface XmlSchemaValidator {
  /**
   * Lista vazia = documento válido. Sem schema (`null`), só confere se é XML bem-formado,
   * como nos fragmentos da geração (SPEC §4.4).
   */
  validate(schema: XmlSchema | null, fileName: string, content: string): Promise<XmlSchemaIssue[]>
}
```

- [ ] **Passo 9: Os adapters do Electron**

Em `src/renderer/src/infrastructure/electron/electron-project-storage.ts`:

Troque:

<!-- prettier-ignore -->
```ts
    return window.mdd.stat(path)
  }
}
```

por:

<!-- prettier-ignore -->
```ts
    return window.mdd.stat(path)
  }

  copy(from: string, to: string): Promise<Result<null, StorageError>> {
    return window.mdd.copy(from, to)
  }

  rename(from: string, to: string): Promise<Result<null, StorageError>> {
    return window.mdd.rename(from, to)
  }

  removeDirectory(path: string): Promise<Result<null, StorageError>> {
    return window.mdd.removeDirectory(path)
  }
}
```

Em `src/renderer/src/infrastructure/electron/electron-xml-schema-validator.ts`:

Troque:

<!-- prettier-ignore -->
```ts
/** Validação XSD feita no processo main (xmllint-wasm), chamada por IPC. */
export class ElectronXmlSchemaValidator implements XmlSchemaValidator {
  async validate(schema: XmlSchema, fileName: string, content: string): Promise<XmlSchemaIssue[]> {
    const result = await window.mdd.validateXml(schema, fileName, content)
    return result.ok ? result.value : [{ message: result.error.message }]
```

por:

<!-- prettier-ignore -->
```ts
/** Validação XSD feita no processo main (xmllint-wasm), chamada por IPC. */
export class ElectronXmlSchemaValidator implements XmlSchemaValidator {
  async validate(
    schema: XmlSchema | null,
    fileName: string,
    content: string
  ): Promise<XmlSchemaIssue[]> {
    const result = await window.mdd.validateXml(schema, fileName, content)
    return result.ok ? result.value : [{ message: result.error.message }]
```

- [ ] **Passo 10: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/output-guard-check.mts
```

Esperado, exatamente:

```
saida/loja-basica            → aceito (C:\proj\loja\saida\loja-basica)
saida/.loja-basica.tmp       → aceito (C:\proj\loja\saida\.loja-basica.tmp)
saida/loja-basica/docs/img   → aceito (C:\proj\loja\saida\loja-basica\docs\img)
SAIDA/Loja-Basica            → aceito (C:\proj\loja\SAIDA\Loja-Basica)
saida/..loja                 → aceito (C:\proj\loja\saida\..loja)
saida                        → recusado
saida/                       → recusado
saida/.                      → recusado
Saida/..                     → recusado
saida/../model.xml           → recusado
saida2/x                     → recusado
docs/saida/x                 → recusado
../loja/saida/x              → aceito (C:\proj\loja\saida\x)
../outra/saida/x             → recusado
C:/proj/loja/saida/x         → recusado
D:/saida/x                   → recusado
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
git add src/shared src/preload src/main src/renderer/src/application/ports src/renderer/src/infrastructure/electron
git commit -m "feat(ipc): copiar, renomear e apagar pastas dentro de saida/, e XML bem-formado sem schema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Derivação XML e escrita com troca

**Arquivos:**

- Criar: `src/renderer/src/application/ports/clock.ts`, `src/renderer/src/application/ports/product-deriver.ts`, `src/renderer/src/application/use-cases/write-product-folder.ts`, `src/renderer/src/application/use-cases/generate-product.ts`
- Criar: `src/renderer/src/infrastructure/xml/fragment-source.ts`, `src/renderer/src/infrastructure/xml/xml-product-deriver.ts`, `src/renderer/src/infrastructure/system/system-clock.ts`
- Modificar: `src/renderer/src/infrastructure/xml/xml-writer.ts`
- Verificação: `.checks/fragment-source-check.mts`, `.checks/generation-support.mts`, `.checks/generate-product-check.mts`

**Interfaces:**

- Consome: `planGeneration`, `GenerationPlan`, `PlannedSection`, `firstPerPath` (Tarefa 1); `ProjectStorage` com `copy`, `rename`, `removeDirectory` e `XmlSchemaValidator` sem schema (Tarefa 2); `FileProblem`, `fileError` (`application/file-problem.ts`); `DecodeProblem` (`infrastructure/xml/xml-reader.ts`); `element`, `textElement`, `writeXmlDocument` (`infrastructure/xml/xml-writer.ts`); `ProjectRoot` do main (só no roteiro, para imitar os limites do main).
- Produz:
  - `Clock` (`now(): Date`) (`ports/clock.ts`)
  - `ProductFile` (`{ kind: 'text'; path; content }` ou `{ kind: 'copy'; path }`) e `ProductDeriver.derive(plan, generatedAt): Promise<Result<readonly ProductFile[], FileProblem[]>>` (`ports/product-deriver.ts`)
  - `WriteProductResult` e `WriteProductFolder(storage, outputDirectory)`, com `folderOf(key): string`, `exists(key): Promise<boolean>` e `write(key, files): Promise<WriteProductResult>` (`use-cases/write-product-folder.ts`)
  - `GenerateProductResult` (`generated` com `folder` e `generatedAt`; `problems`; `needs-confirmation` com `folder`; `write-failed` com `problems` e `previousAt?`), `GenerateOptions` (`replace`), `GenerateProductDependencies` (`resolveConfiguration`, `deriver`, `writer`, `clock`) e `GenerateProduct.execute(project, key, options?)` (`use-cases/generate-product.ts`)
  - `XmlRaw`, `XmlNode` e `rawXml(raw)`; os filhos de `element` passam a ser `XmlNode` (`xml-writer.ts`)
  - `declaredEncoding(content): string | undefined` e `extractFragmentRoot(content): Result<string, DecodeProblem[]>` (`fragment-source.ts`)
  - `XmlProductDeriver(storage, validator)` e `SystemClock`

- [ ] **Passo 1: Escrever o roteiro `.checks/fragment-source-check.mts`**

```ts
// Extração da raiz dos fragmentos (plano da Fase 5, Tarefa 3).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/fragment-source-check.mts
import { declaredEncoding, extractFragmentRoot } from '@/infrastructure/xml/fragment-source'

const show = (text: string): string => JSON.stringify(text)
const cases: Record<string, string> = {
  simples: '<?xml version="1.0" encoding="UTF-8"?>\n<topic xmlns="urn:x">\n  <p>a</p>\n</topic>\n',
  'sem namespace': '<topic>\n  <p>a</p>\n</topic>',
  'prefixo na raiz': '<d:topic xmlns:d="urn:d"><p/></d:topic>',
  'BOM e CRLF':
    '\u{FEFF}<?xml version="1.0"?>\r\n<!-- licença -->\r\n<t a="1">\r\n  <p/>\r\n</t>\r\n',
  'DOCTYPE interno':
    '<?xml version="1.0"?>\n<!DOCTYPE t [\n <!ENTITY % x "a>]">\n <!-- ]> -->\n]>\n<?pi antes?>\n  <t><![CDATA[</t>]]><!-- </t> --></t>\n<!-- depois --><?pi depois?>\n\n',
  'CR sozinho': '<?xml version="1.0"?>\r<!-- a -->\r<t>\r<p/></t>',
  'emoji antes': '<!-- 😀 --><t/>',
  'raiz vazia': '<?xml version="1.0"?>\n<t/>',
  'DOCTYPE externo e &nbsp;':
    '<?xml version="1.0"?>\n<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">\n<topic>\n  <p>a&nbsp;b</p>\n  <p>&copy;</p>\n</topic>\n',
  'entidade interna': '<!DOCTYPE t [\n<!ENTITY e "x">\n]>\n<t>\n\n&e;</t>',
  'prefixo sem declaração': '<t>\n\n  <p:x/></t>',
  'referências válidas': '<t>&amp;&lt;&gt;&quot;&apos;&#233;&#xE9;</t>'
}
for (const [name, content] of Object.entries(cases)) {
  const result = extractFragmentRoot(content)
  console.log(
    name.padEnd(26),
    '→',
    result.ok
      ? show(result.value)
      : result.error.map((p) => `linha ${p.line ?? '?'}: ${p.message}`).join(' | ')
  )
}

console.log('--- codificação declarada')
for (const content of [
  '<?xml version="1.0" encoding="UTF-8"?><t/>',
  "\u{FEFF}<?xml version='1.0' encoding='iso-8859-1' standalone='yes'?><t/>",
  '<?xml version="1.0"?><t/>',
  '<t/>'
]) {
  console.log(
    show(content.slice(0, 40)).replace('\u{FEFF}', '<BOM>').padEnd(46),
    '→',
    declaredEncoding(content)
  )
}
```

- [ ] **Passo 2: Escrever `.checks/generation-support.mts`**

O apoio dos roteiros da geração: um `ProjectStorage` sobre o disco com os limites do processo main (usa o próprio `ProjectRoot`), o `xmllint` como no main, a leitura do exemplo, a forma canônica para comparar com o esperado e um PowerShell que segura um arquivo aberto.

```ts
// Apoio dos roteiros da geração (plano da Fase 5): o armazenamento em disco com as mesmas
// regras do processo main, o xmllint, a leitura do exemplo e a comparação com o esperado.
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { DOMParser, type Element, type Node } from '@xmldom/xmldom'
import { validateXML } from 'xmllint-wasm'
import { ProjectRoot } from '../src/main/project-root'
import type { ProjectStorage, StorageError } from '@/application/ports/project-storage'
import type { XmlSchema, XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import type { Project } from '@/domain/project/project'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'

const sha = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex')

/** Uma cópia nova do exemplo em .checks/geracao/<nome>. */
export function freshExample(name: string): string {
  const folder = resolve('.checks/geracao', name)
  rmSync(folder, { recursive: true, force: true })
  cpSync('docs/examples/loja-online', folder, { recursive: true })
  return folder
}

/** O projeto da pasta, lido pelos codecs (sem a validação XSD, que o exemplo já passa). */
export function readProject(folder: string): Project {
  const read = (path: string) => parseXmlRoot(readFileSync(join(folder, path), 'utf8'))
  const model = decodeFeatureModel(read('model.xml'))
  const assets = decodeAssetCatalog(read('assets.xml'))
  const configuration = decodeConfiguration(read('configurations/loja-basica.xml'))
  if (!model.ok || !assets.ok || !configuration.ok) throw new Error('o exemplo não abriu')
  return {
    model: model.value,
    assets: assets.value,
    configurations: [{ key: 'loja-basica', configuration: configuration.value }]
  }
}

/**
 * O ProjectStorage sobre o disco, com os limites do processo main (src/main/ipc/file-handlers.ts):
 * `resolve` para o projeto e `resolveInOutput` para renomear e apagar pastas. As pré-condições
 * de escrita ficam de fora, porque a geração grava sempre com `overwrite`.
 */
export class DiskStorage implements ProjectStorage {
  private readonly root = new ProjectRoot()

  constructor(folder: string) {
    this.root.open(folder)
  }

  private async run<T>(
    path: string | null,
    shown: string,
    operation: (absolute: string) => Promise<Result<T, StorageError>>
  ): Promise<Result<T, StorageError>> {
    if (path === null)
      return err({ code: 'outside-project', message: `"${shown}" fica fora do limite.` })
    try {
      return await operation(path)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return err({ code: 'not-found', message: `"${shown}" não existe.` })
      return err({ code: 'io', message: `Erro ao acessar "${shown}": ${(error as Error).message}` })
    }
  }

  readText(path: string) {
    return this.run(this.root.resolve(path), path, async (absolute) => {
      const content = await readFile(absolute, 'utf8')
      return ok({ content, hash: sha(content) })
    })
  }

  writeText(path: string, content: string) {
    return this.run(this.root.resolve(path), path, async (absolute) => {
      await mkdir(dirname(absolute), { recursive: true })
      await writeFile(absolute, content, 'utf8')
      return ok(sha(content))
    })
  }

  list(directory: string) {
    return this.run(this.root.resolve(directory), directory, async (absolute) =>
      ok(
        (await readdir(absolute, { withFileTypes: true })).map((entry) => ({
          name: entry.name,
          kind: entry.isFile() ? ('file' as const) : ('directory' as const)
        }))
      )
    )
  }

  remove(path: string) {
    return this.run(this.root.resolve(path), path, async (absolute) => {
      if (existsSync(absolute)) await unlink(absolute)
      return ok(null)
    })
  }

  stat(path: string) {
    return this.run(this.root.resolve(path), path, async (absolute) =>
      ok((await stat(absolute)).isDirectory() ? ('directory' as const) : ('file' as const))
    )
  }

  copy(from: string, to: string) {
    const target = this.root.resolve(to)
    return this.run(this.root.resolve(from), from, async (absolute) => {
      if (target === null) return err({ code: 'outside-project' as const, message: to })
      if ((await stat(absolute)).isDirectory())
        return err({ code: 'io' as const, message: 'pasta' })
      await mkdir(dirname(target), { recursive: true })
      await copyFile(absolute, target)
      return ok(null)
    })
  }

  rename(from: string, to: string) {
    const target = this.root.resolveInOutput(to)
    return this.run(this.root.resolveInOutput(from), from, async (absolute) => {
      if (target === null) return err({ code: 'outside-project' as const, message: to })
      await rename(absolute, target)
      return ok(null)
    })
  }

  removeDirectory(path: string) {
    return this.run(this.root.resolveInOutput(path), path, async (absolute) => {
      await rm(absolute, { recursive: true, force: true })
      return ok(null)
    })
  }
}

/** O xmllint do processo main (src/main/xml/schema-validator.ts), sem schema na geração. */
export class NodeXmlValidator implements XmlSchemaValidator {
  async validate(schema: XmlSchema | null, fileName: string, content: string) {
    const schemas =
      schema === null
        ? []
        : [
            {
              fileName: `${schema}.xsd`,
              contents: readFileSync(`docs/schemas/${schema}.xsd`, 'utf8')
            }
          ]
    const result = await validateXML({ xml: [{ fileName, contents: content }], schema: schemas })
    if (result.valid) return []
    const issues = result.errors.map((e) => ({
      line: e.loc?.lineNumber,
      message: e.message
        .replace(/^(Schemas validity error|Schemas parser error|parser error)\s*:\s*/, '')
        .trim()
    }))
    const located = issues.filter((issue) => issue.line !== undefined && issue.message !== '')
    return located.length > 0 ? located : issues
  }
}

export const fixedClock = (iso: string) => ({ now: () => new Date(iso) })

/** O product.xml conforme o product.xsd (que importa o xml.xsd)? */
export async function productSchemaIssues(content: string): Promise<string[]> {
  const result = await validateXML({
    xml: [{ fileName: 'product.xml', contents: content }],
    schema: [
      { fileName: 'product.xsd', contents: readFileSync('docs/schemas/product.xsd', 'utf8') }
    ],
    preload: [{ fileName: 'xml.xsd', contents: readFileSync('docs/schemas/xml.xsd', 'utf8') }]
  })
  return result.valid ? [] : result.errors.map((e) => `${e.loc?.lineNumber}: ${e.message}`)
}

/**
 * Forma canônica para comparar com o esperado: ignora comentários, espaços entre elementos,
 * a quantidade de espaços dentro dos textos, as declarações de namespace e o `generatedAt`.
 * Os elementos são comparados pelo namespace de verdade, não pelo prefixo.
 */
export function canonical(content: string): string {
  const root = new DOMParser().parseFromString(content, 'text/xml').documentElement
  if (root === null) throw new Error('sem raiz')
  const lines: string[] = []
  const walk = (node: Node, depth: number): void => {
    const indent = '  '.repeat(depth)
    if (node.nodeType === 1) {
      const element = node as Element
      const attributes = Array.from(element.attributes)
        .filter(
          (a) => a.name !== 'xmlns' && !a.name.startsWith('xmlns:') && a.name !== 'generatedAt'
        )
        .map((a) => `${a.namespaceURI ? `{${a.namespaceURI}}` : ''}${a.localName}=${a.value}`)
        .sort()
      lines.push(
        `${indent}{${element.namespaceURI ?? ''}}${element.localName} ${attributes.join(' ')}`
      )
      for (const child of Array.from(element.childNodes)) walk(child, depth + 1)
    } else if (node.nodeType === 3 || node.nodeType === 4) {
      const text = (node.nodeValue ?? '').replace(/\s+/g, ' ').trim()
      if (text !== '') lines.push(`${indent}"${text}"`)
    }
  }
  walk(root, 0)
  return lines.join('\n')
}

export function sameBytes(a: string, b: string): boolean {
  return readFileSync(a).equals(readFileSync(b))
}

/** Mantém um arquivo aberto por outro processo (PowerShell), como um editor faria. */
export function holdOpen(path: string): Promise<ChildProcess> {
  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `$f=[System.IO.File]::Open('${path}','Open','Read','Read'); 'ok'; Start-Sleep 60`
    ],
    { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true }
  )
  return new Promise((done) => child.stdout!.once('data', () => done(child)))
}

export function writeFileIn(folder: string, path: string, content: string): void {
  mkdirSync(dirname(join(folder, path)), { recursive: true })
  writeFileSync(join(folder, path), content, 'utf8')
}
```

- [ ] **Passo 3: Escrever o roteiro `.checks/generate-product-check.mts`**

Dez casos sobre cópias do exemplo em `.checks/geracao/`, inclusive a troca que falha (com um armazenamento que falha de propósito) e a trava do Windows (caso 9).

```ts
// Geração do produto sobre cópias de docs/examples/loja-online (plano da Fase 5, Tarefa 3).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
import { existsSync, readdirSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { DOMParser, type Element } from '@xmldom/xmldom'
import type { ProjectStorage } from '@/application/ports/project-storage'
import {
  GenerateProduct,
  type GenerateProductResult
} from '@/application/use-cases/generate-product'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { WriteProductFolder } from '@/application/use-cases/write-product-folder'
import type { Configuration } from '@/domain/configuration/configuration'
import { err } from '@/domain/shared/result'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { extractFragmentRoot } from '@/infrastructure/xml/fragment-source'
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import {
  canonical,
  DiskStorage,
  fixedClock,
  freshExample,
  holdOpen,
  NodeXmlValidator,
  productSchemaIssues,
  readProject,
  sameBytes,
  writeFileIn
} from './generation-support.mts'

const log = (label: string, value: unknown): void => console.log(label.padEnd(40), '→', value)
const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const expected = readFileSync('docs/examples/produto-esperado/loja-basica/product.xml', 'utf8')

function generator(
  folder: string,
  storage: ProjectStorage = new DiskStorage(folder),
  at = '2026-09-24T14:03:05.123Z'
) {
  return new GenerateProduct({
    resolveConfiguration: resolver,
    deriver: new XmlProductDeriver(storage, new NodeXmlValidator()),
    writer: new WriteProductFolder(storage, 'saida'),
    clock: fixedClock(at)
  })
}
const summary = (result: GenerateProductResult): string => {
  switch (result.kind) {
    case 'generated':
      return `gerado em ${result.folder} às ${result.generatedAt.toISOString()}`
    case 'needs-confirmation':
      return `precisa confirmar: ${result.folder}`
    case 'problems':
    case 'write-failed':
      return `${result.kind}${'previousAt' in result && result.previousAt ? ` (anterior em ${result.previousAt})` : ''}\n${result.problems
        .map(
          (p) =>
            `${' '.repeat(43)}${p.file}${p.line ? `:${p.line}` : ''}${p.subject ? ` [${p.subject}]` : ''} ${p.message}`
        )
        .join('\n')}`
  }
}
const tree = (folder: string, prefix = ''): string[] =>
  existsSync(folder)
    ? readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? tree(join(folder, entry.name), `${prefix}${entry.name}/`)
          : [`${prefix}${entry.name}`]
      )
    : ['(não existe)']

// 1. loja-basica: equivalente ao esperado, conforme o product.xsd, com o .svg copiado
const a = freshExample('basica')
const projectA = readProject(a)
log('1. gerar loja-basica', summary(await generator(a).execute(projectA, 'loja-basica')))
const product = readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8')
log('   arquivos em saida/', tree(join(a, 'saida')).join(', '))
log('   igual ao esperado (sem espaços)', canonical(product) === canonical(expected))
log('   conforme o product.xsd', (await productSchemaIssues(product)).join(' | ') || 'sim')
log('   generatedAt', /generatedAt="([^"]+)"/.exec(product)?.[1])
log(
  '   .svg idêntico',
  sameBytes(join(a, 'docs/img/pix-fluxo.svg'), join(a, 'saida/loja-basica/docs/img/pix-fluxo.svg'))
)
const intact = [
  'docs/loja/visao-geral.xml',
  'docs/busca/busca.xml',
  'docs/busca/busca-app.xml',
  'docs/pagamento/pix.xml'
].every((path) => {
  const root = extractFragmentRoot(readFileSync(join(a, path), 'utf8'))
  return root.ok && product.includes(root.value)
})
log('   fragmentos intactos no product.xml', intact)
console.log(product.split('\n').slice(0, 12).join('\n'))

// 2. de novo, sem substituir: pede confirmação e não mexe na pasta
const before = readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8')
log(
  '2. gerar de novo',
  summary(await generator(a, undefined, '2026-09-24T15:00:00Z').execute(projectA, 'loja-basica'))
)
log('   pasta intacta', readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8') === before)

// 3. substituir, com restos de uma geração interrompida
writeFileIn(a, 'saida/.loja-basica.tmp/resto.txt', 'x')
writeFileIn(a, 'saida/.loja-basica.old/resto.txt', 'x')
writeFileIn(a, 'saida/loja-basica/a-mao.txt', 'colocado à mão')
log(
  '3. substituir',
  summary(
    await generator(a, undefined, '2026-09-24T15:00:00Z').execute(projectA, 'loja-basica', {
      replace: true
    })
  )
)
log('   arquivos em saida/', tree(join(a, 'saida')).join(', '))
log(
  '   generatedAt',
  /generatedAt="([^"]+)"/.exec(readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8'))?.[1]
)

// 4. pag_boleto selecionado e boleto.xml ausente: falha e não grava nada
const b = freshExample('boleto')
renameSync(join(b, 'docs/pagamento/boleto.xml'), join(b, 'docs/pagamento/boleto-renomeado.xml'))
const comBoleto: Configuration = {
  ...readProject(b).configurations[0].configuration,
  decisions: [
    { featureId: 'busca', state: 'selected' },
    { featureId: 'pag_cartao', state: 'selected' },
    { featureId: 'pag_pix', state: 'selected' },
    { featureId: 'pag_boleto', state: 'selected' }
  ]
}
const projectB = {
  ...readProject(b),
  configurations: [{ key: 'loja-basica', configuration: comBoleto }]
}
log('4. boleto ausente', summary(await generator(b).execute(projectB, 'loja-basica')))
log('   saida/ existe?', existsSync(join(b, 'saida')))

// 5. vários problemas de uma vez: malformado, entidade, codificação e recurso ausente
const c = freshExample('problemas')
writeFileIn(
  c,
  'docs/pagamento/pix.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<topic xmlns="urn:exemplo:doc">\n  <title>PIX\n</topic>\n'
)
writeFileIn(
  c,
  'docs/busca/busca.xml',
  '<?xml version="1.0"?>\n<!DOCTYPE topic SYSTEM "topic.dtd">\n<topic>\n  <p>Busca&nbsp;rápida</p>\n</topic>\n'
)
writeFileIn(
  c,
  'docs/loja/visao-geral.xml',
  '<?xml version="1.0" encoding="ISO-8859-1"?>\n<topic/>\n'
)
renameSync(join(c, 'docs/img/pix-fluxo.svg'), join(c, 'docs/img/outro.svg'))
log('5. vários problemas', summary(await generator(c).execute(readProject(c), 'loja-basica')))
log('   saida/ existe?', existsSync(join(c, 'saida')))

// 6. fragmento sem namespace, com DOCTYPE e comentários antes da raiz
const d = freshExample('sem-namespace')
writeFileIn(
  d,
  'docs/busca/busca-app.xml',
  '\u{FEFF}<?xml version="1.0" encoding="utf-8"?>\r\n<!-- cabeçalho -->\r\n<!DOCTYPE topic [\r\n  <!ELEMENT topic ANY>\r\n]>\r\n<topic id="app">\r\n  <pre>  linha 1\r\n    linha 2</pre>\r\n</topic>\r\n<!-- fim -->\r\n'
)
log('6. sem namespace', summary(await generator(d).execute(readProject(d), 'loja-basica')))
const productD = readFileSync(join(d, 'saida/loja-basica/product.xml'), 'utf8')
const fragmentD = [
  ...productD.matchAll(/<fragment asset="doc_busca_app"[^>]*>\r?\n(.*?)\r?\n\s*<\/fragment>/gs)
][0]?.[1]
log('   o fragmento no product.xml', JSON.stringify(fragmentD))
const topics = new DOMParser().parseFromString(productD, 'text/xml').getElementsByTagName('topic')
const appTopic = Array.from(topics).find(
  (t) => (t as Element).getAttribute('id') === 'app'
) as Element
log('   namespace do <topic> embutido', JSON.stringify(appTopic.namespaceURI))
log('   conforme o product.xsd', (await productSchemaIssues(productD)).join(' | ') || 'sim')

// 7. a troca falha: a pasta anterior volta para o lugar
const e = freshExample('troca')
await generator(e).execute(readProject(e), 'loja-basica')
const disk = new DiskStorage(e)
let renames = 0
const failingPlace: ProjectStorage = Object.assign(Object.create(disk), {
  rename: async (from: string, to: string) =>
    ++renames === 2
      ? err({ code: 'io' as const, message: 'falha simulada' })
      : disk.rename(from, to)
})
log(
  '7. troca falha',
  summary(
    await generator(e, failingPlace).execute(readProject(e), 'loja-basica', { replace: true })
  )
)
log('   arquivos em saida/', tree(join(e, 'saida')).join(', '))

// 8. a troca e a volta falham: a mensagem diz onde ficou a anterior
renames = 0
const failingBoth: ProjectStorage = Object.assign(Object.create(disk), {
  rename: async (from: string, to: string) =>
    ++renames >= 2 ? err({ code: 'io' as const, message: 'falha simulada' }) : disk.rename(from, to)
})
log(
  '8. troca e volta falham',
  summary(await generator(e, failingBoth).execute(readProject(e), 'loja-basica', { replace: true }))
)
log('   arquivos em saida/', tree(join(e, 'saida')).join(', '))

// 9. um arquivo da pasta aberto em outro programa (a trava do Windows)
const f = freshExample('trava')
await generator(f).execute(readProject(f), 'loja-basica')
const antes = readFileSync(join(f, 'saida/loja-basica/product.xml'), 'utf8')
const holder = await holdOpen(join(f, 'saida/loja-basica/product.xml'))
log(
  '9. arquivo aberto',
  summary(
    await generator(f, undefined, '2026-09-24T16:00:00Z').execute(readProject(f), 'loja-basica', {
      replace: true
    })
  )
)
holder.kill()
log('   arquivos em saida/', tree(join(f, 'saida')).join(', '))
log(
  '   product.xml anterior intacto',
  readFileSync(join(f, 'saida/loja-basica/product.xml'), 'utf8') === antes
)

// 10. configuração que não existe mais / incompleta
log('10. chave inexistente', summary(await generator(a).execute(projectA, 'nao-existe')))
const incompleta = {
  ...projectA,
  configurations: [
    {
      key: 'loja-basica',
      configuration: { ...projectA.configurations[0].configuration, decisions: [] }
    }
  ]
}
log('    incompleta', summary(await generator(a).execute(incompleta, 'loja-basica')))
```

Confira o BOM escrito como escape nos dois roteiros:

```bash
grep -c 'u{FEFF}' .checks/fragment-source-check.mts .checks/generate-product-check.mts
```

Esperado: `3` e `1`.

- [ ] **Passo 4: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-source-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
```

Esperado: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/infrastructure' …` no primeiro e `… '@/application' …` no segundo.

- [ ] **Passo 5: As portas `Clock` e `ProductDeriver`**

Crie `src/renderer/src/application/ports/clock.ts`:

```ts
/** Data e hora atuais (SPEC §6.2), para o `generatedAt` do produto gerado. */
export interface Clock {
  now(): Date
}
```

Crie `src/renderer/src/application/ports/product-deriver.ts`:

```ts
import type { GenerationPlan } from '@/domain/generation/generation-plan'
import type { Result } from '@/domain/shared/result'
import type { FileProblem } from '../file-problem'

/** Um arquivo do produto gerado, com o caminho relativo à pasta do produto. */
export type ProductFile =
  | { readonly kind: 'text'; readonly path: string; readonly content: string }
  /** Cópia byte a byte do arquivo do projeto com este caminho, para o mesmo caminho no produto. */
  | { readonly kind: 'copy'; readonly path: string }

/**
 * Monta o produto de um plano (SPEC §4.4, passos 2 e 3): confere todas as fontes e devolve os
 * arquivos do produto, ou todos os problemas encontrados de uma vez. Não grava nada: a pasta
 * temporária e a troca ficam com o `WriteProductFolder`, igual para qualquer formato.
 */
export interface ProductDeriver {
  derive(
    plan: GenerationPlan,
    generatedAt: Date
  ): Promise<Result<readonly ProductFile[], FileProblem[]>>
}
```

- [ ] **Passo 6: O nó de texto cru em `src/renderer/src/infrastructure/xml/xml-writer.ts`**

Troque:

<!-- prettier-ignore -->
```ts
  readonly name: string
  readonly attributes: XmlAttributes
  readonly children: readonly XmlElement[]
  /** Quando definido, o elemento tem só este texto e nenhum filho. */
  readonly text?: string
}

export function element(
  name: string,
  attributes: XmlAttributes = [],
  children: readonly XmlElement[] = []
): XmlElement {
  return { name, attributes, children }
}
```

por:

<!-- prettier-ignore -->
```ts
  readonly name: string
  readonly attributes: XmlAttributes
  readonly children: readonly XmlNode[]
  /** Quando definido, o elemento tem só este texto e nenhum filho. */
  readonly text?: string
}

/**
 * Um trecho de XML já pronto, escrito exatamente como está: só a primeira linha recebe o
 * recuo. É como um fragmento entra no product.xml sem mudar os espaços de dentro (SPEC §4.4).
 */
export interface XmlRaw {
  readonly raw: string
}

export type XmlNode = XmlElement | XmlRaw

export function element(
  name: string,
  attributes: XmlAttributes = [],
  children: readonly XmlNode[] = []
): XmlElement {
  return { name, attributes, children }
}

export function rawXml(raw: string): XmlRaw {
  return { raw }
}
```

Troque:

<!-- prettier-ignore -->
```ts
}

function writeElement(node: XmlElement, depth: number): string {
  const indent = '  '.repeat(depth)
```

por:

<!-- prettier-ignore -->
```ts
}

function writeNode(node: XmlNode, depth: number): string {
  if ('raw' in node) return `${'  '.repeat(depth)}${node.raw}`
  return writeElement(node, depth)
}

function writeElement(node: XmlElement, depth: number): string {
  const indent = '  '.repeat(depth)
```

Troque:

<!-- prettier-ignore -->
```ts
  return [
    `${opening}>`,
    ...node.children.map((child) => writeElement(child, depth + 1)),
    `${indent}</${node.name}>`
  ].join('\n')
```

por:

<!-- prettier-ignore -->
```ts
  return [
    `${opening}>`,
    ...node.children.map((child) => writeNode(child, depth + 1)),
    `${indent}</${node.name}>`
  ].join('\n')
```

- [ ] **Passo 7: Criar `src/renderer/src/infrastructure/xml/fragment-source.ts`**

```ts
import { DOMParser, type Document, type ParseError } from '@xmldom/xmldom'
import { err, ok, type Result } from '@/domain/shared/result'
import type { DecodeProblem } from './xml-reader'

/*
 * Como um fragmento entra no product.xml (SPEC §4.4): só o elemento raiz, com o texto
 * exatamente como está no arquivo. Saem o BOM, a declaração XML, o DOCTYPE e os comentários
 * e instruções de fora da raiz. Só é chamada depois que o xmllint confirmou que o arquivo é
 * XML bem-formado: o @xmldom/xmldom aceita alguns erros de sintaxe, mas pega o que o xmllint
 * deixa passar num arquivo com DOCTYPE (entidades) e prefixos de namespace sem declaração.
 */

const BOM = '\u{FEFF}'
const DECLARED_ENCODING = /^<\?xml\s[^?]*?\bencoding\s*=\s*(["'])(.*?)\1/
const ENTITY_NOT_FOUND = /^entity not found:(&[^;\s]+;)/
/** As quebras de linha que o @xmldom/xmldom conta: "\r\n", "\r" sozinho e "\n". */
const LINE_BREAK = /\r\n?|\n/g

/** A codificação da declaração XML, se houver. O app só lê fragmentos em UTF-8. */
export function declaredEncoding(content: string): string | undefined {
  return DECLARED_ENCODING.exec(withoutBom(content))?.[2]
}

/** O texto do elemento raiz, pronto para entrar num `<fragment>`, ou os problemas encontrados. */
export function extractFragmentRoot(content: string): Result<string, DecodeProblem[]> {
  const text = withoutBom(content)
  const parsed = parse(text)
  if (!parsed.ok) return parsed
  const root = parsed.value.documentElement
  if (root === null || root.lineNumber === undefined || root.columnNumber === undefined) {
    return err([{ message: 'O fragmento não tem elemento raiz.' }])
  }

  // O fim da raiz é onde começa o nó seguinte (espaço, comentário ou instrução): assim um
  // CDATA ou comentário com algo parecido com a tag de fechamento não confunde a conta.
  const start = offsetOf(text, root.lineNumber, root.columnNumber)
  const next = root.nextSibling
  const end =
    next?.lineNumber !== undefined && next.columnNumber !== undefined
      ? offsetOf(text, next.lineNumber, next.columnNumber)
      : text.length
  const rootText = text.slice(start, end).trimEnd()
  const openTag = `<${root.tagName}`
  if (!rootText.startsWith(openTag)) {
    return err([{ line: root.lineNumber, message: 'Não foi possível localizar o elemento raiz.' }])
  }

  // Sem namespace padrão declarado, os elementos sem prefixo herdariam o `urn:mdd:product`
  // do produto: `xmlns=""` os mantém sem namespace, como no arquivo.
  if (root.hasAttribute('xmlns')) return ok(rootText)
  return ok(`${openTag} xmlns=""${rootText.slice(openTag.length)}`)
}

function withoutBom(content: string): string {
  return content.startsWith(BOM) ? content.slice(BOM.length) : content
}

function parse(text: string): Result<Document, DecodeProblem[]> {
  const problems: DecodeProblem[] = []
  try {
    const document = new DOMParser({
      locator: true,
      // As posições valem no texto como está, com "\r\n" ou "\r" sozinho.
      normalizeLineEndings: (source) => source,
      onError: (level, message, context) => {
        // Os erros fatais interrompem a leitura e chegam pelo catch.
        if (level !== 'error') return
        const line: number | undefined = context?.locator?.lineNumber
        // Numa entidade, a posição é a do começo do texto: a linha certa é a da entidade.
        const entity = ENTITY_NOT_FOUND.exec(message)
        problems.push({
          line: entity === null ? line : lineOfNext(text, entity[1], line),
          message: describe(message)
        })
      }
    }).parseFromString(text, 'text/xml')
    return problems.length > 0 ? err(problems) : ok(document)
  } catch (error) {
    const { message, locator } = error as ParseError
    return err([...problems, { line: locator?.lineNumber, message: describe(message) }])
  }
}

/** Posição no texto a partir de linha e coluna, as duas começando em 1. */
function offsetOf(text: string, line: number, column: number): number {
  const breaks = new RegExp(LINE_BREAK)
  let lineStart = 0
  for (let current = 1; current < line; current++) {
    const found = breaks.exec(text)
    if (found === null) break
    lineStart = found.index + found[0].length
  }
  return lineStart + column - 1
}

/** A linha da primeira vez que o trecho aparece, a partir do começo da linha indicada. */
function lineOfNext(
  text: string,
  needle: string,
  fromLine: number | undefined
): number | undefined {
  if (fromLine === undefined) return undefined
  const found = text.indexOf(needle, offsetOf(text, fromLine, 1))
  if (found < 0) return fromLine
  return (text.slice(0, found).match(LINE_BREAK)?.length ?? 0) + 1
}

function describe(message: string): string {
  const entity = ENTITY_NOT_FOUND.exec(message)
  if (entity !== null) {
    return `A entidade ${entity[1]} não é suportada: use o próprio caractere ou uma referência numérica, como &#160;.`
  }
  if (message.includes('NamespaceError')) {
    return 'Há um prefixo de namespace sem declaração (xmlns:…).'
  }
  return message.split('\n')[0]
}
```

Confira o BOM escrito como escape:

```bash
grep -c 'u{FEFF}' src/renderer/src/infrastructure/xml/fragment-source.ts
```

Esperado: `1`.

- [ ] **Passo 8: Criar `src/renderer/src/infrastructure/xml/xml-product-deriver.ts`**

```ts
import type { FileProblem } from '@/application/file-problem'
import type { ProductDeriver, ProductFile } from '@/application/ports/product-deriver'
import type { ProjectStorage } from '@/application/ports/project-storage'
import type { XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import { firstPerPath, type Asset } from '@/domain/assets/asset-catalog'
import type { GenerationPlan, PlannedSection } from '@/domain/generation/generation-plan'
import { err, ok, type Result } from '@/domain/shared/result'
import { declaredEncoding, extractFragmentRoot } from './fragment-source'
import type { DecodeProblem } from './xml-reader'
import { element, rawXml, textElement, writeXmlDocument, type XmlElement } from './xml-writer'

const NAMESPACE = 'urn:mdd:product'

/**
 * O produto em XML (SPEC §4.4, ADR 0006): o product.xml com cada fragmento embutido e os
 * recursos copiados. Confere todas as fontes antes e devolve todos os problemas de uma vez.
 */
export class XmlProductDeriver implements ProductDeriver {
  private readonly storage: ProjectStorage
  private readonly validator: XmlSchemaValidator

  constructor(storage: ProjectStorage, validator: XmlSchemaValidator) {
    this.storage = storage
    this.validator = validator
  }

  async derive(
    plan: GenerationPlan,
    generatedAt: Date
  ): Promise<Result<readonly ProductFile[], FileProblem[]>> {
    // Um caminho usado por dois assets é conferido uma vez só. As conferências de cada tipo
    // rodam juntas, e os problemas saem na ordem do plano.
    const fragments = firstPerPath(fragmentsOf(plan.root))
    const roots = await Promise.all(fragments.map((asset) => this.loadFragment(asset)))
    const resources = await Promise.all(plan.resources.map((asset) => this.checkResource(asset)))
    const problems = [...roots, ...resources].flatMap((result) => (result.ok ? [] : result.error))
    if (problems.length > 0) return err(problems)

    const rootByPath = new Map<string, string>()
    fragments.forEach((asset, index) => {
      const root = roots[index]
      if (root.ok) rootByPath.set(asset.path, root.value)
    })
    return ok([
      { kind: 'text', path: 'product.xml', content: writeProduct(plan, generatedAt, rootByPath) },
      ...plan.resources.map((asset): ProductFile => ({ kind: 'copy', path: asset.path }))
    ])
  }

  /** Lê o fragmento e devolve o texto da raiz, pronto para entrar no product.xml. */
  private async loadFragment(asset: Asset): Promise<Result<string, FileProblem[]>> {
    const read = await this.storage.readText(asset.path)
    if (!read.ok) {
      const message = read.error.code === 'not-found' ? 'Arquivo ausente.' : read.error.message
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
    const issues = await this.validator.validate(null, asset.path, content)
    if (issues.length > 0) return err(issues.map((issue) => problem(asset, issue)))
    const root = extractFragmentRoot(content)
    return root.ok ? root : err(root.error.map((issue) => problem(asset, issue)))
  }

  private async checkResource(asset: Asset): Promise<Result<null, FileProblem[]>> {
    const entry = await this.storage.stat(asset.path)
    if (entry.ok && entry.value === 'file') return ok(null)
    return err([problem(asset, { message: 'Arquivo ausente.' })])
  }
}

function problem(asset: Asset, issue: DecodeProblem): FileProblem {
  return {
    file: asset.path,
    line: issue.line,
    subject: asset.id,
    severity: 'error',
    message: issue.message
  }
}

function fragmentsOf(section: PlannedSection): Asset[] {
  return [...section.fragments, ...section.children.flatMap(fragmentsOf)]
}

function writeProduct(
  plan: GenerationPlan,
  generatedAt: Date,
  rootByPath: ReadonlyMap<string, string>
): string {
  const sectionElement = (section: PlannedSection): XmlElement =>
    element(
      'section',
      [['feature', section.featureId]],
      [
        ...section.fragments.map((asset) =>
          element(
            'fragment',
            [
              ['asset', asset.id],
              ['xml:base', baseOf(asset.path)]
            ],
            [rawXml(rootByPath.get(asset.path) ?? '')]
          )
        ),
        ...section.children.map(sectionElement)
      ]
    )

  return writeXmlDocument(
    element(
      'product',
      [
        ['xmlns', NAMESPACE],
        ['schemaVersion', '1'],
        ['name', plan.productName],
        ['model', plan.modelName],
        ['generatedAt', generatedAt.toISOString().replace(/\.\d{3}Z$/, 'Z')]
      ],
      [
        element(
          'features',
          [],
          plan.features.map((feature) =>
            element(
              'feature',
              [
                ['id', feature.id],
                ['name', feature.name]
              ],
              feature.attributes.map((attribute) =>
                textElement('attribute', attribute.value, [['id', attribute.id]])
              )
            )
          )
        ),
        element('content', [], [sectionElement(plan.root)])
      ]
    )
  )
}

/** A pasta do fragmento, que resolve os caminhos relativos dentro dele: "docs/pagamento/". */
function baseOf(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash < 0 ? './' : path.slice(0, slash + 1)
}
```

- [ ] **Passo 9: Criar `src/renderer/src/application/use-cases/write-product-folder.ts`**

```ts
import { fileError, type FileProblem } from '../file-problem'
import type { ProductFile } from '../ports/product-deriver'
import type { ProjectStorage } from '../ports/project-storage'

export type WriteProductResult =
  | { readonly kind: 'written' }
  | {
      readonly kind: 'failed'
      readonly problems: readonly FileProblem[]
      /**
       * Onde ficou a versão anterior, quando ela não voltou para o lugar. Sem isso, a pasta
       * anterior continua onde estava (ou não havia nenhuma).
       */
      readonly previousAt?: string
    }

/**
 * A pasta temporária e a troca (SPEC §4.4, passos 3 e 4). Grava tudo em
 * `saida/.<chave>.tmp/` e só então troca pela pasta do produto: renomeia a anterior para
 * `.old`, a temporária para o lugar dela, e apaga a `.old`. Uma falha no meio nunca deixa o
 * usuário sem nenhuma das duas versões. Não sabe nada de XML: serve para qualquer formato.
 */
export class WriteProductFolder {
  private readonly storage: ProjectStorage
  private readonly outputDirectory: string

  /** `outputDirectory` é a pasta de saída do projeto (SPEC §3), como `saida`. */
  constructor(storage: ProjectStorage, outputDirectory: string) {
    this.storage = storage
    this.outputDirectory = outputDirectory
  }

  /** A pasta do produto de uma configuração: `saida/loja-basica`. */
  folderOf(key: string): string {
    return `${this.outputDirectory}/${key}`
  }

  async exists(key: string): Promise<boolean> {
    return (await this.storage.stat(this.folderOf(key))).ok
  }

  async write(key: string, files: readonly ProductFile[]): Promise<WriteProductResult> {
    const folder = this.folderOf(key)
    const temporary = `${this.outputDirectory}/.${key}.tmp`
    const previous = `${this.outputDirectory}/.${key}.old`

    // Sobras de uma geração interrompida.
    for (const leftover of [temporary, previous]) {
      const removed = await this.storage.removeDirectory(leftover)
      if (!removed.ok) {
        return failed(
          leftover,
          `Não foi possível apagar a sobra de uma geração anterior: ${removed.error.message}`
        )
      }
    }

    for (const file of files) {
      const target = `${temporary}/${file.path}`
      const written =
        file.kind === 'text'
          ? await this.storage.writeText(target, file.content, { kind: 'overwrite' })
          : await this.storage.copy(file.path, target)
      if (!written.ok) {
        await this.storage.removeDirectory(temporary)
        return failed(file.path, `Não foi possível gravar ${target}: ${written.error.message}`)
      }
    }

    const hadPrevious = (await this.storage.stat(folder)).ok
    if (hadPrevious) {
      // O Windows não deixa renomear uma pasta com um arquivo aberto em outro programa.
      const moved = await this.storage.rename(folder, previous)
      if (!moved.ok) {
        await this.storage.removeDirectory(temporary)
        return failed(
          `${folder}/`,
          `Não foi possível substituir ${folder}/: feche os arquivos dessa pasta e gere de novo.`
        )
      }
    }

    const placed = await this.storage.rename(temporary, folder)
    if (!placed.ok) {
      const restored = hadPrevious ? (await this.storage.rename(previous, folder)).ok : true
      await this.storage.removeDirectory(temporary)
      return {
        ...failed(
          `${folder}/`,
          `Não foi possível colocar o produto em ${folder}/: ${placed.error.message}`
        ),
        ...(restored ? {} : { previousAt: `${previous}/` })
      }
    }

    // O produto novo já está no lugar: se a .old não sair agora, sai na próxima geração.
    if (hadPrevious) await this.storage.removeDirectory(previous)
    return { kind: 'written' }
  }
}

function failed(file: string, message: string): WriteProductResult & { kind: 'failed' } {
  return { kind: 'failed', problems: [fileError(file, message)] }
}
```

- [ ] **Passo 10: Criar `src/renderer/src/application/use-cases/generate-product.ts`**

```ts
import type { Configuration } from '@/domain/configuration/configuration'
import type { Resolution } from '@/domain/configuration/resolution'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { planGeneration } from '@/domain/generation/generation-plan'
import type { Project } from '@/domain/project/project'
import { fileError, type FileProblem } from '../file-problem'
import type { Clock } from '../ports/clock'
import type { ProductDeriver } from '../ports/product-deriver'
import type { WriteProductFolder } from './write-product-folder'

export type GenerateProductResult =
  | { readonly kind: 'generated'; readonly folder: string; readonly generatedAt: Date }
  /** As fontes têm problemas: nada foi gravado. */
  | { readonly kind: 'problems'; readonly problems: readonly FileProblem[] }
  /** A pasta do produto já existe: gerar de novo com `replace` depois de o usuário confirmar. */
  | { readonly kind: 'needs-confirmation'; readonly folder: string }
  /** A gravação ou a troca falhou; `previousAt` diz onde ficou a versão anterior, se saiu do lugar. */
  | {
      readonly kind: 'write-failed'
      readonly problems: readonly FileProblem[]
      readonly previousAt?: string
    }

export interface GenerateOptions {
  /** Substitui a pasta do produto que já existe ("Substituir"). */
  readonly replace: boolean
}

export interface GenerateProductDependencies {
  readonly resolveConfiguration: {
    execute(model: FeatureModel, configuration: Configuration): Resolution
  }
  readonly deriver: ProductDeriver
  readonly writer: WriteProductFolder
  readonly clock: Clock
}

/**
 * Gera o produto de uma configuração (SPEC §4.4) a partir do projeto como está na tela, com
 * as alterações não salvas: planeja, deriva (conferindo as fontes), pergunta antes de
 * substituir e grava com a troca. A derivação vem antes da pergunta, para o usuário nunca
 * confirmar uma substituição que depois falharia.
 */
export class GenerateProduct {
  private readonly deps: GenerateProductDependencies

  constructor(deps: GenerateProductDependencies) {
    this.deps = deps
  }

  async execute(
    project: Project,
    key: string,
    options: GenerateOptions = { replace: false }
  ): Promise<GenerateProductResult> {
    const file = `configurations/${key}.xml`
    const entry = project.configurations.find((candidate) => candidate.key === key)
    if (entry === undefined) {
      return { kind: 'problems', problems: [fileError(file, 'A configuração não existe mais.')] }
    }
    const { model, assets } = project
    const resolution = this.deps.resolveConfiguration.execute(model, entry.configuration)
    const plan = planGeneration(model, assets, entry.configuration, resolution)
    if (!plan.ok) return { kind: 'problems', problems: [fileError(file, plan.error)] }

    const generatedAt = this.deps.clock.now()
    const derived = await this.deps.deriver.derive(plan.value, generatedAt)
    if (!derived.ok) return { kind: 'problems', problems: derived.error }

    const folder = this.deps.writer.folderOf(key)
    if (!options.replace && (await this.deps.writer.exists(key))) {
      return { kind: 'needs-confirmation', folder }
    }
    const written = await this.deps.writer.write(key, derived.value)
    if (written.kind === 'failed') {
      return { kind: 'write-failed', problems: written.problems, previousAt: written.previousAt }
    }
    return { kind: 'generated', folder, generatedAt }
  }
}
```

- [ ] **Passo 11: Criar `src/renderer/src/infrastructure/system/system-clock.ts`**

```ts
import type { Clock } from '@/application/ports/clock'

export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}
```

- [ ] **Passo 12: Rodar a extração**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-source-check.mts
```

Esperado, exatamente:

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

- [ ] **Passo 13: Rodar a geração**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
```

Esperado, exatamente:

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
```

O que o roteiro mostra, em resumo:

- o `loja-basica` gerado é equivalente ao esperado, passa no `product.xsd`, tem os fragmentos intactos e o `.svg` idêntico;
- gerar de novo pede confirmação sem mexer na pasta; substituir limpa as sobras `.tmp` e `.old` e o que foi posto à mão;
- com `pag_boleto` e sem `boleto.xml`, o problema aparece, e nem a pasta `saida/` é criada;
- quatro problemas diferentes aparecem de uma vez, na ordem do plano, cada um com o arquivo, a linha e o asset;
- o fragmento sem namespace ganha `xmlns=""` e mantém os espaços e as quebras de linha dele;
- quando a troca falha, a pasta anterior volta; quando a volta também falha, a mensagem diz onde ela ficou;
- com um arquivo da pasta aberto em outro programa, a pasta anterior fica intacta.

- [ ] **Passo 14: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 15: Commit**

```bash
npm run format
git add src/renderer/src/application src/renderer/src/infrastructure
git commit -m "feat(generation): derivação XML do produto e escrita com pasta temporária e troca

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: O botão, a faixa e os diálogos

**Arquivos:**

- Criar: `src/renderer/src/application/ports/output-folder-opener.ts`, `src/renderer/src/infrastructure/electron/electron-output-folder-opener.ts`, `src/renderer/src/ui/stores/generation-actions.ts`
- Criar: `src/renderer/src/ui/screens/configurator/use-generate-product.ts`, `src/renderer/src/ui/screens/configurator/GenerationBanner.tsx`, `src/renderer/src/ui/screens/configurator/GenerationDialogs.tsx`
- Modificar: `src/renderer/src/ui/stores/project-store.ts`, `src/renderer/src/ui/screens/project/editor-dialog.ts`, `src/renderer/src/ui/screens/configurator/configuration-texts.ts`, `src/renderer/src/ui/screens/configurator/ConfiguratorWorkspace.tsx`, `src/renderer/src/ui/screens/project/ProjectScreen.tsx`, `src/renderer/src/ui/app/composition-root.ts`
- Verificação: `.checks/generation-store-check.mts`, `.checks/geracao-ui.mjs`; regressão com `.checks/ui-check.mjs`, `.checks/configurador-ui.mjs`, `.checks/assets-ui.mjs`, `.checks/configurator-store-check.mts` e `.checks/assets-store-check.mts`

**Interfaces:**

- Consome: `GenerateProduct`, `GenerateProductResult`, `GenerateOptions`, `WriteProductFolder`, `XmlProductDeriver`, `SystemClock` (Tarefa 3); `OUTPUT_DIRECTORY` e `window.mdd.openPath` (Tarefa 2); `configurationStatus`, `ConfigurationStatus` (`domain/configuration/resolution.ts`); `ProblemList`; `Dialog*` e `Button` (shadcn); `EditorDialog`; `openConfigurationEntry`, `ProjectState` e `createProjectStore` (`ui/stores/project-store.ts`).
- Produz:
  - `OutputFolderOpener.open(folder): Promise<Result<null, StorageError>>` e `ElectronOutputFolderOpener`
  - `GenerationServices` (`generateProduct`, `outputFolderOpener`), `LastGeneration` (`key`, `folder`, `generatedAt`), `GenerationState` (`generating`, `lastGeneration`, `generateProduct(options?)`, `openGeneratedFolder()`, `dismissLastGeneration()`), `GENERATION_CLOSED` e `createGenerationActions(set, get, services)` (`generation-actions.ts`)
  - `EditorDialog` com `{ kind: 'replace-output'; folder }` e `{ kind: 'generation-problems'; problems; note }`
  - `generationBlockedReason(resolution): string | null` (`configuration-texts.ts`)
  - `useGenerateProduct(onOpenDialog)`, `GenerationBanner({ configurationKey })` e `GenerationDialogs({ dialog, onOpenDialog, onClose })`

- [ ] **Passo 1: Escrever o roteiro `.checks/generation-store-check.mts`**

A store com a geração e o abridor de pasta falsos.

```ts
// Store da geração com portas falsas (plano da Fase 5, Tarefa 4).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
import { readFileSync } from 'node:fs'
import type { ProjectSession } from '@/application/project-session'
import type { GenerateProductResult } from '@/application/use-cases/generate-product'
import { err, ok } from '@/domain/shared/result'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { createProjectStore, hasUnsavedChanges } from '@/ui/stores/project-store'

const read = (path: string) =>
  parseXmlRoot(readFileSync(`docs/examples/loja-online/${path}`, 'utf8'))
const model = decodeFeatureModel(read('model.xml'))
const assets = decodeAssetCatalog(read('assets.xml'))
const basica = decodeConfiguration(read('configurations/loja-basica.xml'))
if (!model.ok || !assets.ok || !basica.ok) throw new Error('o exemplo não abriu')
const session = (): ProjectSession => ({
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: {
    model: model.value,
    assets: assets.value,
    configurations: [{ key: 'loja-basica', configuration: basica.value }]
  },
  hashes: { model: 'x', assets: 'y', configurations: { 'loja-basica': 'z' } }
})
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}

// A geração falsa: devolve o próximo resultado da fila; cada uma pode ser segurada.
const results: GenerateProductResult[] = []
const calls: string[] = []
let hold: Promise<void> | null = null
const opened: string[] = []
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session: session(), warnings: [] }),
    reopen: async () => ({ status: 'opened', session: session(), warnings: [] })
  },
  createProject: { execute: notUsed },
  saveProject: { execute: notUsed },
  resolveConfiguration: { execute: () => notUsed() as never },
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} },
  checkAssetFiles: { execute: async () => new Map() },
  filePicker: { pickFile: notUsed },
  assetOpener: { open: notUsed },
  generateProduct: {
    async execute(_project, key, options) {
      calls.push(`${key}${options?.replace ? ' (substituir)' : ''}`)
      if (hold !== null) await hold
      return results.shift()!
    }
  },
  outputFolderOpener: {
    async open(folder) {
      opened.push(folder)
      return folder.endsWith('sumiu') ? err({ code: 'not-found', message: 'não existe' }) : ok(null)
    }
  }
})
const state = () => store.getState()
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const last = () => {
  const generation = state().lastGeneration
  return generation === null ? '(nenhuma)' : `${generation.key} → ${generation.folder}`
}
const generated = (folder: string): GenerateProductResult => ({
  kind: 'generated',
  folder,
  generatedAt: new Date('2026-09-24T14:03:00Z')
})

await state().open()

// 1. Sem configuração aberta, nada acontece
log('1. sem configuração aberta', await state().generateProduct())
log('   chamadas', calls.length)

// 2. Gerar: "gerando" durante, a última geração depois, sem mudar o "•"
state().openConfiguration('loja-basica')
let release = (): void => {}
hold = new Promise((resolve) => (release = resolve))
results.push(generated('saida/loja-basica'))
const pending = state().generateProduct()
log('2. durante: gerando', state().generating)
log('   segundo clique', await state().generateProduct())
hold = null
release()
log('   resultado', (await pending)?.kind)
log('   depois: gerando', state().generating)
log('   última geração', last())
log('   alterações não salvas', hasUnsavedChanges(state()))
log('   chamadas', calls.join(', '))

// 3. Pede confirmação e substitui
results.push({ kind: 'needs-confirmation', folder: 'saida/loja-basica' })
log('3. de novo', (await state().generateProduct())?.kind)
results.push(generated('saida/loja-basica'))
log('   substituir', (await state().generateProduct({ replace: true }))?.kind)
log('   chamadas', calls.slice(-2).join(', '))

// 4. Problemas: a última geração continua a de antes
results.push({ kind: 'problems', problems: [] })
log('4. problemas', (await state().generateProduct())?.kind)
log('   última geração', last())

// 5. Abrir a pasta; a falha vira aviso
await state().openGeneratedFolder()
log('5. abriu', opened.join(', '))
store.setState({
  lastGeneration: { key: 'loja-basica', folder: 'saida/sumiu', generatedAt: new Date() }
})
await state().openGeneratedFolder()
log('   aviso', state().notice)

// 6. Dispensar a faixa
state().dismissLastGeneration()
log('6. depois do ×', last())

// 7. Recarregar o projeto no meio da geração: o resultado é descartado
results.push(generated('saida/loja-basica'))
hold = new Promise((resolve) => (release = resolve))
const during = state().generateProduct()
await state().reload()
hold = null
release()
log('7. recarregado no meio', await during)
log('   gerando', state().generating)
log('   última geração', last())

// 8. Fechar o projeto zera a última geração
state().openConfiguration('loja-basica')
results.push(generated('saida/loja-basica'))
await state().generateProduct()
state().close()
log('8. depois de fechar', last())
```

- [ ] **Passo 2: Escrever o roteiro `.checks/geracao-ui.mjs`**

```js
// Roteiro da geração com entrada real (plano da Fase 5, Tarefa 4).
// Uso: bash .checks/run-ui.sh <app.exe | dev> .checks/geracao-ui.mjs 9229
// O app precisa estar aberto com --remote-debugging-port e --inspect. Nenhum programa abre:
// o shell.openPath do main é trocado por um registrador.
import { existsSync, readFileSync, renameSync } from 'node:fs'
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
const { click, fill, text, title, js, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))
const node = (id) => `[data-feature-id="${id}"]`
const generateButton = () =>
  js(`(() => {
    const button = [...document.querySelectorAll('main section button')].find((b) => /Gerar produto|Gerando/.test(b.innerText))
    if (!button) return '(sem botão)'
    return (button.disabled ? 'desligado' : 'ligado') + (button.parentElement.title ? ' | dica: ' + button.parentElement.title : '')
  })()`)
const banner = () =>
  js(
    `document.querySelector('[data-banner=generated]')?.innerText.replace(/\\s+/g, ' ').replace(/\\d{2}:\\d{2}/, 'HH:MM').trim() ?? '(sem faixa)'`
  )
const dialog = () =>
  js(
    `document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '(sem diálogo)'`
  )
const generatedAt = () => {
  const path = file('saida/loja-basica/product.xml')
  return existsSync(path)
    ? /generatedAt="([^"]+)"/.exec(readFileSync(path, 'utf8'))?.[1]
    : '(não existe)'
}
const outputFiles = () =>
  ['saida/loja-basica/product.xml', 'saida/loja-basica/docs/img/pix-fluxo.svg']
    .map((path) => `${path.split('/').pop()} ${existsSync(file(path)) ? 'sim' : 'não'}`)
    .join(', ')
const generate = async () => {
  await click({ text: 'Gerar produto' })
  await waitFor(
    `![...document.querySelectorAll('main section button')].some((b) => b.innerText.includes('Gerando'))`
  )
  await sleep(300)
}

// 1. loja-basica aberta: o botão ligado
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Configurações' })
await click('[data-configuration-key="loja-basica"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await sleep(500)
log('1. botão', await generateButton())
log('   saida/ existe?', existsSync(file('saida')))

// 2. incompleta: desligado, com o motivo; completa de novo: ligado
await click(node('pag_pix'))
log('2. pag_pix desselecionada', await generateButton())
await click(node('pag_pix'))
await click(node('pag_pix'))
log('   pag_pix de volta', await generateButton())

// 3. gerar: a faixa verde, os arquivos, e o "•" não muda
const titleBefore = await title()
await generate()
log('3. faixa', await banner())
log('   arquivos', outputFiles())
log('   título igual ao de antes', (await title()) === titleBefore)
const firstGeneratedAt = generatedAt()

// 4. Abrir pasta: o main recebe a pasta gerada
await click({ text: 'Abrir pasta' })
await sleep(300)
log('4. abriu', (await main.opened()).replace(projectDir, '<projeto>'))

// 5. outra configuração: a faixa some, e volta com loja-basica
await click({ text: 'Nova' })
await fill('#configuration-name', 'Outra')
await click({ tag: '[role=dialog] button', text: 'Criar' })
await waitFor(`document.querySelector('[role=dialog]') === null`)
await sleep(500)
log('5. em "Outra": faixa', await banner())
log('   botão', await generateButton())
await click('[data-configuration-key="loja-basica"]')
await sleep(500)
log('   de volta: faixa', await banner())

// 6. gerar de novo: pergunta antes de substituir
await sleep(1100) // para o generatedAt mudar de segundo
await generate()
log('6. diálogo', await dialog())
await click({ tag: '[role=dialog] button', text: 'Cancelar' })
await sleep(300)
log('   Cancelar: generatedAt igual', generatedAt() === firstGeneratedAt)
await generate()
await click({ tag: '[role=dialog] button', text: 'Substituir' })
await waitFor(`document.querySelector('[role=dialog]') === null`)
await waitFor(
  `![...document.querySelectorAll('main section button')].some((b) => b.innerText.includes('Gerando'))`
)
await sleep(300)
log('   Substituir: generatedAt mudou', generatedAt() !== firstGeneratedAt)
log('   faixa', await banner())

// 7. um fragmento ausente: o diálogo de problemas, e nada muda no disco
const secondGeneratedAt = generatedAt()
renameSync(file('docs/pagamento/pix.xml'), file('docs/pagamento/pix-renomeado.xml'))
await generate()
log('7. diálogo', await dialog())
await click({ tag: '[role=dialog] button', text: 'Fechar' })
await sleep(300)
log('   generatedAt igual', generatedAt() === secondGeneratedAt)
renameSync(file('docs/pagamento/pix-renomeado.xml'), file('docs/pagamento/pix.xml'))

// 8. o × fecha a faixa
await click('[data-banner=generated] button[title="Dispensar"]')
log('8. depois do ×', await banner())

log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
main.close()
```

- [ ] **Passo 3: Rodar a store e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
```

Esperado: `TypeError: state(...).generateProduct is not a function`.

- [ ] **Passo 4: A porta `OutputFolderOpener` e o adapter**

Crie `src/renderer/src/application/ports/output-folder-opener.ts`:

```ts
import type { Result } from '@/domain/shared/result'
import type { StorageError } from './project-storage'

/** Abre uma pasta gerada (`saida/<chave>`) no gerenciador de arquivos do sistema. */
export interface OutputFolderOpener {
  open(folder: string): Promise<Result<null, StorageError>>
}
```

Crie `src/renderer/src/infrastructure/electron/electron-output-folder-opener.ts`:

```ts
import type { OutputFolderOpener } from '@/application/ports/output-folder-opener'
import type { StorageError } from '@/application/ports/project-storage'
import type { Result } from '@/domain/shared/result'

/** `shell.openPath` no processo main, que só abre pastas dentro de `saida/`. */
export class ElectronOutputFolderOpener implements OutputFolderOpener {
  open(folder: string): Promise<Result<null, StorageError>> {
    return window.mdd.openPath(folder)
  }
}
```

- [ ] **Passo 5: Criar `src/renderer/src/ui/stores/generation-actions.ts`**

```ts
import type { StoreApi } from 'zustand/vanilla'
import type { OutputFolderOpener } from '@/application/ports/output-folder-opener'
import type {
  GenerateOptions,
  GenerateProductResult
} from '@/application/use-cases/generate-product'
import type { Project } from '@/domain/project/project'
import type { ProjectState } from './project-store'

/** Os serviços da geração; a composition root entrega as implementações. */
export interface GenerationServices {
  readonly generateProduct: {
    execute(
      project: Project,
      key: string,
      options?: GenerateOptions
    ): Promise<GenerateProductResult>
  }
  readonly outputFolderOpener: OutputFolderOpener
}

/** A última geração que deu certo, mostrada na faixa verde do configurador. */
export interface LastGeneration {
  /** A chave da configuração gerada: a faixa só aparece com ela aberta. */
  readonly key: string
  /** A pasta do produto, como `saida/loja-basica`. */
  readonly folder: string
  readonly generatedAt: Date
}

/**
 * Estado e ações do botão "Gerar produto" (SPEC §4.4 e §7). Gerar não é uma edição: não
 * passa pelo histórico nem mexe no "•" de não salvo.
 */
export interface GenerationState {
  /** Há uma geração em andamento: o botão fica desligado. */
  readonly generating: boolean
  readonly lastGeneration: LastGeneration | null

  /**
   * Gera o produto da configuração aberta, do projeto como está na tela. Devolve o resultado
   * para a tela decidir o que mostrar, ou `null` quando não há o que mostrar (nenhuma
   * configuração aberta, outra geração em andamento, ou o projeto foi fechado no meio).
   */
  generateProduct(options?: GenerateOptions): Promise<GenerateProductResult | null>
  openGeneratedFolder(): Promise<void>
  dismissLastGeneration(): void
}

export const GENERATION_CLOSED = {
  generating: false,
  lastGeneration: null
} satisfies Partial<GenerationState>

type SetState = StoreApi<ProjectState>['setState']

export function createGenerationActions(
  set: SetState,
  get: () => ProjectState,
  services: GenerationServices
): Omit<GenerationState, keyof typeof GENERATION_CLOSED> {
  return {
    async generateProduct(options) {
      const { session, openConfigurationKey: key, generating } = get()
      if (session === null || key === null || generating) return null
      set({ generating: true })
      const result = await services.generateProduct.execute(session.project, key, options)
      // Fechar ou reabrir o projeto já zerou o estado da geração.
      if (get().session?.folder !== session.folder) return null
      set({
        generating: false,
        ...(result.kind === 'generated'
          ? { lastGeneration: { key, folder: result.folder, generatedAt: result.generatedAt } }
          : {})
      })
      return result
    },

    async openGeneratedFolder() {
      const last = get().lastGeneration
      if (last === null) return
      const opened = await services.outputFolderOpener.open(last.folder)
      if (!opened.ok) {
        set({ notice: `Não foi possível abrir ${last.folder}/: ${opened.error.message}` })
      }
    },

    dismissLastGeneration() {
      set({ lastGeneration: null })
    }
  }
}
```

- [ ] **Passo 6: Montar as ações em `src/renderer/src/ui/stores/project-store.ts`**

Troque:

<!-- prettier-ignore -->
```ts
  type AssetsState
} from './assets-actions'

/** Casos de uso e serviços de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices extends AssetsServices {
  readonly openProject: {
    execute(): Promise<OpenProjectResult>
```

por:

<!-- prettier-ignore -->
```ts
  type AssetsState
} from './assets-actions'
import {
  createGenerationActions,
  GENERATION_CLOSED,
  type GenerationServices,
  type GenerationState
} from './generation-actions'

/** Casos de uso e serviços de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices extends AssetsServices, GenerationServices {
  readonly openProject: {
    execute(): Promise<OpenProjectResult>
```

Troque:

<!-- prettier-ignore -->
```ts
}

export interface ProjectState extends AssetsState {
  readonly session: ProjectSession | null
  /** O projeto como está no disco; comparar com a sessão diz se há alterações. */
```

por:

<!-- prettier-ignore -->
```ts
}

export interface ProjectState extends AssetsState, GenerationState {
  readonly session: ProjectSession | null
  /** O projeto como está no disco; comparar com a sessão diz se há alterações. */
```

Troque:

<!-- prettier-ignore -->
```ts
  notice: null,
  lastSavedAt: null,
  ...ASSETS_CLOSED
} satisfies Partial<ProjectState>
```

por:

<!-- prettier-ignore -->
```ts
  notice: null,
  lastSavedAt: null,
  ...ASSETS_CLOSED,
  ...GENERATION_CLOSED
} satisfies Partial<ProjectState>
```

Troque:

<!-- prettier-ignore -->
```ts
      recents: [],
      ...createAssetsActions(set, get, services),

      async loadRecents() {
```

por:

<!-- prettier-ignore -->
```ts
      recents: [],
      ...createAssetsActions(set, get, services),
      ...createGenerationActions(set, get, services),

      async loadRecents() {
```

- [ ] **Passo 7: Os diálogos novos em `src/renderer/src/ui/screens/project/editor-dialog.ts`**

Troque:

<!-- prettier-ignore -->
```ts
/** Qual diálogo da tela do projeto está aberto (no máximo um por vez). */
export type EditorDialog =
```

por:

<!-- prettier-ignore -->
```ts
import type { FileProblem } from '@/application/file-problem'

/** Qual diálogo da tela do projeto está aberto (no máximo um por vez). */
export type EditorDialog =
```

Troque:

<!-- prettier-ignore -->
```ts
  /** Depois do diálogo nativo: o arquivo já escolhido, dentro do projeto. */
  | { readonly kind: 'link-asset'; readonly path: string; readonly anchor: string }
  | null
```

por:

<!-- prettier-ignore -->
```ts
  /** Depois do diálogo nativo: o arquivo já escolhido, dentro do projeto. */
  | { readonly kind: 'link-asset'; readonly path: string; readonly anchor: string }
  /** A pasta do produto já existe: substituir? */
  | { readonly kind: 'replace-output'; readonly folder: string }
  /** A geração falhou; `note` diz o que aconteceu com o disco. */
  | {
      readonly kind: 'generation-problems'
      readonly problems: readonly FileProblem[]
      readonly note: string
    }
  | null
```

- [ ] **Passo 8: O motivo do botão desligado em `src/renderer/src/ui/screens/configurator/configuration-texts.ts`**

A parte "2 indecisas, 1 atributo sem valor" passa a ser compartilhada com a barra de status.

Troque:

<!-- prettier-ignore -->
```ts
import type { DecisionState } from '@/domain/configuration/configuration'
import type { OrphanReference } from '@/domain/configuration/references'
import { configurationStatus, type Resolution } from '@/domain/configuration/resolution'

/** Textos do configurador que mais de um componente usa. */
```

por:

<!-- prettier-ignore -->
```ts
import type { DecisionState } from '@/domain/configuration/configuration'
import type { OrphanReference } from '@/domain/configuration/references'
import {
  configurationStatus,
  type ConfigurationStatus,
  type Resolution
} from '@/domain/configuration/resolution'

/** Textos do configurador que mais de um componente usa. */
```

Troque:

<!-- prettier-ignore -->
```ts
  else if (resolution.kind === 'conflict') parts.push('Em conflito')
  else if (status.complete) parts.push('Válida', 'completa')
  else {
    const missing = [
      plural(status.undecidedCount, 'indecisa', 'indecisas'),
      plural(status.missingValueCount, 'atributo sem valor', 'atributos sem valor')
    ].filter((part) => part !== null)
    parts.push('Válida', `incompleta (${missing.join(', ')})`)
  }
  if (status.stale) parts.push('desatualizada')
  return parts.join(' · ')
}
```

por:

<!-- prettier-ignore -->
```ts
  else if (resolution.kind === 'conflict') parts.push('Em conflito')
  else if (status.complete) parts.push('Válida', 'completa')
  else parts.push('Válida', `incompleta (${missingText(status)})`)
  if (status.stale) parts.push('desatualizada')
  return parts.join(' · ')
}

/** Por que o botão "Gerar produto" está desligado, ou `null` quando dá para gerar (SPEC §4.2). */
export function generationBlockedReason(resolution: Resolution): string | null {
  const status = configurationStatus(resolution)
  if (resolution.kind === 'empty-model') return 'O modelo não admite nenhum produto.'
  if (resolution.kind === 'conflict') return 'Resolva o conflito entre as decisões para gerar.'
  if (status.complete) return null
  return `Complete a configuração para gerar: ${missingText(status)}.`
}

/** "2 indecisas, 1 atributo sem valor". */
function missingText(status: ConfigurationStatus): string {
  return [
    plural(status.undecidedCount, 'indecisa', 'indecisas'),
    plural(status.missingValueCount, 'atributo sem valor', 'atributos sem valor')
  ]
    .filter((part) => part !== null)
    .join(', ')
}
```

- [ ] **Passo 9: Criar `src/renderer/src/ui/screens/configurator/use-generate-product.ts`**

```ts
import { useCallback } from 'react'
import type { GenerateOptions } from '@/application/use-cases/generate-product'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'

/**
 * Gera o produto da configuração aberta e abre o diálogo que o resultado pede: substituir a
 * pasta que já existe, ou os problemas. O sucesso aparece na faixa verde, sem diálogo.
 */
export function useGenerateProduct(
  onOpenDialog: (dialog: EditorDialog) => void
): (options?: GenerateOptions) => Promise<void> {
  const generate = useProjectStore((state) => state.generateProduct)
  return useCallback(
    async (options) => {
      const result = await generate(options)
      switch (result?.kind) {
        case 'needs-confirmation':
          onOpenDialog({ kind: 'replace-output', folder: result.folder })
          break
        case 'problems':
          onOpenDialog({
            kind: 'generation-problems',
            problems: result.problems,
            note: 'Nada foi gravado.'
          })
          break
        case 'write-failed':
          onOpenDialog({
            kind: 'generation-problems',
            problems: result.problems,
            note:
              result.previousAt === undefined
                ? 'Nenhuma pasta foi substituída.'
                : `A versão anterior ficou em ${result.previousAt}.`
          })
          break
      }
    },
    [generate, onOpenDialog]
  )
}
```

- [ ] **Passo 10: A faixa e os diálogos**

Crie `src/renderer/src/ui/screens/configurator/GenerationBanner.tsx`:

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
  const time = last.generatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <section
      data-banner="generated"
      className="flex items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50"
    >
      <CircleCheck className="size-4 shrink-0" />
      <span className="flex-1">
        Produto gerado em <code>{last.folder}/</code> às {time}
      </span>
      <Button size="sm" variant="outline" onClick={() => void openFolder()}>
        <FolderOpen /> Abrir pasta
      </Button>
      <Button size="icon-sm" variant="ghost" title="Dispensar" onClick={dismiss}>
        <X />
      </Button>
    </section>
  )
}
```

Crie `src/renderer/src/ui/screens/configurator/GenerationDialogs.tsx`:

```tsx
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { ProblemList } from '@/ui/components/ProblemList'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useGenerateProduct } from './use-generate-product'

interface GenerationDialogsProps {
  readonly dialog: EditorDialog
  readonly onOpenDialog: (dialog: EditorDialog) => void
  readonly onClose: () => void
}

/** Os diálogos da geração (SPEC §7): substituir a pasta que já existe e os problemas. */
export function GenerationDialogs({
  dialog,
  onOpenDialog,
  onClose
}: GenerationDialogsProps): React.JSX.Element | null {
  const generate = useGenerateProduct(onOpenDialog)

  switch (dialog?.kind) {
    case 'replace-output':
      return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Substituir {dialog.folder}/?</DialogTitle>
              <DialogDescription>
                A pasta já existe e será trocada pelo produto novo. O que você tiver colocado nela à
                mão será perdido.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onClose()
                  void generate({ replace: true })
                }}
              >
                Substituir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )
    case 'generation-problems':
      return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Não foi possível gerar</DialogTitle>
              <DialogDescription>{dialog.note}</DialogDescription>
            </DialogHeader>
            <div className="max-h-80 overflow-auto">
              <ProblemList title="Problemas" tone="error" problems={dialog.problems} />
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )
    default:
      return null
  }
}
```

- [ ] **Passo 11: O botão e a faixa em `src/renderer/src/ui/screens/configurator/ConfiguratorWorkspace.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
import { Copy, Pencil, Trash2 } from 'lucide-react'
import type { ConfigurationEntry, Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { FeatureDiagram, type DiagramMode } from '@/ui/diagram/FeatureDiagram'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
```

por:

<!-- prettier-ignore -->
```tsx
import { Copy, FileOutput, Pencil, Trash2 } from 'lucide-react'
import type { ConfigurationEntry, Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { FeatureDiagram, type DiagramMode } from '@/ui/diagram/FeatureDiagram'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
```

Troque:

<!-- prettier-ignore -->
```tsx
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AttributeValuesPanel } from './AttributeValuesPanel'
import { ConfigurationList } from './ConfigurationList'
import { ConfigurationProblems } from './ConfigurationProblems'

const CONFIGURE: DiagramMode = { kind: 'configure' }

interface ConfiguratorWorkspaceProps {
```

por:

<!-- prettier-ignore -->
```tsx
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AttributeValuesPanel } from './AttributeValuesPanel'
import { ConfigurationList } from './ConfigurationList'
import { ConfigurationProblems } from './ConfigurationProblems'
import { generationBlockedReason } from './configuration-texts'
import { GenerationBanner } from './GenerationBanner'
import { useGenerateProduct } from './use-generate-product'

const CONFIGURE: DiagramMode = { kind: 'configure' }

interface ConfiguratorWorkspaceProps {
```

Troque:

<!-- prettier-ignore -->
```tsx
          </p>
        ) : (
          <>
            <ConfigurationToolbar entry={entry} onOpenDialog={onOpenDialog} />
            <ConfigurationProblems model={project.model} />
            <div className="min-h-0 flex-1 rounded-md border">
              <FeatureDiagram model={project.model} mode={CONFIGURE} />
            </div>
```

por:

<!-- prettier-ignore -->
```tsx
          </p>
        ) : (
          <>
            <ConfigurationToolbar entry={entry} onOpenDialog={onOpenDialog} />
            <GenerationBanner configurationKey={entry.key} />
            <ConfigurationProblems model={project.model} />
            <div className="min-h-0 flex-1 rounded-md border">
              <FeatureDiagram model={project.model} mode={CONFIGURE} />
            </div>
```

Troque:

<!-- prettier-ignore -->
```tsx
          onClick={() => onOpenDialog({ kind: 'delete-configuration', key })}
        >
          <Trash2 /> Excluir…
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Clique numa feature para alternar entre indecisa, selecionada e desselecionada. O cadeado
        marca o que o modelo decide.
      </p>
    </div>
  )
}
```

por:

<!-- prettier-ignore -->
```tsx
          onClick={() => onOpenDialog({ kind: 'delete-configuration', key })}
        >
          <Trash2 /> Excluir…
        </Button>
        <GenerateButton onOpenDialog={onOpenDialog} />
      </div>
      <p className="text-xs text-muted-foreground">
        Clique numa feature para alternar entre indecisa, selecionada e desselecionada. O cadeado
        marca o que o modelo decide.
      </p>
    </div>
  )
}

/** "Gerar produto" (SPEC §7): só com a configuração completa; a dica diz o que falta. */
function GenerateButton({
  onOpenDialog
}: {
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
        onClick={() => void generate()}
      >
        <FileOutput /> {generating ? 'Gerando…' : 'Gerar produto'}
      </Button>
    </span>
  )
}
```

- [ ] **Passo 12: Os diálogos em `src/renderer/src/ui/screens/project/ProjectScreen.tsx`**

Troque:

<!-- prettier-ignore -->
```tsx
import { LinkAssetDialog } from '@/ui/screens/assets/LinkAssetDialog'
import { ConfiguratorWorkspace } from '@/ui/screens/configurator/ConfiguratorWorkspace'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
```

por:

<!-- prettier-ignore -->
```tsx
import { LinkAssetDialog } from '@/ui/screens/assets/LinkAssetDialog'
import { ConfiguratorWorkspace } from '@/ui/screens/configurator/ConfiguratorWorkspace'
import { GenerationDialogs } from '@/ui/screens/configurator/GenerationDialogs'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
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
      <GenerationDialogs
        dialog={dialog}
        onOpenDialog={openDialog}
        onClose={() => setDialog(null)}
      />
      <ConflictDialog />
    </main>
```

- [ ] **Passo 13: Injetar os serviços em `src/renderer/src/ui/app/composition-root.ts`**

Troque:

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
```

por:

<!-- prettier-ignore -->
```ts
import { CheckAssetFiles } from '@/application/use-cases/check-asset-files'
import { CreateProject } from '@/application/use-cases/create-project'
import { GenerateProduct } from '@/application/use-cases/generate-product'
import { OpenProject } from '@/application/use-cases/open-project'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { SaveProject } from '@/application/use-cases/save-project'
import { WriteProductFolder } from '@/application/use-cases/write-product-folder'
import { ElectronAssetOpener } from '@/infrastructure/electron/electron-asset-opener'
import { ElectronOutputFolderOpener } from '@/infrastructure/electron/electron-output-folder-opener'
import { ElectronProjectFilePicker } from '@/infrastructure/electron/electron-project-file-picker'
import { ElectronProjectFolderPicker } from '@/infrastructure/electron/electron-project-folder-picker'
```

Troque:

<!-- prettier-ignore -->
```ts
import { ElectronXmlSchemaValidator } from '@/infrastructure/electron/electron-xml-schema-validator'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import {
  XmlAssetCatalogRepository,
```

por:

<!-- prettier-ignore -->
```ts
import { ElectronXmlSchemaValidator } from '@/infrastructure/electron/electron-xml-schema-validator'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { SystemClock } from '@/infrastructure/system/system-clock'
import {
  XmlAssetCatalogRepository,
```

Troque:

<!-- prettier-ignore -->
```ts
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'
import { createProjectStore, type ProjectStore } from '@/ui/stores/project-store'

/**
```

por:

<!-- prettier-ignore -->
```ts
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import { createProjectStore, type ProjectStore } from '@/ui/stores/project-store'
import { OUTPUT_DIRECTORY } from '../../../../shared/ipc'

/**
```

Troque:

<!-- prettier-ignore -->
```ts
    configurations: new XmlConfigurationRepository(storage, validator)
  }
  return createProjectStore({
    openProject: new OpenProject({ picker, recents, ...repositories }),
    createProject: new CreateProject({ picker, models }),
    saveProject: new SaveProject(repositories),
    resolveConfiguration: new ResolveConfiguration(new LogicSolverConstraintSolver()),
    recentProjects: recents,
    unsavedChanges: new ElectronUnsavedChangesIndicator(),
    checkAssetFiles: new CheckAssetFiles(storage),
    filePicker: new ElectronProjectFilePicker(),
    assetOpener: new ElectronAssetOpener()
  })
}
```

por:

<!-- prettier-ignore -->
```ts
    configurations: new XmlConfigurationRepository(storage, validator)
  }
  // Uma só resolução para a tela e a geração: o resultado guardado serve às duas.
  const resolveConfiguration = new ResolveConfiguration(new LogicSolverConstraintSolver())
  return createProjectStore({
    openProject: new OpenProject({ picker, recents, ...repositories }),
    createProject: new CreateProject({ picker, models }),
    saveProject: new SaveProject(repositories),
    resolveConfiguration,
    recentProjects: recents,
    unsavedChanges: new ElectronUnsavedChangesIndicator(),
    checkAssetFiles: new CheckAssetFiles(storage),
    filePicker: new ElectronProjectFilePicker(),
    assetOpener: new ElectronAssetOpener(),
    generateProduct: new GenerateProduct({
      resolveConfiguration,
      deriver: new XmlProductDeriver(storage, validator),
      writer: new WriteProductFolder(storage, OUTPUT_DIRECTORY),
      clock: new SystemClock()
    }),
    outputFolderOpener: new ElectronOutputFolderOpener()
  })
}
```

- [ ] **Passo 14: Rodar a store**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
```

Esperado, exatamente:

```
1. sem configuração aberta           → null
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
```

- [ ] **Passo 15: Checagens e build**

```bash
npm run typecheck
npm run lint
npm run build
```

Esperado: sem erros. O build avisa três vezes "Use of eval … is strongly discouraged" (`logic-solver`, esperado desde a Fase 3).

- [ ] **Passo 16: Rodar o roteiro da geração**

Combine o momento com o usuário: o app abre e fecha na tela dele.

```bash
bash .checks/run-ui.sh dev .checks/geracao-ui.mjs 9229
```

Esperado, exatamente:

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

A hora da faixa aparece como `HH:MM`. O "Fechar" repetido nos diálogos é o × do próprio diálogo, com o rótulo para leitor de tela.

- [ ] **Passo 17: Regressão das Fases 2A, 3 e 4**

```bash
bash .checks/run-ui.sh dev .checks/ui-check.mjs
bash .checks/run-ui.sh dev .checks/configurador-ui.mjs
bash .checks/run-ui.sh dev .checks/assets-ui.mjs 9229
npx tsx --tsconfig tsconfig.web.json .checks/configurator-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/assets-store-check.mts
```

Esperado do `ui-check.mjs`, exatamente (a saída do plano da 2B, Tarefa 4, Passo 6, mais `app fechado`):

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

Do `configurador-ui.mjs`, exatamente (a saída do plano da Fase 3, Tarefa 4, Passo 15, com a dica do desfazer da Fase 4):

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

Do `assets-ui.mjs`, exatamente a saída do plano da Fase 4 (Tarefa 4, Passo 22):

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

O `configurator-store-check.mts` e o `assets-store-check.mts` dão as mesmas saídas dos planos das Fases 3 e 4. O `diagrama-ui.mjs` (2B) não precisa rodar: esta fase não mexe no diagrama nem na aba Modelo.

- [ ] **Passo 18: Commit**

```bash
npm run format
git add src/renderer/src
git commit -m "feat(ui): botão Gerar produto, faixa da última geração e diálogos de substituir e de problemas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: Aceitação no app empacotado e documentação

**Arquivos:**

- Modificar: `docs/SPEC.md`, `docs/adr/0006-geracao-agnostica-de-vocabulario.md`, `docs/superpowers/specs/2026-09-24-fase-5-geracao-design.md`, `docs/HANDOFF.md`
- Verificação: `.checks/aceitacao-5.mjs`

**Interfaces:**

- Consome: tudo das Tarefas 1–4.
- Produz: o instalador, o registro da aceitação e a SPEC atualizada com as decisões da fase.

- [ ] **Passo 1: Gerar o instalador**

```bash
npm run build:win
```

Esperado: `building target=nsis file=dist\mdd-0.1.0-setup.exe` sem erro.

- [ ] **Passo 2: Escrever `.checks/aceitacao-5.mjs`**

Os dois critérios da SPEC §9, pela interface.

```js
// Aceitação da Fase 5 (SPEC §9) pela interface, no app empacotado (plano da Fase 5, Tarefa 5).
// Uso: bash .checks/run-ui.sh <app.exe | dev> .checks/aceitacao-5.mjs
// Parte 1: com pag_boleto selecionado e boleto.xml ausente, a geração falha e não grava nada.
// Parte 2: gerar loja-basica produz o equivalente a produto-esperado/loja-basica/, mais o .svg.
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { DOMParser } from '@xmldom/xmldom'
import { connect, log, sleep } from './cdp.mjs'

const [port, projectDir] = process.argv.slice(2)
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
const { click, text, js, waitFor } = ui
const file = (path) => join(projectDir, ...path.split('/'))
const node = (id) => `[data-feature-id="${id}"]`
const status = (id) => js(`document.querySelector('${node(id)}').dataset.status`)
const dialog = () =>
  js(
    `document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g, ' ').trim() ?? '(sem diálogo)'`
  )
const generate = async () => {
  await click({ text: 'Gerar produto' })
  await sleep(300)
  await waitFor(
    `![...document.querySelectorAll('main section button')].some((b) => b.innerText.includes('Gerando'))`
  )
  await sleep(300)
}

/** Comparação que ignora comentários, espaços, declarações de namespace e o generatedAt. */
function canonical(content) {
  const lines = []
  const walk = (node, depth) => {
    if (node.nodeType === 1) {
      const attributes = Array.from(node.attributes)
        .filter(
          (a) => a.name !== 'xmlns' && !a.name.startsWith('xmlns:') && a.name !== 'generatedAt'
        )
        .map((a) => `${a.namespaceURI ? `{${a.namespaceURI}}` : ''}${a.localName}=${a.value}`)
        .sort()
      lines.push(
        `${'  '.repeat(depth)}{${node.namespaceURI ?? ''}}${node.localName} ${attributes.join(' ')}`
      )
      for (const child of Array.from(node.childNodes)) walk(child, depth + 1)
    } else if (node.nodeType === 3 || node.nodeType === 4) {
      const value = node.nodeValue.replace(/\s+/g, ' ').trim()
      if (value !== '') lines.push(`${'  '.repeat(depth)}"${value}"`)
    }
  }
  walk(new DOMParser().parseFromString(content, 'text/xml').documentElement, 0)
  return lines.join('\n')
}

await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Configurações' })
await click('[data-configuration-key="loja-basica"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await sleep(500)

// Parte 1
renameSync(file('docs/pagamento/boleto.xml'), file('docs/pagamento/boleto-renomeado.xml'))
await click(node('pag_boleto'))
await click(node('pag_boleto'))
log('1. pag_boleto', await status('pag_boleto'))
log('   barra de status', await text('footer'))
await generate()
log('   diálogo', await dialog())
log('   saida/ existe?', existsSync(file('saida')))
await click({ tag: '[role=dialog] button', text: 'Fechar' })
await click(node('pag_boleto'))
log('   pag_boleto de volta', await status('pag_boleto'))
renameSync(file('docs/pagamento/boleto-renomeado.xml'), file('docs/pagamento/boleto.xml'))

// Parte 2
await generate()
log('2. faixa', (await text('[data-banner=generated] span')).replace(/\d{2}:\d{2}/, 'HH:MM'))
const product = readFileSync(file('saida/loja-basica/product.xml'), 'utf8')
const expected = readFileSync('docs/examples/produto-esperado/loja-basica/product.xml', 'utf8')
log('   equivalente ao esperado', canonical(product) === canonical(expected))
log(
  '   .svg idêntico',
  readFileSync(file('docs/img/pix-fluxo.svg')).equals(
    readFileSync(file('saida/loja-basica/docs/img/pix-fluxo.svg'))
  )
)
log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
```

- [ ] **Passo 3: Rodar a aceitação e o roteiro da geração no `mdd.exe`**

Combine o momento com o usuário.

```bash
bash .checks/run-ui.sh ./dist/win-unpacked/mdd.exe .checks/aceitacao-5.mjs
bash .checks/run-ui.sh ./dist/win-unpacked/mdd.exe .checks/geracao-ui.mjs 9229
```

Esperado da aceitação, exatamente:

```
1. pag_boleto                        → manual-selected
   barra de status                   → Loja Básica: Válida · completa
   diálogo                           → Não foi possível gerar Nada foi gravado. Problemas docs/pagamento/boleto.xml [doc_boleto] Arquivo ausente. Fechar Fechar
   saida/ existe?                    → false
   pag_boleto de volta               → manual-deselected
2. faixa                             → Produto gerado em saida/loja-basica/ às HH:MM
   equivalente ao esperado           → true
   .svg idêntico                     → true
erros no console                     → nenhum
app fechado
```

Do `geracao-ui.mjs`: a mesma saída da Tarefa 4, Passo 16. Os dois confirmam que a geração funciona dentro do `app.asar`, com o `xmllint` no main e a CSP no renderer.

- [ ] **Passo 4: A checagem à mão, com o usuário**

O roteiro troca o `shell.openPath` por um registrador. Falta a abertura de verdade. Peça ao usuário, com o `mdd.exe` aberto numa cópia do exemplo (por exemplo, `.checks/aceitacao-manual/`, para não mexer no `docs/examples`):

1. na aba Configurações, abrir `loja-basica` e clicar em **Gerar produto**: a faixa verde aparece com a pasta e a hora;
2. clicar em **Abrir pasta**: o Explorer abre `saida\loja-basica`, com o `product.xml` e a pasta `docs\img` com o `pix-fluxo.svg`.

Registre no handoff o que ele viu.

- [ ] **Passo 5: A SPEC (`docs/SPEC.md`)**

1. Em §4.4, troque os passos 2, 3 e 4 por:

```markdown
2. **Verificação.** Todos os arquivos do plano existem, e todos os fragmentos são XML bem-formado em UTF-8, sem prefixos de namespace sem declaração e sem entidades além das cinco do XML e das referências numéricas (`&nbsp;`, por exemplo, deixaria de existir fora do arquivo original, porque o DOCTYPE fica de fora). Se houver qualquer problema, **nada é gravado** e todos os problemas são listados de uma vez, com o arquivo, a linha e o asset.
3. **Escrita.** Grava numa pasta temporária `saida/.<nome>.tmp/`:
   - `product.xml` conforme `product.xsd`. Cada fragmento vira `<fragment asset="…" xml:base="<pasta do fragmento>/">` contendo o elemento raiz do arquivo com o texto exatamente como está (sem BOM, declaração XML, DOCTYPE nem os comentários de fora da raiz). Se a raiz não declara um namespace padrão, ela recebe `xmlns=""`, para os elementos sem prefixo não herdarem o `urn:mdd:product`. Um fragmento na raiz do projeto recebe `xml:base="./"`.
   - Cada recurso incluído é copiado byte a byte para `<saída>/<path>`, mantendo a estrutura de pastas.
4. **Troca.** Se `saida/<nome>/` já existir, pede confirmação para substituir. Depois renomeia a pasta antiga para `saida/.<nome>.old/`, renomeia a temporária para o lugar dela e apaga a `.old`. Se algo falhar, a temporária é apagada e a pasta antiga fica, ou volta, no lugar; no Windows, um arquivo da pasta aberto em outro programa impede a troca. As sobras de uma geração interrompida são apagadas na seguinte.

A geração usa o projeto como está na tela, com as alterações não salvas; os fragmentos e os recursos vêm do disco. Gerar não entra no histórico de desfazer.
```

2. Em §6.2:
   - na linha do `ProjectStorage`, troque a responsabilidade por "Ler, escrever, listar, conferir (`stat`), copiar, renomear e remover arquivos e pastas dentro do projeto; renomear e apagar pastas só dentro de `saida/`. A escrita recebe o hash esperado para detectar alteração externa (§8).";
   - na linha do `ProductDeriver`, troque a responsabilidade por "Receber um `GenerationPlan` e a hora da geração, conferir as fontes e devolver os arquivos do produto (textos e cópias), ou todos os problemas. A pasta temporária e a troca ficam com o caso de uso `WriteProductFolder`, igual para qualquer formato.";
   - na linha do `XmlSchemaValidator`, troque a responsabilidade por "Etapas 1 e 2 da leitura (§5): XML bem-formado e conforme o XSD. Sem schema, só XML bem-formado (fragmentos da geração).";
   - acrescente, depois da linha do `AssetOpener`:

```markdown
| `OutputFolderOpener` | Abrir uma pasta gerada (`saida/<nome>`) no gerenciador de arquivos. | `ElectronOutputFolderOpener` |
```

3. Em §6.3, troque os itens **Arquivos**, **XML** e **Shell** da lista de canais por:

```markdown
- **Arquivos:** `readText`, `writeText` (com hash esperado; cria as pastas), `stat`, `list`, `copy` (cria as pastas), `remove` (com hash esperado), e `rename` e `removeDirectory`, só dentro de `saida/`
- **XML:** `validateXml` (etapas 1 e 2 da leitura, §5; sem schema, só XML bem-formado)
- **Shell:** `openPath` (`shell.openPath`, para arquivos do projeto e pastas dentro de `saida/`)
```

4. Em §7, troque a linha "Botão **Gerar produto** (Fase 5), habilitado só quando a configuração está completa." por:

```markdown
- Botão **Gerar produto**, ligado só quando a configuração está completa; desligado, a dica diz o que falta. Gera do que está na tela, com as alterações não salvas.
  - Se `saida/<nome>/` já existe, pergunta antes de substituir.
  - Os problemas aparecem num diálogo com todos os itens (arquivo, linha, asset e mensagem) e o aviso de que nada foi gravado.
  - O sucesso aparece numa faixa verde acima do diagrama, com a pasta, a hora, "Abrir pasta" (no gerenciador de arquivos) e ×. A faixa é da configuração gerada: some ao trocar de configuração e volta ao voltar para ela.
```

- [ ] **Passo 6: O ADR 0006**

Em `docs/adr/0006-geracao-agnostica-de-vocabulario.md`, no fim de "Consequences", acrescente:

```markdown
- O DOCTYPE dos fragmentos fica de fora do produto, então só valem as cinco entidades do XML e as referências numéricas; `&nbsp;` e afins são recusados na verificação (Fase 5).
- Um fragmento cuja raiz não declara um namespace padrão recebe `xmlns=""` ao ser embutido, para os seus elementos sem prefixo não caírem no namespace do `product.xml`.
```

- [ ] **Passo 7: A spec do desenho**

Em `docs/superpowers/specs/2026-09-24-fase-5-geracao-design.md`, logo abaixo da linha "Aprovado em 24/09/2026. …", acrescente:

```markdown
> O protótipo refinou alguns pontos deste desenho: a ordem das conferências dos fragmentos (`xmllint` e depois `@xmldom/xmldom`), os recursos do plano como assets, o `GenerateProduct` sem o `ProjectStorage` direto e os diálogos num componente próprio. Veja "O que o protótipo respondeu" no [plano](../plans/2026-09-24-fase-5-geracao.md); a SPEC já reflete esses pontos.
```

- [ ] **Passo 8: O handoff (`docs/HANDOFF.md`)**

- Na tabela "Estado atual", troque a linha da Fase 5 por:

```markdown
| 5. Geração | Concluída | `main`. Plano em [docs/superpowers/plans/2026-09-24-fase-5-geracao.md](superpowers/plans/2026-09-24-fase-5-geracao.md) |
```

- Na lista do que o app faz, acrescente: "gera o produto de uma configuração completa em `saida/<nome>/`, com o `product.xml` e os recursos copiados, conferindo todas as fontes antes e sem gravar nada quando há problema".
- Depois de "Aceitação da Fase 4", acrescente a seção "Aceitação da Fase 5 (feita em <data>)". Ela registra o que os Passos 3 e 4 desta tarefa mostraram, os roteiros das Tarefas 1 a 4 e a regressão da Tarefa 4, Passo 17. Escreva o que de fato aconteceu; se algo divergir do esperado, registre a divergência.
- Troque a seção "Próximo passo: Fase 5 (geração)" por "Próximo passo". Com a Fase 5, as fases 0 a 5 da primeira versão estão concluídas. A seção lista o que resta, para o usuário escolher: as checagens manuais ainda não confirmadas das Fases 0 e 1 (a seção que já existe) e os itens da fase "Depois" da SPEC §9.
- Em "Como trabalhamos", acrescente aos roteiros da lista: "Os da Fase 5 (`generation-plan-check.mts`, `output-guard-check.mts`, `fragment-source-check.mts`, `generation-support.mts`, `generate-product-check.mts`, `generation-store-check.mts`, `geracao-ui.mjs` e `aceitacao-5.mjs`) estão no plano da Fase 5."
- Em "Armadilhas já encontradas", acrescente:

```markdown
- **`xmllint` e `@xmldom/xmldom` se completam:** o `xmllint` é rigoroso com a sintaxe, mas aceita prefixo de namespace sem declaração e, com DOCTYPE de DTD externa, entidades como `&nbsp;`; o `xmldom` pega esses dois casos, mas aceita `&` solto e atributo sem aspas. Para conferir um fragmento, rode os dois, nessa ordem.
- **Posições do `@xmldom/xmldom`:** ele converte as quebras de linha antes de ler, e as posições deixam de bater com o texto original. Passe `normalizeLineEndings: (source) => source` e conte as linhas como ele (`\r\n`, `\r` e `\n`). Ele também recusa o BOM: tire-o antes.
- **Renomear pasta no Windows:** falha com `EPERM` se um arquivo dela estiver aberto em outro processo (mesmo com permissão de exclusão) e com `EBUSY` se ela for o diretório atual de outro processo. Para reproduzir num roteiro, um PowerShell segura o arquivo (`generation-support.mts`).
- **BOM no código:** escreva `'\u{FEFF}'`. A forma de quatro dígitos pode virar um BOM literal, invisível, ao passar pela ferramenta de escrita.
```

- [ ] **Passo 9: Commit**

```bash
npm run format
git add docs/SPEC.md docs/adr/0006-geracao-agnostica-de-vocabulario.md docs/superpowers/specs/2026-09-24-fase-5-geracao-design.md docs/HANDOFF.md
git commit -m "docs: spec, ADR 0006 e handoff registram a Fase 5

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Depois das checagens, o branch volta para a `main` com merge local, como nas fases anteriores.

---

## Aceitação da Fase 5 (SPEC §9)

- [ ] Gerar `loja-basica` produz o equivalente a `produto-esperado/loja-basica/`, mais o `docs/img/pix-fluxo.svg` idêntico (Tarefa 3, Passo 13; Tarefa 5, Passo 3).
- [ ] Com `pag_boleto` selecionado e `boleto.xml` ausente, a geração falha, lista o problema e não grava nada (Tarefa 3, Passo 13; Tarefa 5, Passo 3).
- [ ] Todos os problemas aparecem de uma vez, com arquivo, linha e asset (Tarefa 3, Passo 13; Tarefa 4, Passo 16).
- [ ] Gerar de novo pergunta antes de substituir; a troca nunca deixa o usuário sem nenhuma das versões (Tarefa 3, Passo 13; Tarefa 4, Passo 16).
- [ ] O botão só liga com a configuração completa, e a dica diz o que falta (Tarefa 4, Passo 16).
- [ ] A faixa verde mostra a pasta e a hora, e "Abrir pasta" abre o Explorer (Tarefa 4, Passo 16, registrado; Tarefa 5, Passo 4, de verdade).
- [ ] O main só renomeia e apaga pastas dentro de `saida/` (Tarefa 2, Passo 10).
- [ ] As fases anteriores continuam iguais (Tarefa 4, Passo 17).
