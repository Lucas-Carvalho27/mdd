# Fase 2B — Diagrama do Feature Model: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** trocar a árvore em lista da Fase 2A por um diagrama gráfico, com layout automático, menu de contexto no nó, arrastar e soltar para mudar o pai de uma feature e subárvores recolhíveis. A aceitação da 2A tem de continuar valendo, agora feita pelo diagrama.

**Arquitetura:**

- Tudo fica em `ui/`: domínio, aplicação e formato dos arquivos não mudam.
- Uma função pura monta o grafo do diagrama a partir do modelo. Outra calcula as posições com o elkjs (mrtree), junto com a geometria dos arcos de grupo e o alvo sob o cursor durante o arrasto.
- O React Flow desenha:
  - **nós de feature**, com nome, ID, botão de recolher e menu de contexto;
  - **nós de arco**, um para cada grupo;
  - **linhas** com o círculo da variabilidade.
- Toda edição continua passando pelos comandos do histórico. A store ganha:
  - as subárvores recolhidas;
  - `check(command)`, que simula uma edição sem registrá-la e dá a borda verde ou vermelha durante o arrasto.

**Stack:** a das fases anteriores, mais `@xyflow/react` 12.11, `elkjs` 0.12 e o componente `context-menu` do shadcn (Radix, via `radix-ui`, já instalado).

**Spec:** [docs/superpowers/specs/2026-09-23-fase-2b-diagrama-design.md](../specs/2026-09-23-fase-2b-diagrama-design.md). Veja também [docs/SPEC.md](../../SPEC.md) §7 e §9, e os ADRs [0007](../../adr/0007-diagrama-com-layout-automatico.md) e [0008](../../adr/0008-camadas-com-lint-sem-testes.md).

## Restrições globais

- **Sem testes automatizados** (ADR 0008).
  - Cada tarefa verifica com `npm run typecheck`, `npm run lint` e scripts descartáveis em `.checks/`.
  - `.checks/` fica fora do git, do ESLint e do Prettier.
  - Os scripts `.mts` rodam com `npx tsx --tsconfig tsconfig.web.json`, por causa do alias `@/`. Os `.mjs` rodam com `node`.
- **Camadas** (SPEC §6.1): `domain/` não importa nada de fora dele; `application/` só `domain/`; só `ui/app/` conhece `infrastructure/`. `ui/diagram/` é `ui`, e o lint barra violações.
- **Imports:** dentro de `domain/`, relativos; nas demais camadas, alias `@/`.
- **Idioma:** identificadores em inglês; textos da interface, mensagens, comentários e documentação em português.
- **Regras do lint:** toda função tem tipo de retorno explícito. As regras de hooks do React 19 estão ligadas: nada de `setState` síncrono dentro de effect, nada de ler ref durante o render.
- **Classes do Tailwind** sempre escritas por inteiro no código (nada de `` `fill-${cor}` ``), senão o Tailwind não as gera.
- **Imutabilidade:** o domínio é imutável. Toda edição passa por um comando executado pelo histórico; o diagrama nunca altera o modelo diretamente.
- **Posições:** nenhuma é salva (ADR 0007). Arrastar muda o **pai** da feature, não a posição.
- **Commits:** rode `npm run format` antes de cada commit. Os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Shell:** todo comando roda na raiz do repositório com **Git Bash**, no branch `fase-2b-diagrama`.

## O que o protótipo respondeu

O código deste plano foi prototipado e verificado numa cópia descartável do repositório, inclusive no `mdd.exe` empacotado. Estas são as respostas aos riscos da spec e os achados pelo caminho:

1. **elkjs com a Content-Security-Policy.** `elkjs/lib/elk.bundled.js` roda no renderer com `script-src 'self'`, dentro do `app.asar`, sem erro no console.
2. **Ordem das irmãs.** Algoritmo `mrtree` com `elk.mrtree.weighting: MODEL_ORDER`.
   - Mantém a ordem do modelo em todos os níveis, em árvores de até 121 nós.
   - A opção funciona de verdade: com `DESCENDANTS`, 28 pais saem fora de ordem.
   - O `mrtree` centra o pai; o `layered` o deslocava até 219 px.
3. **Espaço entre níveis.** O `mrtree` usa o mesmo espaçamento nas duas direções e ignora `nodeNodeBetweenLayers`. Sem correção, os níveis ficavam a 28 px e o arco "or" virava um meio-disco. Por isso o `x` vem do elkjs e o `y` sai do nível, com 72 px de vão.
4. **Tamanho dos nós.** A largura é medida com `measureText` num canvas, com as fontes da página (`measure-feature.ts`), em uma passada só. Nenhum texto sai cortado no exemplo.
5. **Alvo do arrasto.** O alvo sob o cursor é achado por geometria, sobre o layout (`dropTargetAt`), e não pelo DOM:
   - retângulo de cada feature, menos a arrastada;
   - setor de cada arco (raio 36 px, com folga angular).
6. **Mouse na raiz.** O React Flow desliga os eventos de ponteiro num nó que não é arrastável nem selecionável e não tem handler de clique. É o caso da raiz. Sem `style: { pointerEvents: 'all' }` nos nós de feature, a raiz não recebia clique nem botão direito.
7. **Enter no menu de contexto.** Ele também disparava o atalho da janela "Adicionar irmã". O atalho agora ignora teclas com `defaultPrevented`. Sem isso, o teste do Passo 12 da Tarefa 3 abre um diálogo a mais.
8. **Botão de recolher.** Na base do nó, ficaria em cima das linhas que saem dele. Por isso fica no lado direito, na meia altura.
9. **Desempenho.** O layout de 301 features leva cerca de 84 ms.

## Mapa de arquivos

| Arquivo                                      | Responsabilidade                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `ui/diagram/diagram-graph.ts`                | Modelo + recolhidas → features (pré-ordem), linhas com marcador, grupos       |
| `ui/diagram/diagram-layout.ts`               | elkjs, níveis, arcos, alvo sob o cursor (`dropTargetAt`)                      |
| `ui/diagram/measure-feature.ts`              | Largura da caixa pelo texto medido no canvas                                  |
| `ui/diagram/diagram-context.ts`              | Contextos: ações que abrem diálogos e destaque do alvo do arrasto             |
| `ui/diagram/flow-types.ts`                   | Tipos dos nós e linhas do React Flow                                          |
| `ui/diagram/VariabilityEdge.tsx`             | Linha reta com círculo cheio, vazio ou nenhum                                 |
| `ui/diagram/GroupArcNode.tsx`                | Arco do grupo (e o rótulo `[n..m]`)                                           |
| `ui/diagram/FeatureMenu.tsx`                 | Itens do menu de contexto                                                     |
| `ui/diagram/FeatureNode.tsx`                 | Caixa da feature, botão de recolher, menu de contexto                         |
| `ui/diagram/FeatureDiagram.tsx`              | React Flow: layout, arrasto, zoom, ajustar à tela, rolar até a selecionada    |
| `ui/components/ui/context-menu.tsx`          | Componente shadcn (gerado)                                                    |
| `ui/stores/project-store.ts`                 | `collapsedFeatureIds`, `toggleCollapsed`, `check`; revela a seleção escondida |
| `ui/screens/project/use-editor-shortcuts.ts` | Ignora teclas já tratadas (`defaultPrevented`)                                |
| `ui/screens/project/ProjectScreen.tsx`       | Diagrama no lugar da lista; liga as ações do menu aos diálogos                |
| `ui/screens/project/FeatureTree.tsx`         | **Removido**                                                                  |

(Todos os caminhos em `ui/` ficam em `src/renderer/src/`.)

---

### Tarefa 1: Grafo e layout do diagrama

**Arquivos:**

- Modificar: `package.json`, `package-lock.json` (dependências)
- Criar: `src/renderer/src/ui/diagram/diagram-graph.ts`, `src/renderer/src/ui/diagram/diagram-layout.ts`
- Verificação: `.checks/diagram-check.mts`

**Interfaces:**

- Consome: `FeatureModel`, `Feature`, `Group`, `Variability` (`domain/feature-model/feature-model.ts`) e `featuresInPreOrder` (`domain/feature-model/traversal.ts`).
- Produz:
  - `buildDiagramGraph(model: FeatureModel, collapsed: ReadonlySet<string>): DiagramGraph`
  - tipos `DiagramGraph`, `DiagramFeature`, `DiagramEdge`, `DiagramGroup`, `EdgeMarker`, `GroupKind`
  - `layoutDiagram(graph, sizeOf: (feature: DiagramFeature) => Size): Promise<DiagramLayout>`
  - tipos `DiagramLayout` (`boxes: ReadonlyMap<string, Box>`, `arcs: readonly GroupArc[]`), `GroupArc`, `Box`, `Size`, `Point`
  - `dropTargetAt(layout, point, draggedId): DropTarget | null` e `dropTargetKey(target): string`
  - `ARC_RADIUS` (22)

- [ ] **Passo 1: Instalar as dependências**

```bash
npm install @xyflow/react@^12.11.6 elkjs@^0.12.0
```

Esperado: `package.json` ganha `"@xyflow/react": "^12.11.6"` e `"elkjs": "^0.12.0"` em `dependencies`.

- [ ] **Passo 2: Criar `src/renderer/src/ui/diagram/diagram-graph.ts`**

```ts
import type {
  Feature,
  FeatureModel,
  Group,
  Variability
} from '@/domain/feature-model/feature-model'
import { featuresInPreOrder } from '@/domain/feature-model/traversal'

/*
 * O que o diagrama desenha, ainda sem posições (elas vêm de diagram-layout.ts).
 * Função pura sobre o modelo: nada de React aqui.
 */

/** Ponta da linha que chega à feature: ● obrigatória, ○ opcional, nada em membro de grupo. */
export type EdgeMarker = Variability | 'none'

export interface DiagramFeature {
  readonly id: string
  readonly name: string
  readonly isRoot: boolean
  /** Tem filhas, então pode ser recolhida. */
  readonly hasChildren: boolean
  readonly collapsed: boolean
  /** Quantas features a subárvore recolhida esconde (0 quando expandida). */
  readonly hiddenCount: number
}

export interface DiagramEdge {
  readonly parentId: string
  readonly childId: string
  readonly marker: EdgeMarker
}

export type GroupKind = 'alternative' | 'or' | 'custom'

export interface DiagramGroup {
  /** Único no diagrama: o pai e a posição do grupo entre os filhos dele. */
  readonly id: string
  readonly parentId: string
  readonly kind: GroupKind
  /** `[n..m]`, com `*` quando não há máximo. */
  readonly cardinality: string
  readonly memberIds: readonly string[]
}

export interface DiagramGraph {
  /** Em pré-ordem: cada pai antes das filhas, irmãs na ordem do modelo. */
  readonly features: readonly DiagramFeature[]
  readonly edges: readonly DiagramEdge[]
  readonly groups: readonly DiagramGroup[]
}

/** Monta o grafo do diagrama; as filhas de uma feature recolhida ficam de fora. */
export function buildDiagramGraph(
  model: FeatureModel,
  collapsed: ReadonlySet<string>
): DiagramGraph {
  const features: DiagramFeature[] = []
  const edges: DiagramEdge[] = []
  const groups: DiagramGroup[] = []

  const visit = (feature: Feature, isRoot: boolean): void => {
    const hasChildren = feature.children.length > 0
    const isCollapsed = hasChildren && collapsed.has(feature.id)
    features.push({
      id: feature.id,
      name: feature.name,
      isRoot,
      hasChildren,
      collapsed: isCollapsed,
      hiddenCount: isCollapsed ? featuresInPreOrder(feature).length - 1 : 0
    })
    if (isCollapsed) return

    feature.children.forEach((child, childIndex) => {
      if (child.kind === 'feature') {
        const marker = child.feature.variability ?? 'optional'
        edges.push({ parentId: feature.id, childId: child.feature.id, marker })
        visit(child.feature, false)
        return
      }
      groups.push({
        id: `${feature.id}:grupo:${childIndex}`,
        parentId: feature.id,
        kind: groupKind(child.group),
        cardinality: `[${child.group.min}..${child.group.max}]`,
        memberIds: child.group.members.map((member) => member.id)
      })
      for (const member of child.group.members) {
        edges.push({ parentId: feature.id, childId: member.id, marker: 'none' })
        visit(member, false)
      }
    })
  }

  visit(model.root, true)
  return { features, edges, groups }
}

function groupKind(group: Group): GroupKind {
  if (group.min === 1 && group.max === 1) return 'alternative'
  if (group.min === 1 && group.max === '*') return 'or'
  return 'custom'
}
```

- [ ] **Passo 3: Criar `src/renderer/src/ui/diagram/diagram-layout.ts`**

```ts
import ELK from 'elkjs/lib/elk.bundled.js'
import type { DiagramFeature, DiagramGraph, DiagramGroup } from './diagram-graph'

/*
 * Posições do diagrama (ADR 0007): sempre calculadas, nunca salvas. O elkjs põe as caixas;
 * o arco de cada grupo e o alvo sob o cursor saem daqui, por geometria, sem olhar o DOM.
 */

export interface Size {
  readonly width: number
  readonly height: number
}

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Box extends Point, Size {}

/**
 * Arco de um grupo: setor de círculo com centro na base do pai, entre as linhas do primeiro
 * e do último membro. Ângulos em radianos com o y para baixo: 0 aponta para a direita e
 * π/2 para baixo, então `startAngle` é o lado direito e `endAngle` o esquerdo.
 */
export interface GroupArc {
  readonly group: DiagramGroup
  readonly center: Point
  readonly startAngle: number
  readonly endAngle: number
}

export interface DiagramLayout {
  readonly boxes: ReadonlyMap<string, Box>
  readonly arcs: readonly GroupArc[]
}

/** Raio do arco desenhado. */
export const ARC_RADIUS = 22
/** Até onde, a partir do centro, soltar conta como "sobre o arco". */
const ARC_HIT_RADIUS = ARC_RADIUS + 14
/** Folga angular do alvo do arco, e abertura mínima de um grupo com um membro só. */
const ARC_ANGLE_MARGIN = 0.12
/** Vão entre a base de um nível e o topo do seguinte: cabe o arco e o círculo da variabilidade. */
const LEVEL_GAP = 72

// mrtree desenha árvores com o pai centrado; MODEL_ORDER mantém a ordem das irmãs,
// que é semântica (é a ordem das seções no produto gerado). O mrtree usa o mesmo
// espaçamento nas duas direções, então só o x vem dele; o y sai do nível (layoutDiagram).
const LAYOUT_OPTIONS = {
  'elk.algorithm': 'mrtree',
  'elk.direction': 'DOWN',
  'elk.mrtree.weighting': 'MODEL_ORDER',
  'elk.spacing.nodeNode': '28'
}

const elk = new ELK()

export async function layoutDiagram(
  graph: DiagramGraph,
  sizeOf: (feature: DiagramFeature) => Size
): Promise<DiagramLayout> {
  const result = await elk.layout({
    id: 'diagrama',
    layoutOptions: LAYOUT_OPTIONS,
    children: graph.features.map((feature) => ({ id: feature.id, ...sizeOf(feature) })),
    edges: graph.edges.map((edge) => ({
      id: `${edge.parentId}->${edge.childId}`,
      sources: [edge.parentId],
      targets: [edge.childId]
    }))
  })
  const tops = levelTops(graph, sizeOf)
  const boxes = new Map<string, Box>(
    (result.children ?? []).map((node) => [
      node.id,
      { x: node.x ?? 0, y: tops.get(node.id)!, width: node.width ?? 0, height: node.height ?? 0 }
    ])
  )
  return { boxes, arcs: graph.groups.map((group) => groupArc(group, boxes)) }
}

/** Topo de cada feature: os níveis ficam um abaixo do outro, separados por LEVEL_GAP. */
function levelTops(
  graph: DiagramGraph,
  sizeOf: (feature: DiagramFeature) => Size
): Map<string, number> {
  const parentOf = new Map(graph.edges.map((edge) => [edge.childId, edge.parentId]))
  const depth = new Map<string, number>()
  const levelHeight: number[] = []
  for (const feature of graph.features) {
    // Pré-ordem: o pai sempre vem antes, então a profundidade dele já é conhecida.
    const parentId = parentOf.get(feature.id)
    const level = parentId === undefined ? 0 : depth.get(parentId)! + 1
    depth.set(feature.id, level)
    levelHeight[level] = Math.max(levelHeight[level] ?? 0, sizeOf(feature).height)
  }
  const levelTop = [0]
  for (let level = 1; level < levelHeight.length; level++) {
    levelTop[level] = levelTop[level - 1] + levelHeight[level - 1] + LEVEL_GAP
  }
  return new Map([...depth].map(([id, level]) => [id, levelTop[level]]))
}

function groupArc(group: DiagramGroup, boxes: ReadonlyMap<string, Box>): GroupArc {
  const parent = boxes.get(group.parentId)!
  const center = { x: parent.x + parent.width / 2, y: parent.y + parent.height }
  const angles = group.memberIds.map((id) => {
    const member = boxes.get(id)!
    return Math.atan2(member.y - center.y, member.x + member.width / 2 - center.x)
  })
  const start = Math.min(...angles)
  const end = Math.max(...angles)
  const spread = Math.max(0, ARC_ANGLE_MARGIN - (end - start)) / 2
  return { group, center, startAngle: start - spread, endAngle: end + spread }
}

/** Onde uma feature arrastada pode ser solta: sobre outra feature ou sobre o arco de um grupo. */
export type DropTarget =
  | { readonly kind: 'feature'; readonly featureId: string }
  | { readonly kind: 'group'; readonly group: DiagramGroup }

/** O alvo sob o ponto (em coordenadas do diagrama), ignorando a própria feature arrastada. */
export function dropTargetAt(
  layout: DiagramLayout,
  point: Point,
  draggedId: string
): DropTarget | null {
  for (const [featureId, box] of layout.boxes) {
    if (featureId === draggedId) continue
    const inside =
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    if (inside) return { kind: 'feature', featureId }
  }
  for (const arc of layout.arcs) {
    const dx = point.x - arc.center.x
    const dy = point.y - arc.center.y
    const angle = Math.atan2(dy, dx)
    const near = dy > 0 && Math.hypot(dx, dy) <= ARC_HIT_RADIUS
    const between =
      angle >= arc.startAngle - ARC_ANGLE_MARGIN && angle <= arc.endAngle + ARC_ANGLE_MARGIN
    if (near && between) return { kind: 'group', group: arc.group }
  }
  return null
}

/** Chave estável de um alvo, para saber se o cursor mudou de alvo durante o arrasto. */
export function dropTargetKey(target: DropTarget): string {
  return target.kind === 'feature' ? `feature:${target.featureId}` : target.group.id
}
```

- [ ] **Passo 4: Typecheck e lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 5: Conferir grafo e layout sobre o exemplo**

Crie `.checks/diagram-check.mts`:

```ts
// Grafo e layout do diagrama sobre docs/examples/loja-online (plano da 2B).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/diagram-check.mts
import { readFileSync } from 'node:fs'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { buildDiagramGraph } from '@/ui/diagram/diagram-graph'
import { dropTargetAt, layoutDiagram, type Box } from '@/ui/diagram/diagram-layout'

const decoded = decodeFeatureModel(
  parseXmlRoot(readFileSync('docs/examples/loja-online/model.xml', 'utf8'))
)
if (!decoded.ok) throw new Error('o exemplo não abriu')
const model = decoded.value
const log = (label: string, value: unknown): void => console.log(label.padEnd(30), '→', value)
const marker = { mandatory: '●', optional: '○', none: '-' }
// No app o tamanho vem do texto medido no canvas; aqui, uma estimativa pela quantidade de letras.
const sizeOf = (f: { name: string; id: string }) => ({
  width: 26 + 8 * Math.max(f.name.length, f.id.length),
  height: 48
})

const graph = buildDiagramGraph(model, new Set())
log('pré-ordem', graph.features.map((f) => f.id).join(' '))
log('linhas', graph.edges.map((e) => `${e.childId}${marker[e.marker]}`).join(' '))
log(
  'grupos',
  graph.groups
    .map((g) => `${g.id} ${g.kind} ${g.cardinality} [${g.memberIds.join(' ')}]`)
    .join('; ')
)

const layout = await layoutDiagram(graph, (f) => sizeOf(f))
const box = (id: string): Box => layout.boxes.get(id)!
const inOrder = (ids: string[]): boolean =>
  ids.every((id, i) => i === 0 || box(id).x > box(ids[i - 1]).x)
const level = (ids: string[]): boolean => new Set(ids.map((id) => box(id).y)).size === 1
log('filhas da raiz em ordem', inOrder(['catalogo', 'busca', 'mobile', 'pagamento']))
log('membros em ordem', inOrder(['pag_cartao', 'pag_pix', 'pag_boleto']))
log(
  'irmãs no mesmo nível',
  level(['catalogo', 'busca', 'mobile', 'pagamento']) &&
    level(['pag_cartao', 'pag_pix', 'pag_boleto'])
)
const all = [...layout.boxes.values()]
let overlaps = 0
for (let i = 0; i < all.length; i++)
  for (let j = i + 1; j < all.length; j++) {
    const [a, b] = [all[i], all[j]]
    if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height)
      overlaps++
  }
log('sobreposições', overlaps)
log('vão entre níveis', box('catalogo').y - (box('loja').y + box('loja').height))

const [arc] = layout.arcs
const pagamento = box('pagamento')
log(
  'arco de pagamento',
  `centro na base do pai: ${arc.center.x === pagamento.x + pagamento.width / 2 && arc.center.y === pagamento.y + pagamento.height} | abre para baixo: ${arc.startAngle > 0 && arc.endAngle < Math.PI && arc.startAngle < arc.endAngle}`
)

const middle = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
const target = (point: { x: number; y: number }, dragged: string): string => {
  const found = dropTargetAt(layout, point, dragged)
  return found === null ? 'nenhum' : found.kind === 'feature' ? found.featureId : found.group.id
}
const belowArc = { x: arc.center.x, y: arc.center.y + 16 }
log('alvo sobre busca', target(middle(box('busca')), 'pag_pix'))
log('alvo sobre o arco', target(belowArc, 'busca'))
log('alvo no vazio', target({ x: -500, y: -500 }, 'busca'))
log('ignora a própria feature', target(middle(box('busca')), 'busca'))

const collapsed = buildDiagramGraph(model, new Set(['pagamento']))
const pag = collapsed.features.find((f) => f.id === 'pagamento')!
log(
  'recolher pagamento',
  `${collapsed.features.map((f) => f.id).join(' ')} | +${pag.hiddenCount} | grupos: ${collapsed.groups.length}`
)
```

Rode:

```bash
npx tsx --tsconfig tsconfig.web.json .checks/diagram-check.mts
```

Esperado, exatamente:

```
pré-ordem                      → loja catalogo busca mobile pagamento pag_cartao pag_pix pag_boleto
linhas                         → catalogo● busca○ mobile○ pagamento● pag_cartao- pag_pix- pag_boleto-
grupos                         → pagamento:grupo:0 or [1..*] [pag_cartao pag_pix pag_boleto]
filhas da raiz em ordem        → true
membros em ordem               → true
irmãs no mesmo nível           → true
sobreposições                  → 0
vão entre níveis               → 72
arco de pagamento              → centro na base do pai: true | abre para baixo: true
alvo sobre busca               → busca
alvo sobre o arco              → pagamento:grupo:0
alvo no vazio                  → nenhum
ignora a própria feature       → nenhum
recolher pagamento             → loja catalogo busca mobile pagamento | +3 | grupos: 0
```

- [ ] **Passo 6: Commit**

```bash
npm run format
git add package.json package-lock.json src/renderer/src/ui/diagram
git commit -m "feat(diagram): grafo e layout do diagrama com elkjs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: Store com subárvores recolhidas e simulação de edições

**Arquivos:**

- Modificar: `src/renderer/src/ui/stores/project-store.ts`, `src/renderer/src/ui/screens/project/use-editor-shortcuts.ts`
- Verificação: `.checks/store-check.mts`

**Interfaces:**

- Consome: `executeCommand` (`application/editing/edit-history.ts`), `locateFeature` (`domain/feature-model/tree.ts`).
- Produz, em `ProjectState`:
  - `collapsedFeatureIds: ReadonlySet<string>`
  - `check(command: EditorCommand): string | null`
  - `toggleCollapsed(featureId: string): void`

- [ ] **Passo 1: Imports da store**

Em `project-store.ts`, troque:

```ts
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { findFeature } from '@/domain/feature-model/tree'
```

por:

```ts
import type { Feature, FeatureModel } from '@/domain/feature-model/feature-model'
import { findFeature, locateFeature } from '@/domain/feature-model/tree'
```

- [ ] **Passo 2: Estado e métodos novos na interface `ProjectState`**

Logo depois de `readonly selectedFeatureId: string | null`, acrescente:

```ts
  /** Subárvores recolhidas no diagrama; valem só enquanto o projeto está aberto (ADR 0007). */
  readonly collapsedFeatureIds: ReadonlySet<string>
```

Troque:

```ts
  run(command: EditorCommand): boolean
  undo(): void
  redo(): void
  selectFeature(featureId: string): void
  dismissNotice(): void
}
```

por:

```ts
  run(command: EditorCommand): boolean
  /** Simula a edição sem registrar nada: `null` se ela seria aceita, senão o motivo da recusa. */
  check(command: EditorCommand): string | null
  undo(): void
  redo(): void
  selectFeature(featureId: string): void
  /** Recolhe ou expande a subárvore da feature no diagrama. */
  toggleCollapsed(featureId: string): void
  dismissNotice(): void
}
```

- [ ] **Passo 3: Estado inicial**

Troque:

```ts
const CLOSED = {
  session: null,
  saved: null,
  history: EMPTY_HISTORY,
  selectedFeatureId: null,
```

por:

```ts
const NO_FEATURES: ReadonlySet<string> = new Set()

const CLOSED = {
  session: null,
  saved: null,
  history: EMPTY_HISTORY,
  selectedFeatureId: null,
  collapsedFeatureIds: NO_FEATURES,
```

Como `opened` e `close` partem de `CLOSED`, abrir, criar, recarregar e fechar um projeto zeram as recolhidas.

- [ ] **Passo 4: Depois de cada comando, desfazer ou refazer, revelar a feature selecionada**

Troque o `applyStep` inteiro:

```ts
const applyStep = (step: HistoryStep): void => {
  const { session, selectedFeatureId } = get()
  if (session === null) return
  const project = { ...session.project, ...step.state }
  set({
    session: { ...session, project },
    history: step.history,
    notice: null,
    selectedFeatureId: nextSelection(selectedFeatureId, project.model, step.focusFeatureId)
  })
}
```

por:

```ts
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
```

- [ ] **Passo 5: `check` e `toggleCollapsed`**

Logo depois do método `run` (que termina com `applyStep(step.value)` e `return true`), acrescente:

```ts
      check(command) {
        const { session, history } = get()
        if (session === null) return 'Nenhum projeto aberto.'
        const step = executeCommand(history, editorStateOf(session), command)
        return step.ok ? null : step.error
      },
```

Logo depois do método `selectFeature`, acrescente:

```ts
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
```

- [ ] **Passo 6: Auxiliares no fim do arquivo**

Depois da função `nextSelection`, acrescente:

```ts
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

- [ ] **Passo 7: Atalhos ignoram teclas já tratadas**

Em `use-editor-shortcuts.ts`, troque:

```ts
    const onKeyDown = (event: KeyboardEvent): void => {
      const state = store.getState()
```

por:

```ts
    const onKeyDown = (event: KeyboardEvent): void => {
      // A tecla já foi tratada por outro componente (por exemplo, Enter ou Tab num menu aberto).
      if (event.defaultPrevented) return
      const state = store.getState()
```

Sem isso, Enter num item do menu de contexto (Tarefa 3) também dispararia "Adicionar irmã".

- [ ] **Passo 8: Typecheck e lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 9: Conferir a store isolada**

Crie `.checks/store-check.mts`:

```ts
// Store do editor: recolher, simular (check) e revelar a seleção (plano da 2B).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/store-check.mts
import { readFileSync } from 'node:fs'
import * as cmd from '@/application/editing/commands'
import type { ProjectSession } from '@/application/project-session'
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { locateFeature } from '@/domain/feature-model/tree'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { createProjectStore } from '@/ui/stores/project-store'

const decoded = decodeFeatureModel(
  parseXmlRoot(readFileSync('docs/examples/loja-online/model.xml', 'utf8'))
)
if (!decoded.ok) throw new Error('o exemplo não abriu')
const session: ProjectSession = {
  folder: { rootPath: 'C:\loja', name: 'loja' },
  project: { model: decoded.value, assets: EMPTY_ASSET_CATALOG, configurations: [] },
  hashes: { model: 'x', assets: null, configurations: {} }
}
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session, warnings: [] }),
    reopen: notUsed
  },
  createProject: { execute: notUsed },
  saveProject: { execute: notUsed },
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} }
})
const state = () => store.getState()
const collapsed = (): string => [...state().collapsedFeatureIds].join(',') || '(nenhuma)'
const parentOf = (id: string): string => {
  const location = locateFeature(state().session!.project.model.root, id)
  return location === undefined || location.kind === 'root' ? '-' : location.parent.id
}
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)

await state().open()
log('ao abrir', `selecionada ${state().selectedFeatureId} | recolhidas ${collapsed()}`)

const valid = state().check(cmd.moveFeature('busca', { kind: 'child', parentId: 'mobile' }))
log(
  'check de movimento válido',
  `${valid} | pai de busca: ${parentOf('busca')} | histórico: ${state().history.past.length}`
)
log(
  'check de movimento inválido',
  state().check(cmd.moveFeature('pagamento', { kind: 'child', parentId: 'pag_pix' }))
)

state().selectFeature('pag_pix')
state().toggleCollapsed('pagamento')
log(
  'recolher com pag_pix selecionada',
  `selecionada ${state().selectedFeatureId} | recolhidas ${collapsed()}`
)
state().toggleCollapsed('pagamento')
log('expandir', `recolhidas ${collapsed()}`)

state().toggleCollapsed('pagamento')
state().toggleCollapsed('mobile')
state().run(cmd.moveFeature('busca', { kind: 'group', memberId: 'pag_pix' }))
log(
  'mover para dentro do recolhido',
  `selecionada ${state().selectedFeatureId} | pai de busca: ${parentOf('busca')} | recolhidas ${collapsed()}`
)
state().undo()
log('desfazer', `pai de busca: ${parentOf('busca')} | recolhidas ${collapsed()}`)

await state().open()
log('abrir de novo', `recolhidas ${collapsed()}`)
```

Rode:

```bash
npx tsx --tsconfig tsconfig.web.json .checks/store-check.mts
```

Esperado, exatamente:

```
ao abrir                             → selecionada loja | recolhidas (nenhuma)
check de movimento válido            → null | pai de busca: loja | histórico: 0
check de movimento inválido          → Uma feature não pode ir para dentro da própria subárvore.
recolher com pag_pix selecionada     → selecionada pagamento | recolhidas pagamento
expandir                             → recolhidas (nenhuma)
mover para dentro do recolhido       → selecionada busca | pai de busca: pagamento | recolhidas mobile
desfazer                             → pai de busca: loja | recolhidas mobile
abrir de novo                        → recolhidas (nenhuma)
```

- [ ] **Passo 10: Commit**

```bash
npm run format
git add src/renderer/src/ui/stores/project-store.ts src/renderer/src/ui/screens/project/use-editor-shortcuts.ts
git commit -m "feat(ui): store guarda subárvores recolhidas e simula edições

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Diagrama no lugar da lista

**Arquivos:**

- Criar: `src/renderer/src/ui/components/ui/context-menu.tsx` (shadcn) e, em `src/renderer/src/ui/diagram/`:
  - `measure-feature.ts`, `diagram-context.ts` e `flow-types.ts`;
  - `VariabilityEdge.tsx`, `GroupArcNode.tsx`, `FeatureMenu.tsx`, `FeatureNode.tsx` e `FeatureDiagram.tsx`.
- Modificar: `src/renderer/src/ui/screens/project/ProjectScreen.tsx`
- Remover: `src/renderer/src/ui/screens/project/FeatureTree.tsx`
- Verificação: `.checks/cdp.mjs`, `.checks/diagrama-ui.mjs`

**Interfaces:**

- Consome:
  - da Tarefa 1: `buildDiagramGraph`, `layoutDiagram`, `dropTargetAt`, `dropTargetKey` e `ARC_RADIUS`;
  - da Tarefa 2: `collapsedFeatureIds`, `toggleCollapsed`, `check`, `run` e `selectFeature`;
  - `cmd.moveFeature` e `cmd.reorderFeature` (`application/editing/commands.ts`) e `MoveDestination` (`domain/feature-model/feature-edits.ts`).
- Produz:
  - `FeatureDiagram({ model, actions })`;
  - `FeatureActions` (`addChild`, `addSibling`, `groupChildren` e `remove`, cada um recebendo um `featureId`).
  - Nos nós, os atributos que os roteiros usam: `data-feature-id` e `aria-current="true"` na feature selecionada, `data-group-id` e `data-group-kind` no arco, `data-marker` no círculo.

- [ ] **Passo 1: Componente `context-menu` do shadcn**

```bash
npx shadcn@latest add context-menu --yes
npx prettier --write src/renderer/src/ui/components/ui/context-menu.tsx
```

Confira o arquivo gerado:

- os imports são `import { cn } from 'cn'` e `import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'`;
- não há texto visível em inglês;
- `ContextMenuItem` aceita `variant="destructive"`;
- nenhuma dependência nova foi pedida.

- [ ] **Passo 2: Criar `src/renderer/src/ui/diagram/measure-feature.ts`**

```ts
import type { DiagramFeature } from './diagram-graph'
import type { Size } from './diagram-layout'

/*
 * O layout precisa do tamanho de cada caixa antes de desenhar. A largura sai do texto
 * medido no canvas com as mesmas fontes da página; FeatureNode usa estas medidas.
 */

export const NODE_HEIGHT = 50
/** Recuo horizontal da caixa (classe `px-3.5` de FeatureNode) mais a borda. */
const HORIZONTAL_CHROME = 2 * 14 + 2
const MIN_WIDTH = 88

interface Fonts {
  readonly name: string
  readonly id: string
}

let context: CanvasRenderingContext2D | null = null
let fonts: Fonts | null = null

export function measureFeature(feature: DiagramFeature): Size {
  context ??= document.createElement('canvas').getContext('2d')!
  fonts ??= {
    // Nome: text-sm font-medium; ID: text-xs font-mono (as classes de FeatureNode).
    name: `500 14px ${getComputedStyle(document.body).fontFamily}`,
    id: `12px ${getComputedStyle(document.documentElement).getPropertyValue('--font-mono')}`
  }
  const nameWidth = textWidth(context, fonts.name, feature.name)
  const idWidth = textWidth(context, fonts.id, feature.id)
  const width = Math.ceil(Math.max(nameWidth, idWidth)) + HORIZONTAL_CHROME
  return { width: Math.max(MIN_WIDTH, width), height: NODE_HEIGHT }
}

function textWidth(context: CanvasRenderingContext2D, font: string, text: string): number {
  context.font = font
  return context.measureText(text).width
}
```

- [ ] **Passo 3: Criar `src/renderer/src/ui/diagram/diagram-context.ts`**

```ts
import { createContext, useContext } from 'react'

/**
 * Ações que abrem diálogos da tela do projeto. O diagrama só as chama; quem as fornece é
 * a tela (ProjectScreen), que também as liga à barra de ações e aos atalhos.
 */
export interface FeatureActions {
  addChild(featureId: string): void
  addSibling(featureId: string): void
  groupChildren(featureId: string): void
  remove(featureId: string): void
}

export const FeatureActionsContext = createContext<FeatureActions | null>(null)

export function useFeatureActions(): FeatureActions {
  const actions = useContext(FeatureActionsContext)
  if (actions === null) throw new Error('FeatureActionsContext não foi fornecido.')
  return actions
}

/** O alvo sob o cursor durante um arrasto, e se soltar ali seria aceito. */
export interface DropHighlight {
  /** `dropTargetKey` do alvo (diagram-layout.ts). */
  readonly key: string
  readonly valid: boolean
}

export const DropHighlightContext = createContext<DropHighlight | null>(null)

/** Como destacar o alvo `key`: verde, vermelho ou nada. */
export function useDropState(key: string): 'valid' | 'invalid' | null {
  const highlight = useContext(DropHighlightContext)
  if (highlight === null || highlight.key !== key) return null
  return highlight.valid ? 'valid' : 'invalid'
}
```

- [ ] **Passo 4: Criar `src/renderer/src/ui/diagram/flow-types.ts`**

```ts
import type { Edge, Node } from '@xyflow/react'
import type { DiagramFeature, EdgeMarker } from './diagram-graph'
import type { GroupArc } from './diagram-layout'

/** Nós e linhas do React Flow que o diagrama usa. */

export type FeatureFlowNode = Node<{ feature: DiagramFeature }, 'feature'>

export type GroupArcFlowNode = Node<{ arc: GroupArc }, 'group-arc'>

export type DiagramFlowNode = FeatureFlowNode | GroupArcFlowNode

export type VariabilityFlowEdge = Edge<{ marker: EdgeMarker }, 'variability'>
```

- [ ] **Passo 5: Criar `src/renderer/src/ui/diagram/VariabilityEdge.tsx`**

```tsx
import type { EdgeProps } from '@xyflow/react'
import type { VariabilityFlowEdge } from './flow-types'

const CIRCLE_RADIUS = 5

/**
 * Linha reta do pai à filha. Na ponta da filha: círculo cheio (obrigatória), vazio
 * (opcional) ou nada (membro de grupo, que o arco do grupo já descreve).
 */
export function VariabilityEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data
}: EdgeProps<VariabilityFlowEdge>): React.JSX.Element {
  const marker = data?.marker ?? 'none'
  const length = Math.hypot(targetX - sourceX, targetY - sourceY) || 1
  const ux = (targetX - sourceX) / length
  const uy = (targetY - sourceY) / length
  const circle = { x: targetX - ux * CIRCLE_RADIUS, y: targetY - uy * CIRCLE_RADIUS }
  const end =
    marker === 'none'
      ? { x: targetX, y: targetY }
      : { x: targetX - ux * 2 * CIRCLE_RADIUS, y: targetY - uy * 2 * CIRCLE_RADIUS }

  return (
    <g>
      <path
        d={`M ${sourceX} ${sourceY} L ${end.x} ${end.y}`}
        className="fill-none stroke-foreground/60"
        strokeWidth={1.25}
      />
      {marker !== 'none' && (
        <circle
          data-marker={marker}
          cx={circle.x}
          cy={circle.y}
          r={CIRCLE_RADIUS}
          strokeWidth={1.25}
          className={
            marker === 'mandatory'
              ? 'fill-foreground stroke-foreground'
              : 'fill-background stroke-foreground'
          }
        />
      )}
    </g>
  )
}
```

- [ ] **Passo 6: Criar `src/renderer/src/ui/diagram/GroupArcNode.tsx`**

```tsx
import type { NodeProps } from '@xyflow/react'
import { useDropState } from './diagram-context'
import { ARC_RADIUS } from './diagram-layout'
import type { GroupArcFlowNode } from './flow-types'

// Classes escritas por inteiro, para o Tailwind encontrá-las no código.
const COLORS = {
  idle: { stroke: 'stroke-foreground', fill: 'fill-foreground' },
  valid: { stroke: 'stroke-emerald-500', fill: 'fill-emerald-500' },
  invalid: { stroke: 'stroke-destructive', fill: 'fill-destructive' }
}

/**
 * Arco de um grupo, colado na base do pai: vazio = alternative, cheio = or; nos demais,
 * vazio com a cardinalidade ao lado. O nó ocupa o retângulo 2r × r logo abaixo do centro,
 * e o SVG usa o centro do arco como origem (r, 0).
 */
export function GroupArcNode({ data: { arc } }: NodeProps<GroupArcFlowNode>): React.JSX.Element {
  const drop = useDropState(arc.group.id)
  const r = ARC_RADIUS
  const point = (angle: number): string => `${r + r * Math.cos(angle)} ${r * Math.sin(angle)}`
  const curve = `${point(arc.startAngle)} A ${r} ${r} 0 0 1 ${point(arc.endAngle)}`
  const filled = arc.group.kind === 'or'
  const color = COLORS[drop ?? 'idle']

  return (
    <svg
      width={2 * r}
      height={r}
      overflow="visible"
      data-group-id={arc.group.id}
      data-group-kind={arc.group.kind}
      className="pointer-events-none"
    >
      <path
        d={filled ? `M ${r} 0 L ${curve} Z` : `M ${curve}`}
        strokeWidth={drop === null ? 1.5 : 3}
        className={`${filled ? color.fill : 'fill-none'} ${color.stroke}`}
      />
      {arc.group.kind === 'custom' && (
        <text x={2 * r + 4} y={12} className="fill-foreground text-[11px]">
          {arc.group.cardinality}
        </text>
      )}
    </svg>
  )
}
```

- [ ] **Passo 7: Criar `src/renderer/src/ui/diagram/FeatureMenu.tsx`**

```tsx
import * as cmd from '@/application/editing/commands'
import { findFeature } from '@/domain/feature-model/tree'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut
} from '@/ui/components/ui/context-menu'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { useFeatureActions } from './diagram-context'

/** Itens do menu de contexto de um nó (SPEC §7); cada um faz o mesmo que o botão ou atalho. */
export function FeatureMenu({ featureId }: { readonly featureId: string }): React.JSX.Element {
  const actions = useFeatureActions()
  const model = useProjectStore((state) => state.session?.project.model)
  const collapsed = useProjectStore((state) => state.collapsedFeatureIds.has(featureId))
  const run = useProjectStore((state) => state.run)
  const toggleCollapsed = useProjectStore((state) => state.toggleCollapsed)
  const feature = model !== undefined ? findFeature(model.root, featureId) : undefined
  const isRoot = model?.root.id === featureId
  const hasChildren = (feature?.children.length ?? 0) > 0
  const hasLooseChildren = feature?.children.some((child) => child.kind === 'feature') ?? false

  return (
    <ContextMenuContent className="w-56">
      <ContextMenuItem onSelect={() => actions.addChild(featureId)}>
        Adicionar filha…<ContextMenuShortcut>Tab</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={isRoot} onSelect={() => actions.addSibling(featureId)}>
        Adicionar irmã…<ContextMenuShortcut>Enter</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!hasLooseChildren}
        onSelect={() => actions.groupChildren(featureId)}
      >
        Agrupar filhas…
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={isRoot} onSelect={() => run(cmd.reorderFeature(featureId, -1))}>
        Mover para cima<ContextMenuShortcut>Alt+↑</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={isRoot} onSelect={() => run(cmd.reorderFeature(featureId, 1))}>
        Mover para baixo<ContextMenuShortcut>Alt+↓</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem disabled={!hasChildren} onSelect={() => toggleCollapsed(featureId)}>
        {collapsed ? 'Expandir' : 'Recolher'}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        disabled={isRoot}
        onSelect={() => actions.remove(featureId)}
      >
        Excluir…<ContextMenuShortcut>Delete</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
```

- [ ] **Passo 8: Criar `src/renderer/src/ui/diagram/FeatureNode.tsx`**

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from 'cn'
import { ContextMenu, ContextMenuTrigger } from '@/ui/components/ui/context-menu'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { useDropState } from './diagram-context'
import { FeatureMenu } from './FeatureMenu'
import type { FeatureFlowNode } from './flow-types'

// Pontos de conexão invisíveis, exatamente no meio da borda de cima e da de baixo.
const HIDDEN_HANDLE = { opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0, border: 0 }

/** Caixa da feature: nome, ID e o botão de recolher; botão direito abre o menu. */
export function FeatureNode({ data: { feature } }: NodeProps<FeatureFlowNode>): React.JSX.Element {
  const selected = useProjectStore((state) => state.selectedFeatureId === feature.id)
  const selectFeature = useProjectStore((state) => state.selectFeature)
  const toggleCollapsed = useProjectStore((state) => state.toggleCollapsed)
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
            {feature.hasChildren && (
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
            )}
          </div>
        </ContextMenuTrigger>
        <FeatureMenu featureId={feature.id} />
      </ContextMenu>
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
```

- [ ] **Passo 9: Criar `src/renderer/src/ui/diagram/FeatureDiagram.tsx`**

```tsx
import '@xyflow/react/dist/base.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  applyNodeChanges,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore as useFlowStore,
  type NodeChange,
  type OnNodeDrag
} from '@xyflow/react'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import * as cmd from '@/application/editing/commands'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import type { MoveDestination } from '@/domain/feature-model/feature-edits'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import {
  DropHighlightContext,
  FeatureActionsContext,
  type DropHighlight,
  type FeatureActions
} from './diagram-context'
import { buildDiagramGraph, type DiagramGraph } from './diagram-graph'
import {
  ARC_RADIUS,
  dropTargetAt,
  dropTargetKey,
  layoutDiagram,
  type DiagramLayout,
  type DropTarget
} from './diagram-layout'
import { FeatureNode } from './FeatureNode'
import type { DiagramFlowNode, VariabilityFlowEdge } from './flow-types'
import { GroupArcNode } from './GroupArcNode'
import { measureFeature } from './measure-feature'
import { VariabilityEdge } from './VariabilityEdge'

const NODE_TYPES = { feature: FeatureNode, 'group-arc': GroupArcNode }
const EDGE_TYPES = { variability: VariabilityEdge }
const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1 }
// O React Flow desliga o mouse em nós que não são arrastáveis nem selecionáveis, como a
// raiz; as features precisam dele sempre (clique e menu de contexto). Os arcos, não.
const FEATURE_NODE_STYLE = { pointerEvents: 'all' } as const
const ARIA_LABELS = {
  'node.a11yDescription.default': 'Clique para selecionar a feature.',
  'node.a11yDescription.keyboardDisabled': 'Clique para selecionar a feature.',
  'edge.a11yDescription.default': 'Ligação entre uma feature e a filha.'
}

interface Placed {
  readonly graph: DiagramGraph
  readonly layout: DiagramLayout
}

interface Hover extends DropHighlight {
  readonly target: DropTarget
}

interface FeatureDiagramProps {
  readonly model: FeatureModel
  readonly actions: FeatureActions
}

/**
 * Diagrama do Feature Model (SPEC §7, ADR 0007): layout sempre calculado, arrastar um nó
 * muda o pai da feature, e toda edição passa pelos comandos do histórico.
 */
export function FeatureDiagram({ model, actions }: FeatureDiagramProps): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <FeatureActionsContext value={actions}>
        <DiagramCanvas model={model} />
      </FeatureActionsContext>
    </ReactFlowProvider>
  )
}

function DiagramCanvas({ model }: { readonly model: FeatureModel }): React.JSX.Element {
  const collapsed = useProjectStore((state) => state.collapsedFeatureIds)
  const selectedId = useProjectStore((state) => state.selectedFeatureId)
  const check = useProjectStore((state) => state.check)
  const run = useProjectStore((state) => state.run)
  const { fitView, getViewport, screenToFlowPosition, setCenter, zoomIn, zoomOut } = useReactFlow<
    DiagramFlowNode,
    VariabilityFlowEdge
  >()
  const viewWidth = useFlowStore((state) => state.width)
  const viewHeight = useFlowStore((state) => state.height)

  const graph = useMemo(() => buildDiagramGraph(model, collapsed), [model, collapsed])
  const [placed, setPlaced] = useState<Placed | null>(null)
  useEffect(() => {
    // Um layout antigo que termine depois de um novo é descartado.
    let current = true
    void layoutDiagram(graph, measureFeature).then((layout) => {
      if (current) setPlaced({ graph, layout })
    })
    return () => {
      current = false
    }
  }, [graph])

  const laidOut = useMemo(() => (placed === null ? [] : toFlowNodes(placed)), [placed])
  const edges = useMemo(() => (placed === null ? [] : toFlowEdges(placed.graph)), [placed])

  // Os nós seguem o layout; entre um layout e outro, só o arrasto muda a posição de um nó.
  const [nodes, setNodes] = useState<DiagramFlowNode[]>([])
  const [source, setSource] = useState<DiagramFlowNode[]>([])
  if (source !== laidOut) {
    setSource(laidOut)
    setNodes(laidOut)
  }
  const onNodesChange = (changes: NodeChange<DiagramFlowNode>[]): void => {
    const allowed = changes.filter(
      (change) => change.type === 'position' || change.type === 'dimensions'
    )
    setNodes((current) => applyNodeChanges(allowed, current))
  }

  const [hover, setHover] = useState<Hover | null>(null)
  const onNodeDrag: OnNodeDrag<DiagramFlowNode> = (event, node) => {
    if (placed === null) return
    const pointer = 'changedTouches' in event ? event.changedTouches[0] : event
    const point = screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY })
    const target = dropTargetAt(placed.layout, point, node.id)
    const key = target === null ? null : dropTargetKey(target)
    if (key === (hover?.key ?? null)) return
    setHover(
      target === null
        ? null
        : {
            key: key!,
            target,
            valid: check(cmd.moveFeature(node.id, destinationOf(target))) === null
          }
    )
  }
  const onNodeDragStop: OnNodeDrag<DiagramFlowNode> = (_event, node) => {
    // Alvo inválido: o comando é recusado e o motivo aparece no aviso de edição recusada.
    if (hover !== null) run(cmd.moveFeature(node.id, destinationOf(hover.target)))
    setHover(null)
    setNodes(laidOut)
  }

  // Ao abrir, ajusta à tela; depois, só rola se a feature selecionada sair da área visível.
  const fitted = useRef(false)
  useEffect(() => {
    if (placed === null || viewWidth === 0) return
    if (!fitted.current) {
      fitted.current = true
      void fitView(FIT_VIEW_OPTIONS)
      return
    }
    const box = selectedId !== null ? placed.layout.boxes.get(selectedId) : undefined
    if (box === undefined) return
    const { x, y, zoom } = getViewport()
    const left = box.x * zoom + x
    const top = box.y * zoom + y
    const visible =
      left >= 0 &&
      top >= 0 &&
      left + box.width * zoom <= viewWidth &&
      top + box.height * zoom <= viewHeight
    if (!visible)
      void setCenter(box.x + box.width / 2, box.y + box.height / 2, { zoom, duration: 200 })
  }, [placed, selectedId, viewWidth, viewHeight, fitView, getViewport, setCenter])

  return (
    <DropHighlightContext value={hover}>
      <ReactFlow<DiagramFlowNode, VariabilityFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        disableKeyboardA11y
        nodeDragThreshold={4}
        minZoom={0.2}
        maxZoom={2}
        ariaLabelConfig={ARIA_LABELS}
        proOptions={{ hideAttribution: true }}
      >
        <Panel position="bottom-left" className="flex gap-1">
          <Button size="icon-sm" variant="outline" title="Aproximar" onClick={() => void zoomIn()}>
            <ZoomIn />
          </Button>
          <Button size="icon-sm" variant="outline" title="Afastar" onClick={() => void zoomOut()}>
            <ZoomOut />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            title="Ajustar à tela"
            onClick={() => void fitView(FIT_VIEW_OPTIONS)}
          >
            <Maximize />
          </Button>
        </Panel>
      </ReactFlow>
    </DropHighlightContext>
  )
}

function destinationOf(target: DropTarget): MoveDestination {
  return target.kind === 'feature'
    ? { kind: 'child', parentId: target.featureId }
    : { kind: 'group', memberId: target.group.memberIds[0] }
}

/** Features em pré-ordem (a ordem do DOM), depois os arcos dos grupos. */
function toFlowNodes({ graph, layout }: Placed): DiagramFlowNode[] {
  const features: DiagramFlowNode[] = graph.features.map((feature) => {
    const box = layout.boxes.get(feature.id)!
    return {
      id: feature.id,
      type: 'feature',
      position: { x: box.x, y: box.y },
      width: box.width,
      height: box.height,
      draggable: !feature.isRoot,
      style: FEATURE_NODE_STYLE,
      data: { feature }
    }
  })
  const arcs: DiagramFlowNode[] = layout.arcs.map((arc) => ({
    id: arc.group.id,
    type: 'group-arc',
    position: { x: arc.center.x - ARC_RADIUS, y: arc.center.y },
    width: 2 * ARC_RADIUS,
    height: ARC_RADIUS,
    draggable: false,
    data: { arc }
  }))
  return [...features, ...arcs]
}

function toFlowEdges(graph: DiagramGraph): VariabilityFlowEdge[] {
  return graph.edges.map((edge) => ({
    id: `${edge.parentId}->${edge.childId}`,
    source: edge.parentId,
    target: edge.childId,
    type: 'variability',
    data: { marker: edge.marker }
  }))
}
```

- [ ] **Passo 10: Diagrama na tela do projeto**

Substitua o conteúdo de `src/renderer/src/ui/screens/project/ProjectScreen.tsx` por:

```tsx
import { useCallback, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { ProjectSession } from '@/application/project-session'
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
import type { FeatureActions } from '@/ui/diagram/diagram-context'
import { FeatureDiagram } from '@/ui/diagram/FeatureDiagram'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { ConstraintsPanel } from './constraints/ConstraintsPanel'
import { CloseProjectDialog } from './dialogs/CloseProjectDialog'
import { ConflictDialog } from './dialogs/ConflictDialog'
import { CreateGroupDialog } from './dialogs/CreateGroupDialog'
import { DeleteFeatureDialog } from './dialogs/DeleteFeatureDialog'
import { NewFeatureDialog } from './dialogs/NewFeatureDialog'
import type { EditorDialog } from './editor-dialog'
import { FeatureToolbar } from './FeatureToolbar'
import { ProjectHeader } from './ProjectHeader'
import { FeatureProperties } from './properties/FeatureProperties'
import { useEditorShortcuts } from './use-editor-shortcuts'

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
  const [dialog, setDialog] = useState<EditorDialog>(null)
  const openDialog = useCallback((next: EditorDialog) => setDialog(next), [])
  useEditorShortcuts(openDialog, dialog === null)
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
      <ProjectHeader session={session} onClose={requestClose} />

      {notice !== null && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span className="flex-1">Edição recusada: {notice}</span>
          <Button size="icon-sm" variant="ghost" title="Dispensar" onClick={dismissNotice}>
            <X />
          </Button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_24rem]">
        <section className="flex min-h-0 flex-col gap-3 p-4">
          <ProblemList title="Não foi possível salvar" tone="error" problems={problems} />
          <ProblemList title="Avisos" tone="warning" problems={warnings} />
          <FeatureToolbar model={project.model} onOpenDialog={openDialog} />
          <div className="min-h-0 flex-1 rounded-md border">
            <FeatureDiagram key={session.folder.rootPath} model={project.model} actions={actions} />
          </div>
        </section>
        <aside className="min-h-0 space-y-8 overflow-auto border-l p-4">
          <FeatureProperties project={project} />
          <ConstraintsPanel model={project.model} />
        </aside>
      </div>

      <footer className="border-t px-4 py-1 text-xs text-muted-foreground">
        {project.assets.assets.length} assets · {project.configurations.length} configurações
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
      <ConflictDialog />
    </main>
  )
}
```

Remova a lista:

```bash
git rm src/renderer/src/ui/screens/project/FeatureTree.tsx
```

- [ ] **Passo 11: Typecheck, lint e build**

```bash
npm run typecheck && npm run lint && npm run build
```

Esperado: sem erros; três `✓ built in ...`.

- [ ] **Passo 12: Percorrer o diagrama com entrada real**

O roteiro abre o projeto pela lista de recentes, sem o diálogo nativo, e usa cliques, botão direito, arrastos e teclas de verdade (`Input.dispatch*` do protocolo do Chromium). A emulação de foco garante o mesmo resultado com a janela em segundo plano.

Crie `.checks/cdp.mjs`:

```js
// Cliente mínimo do protocolo de depuração do Chromium, com entrada "de verdade":
// cliques do mouse, texto por Input.insertText (acentos ok) e teclas por Input.dispatchKeyEvent.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export { sleep }

export async function connect(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
  const page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve))
  let nextId = 1
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      ws.addEventListener('message', function onMessage(event) {
        const message = JSON.parse(event.data)
        if (message.id !== id) return
        ws.removeEventListener('message', onMessage)
        if (message.error) reject(new Error(`${method}: ${message.error.message}`))
        else resolve(message.result)
      })
      ws.send(JSON.stringify({ id, method, params }))
    })

  const js = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (result.exceptionDetails) {
      throw new Error(`EXCEÇÃO: ${result.exceptionDetails.exception?.description}`)
    }
    return result.result.value
  }

  // Localiza por seletor CSS ou pelo texto visível: { text } (igual) ou { startsWith }.
  // Sem { tag }, procura em button e label.
  const locate = (target) => {
    if (typeof target === 'string') return `document.querySelector(${JSON.stringify(target)})`
    const all = `[...document.querySelectorAll(${JSON.stringify(target.tag ?? 'button, label')})]`
    return target.startsWith !== undefined
      ? `${all}.find((el) => el.innerText.trim().startsWith(${JSON.stringify(target.startsWith)}))`
      : `${all}.find((el) => el.innerText.trim() === ${JSON.stringify(target.text)})`
  }

  const center = async (target) => {
    const box = await js(`(() => {
      const el = ${locate(target)}
      if (!el) return null
      // No diagrama, rolar o elemento deslocaria a tela do React Flow.
      if (!el.closest('.react-flow')) el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: !!el.disabled || el.dataset.disabled !== undefined }
    })()`)
    if (box === null) throw new Error(`não achei ${JSON.stringify(target)}`)
    if (box.disabled) throw new Error(`desabilitado: ${JSON.stringify(target)}`)
    return box
  }

  const mouse = (type, x, y, extra = {}) =>
    send('Input.dispatchMouseEvent', { type, x, y, clickCount: 1, ...extra })

  const click = async (target) => {
    const { x, y } = await center(target)
    await mouse('mouseMoved', x, y)
    await mouse('mousePressed', x, y, { button: 'left', buttons: 1 })
    await mouse('mouseReleased', x, y, { button: 'left', buttons: 0 })
    await sleep(200)
  }

  const rightClick = async (target) => {
    const { x, y } = await center(target)
    await mouse('mouseMoved', x, y)
    await mouse('mousePressed', x, y, { button: 'right', buttons: 2 })
    await mouse('mouseReleased', x, y, { button: 'right', buttons: 0 })
    await sleep(300)
  }

  // Arrasta com o botão esquerdo de `from` até `to` (elemento ou ponto { x, y } da tela),
  // em passos; `during` roda com o botão ainda pressionado, antes de soltar.
  const drag = async (from, to, { steps = 12, during } = {}) => {
    const a = await center(from)
    const b = typeof to === 'object' && 'x' in to ? to : await center(to)
    await mouse('mouseMoved', a.x, a.y)
    await mouse('mousePressed', a.x, a.y, { button: 'left', buttons: 1 })
    for (let i = 1; i <= steps; i++) {
      const x = a.x + ((b.x - a.x) * i) / steps
      const y = a.y + ((b.y - a.y) * i) / steps
      await mouse('mouseMoved', x, y, { button: 'left', buttons: 1 })
      await sleep(20)
    }
    await sleep(200)
    const observed = during ? await during() : undefined
    await mouse('mouseReleased', b.x, b.y, { button: 'left', buttons: 0 })
    await sleep(500)
    return observed
  }

  const KEYS = {
    Tab: { code: 'Tab', vk: 9 },
    Enter: { code: 'Enter', vk: 13, text: '\r' },
    Escape: { code: 'Escape', vk: 27 },
    Delete: { code: 'Delete', vk: 46 },
    ArrowUp: { code: 'ArrowUp', vk: 38 },
    ArrowDown: { code: 'ArrowDown', vk: 40 },
    s: { code: 'KeyS', vk: 83 },
    z: { code: 'KeyZ', vk: 90 },
    y: { code: 'KeyY', vk: 89 },
    a: { code: 'KeyA', vk: 65 }
  }
  // modifiers: Alt=1, Ctrl=2, Meta=4, Shift=8
  const press = async (key, { ctrl = false, alt = false, shift = false } = {}) => {
    const k = KEYS[key]
    const modifiers = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (shift ? 8 : 0)
    const base = { key, code: k.code, windowsVirtualKeyCode: k.vk, modifiers }
    const withText = k.text !== undefined && modifiers === 0
    await send('Input.dispatchKeyEvent', {
      type: withText ? 'keyDown' : 'rawKeyDown',
      ...base,
      ...(withText ? { text: k.text, unmodifiedText: k.text } : {})
    })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
    await sleep(250)
  }

  // Clica no campo, seleciona o conteúdo e digita por cima (substitui o que houver).
  const fill = async (selector, value) => {
    await click(selector)
    await js(`document.querySelector(${JSON.stringify(selector)}).select()`)
    await send('Input.insertText', { text: value })
    await sleep(200)
  }

  // <select>: o popup nativo não é alcançável; troca o valor como o teclado faria.
  const choose = async (selector, value) => {
    await js(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      el.focus()
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)})
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })()`)
    await sleep(200)
  }

  const text = (selector) =>
    js(
      `document.querySelector(${JSON.stringify(selector)})?.innerText.replace(/\\s+/g, ' ').trim() ?? '(nada)'`
    )
  const value = (selector) => js(`document.querySelector(${JSON.stringify(selector)})?.value`)
  const tree = () =>
    js(
      `[...document.querySelectorAll('[data-feature-id]')].map((b) => b.dataset.featureId).join(' ')`
    )
  const selected = () =>
    js(
      `(document.querySelector('[data-feature-id][aria-current=true]') ?? document.querySelector('[aria-selected=true] > button'))?.dataset.featureId ?? '(nenhuma)'`
    )
  const title = () => js('document.title')
  const notice = () =>
    js(
      `[...document.querySelectorAll('main span')].find((s) => s.innerText.startsWith('Edição recusada'))?.innerText ?? '(sem aviso)'`
    )
  const waitFor = async (expression, timeoutMs = 10000) => {
    for (let waited = 0; waited < timeoutMs; waited += 200) {
      if (await js(expression)) return true
      await sleep(200)
    }
    throw new Error(`tempo esgotado esperando: ${expression}`)
  }

  return {
    ws,
    send,
    js,
    center,
    click,
    rightClick,
    drag,
    press,
    fill,
    choose,
    text,
    value,
    tree,
    selected,
    title,
    notice,
    waitFor,
    close: () => ws.close()
  }
}

export const log = (label, value) => console.log(label.padEnd(36), '→', value)
```

Crie `.checks/diagrama-ui.mjs`:

```js
// Roteiro do diagrama (plano da 2B, Tarefa 3), com entrada real pelo protocolo do Chromium.
// Uso: node .checks/diagrama-ui.mjs <porta>
// O app precisa estar na tela inicial, com uma cópia de docs/examples/loja-online nos recentes.
import { connect, log, sleep } from './cdp.mjs'

const ui = await connect(process.argv[2])
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
const { click, rightClick, drag, press, fill, text, tree, selected, title, notice, js, waitFor } =
  ui
const node = (id) => `[data-feature-id="${id}"]`
const ring = (id) =>
  js(
    `(() => { const c = document.querySelector('${node(id)}').className; return c.includes('ring-emerald') ? 'verde' : c.includes('ring-destructive') ? 'vermelho' : 'sem destaque' })()`
  )
const edgesFrom = (id) =>
  js(
    `[...document.querySelectorAll('.react-flow__edge[data-id^="${id}->"]')].map((e) => e.dataset.id.split('->')[1]).join(' ')`
  )

// 1. Abrir pelo recente e conferir o desenho
await click('main section ul button')
await waitFor(`document.querySelectorAll('[data-feature-id]').length > 0`)
await sleep(800)
log('título ao abrir', await title())
log('nós (ordem do DOM)', await tree())
log('selecionada', await selected())
log(
  'pontas das linhas',
  await js(
    `[...document.querySelectorAll('.react-flow__edge')].map((e) => e.dataset.id.split('->')[1] + ({ mandatory: '●', optional: '○' }[e.querySelector('circle')?.dataset.marker] ?? '-')).join(' ')`
  )
)
log(
  'arcos',
  await js(
    `[...document.querySelectorAll('[data-group-id]')].map((s) => s.dataset.groupId + ' ' + s.dataset.groupKind).join('; ')`
  )
)
log(
  'texto cortado',
  await js(
    `[...document.querySelectorAll('[data-feature-id] > span, [data-feature-id] > code')].filter((el) => el.scrollWidth > el.clientWidth).map((el) => el.textContent).join(', ') || 'nenhum'`
  )
)

// 2. Menu de contexto: seleciona o nó, itens em português, os que não se aplicam desabilitados
await rightClick(node('busca'))
log('botão direito seleciona', await selected())
log('menu', await text('[role=menu]'))
log(
  'desabilitados',
  await js(
    `[...document.querySelectorAll('[role=menuitem][data-disabled]')].map((i) => i.firstChild.textContent).join(', ')`
  )
)
await click({ tag: '[role=menuitem]', startsWith: 'Adicionar filha' })
log('diálogo pelo menu', await text('[role=dialog] h2'))
await fill('#new-feature-name', 'Relatório')
await click({ text: 'Criar' })
await waitFor(`document.querySelector('${node('relatorio')}') !== null`)
log('criada', `${await selected()} | ${await tree()}`)
log('página livre depois do menu', await js(`getComputedStyle(document.body).pointerEvents`))

// 3. Enter num item do menu não vira o atalho "Adicionar irmã"
await rightClick(node('busca'))
for (let i = 0; i < 4; i++) await press('ArrowDown')
log('item com foco', await js(`document.activeElement.firstChild?.textContent`))
await press('Enter')
await sleep(400)
log(
  'Enter no menu',
  `diálogos abertos: ${await js(`document.querySelectorAll('[role=dialog]').length`)} | ${await tree()}`
)
await press('z', { ctrl: true })
await sleep(400)

// 4. Arrastar e soltar
const overMobile = await drag(node('relatorio'), node('mobile'), { during: () => ring('mobile') })
await sleep(500)
log(
  'soltar sobre mobile',
  `destaque: ${overMobile} | filhas de mobile: ${await edgesFrom('mobile')} | selecionada: ${await selected()}`
)
const overPix = await drag(node('pagamento'), node('pag_pix'), { during: () => ring('pag_pix') })
await sleep(400)
log('soltar na própria subárvore', `destaque: ${overPix} | ${await notice()}`)
const overArc = await drag(node('busca'), '[data-group-id="pagamento:grupo:0"]', {
  during: () =>
    js(`document.querySelector('[data-group-id="pagamento:grupo:0"] path').getAttribute('class')`)
})
await sleep(500)
log('soltar sobre o arco', `destaque: ${overArc} | membros: ${await edgesFrom('pagamento')}`)

// 5. Recolher com a seleção dentro, e soltar sobre um nó recolhido
await click(`${node('pagamento')} button`)
await sleep(500)
log(
  'recolher',
  `${await tree()} | botão: ${await text(`${node('pagamento')} button`)} | selecionada: ${await selected()}`
)
await drag(node('catalogo'), node('pagamento'))
await sleep(700)
log('soltar sobre o recolhido', `${await tree()} | selecionada: ${await selected()}`)
for (let i = 0; i < 4; i++) await press('z', { ctrl: true })
await sleep(600)
log('Ctrl+Z ×4', `${await tree()} | ${await title()}`)

// 6. Excluir pelo menu mostra o impacto
await rightClick(node('pag_pix'))
await click({ tag: '[role=menuitem]', startsWith: 'Excluir' })
log('Excluir… pelo menu', await text('[role=dialog]'))
await click({ text: 'Cancelar' })

// 7. A feature nova fora da área visível faz a tela rolar até ela
for (let i = 0; i < 4; i++) await click('button[title="Aproximar"]')
await click(node('pag_boleto'))
await press('Tab')
await fill('#new-feature-name', 'Carnê')
await click({ text: 'Criar' })
await sleep(900)
const visible = await js(`(() => {
  const pane = document.querySelector('.react-flow').getBoundingClientRect()
  const r = document.querySelector('${node('carne')}').getBoundingClientRect()
  return r.left >= pane.left && r.right <= pane.right && r.top >= pane.top && r.bottom <= pane.bottom
})()`)
log('feature nova fora da tela', `${await selected()} | ficou visível: ${visible}`)
await press('z', { ctrl: true })
await click('button[title="Ajustar à tela"]')
await sleep(400)
// 8. Notação dos grupos: alternative (arco vazio), personalizada ([n..m]) e or (cheio)
const arc = () =>
  js(`(() => {
    const svg = document.querySelector('[data-group-id="pagamento:grupo:0"]')
    const label = svg.querySelector('text')?.textContent ?? 'nenhum'
    return svg.dataset.groupKind + ' | ' + svg.querySelector('path').getAttribute('class') + ' | rótulo: ' + label
  })()`)
await click(node('pag_pix'))
await click({ text: 'Alternative [1..1]' })
await sleep(500)
log('grupo alternative', await arc())
await fill('input[aria-label="Mínimo"]', '2')
await fill('input[aria-label="Máximo (número ou *)"]', '3')
await click({ text: 'Aplicar' })
await sleep(500)
log('grupo personalizado', await arc())
await press('z', { ctrl: true })
await press('z', { ctrl: true })
await sleep(500)
log('Ctrl+Z ×2 volta ao or', await arc())
log('final', `${await tree()} | ${await title()}`)
log('erros no console', errors.length > 0 ? errors.join(' | ') : 'nenhum')
ui.close()
```

Prepare uma cópia do exemplo e os recentes, e abra o app compilado:

```bash
rm -rf .checks/ui-data .checks/loja-ui && mkdir -p .checks/ui-data
cp -r docs/examples/loja-online .checks/loja-ui
node -e "require('fs').writeFileSync('.checks/ui-data/recent-projects.json', JSON.stringify([{ rootPath: process.argv[1], name: 'loja-ui' }]))" "$(cygpath -w "$PWD/.checks/loja-ui")"
./node_modules/electron/dist/electron.exe . --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/ui-data")" &
```

Espere a janela aparecer e rode:

```bash
node .checks/diagrama-ui.mjs 9333
```

Esperado, exatamente:

```
título ao abrir                      → Loja Online — mdd
nós (ordem do DOM)                   → loja catalogo busca mobile pagamento pag_cartao pag_pix pag_boleto
selecionada                          → loja
pontas das linhas                    → catalogo● busca○ mobile○ pagamento● pag_cartao- pag_pix- pag_boleto-
arcos                                → pagamento:grupo:0 or
texto cortado                        → nenhum
botão direito seleciona              → busca
menu                                 → Adicionar filha… Tab Adicionar irmã… Enter Agrupar filhas… Mover para cima Alt+↑ Mover para baixo Alt+↓ Recolher Excluir… Delete
desabilitados                        → Agrupar filhas…, Recolher
diálogo pelo menu                    → Nova filha de “Busca”
criada                               → relatorio | loja catalogo busca relatorio mobile pagamento pag_cartao pag_pix pag_boleto
página livre depois do menu          → auto
item com foco                        → Mover para cima
Enter no menu                        → diálogos abertos: 0 | loja busca relatorio catalogo mobile pagamento pag_cartao pag_pix pag_boleto
soltar sobre mobile                  → destaque: verde | filhas de mobile: relatorio | selecionada: relatorio
soltar na própria subárvore          → destaque: vermelho | Edição recusada: Uma feature não pode ir para dentro da própria subárvore.
soltar sobre o arco                  → destaque: fill-emerald-500 stroke-emerald-500 | membros: pag_cartao pag_pix pag_boleto busca
recolher                             → loja catalogo mobile relatorio pagamento | botão: +4 | selecionada: pagamento
soltar sobre o recolhido             → loja mobile relatorio pagamento pag_cartao pag_pix pag_boleto busca catalogo | selecionada: catalogo
Ctrl+Z ×4                            → loja catalogo busca mobile pagamento pag_cartao pag_pix pag_boleto | Loja Online — mdd
Excluir… pelo menu                   → Excluir “PIX”? Dá para desfazer com Ctrl+Z enquanto o projeto estiver aberto. Features excluídas (1) PIX Restrições removidas inteiras (1) pag_pix implies mobile Assets desvinculados (os arquivos continuam no disco) (2) docs/pagamento/pix.xml docs/img/pix-fluxo.svg Configurações que vão abrir como desatualizadas (1) Loja Básica Cancelar Excluir Fechar
feature nova fora da tela            → carne | ficou visível: true
grupo alternative                    → alternative | fill-none stroke-foreground | rótulo: nenhum
grupo personalizado                  → custom | fill-none stroke-foreground | rótulo: [2..3]
Ctrl+Z ×2 volta ao or                → or | fill-foreground stroke-foreground | rótulo: nenhum
final                                → loja catalogo busca mobile pagamento pag_cartao pag_pix pag_boleto | Loja Online — mdd
erros no console                     → nenhum
```

Feche o app.

- [ ] **Passo 13: Commit**

```bash
npm run format
git add -A
git commit -m "feat(diagram): diagrama com React Flow, menu de contexto, arrastar e soltar e subárvores recolhíveis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: Aceitação da fase, documentação e instalador

**Arquivos:**

- Modificar: `docs/HANDOFF.md`
- Verificação: `.checks/main-dialogs.mjs`, `.checks/aceitacao-2b.mjs`, `.checks/ui-check.mjs`

**Interfaces:**

- Consome: tudo das Tarefas 1–3.
- Produz: o instalador e o registro da aceitação.

- [ ] **Passo 1: Gerar o instalador**

```bash
npm run build:win
```

Esperado: `building target=nsis file=dist\mdd-0.1.0-setup.exe` sem erro.

- [ ] **Passo 2: Controle dos diálogos nativos, sem a tela**

O app roda com `--inspect`, e o script troca `dialog.showOpenDialog` e `dialog.showMessageBoxSync` no processo main. As novas versões registram o que o app pediu e devolvem a resposta escolhida. Crie `.checks/main-dialogs.mjs`:

```js
// Responde os diálogos nativos do processo main sem usar a tela: pelo inspetor do Node
// (app aberto com --inspect=<porta>), troca dialog.showOpenDialog / showMessageBoxSync por
// versões que registram o que o app pediu e devolvem a resposta escolhida.
// Uso: node .checks/main-dialogs.mjs <porta-inspect> <ação> [argumento]
//   pasta <caminho>        → o próximo "escolher pasta" devolve esse caminho
//   respostas <b1,b2,...>  → as próximas confirmações escolhem esses botões (pelo texto)
//   fechar-janela          → fecha a janela como o X da barra de título (evento 'close')
//   registro               → mostra os diálogos pedidos até agora
const [port, action, argument] = process.argv.slice(2)

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const ws = new WebSocket(targets[0].webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve))
const evaluate = (expression) =>
  new Promise((resolve, reject) => {
    ws.addEventListener('close', () => reject(new Error('conexão encerrada')))
    ws.addEventListener('message', function onMessage(event) {
      const message = JSON.parse(event.data)
      if (message.id !== 1) return
      ws.removeEventListener('message', onMessage)
      const result = message.result
      if (message.error) reject(new Error(message.error.message))
      else if (result.exceptionDetails)
        reject(new Error(result.exceptionDetails.exception?.description))
      else resolve(result.result.value)
    })
    ws.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true }
      })
    )
  })

const setup = `
  const { dialog, BrowserWindow } = require('electron')
  globalThis.__dialogs ??= { log: [], folder: null, answers: [] }
  const state = globalThis.__dialogs
`

const expressions = {
  pasta: `(async () => { ${setup}
    state.folder = ${JSON.stringify(argument)}
    dialog.showOpenDialog = async (...args) => {
      const options = args.at(-1)
      state.log.push({ diálogo: 'escolher pasta', título: options.title, propriedades: options.properties, resposta: state.folder })
      return { canceled: false, filePaths: [state.folder] }
    }
    return 'escolher pasta → ' + state.folder
  })()`,
  respostas: `(async () => { ${setup}
    state.answers = ${JSON.stringify((argument ?? '').split(','))}
    dialog.showMessageBoxSync = (...args) => {
      const options = args.at(-1)
      const answer = state.answers.shift()
      const index = options.buttons.indexOf(answer)
      if (index < 0) throw new Error('botão inexistente: ' + answer)
      state.log.push({ diálogo: 'confirmação', título: options.title, mensagem: options.message, detalhe: options.detail, botões: options.buttons, resposta: answer })
      return index
    }
    return 'próximas confirmações → ' + state.answers.join(', ')
  })()`,
  'fechar-janela': `(async () => { ${setup}
    const [window] = BrowserWindow.getAllWindows()
    window.close()
    await new Promise((resolve) => setTimeout(resolve, 500))
    return BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).length === 1
      ? 'janela continua aberta'
      : 'janela fechada'
  })()`,
  registro: `(async () => { ${setup} return JSON.stringify(state.log, null, 2) })()`
}

try {
  console.log(await evaluate(expressions[action]))
} catch (error) {
  // Fechar a última janela encerra o app, e a conexão cai antes da resposta.
  console.log(
    action === 'fechar-janela' ? 'conexão encerrada (o app saiu)' : `ERRO: ${error.message}`
  )
}
ws.close()
```

- [ ] **Passo 3: Roteiro da aceitação pelo diagrama**

Crie `.checks/aceitacao-2b.mjs`:

```js
// Aceitação da Fase 2B pelo diagrama (plano da 2B). Os diálogos nativos são respondidos
// pelo inspetor do main (.checks/main-dialogs.mjs), sem operar a tela.
// Uso: node .checks/aceitacao-2b.mjs <porta> <etapa> [pasta-do-projeto]
// Etapas: novo | recriar | editar | recentes
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect, log, sleep } from './cdp.mjs'

const [port, stage, projectDir] = process.argv.slice(2)
const repo = fileURLToPath(new URL('..', import.meta.url))
const ui = await connect(port)
// A janela pode estar sem o foco do Windows: sem isto, os campos não gravam ao sair.
await ui.send('Emulation.setFocusEmulationEnabled', { enabled: true })
const {
  click,
  rightClick,
  drag,
  press,
  fill,
  choose,
  text,
  value,
  tree,
  selected,
  title,
  notice,
  waitFor
} = ui
const node = (id) => `[data-feature-id="${id}"]`
const edgesFrom = (id) =>
  ui.js(
    `[...document.querySelectorAll('.react-flow__edge[data-id^="${id}->"]')].map((e) => e.dataset.id.split('->')[1]).join(' ')`
  )
const shown = (id) => waitFor(`document.querySelector('${node(id)}') !== null`)

// Cria pelo menu de contexto ("filha" ou "irmã"), pelo atalho (Tab) ou pelo botão da barra.
const create = async (how, fromId, name, id) => {
  if (how === 'menu-filha' || how === 'menu-irmã') {
    await rightClick(node(fromId))
    await click({
      tag: '[role=menuitem]',
      startsWith: how === 'menu-filha' ? 'Adicionar filha' : 'Adicionar irmã'
    })
  } else {
    await click(node(fromId))
    if (how === 'Tab') await press('Tab')
    else await click({ text: 'Filha' })
  }
  const heading = await text('[role=dialog] h2')
  await fill('#new-feature-name', name)
  if (id !== undefined) await fill('#new-feature-id', id)
  await click({ text: 'Criar' })
  await waitFor(`document.querySelector('[data-feature-id][aria-current=true]') !== null`)
  log(`${how} em ${fromId}`, `${heading} | criada e selecionada: ${await selected()}`)
}

const addAttribute = async ({ name, type, options, min, max, defaultValue, fixed }) => {
  await click({ text: 'Adicionar' })
  await fill('#attribute-name', name)
  if (type !== 'string') await choose('#attribute-type', type)
  if (options !== undefined) await fill('#attribute-options', options)
  if (min !== undefined) await fill('input[aria-label="Mínimo"]', min)
  if (max !== undefined) await fill('input[aria-label="Máximo"]', max)
  if (defaultValue !== undefined) await fill('#attribute-default', defaultValue)
  if (fixed) {
    await click({
      tag: 'label',
      text: 'Valor fixo, definido no modelo (senão, cada produto escolhe)'
    })
  }
  await click({ text: 'Adicionar atributo' })
  log(`atributos de ${await selected()}`, await text('aside section > div.space-y-2 > ul'))
}

if (stage === 'novo') {
  await waitFor(`document.querySelector('main h1')?.innerText === 'mdd'`)
  await click({ text: 'Novo projeto' })
  await fill('#new-project-name', 'Loja Online')
  log('ID sugerido', await value('#new-project-id'))
  await fill('#new-project-id', 'loja')
  await click({ text: 'Escolher pasta…' })
}

if (stage === 'recriar') {
  await shown('loja')
  await sleep(500)
  log('título ao abrir', await title())
  log('diagrama', `${await tree()} | selecionada: ${await selected()}`)

  await fill('#feature-description', 'Raiz da linha de produtos de lojas virtuais.')
  await press('Enter', { ctrl: true })
  await addAttribute({ name: 'Versão', type: 'string', defaultValue: '1.0', fixed: true })

  await create('menu-filha', 'loja', 'Catálogo')
  await click({ text: '● Obrigatória' })
  await create('Tab', 'loja', 'Busca')
  await addAttribute({
    name: 'Máx. resultados',
    type: 'number',
    defaultValue: '50',
    min: '10',
    max: '500'
  })
  await create('menu-filha', 'loja', 'App mobile', 'mobile')
  await create('barra', 'loja', 'Pagamento')
  await click({ text: '● Obrigatória' })

  await create('menu-filha', 'pagamento', 'Cartão', 'pag_cartao')
  await create('menu-irmã', 'pag_cartao', 'PIX', 'pag_pix')
  await rightClick(node('pagamento'))
  await click({ tag: '[role=menuitem]', startsWith: 'Agrupar filhas' })
  await click({ tag: 'label', text: 'Or [1..*]: pelo menos uma' })
  await click({ text: 'Criar grupo' })
  await shown('pag_pix')
  log(
    'grupo criado pelo menu',
    `${await ui.js(`[...document.querySelectorAll('[data-group-id]')].map((g) => g.dataset.groupId + ' ' + g.dataset.groupKind).join('; ')`)} | membros: ${await edgesFrom('pagamento')}`
  )

  // Boleto nasce fora de Pagamento e é arrastado até o arco do grupo.
  await create('Tab', 'loja', 'Boleto', 'pag_boleto')
  const arcState = await drag(node('pag_boleto'), '[data-group-id="pagamento:grupo:0"]', {
    during: () =>
      ui.js(
        `document.querySelector('[data-group-id="pagamento:grupo:0"] path').getAttribute('class')`
      )
  })
  await sleep(500)
  log(
    'arrastar Boleto até o arco',
    `destaque: ${arcState} | membros: ${await edgesFrom('pagamento')} | filhas da raiz: ${await edgesFrom('loja')}`
  )

  await click(node('mobile'))
  await addAttribute({ name: 'Plataforma', type: 'enum', options: 'android, ios, ambas' })
  await click({ text: 'Nova' })
  await fill('#constraint-expression', 'pag_pix implies mobile')
  await fill('#constraint-description', 'PIX exige app mobile')
  await click({ text: 'Adicionar restrição' })

  log('diagrama final', await tree())
  log('aviso de edição recusada', await notice())
  await press('s', { ctrl: true })
  await waitFor(`!document.title.startsWith('•')`)
  await sleep(500)
  log('Ctrl+S', await title())
  const saved = readFileSync(join(projectDir, 'model.xml'))
  const expected = readFileSync(join(repo, 'docs/examples/loja-online/model.xml'))
  log('model.xml igual ao exemplo', saved.equals(expected))
  if (!saved.equals(expected)) console.log(saved.toString('utf8'))

  // Arrasto inválido: Pagamento para dentro da própria subárvore.
  const ring = await drag(node('pagamento'), node('pag_pix'), {
    during: () =>
      ui.js(
        `document.querySelector('${node('pag_pix')}').className.includes('ring-destructive') ? 'vermelho' : 'sem vermelho'`
      )
  })
  await sleep(400)
  log(
    'arrastar para a própria subárvore',
    `destaque: ${ring} | ${await notice()} | título: ${await title()}`
  )

  // Recolher e expandir pelo botão do nó.
  await click(`${node('pagamento')} button`)
  await sleep(500)
  log('recolher Pagamento', `${await tree()} | botão: ${await text(`${node('pagamento')} button`)}`)
  await rightClick(node('pagamento'))
  await click({ tag: '[role=menuitem]', text: 'Expandir' })
  await sleep(500)
  log('expandir pelo menu', await tree())
}

if (stage === 'editar') {
  await click(node('busca'))
  await press('ArrowDown', { alt: true })
  await sleep(400)
  log('Alt+↓ em busca', await tree())
  log('título com alteração', await title())
}

if (stage === 'recentes') {
  await waitFor(`document.querySelector('main section ul button') !== null`)
  log('recentes', await text('main section'))
  await click('main section ul button')
  await shown('loja')
  await sleep(500)
  log('abre pelo recente', `${await title()} | ${await tree()}`)
}

ui.close()
```

- [ ] **Passo 4: Projeto novo e recriar o exemplo pelo diagrama**

Abra o app empacotado com dados próprios e uma pasta vazia:

```bash
rm -rf .checks/aceitacao && mkdir -p .checks/aceitacao/dados .checks/aceitacao/loja-online
./dist/win-unpacked/mdd.exe --inspect=9229 --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/aceitacao/dados")" &
```

Espere a janela aparecer e rode:

```bash
P="$(cygpath -w "$PWD/.checks/aceitacao/loja-online")"
node .checks/main-dialogs.mjs 9229 pasta "$P"
node .checks/aceitacao-2b.mjs 9333 novo
node .checks/aceitacao-2b.mjs 9333 recriar "$P"
cmp .checks/aceitacao/loja-online/model.xml docs/examples/loja-online/model.xml
```

Esperado:

- `novo` mostra `ID sugerido → loja_online`;
- `cmp` não imprime nada, ou seja, o arquivo é idêntico;
- `recriar` imprime exatamente:

```
título ao abrir                      → Loja Online — mdd
diagrama                             → loja | selecionada: loja
atributos de loja                    → Versão versao string · padrão 1.0 · fixo
menu-filha em loja                   → Nova filha de “Loja Online” | criada e selecionada: catalogo
Tab em loja                          → Nova filha de “Loja Online” | criada e selecionada: busca
atributos de busca                   → Máx. resultados max_resultados number · 10 a 500 · padrão 50 · escolhido por produto
menu-filha em loja                   → Nova filha de “Loja Online” | criada e selecionada: mobile
barra em loja                        → Nova filha de “Loja Online” | criada e selecionada: pagamento
menu-filha em pagamento              → Nova filha de “Pagamento” | criada e selecionada: pag_cartao
menu-irmã em pag_cartao              → Nova irmã de “Cartão” | criada e selecionada: pag_pix
grupo criado pelo menu               → pagamento:grupo:0 or | membros: pag_cartao pag_pix
Tab em loja                          → Nova filha de “Loja Online” | criada e selecionada: pag_boleto
arrastar Boleto até o arco           → destaque: fill-emerald-500 stroke-emerald-500 | membros: pag_cartao pag_pix pag_boleto | filhas da raiz: catalogo busca mobile pagamento
atributos de mobile                  → Plataforma plataforma enum · {android, ios, ambas} · escolhido por produto
diagrama final                       → loja catalogo busca mobile pagamento pag_cartao pag_pix pag_boleto
aviso de edição recusada             → (sem aviso)
Ctrl+S                               → Loja Online — mdd
model.xml igual ao exemplo           → true
arrastar para a própria subárvore    → destaque: vermelho | Edição recusada: Uma feature não pode ir para dentro da própria subárvore. | título: Loja Online — mdd
recolher Pagamento                   → loja catalogo busca mobile pagamento | botão: +3
expandir pelo menu                   → loja catalogo busca mobile pagamento pag_cartao pag_pix pag_boleto
```

- [ ] **Passo 5: Fechar com alteração pendente e reabrir pelos recentes**

```bash
node .checks/aceitacao-2b.mjs 9333 editar
node .checks/main-dialogs.mjs 9229 respostas "Cancelar,Sair sem salvar"
node .checks/main-dialogs.mjs 9229 fechar-janela
node .checks/main-dialogs.mjs 9229 fechar-janela
cmp .checks/aceitacao/loja-online/model.xml docs/examples/loja-online/model.xml
```

Esperado:

- `editar` imprime:

```
Alt+↓ em busca                       → loja catalogo mobile busca pagamento pag_cartao pag_pix pag_boleto
título com alteração                 → • Loja Online — mdd
```

- o primeiro `fechar-janela` responde `janela continua aberta`, porque Cancelar mantém a janela aberta;
- o segundo responde `conexão encerrada (o app saiu)`, porque "Sair sem salvar" fecha;
- `cmp` não imprime nada: a alteração descartada não chegou ao disco.

Abra o app de novo com os mesmos dados e confira os recentes:

```bash
./dist/win-unpacked/mdd.exe --inspect=9229 --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/aceitacao/dados")" &
node .checks/aceitacao-2b.mjs 9333 recentes
node .checks/main-dialogs.mjs 9229 fechar-janela
```

Esperado:

- `recentes → RECENTES loja-online <caminho de .checks/aceitacao/loja-online>`;
- `abre pelo recente → Loja Online — mdd | loja catalogo busca mobile pagamento pag_cartao pag_pix pag_boleto`.

- [ ] **Passo 6: Roteiro da 2A pelo diagrama**

Copie o roteiro da 2A (plano da 2A, Tarefa 7, Passo 8) para `.checks/ui-check.mjs` e faça duas mudanças:

1. Logo depois da linha `await new Promise((resolve) => ws.addEventListener('open', resolve))`, acrescente:

```js
// A janela pode estar sem o foco do Windows: sem isto, focus()/blur() sintéticos não disparam eventos.
ws.send(
  JSON.stringify({ id: 0, method: 'Emulation.setFocusEmulationEnabled', params: { enabled: true } })
)
```

2. Na função `selected`, troque o seletor `'[aria-selected=true] > button'` por `'[data-feature-id][aria-current=true]'`.

Prepare a cópia do exemplo e rode no app empacotado:

```bash
rm -rf .checks/ui-data .checks/loja-ui && mkdir -p .checks/ui-data
cp -r docs/examples/loja-online .checks/loja-ui
node -e "require('fs').writeFileSync('.checks/ui-data/recent-projects.json', JSON.stringify([{ rootPath: process.argv[1], name: 'loja-ui' }]))" "$(cygpath -w "$PWD/.checks/loja-ui")"
./dist/win-unpacked/mdd.exe --remote-debugging-port=9333 --disable-features=CalculateNativeWinOcclusion --user-data-dir="$(cygpath -w "$PWD/.checks/ui-data")" &
node .checks/ui-check.mjs 9333 "$(cygpath -w "$PWD/.checks/loja-ui")"
```

Esperado, exatamente o esperado da 2A, com uma diferença: nas linhas "renomear" e "Ctrl+Z desfaz o nome", o texto do nó perde o `○`, porque o marcador passou para a linha do diagrama.

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
```

Feche o app.

- [ ] **Passo 7: Atualizar o handoff**

Em `docs/HANDOFF.md`:

- na tabela "Estado atual", troque as linhas da 2A e da 2B por estas duas:

```markdown
| 2A. Edição do modelo | Concluída | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md](superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md) |
| 2B. Diagrama visual | Concluída | `main`. Plano em [docs/superpowers/plans/2026-09-23-fase-2b-diagrama.md](superpowers/plans/2026-09-23-fase-2b-diagrama.md) |
| **3. Configurador** | **A planejar** | — |
```

A terceira linha substitui a do Configurador, que passa a ser a próxima fase.

- troque a seção "Próximo passo: Fase 2B (diagrama)" por uma seção "Próximo passo: Fase 3 (configurador)". Ela descreve a entrega da SPEC §9 (adapter do solver, resolução, modo configuração no diagrama, valores de atributos, lista de configurações, configuração desatualizada) e a aceitação da mesma linha. Termina com o pedido para a sessão nova:

> Leia docs/HANDOFF.md e escreva o plano da Fase 3, prototipando e verificando o código numa cópia descartável antes, como nas fases anteriores.

- em "Armadilhas já encontradas", acrescente:

```markdown
- **React Flow e o mouse:** um nó que não é arrastável nem selecionável e não tem handler de clique fica com `pointer-events: none`. A raiz do diagrama é assim, por isso os nós de feature levam `style: { pointerEvents: 'all' }`.
- **elkjs `mrtree`:** usa o mesmo espaçamento nas duas direções e ignora `nodeNodeBetweenLayers`. O `x` vem do elkjs; o `y` sai do nível (`diagram-layout.ts`).
- **Menus e atalhos:** Enter num item do menu de contexto também chegaria ao atalho da janela. O atalho ignora teclas com `defaultPrevented`.
```

- [ ] **Passo 8: Commit**

```bash
npm run format
git add docs/HANDOFF.md
git commit -m "docs: handoff registra a Fase 2B concluída e o próximo passo (Fase 3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Aceitação da Fase 2B (SPEC §9: a aceitação da 2A, feita pelo diagrama)

- [ ] Recriar o modelo do exemplo do zero pelo diagrama (menu de contexto, atalho, barra e arrastar até o arco) e salvar produz um arquivo idêntico (Tarefa 4, Passo 4).
- [ ] Excluir `pag_pix` pelo menu de contexto mostra 1 restrição, 2 assets e 1 configuração; desfazer restaura tudo (Tarefa 3, Passo 12; Tarefa 4, Passo 6).
- [ ] Arrastar e soltar: alvo válido em verde e movimento aplicado; alvo inválido em vermelho e recusado com o motivo; soltar sobre o arco entra no grupo (Tarefa 3, Passo 12; Tarefa 4, Passo 4).
- [ ] Recolher e expandir; a seleção nunca fica escondida (Tarefa 2, Passo 9; Tarefa 3, Passo 12; Tarefa 4, Passo 4).
- [ ] Projeto novo, recentes, indicador de não salvo, Ctrl+S, conflito e confirmação ao fechar continuam funcionando (Tarefa 4, Passos 4 a 6).
