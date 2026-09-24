# Fase 3 — Configurador: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** configurar produtos da linha. Cada configuração é resolvida por um solver SAT, com propagação completa, e aparece no mesmo diagrama do modelo, em modo configuração: um clique alterna a decisão, as features decididas pelo modelo ficam travadas com cadeado, e um painel recebe os valores dos atributos. A lista de configurações ganha criar, renomear, duplicar e excluir, e uma configuração desatualizada mostra o que está errado e como consertar.

**Arquitetura:**

- **Domínio** (puro): a fórmula do modelo (SPEC §4.1), as referências órfãs, os valores de atributos (inválidos e faltando), as edições de uma configuração e da lista, e os tipos e estados da resolução.
- **Aplicação:** a porta `ConstraintSolver` e o caso de uso `ResolveConfiguration`, com o algoritmo da SPEC §4.2 (passos 1 a 4). O `SaveProject` passa a excluir os arquivos das configurações que saíram da lista.
- **Infraestrutura:** o `LogicSolverConstraintSolver`, sobre o `logic-solver`, com um `.d.ts` próprio. O canal `remove` entra no IPC.
- **Interface:** uma barra de abas (Modelo | Configurações). A aba Configurações tem a lista, o diagrama em modo configuração, as faixas de problemas, o painel de valores e a barra de status. A store guarda a configuração aberta e entrega a resolução dela.

**Stack:** a das fases anteriores, mais `logic-solver` 2.0.1 (MiniSat compilado para JavaScript, ADR 0002).

**Spec:** [docs/SPEC.md](../../SPEC.md): §4.1 (semântica), §4.2 (configuração), §7 (Configurações) e §9 (linha da Fase 3). Veja também os ADRs [0002](../../adr/0002-solver-sat-para-propagacao.md), [0005](../../adr/0005-configuracao-guarda-so-decisoes-manuais.md), [0007](../../adr/0007-diagrama-com-layout-automatico.md) e [0008](../../adr/0008-camadas-com-lint-sem-testes.md). Esta fase não tem documento de desenho próprio. O que a SPEC não fixava está em "Decisões desta fase", e a Tarefa 5 leva essas decisões para a SPEC.

## Restrições globais

- **Sem testes automatizados** (ADR 0008).
  - Cada tarefa verifica com `npm run typecheck`, `npm run lint` e scripts descartáveis em `.checks/`.
  - `.checks/` fica fora do git, do ESLint e do Prettier.
  - Os scripts `.mts` rodam com `npx tsx --tsconfig tsconfig.web.json`, por causa do alias `@/`. Os `.mjs` rodam com `node`.
  - Os roteiros da interface usam `.checks/cdp.mjs` e `.checks/main-dialogs.mjs`. Num clone novo, recrie os dois a partir do plano da 2B (Tarefa 3, Passo 12, e Tarefa 4, Passo 2).
- **Camadas** (SPEC §6.1): `domain/` não importa nada de fora dele; `application/` só `domain/`; só `ui/app/` conhece `infrastructure/`. O lint barra violações.
- **Imports:** dentro de `domain/`, relativos; nas demais camadas, alias `@/`.
- **Idioma:** identificadores em inglês; textos da interface, mensagens, comentários e documentação em português.
- **Regras do lint:** toda função tem tipo de retorno explícito. As regras de hooks do React 19 estão ligadas: nada de `setState` síncrono dentro de effect, nada de ler ref durante o render.
- **Classes do Tailwind** sempre escritas por inteiro no código (nada de `` `bg-${cor}` ``), senão o Tailwind não as gera.
- **Imutabilidade:** modelo, configuração e lista de configurações são valores imutáveis. Uma edição que não muda nada devolve o mesmo objeto, e a tela não mostra alteração pendente.
- **A resolução nunca é salva** (ADR 0005): o arquivo da configuração guarda só as decisões manuais e os valores.
- **O configurador não tem desfazer** (SPEC §2): as edições da configuração não passam pelo histórico de comandos, que continua só do modelo.
- **Commits:** rode `npm run format` antes de cada commit. Os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Shell:** todo comando roda na raiz do repositório com **Git Bash**, no branch `fase-3-configurador`.
- **Fechar o app num roteiro:** use `.checks/quit.mjs` (Tarefa 4, Passo 15), nunca `taskkill /IM electron.exe`, que fecharia outros apps Electron da máquina.

## Decisões desta fase

A SPEC descreve o configurador, mas deixava estes pontos em aberto. O protótipo seguiu estas escolhas, e a Tarefa 5 as registra na SPEC:

1. **Barra lateral:** uma faixa estreita com as abas Modelo e Configurações; a de Assets chega na Fase 4. Na aba Configurações, a lista fica à esquerda, o diagrama no centro e os valores à direita. Renomear, duplicar e excluir ficam na barra da configuração aberta.
2. **A lista de configurações só vai para o disco ao salvar**, como o resto do projeto (SPEC §8). Criar, renomear, duplicar e excluir mudam a lista em memória e acendem o `•`. Ao salvar, o arquivo de uma configuração excluída é apagado, e renomear grava o arquivo novo antes de apagar o antigo. Apagar confere o hash, como gravar: um arquivo mudado fora do app vira conflito.
3. **O clique nunca cria um conflito.** O ciclo é indecisa → selecionada → desselecionada → indecisa. Se o próximo estado contradisser as outras decisões (por exemplo, desselecionar `mobile` com `pag_pix` selecionada), a decisão sobre a feature é removida. Ela passa a mostrar o valor que o modelo impõe, com o cadeado. Um conflito só chega de fora: arquivo editado à mão ou mudança no modelo.
4. **Em conflito ou com o modelo vazio**, nada é propagado. Os nós mostram só as decisões manuais e não respondem ao clique. A faixa lista as decisões, cada uma com "Remover", e o painel de valores fica bloqueado.
5. **Valores de atributos:**
   - campo vazio = sem valor na configuração, e vale o `default` do modelo, se houver;
   - um valor que não serve para o tipo é recusado com o motivo;
   - um valor inválido vindo do arquivo deixa a configuração desatualizada, aparece numa faixa com "Remover" e conta como atributo sem valor para a completude;
   - um valor para um atributo que ficou fixo no modelo conta como referência órfã.
6. **Ordem no arquivo:** decisões e valores novos entram na ordem do modelo (pré-ordem), e não no fim. Assim, tirar e devolver a decisão de `pag_pix` volta ao arquivo idêntico ao exemplo.
7. **Chave da configuração:** o nome do arquivo sai do nome de exibição, sem acentos, com `-` entre as palavras e sufixo `-2`, `-3`… em colisão ("Loja Básica" → `loja-basica`). O diálogo mostra o nome do arquivo enquanto se digita.
8. **Desfazer, refazer e os atalhos de edição** valem só na aba Modelo. No configurador, só Ctrl+S; os botões de desfazer ficam desabilitados, com a dica "Desfazer vale só na aba Modelo".
9. **Barra de status:** "Loja Básica: Válida · completa", "Válida · incompleta (2 indecisas, 1 atributo sem valor)", "Em conflito", "Modelo vazio: nenhum produto é possível", com "· desatualizada" no fim quando for o caso.
10. **"Gerar produto" fica para a Fase 5**, junto com a geração. Um botão sem ação agora só confundiria.

## O que o protótipo respondeu

O código deste plano foi prototipado e verificado numa cópia descartável do repositório, inclusive no `mdd.exe` empacotado. Estas são as respostas aos riscos e os achados pelo caminho:

1. **`logic-solver` com a Content-Security-Policy.** O `minisat.js` tem `eval`, e a página bloqueia `eval` (`script-src 'self'`; conferido de dentro da página, porque o que o DevTools executa ignora a CSP). Mesmo assim o solver roda no renderer compilado e dentro do `app.asar`: os caminhos que ele usa não chamam `eval`. O `npm run build` avisa três vezes "Use of eval in node_modules/logic-solver/minisat.js is strongly discouraged". É esperado.
2. **Reaproveitar o solver degrada.** Cada `Solution` copia uma tabela interna que cresce a cada `solveAssuming`. Com 300 resoluções no mesmo solver, o teste não terminou em 5 minutos. Por isso cada resolução cria um solver novo, com as decisões como regras, e cada feature é testada com uma suposição de um literal. Criar um solver custa cerca de 2 ms (60 ms o primeiro). Cada instância reserva 64 MB, que o coletor de lixo devolve: a memória ficou estável em 100 resoluções seguidas.
3. **Desempenho.** Num modelo sintético de 321 features com 8 decisões, uma resolução faz 315 perguntas ao solver e leva de 29 a 58 ms. Ler cada solução com `getTrueVars()` é cerca de 35% mais rápido que `evaluate` feature por feature. `Logic.disablingAssertions` não ganha nada e ficou de fora.
4. **Cardinalidade.** Os casos comuns usam `Logic.or`, `exactlyOne` e `atMostOne`; os demais somam com `Logic.sum` e comparam com `greaterThanOrEqual`/`lessThanOrEqual`. Um grupo `[2..2]` propaga certo: com `pag_boleto` desselecionada, `pag_cartao` e `pag_pix` ficam selecionadas e travadas.
5. **A interface pede a mesma resolução muitas vezes.** Cada nó, a faixa, o painel e a barra de status leem a resolução por seletores do Zustand. O seletor precisa receber o mesmo objeto enquanto nada muda, senão o React entra em laço. Por isso o `ResolveConfiguration` guarda o resultado num `WeakMap` indexado pelo objeto da configuração, que é imutável.
6. **Fechar o app num roteiro com alteração pendente** faz o main abrir o diálogo nativo "Alterações não salvas" e esperar. O `quit.mjs` avisa `setUnsavedChanges(false)` antes de fechar.
7. **Captura de tela pelo protocolo** (`Page.captureScreenshot`) trava com a janela em segundo plano. Com `Page.bringToFront` antes, funciona; foi assim que o visual foi conferido.
8. **Regressão.** O roteiro do diagrama da 2B (`diagrama-ui.mjs`) e o da 2A (`ui-check.mjs`) deram saída idêntica à registrada na 2B.

## Mapa de arquivos

| Arquivo                                                                                                    | Responsabilidade                                                                  |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `domain/formula/formula.ts`                                                                                | Tipo `Formula` (com o nó de cardinalidade) e construtores                         |
| `domain/formula/model-formula.ts`                                                                          | Semântica do modelo → `Formula` (SPEC §4.1)                                       |
| `domain/configuration/references.ts`                                                                       | Referências órfãs, decisões ativas, remover órfãs                                 |
| `domain/configuration/attribute-values.ts`                                                                 | Valores inválidos e atributos sem valor                                           |
| `domain/configuration/resolution.ts`                                                                       | Tipos da resolução e estados calculados                                           |
| `domain/configuration/configuration-edits.ts`                                                              | Ciclo do clique, decisão e valor de atributo                                      |
| `domain/project/configuration-entries.ts`                                                                  | Chave pelo nome; criar, renomear, duplicar e excluir na lista                     |
| `application/ports/constraint-solver.ts`                                                                   | Porta do solver                                                                   |
| `application/use-cases/resolve-configuration.ts`                                                           | Algoritmo da SPEC §4.2, com cache por configuração                                |
| `application/use-cases/save-project.ts`                                                                    | Exclui os arquivos das configurações que saíram da lista                          |
| `application/ports/project-storage.ts`, `repositories.ts`                                                  | `remove` com hash esperado                                                        |
| `infrastructure/solver/logic-solver.d.ts`                                                                  | Tipos do `logic-solver`                                                           |
| `infrastructure/solver/logic-solver-constraint-solver.ts`                                                  | Adapter: `Formula` → `Logic`                                                      |
| `infrastructure/electron/electron-project-storage.ts`                                                      | `remove` sobre `window.mdd`                                                       |
| `infrastructure/xml/xml-document-file.ts`, `xml-repositories.ts`                                           | `remove` de uma configuração                                                      |
| `shared/ipc.ts`, `preload/index.ts`, `main/ipc/file-handlers.ts`                                           | Canal `remove`                                                                    |
| `ui/stores/project-store.ts`                                                                               | Configuração aberta, ações do configurador, resolução, alterações pendentes       |
| `ui/app/composition-root.ts`                                                                               | Injeta o `ResolveConfiguration`                                                   |
| `ui/diagram/node-parts.tsx`                                                                                | Pontos de conexão e botão de recolher, comuns aos dois nós                        |
| `ui/diagram/FeatureNode.tsx`                                                                               | Usa `node-parts`                                                                  |
| `ui/diagram/ConfiguredFeatureNode.tsx`                                                                     | Nó no modo configuração: estado, cadeado, clique                                  |
| `ui/diagram/flow-types.ts`, `FeatureDiagram.tsx`                                                           | Modo `edit` ou `configure`                                                        |
| `ui/screens/project/ViewRail.tsx`                                                                          | Abas Modelo e Configurações                                                       |
| `ui/screens/project/ModelWorkspace.tsx`                                                                    | A aba Modelo (o que ficava na `ProjectScreen`)                                    |
| `ui/screens/project/ProjectScreen.tsx`, `ProjectHeader.tsx`, `use-editor-shortcuts.ts`, `editor-dialog.ts` | Abas, diálogos novos, atalhos e desfazer só no modelo                             |
| `ui/screens/configurator/*`                                                                                | Área do configurador, lista, faixas, painel de valores, barra de status, diálogos |

(Os caminhos em `domain/`, `application/`, `infrastructure/` e `ui/` ficam em `src/renderer/src/`; os de `shared/`, `preload/` e `main/`, em `src/`.)

---

### Tarefa 1: Fórmula do modelo, solver e resolução

**Arquivos:**

- Modificar: `package.json`, `package-lock.json` (dependência)
- Criar: `src/renderer/src/domain/formula/formula.ts`, `src/renderer/src/domain/formula/model-formula.ts`
- Substituir: `src/renderer/src/domain/configuration/references.ts`
- Criar: `src/renderer/src/domain/configuration/attribute-values.ts`, `src/renderer/src/domain/configuration/resolution.ts`
- Modificar: `src/renderer/src/domain/configuration/configuration.ts` (comentário)
- Criar: `src/renderer/src/application/ports/constraint-solver.ts`, `src/renderer/src/application/use-cases/resolve-configuration.ts`
- Criar: `src/renderer/src/infrastructure/solver/logic-solver.d.ts`, `src/renderer/src/infrastructure/solver/logic-solver-constraint-solver.ts`
- Verificação: `.checks/resolution-check.mts`

**Interfaces:**

- Consome: `FeatureModel`, `Feature`, `Group`, `Attribute` (`domain/feature-model/feature-model.ts`), `featuresInPreOrder` (`domain/feature-model/traversal.ts`), `checkAttributeValue` (`domain/feature-model/attribute-value.ts`), `Expression` (`domain/expression/ast.ts`), `Configuration`, `ManualDecision`, `AttributeValue`, `DecisionState` (`domain/configuration/configuration.ts`).
- Produz:
  - `Formula`, `variable(id)`, `literal(id, value)`, `and(operands)`, `implies(left, right)` (`domain/formula/formula.ts`)
  - `modelFormula(model): Formula`, `expressionFormula(expression): Formula` (`domain/formula/model-formula.ts`)
  - `OrphanReference`, `featuresById(model)`, `configurableAttribute(feature, attributeId)`, `findOrphanReferences(model, configuration)`, `activeDecisions(model, configuration)`, `withoutOrphanReferences(model, configuration)`; `referencesAnyFeature` e `referencesAttribute` continuam iguais (`domain/configuration/references.ts`)
  - `AttributeRef`, `InvalidValue`, `storedValue(configuration, featureId, attributeId)`, `findInvalidValues(model, configuration)`, `findMissingValues(model, configuration, selected)` (`domain/configuration/attribute-values.ts`)
  - `FeatureStatus`, `Resolution` (`kind`: `'empty-model' | 'conflict' | 'resolved'`), `ConfigurationStatus`, `configurationStatus(resolution)`, `isSelected(status)` (`domain/configuration/resolution.ts`)
  - `ConstraintSolver` (`load(formula): LoadedFormula`), `LoadedFormula` (`solve(assuming?: Literal): Solution | null`), `Literal`, `Solution` (`application/ports/constraint-solver.ts`)
  - `class ResolveConfiguration` (`constructor(solver)`, `execute(model, configuration): Resolution`)
  - `class LogicSolverConstraintSolver implements ConstraintSolver`

- [ ] **Passo 1: Branch e dependência**

```bash
git checkout -b fase-3-configurador
npm install logic-solver@^2.0.1
npm ls underscore
```

Esperado: `package.json` ganha `"logic-solver": "^2.0.1"` em `dependencies`, e o `npm ls` mostra `logic-solver@2.0.1` com `underscore` embaixo. O pacote não tem tipos; eles vêm do `.d.ts` do Passo 10.

- [ ] **Passo 2: Criar `src/renderer/src/domain/formula/formula.ts`**

```ts
/*
 * Fórmula proposicional sobre IDs de features, com um nó de cardinalidade (SPEC §4.1).
 * O domínio só constrói a fórmula; resolvê-la é trabalho do solver (ADR 0002).
 */

export type Formula =
  | { readonly kind: 'var'; readonly id: string }
  | { readonly kind: 'const'; readonly value: boolean }
  | { readonly kind: 'not'; readonly operand: Formula }
  | { readonly kind: 'and'; readonly operands: readonly Formula[] }
  | { readonly kind: 'or'; readonly operands: readonly Formula[] }
  | { readonly kind: 'implies'; readonly left: Formula; readonly right: Formula }
  | { readonly kind: 'iff'; readonly left: Formula; readonly right: Formula }
  | {
      readonly kind: 'cardinality'
      /** Quantos operandos verdadeiros, no mínimo e no máximo (inclusive). */
      readonly min: number
      readonly max: number
      readonly operands: readonly Formula[]
    }

export function variable(id: string): Formula {
  return { kind: 'var', id }
}

/** A feature com o valor indicado: `id` quando verdadeira, `not id` quando falsa. */
export function literal(id: string, value: boolean): Formula {
  return value ? variable(id) : { kind: 'not', operand: variable(id) }
}

export function and(operands: readonly Formula[]): Formula {
  return { kind: 'and', operands }
}

export function implies(left: Formula, right: Formula): Formula {
  return { kind: 'implies', left, right }
}
```

- [ ] **Passo 3: Criar `src/renderer/src/domain/formula/model-formula.ts`**

```ts
import type { Expression } from '../expression/ast'
import type { Feature, FeatureModel, Group } from '../feature-model/feature-model'
import { and, implies, variable, type Formula } from './formula'

/**
 * A semântica do modelo (SPEC §4.1) como uma conjunção:
 * 1. a raiz é verdadeira;
 * 2. cada feature implica o pai;
 * 3. o pai implica cada filha solitária obrigatória;
 * 4. o pai implica a cardinalidade de cada grupo;
 * 5. todas as restrições.
 */
export function modelFormula(model: FeatureModel): Formula {
  const parts: Formula[] = [variable(model.root.id)]

  const visit = (parent: Feature): void => {
    for (const child of parent.children) {
      if (child.kind === 'feature') {
        parts.push(implies(variable(child.feature.id), variable(parent.id)))
        if (child.feature.variability === 'mandatory') {
          parts.push(implies(variable(parent.id), variable(child.feature.id)))
        }
        visit(child.feature)
        continue
      }
      for (const member of child.group.members) {
        parts.push(implies(variable(member.id), variable(parent.id)))
      }
      parts.push(implies(variable(parent.id), groupCardinality(child.group)))
      child.group.members.forEach(visit)
    }
  }

  visit(model.root)
  for (const constraint of model.constraints) parts.push(expressionFormula(constraint.expression))
  return and(parts)
}

/** `[a..b]` sobre os membros; `*`, ou um máximo acima do número de membros, vale como todos. */
function groupCardinality(group: Group): Formula {
  const count = group.members.length
  const max = group.max === '*' || group.max > count ? count : group.max
  return {
    kind: 'cardinality',
    min: group.min,
    max,
    operands: group.members.map((member) => variable(member.id))
  }
}

export function expressionFormula(expression: Expression): Formula {
  switch (expression.kind) {
    case 'var':
      return variable(expression.id)
    case 'const':
      return { kind: 'const', value: expression.value }
    case 'not':
      return { kind: 'not', operand: expressionFormula(expression.operand) }
    case 'binary': {
      const left = expressionFormula(expression.left)
      const right = expressionFormula(expression.right)
      switch (expression.operator) {
        case 'and':
          return { kind: 'and', operands: [left, right] }
        case 'or':
          return { kind: 'or', operands: [left, right] }
        case 'implies':
          return { kind: 'implies', left, right }
        case 'iff':
          return { kind: 'iff', left, right }
      }
    }
  }
}
```

- [ ] **Passo 4: Substituir o conteúdo de `src/renderer/src/domain/configuration/references.ts`**

As duas funções que já existiam (`referencesAnyFeature` e `referencesAttribute`) continuam iguais; o resto é novo.

```ts
import type { Attribute, Feature, FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import type { AttributeValue, Configuration, ManualDecision } from './configuration'

/** A configuração tem decisão ou valor de atributo para alguma das features? */
export function referencesAnyFeature(
  configuration: Configuration,
  featureIds: ReadonlySet<string>
): boolean {
  return (
    configuration.decisions.some((decision) => featureIds.has(decision.featureId)) ||
    configuration.values.some((value) => featureIds.has(value.featureId))
  )
}

/** A configuração tem valor para este atributo desta feature? */
export function referencesAttribute(
  configuration: Configuration,
  featureId: string,
  attributeId: string
): boolean {
  return configuration.values.some(
    (value) => value.featureId === featureId && value.attributeId === attributeId
  )
}

/**
 * Referência a algo que não existe mais no modelo (SPEC §4.2): é ignorada na resolução e
 * deixa a configuração desatualizada. Um valor para um atributo que virou fixo também conta.
 */
export type OrphanReference =
  | { readonly kind: 'decision'; readonly decision: ManualDecision }
  | {
      readonly kind: 'value'
      readonly value: AttributeValue
      readonly reason: 'feature' | 'attribute' | 'fixed'
    }

/** Features do modelo por ID. */
export function featuresById(model: FeatureModel): Map<string, Feature> {
  return new Map(featuresInPreOrder(model.root).map((feature) => [feature.id, feature]))
}

/** O atributo configurável `attributeId` da feature, se existir. */
export function configurableAttribute(
  feature: Feature | undefined,
  attributeId: string
): Attribute | undefined {
  const attribute = feature?.attributes.find((candidate) => candidate.id === attributeId)
  return attribute?.configurable ? attribute : undefined
}

export function findOrphanReferences(
  model: FeatureModel,
  configuration: Configuration
): OrphanReference[] {
  const features = featuresById(model)
  const orphans: OrphanReference[] = configuration.decisions
    .filter((decision) => !features.has(decision.featureId))
    .map((decision) => ({ kind: 'decision', decision }))
  for (const value of configuration.values) {
    const reason = orphanValueReason(features.get(value.featureId), value.attributeId)
    if (reason !== null) orphans.push({ kind: 'value', value, reason })
  }
  return orphans
}

/** As decisões manuais que valem na resolução: as que citam features existentes. */
export function activeDecisions(
  model: FeatureModel,
  configuration: Configuration
): ManualDecision[] {
  const features = featuresById(model)
  return configuration.decisions.filter((decision) => features.has(decision.featureId))
}

/** A configuração sem as referências órfãs ("remover referências órfãs", SPEC §7). */
export function withoutOrphanReferences(
  model: FeatureModel,
  configuration: Configuration
): Configuration {
  const features = featuresById(model)
  return {
    ...configuration,
    decisions: configuration.decisions.filter((decision) => features.has(decision.featureId)),
    values: configuration.values.filter(
      (value) => orphanValueReason(features.get(value.featureId), value.attributeId) === null
    )
  }
}

function orphanValueReason(
  feature: Feature | undefined,
  attributeId: string
): 'feature' | 'attribute' | 'fixed' | null {
  if (feature === undefined) return 'feature'
  const attribute = feature.attributes.find((candidate) => candidate.id === attributeId)
  if (attribute === undefined) return 'attribute'
  return attribute.configurable ? null : 'fixed'
}
```

- [ ] **Passo 5: Criar `src/renderer/src/domain/configuration/attribute-values.ts`**

```ts
import { checkAttributeValue } from '../feature-model/attribute-value'
import type { FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import type { AttributeValue, Configuration } from './configuration'
import { configurableAttribute, featuresById } from './references'

export interface AttributeRef {
  readonly featureId: string
  readonly attributeId: string
}

/** Valor gravado que não serve para o tipo do atributo (SPEC §4.2): deixa a configuração desatualizada. */
export interface InvalidValue {
  readonly value: AttributeValue
  readonly message: string
}

/** O valor que a configuração guarda para o atributo, se houver. */
export function storedValue(
  configuration: Configuration,
  featureId: string,
  attributeId: string
): string | undefined {
  return configuration.values.find(
    (value) => value.featureId === featureId && value.attributeId === attributeId
  )?.value
}

/** Valores de atributos configuráveis existentes que não servem para o tipo. */
export function findInvalidValues(
  model: FeatureModel,
  configuration: Configuration
): InvalidValue[] {
  const features = featuresById(model)
  return configuration.values.flatMap((value) => {
    const attribute = configurableAttribute(features.get(value.featureId), value.attributeId)
    const message = attribute !== undefined ? checkAttributeValue(attribute, value.value) : null
    return message !== null ? [{ value, message }] : []
  })
}

/**
 * Atributos configuráveis das features selecionadas que ficam sem valor válido: nem a
 * configuração tem um valor que sirva, nem o modelo tem `default` (SPEC §4.2, "Completa").
 */
export function findMissingValues(
  model: FeatureModel,
  configuration: Configuration,
  selected: ReadonlySet<string>
): AttributeRef[] {
  return featuresInPreOrder(model.root)
    .filter((feature) => selected.has(feature.id))
    .flatMap((feature) =>
      feature.attributes
        .filter((attribute) => attribute.configurable)
        .filter((attribute) => {
          const value = storedValue(configuration, feature.id, attribute.id)
          if (value !== undefined) return checkAttributeValue(attribute, value) !== null
          return attribute.defaultValue === undefined
        })
        .map((attribute) => ({ featureId: feature.id, attributeId: attribute.id }))
    )
}
```

- [ ] **Passo 6: Criar `src/renderer/src/domain/configuration/resolution.ts`**

```ts
import type { AttributeRef, InvalidValue } from './attribute-values'
import type { DecisionState, ManualDecision } from './configuration'
import type { OrphanReference } from './references'

/*
 * Resultado da resolução de uma configuração (SPEC §4.2). É sempre calculado a partir do
 * modelo e das decisões manuais, nunca salvo (ADR 0005).
 */

export type FeatureStatus =
  | { readonly kind: 'manual'; readonly state: DecisionState }
  | { readonly kind: 'propagated'; readonly state: DecisionState }
  | { readonly kind: 'undecided' }

interface ResolutionBase {
  readonly orphans: readonly OrphanReference[]
  readonly invalidValues: readonly InvalidValue[]
}

export type Resolution =
  /** O modelo, sozinho, não admite nenhum produto. */
  | (ResolutionBase & { readonly kind: 'empty-model' })
  /** As decisões manuais se contradizem: nenhuma propagação é mostrada. */
  | (ResolutionBase & {
      readonly kind: 'conflict'
      /** As decisões que valem (sem as órfãs), para o usuário remover. */
      readonly decisions: readonly ManualDecision[]
    })
  | (ResolutionBase & {
      readonly kind: 'resolved'
      /** O estado de cada feature do modelo. */
      readonly features: ReadonlyMap<string, FeatureStatus>
      readonly missingValues: readonly AttributeRef[]
    })

export interface ConfigurationStatus {
  /** Não está em conflito (e o modelo admite algum produto). */
  readonly valid: boolean
  /** Válida, sem features indecisas e com todos os valores de atributo. */
  readonly complete: boolean
  /** Tem referências órfãs, está em conflito ou tem valor inválido. */
  readonly stale: boolean
  readonly undecidedCount: number
  readonly missingValueCount: number
}

export function configurationStatus(resolution: Resolution): ConfigurationStatus {
  const damaged = resolution.orphans.length > 0 || resolution.invalidValues.length > 0
  if (resolution.kind !== 'resolved') {
    return {
      valid: false,
      complete: false,
      stale: damaged || resolution.kind === 'conflict',
      undecidedCount: 0,
      missingValueCount: 0
    }
  }
  const undecidedCount = [...resolution.features.values()].filter(
    (status) => status.kind === 'undecided'
  ).length
  const missingValueCount = resolution.missingValues.length
  return {
    valid: true,
    complete: undecidedCount === 0 && missingValueCount === 0,
    stale: damaged,
    undecidedCount,
    missingValueCount
  }
}

/** A feature está no produto (por decisão manual ou propagada)? */
export function isSelected(status: FeatureStatus | undefined): boolean {
  return status !== undefined && status.kind !== 'undecided' && status.state === 'selected'
}
```

- [ ] **Passo 7: Atualizar o comentário de `src/renderer/src/domain/configuration/configuration.ts`**

Troque:

```ts
 * A resolução (propagação, validade, completude) chega na Fase 3.
```

por:

```ts
 * O resto (propagação, validade, completude) é calculado: veja resolution.ts.
```

- [ ] **Passo 8: Criar `src/renderer/src/application/ports/constraint-solver.ts`**

```ts
import type { Formula } from '@/domain/formula/formula'

/** Uma variável com um valor: "a feature `id` está (ou não) no produto". */
export interface Literal {
  readonly id: string
  readonly value: boolean
}

/** Uma solução: os IDs das variáveis verdadeiras. As demais são falsas. */
export type Solution = ReadonlySet<string>

/** Uma fórmula já carregada no solver, pronta para várias perguntas. */
export interface LoadedFormula {
  /** Uma solução da fórmula (com a suposição, se houver), ou `null` quando não existe. */
  solve(assuming?: Literal): Solution | null
}

/** Satisfatibilidade de fórmulas proposicionais (SPEC §6.2, ADR 0002). */
export interface ConstraintSolver {
  load(formula: Formula): LoadedFormula
}
```

- [ ] **Passo 9: Criar `src/renderer/src/application/use-cases/resolve-configuration.ts`**

O algoritmo é o da SPEC §4.2. Duas escolhas vêm do protótipo: um solver novo por resolução, e o resultado guardado num `WeakMap` indexado pela configuração.

```ts
import { findInvalidValues, findMissingValues } from '@/domain/configuration/attribute-values'
import type { Configuration } from '@/domain/configuration/configuration'
import { activeDecisions, findOrphanReferences } from '@/domain/configuration/references'
import { isSelected, type FeatureStatus, type Resolution } from '@/domain/configuration/resolution'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { featuresInPreOrder } from '@/domain/feature-model/traversal'
import { and, literal } from '@/domain/formula/formula'
import { modelFormula } from '@/domain/formula/model-formula'
import type { ConstraintSolver, LoadedFormula, Solution } from '../ports/constraint-solver'

/**
 * Resolução de uma configuração (SPEC §4.2): o que as decisões manuais e as regras do
 * modelo decidem sobre cada feature. A interface pede a mesma resolução várias vezes
 * enquanto nada muda; como modelo e configuração são imutáveis, o resultado fica guardado
 * junto do objeto da configuração, e some com ele.
 */
export class ResolveConfiguration {
  private readonly solver: ConstraintSolver
  private readonly cache = new WeakMap<
    Configuration,
    { readonly model: FeatureModel; readonly resolution: Resolution }
  >()

  constructor(solver: ConstraintSolver) {
    this.solver = solver
  }

  execute(model: FeatureModel, configuration: Configuration): Resolution {
    const cached = this.cache.get(configuration)
    if (cached !== undefined && cached.model === model) return cached.resolution
    const resolution = this.resolve(model, configuration)
    this.cache.set(configuration, { model, resolution })
    return resolution
  }

  private resolve(model: FeatureModel, configuration: Configuration): Resolution {
    const base = {
      orphans: findOrphanReferences(model, configuration),
      invalidValues: findInvalidValues(model, configuration)
    }
    const rules = modelFormula(model)
    const decisions = activeDecisions(model, configuration)

    // Um solver novo por resolução, com as decisões como regras: reaproveitar o mesmo
    // solver com suposições fica cada vez mais lento (veja o plano da Fase 3).
    const loaded = this.solver.load(
      and([
        rules,
        ...decisions.map((decision) => literal(decision.featureId, decision.state === 'selected'))
      ])
    )
    const solution = loaded.solve()
    if (solution === null) {
      const empty = this.solver.load(rules).solve() === null
      return empty ? { kind: 'empty-model', ...base } : { kind: 'conflict', ...base, decisions }
    }

    const manual = new Map(decisions.map((decision) => [decision.featureId, decision.state]))
    const features = propagate(model, manual, loaded, solution)
    const selected = new Set(
      [...features].filter(([, status]) => isSelected(status)).map(([id]) => id)
    )
    return {
      kind: 'resolved',
      ...base,
      features,
      missingValues: findMissingValues(model, configuration, selected)
    }
  }
}

/**
 * Passo 4 da SPEC §4.2: para cada feature sem decisão manual, tenta o valor contrário ao
 * da solução σ. Se não houver solução, o valor de σ é propagado; se houver, a feature fica
 * indecisa. Uma feature que já apareceu com os dois valores nas soluções encontradas
 * fica indecisa sem nova pergunta ao solver.
 */
function propagate(
  model: FeatureModel,
  manual: ReadonlyMap<string, 'selected' | 'deselected'>,
  loaded: LoadedFormula,
  sigma: Solution
): Map<string, FeatureStatus> {
  const ids = featuresInPreOrder(model.root).map((feature) => feature.id)
  const seenTrue = new Set<string>()
  const seenFalse = new Set<string>()
  const note = (solution: Solution): void => {
    for (const id of ids) (solution.has(id) ? seenTrue : seenFalse).add(id)
  }
  note(sigma)

  const features = new Map<string, FeatureStatus>()
  for (const id of ids) {
    const state = manual.get(id)
    if (state !== undefined) {
      features.set(id, { kind: 'manual', state })
      continue
    }
    if (seenTrue.has(id) && seenFalse.has(id)) {
      features.set(id, { kind: 'undecided' })
      continue
    }
    const value = sigma.has(id)
    const other = loaded.solve({ id, value: !value })
    if (other === null) {
      features.set(id, { kind: 'propagated', state: value ? 'selected' : 'deselected' })
    } else {
      note(other)
      features.set(id, { kind: 'undecided' })
    }
  }
  return features
}
```

- [ ] **Passo 10: Criar `src/renderer/src/infrastructure/solver/logic-solver.d.ts`**

```ts
/*
 * Tipos do pacote logic-solver 2.0.1, que não publica os seus (ADR 0002).
 * Só a parte da API que o adapter usa.
 */
declare module 'logic-solver' {
  namespace Logic {
    /** Nome de variável, ou o nome com "-" na frente para a negação. */
    type Term = string

    interface Formula {
      readonly type: string
    }

    type FormulaOrTerm = Formula | Term

    /** Um inteiro sem sinal representado por fórmulas (o bit menos significativo primeiro). */
    interface Bits {
      readonly bits: readonly FormulaOrTerm[]
    }

    type Operands = readonly (FormulaOrTerm | readonly FormulaOrTerm[])[]

    interface Solution {
      /** Variáveis verdadeiras, em ordem alfabética, sem as internas (que começam com "$"). */
      getTrueVars(): string[]
    }

    class Solver {
      require(...formulas: Operands): void
      solve(): Solution | null
      /** Resolve com a fórmula como suposição temporária. */
      solveAssuming(formula: FormulaOrTerm): Solution | null
    }

    const TRUE: Term
    const FALSE: Term

    function not(operand: FormulaOrTerm): FormulaOrTerm
    function and(...operands: Operands): FormulaOrTerm
    function or(...operands: Operands): FormulaOrTerm
    function implies(left: FormulaOrTerm, right: FormulaOrTerm): FormulaOrTerm
    function equiv(left: FormulaOrTerm, right: FormulaOrTerm): FormulaOrTerm
    function exactlyOne(...operands: Operands): FormulaOrTerm
    function atMostOne(...operands: Operands): FormulaOrTerm
    function sum(...operands: Operands): Bits
    function constantBits(wholeNumber: number): Bits
    function lessThanOrEqual(left: Bits, right: Bits): FormulaOrTerm
    function greaterThanOrEqual(left: Bits, right: Bits): FormulaOrTerm
  }

  export default Logic
}
```

- [ ] **Passo 11: Criar `src/renderer/src/infrastructure/solver/logic-solver-constraint-solver.ts`**

```ts
import Logic from 'logic-solver'
import type {
  ConstraintSolver,
  Literal,
  LoadedFormula,
  Solution
} from '@/application/ports/constraint-solver'
import type { Formula } from '@/domain/formula/formula'

/**
 * `ConstraintSolver` sobre o logic-solver (MiniSat compilado para JavaScript, ADR 0002).
 * Cada `load` cria um solver novo: o MiniSat reserva 64 MB por instância, que o coletor de
 * lixo devolve quando a resolução termina.
 */
export class LogicSolverConstraintSolver implements ConstraintSolver {
  load(formula: Formula): LoadedFormula {
    const solver = new Logic.Solver()
    solver.require(toLogic(formula))
    return {
      solve: (assuming?: Literal): Solution | null => {
        const solution =
          assuming === undefined
            ? solver.solve()
            : solver.solveAssuming(assuming.value ? assuming.id : Logic.not(assuming.id))
        return solution === null ? null : new Set(solution.getTrueVars())
      }
    }
  }
}

function toLogic(formula: Formula): Logic.FormulaOrTerm {
  switch (formula.kind) {
    case 'var':
      return formula.id
    case 'const':
      return formula.value ? Logic.TRUE : Logic.FALSE
    case 'not':
      return Logic.not(toLogic(formula.operand))
    case 'and':
      return Logic.and(formula.operands.map(toLogic))
    case 'or':
      return Logic.or(formula.operands.map(toLogic))
    case 'implies':
      return Logic.implies(toLogic(formula.left), toLogic(formula.right))
    case 'iff':
      return Logic.equiv(toLogic(formula.left), toLogic(formula.right))
    case 'cardinality':
      return cardinality(formula.min, formula.max, formula.operands.map(toLogic))
  }
}

/** Entre `min` e `max` termos verdadeiros; os casos comuns (or, alternative) sem somador. */
function cardinality(
  min: number,
  max: number,
  terms: readonly Logic.FormulaOrTerm[]
): Logic.FormulaOrTerm {
  const count = terms.length
  if (min <= 0 && max >= count) return Logic.TRUE
  if (min === 1 && max >= count) return Logic.or(terms)
  if (max === 1) return min === 1 ? Logic.exactlyOne(terms) : Logic.atMostOne(terms)
  const sum = Logic.sum(terms)
  return Logic.and(
    min > 0 ? [Logic.greaterThanOrEqual(sum, Logic.constantBits(min))] : [],
    max < count ? [Logic.lessThanOrEqual(sum, Logic.constantBits(max))] : []
  )
}
```

- [ ] **Passo 12: Typecheck e lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 13: Conferir a resolução sobre o exemplo**

Crie `.checks/resolution-check.mts`:

```ts
// Resolução de configurações sobre docs/examples/loja-online (plano da Fase 3, Tarefa 1).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/resolution-check.mts
import { readFileSync } from 'node:fs'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import type { Configuration } from '@/domain/configuration/configuration'
import { configurationStatus, type Resolution } from '@/domain/configuration/resolution'
import type { Feature, FeatureModel } from '@/domain/feature-model/feature-model'
import { parseExpression } from '@/domain/expression/parser'
import { deleteFeature } from '@/domain/project/feature-deletion'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'

const read = (path: string) =>
  parseXmlRoot(readFileSync(`docs/examples/loja-online/${path}`, 'utf8'))
const decodedModel = decodeFeatureModel(read('model.xml'))
const decodedConfiguration = decodeConfiguration(read('configurations/loja-basica.xml'))
if (!decodedModel.ok || !decodedConfiguration.ok) throw new Error('o exemplo não abriu')
const model = decodedModel.value
const basica = decodedConfiguration.value
const log = (label: string, value: unknown): void => console.log(label.padEnd(30), '→', value)

const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const mark = { selected: '+', deselected: '-' }
const show = (resolution: Resolution): string => {
  const status = configurationStatus(resolution)
  const head = `${resolution.kind} | válida ${status.valid} | completa ${status.complete} | desatualizada ${status.stale}`
  if (resolution.kind !== 'resolved') return head
  const features = [...resolution.features]
    .map(([id, s]) =>
      s.kind === 'undecided'
        ? `${id}?`
        : `${id}${mark[s.state]}${s.kind === 'propagated' ? '🔒' : ''}`
    )
    .join(' ')
  return `${head} | indecisas ${status.undecidedCount} | sem valor ${status.missingValueCount}\n${' '.repeat(33)}${features}`
}
const withDecisions = (c: Configuration, decisions: Configuration['decisions']): Configuration => ({
  ...c,
  decisions
})

// 1. loja-basica abre completa, com mobile selecionada por propagação
const r1 = resolver.execute(model, basica)
log('loja-basica', show(r1))
log('mesma resolução no cache', resolver.execute(model, basica) === r1)

// 2. sem a decisão de pag_pix, mobile fica indecisa
const semPix = withDecisions(
  basica,
  basica.decisions.filter((d) => d.featureId !== 'pag_pix')
)
log('sem a decisão de pag_pix', show(resolver.execute(model, semPix)))

// 3. excluir pag_pix no modelo: a configuração fica desatualizada, com a referência órfã
const deleted = deleteFeature(model, { assets: [] }, 'pag_pix')
if (!deleted.ok) throw new Error(deleted.error)
const r3 = resolver.execute(deleted.value.model, basica)
log('pag_pix excluída do modelo', show(r3))
log(
  'órfãs',
  r3.orphans
    .map((o) => (o.kind === 'decision' ? `decisão ${o.decision.featureId}` : o.reason))
    .join(', ')
)

// 4. conflito: pag_pix selecionada e mobile desselecionada
const conflito = withDecisions(basica, [
  ...basica.decisions,
  { featureId: 'mobile', state: 'deselected' }
])
const r4 = resolver.execute(model, conflito)
log('pag_pix + não mobile', show(r4))
log(
  'decisões para remover',
  r4.kind === 'conflict' ? r4.decisions.map((d) => `${d.featureId}:${d.state}`).join(' ') : '-'
)

// 5. modelo vazio: uma restrição que nenhum produto satisfaz
const expression = parseExpression('not catalogo')
if (!expression.ok) throw new Error('expressão')
const vazio: FeatureModel = {
  ...model,
  constraints: [...model.constraints, { id: 'c2', expression: expression.value }]
}
log('modelo vazio', show(resolver.execute(vazio, basica)))

// 6. valores de atributos: inválido, e atributo sem valor nem default
const valores: Configuration = {
  ...basica,
  values: [
    { featureId: 'busca', attributeId: 'max_resultados', value: 'abc' },
    { featureId: 'loja', attributeId: 'versao', value: '2.0' }
  ]
}
const r6 = resolver.execute(model, valores)
log('valores', show(r6))
log(
  'inválidos',
  r6.invalidValues
    .map((i) => `${i.value.featureId}.${i.value.attributeId}: ${i.message}`)
    .join('; ')
)
log(
  'órfãs (atributo fixo)',
  r6.orphans
    .map((o) =>
      o.kind === 'value' ? `${o.value.featureId}.${o.value.attributeId} ${o.reason}` : ''
    )
    .join('; ')
)
log(
  'sem valor',
  r6.kind === 'resolved'
    ? r6.missingValues.map((m) => `${m.featureId}.${m.attributeId}`).join(' ')
    : '-'
)

// 7. grupo [2..2]: escolher uma deixa as outras decididas
const pagamento = model.root.children[3]
if (pagamento.kind !== 'feature' || pagamento.feature.children[0].kind !== 'group')
  throw new Error('forma')
const group = pagamento.feature.children[0].group
const dois: FeatureModel = {
  ...model,
  constraints: [],
  root: {
    ...model.root,
    children: model.root.children.map((child, index) =>
      index === 3 && child.kind === 'feature'
        ? {
            kind: 'feature',
            feature: {
              ...child.feature,
              children: [{ kind: 'group', group: { ...group, min: 2, max: 2 } }]
            }
          }
        : child
    )
  }
}
const r7 = resolver.execute(dois, {
  name: 'x',
  decisions: [{ featureId: 'pag_boleto', state: 'deselected' }],
  values: []
})
log('grupo [2..2] sem boleto', show(r7))

// 8. desempenho: modelo sintético de 321 features
let next = 0
const leaf = (): Feature => ({ id: `f${next++}`, name: 'F', attributes: [], children: [] })
const branch = (children: Feature[], variability?: 'mandatory' | 'optional'): Feature => ({
  ...leaf(),
  ...(variability ? { variability } : {}),
  children: children.map((feature) => ({ kind: 'feature', feature }))
})
const optional = (feature: Feature): Feature => ({ ...feature, variability: 'optional' })
const areas = Array.from({ length: 10 }, () => {
  const members = Array.from({ length: 5 }, () => ({
    ...leaf(),
    children: Array.from({ length: 4 }, () => ({
      kind: 'feature' as const,
      feature: optional(leaf())
    }))
  }))
  const extras = Array.from({ length: 2 }, () =>
    optional(branch([optional(leaf()), optional(leaf())]))
  )
  return {
    ...leaf(),
    variability: 'mandatory' as const,
    children: [
      { kind: 'group' as const, group: { min: 1, max: 2, members } },
      ...extras.map((feature) => ({ kind: 'feature' as const, feature }))
    ]
  }
})
const big: FeatureModel = {
  name: 'Grande',
  root: {
    id: 'raiz',
    name: 'Raiz',
    attributes: [],
    children: areas.map((feature) => ({ kind: 'feature', feature }))
  },
  constraints: []
}
const decisions = ['f1', 'f7', 'f40', 'f80', 'f120', 'f200', 'f250', 'f300'].map((featureId) => ({
  featureId,
  state: 'selected' as const
}))
const bigResolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const times: number[] = []
for (let i = 0; i < 5; i++) {
  const started = performance.now()
  bigResolver.execute(big, { name: `x${i}`, decisions, values: [] })
  times.push(performance.now() - started)
}
const bigResolution = bigResolver.execute(big, { name: 'x0', decisions, values: [] })
const bigStatus = configurationStatus(bigResolution)
log(
  'modelo grande',
  `${bigResolution.kind === 'resolved' ? bigResolution.features.size : 0} features | indecisas ${bigStatus.undecidedCount}`
)
log('tempo por resolução (ms)', times.map((t) => Math.round(t)).join(' '))
```

Rode:

```bash
npx tsx --tsconfig tsconfig.web.json .checks/resolution-check.mts
```

Esperado, exatamente, menos os números da última linha, que variam de máquina para máquina (cada um deve ficar abaixo de 200 ms):

```
loja-basica                    → resolved | válida true | completa true | desatualizada false | indecisas 0 | sem valor 0
                                 loja+🔒 catalogo+🔒 busca+ mobile+🔒 pagamento+🔒 pag_cartao+ pag_pix+ pag_boleto-
mesma resolução no cache       → true
sem a decisão de pag_pix       → resolved | válida true | completa false | desatualizada false | indecisas 2 | sem valor 0
                                 loja+🔒 catalogo+🔒 busca+ mobile? pagamento+🔒 pag_cartao+ pag_pix? pag_boleto-
pag_pix excluída do modelo     → resolved | válida true | completa false | desatualizada true | indecisas 1 | sem valor 0
                                 loja+🔒 catalogo+🔒 busca+ mobile? pagamento+🔒 pag_cartao+ pag_boleto-
órfãs                          → decisão pag_pix
pag_pix + não mobile           → conflict | válida false | completa false | desatualizada true
decisões para remover          → busca:selected pag_cartao:selected pag_pix:selected pag_boleto:deselected mobile:deselected
modelo vazio                   → empty-model | válida false | completa false | desatualizada false
valores                        → resolved | válida true | completa false | desatualizada true | indecisas 0 | sem valor 2
                                 loja+🔒 catalogo+🔒 busca+ mobile+🔒 pagamento+🔒 pag_cartao+ pag_pix+ pag_boleto-
inválidos                      → busca.max_resultados: "abc" não é um número
órfãs (atributo fixo)          → loja.versao fixed
sem valor                      → busca.max_resultados mobile.plataforma
grupo [2..2] sem boleto        → resolved | válida true | completa false | desatualizada false | indecisas 2 | sem valor 0
                                 loja+🔒 catalogo+🔒 busca? mobile? pagamento+🔒 pag_cartao+🔒 pag_pix+🔒 pag_boleto-
modelo grande                  → 321 features | indecisas 279
tempo por resolução (ms)       → (cinco números, cada um abaixo de 200)
```

As três primeiras resoluções são a aceitação da fase no domínio:

- `loja-basica` completa, com `mobile` propagada;
- sem a decisão de `pag_pix`, `mobile` e `pag_pix` indecisas;
- com `pag_pix` excluída do modelo, a referência órfã.

- [ ] **Passo 14: Commit**

```bash
npm run format
git add package.json package-lock.json src/renderer/src/domain src/renderer/src/application src/renderer/src/infrastructure/solver
git commit -m "feat(configuration): fórmula do modelo, solver SAT e resolução de configurações

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: Edição e lista de configurações, e exclusão ao salvar

**Arquivos:**

- Criar: `src/renderer/src/domain/configuration/configuration-edits.ts`, `src/renderer/src/domain/project/configuration-entries.ts`
- Modificar: `src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/ipc/file-handlers.ts`
- Modificar: `src/renderer/src/application/ports/project-storage.ts`, `src/renderer/src/application/ports/repositories.ts`
- Modificar: `src/renderer/src/infrastructure/electron/electron-project-storage.ts`, `src/renderer/src/infrastructure/xml/xml-document-file.ts`, `src/renderer/src/infrastructure/xml/xml-repositories.ts`
- Substituir: `src/renderer/src/application/use-cases/save-project.ts`
- Verificação: `.checks/configurations-check.mts`

**Interfaces:**

- Consome: da Tarefa 1, `featuresById`, `configurableAttribute` e `withoutOrphanReferences` (`domain/configuration/references.ts`); `ConfigurationEntry` (`domain/project/project.ts`); `Result`, `ok`, `err` (`domain/shared/result.ts`).
- Produz:
  - `nextDecisionState(current)`, `decisionOf(configuration, featureId)`, `withDecision(model, configuration, featureId, state | undefined): Configuration`, `withAttributeValue(model, configuration, featureId, attributeId, value): Result<Configuration, string>`, `withoutAttributeValue(configuration, featureId, attributeId): Configuration` (`domain/configuration/configuration-edits.ts`)
  - `EntryChange` (`{ entries, key }`), `configurationKey(name, taken)`, `addConfiguration(entries, name)`, `duplicateConfiguration(entries, key, name)`, `renameConfiguration(entries, key, name)` (as três devolvem `Result<EntryChange, string>`), `removeConfiguration(entries, key)`, `replaceConfiguration(entries, key, configuration)` (`domain/project/configuration-entries.ts`)
  - `window.mdd.remove(relativePath, precondition: RemovePrecondition): Promise<IpcResult<null>>`
  - `ProjectStorage.remove(path, precondition): Promise<Result<null, StorageError>>` e o tipo `RemovePrecondition` (`{ kind: 'hash'; expectedHash } | { kind: 'overwrite' }`)
  - `ConfigurationRepository.remove(key, expectedHash: string | 'any'): Promise<RemoveResult>` e o tipo `RemoveResult = Result<null, SaveFailure>`
  - `SaveProject.execute` passa a excluir os arquivos das chaves que estão em `hashes.configurations` e não estão mais na lista.

- [ ] **Passo 1: Criar `src/renderer/src/domain/configuration/configuration-edits.ts`**

```ts
import { checkAttributeValue } from '../feature-model/attribute-value'
import type { FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import { err, ok, type Result } from '../shared/result'
import type { AttributeValue, Configuration, DecisionState, ManualDecision } from './configuration'
import { configurableAttribute, featuresById } from './references'

/*
 * Edições de uma configuração (SPEC §4.2). Uma decisão ou um valor novo entra na ordem
 * do modelo, e não no fim: assim o arquivo não depende da ordem dos cliques. Uma edição
 * que não muda nada devolve a mesma configuração, e a tela não mostra alteração pendente.
 */

/** O clique no modo configuração (SPEC §7): indecisa → selecionada → desselecionada → indecisa. */
export function nextDecisionState(current: DecisionState | undefined): DecisionState | undefined {
  if (current === undefined) return 'selected'
  return current === 'selected' ? 'deselected' : undefined
}

export function decisionOf(
  configuration: Configuration,
  featureId: string
): DecisionState | undefined {
  return configuration.decisions.find((decision) => decision.featureId === featureId)?.state
}

/** Troca a decisão manual sobre a feature; `undefined` remove a decisão. */
export function withDecision(
  model: FeatureModel,
  configuration: Configuration,
  featureId: string,
  state: DecisionState | undefined
): Configuration {
  const current = decisionOf(configuration, featureId)
  if (current === state) return configuration
  if (state === undefined) {
    return {
      ...configuration,
      decisions: configuration.decisions.filter((decision) => decision.featureId !== featureId)
    }
  }
  if (current !== undefined) {
    return {
      ...configuration,
      decisions: configuration.decisions.map((decision) =>
        decision.featureId === featureId ? { featureId, state } : decision
      )
    }
  }
  const rank = featureRanks(model)
  return {
    ...configuration,
    decisions: insertInOrder<ManualDecision>(
      configuration.decisions,
      { featureId, state },
      (a, b) => rank(a.featureId) - rank(b.featureId)
    )
  }
}

/**
 * Grava o valor de um atributo configurável, conferido pelo tipo. Texto vazio tira o valor,
 * e aí vale o `default` do modelo, se houver.
 */
export function withAttributeValue(
  model: FeatureModel,
  configuration: Configuration,
  featureId: string,
  attributeId: string,
  value: string
): Result<Configuration, string> {
  const features = featuresById(model)
  const attribute = configurableAttribute(features.get(featureId), attributeId)
  if (attribute === undefined) {
    return err(`"${featureId}" não tem o atributo configurável "${attributeId}".`)
  }
  if (value === '') return ok(withoutAttributeValue(configuration, featureId, attributeId))
  const problem = checkAttributeValue(attribute, value)
  if (problem !== null) return err(problem)

  const entry: AttributeValue = { featureId, attributeId, value }
  const index = configuration.values.findIndex(
    (existing) => existing.featureId === featureId && existing.attributeId === attributeId
  )
  if (index >= 0) {
    if (configuration.values[index].value === value) return ok(configuration)
    return ok({ ...configuration, values: configuration.values.with(index, entry) })
  }
  const rank = featureRanks(model)
  const attributeRank = (other: AttributeValue): number =>
    features
      .get(other.featureId)
      ?.attributes.findIndex((candidate) => candidate.id === other.attributeId) ?? 0
  return ok({
    ...configuration,
    values: insertInOrder(
      configuration.values,
      entry,
      (a, b) => rank(a.featureId) - rank(b.featureId) || attributeRank(a) - attributeRank(b)
    )
  })
}

export function withoutAttributeValue(
  configuration: Configuration,
  featureId: string,
  attributeId: string
): Configuration {
  const values = configuration.values.filter(
    (value) => value.featureId !== featureId || value.attributeId !== attributeId
  )
  return values.length === configuration.values.length
    ? configuration
    : { ...configuration, values }
}

/** Posição da feature na pré-ordem do modelo; as que não existem mais vão para o fim. */
function featureRanks(model: FeatureModel): (featureId: string) => number {
  const ranks = new Map(featuresInPreOrder(model.root).map((feature, index) => [feature.id, index]))
  return (featureId) => ranks.get(featureId) ?? Number.MAX_SAFE_INTEGER
}

/** Põe o item antes do primeiro que deve vir depois dele. */
function insertInOrder<T>(
  items: readonly T[],
  item: T,
  compare: (a: T, b: T) => number
): readonly T[] {
  const index = items.findIndex((other) => compare(item, other) < 0)
  return index < 0 ? [...items, item] : [...items.slice(0, index), item, ...items.slice(index)]
}
```

- [ ] **Passo 2: Criar `src/renderer/src/domain/project/configuration-entries.ts`**

```ts
import type { Configuration } from '../configuration/configuration'
import { err, ok, type Result } from '../shared/result'
import type { ConfigurationEntry } from './project'

/*
 * A lista de configurações do projeto. A chave é o nome do arquivo sem `.xml` e sai sempre
 * do nome de exibição (SPEC §3): renomear a configuração troca a chave, e o arquivo é
 * renomeado ao salvar. A lista fica em ordem de chave, como a pasta no disco.
 */

export interface EntryChange {
  readonly entries: readonly ConfigurationEntry[]
  /** A chave da configuração criada ou renomeada. */
  readonly key: string
}

const FALLBACK_KEY = 'configuracao'

/**
 * Chave a partir do nome: sem acentos, minúsculas, cada trecho que não for letra ou dígito
 * vira "-", e um sufixo -2, -3… evita colisões. Ex.: "Loja Básica" → "loja-basica".
 */
export function configurationKey(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || FALLBACK_KEY
  if (!taken.has(base)) return base
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}-${suffix}`
    if (!taken.has(candidate)) return candidate
  }
}

export function addConfiguration(
  entries: readonly ConfigurationEntry[],
  name: string
): Result<EntryChange, string> {
  const trimmed = name.trim()
  if (trimmed === '') return err('Informe o nome.')
  return ok(insert(entries, { name: trimmed, decisions: [], values: [] }))
}

/** Uma cópia com as mesmas decisões e valores, com outro nome. */
export function duplicateConfiguration(
  entries: readonly ConfigurationEntry[],
  key: string,
  name: string
): Result<EntryChange, string> {
  const source = entries.find((entry) => entry.key === key)
  if (source === undefined) return err(`A configuração "${key}" não existe.`)
  const trimmed = name.trim()
  if (trimmed === '') return err('Informe o nome.')
  return ok(insert(entries, { ...source.configuration, name: trimmed }))
}

export function renameConfiguration(
  entries: readonly ConfigurationEntry[],
  key: string,
  name: string
): Result<EntryChange, string> {
  const source = entries.find((entry) => entry.key === key)
  if (source === undefined) return err(`A configuração "${key}" não existe.`)
  const trimmed = name.trim()
  if (trimmed === '') return err('Informe o nome.')
  if (trimmed === source.configuration.name) return ok({ entries, key })
  const others = entries.filter((entry) => entry.key !== key)
  return ok(insert(others, { ...source.configuration, name: trimmed }))
}

export function removeConfiguration(
  entries: readonly ConfigurationEntry[],
  key: string
): readonly ConfigurationEntry[] {
  return entries.filter((entry) => entry.key !== key)
}

/** Troca o conteúdo da configuração `key`; a mesma lista volta se nada mudou. */
export function replaceConfiguration(
  entries: readonly ConfigurationEntry[],
  key: string,
  configuration: Configuration
): readonly ConfigurationEntry[] {
  const index = entries.findIndex((entry) => entry.key === key)
  if (index < 0 || entries[index].configuration === configuration) return entries
  return entries.with(index, { key, configuration })
}

function insert(entries: readonly ConfigurationEntry[], configuration: Configuration): EntryChange {
  const key = configurationKey(configuration.name, new Set(entries.map((entry) => entry.key)))
  return {
    entries: [...entries, { key, configuration }].sort((a, b) => a.key.localeCompare(b.key)),
    key
  }
}
```

- [ ] **Passo 3: Canal `remove` no contrato do IPC (`src/shared/ipc.ts`)**

Depois do tipo `WritePrecondition`, acrescente:

```ts
/** Excluir só se o arquivo ainda estiver com este hash, ou excluir de qualquer jeito. */
export type RemovePrecondition = { kind: 'hash'; expectedHash: string } | { kind: 'overwrite' }
```

Em `MddApi`, logo depois de `writeText(...)`, acrescente:

```ts
  /** Exclui o arquivo. Um arquivo que já não existe conta como excluído. */
  remove(relativePath: string, precondition: RemovePrecondition): Promise<IpcResult<null>>
```

Em `IpcChannel`, depois de `writeText: 'mdd:write-text',`, acrescente:

```ts
  remove: 'mdd:remove',
```

- [ ] **Passo 4: Preload (`src/preload/index.ts`)**

Depois da entrada `writeText`, acrescente:

```ts
  remove: (relativePath, precondition) =>
    ipcRenderer.invoke(IpcChannel.remove, relativePath, precondition),
```

- [ ] **Passo 5: Processo main (`src/main/ipc/file-handlers.ts`)**

Troque o import de `fs/promises` por:

```ts
import { mkdir, readdir, readFile, unlink, writeFile } from 'fs/promises'
```

No import de `../../shared/ipc`, acrescente `type RemovePrecondition,` entre `type IpcResult,` e `type TextFile,`.

No fim de `registerFileHandlers`, depois do handler de `IpcChannel.writeText`, acrescente:

```ts
ipcMain.handle(
  IpcChannel.remove,
  (_event, relativePath: string, precondition: RemovePrecondition) =>
    withinProject<null>(root, relativePath, async (path) => {
      const current = await readIfExists(path)
      if (current === null) return ok(null)
      if (precondition.kind === 'hash' && sha256(current) !== precondition.expectedHash) {
        return fail('changed-externally', `"${relativePath}" foi alterado fora do app.`)
      }
      await unlink(path)
      return ok(null)
    })
)
```

O `withinProject` já recusa caminhos fora da pasta do projeto, como nos outros canais.

- [ ] **Passo 6: Portas (`application/ports`)**

Em `src/renderer/src/application/ports/project-storage.ts`, depois do tipo `WritePrecondition`, acrescente:

```ts
export type RemovePrecondition =
  { readonly kind: 'hash'; readonly expectedHash: string } | { readonly kind: 'overwrite' }
```

e, na interface `ProjectStorage`, depois de `list(...)`:

```ts
  /** Exclui o arquivo; um arquivo que já não existe conta como excluído. */
  remove(path: string, precondition: RemovePrecondition): Promise<Result<null, StorageError>>
```

Em `src/renderer/src/application/ports/repositories.ts`, depois de `export type SaveResult = …`, acrescente:

```ts
export type RemoveResult = Result<null, SaveFailure>
```

e, na interface `ConfigurationRepository`, depois de `save(...)`:

```ts
  /** Exclui o arquivo se ele ainda estiver com o hash (ou sempre, com `'any'`). */
  remove(key: string, expectedHash: string | 'any'): Promise<RemoveResult>
```

- [ ] **Passo 7: Adapters**

Em `src/renderer/src/infrastructure/electron/electron-project-storage.ts`, acrescente `RemovePrecondition,` ao import de `@/application/ports/project-storage` (depois de `ProjectStorage,`) e, no fim da classe:

```ts

  remove(path: string, precondition: RemovePrecondition): Promise<Result<null, StorageError>> {
    return window.mdd.remove(path, precondition)
  }
```

Em `src/renderer/src/infrastructure/xml/xml-document-file.ts`, troque o import de `@/application/ports/repositories` por:

```ts
import type {
  ExpectedHash,
  LoadedFile,
  RemoveResult,
  SaveResult
} from '@/application/ports/repositories'
```

e, antes de `private storageProblem(...)`, acrescente:

```ts
  async remove(expectedHash: string | 'any'): Promise<RemoveResult> {
    const removed = await this.storage.remove(
      this.path,
      expectedHash === 'any' ? { kind: 'overwrite' } : { kind: 'hash', expectedHash }
    )
    if (removed.ok) return removed
    if (removed.error.code === 'changed-externally') {
      return err({ kind: 'conflict', file: this.path })
    }
    return err({ kind: 'error', problem: this.storageProblem(removed.error) })
  }

```

Em `src/renderer/src/infrastructure/xml/xml-repositories.ts`, acrescente `RemoveResult,` ao import de `@/application/ports/repositories` (antes de `SaveResult`) e, em `XmlConfigurationRepository`, depois de `save(...)`:

```ts

  remove(key: string, expectedHash: string | 'any'): Promise<RemoveResult> {
    return this.fileFor(key).remove(expectedHash)
  }
```

- [ ] **Passo 8: Substituir o conteúdo de `src/renderer/src/application/use-cases/save-project.ts`**

Muda o `collect`, que passa a aceitar qualquer `Result<T, SaveFailure>`, e entra o laço que exclui os arquivos no fim:

```ts
import type { Result } from '@/domain/shared/result'
import type { FileProblem } from '../file-problem'
import type {
  AssetCatalogRepository,
  ConfigurationRepository,
  ExpectedHash,
  FeatureModelRepository,
  SaveFailure
} from '../ports/repositories'
import type { ProjectSession } from '../project-session'

export interface SaveProjectResult {
  /** Sessão com os hashes atualizados dos arquivos que foram gravados. */
  readonly session: ProjectSession
  /** Arquivos alterados fora do app, que não foram gravados nem excluídos (SPEC §8). */
  readonly conflicts: string[]
  /** Outros erros de gravação. */
  readonly problems: FileProblem[]
}

export interface SaveProjectDependencies {
  readonly models: FeatureModelRepository
  readonly assets: AssetCatalogRepository
  readonly configurations: ConfigurationRepository
}

export interface SaveOptions {
  /** Grava mesmo que o arquivo tenha mudado fora do app ("Sobrescrever"). */
  readonly overwrite: boolean
}

/**
 * Grava todos os arquivos do projeto e exclui os das configurações que saíram da lista
 * (excluídas ou renomeadas). Cada arquivo só é gravado ou excluído se ainda estiver como
 * na última leitura, a não ser com `overwrite`; os demais seguem normalmente.
 */
export class SaveProject {
  private readonly deps: SaveProjectDependencies

  constructor(deps: SaveProjectDependencies) {
    this.deps = deps
  }

  async execute(
    session: ProjectSession,
    options: SaveOptions = { overwrite: false }
  ): Promise<SaveProjectResult> {
    const { project, hashes } = session
    const conflicts: string[] = []
    const problems: FileProblem[] = []
    const expect = (hash: ExpectedHash): ExpectedHash => (options.overwrite ? 'any' : hash)
    const collect = <T>(result: Result<T, SaveFailure>): T | undefined => {
      if (result.ok) return result.value
      if (result.error.kind === 'conflict') conflicts.push(result.error.file)
      else problems.push(result.error.problem)
      return undefined
    }

    const modelHash = collect(await this.deps.models.save(project.model, expect(hashes.model)))

    let assetsHash = hashes.assets
    if (hashes.assets !== null || project.assets.assets.length > 0) {
      assetsHash =
        collect(await this.deps.assets.save(project.assets, expect(hashes.assets))) ?? hashes.assets
    }

    const configurationHashes: Record<string, string> = { ...hashes.configurations }
    for (const { key, configuration } of project.configurations) {
      const saved = await this.deps.configurations.save(
        key,
        configuration,
        expect(hashes.configurations[key] ?? null)
      )
      const hash = collect(saved)
      if (hash !== undefined) configurationHashes[key] = hash
    }

    // Só depois de gravar as novas: um arquivo renomeado nunca some antes de o novo existir.
    const kept = new Set(project.configurations.map((entry) => entry.key))
    for (const [key, hash] of Object.entries(hashes.configurations)) {
      if (kept.has(key)) continue
      const removed = await this.deps.configurations.remove(key, options.overwrite ? 'any' : hash)
      if (collect(removed) !== undefined) delete configurationHashes[key]
    }

    return {
      conflicts,
      problems,
      session: {
        ...session,
        hashes: {
          model: modelHash ?? hashes.model,
          assets: assetsHash,
          configurations: configurationHashes
        }
      }
    }
  }
}
```

- [ ] **Passo 9: Typecheck e lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 10: Conferir as edições, a lista e a gravação**

O roteiro grava num armazenamento em memória com as mesmas pré-condições do processo main. Crie `.checks/configurations-check.mts`:

```ts
// Edição e lista de configurações, e a gravação com exclusão (plano da Fase 3, Tarefa 2).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/configurations-check.mts
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { ProjectStorage, StorageError } from '@/application/ports/project-storage'
import type { ProjectSession } from '@/application/project-session'
import { SaveProject } from '@/application/use-cases/save-project'
import {
  decisionOf,
  nextDecisionState,
  withAttributeValue,
  withDecision
} from '@/domain/configuration/configuration-edits'
import { withoutOrphanReferences } from '@/domain/configuration/references'
import {
  addConfiguration,
  configurationKey,
  duplicateConfiguration,
  removeConfiguration,
  renameConfiguration
} from '@/domain/project/configuration-entries'
import { deleteFeature } from '@/domain/project/feature-deletion'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeConfiguration, encodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'

const example = (path: string): string => readFileSync(`docs/examples/loja-online/${path}`, 'utf8')
const decodedModel = decodeFeatureModel(parseXmlRoot(example('model.xml')))
const decodedConfiguration = decodeConfiguration(
  parseXmlRoot(example('configurations/loja-basica.xml'))
)
if (!decodedModel.ok || !decodedConfiguration.ok) throw new Error('o exemplo não abriu')
const model = decodedModel.value
const basica = decodedConfiguration.value
const original = example('configurations/loja-basica.xml')
const log = (label: string, value: unknown): void => console.log(label.padEnd(34), '→', value)

// 1. O clique: indecisa → selecionada → desselecionada → indecisa
const cycle: string[] = []
let state: 'selected' | 'deselected' | undefined = undefined
for (let i = 0; i < 4; i++) {
  cycle.push(state ?? 'indecisa')
  state = nextDecisionState(state)
}
log('ciclo do clique', cycle.join(' → '))

// 2. Tirar e devolver a decisão de pag_pix volta ao arquivo idêntico (ordem do modelo)
let c = basica
c = withDecision(model, c, 'pag_pix', nextDecisionState(decisionOf(c, 'pag_pix')))
log('pag_pix depois de 1 clique', decisionOf(c, 'pag_pix'))
c = withDecision(model, c, 'pag_pix', nextDecisionState(decisionOf(c, 'pag_pix')))
log('pag_pix depois de 2 cliques', decisionOf(c, 'pag_pix') ?? 'indecisa')
c = withDecision(model, c, 'pag_pix', nextDecisionState(decisionOf(c, 'pag_pix')))
log('3º clique: arquivo idêntico', encodeConfiguration(c) === original)
log('decisão igual, mesmo objeto', withDecision(model, basica, 'busca', 'selected') === basica)

// 3. Valores: conferidos pelo tipo, vazio remove, novo entra na ordem do modelo
const semValores = { ...basica, values: [] }
const v1 = withAttributeValue(model, semValores, 'mobile', 'plataforma', 'android')
const v2 = v1.ok ? withAttributeValue(model, v1.value, 'busca', 'max_resultados', '100') : v1
log('valores na ordem do modelo', v2.ok && encodeConfiguration(v2.value) === original)
const invalid = withAttributeValue(model, basica, 'busca', 'max_resultados', '5')
log('valor fora da faixa', invalid.ok ? 'aceito' : invalid.error)
const fixed = withAttributeValue(model, basica, 'loja', 'versao', '2.0')
log('atributo fixo', fixed.ok ? 'aceito' : fixed.error)
const cleared = withAttributeValue(model, basica, 'busca', 'max_resultados', '')
log('vazio remove o valor', cleared.ok && cleared.value.values.map((v) => v.featureId).join(' '))

// 4. Remover referências órfãs depois de excluir pag_pix do modelo
const deleted = deleteFeature(model, { assets: [] }, 'pag_pix')
if (!deleted.ok) throw new Error(deleted.error)
log(
  'sem as órfãs',
  withoutOrphanReferences(deleted.value.model, basica)
    .decisions.map((d) => d.featureId)
    .join(' ')
)

// 5. Chaves e lista
log('chave de "Loja Básica"', configurationKey('Loja Básica', new Set()))
log('chave com colisão', configurationKey('Loja Básica', new Set(['loja-basica'])))
log('chave de "  ***  "', configurationKey('  ***  ', new Set()))
const entries = [{ key: 'loja-basica', configuration: basica }]
const added = addConfiguration(entries, 'Loja Completa')
const dup = added.ok
  ? duplicateConfiguration(added.value.entries, 'loja-basica', 'Loja Básica')
  : added
log(
  'criar e duplicar',
  dup.ok && dup.value.entries.map((e) => `${e.key}:${e.configuration.decisions.length}`).join(' ')
)
const renamed = renameConfiguration(entries, 'loja-basica', 'Loja Econômica')
log(
  'renomear troca a chave',
  renamed.ok && `${renamed.value.key} ${renamed.value.entries[0].configuration.name}`
)
const same = renameConfiguration(entries, 'loja-basica', 'Loja Básica')
log('mesmo nome devolve a mesma lista', same.ok && same.value.entries === entries)
log('nome vazio', addConfiguration(entries, '  ').ok)

// 6. Gravar: renomear cria o arquivo novo e exclui o antigo; conflito na exclusão
const files = new Map<string, string>([
  ['model.xml', example('model.xml')],
  ['configurations/loja-basica.xml', original],
  ['configurations/loja-velha.xml', original]
])
const hash = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex')
const missing = (path: string): StorageError => ({
  code: 'not-found',
  message: `${path} não existe`
})
const changed = (path: string): StorageError => ({ code: 'changed-externally', message: path })
const storage: ProjectStorage = {
  async readText(path) {
    const content = files.get(path)
    return content === undefined ? err(missing(path)) : ok({ content, hash: hash(content) })
  },
  async writeText(path, content, precondition) {
    const current = files.get(path)
    const violated =
      (precondition.kind === 'must-not-exist' && current !== undefined) ||
      (precondition.kind === 'hash' &&
        (current === undefined || hash(current) !== precondition.expectedHash))
    if (violated) return err(changed(path))
    files.set(path, content)
    return ok(hash(content))
  },
  async list() {
    return ok([])
  },
  async remove(path, precondition): Promise<Result<null, StorageError>> {
    const current = files.get(path)
    if (current === undefined) return ok(null)
    if (precondition.kind === 'hash' && hash(current) !== precondition.expectedHash) {
      return err(changed(path))
    }
    files.delete(path)
    return ok(null)
  }
}
const validator = { validate: async () => [] }
const save = new SaveProject({
  models: new XmlFeatureModelRepository(storage, validator),
  assets: new XmlAssetCatalogRepository(storage, validator),
  configurations: new XmlConfigurationRepository(storage, validator)
})
if (!renamed.ok) throw new Error('renomear')
const session: ProjectSession = {
  folder: { rootPath: 'memória', name: 'memória' },
  project: { model, assets: { assets: [] }, configurations: renamed.value.entries },
  hashes: {
    model: hash(example('model.xml')),
    assets: null,
    configurations: { 'loja-basica': hash(original), 'loja-velha': hash(original) }
  }
}
files.set('configurations/loja-velha.xml', original.replace('Loja Básica', 'Alterada fora'))
const first = await save.execute(session)
log('arquivos depois de salvar', [...files.keys()].filter((f) => f.startsWith('config')).join(' '))
log('conflitos', first.conflicts.join(' '))
log('hashes das configurações', Object.keys(first.session.hashes.configurations).join(' '))
const second = await save.execute(first.session, { overwrite: true })
log(
  'sobrescrever exclui o alterado',
  [...files.keys()].filter((f) => f.startsWith('config')).join(' ')
)
log('hashes depois', Object.keys(second.session.hashes.configurations).join(' '))
log('nome gravado', files.get('configurations/loja-economica.xml')?.match(/name="([^"]+)"/)?.[1])
log('removeConfiguration', removeConfiguration(entries, 'loja-basica').length)
```

Rode:

```bash
npx tsx --tsconfig tsconfig.web.json .checks/configurations-check.mts
```

Esperado, exatamente:

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

A parte da gravação mostra:

- renomear gravou `loja-economica.xml` e excluiu `loja-basica.xml`;
- `loja-velha.xml`, alterado fora do app, virou conflito e ficou no disco;
- com "Sobrescrever" (`overwrite`), ele foi excluído.

- [ ] **Passo 11: Commit**

```bash
npm run format
git add src/shared src/preload src/main src/renderer/src/domain src/renderer/src/application src/renderer/src/infrastructure
git commit -m "feat(configuration): edição e lista de configurações, com exclusão do arquivo ao salvar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Store do configurador

**Arquivos:**

- Substituir: `src/renderer/src/ui/stores/project-store.ts`
- Modificar: `src/renderer/src/ui/app/composition-root.ts`
- Verificação: `.checks/configurator-store-check.mts`

**Interfaces:**

- Consome: das Tarefas 1 e 2, `ResolveConfiguration`, `Resolution`, as edições (`nextDecisionState`, `withDecision`, `withAttributeValue`, `withoutAttributeValue`, `withoutOrphanReferences`) e as operações da lista (`configuration-entries.ts`).
- Produz, em `ui/stores/project-store.ts`:
  - `ProjectStoreServices.resolveConfiguration: { execute(model, configuration): Resolution }`
  - `ProjectState.saved: Project | null` (era `EditorState`): o projeto como está no disco, com as configurações
  - `ProjectState.openConfigurationKey: string | null`
  - ações: `openConfiguration(key | null)`, `createConfiguration(name)`, `renameConfiguration(key, name)`, `duplicateConfiguration(key, name)` (as três devolvem `string | null`, o motivo da recusa), `deleteConfiguration(key)`, `toggleDecision(featureId)`, `removeDecision(featureId)`, `setAttributeValue(featureId, attributeId, value): string | null`, `removeAttributeValue(featureId, attributeId)`, `removeOrphanReferences()`, `openResolution(): Resolution | null`
  - `hasUnsavedChanges(state)` passa a comparar também a lista de configurações
  - `openConfigurationEntry(state): ConfigurationEntry | null`

O que muda em relação à 2B:

- o estado inicial (`CLOSED`) ganha `openConfigurationKey: null`;
- `opened` e `save` guardam `session.project` em `saved`;
- `reload` mantém aberta a configuração que ainda existe no disco;
- entram os auxiliares `setConfigurations`, `changeList`, `editOpen` e `resolve`, e as ações do configurador.

O resto do arquivo não muda.

- [ ] **Passo 1: Substituir o conteúdo de `src/renderer/src/ui/stores/project-store.ts`**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { EditorCommand, EditorState } from '@/application/editing/editor-command'
import {
  EMPTY_HISTORY,
  executeCommand,
  redo,
  undo,
  type EditHistory,
  type HistoryStep
} from '@/application/editing/edit-history'
import type { FileProblem } from '@/application/file-problem'
import type { RecentProject } from '@/application/ports/recent-projects'
import type { UnsavedChangesIndicator } from '@/application/ports/unsaved-changes-indicator'
import type { ProjectSession } from '@/application/project-session'
import type { CreateProjectResult } from '@/application/use-cases/create-project'
import type { OpenProjectResult } from '@/application/use-cases/open-project'
import type { SaveOptions, SaveProjectResult } from '@/application/use-cases/save-project'
import type { Configuration } from '@/domain/configuration/configuration'
import {
  nextDecisionState,
  withAttributeValue,
  withDecision,
  withoutAttributeValue
} from '@/domain/configuration/configuration-edits'
import { withoutOrphanReferences } from '@/domain/configuration/references'
import type { Resolution } from '@/domain/configuration/resolution'
import type { Feature, FeatureModel } from '@/domain/feature-model/feature-model'
import { findFeature, locateFeature } from '@/domain/feature-model/tree'
import * as entries from '@/domain/project/configuration-entries'
import type { ConfigurationEntry, Project } from '@/domain/project/project'
import type { Result } from '@/domain/shared/result'

/** Casos de uso e serviços de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices {
  readonly openProject: {
    execute(): Promise<OpenProjectResult>
    reopen(rootPath: string): Promise<OpenProjectResult>
  }
  readonly createProject: {
    execute(name: string, rootId?: string): Promise<CreateProjectResult>
  }
  readonly saveProject: {
    execute(session: ProjectSession, options?: SaveOptions): Promise<SaveProjectResult>
  }
  readonly resolveConfiguration: {
    execute(model: FeatureModel, configuration: Configuration): Resolution
  }
  readonly recentProjects: { list(): Promise<RecentProject[]> }
  readonly unsavedChanges: UnsavedChangesIndicator
}

export interface ProjectState {
  readonly session: ProjectSession | null
  /** O projeto como está no disco; comparar com a sessão diz se há alterações. */
  readonly saved: Project | null
  readonly history: EditHistory
  readonly selectedFeatureId: string | null
  /** Subárvores recolhidas no diagrama; valem só enquanto o projeto está aberto (ADR 0007). */
  readonly collapsedFeatureIds: ReadonlySet<string>
  /** Chave da configuração aberta no configurador. */
  readonly openConfigurationKey: string | null
  readonly busy: boolean
  /** Erros da última abertura ou gravação. */
  readonly problems: readonly FileProblem[]
  /** Avisos do projeto aberto; não impedem nada. */
  readonly warnings: readonly FileProblem[]
  /** Arquivos alterados fora do app na última gravação: a interface pergunta o que fazer. */
  readonly conflicts: readonly string[]
  /** Por que a última edição foi recusada. */
  readonly notice: string | null
  readonly recents: readonly RecentProject[]
  readonly lastSavedAt: Date | null

  loadRecents(): Promise<void>
  open(): Promise<void>
  openRecent(rootPath: string): Promise<void>
  create(name: string, rootId?: string): Promise<void>
  save(options?: SaveOptions): Promise<void>
  /** Relê o projeto do disco, descartando as alterações ("Recarregar", SPEC §8). */
  reload(): Promise<void>
  dismissConflicts(): void
  close(): void
  /** Executa uma edição; devolve `false` se ela foi recusada (o motivo fica em `notice`). */
  run(command: EditorCommand): boolean
  /** Simula a edição sem registrar nada: `null` se ela seria aceita, senão o motivo da recusa. */
  check(command: EditorCommand): string | null
  undo(): void
  redo(): void
  selectFeature(featureId: string): void
  /** Recolhe ou expande a subárvore da feature no diagrama. */
  toggleCollapsed(featureId: string): void
  dismissNotice(): void

  // Configurador (SPEC §7). Não entra no histórico de desfazer (SPEC §2).
  openConfiguration(key: string | null): void
  /** Cria e abre a configuração; devolve o motivo se o nome não serve. */
  createConfiguration(name: string): string | null
  renameConfiguration(key: string, name: string): string | null
  duplicateConfiguration(key: string, name: string): string | null
  /** Tira da lista; o arquivo é excluído ao salvar. */
  deleteConfiguration(key: string): void
  /** O clique no nó: indecisa → selecionada → desselecionada → indecisa. */
  toggleDecision(featureId: string): void
  removeDecision(featureId: string): void
  /** Texto vazio tira o valor; devolve o motivo se o valor não serve para o tipo. */
  setAttributeValue(featureId: string, attributeId: string, value: string): string | null
  removeAttributeValue(featureId: string, attributeId: string): void
  removeOrphanReferences(): void
  /** A resolução da configuração aberta; a mesma enquanto modelo e configuração não mudam. */
  openResolution(): Resolution | null
}

export type ProjectStore = StoreApi<ProjectState>

export function editorStateOf(session: ProjectSession): EditorState {
  return { model: session.project.model, assets: session.project.assets }
}

export function hasUnsavedChanges(state: ProjectState): boolean {
  if (state.session === null || state.saved === null) return false
  const { model, assets, configurations } = state.session.project
  return (
    model !== state.saved.model ||
    assets !== state.saved.assets ||
    configurations !== state.saved.configurations
  )
}

/** A configuração aberta no configurador, se houver. */
export function openConfigurationEntry(state: ProjectState): ConfigurationEntry | null {
  const key = state.openConfigurationKey
  if (state.session === null || key === null) return null
  return state.session.project.configurations.find((entry) => entry.key === key) ?? null
}

const NO_FEATURES: ReadonlySet<string> = new Set()

const CLOSED = {
  session: null,
  saved: null,
  history: EMPTY_HISTORY,
  selectedFeatureId: null,
  collapsedFeatureIds: NO_FEATURES,
  openConfigurationKey: null,
  problems: [],
  warnings: [],
  conflicts: [],
  notice: null,
  lastSavedAt: null
} satisfies Partial<ProjectState>

/** Estado de tela do editor. As regras ficam no domínio e nos casos de uso, não aqui. */
export function createProjectStore(services: ProjectStoreServices): ProjectStore {
  const store = createStore<ProjectState>()((set, get) => {
    const opened = (session: ProjectSession, warnings: readonly FileProblem[]): void => {
      set({
        ...CLOSED,
        busy: false,
        session,
        warnings,
        saved: session.project,
        selectedFeatureId: session.project.model.root.id
      })
      void get().loadRecents()
    }

    const handleOpen = (result: OpenProjectResult): void => {
      if (result.status === 'opened') opened(result.session, result.warnings)
      else set({ busy: false, problems: result.status === 'failed' ? result.problems : [] })
    }

    const applyStep = (step: HistoryStep): void => {
      const { session, selectedFeatureId, collapsedFeatureIds } = get()
      if (session === null) return
      const project = { ...session.project, ...step.state }
      const selected = nextSelection(selectedFeatureId, project.model, step.focusFeatureId)
      set({
        session: { ...session, project },
        history: step.history,
        notice: null,
        selectedFeatureId: selected,
        collapsedFeatureIds: revealed(collapsedFeatureIds, project.model, selected)
      })
    }

    const setConfigurations = (
      configurations: readonly ConfigurationEntry[],
      openKey = get().openConfigurationKey
    ): void => {
      const { session } = get()
      if (session === null) return
      set({
        session: { ...session, project: { ...session.project, configurations } },
        openConfigurationKey: openKey
      })
    }

    /** Aplica uma mudança da lista e abre a configuração que ela indicar. */
    const changeList = (change: Result<entries.EntryChange, string>): string | null => {
      if (!change.ok) return change.error
      setConfigurations(change.value.entries, change.value.key)
      return null
    }

    /** Troca o conteúdo da configuração aberta. */
    const editOpen = (
      edit: (model: FeatureModel, configuration: Configuration) => Configuration
    ): void => {
      const { session } = get()
      const entry = openConfigurationEntry(get())
      if (session === null || entry === null) return
      const configuration = edit(session.project.model, entry.configuration)
      setConfigurations(
        entries.replaceConfiguration(session.project.configurations, entry.key, configuration)
      )
    }

    const resolve = (configuration: Configuration): Resolution | null => {
      const { session } = get()
      if (session === null) return null
      return services.resolveConfiguration.execute(session.project.model, configuration)
    }

    return {
      ...CLOSED,
      busy: false,
      recents: [],

      async loadRecents() {
        set({ recents: await services.recentProjects.list() })
      },

      async open() {
        set({ busy: true, problems: [] })
        handleOpen(await services.openProject.execute())
      },

      async openRecent(rootPath) {
        set({ busy: true, problems: [] })
        handleOpen(await services.openProject.reopen(rootPath))
        void get().loadRecents()
      },

      async create(name, rootId) {
        set({ busy: true, problems: [] })
        const result = await services.createProject.execute(name, rootId)
        if (result.status === 'created') opened(result.session, [])
        else set({ busy: false, problems: result.status === 'failed' ? result.problems : [] })
      },

      async save(options) {
        const { session } = get()
        if (session === null) return
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
        handleOpen(await services.openProject.reopen(session.folder.rootPath))
        // A configuração aberta continua aberta, se ainda existir no disco.
        const reopened = get().session?.project.configurations
        if (reopened?.some((entry) => entry.key === openConfigurationKey)) {
          set({ openConfigurationKey })
        }
      },

      dismissConflicts() {
        set({ conflicts: [] })
      },

      close() {
        set({ ...CLOSED })
        void get().loadRecents()
      },

      run(command) {
        const { session, history } = get()
        if (session === null) return false
        const step = executeCommand(history, editorStateOf(session), command)
        if (!step.ok) {
          set({ notice: step.error })
          return false
        }
        applyStep(step.value)
        return true
      },

      check(command) {
        const { session, history } = get()
        if (session === null) return 'Nenhum projeto aberto.'
        const step = executeCommand(history, editorStateOf(session), command)
        return step.ok ? null : step.error
      },

      undo() {
        const step = undo(get().history)
        if (step !== undefined) applyStep(step)
      },

      redo() {
        const step = redo(get().history)
        if (step !== undefined) applyStep(step)
      },

      selectFeature(featureId) {
        set({ selectedFeatureId: featureId })
      },

      toggleCollapsed(featureId) {
        const { session, selectedFeatureId, collapsedFeatureIds } = get()
        if (session === null) return
        const collapsed = new Set(collapsedFeatureIds)
        if (collapsed.delete(featureId)) {
          set({ collapsedFeatureIds: collapsed })
          return
        }
        collapsed.add(featureId)
        // A seleção não pode sumir dentro da subárvore recolhida: passa para a feature recolhida.
        const root = session.project.model.root
        const hidden =
          selectedFeatureId !== null && ancestorIds(root, selectedFeatureId).includes(featureId)
        set({
          collapsedFeatureIds: collapsed,
          ...(hidden ? { selectedFeatureId: featureId } : {})
        })
      },

      dismissNotice() {
        set({ notice: null })
      },

      openConfiguration(key) {
        set({ openConfigurationKey: key })
      },

      createConfiguration(name) {
        const { session } = get()
        if (session === null) return 'Nenhum projeto aberto.'
        return changeList(entries.addConfiguration(session.project.configurations, name))
      },

      renameConfiguration(key, name) {
        const { session, openConfigurationKey } = get()
        if (session === null) return 'Nenhum projeto aberto.'
        const change = entries.renameConfiguration(session.project.configurations, key, name)
        if (!change.ok) return change.error
        // Renomear troca a chave; a configuração aberta continua aberta.
        const openKey = openConfigurationKey === key ? change.value.key : openConfigurationKey
        setConfigurations(change.value.entries, openKey)
        return null
      },

      duplicateConfiguration(key, name) {
        const { session } = get()
        if (session === null) return 'Nenhum projeto aberto.'
        return changeList(entries.duplicateConfiguration(session.project.configurations, key, name))
      },

      deleteConfiguration(key) {
        const { session, openConfigurationKey } = get()
        if (session === null) return
        setConfigurations(
          entries.removeConfiguration(session.project.configurations, key),
          openConfigurationKey === key ? null : openConfigurationKey
        )
      },

      toggleDecision(featureId) {
        const entry = openConfigurationEntry(get())
        if (entry === null) return
        const before = resolve(entry.configuration)
        const status = before?.kind === 'resolved' ? before.features.get(featureId) : undefined
        // Em conflito, ou numa feature decidida pelo modelo, o clique não faz nada.
        if (status === undefined || status.kind === 'propagated') return
        const current = status.kind === 'manual' ? status.state : undefined
        editOpen((model, configuration) => {
          const next = withDecision(model, configuration, featureId, nextDecisionState(current))
          // Um clique nunca deixa a configuração em conflito: nesse caso, a feature fica
          // indecisa, e a resolução mostra o valor que o modelo impõe (com o cadeado).
          return resolve(next)?.kind === 'resolved'
            ? next
            : withDecision(model, configuration, featureId, undefined)
        })
      },

      removeDecision(featureId) {
        editOpen((model, configuration) => withDecision(model, configuration, featureId, undefined))
      },

      setAttributeValue(featureId, attributeId, value) {
        const { session } = get()
        const entry = openConfigurationEntry(get())
        if (session === null || entry === null) return 'Nenhuma configuração aberta.'
        const edited = withAttributeValue(
          session.project.model,
          entry.configuration,
          featureId,
          attributeId,
          value
        )
        if (!edited.ok) return edited.error
        editOpen(() => edited.value)
        return null
      },

      removeAttributeValue(featureId, attributeId) {
        editOpen((_model, configuration) =>
          withoutAttributeValue(configuration, featureId, attributeId)
        )
      },

      removeOrphanReferences() {
        editOpen(withoutOrphanReferences)
      },

      openResolution() {
        const entry = openConfigurationEntry(get())
        return entry === null ? null : resolve(entry.configuration)
      }
    }
  })

  store.subscribe((state) => services.unsavedChanges.set(hasUnsavedChanges(state)))
  return store
}

/**
 * Depois de uma edição: seleciona a feature que o comando indicou, mantém a seleção se ela
 * ainda existe, ou volta para a raiz (por exemplo, depois de excluir a feature selecionada).
 */
function nextSelection(
  current: string | null,
  model: FeatureModel,
  focusFeatureId: string | undefined
): string {
  if (focusFeatureId !== undefined) return focusFeatureId
  if (current !== null && findFeature(model.root, current) !== undefined) return current
  return model.root.id
}

/** Expande os ancestrais da feature, para ela não ficar escondida numa subárvore recolhida. */
function revealed(
  collapsed: ReadonlySet<string>,
  model: FeatureModel,
  featureId: string
): ReadonlySet<string> {
  const ancestors = ancestorIds(model.root, featureId)
  if (!ancestors.some((id) => collapsed.has(id))) return collapsed
  return new Set([...collapsed].filter((id) => !ancestors.includes(id)))
}

/** IDs do pai, do avô… até a raiz. */
function ancestorIds(root: Feature, featureId: string): string[] {
  const ids: string[] = []
  let location = locateFeature(root, featureId)
  while (location !== undefined && location.kind !== 'root') {
    ids.push(location.parent.id)
    location = locateFeature(root, location.parent.id)
  }
  return ids
}
```

- [ ] **Passo 2: Injetar a resolução na composition root (`src/renderer/src/ui/app/composition-root.ts`)**

Acrescente os imports:

```ts
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
```

(o primeiro depois do import de `OpenProject`; o segundo depois do de `ElectronXmlSchemaValidator`) e, em `createProjectStore({ … })`, depois de `saveProject: new SaveProject(repositories),`:

```ts
    resolveConfiguration: new ResolveConfiguration(new LogicSolverConstraintSolver()),
```

- [ ] **Passo 3: Typecheck e lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sem erros. A interface ainda não usa as ações novas; a `ProjectScreen` da 2B continua compilando.

- [ ] **Passo 4: Conferir a store isolada**

Crie `.checks/configurator-store-check.mts`:

```ts
// Store do configurador sobre docs/examples/loja-online (plano da Fase 3, Tarefa 3).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/configurator-store-check.mts
import { readFileSync } from 'node:fs'
import * as cmd from '@/application/editing/commands'
import type { ProjectSession } from '@/application/project-session'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { configurationStatus } from '@/domain/configuration/resolution'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import {
  createProjectStore,
  hasUnsavedChanges,
  openConfigurationEntry
} from '@/ui/stores/project-store'

const read = (path: string) =>
  parseXmlRoot(readFileSync(`docs/examples/loja-online/${path}`, 'utf8'))
const model = decodeFeatureModel(read('model.xml'))
const basica = decodeConfiguration(read('configurations/loja-basica.xml'))
if (!model.ok || !basica.ok) throw new Error('o exemplo não abriu')
const session: ProjectSession = {
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: {
    model: model.value,
    assets: EMPTY_ASSET_CATALOG,
    configurations: [{ key: 'loja-basica', configuration: basica.value }]
  },
  hashes: { model: 'x', assets: null, configurations: { 'loja-basica': 'y' } }
}
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}
const saved: ProjectSession[] = []
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session, warnings: [] }),
    reopen: async () => ({ status: 'opened', session, warnings: [] })
  },
  createProject: { execute: notUsed },
  saveProject: {
    execute: async (s) => {
      saved.push(s)
      return { session: s, conflicts: [], problems: [] }
    }
  },
  resolveConfiguration: new ResolveConfiguration(new LogicSolverConstraintSolver()),
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} }
})
const state = () => store.getState()
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const summary = (): string => {
  const resolution = state().openResolution()
  if (resolution === null) return '(nenhuma aberta)'
  const status = configurationStatus(resolution)
  return `${resolution.kind} | completa ${status.complete} | indecisas ${status.undecidedCount}`
}
const feature = (id: string): string => {
  const resolution = state().openResolution()
  const s = resolution?.kind === 'resolved' ? resolution.features.get(id) : undefined
  return s === undefined ? '-' : s.kind === 'undecided' ? 'indecisa' : `${s.kind} ${s.state}`
}
const keys = (): string =>
  state()
    .session!.project.configurations.map((e) => `${e.key}(${e.configuration.name})`)
    .join(' ')

await state().open()
log('ao abrir', `aberta ${state().openConfigurationKey} | alterações ${hasUnsavedChanges(state())}`)

// 1. loja-basica completa, mobile propagada
state().openConfiguration('loja-basica')
log('loja-basica', `${summary()} | mobile ${feature('mobile')}`)
log('mesma resolução enquanto nada muda', state().openResolution() === state().openResolution())

// 2. Clique numa feature propagada não faz nada
state().toggleDecision('mobile')
log('clique em mobile (travada)', `${feature('mobile')} | alterações ${hasUnsavedChanges(state())}`)

// 3. Dois cliques em pag_pix: desselecionada, depois indecisa; mobile fica indecisa
state().toggleDecision('pag_pix')
log('1º clique em pag_pix', `${feature('pag_pix')} | mobile ${feature('mobile')}`)
state().toggleDecision('pag_pix')
log('2º clique em pag_pix', `${feature('pag_pix')} | mobile ${feature('mobile')} | ${summary()}`)
log('alterações pendentes', hasUnsavedChanges(state()))

// 4. O clique pula o estado que daria conflito: mobile manual selecionada, pag_pix selecionada
state().toggleDecision('mobile')
state().toggleDecision('pag_pix')
log('mobile manual + pag_pix', `mobile ${feature('mobile')} | pag_pix ${feature('pag_pix')}`)
state().toggleDecision('mobile')
log('clique em mobile pula o conflito', `mobile ${feature('mobile')} | ${summary()}`)

// 5. Valores de atributos
log('valor inválido', state().setAttributeValue('busca', 'max_resultados', '9000'))
log('valor válido', state().setAttributeValue('busca', 'max_resultados', '200'))
log(
  'valor gravado',
  openConfigurationEntry(state())!
    .configuration.values.map((v) => `${v.featureId}=${v.value}`)
    .join(' ')
)

// 6. Lista: criar abre a nova, renomear a aberta mantém aberta, excluir fecha
log('criar sem nome', state().createConfiguration(' '))
state().createConfiguration('Loja Completa')
log('criar', `${keys()} | aberta ${state().openConfigurationKey} | ${summary()}`)
state().renameConfiguration('loja-completa', 'Loja Premium')
log('renomear a aberta', `${keys()} | aberta ${state().openConfigurationKey}`)
state().duplicateConfiguration('loja-basica', 'Loja Básica')
log('duplicar', `${keys()} | aberta ${state().openConfigurationKey}`)
state().deleteConfiguration('loja-basica-2')
log('excluir a aberta', `${keys()} | aberta ${state().openConfigurationKey}`)

// 7. Órfãs: excluir pag_pix no modelo; a configuração mostra a referência e a remove
state().openConfiguration('loja-basica')
state().toggleDecision('pag_pix')
state().run(cmd.deleteFeature('pag_pix', 'PIX'))
const orphans = state().openResolution()!.orphans
log(
  'órfãs depois de excluir pag_pix',
  orphans.map((o) => (o.kind === 'decision' ? o.decision.featureId : o.value.attributeId)).join(' ')
)
state().removeOrphanReferences()
log('depois de remover as órfãs', `${state().openResolution()!.orphans.length} | ${summary()}`)

// 8. Salvar grava a lista inteira e limpa o "•"
await state().save()
log(
  'salvo',
  `${saved
    .at(-1)!
    .project.configurations.map((e) => e.key)
    .join(' ')} | alterações ${hasUnsavedChanges(state())}`
)

// 9. Recarregar mantém a configuração aberta se ela ainda existe no disco
state().openConfiguration('loja-basica')
await state().reload()
log('recarregar', `aberta ${state().openConfigurationKey}`)
```

Rode:

```bash
npx tsx --tsconfig tsconfig.web.json .checks/configurator-store-check.mts
```

Esperado, exatamente:

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

Destaques:

- o clique em `mobile`, travada, não muda nada nem acende o `•`;
- "clique em mobile pula o conflito": com `mobile` e `pag_pix` selecionadas por decisão manual, desselecionar `mobile` daria conflito. Por isso a decisão sobre `mobile` é removida, e ela volta travada pelo modelo;
- renomear a configuração aberta a mantém aberta, com a chave nova, e excluir a aberta fecha o diagrama.

- [ ] **Passo 5: Commit**

```bash
npm run format
git add src/renderer/src/ui/stores/project-store.ts src/renderer/src/ui/app/composition-root.ts
git commit -m "feat(ui): store guarda a configuração aberta, as decisões e os valores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: Interface do configurador

**Arquivos:**

- Criar: `src/renderer/src/ui/diagram/node-parts.tsx`, `src/renderer/src/ui/diagram/ConfiguredFeatureNode.tsx`
- Substituir: `src/renderer/src/ui/diagram/FeatureNode.tsx`, `src/renderer/src/ui/diagram/flow-types.ts`
- Modificar: `src/renderer/src/ui/diagram/FeatureDiagram.tsx`
- Substituir: `src/renderer/src/ui/screens/project/editor-dialog.ts`, `src/renderer/src/ui/screens/project/ProjectHeader.tsx`, `src/renderer/src/ui/screens/project/ProjectScreen.tsx`
- Modificar: `src/renderer/src/ui/screens/project/use-editor-shortcuts.ts`
- Criar: `src/renderer/src/ui/screens/project/ViewRail.tsx`, `src/renderer/src/ui/screens/project/ModelWorkspace.tsx`
- Criar, em `src/renderer/src/ui/screens/configurator/`: `configuration-texts.ts`, `ConfigurationList.tsx`, `ConfigurationProblems.tsx`, `AttributeValuesPanel.tsx`, `ConfigurationDialogs.tsx`, `ConfigurationStatusBar.tsx`, `ConfiguratorWorkspace.tsx`
- Verificação: `.checks/quit.mjs`, `.checks/configurador-ui.mjs`, e os roteiros da 2B e da 2A

**Interfaces:**

- Consome: a store da Tarefa 3 (`openResolution`, `toggleDecision`, as ações da lista e dos valores, `openConfigurationEntry`); `configurationKey` (Tarefa 2); `storedValue`, `isSelected`, `configurationStatus`, `OrphanReference`, `decisionOf` (Tarefas 1 e 2).
- Produz:
  - `DiagramMode` (`{ kind: 'edit'; actions: FeatureActions } | { kind: 'configure' }`), exportado de `FeatureDiagram.tsx`; o `FeatureDiagram` recebe `mode` no lugar de `actions`
  - `ConfiguredFeatureFlowNode` (tipo `'configured-feature'`) em `flow-types.ts`
  - no nó do modo configuração, para os roteiros: `data-feature-id`, `data-status` (`manual-selected`, `manual-deselected`, `propagated-selected`, `propagated-deselected` ou `undecided`), `role="checkbox"`, `aria-checked`, `aria-disabled`; o `title` "Decidido pelo modelo" nos travados
  - `ProjectView` (`'model' | 'configurations'`) e `ViewRail`
  - `useEditorShortcuts(openDialog, { enabled, editing })`, no lugar de `useEditorShortcuts(openDialog, enabled)`
  - `ProjectHeader` com a prop `historyEnabled`
  - `EditorDialog` com `new-configuration`, `rename-configuration`, `duplicate-configuration` e `delete-configuration`
  - marcadores para os roteiros: `data-configuration-key` nos itens da lista, `data-banner` nas faixas (`empty-model`, `conflict`, `orphans`, `invalid-values`), `data-values-feature` nos grupos do painel, `#value-<feature>-<atributo>` nos campos e `#configuration-name` no diálogo de nome

- [ ] **Passo 1: Criar `src/renderer/src/ui/diagram/node-parts.tsx`**

Os pontos de conexão e o botão de recolher saem do `FeatureNode` para serem usados também pelo nó do configurador.

```tsx
import { Handle, Position } from '@xyflow/react'
import { useProjectStore } from '@/ui/stores/project-store-context'
import type { DiagramFeature } from './diagram-graph'

// Pontos de conexão invisíveis, exatamente no meio da borda de cima e da de baixo.
const HIDDEN_HANDLE = { opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0, border: 0 }

/** Onde as linhas chegam e saem do nó; os dois tipos de nó de feature usam os mesmos. */
export function NodeHandles(): React.JSX.Element {
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} style={HIDDEN_HANDLE} />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={HIDDEN_HANDLE}
      />
    </>
  )
}

/** Botão no lado direito do nó que tem filhas: recolhe (−) ou expande (+N). */
export function CollapseButton({
  feature
}: {
  readonly feature: DiagramFeature
}): React.JSX.Element | null {
  const toggleCollapsed = useProjectStore((state) => state.toggleCollapsed)
  if (!feature.hasChildren) return null
  return (
    <button
      type="button"
      className="nodrag absolute top-1/2 -right-2.5 -translate-y-1/2 rounded-full border bg-background px-1.5 text-[10px] leading-4 text-foreground hover:bg-accent"
      title={feature.collapsed ? 'Expandir' : 'Recolher'}
      onClick={(event) => {
        event.stopPropagation()
        toggleCollapsed(feature.id)
      }}
    >
      {feature.collapsed ? `+${feature.hiddenCount}` : '−'}
    </button>
  )
}
```

- [ ] **Passo 2: Substituir o conteúdo de `src/renderer/src/ui/diagram/FeatureNode.tsx`**

O comportamento não muda; só passa a usar `node-parts`.

```tsx
import type { NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import { ContextMenu, ContextMenuTrigger } from '@/ui/components/ui/context-menu'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { useDropState } from './diagram-context'
import { FeatureMenu } from './FeatureMenu'
import type { FeatureFlowNode } from './flow-types'
import { CollapseButton, NodeHandles } from './node-parts'

/** Caixa da feature: nome, ID e o botão de recolher; botão direito abre o menu. */
export function FeatureNode({ data: { feature } }: NodeProps<FeatureFlowNode>): React.JSX.Element {
  const selected = useProjectStore((state) => state.selectedFeatureId === feature.id)
  const selectFeature = useProjectStore((state) => state.selectFeature)
  const drop = useDropState(`feature:${feature.id}`)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            data-feature-id={feature.id}
            aria-current={selected ? 'true' : undefined}
            className={cn(
              'relative flex h-full w-full flex-col items-center justify-center rounded-md border bg-card px-3.5 text-card-foreground shadow-xs',
              selected && 'border-primary bg-primary text-primary-foreground',
              drop === 'valid' && 'ring-3 ring-emerald-500',
              drop === 'invalid' && 'ring-3 ring-destructive'
            )}
            onClick={() => selectFeature(feature.id)}
            onContextMenu={() => selectFeature(feature.id)}
          >
            <span className="max-w-full truncate text-sm leading-5 font-medium">
              {feature.name}
            </span>
            <code className="max-w-full truncate text-xs leading-4 opacity-70">{feature.id}</code>
            <CollapseButton feature={feature} />
          </div>
        </ContextMenuTrigger>
        <FeatureMenu featureId={feature.id} />
      </ContextMenu>
      <NodeHandles />
    </>
  )
}
```

- [ ] **Passo 3: Criar `src/renderer/src/ui/diagram/ConfiguredFeatureNode.tsx`**

O estado vem da resolução da configuração aberta. Em conflito, só as decisões manuais aparecem. A marca fica no canto de cima, fora do texto, então a largura medida pelo `measure-feature.ts` continua valendo.

```tsx
import type { NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import { Check, Lock, X } from 'lucide-react'
import { decisionOf } from '@/domain/configuration/configuration-edits'
import { openConfigurationEntry, type ProjectState } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import type { ConfiguredFeatureFlowNode } from './flow-types'
import { CollapseButton, NodeHandles } from './node-parts'

/** Como a feature aparece no modo configuração (SPEC §7). */
type Shown =
  | 'manual-selected'
  | 'manual-deselected'
  | 'propagated-selected'
  | 'propagated-deselected'
  | 'undecided'

const BOX: Record<Shown, string> = {
  'manual-selected': 'border-emerald-700 bg-emerald-600 text-white',
  'propagated-selected':
    'border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50',
  'manual-deselected': 'border-destructive bg-destructive/10 text-destructive',
  'propagated-deselected': 'border-dashed bg-muted text-muted-foreground',
  undecided: 'bg-card text-card-foreground'
}

const HINT: Record<Shown, string> = {
  'manual-selected': 'Selecionada por você. Clique para desselecionar.',
  'propagated-selected': 'Decidido pelo modelo',
  'manual-deselected': 'Desselecionada por você. Clique para deixar indecisa.',
  'propagated-deselected': 'Decidido pelo modelo',
  undecided: 'Indecisa. Clique para selecionar.'
}

const CHECKED: Record<Shown, 'true' | 'false' | 'mixed'> = {
  'manual-selected': 'true',
  'propagated-selected': 'true',
  'manual-deselected': 'false',
  'propagated-deselected': 'false',
  undecided: 'mixed'
}

/**
 * Nó de feature no modo configuração: o estado vem da resolução da configuração aberta, e o
 * clique alterna a decisão manual. Nós decididos pelo modelo têm cadeado e não respondem.
 */
export function ConfiguredFeatureNode({
  data: { feature }
}: NodeProps<ConfiguredFeatureFlowNode>): React.JSX.Element {
  const shown = useProjectStore((state) => shownStatus(state, feature.id))
  const resolved = useProjectStore((state) => state.openResolution()?.kind === 'resolved')
  const toggleDecision = useProjectStore((state) => state.toggleDecision)
  const locked = shown === 'propagated-selected' || shown === 'propagated-deselected'
  const clickable = resolved && !locked
  const deselected = shown === 'manual-deselected' || shown === 'propagated-deselected'

  return (
    <>
      <div
        data-feature-id={feature.id}
        data-status={shown}
        role="checkbox"
        aria-checked={CHECKED[shown]}
        aria-disabled={!clickable}
        title={clickable || locked ? HINT[shown] : 'Resolva o conflito indicado acima do diagrama.'}
        className={cn(
          'relative flex h-full w-full flex-col items-center justify-center rounded-md border px-3.5 shadow-xs',
          BOX[shown],
          clickable && 'cursor-pointer'
        )}
        onClick={() => clickable && toggleDecision(feature.id)}
      >
        <StatusBadge shown={shown} />
        <span
          className={cn(
            'max-w-full truncate text-sm leading-5 font-medium',
            deselected && 'line-through'
          )}
        >
          {feature.name}
        </span>
        <code className="max-w-full truncate text-xs leading-4 opacity-70">{feature.id}</code>
        <CollapseButton feature={feature} />
      </div>
      <NodeHandles />
    </>
  )
}

/** ✓ selecionada, ✕ desselecionada, cadeado = decidida pelo modelo; indecisa não tem marca. */
function StatusBadge({ shown }: { readonly shown: Shown }): React.JSX.Element | null {
  if (shown === 'undecided') return null
  const icon =
    shown === 'manual-selected' ? <Check /> : shown === 'manual-deselected' ? <X /> : <Lock />
  return (
    <span className="absolute -top-2 -left-2 flex size-5 items-center justify-center rounded-full border bg-background text-foreground [&_svg]:size-3">
      {icon}
    </span>
  )
}

function shownStatus(state: ProjectState, featureId: string): Shown {
  const resolution = state.openResolution()
  if (resolution?.kind === 'resolved') {
    const status = resolution.features.get(featureId)
    if (status === undefined || status.kind === 'undecided') return 'undecided'
    return `${status.kind}-${status.state}`
  }
  // Em conflito, ou com o modelo vazio, nada é propagado: só as decisões manuais aparecem.
  const entry = openConfigurationEntry(state)
  const manual = entry !== null ? decisionOf(entry.configuration, featureId) : undefined
  return manual === undefined ? 'undecided' : `manual-${manual}`
}
```

- [ ] **Passo 4: Substituir o conteúdo de `src/renderer/src/ui/diagram/flow-types.ts`**

```ts
import type { Edge, Node } from '@xyflow/react'
import type { DiagramFeature, EdgeMarker } from './diagram-graph'
import type { GroupArc } from './diagram-layout'

/** Nós e linhas do React Flow que o diagrama usa. */

export type FeatureFlowNode = Node<{ feature: DiagramFeature }, 'feature'>

/** A mesma feature no modo configuração (SPEC §7). */
export type ConfiguredFeatureFlowNode = Node<{ feature: DiagramFeature }, 'configured-feature'>

export type GroupArcFlowNode = Node<{ arc: GroupArc }, 'group-arc'>

export type DiagramFlowNode = FeatureFlowNode | ConfiguredFeatureFlowNode | GroupArcFlowNode

export type VariabilityFlowEdge = Edge<{ marker: EdgeMarker }, 'variability'>
```

- [ ] **Passo 5: Modo do diagrama (`src/renderer/src/ui/diagram/FeatureDiagram.tsx`)**

1. Troque o import do `FeatureNode` e a constante `NODE_TYPES` por:

```tsx
import { ConfiguredFeatureNode } from './ConfiguredFeatureNode'
import { FeatureNode } from './FeatureNode'
```

```tsx
const NODE_TYPES = {
  feature: FeatureNode,
  'configured-feature': ConfiguredFeatureNode,
  'group-arc': GroupArcNode
}
```

2. Troque a interface `FeatureDiagramProps` e as funções `FeatureDiagram` e a assinatura de `DiagramCanvas` (da interface até a linha `function DiagramCanvas(...)`) por:

```tsx
/** Editar a estrutura (aba Modelo) ou decidir as features de uma configuração (SPEC §7). */
export type DiagramMode =
  { readonly kind: 'edit'; readonly actions: FeatureActions } | { readonly kind: 'configure' }

interface FeatureDiagramProps {
  readonly model: FeatureModel
  readonly mode: DiagramMode
}

/**
 * Diagrama do Feature Model (SPEC §7, ADR 0007): layout sempre calculado, arrastar um nó
 * muda o pai da feature, e toda edição passa pelos comandos do histórico.
 */
export function FeatureDiagram({ model, mode }: FeatureDiagramProps): React.JSX.Element {
  return (
    <ReactFlowProvider>
      {mode.kind === 'edit' ? (
        <FeatureActionsContext value={mode.actions}>
          <DiagramCanvas model={model} editing />
        </FeatureActionsContext>
      ) : (
        <DiagramCanvas model={model} editing={false} />
      )}
    </ReactFlowProvider>
  )
}

interface DiagramCanvasProps {
  readonly model: FeatureModel
  /** No modo configuração, a estrutura é só leitura: nada se arrasta nem tem menu. */
  readonly editing: boolean
}

function DiagramCanvas({ model, editing }: DiagramCanvasProps): React.JSX.Element {
```

3. Troque a linha do `laidOut` por:

```tsx
const laidOut = useMemo(
  () => (placed === null ? [] : toFlowNodes(placed, editing)),
  [placed, editing]
)
```

4. Em `toFlowNodes`, troque o começo da função até o fim do `map` das features por:

```tsx
function toFlowNodes({ graph, layout }: Placed, editing: boolean): DiagramFlowNode[] {
  const features: DiagramFlowNode[] = graph.features.map((feature) => {
    const box = layout.boxes.get(feature.id)!
    const node = {
      id: feature.id,
      position: { x: box.x, y: box.y },
      width: box.width,
      height: box.height,
      draggable: editing && !feature.isRoot,
      style: FEATURE_NODE_STYLE,
      data: { feature }
    }
    return editing ? { ...node, type: 'feature' } : { ...node, type: 'configured-feature' }
  })
```

O resto do arquivo não muda. No modo configuração, nenhum nó é arrastável, então o arrasto e o menu de contexto não acontecem.

- [ ] **Passo 6: Diálogos e atalhos**

Substitua o conteúdo de `src/renderer/src/ui/screens/project/editor-dialog.ts`:

```ts
/** Qual diálogo da tela do projeto está aberto (no máximo um por vez). */
export type EditorDialog =
  | {
      readonly kind: 'new-feature'
      readonly placement: 'child' | 'sibling'
      readonly featureId: string
    }
  | { readonly kind: 'delete-feature'; readonly featureId: string }
  | { readonly kind: 'create-group'; readonly parentId: string }
  | { readonly kind: 'close-project' }
  | { readonly kind: 'new-configuration' }
  | { readonly kind: 'rename-configuration'; readonly key: string }
  | { readonly kind: 'duplicate-configuration'; readonly key: string }
  | { readonly kind: 'delete-configuration'; readonly key: string }
  | null
```

Em `src/renderer/src/ui/screens/project/use-editor-shortcuts.ts`:

1. Troque o comentário e a assinatura de `useEditorShortcuts` (do `/**` até `): void {`) por:

```ts
export interface ShortcutScope {
  /** Com um diálogo aberto, nenhum atalho vale: as teclas são do diálogo. */
  readonly enabled: boolean
  /** Fora da aba Modelo, só Ctrl+S vale: a estrutura não se edita no configurador. */
  readonly editing: boolean
}

/**
 * Atalhos da SPEC §7: Tab filha, Enter irmã, F2 renomear, Delete excluir, Alt+↑/↓ reordenar,
 * Ctrl+Z/Ctrl+Y desfazer/refazer, Ctrl+S salvar. Enquanto se digita num campo, só Ctrl+S vale.
 */
export function useEditorShortcuts(
  openDialog: (dialog: EditorDialog) => void,
  { enabled, editing }: ShortcutScope
): void {
```

2. Troque a linha:

```ts
if (shortcut !== 'save' && isTyping(event.target)) return
```

por:

```ts
if (shortcut !== 'save' && (!editing || isTyping(event.target))) return
```

3. Troque as dependências do effect, `}, [store, openDialog, enabled])`, por `}, [store, openDialog, enabled, editing])`.

- [ ] **Passo 7: Substituir o conteúdo de `src/renderer/src/ui/screens/project/ProjectHeader.tsx`**

Desfazer e refazer ficam desabilitados fora da aba Modelo.

```tsx
import { Redo2, Save, Undo2, X } from 'lucide-react'
import type { ProjectSession } from '@/application/project-session'
import { Button } from '@/ui/components/ui/button'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface ProjectHeaderProps {
  readonly session: ProjectSession
  /** Desfazer e refazer valem só para o modelo; o configurador não tem histórico (SPEC §2). */
  readonly historyEnabled: boolean
  readonly onClose: () => void
}

export function ProjectHeader({
  session,
  historyEnabled,
  onClose
}: ProjectHeaderProps): React.JSX.Element {
  const busy = useProjectStore((state) => state.busy)
  const unsaved = useProjectStore(hasUnsavedChanges)
  const lastSavedAt = useProjectStore((state) => state.lastSavedAt)
  const undoLabel = useProjectStore((state) => state.history.past.at(-1)?.label)
  const redoLabel = useProjectStore((state) => state.history.future[0]?.label)
  const undo = useProjectStore((state) => state.undo)
  const redo = useProjectStore((state) => state.redo)
  const save = useProjectStore((state) => state.save)

  return (
    <header className="flex items-center gap-2 border-b px-4 py-2">
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-semibold">
          {unsaved && <span title="Alterações não salvas">• </span>}
          {session.project.model.name}
        </h1>
        <p className="truncate text-xs text-muted-foreground">{session.folder.rootPath}</p>
      </div>
      {lastSavedAt !== null && !unsaved && (
        <span className="text-xs text-muted-foreground">
          Salvo às {lastSavedAt.toLocaleTimeString('pt-BR')}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        disabled={!historyEnabled || undoLabel === undefined}
        title={historyTitle(historyEnabled, 'Desfazer', undoLabel, 'Ctrl+Z')}
        onClick={undo}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={!historyEnabled || redoLabel === undefined}
        title={historyTitle(historyEnabled, 'Refazer', redoLabel, 'Ctrl+Y')}
        onClick={redo}
      >
        <Redo2 />
      </Button>
      <Button disabled={busy} title="Salvar (Ctrl+S)" onClick={() => void save()}>
        <Save /> Salvar
      </Button>
      <Button variant="outline" onClick={onClose}>
        <X /> Fechar
      </Button>
    </header>
  )
}

function historyTitle(
  enabled: boolean,
  action: 'Desfazer' | 'Refazer',
  label: string | undefined,
  shortcut: string
): string {
  if (!enabled) return `${action} vale só na aba Modelo`
  if (label === undefined) return `Nada para ${action.toLowerCase()}`
  return `${action}: ${label} (${shortcut})`
}
```

- [ ] **Passo 8: Criar a barra de abas e a área do modelo**

`src/renderer/src/ui/screens/project/ViewRail.tsx`:

```tsx
import { ListChecks, Network } from 'lucide-react'
import { cn } from 'cn'

/** As abas da barra lateral (SPEC §7). A de assets chega na Fase 4. */
export type ProjectView = 'model' | 'configurations'

const VIEWS = [
  { view: 'model', label: 'Modelo', Icon: Network },
  { view: 'configurations', label: 'Configurações', Icon: ListChecks }
] as const

interface ViewRailProps {
  readonly view: ProjectView
  readonly onChange: (view: ProjectView) => void
}

export function ViewRail({ view, onChange }: ViewRailProps): React.JSX.Element {
  return (
    <nav aria-label="Seções do projeto" className="flex w-24 shrink-0 flex-col gap-1 border-r p-2">
      {VIEWS.map(({ view: target, label, Icon }) => (
        <button
          key={target}
          type="button"
          aria-current={view === target ? 'page' : undefined}
          className={cn(
            'flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] leading-tight',
            view === target
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50'
          )}
          onClick={() => onChange(target)}
        >
          <Icon className="size-5" />
          {label}
        </button>
      ))}
    </nav>
  )
}
```

`src/renderer/src/ui/screens/project/ModelWorkspace.tsx`: é o conteúdo que ficava na `ProjectScreen`, menos as listas de problemas, que sobem para a tela e valem nas duas abas.

```tsx
import type { ProjectSession } from '@/application/project-session'
import type { FeatureActions } from '@/ui/diagram/diagram-context'
import { FeatureDiagram } from '@/ui/diagram/FeatureDiagram'
import { ConstraintsPanel } from './constraints/ConstraintsPanel'
import type { EditorDialog } from './editor-dialog'
import { FeatureToolbar } from './FeatureToolbar'
import { FeatureProperties } from './properties/FeatureProperties'

interface ModelWorkspaceProps {
  readonly session: ProjectSession
  readonly actions: FeatureActions
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/** Aba Modelo: barra de ações e diagrama no centro, propriedades e restrições à direita. */
export function ModelWorkspace({
  session,
  actions,
  onOpenDialog
}: ModelWorkspaceProps): React.JSX.Element {
  const { project } = session
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_24rem]">
      <section className="flex min-h-0 flex-col gap-3 p-4">
        <FeatureToolbar model={project.model} onOpenDialog={onOpenDialog} />
        <div className="min-h-0 flex-1 rounded-md border">
          <FeatureDiagram
            key={session.folder.rootPath}
            model={project.model}
            mode={{ kind: 'edit', actions }}
          />
        </div>
      </section>
      <aside className="min-h-0 space-y-8 overflow-auto border-l p-4">
        <FeatureProperties project={project} />
        <ConstraintsPanel model={project.model} />
      </aside>
    </div>
  )
}
```

- [ ] **Passo 9: Textos e lista do configurador**

`src/renderer/src/ui/screens/configurator/configuration-texts.ts`:

```ts
import type { DecisionState } from '@/domain/configuration/configuration'
import type { OrphanReference } from '@/domain/configuration/references'
import { configurationStatus, type Resolution } from '@/domain/configuration/resolution'

/** Textos do configurador que mais de um componente usa. */

export function decisionLabel(state: DecisionState): string {
  return state === 'selected' ? 'selecionada' : 'desselecionada'
}

const ORPHAN_VALUE_REASON = {
  feature: 'a feature não existe mais',
  attribute: 'o atributo não existe mais',
  fixed: 'o atributo agora tem valor fixo no modelo'
} as const

export function describeOrphan(orphan: OrphanReference): string {
  if (orphan.kind === 'decision') {
    const { featureId, state } = orphan.decision
    return `Decisão sobre “${featureId}” (${decisionLabel(state)}): a feature não existe mais.`
  }
  const { featureId, attributeId, value } = orphan.value
  return `Valor de ${featureId}.${attributeId} (“${value}”): ${ORPHAN_VALUE_REASON[orphan.reason]}.`
}

/** "Válida · incompleta (2 indecisas, 1 atributo sem valor) · desatualizada" (SPEC §7). */
export function statusText(resolution: Resolution): string {
  const status = configurationStatus(resolution)
  const parts: string[] = []
  if (resolution.kind === 'empty-model') parts.push('Modelo vazio: nenhum produto é possível')
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

function plural(count: number, one: string, many: string): string | null {
  if (count === 0) return null
  return `${count} ${count === 1 ? one : many}`
}
```

`src/renderer/src/ui/screens/configurator/ConfigurationList.tsx`:

```tsx
import { Plus } from 'lucide-react'
import { cn } from 'cn'
import type { ConfigurationEntry } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'

interface ConfigurationListProps {
  readonly configurations: readonly ConfigurationEntry[]
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/** A lista de configurações do projeto; um clique abre a configuração no diagrama. */
export function ConfigurationList({
  configurations,
  onOpenDialog
}: ConfigurationListProps): React.JSX.Element {
  const openKey = useProjectStore((state) => state.openConfigurationKey)
  const openConfiguration = useProjectStore((state) => state.openConfiguration)

  return (
    <nav aria-label="Configurações" className="flex min-h-0 flex-col gap-2 border-r p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
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
        <p className="text-sm text-muted-foreground">
          Nenhuma configuração ainda. Crie uma para escolher as features de um produto.
        </p>
      )}
      <ul className="min-h-0 space-y-1 overflow-auto">
        {configurations.map(({ key, configuration }) => (
          <li key={key}>
            <button
              type="button"
              data-configuration-key={key}
              aria-current={key === openKey ? 'true' : undefined}
              className={cn(
                'w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                key === openKey && 'bg-accent font-medium'
              )}
              onClick={() => openConfiguration(key)}
            >
              <span className="block truncate">{configuration.name}</span>
              <span className="block truncate font-mono text-xs text-muted-foreground">
                {key}.xml
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Passo 10: Criar `src/renderer/src/ui/screens/configurator/ConfigurationProblems.tsx`**

```tsx
import { cn } from 'cn'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { findFeature } from '@/domain/feature-model/tree'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { decisionLabel, describeOrphan } from './configuration-texts'

/**
 * Faixas acima do diagrama (SPEC §7): modelo vazio, decisões em conflito (com a ação de
 * remover cada uma), referências órfãs (com a ação de remover todas) e valores inválidos.
 */
export function ConfigurationProblems({
  model
}: {
  readonly model: FeatureModel
}): React.JSX.Element | null {
  const resolution = useProjectStore((state) => state.openResolution())
  const removeDecision = useProjectStore((state) => state.removeDecision)
  const removeOrphanReferences = useProjectStore((state) => state.removeOrphanReferences)
  const removeAttributeValue = useProjectStore((state) => state.removeAttributeValue)
  if (resolution === null) return null
  const nameOf = (featureId: string): string =>
    findFeature(model.root, featureId)?.name ?? featureId

  return (
    <>
      {resolution.kind === 'empty-model' && (
        <Banner id="empty-model" tone="error" title="O modelo não admite nenhum produto">
          <p>As regras do modelo se contradizem. Corrija-as na aba Modelo.</p>
        </Banner>
      )}
      {resolution.kind === 'conflict' && (
        <Banner id="conflict" tone="error" title="As decisões manuais se contradizem">
          <p>Remova decisões até a configuração voltar a ser válida:</p>
          <ul className="space-y-1">
            {resolution.decisions.map(({ featureId, state }) => (
              <li key={featureId} className="flex items-center gap-2">
                <span className="flex-1">
                  {nameOf(featureId)} — {decisionLabel(state)}
                </span>
                <Button size="xs" variant="outline" onClick={() => removeDecision(featureId)}>
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        </Banner>
      )}
      {resolution.orphans.length > 0 && (
        <Banner
          id="orphans"
          tone="warning"
          title="Configuração desatualizada: há referências ao que não existe mais no modelo"
        >
          <ul className="ml-4 list-disc">
            {resolution.orphans.map((orphan, index) => (
              <li key={index}>{describeOrphan(orphan)}</li>
            ))}
          </ul>
          <Button size="sm" variant="outline" onClick={removeOrphanReferences}>
            Remover referências órfãs
          </Button>
        </Banner>
      )}
      {resolution.invalidValues.length > 0 && (
        <Banner id="invalid-values" tone="warning" title="Valores de atributos inválidos">
          <ul className="space-y-1">
            {resolution.invalidValues.map(({ value, message }) => (
              <li
                key={`${value.featureId}.${value.attributeId}`}
                className="flex items-center gap-2"
              >
                <span className="flex-1">
                  {nameOf(value.featureId)} › {value.attributeId} = “{value.value}”: {message}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => removeAttributeValue(value.featureId, value.attributeId)}
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        </Banner>
      )}
    </>
  )
}

interface BannerProps {
  readonly id: string
  readonly tone: 'error' | 'warning'
  readonly title: string
  readonly children: React.ReactNode
}

function Banner({ id, tone, title, children }: BannerProps): React.JSX.Element {
  return (
    <section
      data-banner={id}
      className={cn(
        'space-y-2 rounded-md border p-3 text-sm',
        tone === 'error'
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50'
      )}
    >
      <h3 className="font-medium">{title}</h3>
      {children}
    </section>
  )
}
```

- [ ] **Passo 11: Criar `src/renderer/src/ui/screens/configurator/AttributeValuesPanel.tsx`**

```tsx
import { useState } from 'react'
import { storedValue } from '@/domain/configuration/attribute-values'
import { isSelected } from '@/domain/configuration/resolution'
import type { Attribute, FeatureModel } from '@/domain/feature-model/feature-model'
import { featuresInPreOrder } from '@/domain/feature-model/traversal'
import type { ConfigurationEntry } from '@/domain/project/project'
import { CommitField } from '@/ui/components/CommitField'
import { Field } from '@/ui/screens/project/properties/Field'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface AttributeValuesPanelProps {
  readonly model: FeatureModel
  readonly entry: ConfigurationEntry
}

/**
 * Painel direito do configurador (SPEC §7): os atributos configuráveis das features
 * selecionadas, com o valor conferido pelo tipo. Vazio = vale o padrão do modelo.
 */
export function AttributeValuesPanel({
  model,
  entry
}: AttributeValuesPanelProps): React.JSX.Element {
  const resolution = useProjectStore((state) => state.openResolution())

  if (resolution?.kind !== 'resolved') {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          Resolva o problema indicado acima do diagrama para editar os valores.
        </p>
      </Panel>
    )
  }

  const missing = new Set(
    resolution.missingValues.map(({ featureId, attributeId }) => `${featureId}.${attributeId}`)
  )
  const features = featuresInPreOrder(model.root).filter(
    (feature) =>
      isSelected(resolution.features.get(feature.id)) &&
      feature.attributes.some((attribute) => attribute.configurable)
  )

  return (
    // A chave zera as mensagens de erro dos campos ao trocar de configuração.
    <Panel key={entry.key}>
      {features.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma feature selecionada tem atributos configuráveis.
        </p>
      )}
      {features.map((feature) => (
        <div key={feature.id} data-values-feature={feature.id} className="space-y-3">
          <h3 className="text-sm font-medium">{feature.name}</h3>
          {feature.attributes
            .filter((attribute) => attribute.configurable)
            .map((attribute) => (
              <AttributeValueField
                key={attribute.id}
                featureId={feature.id}
                attribute={attribute}
                value={storedValue(entry.configuration, feature.id, attribute.id)}
                missing={missing.has(`${feature.id}.${attribute.id}`)}
              />
            ))}
        </div>
      ))}
    </Panel>
  )
}

function Panel({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Valores dos atributos
      </h2>
      {children}
    </section>
  )
}

interface AttributeValueFieldProps {
  readonly featureId: string
  readonly attribute: Attribute
  readonly value: string | undefined
  /** Sem valor válido e sem padrão: a configuração não fica completa. */
  readonly missing: boolean
}

function AttributeValueField({
  featureId,
  attribute,
  value,
  missing
}: AttributeValueFieldProps): React.JSX.Element {
  const setAttributeValue = useProjectStore((state) => state.setAttributeValue)
  const [problem, setProblem] = useState<string | null>(null)
  const id = `value-${featureId}-${attribute.id}`
  const fallback =
    attribute.defaultValue !== undefined ? `padrão: ${attribute.defaultValue}` : 'sem valor'
  const commit = (next: string): boolean => {
    const error = setAttributeValue(featureId, attribute.id, next)
    setProblem(error)
    return error === null
  }

  return (
    <Field label={attribute.name} htmlFor={id}>
      {attribute.type === 'enum' || attribute.type === 'boolean' ? (
        <select
          id={id}
          className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          value={value ?? ''}
          onChange={(event) => commit(event.target.value)}
        >
          <option value="">({fallback})</option>
          {(attribute.type === 'enum' ? attribute.options : ['true', 'false']).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <CommitField id={id} value={value ?? ''} placeholder={fallback} onCommit={commit} />
      )}
      {attribute.type === 'number' && (
        <p className="text-xs text-muted-foreground">{numberHint(attribute)}</p>
      )}
      {problem !== null && <p className="text-xs text-destructive">{problem}</p>}
      {problem === null && missing && (
        <p className="text-xs text-destructive">
          Escolha um valor para a configuração ficar completa.
        </p>
      )}
    </Field>
  )
}

function numberHint(attribute: Attribute): string {
  if (attribute.min !== undefined && attribute.max !== undefined) {
    return `Número de ${attribute.min} a ${attribute.max}.`
  }
  if (attribute.min !== undefined) return `Número a partir de ${attribute.min}.`
  if (attribute.max !== undefined) return `Número até ${attribute.max}.`
  return 'Número.'
}
```

- [ ] **Passo 12: Diálogos, barra de status e área do configurador**

`src/renderer/src/ui/screens/configurator/ConfigurationDialogs.tsx`:

```tsx
import { useState } from 'react'
import { configurationKey } from '@/domain/project/configuration-entries'
import type { ConfigurationEntry } from '@/domain/project/project'
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

interface ConfigurationDialogsProps {
  readonly dialog: EditorDialog
  readonly configurations: readonly ConfigurationEntry[]
  readonly onClose: () => void
}

/** Criar, renomear, duplicar e excluir configurações (SPEC §7). */
export function ConfigurationDialogs({
  dialog,
  configurations,
  onClose
}: ConfigurationDialogsProps): React.JSX.Element | null {
  const create = useProjectStore((state) => state.createConfiguration)
  const rename = useProjectStore((state) => state.renameConfiguration)
  const duplicate = useProjectStore((state) => state.duplicateConfiguration)
  const keys = new Set(configurations.map((entry) => entry.key))
  const entryOf = (key: string): ConfigurationEntry | undefined =>
    configurations.find((entry) => entry.key === key)

  switch (dialog?.kind) {
    case 'new-configuration':
      return (
        <NameDialog
          title="Nova configuração"
          submitLabel="Criar"
          initialName=""
          takenKeys={keys}
          onSubmit={create}
          onClose={onClose}
        />
      )
    case 'rename-configuration': {
      const entry = entryOf(dialog.key)
      if (entry === undefined) return null
      return (
        <NameDialog
          title={`Renomear “${entry.configuration.name}”`}
          submitLabel="Renomear"
          initialName={entry.configuration.name}
          takenKeys={new Set([...keys].filter((key) => key !== entry.key))}
          onSubmit={(name) => rename(entry.key, name)}
          onClose={onClose}
        />
      )
    }
    case 'duplicate-configuration': {
      const entry = entryOf(dialog.key)
      if (entry === undefined) return null
      return (
        <NameDialog
          title={`Duplicar “${entry.configuration.name}”`}
          submitLabel="Duplicar"
          initialName={`${entry.configuration.name} (cópia)`}
          takenKeys={keys}
          onSubmit={(name) => duplicate(entry.key, name)}
          onClose={onClose}
        />
      )
    }
    case 'delete-configuration': {
      const entry = entryOf(dialog.key)
      if (entry === undefined) return null
      return <DeleteDialog entry={entry} onClose={onClose} />
    }
    default:
      return null
  }
}

interface NameDialogProps {
  readonly title: string
  readonly submitLabel: string
  readonly initialName: string
  /** Chaves já usadas, para mostrar o nome do arquivo que a configuração vai ter. */
  readonly takenKeys: ReadonlySet<string>
  /** Devolve o motivo quando o nome não serve. */
  readonly onSubmit: (name: string) => string | null
  readonly onClose: () => void
}

/** O nome de exibição define o nome do arquivo (SPEC §3), mostrado enquanto se digita. */
function NameDialog({
  title,
  submitLabel,
  initialName,
  takenKeys,
  onSubmit,
  onClose
}: NameDialogProps): React.JSX.Element {
  const [name, setName] = useState(initialName)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const error = onSubmit(name)
    if (error === null) onClose()
    else setProblem(error)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="configuration-name">Nome</Label>
            <Input
              id="configuration-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Arquivo: <code>configurations/{configurationKey(name, takenKeys)}.xml</code>
            </p>
            {problem !== null && <p className="text-xs text-destructive">{problem}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={name.trim() === ''}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteDialogProps {
  readonly entry: ConfigurationEntry
  readonly onClose: () => void
}

/** A configuração sai da lista agora; o arquivo só é apagado ao salvar. */
function DeleteDialog({ entry, onClose }: DeleteDialogProps): React.JSX.Element {
  const remove = useProjectStore((state) => state.deleteConfiguration)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir “{entry.configuration.name}”?</DialogTitle>
          <DialogDescription>
            O arquivo configurations/{entry.key}.xml será apagado quando você salvar. Até lá, fechar
            o projeto sem salvar mantém a configuração.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              remove(entry.key)
              onClose()
            }}
          >
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

`src/renderer/src/ui/screens/configurator/ConfigurationStatusBar.tsx`:

```tsx
import { openConfigurationEntry } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { statusText } from './configuration-texts'

/** Barra de status da aba Configurações: o estado calculado da configuração aberta (SPEC §7). */
export function ConfigurationStatusBar(): React.JSX.Element {
  const entry = useProjectStore(openConfigurationEntry)
  const resolution = useProjectStore((state) => state.openResolution())
  const count = useProjectStore((state) => state.session?.project.configurations.length ?? 0)

  if (entry === null || resolution === null) return <span>{count} configurações</span>
  return (
    <span>
      {entry.configuration.name}: {statusText(resolution)}
    </span>
  )
}
```

`src/renderer/src/ui/screens/configurator/ConfiguratorWorkspace.tsx`:

```tsx
import { Copy, Pencil, Trash2 } from 'lucide-react'
import type { ConfigurationEntry, Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { FeatureDiagram, type DiagramMode } from '@/ui/diagram/FeatureDiagram'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { openConfigurationEntry } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AttributeValuesPanel } from './AttributeValuesPanel'
import { ConfigurationList } from './ConfigurationList'
import { ConfigurationProblems } from './ConfigurationProblems'

const CONFIGURE: DiagramMode = { kind: 'configure' }

interface ConfiguratorWorkspaceProps {
  readonly project: Project
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/**
 * Aba Configurações (SPEC §7): a lista à esquerda; no centro, o mesmo diagrama do modelo
 * em modo configuração; à direita, os valores dos atributos.
 */
export function ConfiguratorWorkspace({
  project,
  onOpenDialog
}: ConfiguratorWorkspaceProps): React.JSX.Element {
  const entry = useProjectStore(openConfigurationEntry)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[15rem_1fr_22rem]">
      <ConfigurationList configurations={project.configurations} onOpenDialog={onOpenDialog} />
      <section className="flex min-h-0 flex-col gap-3 p-4">
        {entry === null ? (
          <p className="text-sm text-muted-foreground">
            {project.configurations.length === 0
              ? 'Crie uma configuração para escolher as features de um produto.'
              : 'Escolha uma configuração na lista.'}
          </p>
        ) : (
          <>
            <ConfigurationToolbar entry={entry} onOpenDialog={onOpenDialog} />
            <ConfigurationProblems model={project.model} />
            <div className="min-h-0 flex-1 rounded-md border">
              <FeatureDiagram model={project.model} mode={CONFIGURE} />
            </div>
          </>
        )}
      </section>
      <aside className="min-h-0 overflow-auto border-l p-4">
        {entry !== null && <AttributeValuesPanel model={project.model} entry={entry} />}
      </aside>
    </div>
  )
}

interface ConfigurationToolbarProps {
  readonly entry: ConfigurationEntry
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

function ConfigurationToolbar({
  entry,
  onOpenDialog
}: ConfigurationToolbarProps): React.JSX.Element {
  const { key, configuration } = entry
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <div className="mr-auto min-w-0">
          <h2 className="truncate font-semibold">{configuration.name}</h2>
          <p className="truncate font-mono text-xs text-muted-foreground">
            configurations/{key}.xml
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenDialog({ kind: 'rename-configuration', key })}
        >
          <Pencil /> Renomear…
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenDialog({ kind: 'duplicate-configuration', key })}
        >
          <Copy /> Duplicar…
        </Button>
        <Button
          size="sm"
          variant="outline"
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

- [ ] **Passo 13: Substituir o conteúdo de `src/renderer/src/ui/screens/project/ProjectScreen.tsx`**

```tsx
import { useCallback, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { ProjectSession } from '@/application/project-session'
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
import type { FeatureActions } from '@/ui/diagram/diagram-context'
import { ConfigurationDialogs } from '@/ui/screens/configurator/ConfigurationDialogs'
import { ConfigurationStatusBar } from '@/ui/screens/configurator/ConfigurationStatusBar'
import { ConfiguratorWorkspace } from '@/ui/screens/configurator/ConfiguratorWorkspace'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { CloseProjectDialog } from './dialogs/CloseProjectDialog'
import { ConflictDialog } from './dialogs/ConflictDialog'
import { CreateGroupDialog } from './dialogs/CreateGroupDialog'
import { DeleteFeatureDialog } from './dialogs/DeleteFeatureDialog'
import { NewFeatureDialog } from './dialogs/NewFeatureDialog'
import type { EditorDialog } from './editor-dialog'
import { ModelWorkspace } from './ModelWorkspace'
import { ProjectHeader } from './ProjectHeader'
import { useEditorShortcuts } from './use-editor-shortcuts'
import { ViewRail, type ProjectView } from './ViewRail'

export function ProjectScreen({
  session
}: {
  readonly session: ProjectSession
}): React.JSX.Element {
  const problems = useProjectStore((state) => state.problems)
  const warnings = useProjectStore((state) => state.warnings)
  const notice = useProjectStore((state) => state.notice)
  const dismissNotice = useProjectStore((state) => state.dismissNotice)
  const unsaved = useProjectStore(hasUnsavedChanges)
  const close = useProjectStore((state) => state.close)
  const [view, setView] = useState<ProjectView>('model')
  const [dialog, setDialog] = useState<EditorDialog>(null)
  const openDialog = useCallback((next: EditorDialog) => setDialog(next), [])
  useEditorShortcuts(openDialog, { enabled: dialog === null, editing: view === 'model' })
  const actions = useMemo<FeatureActions>(
    () => ({
      addChild: (featureId) => openDialog({ kind: 'new-feature', placement: 'child', featureId }),
      addSibling: (featureId) =>
        openDialog({ kind: 'new-feature', placement: 'sibling', featureId }),
      groupChildren: (parentId) => openDialog({ kind: 'create-group', parentId }),
      remove: (featureId) => openDialog({ kind: 'delete-feature', featureId })
    }),
    [openDialog]
  )

  const { project } = session
  const requestClose = (): void => (unsaved ? setDialog({ kind: 'close-project' }) : close())

  return (
    <main className="flex h-screen flex-col">
      <ProjectHeader session={session} historyEnabled={view === 'model'} onClose={requestClose} />

      {notice !== null && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span className="flex-1">Edição recusada: {notice}</span>
          <Button size="icon-sm" variant="ghost" title="Dispensar" onClick={dismissNotice}>
            <X />
          </Button>
        </div>
      )}

      {(problems.length > 0 || warnings.length > 0) && (
        <div className="space-y-2 border-b p-4">
          <ProblemList title="Não foi possível salvar" tone="error" problems={problems} />
          <ProblemList title="Avisos" tone="warning" problems={warnings} />
        </div>
      )}

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

      {dialog?.kind === 'new-feature' && (
        <NewFeatureDialog
          model={project.model}
          placement={dialog.placement}
          featureId={dialog.featureId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'delete-feature' && (
        <DeleteFeatureDialog
          project={project}
          featureId={dialog.featureId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'create-group' && (
        <CreateGroupDialog
          model={project.model}
          parentId={dialog.parentId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'close-project' && <CloseProjectDialog onCancel={() => setDialog(null)} />}
      <ConfigurationDialogs
        dialog={dialog}
        configurations={project.configurations}
        onClose={() => setDialog(null)}
      />
      <ConflictDialog />
    </main>
  )
}
```

- [ ] **Passo 14: Typecheck, lint e build**

```bash
npm run typecheck && npm run lint && npm run build
```

Esperado: sem erros. O build avisa três vezes "Use of eval in node_modules/logic-solver/minisat.js is strongly discouraged". O aviso é esperado (veja "O que o protótipo respondeu", item 1).

- [ ] **Passo 15: Percorrer o configurador com entrada real**

Crie `.checks/quit.mjs`, que fecha o app sem o diálogo de alterações não salvas e sem matar processos pelo nome:

```js
// Fecha o app pelo protocolo de depuração, sem matar processos pelo nome. Antes, avisa o
// main que não há alterações pendentes: senão ele abriria o diálogo nativo e esperaria.
// Uso: node .checks/quit.mjs <porta>
import { connect } from './cdp.mjs'
const port = process.argv[2]
const ui = await connect(port)
await ui.js('window.mdd.setUnsavedChanges(false)')
ui.close()
const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
const ws = new WebSocket(webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve))
ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }))
await new Promise((resolve) => setTimeout(resolve, 500))
console.log('app fechado')
process.exit(0)
```

Crie `.checks/configurador-ui.mjs`:

```js
// Roteiro do configurador (plano da Fase 3, Tarefa 4), com entrada real pelo protocolo do Chromium.
// Uso: node .checks/configurador-ui.mjs <porta> <pasta-do-projeto>
// O app precisa estar na tela inicial, com a pasta nos recentes. A pasta é uma cópia de
// docs/examples/loja-online com configurations/conflito.xml a mais (veja o plano).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, log, sleep } from './cdp.mjs'

const [port, projectDir] = process.argv.slice(2)
const ui = await connect(port)
// A janela pode estar sem o foco do Windows: sem isto, os campos não gravam ao sair.
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
const node = (id) => `[data-feature-id="${id}"]`
const MARK = {
  'manual-selected': '+',
  'manual-deselected': '-',
  'propagated-selected': '+🔒',
  'propagated-deselected': '-🔒',
  undecided: '?'
}
const states = () =>
  js(
    `[...document.querySelectorAll('[data-feature-id]')].map((n) => n.dataset.featureId + ({ ${Object.entries(
      MARK
    )
      .map(([k, v]) => `'${k}': '${v}'`)
      .join(', ')} })[n.dataset.status]).join(' ')`
  )
const footer = () => text('footer')
const banners = () =>
  js(
    `[...document.querySelectorAll('[data-banner]')].map((b) => b.dataset.banner).join(' ') || 'nenhuma'`
  )
const configurations = () =>
  js(
    `[...document.querySelectorAll('[data-configuration-key]')].map((b) => b.dataset.configurationKey + (b.getAttribute('aria-current') ? '*' : '')).join(' ')`
  )
const file = (name) => {
  const path = join(projectDir, 'configurations', name)
  return existsSync(path) ? readFileSync(path, 'utf8') : '(não existe)'
}

// 1. Abrir pelo recente e ir para a aba Configurações
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Configurações' })
await sleep(300)
log('aba', await js(`document.querySelector('nav [aria-current=page]').innerText`))
log(
  'rótulo da aba cortado',
  await js(
    `[...document.querySelectorAll('nav[aria-label="Seções do projeto"] button')].some((b) => b.scrollWidth > b.clientWidth)`
  )
)
log('lista', await configurations())
log('centro sem configuração aberta', await text('main section p'))
log('barra de status', await footer())

// 2. Abrir loja-basica: completa, mobile propagada e travada
await click('[data-configuration-key="loja-basica"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await sleep(800)
log('estados', await states())
log('barra de status', await footer())
log('dica de mobile', await js(`document.querySelector('${node('mobile')}').title`))
log(
  'mobile aria-disabled',
  await js(`document.querySelector('${node('mobile')}').getAttribute('aria-disabled')`)
)
log('faixas', await banners())
log('título', await title())

// 3. Clique em mobile (travada) não muda nada
await click(node('mobile'))
log('clique em mobile', `${await states()} | ${await title()}`)

// 4. Dois cliques em pag_pix: mobile fica indecisa
await click(node('pag_pix'))
log('1º clique em pag_pix', await states())
await click(node('pag_pix'))
log('2º clique em pag_pix', await states())
log('barra de status', await footer())
log('título', await title())
await click(node('pag_pix'))
log('3º clique em pag_pix', await states())

// 5. Atalhos de edição não valem aqui; desfazer fica desabilitado
await press('Tab')
log(
  'Tab no configurador',
  await js(`document.querySelector('[role=dialog]') ? 'abriu diálogo' : 'nada'`)
)
log(
  'botão desfazer',
  await js(
    `(() => { const b = document.querySelector('header button[title*="Desfazer"]'); return b.disabled + ' | ' + b.title })()`
  )
)

// 6. Valores dos atributos das features selecionadas
log(
  'painel de valores',
  await js(
    `[...document.querySelectorAll('[data-values-feature]')].map((d) => d.dataset.valuesFeature).join(' ')`
  )
)
await fill('#value-busca-max_resultados', '9000')
await press('Enter')
log(
  'valor fora da faixa',
  `${await js(`document.querySelector('#value-busca-max_resultados').value`)} | ${await text('[data-values-feature="busca"] .text-destructive')}`
)
await fill('#value-busca-max_resultados', '200')
await press('Enter')
log(
  'valor válido',
  `${await js(`document.querySelector('#value-busca-max_resultados').value`)} | erro: ${await text('[data-values-feature="busca"] .text-destructive')}`
)
await choose('#value-mobile-plataforma', '')
log(
  'plataforma sem valor',
  `${await footer()} | ${await text('[data-values-feature="mobile"] .text-destructive')}`
)
await choose('#value-mobile-plataforma', 'ios')
log('plataforma ios', await footer())

// 7. Nova configuração, renomear, duplicar e excluir
await click({ text: 'Nova' })
await fill('#configuration-name', 'Loja Básica')
log('arquivo sugerido', await text('[role=dialog] code'))
await fill('#configuration-name', 'Loja Completa')
await click({ text: 'Criar' })
await sleep(500)
log('criada e aberta', `${await configurations()} | ${await footer()}`)
await click({ text: 'Renomear…' })
await fill('#configuration-name', 'Loja Premium')
await click({ tag: '[role=dialog] button', text: 'Renomear' })
await sleep(300)
log('renomeada', await configurations())
await click({ text: 'Duplicar…' })
log('nome sugerido na cópia', await js(`document.querySelector('#configuration-name').value`))
await click({ tag: '[role=dialog] button', text: 'Duplicar' })
await sleep(300)
log('duplicada', await configurations())
await click({ text: 'Excluir…' })
log('diálogo de exclusão', await text('[role=dialog] p'))
await click({ tag: '[role=dialog] button', text: 'Excluir' })
await sleep(300)
log('excluída', `${await configurations()} | ${await text('main section p')}`)

// 8. Salvar grava loja-basica e loja-premium; a cópia excluída nunca chegou ao disco
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
log('título depois de salvar', await title())
log(
  'loja-basica.xml',
  file('loja-basica.xml')
    .match(/<value[^\n]*/g)
    .join(' ')
)
log('loja-premium.xml', file('loja-premium.xml').split('\n')[1])
log('cópia no disco', file('loja-premium-copia.xml'))

// 9. Excluir pag_pix no modelo e salvar: loja-basica abre desatualizada
await click({ text: 'Modelo' })
await waitFor(`document.querySelector('${node('pag_pix')}') !== null`)
await sleep(800)
await click(node('pag_pix'))
await press('Delete')
log('impacto', await text('[role=dialog] .space-y-3'))
await click({ tag: '[role=dialog] button', text: 'Excluir' })
await press('s', { ctrl: true })
await waitFor(`!document.title.startsWith('•')`)
await click({ text: 'Configurações' })
await click('[data-configuration-key="loja-basica"]')
await sleep(800)
log('desatualizada: faixas', await banners())
log('referência órfã', await text('[data-banner="orphans"] li'))
log('estados', await states())
log('barra de status', await footer())
await click({ text: 'Remover referências órfãs' })
await sleep(300)
log('depois de remover', `${await banners()} | ${await footer()} | ${await title()}`)

// 10. Conflito vindo do arquivo: nós sem resposta, remover uma decisão resolve
await click('[data-configuration-key="conflito"]')
await sleep(800)
log('conflito: faixas', await banners())
log('decisões listadas', await text('[data-banner="conflict"] ul'))
log('estados em conflito', await states())
log(
  'nó em conflito responde?',
  await js(`document.querySelector('${node('busca')}').getAttribute('aria-disabled')`)
)
log('painel de valores', await text('aside p'))
await js(
  `[...document.querySelectorAll('[data-banner="conflict"] li')].find((li) => li.innerText.startsWith('Catálogo')).querySelector('button').dataset.alvo = 'sim'`
)
await click('[data-alvo="sim"]')
await sleep(500)
log('depois de remover a decisão', `${await banners()} | ${await footer()}`)
log('estados', await states())

log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
```

Prepare uma cópia do exemplo com uma configuração em conflito a mais (desseleciona `catalogo`, que é obrigatória) e abra o app compilado:

```bash
rm -rf .checks/ui-data .checks/loja-ui && mkdir -p .checks/ui-data
cp -r docs/examples/loja-online .checks/loja-ui
cat > .checks/loja-ui/configurations/conflito.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<configuration xmlns="urn:mdd:configuration" schemaVersion="1" name="Conflito">
  <decision feature="catalogo" state="deselected"/>
  <decision feature="busca" state="selected"/>
</configuration>
EOF
node -e "require('fs').writeFileSync('.checks/ui-data/recent-projects.json', JSON.stringify([{ rootPath: process.argv[1], name: 'loja-ui' }]))" "$(cygpath -w "$PWD/.checks/loja-ui")"
./node_modules/electron/dist/electron.exe . --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/ui-data")" &
```

Espere a janela aparecer e rode:

```bash
node .checks/configurador-ui.mjs 9333 "$(cygpath -w "$PWD/.checks/loja-ui")"
node .checks/quit.mjs 9333
```

Esperado, exatamente (e `app fechado` no fim):

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
botão desfazer                       → true | Desfazer vale só na aba Modelo
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
```

- [ ] **Passo 16: Os roteiros da 2B e da 2A continuam iguais**

A aba Modelo mudou de lugar na tela (barra de abas à esquerda; avisos acima das duas abas), mas não de comportamento. Rode os dois roteiros sobre uma cópia limpa do exemplo:

```bash
rm -rf .checks/ui-data .checks/loja-ui && mkdir -p .checks/ui-data
cp -r docs/examples/loja-online .checks/loja-ui
node -e "require('fs').writeFileSync('.checks/ui-data/recent-projects.json', JSON.stringify([{ rootPath: process.argv[1], name: 'loja-ui' }]))" "$(cygpath -w "$PWD/.checks/loja-ui")"
./node_modules/electron/dist/electron.exe . --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/ui-data")" &
node .checks/diagrama-ui.mjs 9333
node .checks/quit.mjs 9333
```

Esperado: exatamente a saída do plano da 2B (Tarefa 3, Passo 12), 27 linhas, terminando em `erros no console → nenhum`.

Repita a preparação (as três primeiras linhas e o `electron.exe`) e rode:

```bash
node .checks/ui-check.mjs 9333 "$(cygpath -w "$PWD/.checks/loja-ui")"
node .checks/quit.mjs 9333
```

Esperado: exatamente a saída do plano da 2B (Tarefa 4, Passo 6), 19 linhas, terminando em `tela inicial → mdd`.

- [ ] **Passo 17: Commit**

```bash
npm run format
git add src/renderer/src/ui
git commit -m "feat(ui): configurador com lista, diagrama em modo configuração, valores e faixas de problemas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: Aceitação no app empacotado e documentação

**Arquivos:**

- Modificar: `docs/SPEC.md`, `docs/adr/0002-solver-sat-para-propagacao.md`, `docs/HANDOFF.md`
- Verificação: `.checks/configurador-ui.mjs`, `.checks/aceitacao-3.mjs`, `.checks/main-dialogs.mjs`

**Interfaces:**

- Consome: tudo das Tarefas 1–4.
- Produz: o instalador, o registro da aceitação e a SPEC atualizada com as decisões da fase.

- [ ] **Passo 1: Gerar o instalador**

```bash
npm run build:win
```

Esperado: `building target=nsis file=dist\mdd-0.1.0-setup.exe` sem erro.

- [ ] **Passo 2: O roteiro do configurador no `mdd.exe`**

Repita a preparação do Passo 15 da Tarefa 4 (a cópia com `conflito.xml` e os recentes), mas abra o app empacotado:

```bash
./dist/win-unpacked/mdd.exe --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/ui-data")" &
node .checks/configurador-ui.mjs 9333 "$(cygpath -w "$PWD/.checks/loja-ui")"
node .checks/quit.mjs 9333
```

Esperado: exatamente a mesma saída da Tarefa 4, Passo 15. Ela confirma que o solver roda dentro do `app.asar`, com a CSP.

- [ ] **Passo 3: Roteiro da aceitação**

Crie `.checks/aceitacao-3.mjs`:

```js
// Aceitação da Fase 3 (SPEC §9) no app empacotado, com entrada real.
// Uso: node .checks/aceitacao-3.mjs <porta> <pasta-do-projeto> <parte>
//   parte 1: loja-basica completa com mobile travada; tirar a decisão de pag_pix deixa mobile
//            indecisa; excluir pag_pix no modelo e salvar.
//   parte 2: (app reaberto) loja-basica abre desatualizada, com a referência órfã; deixa uma
//            decisão pendente para o teste de fechar a janela.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, log, sleep } from './cdp.mjs'

const [port, projectDir, part] = process.argv.slice(2)
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
const { click, press, text, title, js, waitFor } = ui
const node = (id) => `[data-feature-id="${id}"]`
const status = (id) => js(`document.querySelector('${node(id)}').dataset.status`)
const locked = (id) =>
  js(
    `(() => { const n = document.querySelector('${node(id)}'); return n.getAttribute('aria-disabled') + ' | ' + n.title })()`
  )
const footer = () => text('footer')
const example = readFileSync('docs/examples/loja-online/configurations/loja-basica.xml', 'utf8')
const onDisk = () => readFileSync(join(projectDir, 'configurations', 'loja-basica.xml'), 'utf8')

await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await click({ text: 'Configurações' })
await click('[data-configuration-key="loja-basica"]')
await waitFor(`document.querySelector('[data-status]') !== null`)
await sleep(800)

if (part === '1') {
  log('1. loja-basica', await footer())
  log('   mobile', `${await status('mobile')} | travada: ${await locked('mobile')}`)
  await click(node('mobile'))
  log('   clique em mobile', `${await status('mobile')} | ${await title()}`)

  await click(node('pag_pix'))
  await click(node('pag_pix'))
  log(
    '2. sem a decisão de pag_pix',
    `pag_pix ${await status('pag_pix')} | mobile ${await status('mobile')}`
  )
  log('   barra de status', await footer())
  await click(node('pag_pix'))
  log(
    '   decisão de volta',
    `pag_pix ${await status('pag_pix')} | mobile ${await status('mobile')}`
  )

  await click({ text: 'Modelo' })
  await waitFor(`document.querySelector('${node('pag_pix')}') !== null`)
  await sleep(800)
  await click(node('pag_pix'))
  await press('Delete')
  log(
    '3. impacto: configurações',
    await js(
      `[...document.querySelectorAll('[role=dialog] .space-y-3 > div')].find((d) => d.innerText.startsWith('Configurações'))?.innerText.replace(/\\s+/g, ' ')`
    )
  )
  await click({ tag: '[role=dialog] button', text: 'Excluir' })
  await press('s', { ctrl: true })
  await waitFor(`!document.title.startsWith('•')`)
  log('   salvo', await title())
  log('   loja-basica.xml igual ao exemplo', onDisk() === example)
}

if (part === '2') {
  log('3. loja-basica ao reabrir', await footer())
  log('   faixa', await text('[data-banner="orphans"] h3'))
  log('   referência órfã', await text('[data-banner="orphans"] li'))
  log('   mobile', await status('mobile'))
  await click(node('busca'))
  log('4. decisão pendente', `busca ${await status('busca')} | ${await title()}`)
}

log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
```

Prepare uma cópia limpa do exemplo e rode a primeira parte:

```bash
rm -rf .checks/aceitacao && mkdir -p .checks/aceitacao/dados
cp -r docs/examples/loja-online .checks/aceitacao/loja-online
node -e "require('fs').writeFileSync('.checks/aceitacao/dados/recent-projects.json', JSON.stringify([{ rootPath: process.argv[1], name: 'loja-online' }]))" "$(cygpath -w "$PWD/.checks/aceitacao/loja-online")"
./dist/win-unpacked/mdd.exe --inspect=9229 --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/aceitacao/dados")" &
node .checks/aceitacao-3.mjs 9333 "$(cygpath -w "$PWD/.checks/aceitacao/loja-online")" 1
node .checks/quit.mjs 9333
```

Esperado:

```
1. loja-basica                       → Loja Básica: Válida · completa
   mobile                            → propagated-selected | travada: true | Decidido pelo modelo
   clique em mobile                  → propagated-selected | Loja Online — mdd
2. sem a decisão de pag_pix          → pag_pix undecided | mobile undecided
   barra de status                   → Loja Básica: Válida · incompleta (2 indecisas)
   decisão de volta                  → pag_pix manual-selected | mobile propagated-selected
3. impacto: configurações            → Configurações que vão abrir como desatualizadas (1) Loja Básica
   salvo                             → Loja Online — mdd
   loja-basica.xml igual ao exemplo  → true
erros no console                     → nenhum
app fechado
```

A última linha antes dos erros mostra que salvar o modelo não mexeu na configuração: o arquivo continua com a decisão sobre `pag_pix`, que agora é órfã.

- [ ] **Passo 4: Reabrir, conferir a configuração desatualizada e fechar com alteração pendente**

```bash
./dist/win-unpacked/mdd.exe --inspect=9229 --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/aceitacao/dados")" &
node .checks/aceitacao-3.mjs 9333 "$(cygpath -w "$PWD/.checks/aceitacao/loja-online")" 2
node .checks/main-dialogs.mjs 9229 respostas "Cancelar,Sair sem salvar"
node .checks/main-dialogs.mjs 9229 fechar-janela
node .checks/main-dialogs.mjs 9229 fechar-janela
cmp .checks/aceitacao/loja-online/configurations/loja-basica.xml docs/examples/loja-online/configurations/loja-basica.xml
```

Esperado:

```
3. loja-basica ao reabrir            → Loja Básica: Válida · incompleta (1 indecisa) · desatualizada
   faixa                             → Configuração desatualizada: há referências ao que não existe mais no modelo
   referência órfã                   → Decisão sobre “pag_pix” (selecionada): a feature não existe mais.
   mobile                            → undecided
4. decisão pendente                  → busca manual-deselected | • Loja Online — mdd
erros no console                     → nenhum
próximas confirmações → Cancelar, Sair sem salvar
janela continua aberta
conexão encerrada (o app saiu)
```

O `cmp` não imprime nada. Uma decisão pendente numa configuração conta como alteração não salva: o main pergunta antes de fechar, e "Sair sem salvar" não grava nada.

- [ ] **Passo 5: Levar as decisões da fase para a SPEC (`docs/SPEC.md`)**

1. Em §4.2, troque o parágrafo **Valores de atributos** por:

```markdown
**Valores de atributos.** `number` deve ser decimal dentro de `min..max`; `boolean` deve ser `true` ou `false`; `enum` deve ser uma das `option`; `string` aceita qualquer texto. Valores de features não selecionadas continuam no arquivo, mas são ignorados. Um valor para um atributo que ficou fixo no modelo conta como referência órfã. Um valor inválido de uma feature selecionada conta como atributo sem valor.
```

2. Ainda em §4.2, troque o parágrafo **Regras de interação** por:

```markdown
**Regras de interação:** uma feature com decisão propagada não aceita decisão manual contrária (fica travada na interface). Um clique nunca deixa a configuração em conflito: se o próximo estado do ciclo contradisser as outras decisões, a decisão sobre a feature é removida, e ela passa a mostrar o valor que o modelo impõe. Decisões e valores novos entram na ordem do modelo (pré-ordem), para o arquivo não depender da ordem dos cliques. Configurações incompletas podem ser salvas. A geração só é liberada para configurações completas.
```

3. Em §6.2, na linha do `ConstraintSolver`, troque a responsabilidade por:

```markdown
Carregar uma `Formula` e responder a satisfatibilidade sob uma suposição (um literal), devolvendo uma solução. Cada resolução carrega a fórmula num solver novo (ADR 0002).
```

4. Em §6.3, na linha **Arquivos**, troque `` `remove` `` por `` `remove` (com hash esperado) ``.

5. Em §7, troque o bloco **Configurações** (do título até o botão **Gerar produto**) por:

```markdown
**Configurações:**

- A barra lateral é uma faixa estreita com as abas. Na aba Configurações, a lista fica à esquerda, o diagrama no centro e os valores dos atributos à direita.
- Lista com criar, renomear, duplicar e excluir (com confirmação); o nome do arquivo aparece enquanto se digita o nome. Como o resto do projeto, essas operações só chegam ao disco ao salvar: excluir apaga o arquivo, e renomear grava o arquivo novo e apaga o antigo.
- Abrir uma configuração mostra **o mesmo diagrama em modo configuração**, com a estrutura só para leitura. Estados dos nós:
  - selecionada manual (✓);
  - desselecionada manual (✕);
  - selecionada ou desselecionada **propagada** (com cadeado e dica "decidido pelo modelo");
  - indecisa.
- Um clique alterna entre indecisa → selecionada → desselecionada → indecisa. Nós propagados não respondem ao clique. Em conflito, ou com o modelo vazio, nada é propagado: os nós mostram só as decisões manuais e não respondem.
- Painel direito: valores dos atributos das features selecionadas, com validação por tipo. Campo vazio = sem valor (vale o `default`, se houver); um valor que não serve para o tipo é recusado com o motivo.
- Barra de status: válida / completa / incompleta (N indecisas, M atributos sem valor) / em conflito / modelo vazio, com "desatualizada" quando for o caso.
- Uma configuração desatualizada exibe faixas com:
  - as referências órfãs, com a ação "remover referências órfãs";
  - no caso de conflito, a lista de decisões manuais com a ação de remover cada uma;
  - os valores inválidos, com a ação de remover cada um.
- Desfazer, refazer e os atalhos de edição valem só na aba Modelo; no configurador, só Ctrl+S.
- Botão **Gerar produto** (Fase 5), habilitado só quando a configuração está completa.
```

6. Em §8, troque `(modelo, assets e a configuração aberta)` por `(modelo, assets e configurações, inclusive apagando os arquivos das configurações excluídas ou renomeadas)`.

- [ ] **Passo 6: Consequência nova no ADR 0002**

Em `docs/adr/0002-solver-sat-para-propagacao.md`, no fim de "Consequences", acrescente:

```markdown
- Cada resolução cria um solver novo, com as decisões manuais como regras. Reaproveitar um solver com suposições deixa cada pergunta mais lenta, porque a biblioteca copia a cada solução uma tabela que cresce a cada suposição. Cada instância reserva 64 MB, que o coletor de lixo devolve quando a resolução termina.
```

- [ ] **Passo 7: Atualizar o handoff (`docs/HANDOFF.md`)**

- Na tabela "Estado atual", troque as linhas da Fase 3 e da Fase 4 por:

```markdown
| 3. Configurador | Concluída | `main`. Plano em [docs/superpowers/plans/2026-09-23-fase-3-configurador.md](superpowers/plans/2026-09-23-fase-3-configurador.md) |
| **4. Assets** | **A planejar** | — |
```

- Logo abaixo da tabela, acrescente à lista do que o app faz: "resolve cada configuração com o solver SAT e a mostra no diagrama em modo configuração, com decisões por clique, valores de atributos, lista de configurações e faixas para configurações desatualizadas ou em conflito".
- Depois de "Aceitação da Fase 2B", acrescente a seção "Aceitação da Fase 3 (feita em <data>)". Ela registra o que os Passos 2 a 4 desta tarefa mostraram e a regressão dos roteiros da 2A e da 2B (Tarefa 4, Passo 16). Escreva o que de fato aconteceu; se algo divergir do esperado, registre a divergência.
- Troque a seção "Próximo passo: Fase 3 (configurador)" por "Próximo passo: Fase 4 (assets)". Ela descreve a entrega da SPEC §9 (aba de assets, vínculo com âncora e condição, estado do arquivo, abrir no programa padrão) e a aceitação da mesma linha. Termina com o pedido para a sessão nova:

> Leia docs/HANDOFF.md e escreva o plano da Fase 4, prototipando e verificando o código numa cópia descartável antes, como nas fases anteriores.

- Em "Como trabalhamos", acrescente aos roteiros da lista: "Os da Fase 3 (`resolution-check.mts`, `configurations-check.mts`, `configurator-store-check.mts`, `quit.mjs`, `configurador-ui.mjs` e `aceitacao-3.mjs`) estão no plano da Fase 3."
- Em "Armadilhas já encontradas", acrescente:

```markdown
- **`logic-solver` e a CSP:** o `minisat.js` tem `eval`, e a página o bloqueia. Os caminhos usados não chamam `eval`, então o solver funciona; o `npm run build` avisa três vezes "Use of eval … is strongly discouraged", e é esperado.
- **`logic-solver` reaproveitado:** cada `solveAssuming` deixa as perguntas seguintes mais lentas. Use um solver novo por resolução (`LogicSolverConstraintSolver.load`).
- **Seletores do Zustand:** um seletor que calcula algo (como a resolução) precisa devolver o mesmo objeto enquanto nada muda, senão o React entra em laço. O `ResolveConfiguration` guarda o resultado num `WeakMap` indexado pela configuração.
- **Fechar o app num roteiro:** com alteração pendente, fechar pelo protocolo faz o main abrir o diálogo nativo e esperar. Use `.checks/quit.mjs`, que avisa `setUnsavedChanges(false)` antes, e nunca `taskkill /IM electron.exe`.
- **Captura de tela pelo protocolo:** `Page.captureScreenshot` trava com a janela em segundo plano; chame `Page.bringToFront` antes.
```

- [ ] **Passo 8: Commit**

```bash
npm run format
git add docs/SPEC.md docs/adr/0002-solver-sat-para-propagacao.md docs/HANDOFF.md
git commit -m "docs: spec, ADR 0002 e handoff registram a Fase 3

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Depois das checagens, o branch volta para a `main` com merge local, como nas fases anteriores.

---

## Aceitação da Fase 3 (SPEC §9)

- [ ] `loja-basica` abre completa, com `mobile` selecionada por propagação e travada: cadeado, dica "Decidido pelo modelo" e clique sem efeito (Tarefa 1, Passo 13; Tarefa 4, Passo 15; Tarefa 5, Passo 3).
- [ ] Remover a decisão de `pag_pix` deixa `mobile` indecisa (os mesmos passos).
- [ ] Depois de excluir `pag_pix` no modelo e salvar, `loja-basica` abre como desatualizada, com a referência órfã, e "remover referências órfãs" a limpa (Tarefa 4, Passo 15; Tarefa 5, Passos 3 e 4).
- [ ] Lista de configurações: criar, renomear, duplicar e excluir; o disco só muda ao salvar (Tarefa 2, Passo 10; Tarefa 4, Passo 15).
- [ ] Valores de atributos com validação por tipo e completude na barra de status (Tarefa 3, Passo 4; Tarefa 4, Passo 15).
- [ ] Conflito vindo do arquivo: nós sem resposta e decisões removíveis na faixa (Tarefa 4, Passo 15).
- [ ] Fechar com uma decisão pendente pede confirmação; a aba Modelo continua igual (Tarefa 4, Passo 16; Tarefa 5, Passo 4).
