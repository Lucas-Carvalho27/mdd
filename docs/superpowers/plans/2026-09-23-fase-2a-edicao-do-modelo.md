# Fase 2A — Edição do modelo e ciclo de vida do projeto: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** editar o Feature Model pelo app (features, grupos, atributos e restrições), com desfazer/refazer, diálogo de impacto ao excluir e o ciclo de vida completo do projeto: criar, abrir recentes, indicador de alteração não salva, Ctrl+S, conflito ao salvar e confirmação ao fechar.

**Arquitetura:** o domínio ganha operações puras de edição sobre o modelo imutável (cada uma devolve um modelo novo ou o motivo da recusa). A aplicação embrulha cada operação num comando (`EditorCommand`) e um histórico imutável executa, confere as regras M1–M5/A1–A3 no resultado e guarda o estado anterior; desfazer é voltar a ele. A store Zustand guarda sessão, histórico e seleção. A interface continua com a árvore em lista (o diagrama chega na Fase 2B), agora selecionável, com painel de propriedades, painel de restrições, barra de ações, atalhos e diálogos. O processo main passa a manter a lista de recentes e a confirmar o fechamento da janela com alterações não salvas.

**Stack:** a das fases anteriores, mais `lucide-react` (ícones dos componentes shadcn) e os componentes shadcn `dialog`, `input`, `label` e `textarea`.

**Spec:** [docs/SPEC.md](../../SPEC.md) §4.5 (edição e evolução do modelo), §7 (interface), §8 (comportamentos transversais) e a linha da Fase 2 em §9. ADRs: [0004](../../adr/0004-ids-estaveis-para-features.md), [0008](../../adr/0008-camadas-com-lint-sem-testes.md).

## Restrições globais

- **Sem testes automatizados** (ADR 0008). Cada tarefa verifica com `npm run typecheck`, `npm run lint` e scripts descartáveis em `.checks/` (ignorada pelo git, ESLint e Prettier), rodados com `npx tsx` ou `node`.
- Camadas (SPEC §6.1): `domain/` não importa nada de fora dele; `application/` só `domain/`; só `ui/app/` conhece `infrastructure/`. O lint barra violações.
- Dentro de `domain/`, imports relativos; nas demais camadas, alias `@/`.
- Identificadores em inglês; textos da interface, mensagens, comentários e documentação em português. No JSX, aspas tipográficas (“assim”), porque o lint recusa aspas retas no texto.
- O domínio é imutável. Toda edição passa por um comando executado pelo histórico; componentes e store não alteram o modelo diretamente.
- IDs de feature são sugeridos a partir do nome e podem ser ajustados **só na criação** (diálogos "Nova filha", "Nova irmã" e "Novo projeto"); depois nunca mudam (ADR 0004, atualizado na Tarefa 8).
- Rode `npm run format` antes de cada commit. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Todo comando roda na raiz do repositório com **Git Bash**.

**Fora desta fase:** diagrama gráfico, menu de contexto, arrastar e soltar (a operação de mover já existe no domínio e nos comandos, mas ainda sem interface) e subárvores recolhíveis ficam para a Fase 2B; os comandos de assets (vincular, editar, reordenar, desvincular) e a lista de assets ancorados no painel ficam para a Fase 4.

## Mapa de arquivos

| Arquivo                                                                                                                                    | Responsabilidade                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `domain/shared/identifier-generator.ts`                                                                                                    | ID a partir do nome, com sufixo `_2`, `_3`…                                |
| `domain/feature-model/tree.ts`                                                                                                             | Localizar, atualizar e retirar features da árvore imutável                 |
| `domain/feature-model/new-model.ts`                                                                                                        | Modelo de um projeto novo; renomear o modelo                               |
| `domain/feature-model/feature-edits.ts`                                                                                                    | Adicionar filha/irmã, renomear, descrição, variabilidade, reordenar, mover |
| `domain/feature-model/group-edits.ts`                                                                                                      | Criar grupo, mudar cardinalidade, desfazer grupo                           |
| `domain/feature-model/attribute-edits.ts`                                                                                                  | Adicionar, editar e excluir atributos                                      |
| `domain/feature-model/constraint-edits.ts`                                                                                                 | Adicionar, editar e excluir restrições                                     |
| `domain/project/feature-deletion.ts`                                                                                                       | Exclusão em cascata (restrições e assets junto)                            |
| `domain/configuration/references.ts`                                                                                                       | A configuração cita estas features/este atributo?                          |
| `application/ports/recent-projects.ts`, `unsaved-changes-indicator.ts`                                                                     | Novos ports                                                                |
| `application/ports/repositories.ts`                                                                                                        | Gravação distingue conflito de erro; `'any'` sobrescreve                   |
| `application/use-cases/open-project.ts`, `save-project.ts`, `create-project.ts`                                                            | Abrir (diálogo ou recente), salvar (com conflitos), criar                  |
| `application/editing/*.ts`                                                                                                                 | Comando, fábricas de comandos, histórico, análise de impacto               |
| `infrastructure/xml/xml-document-file.ts`                                                                                                  | Mapeia conflito e "sobrescrever"                                           |
| `infrastructure/electron/electron-recent-projects.ts`, `electron-unsaved-changes-indicator.ts`                                             | Adapters dos novos ports                                                   |
| `shared/ipc.ts`, `main/recent-projects.ts`, `main/unsaved-changes.ts`, `main/ipc/project-handlers.ts`, `main/index.ts`, `preload/index.ts` | Recentes e confirmação ao fechar                                           |
| `ui/stores/project-store.ts`, `project-store-context.ts`                                                                                   | Store do editor                                                            |
| `ui/components/CommitField.tsx`                                                                                                            | Campo que grava ao terminar de editar                                      |
| `ui/screens/start/*.tsx`                                                                                                                   | Tela inicial e diálogo de projeto novo                                     |
| `ui/screens/project/*`                                                                                                                     | Cabeçalho, árvore, barra de ações, painéis, diálogos e atalhos             |

(Todos os caminhos em `domain/`, `application/`, `infrastructure/` e `ui/` ficam em `src/renderer/src/`.)

---

### Tarefa 1: Domínio da edição

**Arquivos:**

- Criar: `src/renderer/src/domain/shared/identifier-generator.ts`; em `src/renderer/src/domain/feature-model/`: `tree.ts`, `new-model.ts`, `feature-edits.ts`, `group-edits.ts`, `attribute-edits.ts`, `constraint-edits.ts`; `src/renderer/src/domain/project/feature-deletion.ts`; `src/renderer/src/domain/configuration/references.ts`
- Modificar: `eslint.config.mjs`

**Interfaces:**

- Consome: tipos e regras das Fases 1 (`FeatureModel`, `Feature`, `Group`, `featuresInPreOrder`, `referencedFeatureIds`, `RESERVED_WORDS`, `Result`, `ok`, `err`).
- Produz:
  - `generateId(name: string, taken: ReadonlySet<string>, fallback: string): string`
  - `FeatureLocation` (`root` | `solitary` com `parent`, `childIndex` | `member` com `parent`, `childIndex`, `memberIndex`), `locateFeature(root, id)`, `findFeature(root, id)`, `featureIdSet(root)`, `updateFeature(root, id, update)`, `groupAt(parent, childIndex)`, `withoutVariability(feature)`, `detachFeature(root, location): { root; groupChange? }`
  - `createFeatureModel(name, rootId?)`, `renameModel(model, name)`
  - `EditResult<T = FeatureModel> = Result<T, string>`; `addChildFeature(model, parentId, name, id?)` e `addSiblingFeature(model, siblingId, name, id?)` → `EditResult<{ model; featureId }>` (sem `id`, ele é gerado do nome); `checkNewFeatureId(id, taken): string | null`; `renameFeature`, `setFeatureDescription`, `setVariability`, `reorderFeature(model, id, -1 | 1)`, `moveFeature(model, id, MoveDestination)`; `MoveDestination = { kind: 'child'; parentId } | { kind: 'group'; memberId }`; `editFeature`, `notFound`
  - `createGroup(model, parentId, memberIds, min, max)`, `setGroupCardinality(model, memberId, min, max)`, `ungroup(model, memberId)`
  - `AttributeDraft = Omit<Attribute, 'id'>`; `addAttribute(model, featureId, draft)` → `EditResult<{ model; attributeId }>`; `updateAttribute(model, featureId, attributeId, draft)`; `removeAttribute(model, featureId, attributeId)`
  - `addConstraint(model, expression, description)` → `EditResult<{ model; constraintId }>` (IDs `c1`, `c2`…); `updateConstraint`, `removeConstraint`
  - `deleteFeature(model, assets, featureId): Result<FeatureDeletion, string>`; `FeatureDeletion { model; assets; removedFeatureIds; removedConstraintIds; unlinkedAssetIds; groupChange? }`
  - `referencesAnyFeature(configuration, featureIds)`, `referencesAttribute(configuration, featureId, attributeId)`

- [ ] **Passo 1: Criar o branch da fase**

```bash
git switch -c fase-2a-edicao
```

- [ ] **Passo 2: Permitir tirar um campo de objeto com `...resto`**

O domínio remove campos opcionais assim: `const { variability, ...rest } = feature`. A regra padrão reclama da variável não usada; a opção `ignoreRestSiblings` é feita para esse padrão. Em `eslint.config.mjs`, no bloco com `react-hooks` e `react-refresh`, troque o objeto `rules` por:

```js
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      // Permite `const { campo, ...resto } = objeto` para tirar um campo de um objeto imutável.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }]
    }
```

- [ ] **Passo 3: Criar `src/renderer/src/domain/shared/identifier-generator.ts`**

```ts
import { RESERVED_WORDS } from '../expression/identifier'

/**
 * Gera um ID a partir de um nome (SPEC §4.1): sem acentos, minúsculo, cada trecho que não
 * for letra ou dígito vira "_", e um sufixo _2, _3… evita colisões e palavras reservadas.
 * Ex.: "Pagamento com PIX" → "pagamento_com_pix".
 */
export function generateId(name: string, taken: ReadonlySet<string>, fallback: string): string {
  const base = slugify(name) || fallback
  if (!taken.has(base) && !RESERVED_WORDS.has(base)) return base
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}_${suffix}`
    if (!taken.has(candidate)) return candidate
  }
}

function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (slug === '') return ''
  return /^[a-z]/.test(slug) ? slug : `f_${slug}`
}
```

- [ ] **Passo 4: Criar `src/renderer/src/domain/feature-model/tree.ts`**

```ts
import type { Feature, FeatureChild, Group } from './feature-model'
import { featuresInPreOrder } from './traversal'

/*
 * Navegação e atualização imutável da árvore. Atualizar uma feature recria só o caminho
 * da raiz até ela; o resto da árvore é compartilhado com a versão anterior.
 */

export type FeatureLocation =
  | { readonly kind: 'root' }
  | { readonly kind: 'solitary'; readonly parent: Feature; readonly childIndex: number }
  | {
      readonly kind: 'member'
      readonly parent: Feature
      /** Posição do grupo em `parent.children`. */
      readonly childIndex: number
      readonly memberIndex: number
    }

export function findFeature(root: Feature, id: string): Feature | undefined {
  return featuresInPreOrder(root).find((feature) => feature.id === id)
}

export function featureIdSet(root: Feature): Set<string> {
  return new Set(featuresInPreOrder(root).map((feature) => feature.id))
}

export function locateFeature(root: Feature, id: string): FeatureLocation | undefined {
  if (root.id === id) return { kind: 'root' }
  const search = (parent: Feature): FeatureLocation | undefined => {
    for (const [childIndex, child] of parent.children.entries()) {
      if (child.kind === 'feature') {
        if (child.feature.id === id) return { kind: 'solitary', parent, childIndex }
        const found = search(child.feature)
        if (found) return found
      } else {
        for (const [memberIndex, member] of child.group.members.entries()) {
          if (member.id === id) return { kind: 'member', parent, childIndex, memberIndex }
          const found = search(member)
          if (found) return found
        }
      }
    }
    return undefined
  }
  return search(root)
}

/** Troca a feature `id` pelo resultado de `update`. Se o ID não existe, devolve a mesma raiz. */
export function updateFeature(
  root: Feature,
  id: string,
  update: (feature: Feature) => Feature
): Feature {
  if (root.id === id) return update(root)
  let changed = false
  const children = root.children.map((child) => {
    const next = updateChild(child, id, update)
    if (next !== child) changed = true
    return next
  })
  return changed ? { ...root, children } : root
}

function updateChild(
  child: FeatureChild,
  id: string,
  update: (feature: Feature) => Feature
): FeatureChild {
  if (child.kind === 'feature') {
    const feature = updateFeature(child.feature, id, update)
    return feature === child.feature ? child : { kind: 'feature', feature }
  }
  const members = child.group.members.map((member) => updateFeature(member, id, update))
  const changed = members.some((member, index) => member !== child.group.members[index])
  return changed ? { kind: 'group', group: { ...child.group, members } } : child
}

/** O grupo na posição `childIndex` dos filhos de `parent`. */
export function groupAt(parent: Feature, childIndex: number): Group {
  const child = parent.children[childIndex]
  if (child?.kind !== 'group') {
    throw new Error(`Não há grupo na posição ${childIndex} de "${parent.id}".`)
  }
  return child.group
}

export function withoutVariability(feature: Feature): Feature {
  const { variability, ...rest } = feature
  return rest
}

export interface DetachResult {
  readonly root: Feature
  /** Descrição do ajuste feito no grupo de origem, quando houve (SPEC §4.5). */
  readonly groupChange?: string
}

/**
 * Tira da árvore a feature na posição indicada. Se ela era membro de um grupo, o grupo
 * vazio é removido e um mínimo maior que o número de membros é reduzido.
 */
export function detachFeature(root: Feature, location: FeatureLocation): DetachResult {
  if (location.kind === 'root') throw new Error('A raiz não pode ser removida da árvore.')
  const { parent, childIndex } = location

  if (location.kind === 'solitary') {
    const children = parent.children.filter((_, index) => index !== childIndex)
    return { root: updateFeature(root, parent.id, (p) => ({ ...p, children })) }
  }

  const group = groupAt(parent, childIndex)
  const members = group.members.filter((_, index) => index !== location.memberIndex)
  let groupChange: string | undefined
  let children: FeatureChild[]
  if (members.length === 0) {
    children = parent.children.filter((_, index) => index !== childIndex)
    groupChange = `O grupo de "${parent.name}" ficou vazio e foi removido.`
  } else {
    const min = Math.min(group.min, members.length)
    if (min !== group.min) {
      groupChange = `O mínimo do grupo de "${parent.name}" passou de ${group.min} para ${min}.`
    }
    children = parent.children.map((child, index) =>
      index === childIndex ? { kind: 'group', group: { ...group, min, members } } : child
    )
  }
  return { root: updateFeature(root, parent.id, (p) => ({ ...p, children })), groupChange }
}
```

- [ ] **Passo 5: Criar `src/renderer/src/domain/feature-model/new-model.ts`**

```ts
import { generateId } from '../shared/identifier-generator'
import { err, ok, type Result } from '../shared/result'
import { checkNewFeatureId } from './feature-edits'
import type { FeatureModel } from './feature-model'

/**
 * Modelo de um projeto novo: só a raiz, com o mesmo nome do modelo (SPEC §7).
 * Sem `rootId`, o ID da raiz é gerado a partir do nome.
 */
export function createFeatureModel(name: string, rootId?: string): Result<FeatureModel, string> {
  const trimmed = name.trim()
  if (trimmed === '') return err('O nome do projeto não pode ficar vazio.')
  const id = rootId?.trim() ?? generateId(trimmed, new Set(), 'raiz')
  const problem = checkNewFeatureId(id, new Set())
  if (problem !== null) return err(problem)
  return ok({
    name: trimmed,
    root: { id, name: trimmed, attributes: [], children: [] },
    constraints: []
  })
}

export function renameModel(model: FeatureModel, name: string): Result<FeatureModel, string> {
  const trimmed = name.trim()
  if (trimmed === '') return err('O nome do modelo não pode ficar vazio.')
  return ok({ ...model, name: trimmed })
}
```

- [ ] **Passo 6: Criar `src/renderer/src/domain/feature-model/feature-edits.ts`**

```ts
import { isValidFeatureId } from '../expression/identifier'
import { generateId } from '../shared/identifier-generator'
import { err, ok, type Result } from '../shared/result'
import type { Feature, FeatureChild, FeatureModel, Variability } from './feature-model'
import {
  detachFeature,
  featureIdSet,
  findFeature,
  groupAt,
  locateFeature,
  updateFeature,
  withoutVariability
} from './tree'

/*
 * Edições da estrutura do Feature Model (SPEC §4.5). Cada operação devolve um modelo novo
 * ou a explicação de por que não pode ser feita. As regras M1–M5 são conferidas depois,
 * pelo histórico de comandos, em cima do modelo resultante.
 */

export type EditResult<T = FeatureModel> = Result<T, string>

export interface AddedFeature {
  readonly model: FeatureModel
  readonly featureId: string
}

/** Sem `id`, ele é gerado a partir do nome; com `id`, ele precisa ser válido e inédito. */
export function addChildFeature(
  model: FeatureModel,
  parentId: string,
  name: string,
  id?: string
): EditResult<AddedFeature> {
  if (findFeature(model.root, parentId) === undefined) return err(notFound(parentId))
  const created = createFeature(model, name, 'optional', id)
  if (!created.ok) return created
  const feature = created.value
  const root = updateFeature(model.root, parentId, (parent) => ({
    ...parent,
    children: [...parent.children, { kind: 'feature', feature }]
  }))
  return ok({ model: { ...model, root }, featureId: feature.id })
}

/** Cria a feature logo depois de `siblingId`, no mesmo grupo quando ela for membro de um. */
export function addSiblingFeature(
  model: FeatureModel,
  siblingId: string,
  name: string,
  id?: string
): EditResult<AddedFeature> {
  const location = locateFeature(model.root, siblingId)
  if (location === undefined) return err(notFound(siblingId))
  if (location.kind === 'root') return err('A raiz não tem irmãs: adicione uma filha.')

  const variability = location.kind === 'solitary' ? 'optional' : undefined
  const created = createFeature(model, name, variability, id)
  if (!created.ok) return created
  const feature = created.value
  const { parent, childIndex } = location

  const children: FeatureChild[] =
    location.kind === 'solitary'
      ? insertAt(parent.children, childIndex + 1, { kind: 'feature', feature })
      : parent.children.map((child, index) => {
          if (index !== childIndex) return child
          const group = groupAt(parent, childIndex)
          return {
            kind: 'group',
            group: { ...group, members: insertAt(group.members, location.memberIndex + 1, feature) }
          }
        })
  const root = updateFeature(model.root, parent.id, (p) => ({ ...p, children }))
  return ok({ model: { ...model, root }, featureId: feature.id })
}

export function renameFeature(model: FeatureModel, featureId: string, name: string): EditResult {
  const trimmed = name.trim()
  if (trimmed === '') return err('O nome não pode ficar vazio.')
  return editFeature(model, featureId, (feature) => ({ ...feature, name: trimmed }))
}

/** Texto vazio remove a descrição. */
export function setFeatureDescription(
  model: FeatureModel,
  featureId: string,
  description: string
): EditResult {
  const trimmed = description.trim()
  return editFeature(model, featureId, (feature) => {
    const { description: previousDescription, ...rest } = feature
    return trimmed === '' ? rest : { ...rest, description: trimmed }
  })
}

export function setVariability(
  model: FeatureModel,
  featureId: string,
  variability: Variability
): EditResult {
  const location = locateFeature(model.root, featureId)
  if (location === undefined) return err(notFound(featureId))
  if (location.kind !== 'solitary') {
    return err('Só features fora de grupo são obrigatórias ou opcionais.')
  }
  return editFeature(model, featureId, (feature) => ({ ...feature, variability }))
}

/** Troca a feature de lugar com a irmã anterior (-1) ou seguinte (+1). */
export function reorderFeature(model: FeatureModel, featureId: string, offset: -1 | 1): EditResult {
  const location = locateFeature(model.root, featureId)
  if (location === undefined) return err(notFound(featureId))
  if (location.kind === 'root') return err('A raiz não tem irmãs.')
  const { parent, childIndex } = location

  if (location.kind === 'solitary') {
    const children = swap(parent.children, childIndex, childIndex + offset)
    if (children === undefined) return err(edgeMessage(offset))
    return ok({ ...model, root: updateFeature(model.root, parent.id, (p) => ({ ...p, children })) })
  }

  const group = groupAt(parent, childIndex)
  const members = swap(group.members, location.memberIndex, location.memberIndex + offset)
  if (members === undefined) return err(edgeMessage(offset))
  const children = parent.children.map((child, index) =>
    index === childIndex ? { kind: 'group' as const, group: { ...group, members } } : child
  )
  return ok({ ...model, root: updateFeature(model.root, parent.id, (p) => ({ ...p, children })) })
}

/** Para onde uma feature pode ir: filha solta de outra feature ou membro do grupo de `memberId`. */
export type MoveDestination =
  | { readonly kind: 'child'; readonly parentId: string }
  | { readonly kind: 'group'; readonly memberId: string }

/**
 * Muda a feature de pai, levando a subárvore junto; ela vai para o fim do destino.
 * Ao entrar num grupo perde a variabilidade; ao sair de um grupo vira opcional.
 */
export function moveFeature(
  model: FeatureModel,
  featureId: string,
  destination: MoveDestination
): EditResult {
  const location = locateFeature(model.root, featureId)
  if (location === undefined) return err(notFound(featureId))
  if (location.kind === 'root') return err('A raiz não pode ser movida.')
  const feature = findFeature(model.root, featureId)!

  const targetId = destination.kind === 'child' ? destination.parentId : destination.memberId
  if (findFeature(model.root, targetId) === undefined) return err(notFound(targetId))
  if (findFeature(feature, targetId) !== undefined) {
    return err('Uma feature não pode ir para dentro da própria subárvore.')
  }

  if (destination.kind === 'group') {
    const target = locateFeature(model.root, destination.memberId)!
    if (target.kind !== 'member') return err('O destino não é membro de um grupo.')
    if (
      location.kind === 'member' &&
      location.parent.id === target.parent.id &&
      location.childIndex === target.childIndex
    ) {
      return err('A feature já está nesse grupo.')
    }
  }

  const { root: detachedRoot } = detachFeature(model.root, location)

  if (destination.kind === 'child') {
    const moved: Feature =
      location.kind === 'solitary' ? feature : { ...feature, variability: 'optional' }
    const root = updateFeature(detachedRoot, destination.parentId, (parent) => ({
      ...parent,
      children: [...parent.children, { kind: 'feature', feature: moved }]
    }))
    return ok({ ...model, root })
  }

  const target = locateFeature(detachedRoot, destination.memberId)
  if (target === undefined || target.kind !== 'member') {
    return err('O grupo de destino deixou de existir.')
  }
  const moved = withoutVariability(feature)
  const children = target.parent.children.map((child, index) => {
    if (index !== target.childIndex) return child
    const group = groupAt(target.parent, index)
    return { kind: 'group' as const, group: { ...group, members: [...group.members, moved] } }
  })
  const root = updateFeature(detachedRoot, target.parent.id, (parent) => ({ ...parent, children }))
  return ok({ ...model, root })
}

// Auxiliares

function createFeature(
  model: FeatureModel,
  name: string,
  variability: Variability | undefined,
  requestedId: string | undefined
): EditResult<Feature> {
  const trimmed = name.trim()
  if (trimmed === '') return err('O nome não pode ficar vazio.')
  const taken = featureIdSet(model.root)
  const id = requestedId?.trim() ?? generateId(trimmed, taken, 'feature')
  const problem = checkNewFeatureId(id, taken)
  if (problem !== null) return err(problem)
  return ok({
    id,
    name: trimmed,
    ...(variability !== undefined ? { variability } : {}),
    attributes: [],
    children: []
  })
}

/**
 * Confere um ID escolhido na criação da feature (ADR 0004: depois de criada, ele não muda).
 * Devolve `null` quando serve, ou a explicação do problema.
 */
export function checkNewFeatureId(id: string, taken: ReadonlySet<string>): string | null {
  if (!isValidFeatureId(id)) {
    return `O ID "${id}" é inválido: use letras minúsculas, dígitos e _, começando por letra, e evite palavras reservadas.`
  }
  if (taken.has(id)) return `O ID "${id}" já existe no modelo.`
  return null
}

export function editFeature(
  model: FeatureModel,
  featureId: string,
  update: (feature: Feature) => Feature
): EditResult {
  if (findFeature(model.root, featureId) === undefined) return err(notFound(featureId))
  return ok({ ...model, root: updateFeature(model.root, featureId, update) })
}

export function notFound(featureId: string): string {
  return `A feature "${featureId}" não existe.`
}

function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)]
}

function swap<T>(items: readonly T[], from: number, to: number): T[] | undefined {
  if (to < 0 || to >= items.length) return undefined
  const copy = [...items]
  ;[copy[from], copy[to]] = [copy[to], copy[from]]
  return copy
}

function edgeMessage(offset: -1 | 1): string {
  return offset < 0 ? 'A feature já é a primeira.' : 'A feature já é a última.'
}
```

- [ ] **Passo 7: Criar `src/renderer/src/domain/feature-model/group-edits.ts`**

```ts
import { err, ok } from '../shared/result'
import { notFound, type EditResult } from './feature-edits'
import type { Feature, FeatureChild, FeatureModel, GroupMax } from './feature-model'
import { findFeature, groupAt, locateFeature, updateFeature, withoutVariability } from './tree'

/*
 * Edições de grupos (SPEC §4.5). Um grupo não tem ID próprio: ele é identificado por
 * qualquer um de seus membros. As regras de cardinalidade (M3) são conferidas depois.
 */

/** Junta filhas soltas de `parentId` num grupo, na posição da primeira delas. */
export function createGroup(
  model: FeatureModel,
  parentId: string,
  memberIds: readonly string[],
  min: number,
  max: GroupMax
): EditResult {
  const parent = findFeature(model.root, parentId)
  if (parent === undefined) return err(notFound(parentId))
  if (memberIds.length === 0) return err('Escolha ao menos uma feature para o grupo.')

  const selected = new Set<number>()
  for (const id of memberIds) {
    const index = parent.children.findIndex(
      (child) => child.kind === 'feature' && child.feature.id === id
    )
    if (index === -1) return err(`"${id}" não é uma filha solta de "${parent.name}".`)
    selected.add(index)
  }

  const members: Feature[] = parent.children.flatMap((child, index) =>
    selected.has(index) && child.kind === 'feature' ? [withoutVariability(child.feature)] : []
  )
  const first = Math.min(...selected)
  const children = parent.children.flatMap((child, index): FeatureChild[] => {
    if (index === first) return [{ kind: 'group', group: { min, max, members } }]
    return selected.has(index) ? [] : [child]
  })
  return ok({ ...model, root: updateFeature(model.root, parentId, (p) => ({ ...p, children })) })
}

export function setGroupCardinality(
  model: FeatureModel,
  memberId: string,
  min: number,
  max: GroupMax
): EditResult {
  const location = locateFeature(model.root, memberId)
  if (location === undefined) return err(notFound(memberId))
  if (location.kind !== 'member') return err('A feature não é membro de um grupo.')
  const { parent, childIndex } = location
  const children = parent.children.map((child, index) =>
    index === childIndex
      ? { kind: 'group' as const, group: { ...groupAt(parent, index), min, max } }
      : child
  )
  return ok({ ...model, root: updateFeature(model.root, parent.id, (p) => ({ ...p, children })) })
}

/** Desfaz o grupo de `memberId`: os membros viram filhas soltas opcionais, na mesma ordem. */
export function ungroup(model: FeatureModel, memberId: string): EditResult {
  const location = locateFeature(model.root, memberId)
  if (location === undefined) return err(notFound(memberId))
  if (location.kind !== 'member') return err('A feature não é membro de um grupo.')
  const { parent, childIndex } = location
  const children = parent.children.flatMap((child, index): FeatureChild[] =>
    index === childIndex
      ? groupAt(parent, index).members.map((member) => ({
          kind: 'feature',
          feature: { ...member, variability: 'optional' }
        }))
      : [child]
  )
  return ok({ ...model, root: updateFeature(model.root, parent.id, (p) => ({ ...p, children })) })
}
```

- [ ] **Passo 8: Criar `src/renderer/src/domain/feature-model/attribute-edits.ts`**

```ts
import { generateId } from '../shared/identifier-generator'
import { err, ok } from '../shared/result'
import { editFeature, notFound, type EditResult } from './feature-edits'
import type { Attribute, FeatureModel } from './feature-model'
import { findFeature } from './tree'

/** Tudo de um atributo menos o ID, que é gerado na criação e não muda (como nas features). */
export type AttributeDraft = Omit<Attribute, 'id'>

export interface AddedAttribute {
  readonly model: FeatureModel
  readonly attributeId: string
}

export function addAttribute(
  model: FeatureModel,
  featureId: string,
  draft: AttributeDraft
): EditResult<AddedAttribute> {
  const feature = findFeature(model.root, featureId)
  if (feature === undefined) return err(notFound(featureId))
  const name = draft.name.trim()
  if (name === '') return err('O nome do atributo não pode ficar vazio.')
  const taken = new Set(feature.attributes.map((attribute) => attribute.id))
  const attributeId = generateId(name, taken, 'atributo')
  const edited = editFeature(model, featureId, (f) => ({
    ...f,
    attributes: [...f.attributes, { ...draft, name, id: attributeId }]
  }))
  return edited.ok ? ok({ model: edited.value, attributeId }) : edited
}

export function updateAttribute(
  model: FeatureModel,
  featureId: string,
  attributeId: string,
  draft: AttributeDraft
): EditResult {
  const feature = findFeature(model.root, featureId)
  if (feature === undefined) return err(notFound(featureId))
  if (!feature.attributes.some((attribute) => attribute.id === attributeId)) {
    return err(`O atributo "${attributeId}" não existe.`)
  }
  const name = draft.name.trim()
  if (name === '') return err('O nome do atributo não pode ficar vazio.')
  return editFeature(model, featureId, (f) => ({
    ...f,
    attributes: f.attributes.map((attribute) =>
      attribute.id === attributeId ? { ...draft, name, id: attributeId } : attribute
    )
  }))
}

export function removeAttribute(
  model: FeatureModel,
  featureId: string,
  attributeId: string
): EditResult {
  const feature = findFeature(model.root, featureId)
  if (feature === undefined) return err(notFound(featureId))
  if (!feature.attributes.some((attribute) => attribute.id === attributeId)) {
    return err(`O atributo "${attributeId}" não existe.`)
  }
  return editFeature(model, featureId, (f) => ({
    ...f,
    attributes: f.attributes.filter((attribute) => attribute.id !== attributeId)
  }))
}
```

- [ ] **Passo 9: Criar `src/renderer/src/domain/feature-model/constraint-edits.ts`**

```ts
import type { Expression } from '../expression/ast'
import { err, ok } from '../shared/result'
import type { EditResult } from './feature-edits'
import type { Constraint, FeatureModel } from './feature-model'

/*
 * Edições de restrições. A expressão chega já convertida em árvore (a interface usa
 * `parseExpression`); se ela cita features inexistentes, a regra M4 recusa depois.
 */

export interface AddedConstraint {
  readonly model: FeatureModel
  readonly constraintId: string
}

/** Novas restrições recebem IDs c1, c2, c3… */
export function addConstraint(
  model: FeatureModel,
  expression: Expression,
  description: string
): EditResult<AddedConstraint> {
  const taken = new Set(model.constraints.map((constraint) => constraint.id))
  let number = 1
  while (taken.has(`c${number}`)) number++
  const constraintId = `c${number}`
  const constraint = withDescription({ id: constraintId, expression }, description)
  return ok({ model: { ...model, constraints: [...model.constraints, constraint] }, constraintId })
}

export function updateConstraint(
  model: FeatureModel,
  constraintId: string,
  expression: Expression,
  description: string
): EditResult {
  if (!model.constraints.some((constraint) => constraint.id === constraintId)) {
    return err(`A restrição "${constraintId}" não existe.`)
  }
  const constraints = model.constraints.map((constraint) =>
    constraint.id === constraintId
      ? withDescription({ id: constraintId, expression }, description)
      : constraint
  )
  return ok({ ...model, constraints })
}

export function removeConstraint(model: FeatureModel, constraintId: string): EditResult {
  if (!model.constraints.some((constraint) => constraint.id === constraintId)) {
    return err(`A restrição "${constraintId}" não existe.`)
  }
  return ok({
    ...model,
    constraints: model.constraints.filter((constraint) => constraint.id !== constraintId)
  })
}

function withDescription(constraint: Constraint, description: string): Constraint {
  const trimmed = description.trim()
  return trimmed === '' ? constraint : { ...constraint, description: trimmed }
}
```

- [ ] **Passo 10: Criar `src/renderer/src/domain/project/feature-deletion.ts`**

```ts
import type { AssetCatalog } from '../assets/asset-catalog'
import { referencedFeatureIds } from '../expression/references'
import { notFound } from '../feature-model/feature-edits'
import type { FeatureModel } from '../feature-model/feature-model'
import { featuresInPreOrder } from '../feature-model/traversal'
import { detachFeature, findFeature, locateFeature } from '../feature-model/tree'
import { err, ok, type Result } from '../shared/result'

/** Resultado de excluir uma feature com a subárvore, e tudo o que foi junto (SPEC §4.5). */
export interface FeatureDeletion {
  readonly model: FeatureModel
  readonly assets: AssetCatalog
  readonly removedFeatureIds: readonly string[]
  /** Restrições que citavam alguma feature excluída: são removidas inteiras. */
  readonly removedConstraintIds: readonly string[]
  /** Assets ancorados numa feature excluída ou com condição que a cita (os arquivos ficam). */
  readonly unlinkedAssetIds: readonly string[]
  readonly groupChange?: string
}

export function deleteFeature(
  model: FeatureModel,
  assets: AssetCatalog,
  featureId: string
): Result<FeatureDeletion, string> {
  const location = locateFeature(model.root, featureId)
  if (location === undefined) return err(notFound(featureId))
  if (location.kind === 'root') return err('A raiz não pode ser excluída.')

  const removed = new Set(featuresInPreOrder(findFeature(model.root, featureId)!).map((f) => f.id))
  const touchesRemoved = (ids: Set<string>): boolean => [...ids].some((id) => removed.has(id))

  const { root, groupChange } = detachFeature(model.root, location)
  const removedConstraints = model.constraints.filter((constraint) =>
    touchesRemoved(referencedFeatureIds(constraint.expression))
  )
  const unlinkedAssets = assets.assets.filter(
    (asset) =>
      removed.has(asset.anchor) ||
      (asset.condition !== undefined && touchesRemoved(referencedFeatureIds(asset.condition)))
  )

  return ok({
    model: {
      ...model,
      root,
      constraints: model.constraints.filter(
        (constraint) => !removedConstraints.includes(constraint)
      )
    },
    assets: { assets: assets.assets.filter((asset) => !unlinkedAssets.includes(asset)) },
    removedFeatureIds: [...removed],
    removedConstraintIds: removedConstraints.map((constraint) => constraint.id),
    unlinkedAssetIds: unlinkedAssets.map((asset) => asset.id),
    ...(groupChange !== undefined ? { groupChange } : {})
  })
}
```

- [ ] **Passo 11: Criar `src/renderer/src/domain/configuration/references.ts`**

```ts
import type { Configuration } from './configuration'

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
```

- [ ] **Passo 12: Verificar IDs, árvore e operações**

Crie `.checks/edits-check.ts`:

```ts
// Confere a geração de IDs, a navegação da árvore e as operações puras de edição do domínio.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DOMParser } from '@xmldom/xmldom'
import { referencesAnyFeature } from '../src/renderer/src/domain/configuration/references'
import {
  addChildFeature,
  moveFeature,
  reorderFeature
} from '../src/renderer/src/domain/feature-model/feature-edits'
import type { FeatureModel } from '../src/renderer/src/domain/feature-model/feature-model'
import {
  createGroup,
  setGroupCardinality,
  ungroup
} from '../src/renderer/src/domain/feature-model/group-edits'
import { createFeatureModel } from '../src/renderer/src/domain/feature-model/new-model'
import { detachFeature, locateFeature } from '../src/renderer/src/domain/feature-model/tree'
import { deleteFeature } from '../src/renderer/src/domain/project/feature-deletion'
import { generateId } from '../src/renderer/src/domain/shared/identifier-generator'
import { decodeAssetCatalog } from '../src/renderer/src/infrastructure/xml/assets-codec'
import { decodeFeatureModel } from '../src/renderer/src/infrastructure/xml/feature-model-codec'

const example = join(__dirname, '../docs/examples/loja-online')
const root = (file: string) =>
  new DOMParser().parseFromString(readFileSync(join(example, file), 'utf8'), 'text/xml')
    .documentElement!
const decodedModel = decodeFeatureModel(root('model.xml'))
const decodedAssets = decodeAssetCatalog(root('assets.xml'))
if (!decodedModel.ok || !decodedAssets.ok) throw new Error('exemplo inválido')
const model: FeatureModel = decodedModel.value

// IDs a partir de nomes
const taken = new Set(['busca', 'busca_2'])
for (const name of ['Pagamento com PIX', 'Cartão', 'Máx. resultados', '2FA', 'Or', '  ', 'Busca'])
  console.log(`ID de ${JSON.stringify(name)}`.padEnd(30), '→', generateId(name, taken, 'feature'))
for (const [name, rootId] of [
  ['Loja Online', undefined],
  ['Loja Online', 'loja'],
  ['Loja Online', 'true']
] as const) {
  const created = createFeatureModel(name, rootId)
  console.log(
    `projeto novo, ID ${rootId ?? 'sugerido'}`.padEnd(30),
    '→',
    created.ok ? `${created.value.name} / raiz ${created.value.root.id}` : created.error
  )
}

// Localização
for (const id of ['loja', 'busca', 'pag_pix', 'nada']) {
  const location = locateFeature(model.root, id)
  console.log(
    `onde está ${id}`.padEnd(30),
    '→',
    location === undefined
      ? 'não existe'
      : location.kind === 'root'
        ? 'raiz'
        : `${location.kind} de ${location.parent.id}, posição ${location.childIndex}${location.kind === 'member' ? `, membro ${location.memberIndex}` : ''}`
  )
}

// Retirar membros de um grupo [3..*] ajusta o mínimo e, no fim, remove o grupo vazio
const onlyCard = createGroup(model, 'pagamento', [], 1, 1)
console.log('grupo sem membros'.padEnd(30), '→', onlyCard.ok ? 'aceito' : onlyCard.error)
const strict = setGroupCardinality(model, 'pag_pix', 3, '*')
if (!strict.ok) throw new Error(strict.error)
let shrinking = strict.value.root
for (const id of ['pag_cartao', 'pag_pix', 'pag_boleto']) {
  const detached = detachFeature(shrinking, locateFeature(shrinking, id)!)
  shrinking = detached.root
  console.log(`retirar ${id}`.padEnd(30), '→', detached.groupChange ?? 'sem ajuste no grupo')
}

// Imutabilidade: a árvore original não muda e partes intocadas são reaproveitadas
const added = addChildFeature(model, 'pagamento', 'Carteira digital')
if (!added.ok) throw new Error(added.error)
const catalogoBefore = model.root.children[0]
const catalogoAfter = added.value.model.root.children[0]
console.log(
  'adicionar filha'.padEnd(30),
  '→',
  `${added.value.featureId} | original intacto: ${locateFeature(model.root, added.value.featureId) === undefined} | catálogo reaproveitado: ${catalogoBefore === catalogoAfter}`
)

// ID escolhido na criação
const repeated = addChildFeature(model, 'pagamento', 'Outro PIX', 'pag_pix')
console.log('filha com ID repetido'.padEnd(30), '→', repeated.ok ? 'aceito' : repeated.error)

// Operações que só mudam a estrutura
const reordered = reorderFeature(model, 'pag_boleto', -1)
const ungrouped = ungroup(model, 'pag_pix')
const moved = moveFeature(model, 'mobile', { kind: 'child', parentId: 'pagamento' })
console.log('reordenar boleto para cima'.padEnd(30), '→', reordered.ok ? 'ok' : reordered.error)
console.log('desfazer grupo'.padEnd(30), '→', ungrouped.ok ? 'ok' : ungrouped.error)
console.log(
  'mover mobile para pagamento'.padEnd(30),
  '→',
  moved.ok ? locateFeature(moved.value.root, 'mobile')?.kind : moved.error
)

// Exclusão em cascata
const deletion = deleteFeature(model, decodedAssets.value, 'pagamento')
if (!deletion.ok) throw new Error(deletion.error)
console.log(
  'excluir pagamento'.padEnd(30),
  '→',
  JSON.stringify({
    features: deletion.value.removedFeatureIds,
    restricoes: deletion.value.removedConstraintIds,
    assets: deletion.value.unlinkedAssetIds
  })
)
const configuration = {
  name: 'x',
  decisions: [{ featureId: 'pag_pix', state: 'selected' as const }],
  values: []
}
console.log(
  'configuração afetada'.padEnd(30),
  '→',
  referencesAnyFeature(configuration, new Set(deletion.value.removedFeatureIds))
)
```

```bash
npx tsx .checks/edits-check.ts
```

Esperado, exatamente:

```
ID de "Pagamento com PIX"      → pagamento_com_pix
ID de "Cartão"                 → cartao
ID de "Máx. resultados"        → max_resultados
ID de "2FA"                    → f_2fa
ID de "Or"                     → or_2
ID de "  "                     → feature
ID de "Busca"                  → busca_3
projeto novo, ID sugerido      → Loja Online / raiz loja_online
projeto novo, ID loja          → Loja Online / raiz loja
projeto novo, ID true          → O ID "true" é inválido: use letras minúsculas, dígitos e _, começando por letra, e evite palavras reservadas.
onde está loja                 → raiz
onde está busca                → solitary de loja, posição 1
onde está pag_pix              → member de pagamento, posição 0, membro 1
onde está nada                 → não existe
grupo sem membros              → Escolha ao menos uma feature para o grupo.
retirar pag_cartao             → O mínimo do grupo de "Pagamento" passou de 3 para 2.
retirar pag_pix                → O mínimo do grupo de "Pagamento" passou de 2 para 1.
retirar pag_boleto             → O grupo de "Pagamento" ficou vazio e foi removido.
adicionar filha                → carteira_digital | original intacto: true | catálogo reaproveitado: true
filha com ID repetido          → O ID "pag_pix" já existe no modelo.
reordenar boleto para cima     → ok
desfazer grupo                 → ok
mover mobile para pagamento    → solitary
excluir pagamento              → {"features":["pagamento","pag_cartao","pag_pix","pag_boleto"],"restricoes":["c1"],"assets":["doc_pix","img_pix","doc_boleto"]}
configuração afetada           → true
```

- [ ] **Passo 13: Tipos, lint e commit**

```bash
npm run format && npm run typecheck && npm run lint
git add -A
git commit -m "feat(domain): operações de edição do Feature Model e exclusão em cascata

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Esperado: typecheck e lint sem erros.

---

### Tarefa 2: Recentes e confirmação ao fechar no processo main

**Arquivos:**

- Criar: `src/renderer/src/application/ports/recent-projects.ts`, `src/renderer/src/application/ports/unsaved-changes-indicator.ts`, `src/main/recent-projects.ts`, `src/main/unsaved-changes.ts`, `src/renderer/src/infrastructure/electron/electron-recent-projects.ts`, `src/renderer/src/infrastructure/electron/electron-unsaved-changes-indicator.ts`
- Substituir: `src/shared/ipc.ts`, `src/main/ipc/project-handlers.ts`, `src/main/index.ts`, `src/preload/index.ts`

**Interfaces:**

- Consome: `ProjectRoot`, `ok`/`fail` (Fase 0), `PickedFolder`, `StorageError` (Fase 1).
- Produz:
  - `window.mdd.listRecentProjects(): Promise<RecentProject[]>`, `window.mdd.reopenProject(rootPath): Promise<IpcResult<OpenedProject>>` (só aceita pastas da lista), `window.mdd.setUnsavedChanges(unsaved: boolean): void`
  - Port `RecentProjects { list(); reopen(rootPath): Promise<Result<PickedFolder, StorageError>> }`, `RecentProject { rootPath; name }`
  - Port `UnsavedChangesIndicator { set(unsaved: boolean): void }`
  - `ElectronRecentProjects`, `ElectronUnsavedChangesIndicator` (só envia ao main quando o valor muda)

- [ ] **Passo 1: Criar os ports**

`src/renderer/src/application/ports/recent-projects.ts`:

```ts
import type { Result } from '@/domain/shared/result'
import type { PickedFolder } from './project-folder-picker'
import type { StorageError } from './project-storage'

export interface RecentProject {
  readonly rootPath: string
  readonly name: string
}

/** Os últimos projetos abertos, guardados fora do projeto (SPEC §7). */
export interface RecentProjects {
  /** Do mais recente para o mais antigo. */
  list(): Promise<RecentProject[]>
  /** Volta a usar a pasta como raiz do projeto, sem diálogo. */
  reopen(rootPath: string): Promise<Result<PickedFolder, StorageError>>
}
```

`src/renderer/src/application/ports/unsaved-changes-indicator.ts`:

```ts
/** Mostra fora da janela que há alterações não salvas (o main pergunta antes de fechar). */
export interface UnsavedChangesIndicator {
  set(unsaved: boolean): void
}
```

- [ ] **Passo 2: Substituir `src/shared/ipc.ts`**

```ts
/**
 * Contrato da API que o preload expõe em `window.mdd` (docs/SPEC.md §6.3).
 * Todos os caminhos são relativos à pasta do projeto aberto e usam "/" como separador.
 */

export type IpcErrorCode =
  'no-project' | 'outside-project' | 'not-found' | 'changed-externally' | 'io'

export interface IpcError {
  code: IpcErrorCode
  message: string
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: IpcError }

export interface OpenedProject {
  /** Caminho absoluto da pasta, só para exibição. */
  rootPath: string
  name: string
}

export interface DirectoryEntry {
  name: string
  kind: 'file' | 'directory'
}

export interface TextFile {
  content: string
  /** SHA-256 do conteúdo, usado para detectar alteração externa ao salvar. */
  hash: string
}

export type WritePrecondition =
  { kind: 'hash'; expectedHash: string } | { kind: 'must-not-exist' } | { kind: 'overwrite' }

/** Schemas de docs/schemas/ usados na leitura dos arquivos do projeto. */
export type XmlSchemaName = 'feature-model' | 'assets' | 'configuration'

export interface XmlSchemaIssue {
  line?: number
  message: string
}

export interface RecentProject {
  rootPath: string
  name: string
}

export interface MddApi {
  openProjectFolder(): Promise<IpcResult<OpenedProject | null>>
  /** Os últimos projetos abertos, do mais recente para o mais antigo. */
  listRecentProjects(): Promise<RecentProject[]>
  /** Reabre uma pasta que está na lista de recentes. */
  reopenProject(rootPath: string): Promise<IpcResult<OpenedProject>>
  /** Avisa o main se há alterações não salvas, para confirmar antes de fechar a janela. */
  setUnsavedChanges(unsaved: boolean): void
  list(relativeDir: string): Promise<IpcResult<DirectoryEntry[]>>
  readText(relativePath: string): Promise<IpcResult<TextFile>>
  writeText(
    relativePath: string,
    content: string,
    precondition: WritePrecondition
  ): Promise<IpcResult<{ hash: string }>>
  /** Confere se o conteúdo é XML bem-formado e segue o XSD. Lista vazia = válido. */
  validateXml(
    schema: XmlSchemaName,
    fileName: string,
    content: string
  ): Promise<IpcResult<XmlSchemaIssue[]>>
}

export const IpcChannel = {
  openProjectFolder: 'mdd:open-project-folder',
  listRecentProjects: 'mdd:list-recent-projects',
  reopenProject: 'mdd:reopen-project',
  setUnsavedChanges: 'mdd:set-unsaved-changes',
  list: 'mdd:list',
  readText: 'mdd:read-text',
  writeText: 'mdd:write-text',
  validateXml: 'mdd:validate-xml'
} as const
```

- [ ] **Passo 3: Criar a lista de recentes do main (`src/main/recent-projects.ts`)**

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname } from 'path'
import type { RecentProject } from '../shared/ipc'

const MAX_RECENT = 10

/** Lista dos últimos projetos abertos, num JSON em `userData` (fora de qualquer projeto). */
export class RecentProjectsStore {
  private readonly file: string

  constructor(file: string) {
    this.file = file
  }

  list(): RecentProject[] {
    try {
      const data: unknown = JSON.parse(readFileSync(this.file, 'utf8'))
      return Array.isArray(data) ? data.filter(isRecentProject) : []
    } catch {
      return []
    }
  }

  includes(rootPath: string): boolean {
    return this.list().some((project) => project.rootPath === rootPath)
  }

  /** Coloca a pasta no topo da lista. */
  add(rootPath: string): void {
    const others = this.list().filter((project) => project.rootPath !== rootPath)
    this.write([{ rootPath, name: basename(rootPath) }, ...others].slice(0, MAX_RECENT))
  }

  remove(rootPath: string): void {
    this.write(this.list().filter((project) => project.rootPath !== rootPath))
  }

  private write(projects: RecentProject[]): void {
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(projects, null, 2), 'utf8')
  }
}

function isRecentProject(value: unknown): value is RecentProject {
  const candidate = value as RecentProject
  return typeof candidate?.rootPath === 'string' && typeof candidate?.name === 'string'
}
```

- [ ] **Passo 4: Substituir `src/main/ipc/project-handlers.ts`**

Abrir uma pasta pelo diálogo a coloca na lista. `reopenProject` só aceita pastas que já estão na lista: o renderer não consegue apontar a raiz para uma pasta qualquer sem passar pelo diálogo.

```ts
import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { stat } from 'fs/promises'
import { basename } from 'path'
import { IpcChannel, type IpcResult, type OpenedProject } from '../../shared/ipc'
import type { ProjectRoot } from '../project-root'
import type { RecentProjectsStore } from '../recent-projects'
import { fail, ok } from './results'

export function registerProjectHandlers(root: ProjectRoot, recents: RecentProjectsStore): void {
  const open = (rootPath: string): OpenedProject => {
    root.open(rootPath)
    recents.add(rootPath)
    return { rootPath, name: basename(rootPath) }
  }

  ipcMain.handle(
    IpcChannel.openProjectFolder,
    async (event): Promise<IpcResult<OpenedProject | null>> => {
      const options: OpenDialogOptions = {
        title: 'Escolher a pasta do projeto',
        properties: ['openDirectory', 'createDirectory']
      }
      const window = BrowserWindow.fromWebContents(event.sender)
      const choice = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (choice.canceled || choice.filePaths.length === 0) return ok(null)
      return ok(open(choice.filePaths[0]))
    }
  )

  ipcMain.handle(IpcChannel.listRecentProjects, () => recents.list())

  ipcMain.handle(
    IpcChannel.reopenProject,
    async (_event, rootPath: string): Promise<IpcResult<OpenedProject>> => {
      // Só pastas que o usuário já escolheu no diálogo podem ser reabertas sem ele.
      if (!recents.includes(rootPath)) {
        return fail('outside-project', 'Essa pasta não está na lista de projetos recentes.')
      }
      const isFolder = await stat(rootPath).then(
        (info) => info.isDirectory(),
        () => false
      )
      if (!isFolder) {
        recents.remove(rootPath)
        return fail('not-found', `A pasta "${rootPath}" não existe mais.`)
      }
      return ok(open(rootPath))
    }
  )
}
```

- [ ] **Passo 5: Criar `src/main/unsaved-changes.ts`**

```ts
import { BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { IpcChannel } from '../shared/ipc'

/*
 * Confirmação ao fechar a janela com alterações não salvas (SPEC §8). O renderer avisa
 * quando o estado muda; o main pergunta no evento `close`, antes de a janela sumir.
 */

const unsaved = new WeakMap<WebContents, boolean>()

export function registerUnsavedChangesHandler(): void {
  ipcMain.on(IpcChannel.setUnsavedChanges, (event, value: boolean) => {
    unsaved.set(event.sender, value)
  })
}

export function confirmCloseWithUnsavedChanges(window: BrowserWindow): void {
  window.on('close', (event) => {
    if (!unsaved.get(window.webContents)) return
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      title: 'Alterações não salvas',
      message: 'Há alterações não salvas no projeto.',
      detail: 'Se sair agora, elas serão perdidas.',
      buttons: ['Sair sem salvar', 'Cancelar'],
      defaultId: 1,
      cancelId: 1
    })
    if (choice !== 0) event.preventDefault()
  })
}
```

- [ ] **Passo 6: Substituir `src/main/index.ts`**

```ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ProjectRoot } from './project-root'
import { RecentProjectsStore } from './recent-projects'
import { confirmCloseWithUnsavedChanges, registerUnsavedChangesHandler } from './unsaved-changes'
import { registerFileHandlers } from './ipc/file-handlers'
import { registerProjectHandlers } from './ipc/project-handlers'
import { registerXmlHandlers } from './ipc/xml-handlers'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: 'mdd',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
  confirmCloseWithUnsavedChanges(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mdd.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const projectRoot = new ProjectRoot()
  const recents = new RecentProjectsStore(join(app.getPath('userData'), 'recent-projects.json'))
  registerProjectHandlers(projectRoot, recents)
  registerFileHandlers(projectRoot)
  registerXmlHandlers()
  registerUnsavedChangesHandler()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

- [ ] **Passo 7: Substituir `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type MddApi } from '../shared/ipc'

const api: MddApi = {
  openProjectFolder: () => ipcRenderer.invoke(IpcChannel.openProjectFolder),
  listRecentProjects: () => ipcRenderer.invoke(IpcChannel.listRecentProjects),
  reopenProject: (rootPath) => ipcRenderer.invoke(IpcChannel.reopenProject, rootPath),
  setUnsavedChanges: (unsaved) => ipcRenderer.send(IpcChannel.setUnsavedChanges, unsaved),
  list: (relativeDir) => ipcRenderer.invoke(IpcChannel.list, relativeDir),
  readText: (relativePath) => ipcRenderer.invoke(IpcChannel.readText, relativePath),
  writeText: (relativePath, content, precondition) =>
    ipcRenderer.invoke(IpcChannel.writeText, relativePath, content, precondition),
  validateXml: (schema, fileName, content) =>
    ipcRenderer.invoke(IpcChannel.validateXml, schema, fileName, content)
}

contextBridge.exposeInMainWorld('mdd', api)
```

- [ ] **Passo 8: Criar os adapters**

`src/renderer/src/infrastructure/electron/electron-recent-projects.ts`:

```ts
import type { PickedFolder } from '@/application/ports/project-folder-picker'
import type { StorageError } from '@/application/ports/project-storage'
import type { RecentProject, RecentProjects } from '@/application/ports/recent-projects'
import type { Result } from '@/domain/shared/result'

/** Lista de recentes mantida pelo processo main (SPEC §6.3). */
export class ElectronRecentProjects implements RecentProjects {
  list(): Promise<RecentProject[]> {
    return window.mdd.listRecentProjects()
  }

  reopen(rootPath: string): Promise<Result<PickedFolder, StorageError>> {
    return window.mdd.reopenProject(rootPath)
  }
}
```

`src/renderer/src/infrastructure/electron/electron-unsaved-changes-indicator.ts`:

```ts
import type { UnsavedChangesIndicator } from '@/application/ports/unsaved-changes-indicator'

/** Repassa ao main, que pergunta antes de fechar a janela com alterações não salvas. */
export class ElectronUnsavedChangesIndicator implements UnsavedChangesIndicator {
  private current = false

  set(unsaved: boolean): void {
    if (unsaved === this.current) return
    this.current = unsaved
    window.mdd.setUnsavedChanges(unsaved)
  }
}
```

- [ ] **Passo 9: Tipos e lint**

```bash
npm run format && npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 10: Verificar os canais no app**

Com `npx electron-vite dev --remoteDebuggingPort 9333` rodando, em outro terminal:

```bash
node .checks/cdp-eval.mjs 9333 \
  "Array.isArray(await window.mdd.listRecentProjects())" \
  "window.mdd.reopenProject('C:\\\\pasta\\\\que\\\\nao\\\\existe')" \
  "typeof window.mdd.setUnsavedChanges"
```

Esperado: `true`; `{"ok":false,"error":{"code":"outside-project","message":"Essa pasta não está na lista de projetos recentes."}}`; `"function"`. Feche o app.

- [ ] **Passo 11: Commit**

```bash
git add -A
git commit -m "feat(ipc): projetos recentes e confirmação ao fechar com alterações não salvas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Casos de uso do ciclo de vida

**Arquivos:**

- Substituir: `src/renderer/src/application/ports/repositories.ts`, `src/renderer/src/infrastructure/xml/xml-document-file.ts`, `src/renderer/src/application/use-cases/save-project.ts`, `src/renderer/src/application/use-cases/open-project.ts`, `src/renderer/src/ui/app/composition-root.ts`, `.checks/node-adapters.ts`, `.checks/roundtrip-check.ts`
- Criar: `src/renderer/src/application/use-cases/create-project.ts`

**Interfaces:**

- Consome: `RecentProjects` (Tarefa 2), `createFeatureModel` (Tarefa 1).
- Produz:
  - `ExpectedHash = string | null | 'any'` (`'any'` = sobrescrever); `SaveFailure = { kind: 'conflict'; file } | { kind: 'error'; problem }`; `SaveResult = Result<string, SaveFailure>`
  - `SaveProject.execute(session, options?: { overwrite: boolean }): Promise<SaveProjectResult>`; `SaveProjectResult { session; conflicts: string[]; problems: FileProblem[] }`
  - `OpenProject` com dependências `{ picker, recents, models, assets, configurations }`, `execute()` (diálogo) e `reopen(rootPath)` (recentes e "Recarregar")
  - `new CreateProject({ picker, models }).execute(name, rootId?): Promise<CreateProjectResult>` (`cancelled` | `created` com `session` | `failed` com `problems`)

- [ ] **Passo 1: Substituir `src/renderer/src/application/ports/repositories.ts`**

```ts
import type { AssetCatalog } from '@/domain/assets/asset-catalog'
import type { Configuration } from '@/domain/configuration/configuration'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import type { Result } from '@/domain/shared/result'
import type { FileProblem } from '../file-problem'

export interface LoadedFile<T> {
  readonly value: T
  readonly hash: string
}

/**
 * Como o arquivo deve estar no disco para a gravação seguir: com este hash,
 * `null` quando ele ainda não deve existir, ou `'any'` para sobrescrever sem conferir.
 */
export type ExpectedHash = string | null | 'any'

/** Conflito = o arquivo mudou fora do app; o usuário decide se sobrescreve (SPEC §8). */
export type SaveFailure =
  | { readonly kind: 'conflict'; readonly file: string }
  | { readonly kind: 'error'; readonly problem: FileProblem }

/** Gravação bem-sucedida devolve o novo hash do arquivo. */
export type SaveResult = Result<string, SaveFailure>

export interface FeatureModelRepository {
  load(): Promise<Result<LoadedFile<FeatureModel>, FileProblem[]>>
  save(model: FeatureModel, expectedHash: ExpectedHash): Promise<SaveResult>
}

export interface AssetCatalogRepository {
  /** `null` quando o projeto ainda não tem assets.xml. */
  load(): Promise<Result<LoadedFile<AssetCatalog> | null, FileProblem[]>>
  save(catalog: AssetCatalog, expectedHash: ExpectedHash): Promise<SaveResult>
}

export interface ConfigurationRepository {
  /** Chaves (nome do arquivo sem .xml) das configurações existentes, em ordem alfabética. */
  listKeys(): Promise<Result<string[], FileProblem[]>>
  load(key: string): Promise<Result<LoadedFile<Configuration>, FileProblem[]>>
  save(key: string, configuration: Configuration, expectedHash: ExpectedHash): Promise<SaveResult>
}
```

- [ ] **Passo 2: Substituir `src/renderer/src/infrastructure/xml/xml-document-file.ts`**

```ts
import type { Element } from '@xmldom/xmldom'
import { fileError, type FileProblem } from '@/application/file-problem'
import type {
  ProjectStorage,
  StorageError,
  WritePrecondition
} from '@/application/ports/project-storage'
import type { ExpectedHash, LoadedFile, SaveResult } from '@/application/ports/repositories'
import type { XmlSchema, XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import { err, ok, type Result } from '@/domain/shared/result'
import { parseXmlRoot, type DecodeProblem } from './xml-reader'

export interface XmlDocumentFormat<T> {
  readonly schema: XmlSchema
  decode(root: Element): Result<T, DecodeProblem[]>
  encode(value: T): string
}

/**
 * Um arquivo XML do projeto. A leitura segue as etapas da SPEC §5:
 * bem-formado e XSD (validador), depois conversão para o domínio (codec).
 */
export class XmlDocumentFile<T> {
  private readonly storage: ProjectStorage
  private readonly validator: XmlSchemaValidator
  private readonly path: string
  private readonly format: XmlDocumentFormat<T>

  constructor(
    storage: ProjectStorage,
    validator: XmlSchemaValidator,
    path: string,
    format: XmlDocumentFormat<T>
  ) {
    this.storage = storage
    this.validator = validator
    this.path = path
    this.format = format
  }

  /** `null` quando o arquivo não existe. */
  async load(): Promise<Result<LoadedFile<T> | null, FileProblem[]>> {
    const read = await this.storage.readText(this.path)
    if (!read.ok) {
      return read.error.code === 'not-found' ? ok(null) : err([this.storageProblem(read.error)])
    }

    const fileName = this.path.split('/').pop() ?? this.path
    const schemaIssues = await this.validator.validate(
      this.format.schema,
      fileName,
      read.value.content
    )
    if (schemaIssues.length > 0) {
      return err(schemaIssues.map((issue) => fileError(this.path, issue.message, issue.line)))
    }

    const decoded = this.format.decode(parseXmlRoot(read.value.content))
    if (!decoded.ok) {
      return err(
        decoded.error.map((problem) => ({ file: this.path, severity: 'error', ...problem }))
      )
    }
    return ok({ value: decoded.value, hash: read.value.hash })
  }

  async save(value: T, expectedHash: ExpectedHash): Promise<SaveResult> {
    const written = await this.storage.writeText(
      this.path,
      this.format.encode(value),
      toPrecondition(expectedHash)
    )
    if (written.ok) return written
    if (written.error.code === 'changed-externally') {
      return err({ kind: 'conflict', file: this.path })
    }
    return err({ kind: 'error', problem: this.storageProblem(written.error) })
  }

  private storageProblem(error: StorageError): FileProblem {
    return fileError(this.path, error.message)
  }
}

function toPrecondition(expectedHash: ExpectedHash): WritePrecondition {
  if (expectedHash === null) return { kind: 'must-not-exist' }
  if (expectedHash === 'any') return { kind: 'overwrite' }
  return { kind: 'hash', expectedHash }
}
```

- [ ] **Passo 3: Substituir `src/renderer/src/application/use-cases/save-project.ts`**

```ts
import type { FileProblem } from '../file-problem'
import type {
  AssetCatalogRepository,
  ConfigurationRepository,
  ExpectedHash,
  FeatureModelRepository,
  SaveResult
} from '../ports/repositories'
import type { ProjectSession } from '../project-session'

export interface SaveProjectResult {
  /** Sessão com os hashes atualizados dos arquivos que foram gravados. */
  readonly session: ProjectSession
  /** Arquivos alterados fora do app, que não foram gravados (SPEC §8). */
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
 * Grava todos os arquivos do projeto. Cada arquivo só é gravado se ainda estiver como na
 * última leitura, a não ser com `overwrite`; os demais seguem sendo gravados.
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
    const collect = (result: SaveResult): string | undefined => {
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

- [ ] **Passo 4: Substituir `src/renderer/src/application/use-cases/open-project.ts`**

```ts
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { validateAssetCatalog } from '@/domain/assets/validation'
import { validateFeatureModel } from '@/domain/feature-model/validation'
import type { ConfigurationEntry } from '@/domain/project/project'
import { fileError, fromValidationIssues, type FileProblem } from '../file-problem'
import type { PickedFolder, ProjectFolderPicker } from '../ports/project-folder-picker'
import type { RecentProjects } from '../ports/recent-projects'
import type {
  AssetCatalogRepository,
  ConfigurationRepository,
  FeatureModelRepository
} from '../ports/repositories'
import type { ProjectSession } from '../project-session'

export type OpenProjectResult =
  | { readonly status: 'cancelled' }
  | {
      readonly status: 'opened'
      readonly session: ProjectSession
      readonly warnings: FileProblem[]
    }
  | { readonly status: 'failed'; readonly problems: FileProblem[] }

export interface OpenProjectDependencies {
  readonly picker: ProjectFolderPicker
  readonly recents: RecentProjects
  readonly models: FeatureModelRepository
  readonly assets: AssetCatalogRepository
  readonly configurations: ConfigurationRepository
}

/**
 * Abre uma pasta de projeto: lê e valida todos os arquivos (SPEC §5).
 * Qualquer erro em qualquer arquivo impede a abertura; avisos são devolvidos junto.
 */
export class OpenProject {
  private readonly deps: OpenProjectDependencies

  constructor(deps: OpenProjectDependencies) {
    this.deps = deps
  }

  /** Pergunta a pasta ao usuário. */
  async execute(): Promise<OpenProjectResult> {
    const picked = await this.deps.picker.pick()
    if (!picked.ok) return { status: 'failed', problems: [fileError('.', picked.error.message)] }
    if (picked.value === null) return { status: 'cancelled' }
    return this.load(picked.value)
  }

  /** Reabre uma pasta conhecida: da lista de recentes, ou para "Recarregar" (SPEC §8). */
  async reopen(rootPath: string): Promise<OpenProjectResult> {
    const reopened = await this.deps.recents.reopen(rootPath)
    if (!reopened.ok) {
      return { status: 'failed', problems: [fileError('.', reopened.error.message)] }
    }
    return this.load(reopened.value)
  }

  private async load(folder: PickedFolder): Promise<OpenProjectResult> {
    const model = await this.deps.models.load()
    if (!model.ok) return { status: 'failed', problems: model.error }

    const problems: FileProblem[] = fromValidationIssues(
      'model.xml',
      validateFeatureModel(model.value.value)
    )

    const assets = await this.deps.assets.load()
    if (!assets.ok) problems.push(...assets.error)
    const catalog = assets.ok && assets.value !== null ? assets.value.value : EMPTY_ASSET_CATALOG
    problems.push(
      ...fromValidationIssues('assets.xml', validateAssetCatalog(catalog, model.value.value))
    )

    const configurations: ConfigurationEntry[] = []
    const configurationHashes: Record<string, string> = {}
    const keys = await this.deps.configurations.listKeys()
    if (!keys.ok) problems.push(...keys.error)
    for (const key of keys.ok ? keys.value : []) {
      const loaded = await this.deps.configurations.load(key)
      if (!loaded.ok) {
        problems.push(...loaded.error)
        continue
      }
      configurations.push({ key, configuration: loaded.value.value })
      configurationHashes[key] = loaded.value.hash
    }

    const errors = problems.filter((problem) => problem.severity === 'error')
    if (errors.length > 0) return { status: 'failed', problems: errors }

    return {
      status: 'opened',
      warnings: problems,
      session: {
        folder,
        project: { model: model.value.value, assets: catalog, configurations },
        hashes: {
          model: model.value.hash,
          assets: assets.ok && assets.value !== null ? assets.value.hash : null,
          configurations: configurationHashes
        }
      }
    }
  }
}
```

- [ ] **Passo 5: Criar `src/renderer/src/application/use-cases/create-project.ts`**

```ts
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { createFeatureModel } from '@/domain/feature-model/new-model'
import { fileError, type FileProblem } from '../file-problem'
import type { ProjectFolderPicker } from '../ports/project-folder-picker'
import type { FeatureModelRepository } from '../ports/repositories'
import type { ProjectSession } from '../project-session'

export type CreateProjectResult =
  | { readonly status: 'cancelled' }
  | { readonly status: 'created'; readonly session: ProjectSession }
  | { readonly status: 'failed'; readonly problems: FileProblem[] }

export interface CreateProjectDependencies {
  readonly picker: ProjectFolderPicker
  readonly models: FeatureModelRepository
}

/**
 * Cria um projeto numa pasta escolhida pelo usuário (SPEC §7): grava um model.xml só com a
 * raiz. Recusa pastas que já têm um model.xml, para nunca sobrescrever um projeto.
 */
export class CreateProject {
  private readonly deps: CreateProjectDependencies

  constructor(deps: CreateProjectDependencies) {
    this.deps = deps
  }

  /** Sem `rootId`, o ID da raiz é gerado a partir do nome. */
  async execute(name: string, rootId?: string): Promise<CreateProjectResult> {
    const model = createFeatureModel(name, rootId)
    if (!model.ok) return { status: 'failed', problems: [fileError('model.xml', model.error)] }

    const picked = await this.deps.picker.pick()
    if (!picked.ok) return { status: 'failed', problems: [fileError('.', picked.error.message)] }
    if (picked.value === null) return { status: 'cancelled' }

    const saved = await this.deps.models.save(model.value, null)
    if (!saved.ok) {
      const problem =
        saved.error.kind === 'conflict'
          ? fileError('model.xml', 'Esta pasta já tem um projeto. Use "Abrir projeto".')
          : saved.error.problem
      return { status: 'failed', problems: [problem] }
    }

    return {
      status: 'created',
      session: {
        folder: picked.value,
        project: { model: model.value, assets: EMPTY_ASSET_CATALOG, configurations: [] },
        hashes: { model: saved.value, assets: null, configurations: {} }
      }
    }
  }
}
```

- [ ] **Passo 6: Passar os recentes ao `OpenProject` na composition root**

A store ainda é a da Fase 1 (a nova chega na Tarefa 5); aqui só a dependência nova do `OpenProject` é ligada. Substitua `src/renderer/src/ui/app/composition-root.ts` por:

```ts
import { OpenProject } from '@/application/use-cases/open-project'
import { SaveProject } from '@/application/use-cases/save-project'
import { ElectronProjectFolderPicker } from '@/infrastructure/electron/electron-project-folder-picker'
import { ElectronProjectStorage } from '@/infrastructure/electron/electron-project-storage'
import { ElectronRecentProjects } from '@/infrastructure/electron/electron-recent-projects'
import { ElectronXmlSchemaValidator } from '@/infrastructure/electron/electron-xml-schema-validator'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'
import { createProjectStore, type ProjectStore } from '@/ui/stores/project-store'

/**
 * Único lugar que conhece as implementações concretas (Dependency Inversion):
 * cria os adapters, injeta nos casos de uso e entrega a store pronta para a interface.
 */
export function createAppStore(): ProjectStore {
  const storage = new ElectronProjectStorage()
  const validator = new ElectronXmlSchemaValidator()
  const repositories = {
    models: new XmlFeatureModelRepository(storage, validator),
    assets: new XmlAssetCatalogRepository(storage, validator),
    configurations: new XmlConfigurationRepository(storage, validator)
  }
  return createProjectStore({
    openProject: new OpenProject({
      picker: new ElectronProjectFolderPicker(),
      recents: new ElectronRecentProjects(),
      ...repositories
    }),
    saveProject: new SaveProject(repositories)
  })
}
```

- [ ] **Passo 7: Tipos e lint**

```bash
npm run format && npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 8: Atualizar os adapters de Node e a verificação de ida e volta**

Os conflitos agora vêm separados dos outros erros, e o `OpenProject` precisa dos recentes. Substitua `.checks/node-adapters.ts`:

```ts
// Adapters de Node para rodar os casos de uso fora do Electron (só para verificação).
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { validateXML } from 'xmllint-wasm'
import type {
  ProjectStorage,
  WritePrecondition
} from '../src/renderer/src/application/ports/project-storage'
import type { ProjectFolderPicker } from '../src/renderer/src/application/ports/project-folder-picker'
import type { RecentProjects } from '../src/renderer/src/application/ports/recent-projects'
import type {
  XmlSchema,
  XmlSchemaValidator
} from '../src/renderer/src/application/ports/xml-schema-validator'
import { err, ok } from '../src/renderer/src/domain/shared/result'

const sha = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex')

export class FsStorage implements ProjectStorage {
  constructor(private readonly root: string) {}
  async readText(path: string) {
    const p = join(this.root, path)
    if (!existsSync(p)) return err({ code: 'not-found' as const, message: `${path} não existe` })
    const content = readFileSync(p, 'utf8')
    return ok({ content, hash: sha(content) })
  }
  async writeText(path: string, content: string, pre: WritePrecondition) {
    const p = join(this.root, path)
    const current = existsSync(p) ? readFileSync(p, 'utf8') : null
    const bad =
      pre.kind === 'must-not-exist'
        ? current !== null
        : pre.kind === 'hash'
          ? current === null || sha(current) !== pre.expectedHash
          : false
    if (bad) return err({ code: 'changed-externally' as const, message: 'mudou' })
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, content, 'utf8')
    return ok(sha(content))
  }
  async list(dir: string) {
    const p = join(this.root, dir)
    if (!existsSync(p)) return err({ code: 'not-found' as const, message: 'não existe' })
    return ok(
      readdirSync(p, { withFileTypes: true }).map((e) => ({
        name: e.name,
        kind: e.isFile() ? ('file' as const) : ('directory' as const)
      }))
    )
  }
}

export class FixedPicker implements ProjectFolderPicker {
  constructor(private readonly root: string) {}
  async pick() {
    return ok({ rootPath: this.root, name: this.root.split(/[\\/]/).pop()! })
  }
}

export class FixedRecents implements RecentProjects {
  async list() {
    return []
  }
  async reopen(rootPath: string) {
    return ok({ rootPath, name: rootPath.split(/[\\/]/).pop()! })
  }
}

const schemasDir = join(__dirname, '../docs/schemas')
export class NodeXsdValidator implements XmlSchemaValidator {
  async validate(schema: XmlSchema, fileName: string, content: string) {
    const r = await validateXML({
      xml: [{ fileName, contents: content }],
      schema: [
        {
          fileName: `${schema}.xsd`,
          contents: readFileSync(join(schemasDir, `${schema}.xsd`), 'utf8')
        }
      ]
    })
    return r.valid ? [] : r.errors.map((e) => ({ line: e.loc?.lineNumber, message: e.message }))
  }
}
```

Substitua `.checks/roundtrip-check.ts`:

```ts
// Abre o exemplo com os casos de uso reais, salva numa cópia e compara byte a byte.
// Depois abre cópias quebradas e mostra os problemas relatados.
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OpenProject } from '../src/renderer/src/application/use-cases/open-project'
import { SaveProject } from '../src/renderer/src/application/use-cases/save-project'
import { featuresInPreOrder } from '../src/renderer/src/domain/feature-model/traversal'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '../src/renderer/src/infrastructure/xml/xml-repositories'
import { FixedPicker, FixedRecents, FsStorage, NodeXsdValidator } from './node-adapters'

const example = join(__dirname, '../docs/examples/loja-online')
const files = ['model.xml', 'assets.xml', 'configurations/loja-basica.xml']

function useCases(root: string) {
  const storage = new FsStorage(root)
  const validator = new NodeXsdValidator()
  const repos = {
    models: new XmlFeatureModelRepository(storage, validator),
    assets: new XmlAssetCatalogRepository(storage, validator),
    configurations: new XmlConfigurationRepository(storage, validator)
  }
  return {
    open: new OpenProject({ picker: new FixedPicker(root), recents: new FixedRecents(), ...repos }),
    save: new SaveProject(repos)
  }
}

function copyExample(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mdd-'))
  cpSync(example, dir, { recursive: true })
  return dir
}

async function main(): Promise<void> {
  // 1. Ida e volta
  const dir = copyExample()
  const { open, save } = useCases(dir)
  const opened = await open.execute()
  if (opened.status !== 'opened') throw new Error(JSON.stringify(opened))
  console.log(
    'features:',
    featuresInPreOrder(opened.session.project.model.root)
      .map((f) => f.id)
      .join(' ')
  )
  console.log(
    'avisos:',
    opened.warnings.length,
    '| assets:',
    opened.session.project.assets.assets.length,
    '| configs:',
    opened.session.project.configurations.map((c) => c.key).join(',')
  )
  for (const f of files) writeFileSync(join(dir, f), '<!-- será sobrescrito -->', 'utf8')
  // regrava sobre arquivos alterados: deve dar conflito
  const conflict = await save.execute(opened.session)
  console.log(
    'conflitos esperados (3):',
    conflict.conflicts.join(' | '),
    '| outros problemas:',
    conflict.problems.length
  )
  // restaura e regrava de verdade
  for (const f of files) writeFileSync(join(dir, f), readFileSync(join(example, f)))
  const saved = await save.execute(opened.session)
  console.log('problemas ao salvar:', saved.problems.length + saved.conflicts.length)
  for (const f of files) {
    const same = Buffer.compare(readFileSync(join(example, f)), readFileSync(join(dir, f))) === 0
    console.log(same ? 'IDÊNTICO ' : 'DIFERENTE', f)
  }
  // segunda gravação usando os hashes novos: sem conflito
  const again = await save.execute(saved.session)
  console.log('segunda gravação, problemas:', again.problems.length + again.conflicts.length)
  rmSync(dir, { recursive: true })

  // 2. Arquivos quebrados
  const cases: Array<[string, string, (s: string) => string]> = [
    ['ID duplicado', 'model.xml', (s) => s.replace('id="pag_boleto"', 'id="pag_pix"')],
    ['ID com hífen', 'model.xml', (s) => s.replace('id="pag_boleto"', 'id="pag-boleto"')],
    ['max="0"', 'model.xml', (s) => s.replace('max="*"', 'max="0"')],
    ['XML malformado', 'model.xml', (s) => s.replace('</featureModel>', '')],
    [
      'expressão inválida',
      'model.xml',
      (s) => s.replace('pag_pix implies mobile', 'pag_pix implies')
    ],
    [
      'restrição cita feature inexistente',
      'model.xml',
      (s) => s.replace('implies mobile', 'implies tablet')
    ],
    ['ID reservado', 'model.xml', (s) => s.replaceAll('"catalogo"', '"true"')],
    ['min > membros', 'model.xml', (s) => s.replace('min="1" max="*"', 'min="4" max="*"')],
    [
      'atributo fixo sem default',
      'model.xml',
      (s) => s.replace(' default="1.0" configurable="false"', ' configurable="false"')
    ],
    ['default fora da faixa', 'model.xml', (s) => s.replace('default="50"', 'default="5"')],
    [
      'âncora inexistente',
      'assets.xml',
      (s) => s.replace('anchor="pag_boleto"', 'anchor="pag_cheque"')
    ],
    [
      'caminho fora do projeto',
      'assets.xml',
      (s) => s.replace('path="docs/img/pix-fluxo.svg"', 'path="../fora.svg"')
    ],
    [
      'versão desconhecida',
      'configurations/loja-basica.xml',
      (s) => s.replace('schemaVersion="1"', 'schemaVersion="2"')
    ]
  ]
  for (const [label, file, mutate] of cases) {
    const d = copyExample()
    writeFileSync(join(d, file), mutate(readFileSync(join(d, file), 'utf8')))
    const r = await useCases(d).open.execute()
    const text =
      r.status === 'failed'
        ? r.problems
            .map(
              (p) =>
                `${p.file}${p.line ? `:${p.line}` : ''}${p.subject ? ` [${p.subject}]` : ''} ${p.message}`
            )
            .join(' || ')
        : `ABRIU (avisos: ${r.status === 'opened' ? r.warnings.map((w) => w.message).join('; ') : ''})`
    console.log(`\n# ${label}\n  ${text}`)
    rmSync(d, { recursive: true })
  }
}

main()
```

```bash
npx tsx .checks/roundtrip-check.ts
```

Esperado, exatamente:

```
features: loja catalogo busca mobile pagamento pag_cartao pag_pix pag_boleto
avisos: 0 | assets: 6 | configs: loja-basica
conflitos esperados (3): model.xml | assets.xml | configurations/loja-basica.xml | outros problemas: 0
problemas ao salvar: 0
IDÊNTICO  model.xml
IDÊNTICO  assets.xml
IDÊNTICO  configurations/loja-basica.xml
segunda gravação, problemas: 0

# ID duplicado
  model.xml:21 Schemas validity error : Element '{urn:mdd:feature-model}feature': Duplicate key-sequence ['pag_pix'] in key identity-constraint '{urn:mdd:feature-model}featureId'.

# ID com hífen
  model.xml:21 Schemas validity error : Element '{urn:mdd:feature-model}feature', attribute 'id': [facet 'pattern'] The value 'pag-boleto' is not accepted by the pattern '[a-z][a-z0-9_]*'. || model.xml:21 Schemas validity error : Element '{urn:mdd:feature-model}feature', attribute 'id': Warning: No precomputed value available, the value was either invalid or something strange happened. || model.xml:21 Schemas validity error : Element '{urn:mdd:feature-model}feature': Not all fields of key identity-constraint '{urn:mdd:feature-model}featureId' evaluate to a node.

# max="0"
  model.xml:18 Schemas validity error : Element '{urn:mdd:feature-model}group', attribute 'max': '0' is not a valid value of the union type '{urn:mdd:feature-model}GroupMax'.

# XML malformado
  model.xml:31 parser error : Premature end of data in tag featureModel line 2 || model.xml

# expressão inválida
  model.xml:27 [c1] Expressão inválida (coluna 16): A expressão terminou antes da hora: falta um operando.

# restrição cita feature inexistente
  model.xml [c1] A restrição cita a feature "tablet", que não existe.

# ID reservado
  model.xml [true] ID "true" inválido: use [a-z][a-z0-9_]* e evite palavras reservadas.

# min > membros
  model.xml [pagamento (grupo)] O mínimo do grupo (4) passa do número de membros (3).

# atributo fixo sem default
  model.xml [loja.versao] Atributo fixo precisa de default.

# default fora da faixa
  model.xml [busca.max_resultados] default inválido: o mínimo é 10.

# âncora inexistente
  assets.xml [doc_boleto] A âncora "pag_cheque" não existe no modelo.

# caminho fora do projeto
  assets.xml [img_pix] O caminho "../fora.svg" precisa ser relativo e ficar dentro do projeto.

# versão desconhecida
  configurations/loja-basica.xml:2 Schemas validity error : Element '{urn:mdd:configuration}configuration', attribute 'schemaVersion': The value '2' does not match the fixed value constraint '1'.
```

- [ ] **Passo 9: Commit**

```bash
git add -A
git commit -m "feat(application): criar projeto, reabrir recente e gravar com conflitos separados

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: Comandos, histórico e impacto

**Arquivos:**

- Criar, em `src/renderer/src/application/editing/`: `editor-command.ts`, `commands.ts`, `edit-history.ts`, `impact.ts`

**Interfaces:**

- Consome: operações da Tarefa 1; `validateFeatureModel`, `validateAssetCatalog` (Fase 1); `OpenProject` (Tarefa 3, só na verificação).
- Produz:
  - `EditorState { model; assets }`, `CommandOutcome { state; focusFeatureId? }`, `EditorCommand { label; run(state): Result<CommandOutcome, string> }`
  - Fábricas em `commands.ts`: `addChildFeature(parentId, name?, id?)`, `addSiblingFeature(siblingId, name?, id?)`, `renameModel(name)`, `renameFeature(id, name)`, `setFeatureDescription(id, text)`, `setVariability(id, v)`, `reorderFeature(id, -1 | 1)`, `moveFeature(id, destination)`, `createGroup(parentId, memberIds, min, max)`, `setGroupCardinality(memberId, min, max)`, `ungroup(memberId)`, `addAttribute(featureId, draft)`, `updateAttribute(featureId, attributeId, draft)`, `removeAttribute(featureId, attributeId)`, `addConstraint(expression, description)`, `updateConstraint(id, expression, description)`, `removeConstraint(id)`, `deleteFeature(id, name)`; `NEW_FEATURE_NAME = 'Nova feature'`
  - `EditHistory { past; future }`, `HistoryEntry { label; before; after }`, `EMPTY_HISTORY`, `HistoryStep { history; state; focusFeatureId? }`, `executeCommand(history, state, command): Result<HistoryStep, string>`, `undo(history)`, `redo(history)`
  - `DeletionImpact`, `analyzeFeatureDeletion(project, featureId)`, `configurationsUsingAttribute(project, featureId, attributeId)`

- [ ] **Passo 1: Criar `editor-command.ts`**

```ts
import type { AssetCatalog } from '@/domain/assets/asset-catalog'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import type { Result } from '@/domain/shared/result'

/** O que o editor altera: o modelo e o mapeamento de assets (a exclusão em cascata mexe nos dois). */
export interface EditorState {
  readonly model: FeatureModel
  readonly assets: AssetCatalog
}

export interface CommandOutcome {
  readonly state: EditorState
  /** Feature a destacar depois do comando, como a que acabou de ser criada. */
  readonly focusFeatureId?: string
}

/**
 * Uma edição como objeto (Command Pattern, ADR 0008): a interface cria o comando e o
 * histórico executa, guarda e desfaz. O comando não sabe desfazer a si mesmo: como o
 * estado é imutável, o histórico guarda o estado anterior e desfazer é voltar a ele.
 */
export interface EditorCommand {
  /** Texto curto para "Desfazer …", como `Excluir "Busca"`. */
  readonly label: string
  run(state: EditorState): Result<CommandOutcome, string>
}
```

- [ ] **Passo 2: Criar `commands.ts`**

```ts
import * as attributes from '@/domain/feature-model/attribute-edits'
import * as constraints from '@/domain/feature-model/constraint-edits'
import * as features from '@/domain/feature-model/feature-edits'
import type { FeatureModel, GroupMax, Variability } from '@/domain/feature-model/feature-model'
import * as groups from '@/domain/feature-model/group-edits'
import * as newModel from '@/domain/feature-model/new-model'
import type { Expression } from '@/domain/expression/ast'
import { deleteFeature as deleteFeatureCascade } from '@/domain/project/feature-deletion'
import { ok, type Result } from '@/domain/shared/result'
import type { EditorCommand } from './editor-command'

/*
 * Fábricas de comandos: cada função cria um objeto `EditorCommand` que embrulha uma
 * operação pura do domínio. A interface só conhece estas funções, nunca o domínio de edição.
 */

export const NEW_FEATURE_NAME = 'Nova feature'

/** Sem `id`, ele é gerado a partir do nome (ADR 0004). */
export function addChildFeature(
  parentId: string,
  name = NEW_FEATURE_NAME,
  id?: string
): EditorCommand {
  return {
    label: `Adicionar "${name}"`,
    run: (state) => {
      const added = features.addChildFeature(state.model, parentId, name, id)
      if (!added.ok) return added
      return ok({
        state: { ...state, model: added.value.model },
        focusFeatureId: added.value.featureId
      })
    }
  }
}

export function addSiblingFeature(
  siblingId: string,
  name = NEW_FEATURE_NAME,
  id?: string
): EditorCommand {
  return {
    label: `Adicionar "${name}"`,
    run: (state) => {
      const added = features.addSiblingFeature(state.model, siblingId, name, id)
      if (!added.ok) return added
      return ok({
        state: { ...state, model: added.value.model },
        focusFeatureId: added.value.featureId
      })
    }
  }
}

export function renameModel(name: string): EditorCommand {
  return modelCommand(`Renomear modelo para "${name}"`, (model) =>
    newModel.renameModel(model, name)
  )
}

export function renameFeature(featureId: string, name: string): EditorCommand {
  return modelCommand(`Renomear para "${name}"`, (model) =>
    features.renameFeature(model, featureId, name)
  )
}

export function setFeatureDescription(featureId: string, description: string): EditorCommand {
  return modelCommand('Editar descrição', (model) =>
    features.setFeatureDescription(model, featureId, description)
  )
}

export function setVariability(featureId: string, variability: Variability): EditorCommand {
  const label = variability === 'mandatory' ? 'Tornar obrigatória' : 'Tornar opcional'
  return modelCommand(label, (model) => features.setVariability(model, featureId, variability))
}

export function reorderFeature(featureId: string, offset: -1 | 1): EditorCommand {
  return modelCommand(
    offset < 0 ? 'Mover para cima' : 'Mover para baixo',
    (model) => features.reorderFeature(model, featureId, offset),
    featureId
  )
}

export function moveFeature(
  featureId: string,
  destination: features.MoveDestination
): EditorCommand {
  return modelCommand(
    'Mover feature',
    (model) => features.moveFeature(model, featureId, destination),
    featureId
  )
}

export function createGroup(
  parentId: string,
  memberIds: readonly string[],
  min: number,
  max: GroupMax
): EditorCommand {
  return modelCommand('Criar grupo', (model) =>
    groups.createGroup(model, parentId, memberIds, min, max)
  )
}

export function setGroupCardinality(memberId: string, min: number, max: GroupMax): EditorCommand {
  return modelCommand(`Grupo [${min}..${max}]`, (model) =>
    groups.setGroupCardinality(model, memberId, min, max)
  )
}

export function ungroup(memberId: string): EditorCommand {
  return modelCommand('Desfazer grupo', (model) => groups.ungroup(model, memberId))
}

export function addAttribute(featureId: string, draft: attributes.AttributeDraft): EditorCommand {
  return modelCommand(`Adicionar atributo "${draft.name}"`, (model) => {
    const added = attributes.addAttribute(model, featureId, draft)
    return added.ok ? ok(added.value.model) : added
  })
}

export function updateAttribute(
  featureId: string,
  attributeId: string,
  draft: attributes.AttributeDraft
): EditorCommand {
  return modelCommand(`Editar atributo "${draft.name}"`, (model) =>
    attributes.updateAttribute(model, featureId, attributeId, draft)
  )
}

export function removeAttribute(featureId: string, attributeId: string): EditorCommand {
  return modelCommand('Excluir atributo', (model) =>
    attributes.removeAttribute(model, featureId, attributeId)
  )
}

export function addConstraint(expression: Expression, description: string): EditorCommand {
  return modelCommand('Adicionar restrição', (model) => {
    const added = constraints.addConstraint(model, expression, description)
    return added.ok ? ok(added.value.model) : added
  })
}

export function updateConstraint(
  constraintId: string,
  expression: Expression,
  description: string
): EditorCommand {
  return modelCommand('Editar restrição', (model) =>
    constraints.updateConstraint(model, constraintId, expression, description)
  )
}

export function removeConstraint(constraintId: string): EditorCommand {
  return modelCommand('Excluir restrição', (model) =>
    constraints.removeConstraint(model, constraintId)
  )
}

/** Exclusão em cascata: é o único comando que também mexe nos assets. */
export function deleteFeature(featureId: string, featureName: string): EditorCommand {
  return {
    label: `Excluir "${featureName}"`,
    run: (state) => {
      const deletion = deleteFeatureCascade(state.model, state.assets, featureId)
      if (!deletion.ok) return deletion
      return ok({ state: { model: deletion.value.model, assets: deletion.value.assets } })
    }
  }
}

function modelCommand(
  label: string,
  edit: (model: FeatureModel) => Result<FeatureModel, string>,
  focusFeatureId?: string
): EditorCommand {
  return {
    label,
    run: (state) => {
      const edited = edit(state.model)
      if (!edited.ok) return edited
      return ok({ state: { ...state, model: edited.value }, focusFeatureId })
    }
  }
}
```

- [ ] **Passo 3: Criar `edit-history.ts`**

```ts
import { validateAssetCatalog } from '@/domain/assets/validation'
import { validateFeatureModel } from '@/domain/feature-model/validation'
import { err, ok, type Result } from '@/domain/shared/result'
import type { EditorCommand, EditorState } from './editor-command'

/*
 * Histórico de desfazer/refazer (SPEC §4.5), imutável como o resto do estado.
 * Cada entrada guarda o estado antes e depois do comando; desfazer volta ao "antes".
 * Como o estado é compartilhado entre versões, guardar cópias não custa quase nada.
 */

const MAX_ENTRIES = 200

export interface HistoryEntry {
  readonly label: string
  readonly before: EditorState
  readonly after: EditorState
}

export interface EditHistory {
  readonly past: readonly HistoryEntry[]
  readonly future: readonly HistoryEntry[]
}

export const EMPTY_HISTORY: EditHistory = { past: [], future: [] }

export interface HistoryStep {
  readonly history: EditHistory
  readonly state: EditorState
  readonly focusFeatureId?: string
}

/**
 * Executa o comando e confere as regras do domínio no resultado. Se alguma regra
 * (M1–M5, A1–A3) quebraria, o comando é recusado e nada muda.
 */
export function executeCommand(
  history: EditHistory,
  state: EditorState,
  command: EditorCommand
): Result<HistoryStep, string> {
  const outcome = command.run(state)
  if (!outcome.ok) return outcome
  const next = outcome.value.state

  const errors = [
    ...validateFeatureModel(next.model),
    ...validateAssetCatalog(next.assets, next.model)
  ].filter((issue) => issue.severity === 'error')
  if (errors.length > 0) return err(errors.map((issue) => issue.message).join(' '))

  return ok({
    history: {
      past: [...history.past, { label: command.label, before: state, after: next }].slice(
        -MAX_ENTRIES
      ),
      future: []
    },
    state: next,
    focusFeatureId: outcome.value.focusFeatureId
  })
}

export function undo(history: EditHistory): HistoryStep | undefined {
  const entry = history.past.at(-1)
  if (entry === undefined) return undefined
  return {
    history: { past: history.past.slice(0, -1), future: [entry, ...history.future] },
    state: entry.before
  }
}

export function redo(history: EditHistory): HistoryStep | undefined {
  const entry = history.future[0]
  if (entry === undefined) return undefined
  return {
    history: { past: [...history.past, entry], future: history.future.slice(1) },
    state: entry.after
  }
}
```

- [ ] **Passo 4: Criar `impact.ts`**

```ts
import { referencesAnyFeature, referencesAttribute } from '@/domain/configuration/references'
import type { Project } from '@/domain/project/project'
import { deleteFeature } from '@/domain/project/feature-deletion'
import { err, ok, type Result } from '@/domain/shared/result'

/** O que o diálogo mostra antes de excluir uma feature (SPEC §4.5). */
export interface DeletionImpact {
  readonly removedFeatureIds: readonly string[]
  readonly removedConstraintIds: readonly string[]
  readonly unlinkedAssetIds: readonly string[]
  /** Nomes das configurações que vão abrir como desatualizadas; os arquivos não mudam agora. */
  readonly affectedConfigurations: readonly string[]
  readonly groupChange?: string
}

export function analyzeFeatureDeletion(
  project: Project,
  featureId: string
): Result<DeletionImpact, string> {
  const deletion = deleteFeature(project.model, project.assets, featureId)
  if (!deletion.ok) return err(deletion.error)
  const removed = new Set(deletion.value.removedFeatureIds)
  return ok({
    removedFeatureIds: deletion.value.removedFeatureIds,
    removedConstraintIds: deletion.value.removedConstraintIds,
    unlinkedAssetIds: deletion.value.unlinkedAssetIds,
    affectedConfigurations: project.configurations
      .filter(({ configuration }) => referencesAnyFeature(configuration, removed))
      .map(({ configuration }) => configuration.name),
    ...(deletion.value.groupChange !== undefined ? { groupChange: deletion.value.groupChange } : {})
  })
}

/** Configurações com valor para o atributo; elas ficam desatualizadas se ele for excluído. */
export function configurationsUsingAttribute(
  project: Project,
  featureId: string,
  attributeId: string
): string[] {
  return project.configurations
    .filter(({ configuration }) => referencesAttribute(configuration, featureId, attributeId))
    .map(({ configuration }) => configuration.name)
}
```

- [ ] **Passo 5: Tipos e lint**

```bash
npm run format && npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 6: Recriar o exemplo só com comandos e conferir recusas**

É a aceitação da Fase 2 no nível dos comandos: o modelo recriado do zero precisa sair idêntico ao `model.xml` do exemplo. Crie `.checks/editor-check.ts`:

```ts
// Recria o modelo do exemplo só com comandos e compara com o arquivo; depois confere o
// impacto de excluir pag_pix, o desfazer/refazer e as edições que devem ser recusadas.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as cmd from '../src/renderer/src/application/editing/commands'
import type {
  EditorCommand,
  EditorState
} from '../src/renderer/src/application/editing/editor-command'
import {
  EMPTY_HISTORY,
  executeCommand,
  redo,
  undo,
  type EditHistory
} from '../src/renderer/src/application/editing/edit-history'
import { analyzeFeatureDeletion } from '../src/renderer/src/application/editing/impact'
import { OpenProject } from '../src/renderer/src/application/use-cases/open-project'
import { EMPTY_ASSET_CATALOG } from '../src/renderer/src/domain/assets/asset-catalog'
import { parseExpression } from '../src/renderer/src/domain/expression/parser'
import { createFeatureModel } from '../src/renderer/src/domain/feature-model/new-model'
import { findFeature } from '../src/renderer/src/domain/feature-model/tree'
import { encodeFeatureModel } from '../src/renderer/src/infrastructure/xml/feature-model-codec'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '../src/renderer/src/infrastructure/xml/xml-repositories'
import { FixedPicker, FixedRecents, FsStorage, NodeXsdValidator } from './node-adapters'

const example = join(__dirname, '../docs/examples/loja-online')

let history: EditHistory = EMPTY_HISTORY
let state: EditorState
let lastFocus: string | undefined
function run(command: EditorCommand): void {
  const step = executeCommand(history, state, command)
  if (!step.ok) throw new Error(`${command.label}: ${step.error}`)
  history = step.value.history
  state = step.value.state
  lastFocus = step.value.focusFeatureId
}
function refused(label: string, command: EditorCommand): void {
  const step = executeCommand(history, state, command)
  console.log(
    `${step.ok ? 'ACEITO (erro!)' : 'recusado'} | ${label}${step.ok ? '' : ` → ${step.error}`}`
  )
}
function expression(text: string) {
  const parsed = parseExpression(text)
  if (!parsed.ok) throw new Error(parsed.error.message)
  return parsed.value
}
/** Cria a feature escolhendo o ID, como no diálogo "Nova filha" (ADR 0004). */
function child(parentId: string, id: string, name: string): void {
  run(cmd.addChildFeature(parentId, name, id))
  if (lastFocus !== id) throw new Error(`ID criado ${lastFocus}, esperado ${id}`)
}

async function main(): Promise<void> {
  // 1. Recriar o exemplo do zero
  const created = createFeatureModel('Loja Online', 'loja')
  if (!created.ok) throw new Error(created.error)
  state = { model: created.value, assets: EMPTY_ASSET_CATALOG }
  run(cmd.setFeatureDescription('loja', 'Raiz da linha de produtos de lojas virtuais.'))
  run(
    cmd.addAttribute('loja', {
      name: 'Versão',
      type: 'string',
      defaultValue: '1.0',
      configurable: false,
      options: []
    })
  )
  child('loja', 'catalogo', 'Catálogo')
  run(cmd.setVariability('catalogo', 'mandatory'))
  child('loja', 'busca', 'Busca')
  run(
    cmd.addAttribute('busca', {
      name: 'Máx. resultados',
      type: 'number',
      defaultValue: '50',
      min: 10,
      max: 500,
      configurable: true,
      options: []
    })
  )
  child('loja', 'mobile', 'App mobile')
  run(
    cmd.addAttribute('mobile', {
      name: 'Plataforma',
      type: 'enum',
      configurable: true,
      options: ['android', 'ios', 'ambas']
    })
  )
  child('loja', 'pagamento', 'Pagamento')
  run(cmd.setVariability('pagamento', 'mandatory'))
  child('pagamento', 'pag_cartao', 'Cartão')
  child('pagamento', 'pag_pix', 'PIX')
  child('pagamento', 'pag_boleto', 'Boleto')
  run(cmd.createGroup('pagamento', ['pag_cartao', 'pag_pix', 'pag_boleto'], 1, '*'))
  run(cmd.addConstraint(expression('pag_pix implies mobile'), 'PIX exige app mobile'))
  const expected = readFileSync(join(example, 'model.xml'), 'utf8')
  console.log(
    encodeFeatureModel(state.model) === expected
      ? 'IDÊNTICO ao exemplo (model.xml)'
      : 'DIFERENTE do exemplo'
  )
  console.log('comandos no histórico:', history.past.length)

  // 2. Desfazer tudo volta ao modelo inicial; refazer tudo volta ao exemplo
  const finalState = state
  while (history.past.length > 0) {
    const step = undo(history)!
    history = step.history
    state = step.state
  }
  console.log('desfazer tudo volta ao início:', state.model === created.value)
  while (history.future.length > 0) {
    const step = redo(history)!
    history = step.history
    state = step.state
  }
  console.log('refazer tudo volta ao exemplo:', state === finalState)

  // 3. Impacto e exclusão de pag_pix no projeto de exemplo
  const storage = new FsStorage(example)
  const validator = new NodeXsdValidator()
  const opened = await new OpenProject({
    picker: new FixedPicker(example),
    recents: new FixedRecents(),
    models: new XmlFeatureModelRepository(storage, validator),
    assets: new XmlAssetCatalogRepository(storage, validator),
    configurations: new XmlConfigurationRepository(storage, validator)
  }).execute()
  if (opened.status !== 'opened') throw new Error('não abriu')
  const project = opened.session.project
  const impact = analyzeFeatureDeletion(project, 'pag_pix')
  console.log(
    'impacto de excluir pag_pix:',
    JSON.stringify(impact.ok ? impact.value : impact.error)
  )
  history = EMPTY_HISTORY
  state = { model: project.model, assets: project.assets }
  const before = state
  run(cmd.deleteFeature('pag_pix', 'PIX'))
  console.log(
    'depois: restrições',
    state.model.constraints.length,
    '| assets',
    state.assets.assets.map((a) => a.id).join(',')
  )
  const back = undo(history)!
  console.log('desfazer restaura modelo e assets:', back.state === before)
  state = back.state
  history = back.history

  // 4. Edições que devem ser recusadas
  refused('nome vazio', cmd.renameFeature('busca', '   '))
  refused('ID repetido', cmd.addChildFeature('loja', 'Outra busca', 'busca'))
  refused('ID inválido', cmd.addChildFeature('loja', 'Pix', 'Pag-Pix'))
  refused('irmã da raiz', cmd.addSiblingFeature('loja'))
  refused('mover a raiz', cmd.moveFeature('loja', { kind: 'child', parentId: 'busca' }))
  refused(
    'mover para dentro de si',
    cmd.moveFeature('pagamento', { kind: 'child', parentId: 'pag_pix' })
  )
  refused('variabilidade em membro', cmd.setVariability('pag_pix', 'mandatory'))
  refused('grupo [4..*] com 3 membros', cmd.setGroupCardinality('pag_pix', 4, '*'))
  refused(
    'restrição com feature inexistente',
    cmd.addConstraint(expression('busca implies tablet'), '')
  )
  refused(
    'default fora da faixa',
    cmd.updateAttribute('busca', 'max_resultados', {
      name: 'Máx. resultados',
      type: 'number',
      defaultValue: '5',
      min: 10,
      max: 500,
      configurable: true,
      options: []
    })
  )
  refused('excluir a raiz', cmd.deleteFeature('loja', 'Loja Online'))
  refused('primeira para cima', cmd.reorderFeature('catalogo', -1))

  // 5. Movimentos e grupos: "id:variabilidade" para filhas soltas, grupo[min..max](membros)
  const childrenOf = (featureId: string): string =>
    findFeature(state.model.root, featureId)!
      .children.map((c) =>
        c.kind === 'feature'
          ? `${c.feature.id}:${c.feature.variability}`
          : `grupo[${c.group.min}..${c.group.max}](${c.group.members.map((m) => m.id).join(',')})`
      )
      .join(' ')
  run(cmd.moveFeature('pag_boleto', { kind: 'child', parentId: 'loja' }))
  console.log('boleto sai do grupo      →', childrenOf('loja'))
  run(cmd.moveFeature('busca', { kind: 'group', memberId: 'pag_pix' }))
  console.log('busca entra no grupo     →', childrenOf('pagamento'))
  run(cmd.ungroup('pag_pix'))
  console.log('desfazer o grupo         →', childrenOf('pagamento'))
  run(cmd.reorderFeature('pag_pix', -1))
  console.log('pag_pix para cima        →', childrenOf('pagamento'))
  run(cmd.createGroup('pagamento', ['pag_cartao', 'busca'], 1, 1))
  console.log('agrupar cartão e busca   →', childrenOf('pagamento'))
}

main()
```

```bash
npx tsx .checks/editor-check.ts
```

Esperado, exatamente:

```
IDÊNTICO ao exemplo (model.xml)
comandos no histórico: 15
desfazer tudo volta ao início: true
refazer tudo volta ao exemplo: true
impacto de excluir pag_pix: {"removedFeatureIds":["pag_pix"],"removedConstraintIds":["c1"],"unlinkedAssetIds":["doc_pix","img_pix"],"affectedConfigurations":["Loja Básica"]}
depois: restrições 0 | assets doc_loja,doc_busca,doc_busca_app,doc_boleto
desfazer restaura modelo e assets: true
recusado | nome vazio → O nome não pode ficar vazio.
recusado | ID repetido → O ID "busca" já existe no modelo.
recusado | ID inválido → O ID "Pag-Pix" é inválido: use letras minúsculas, dígitos e _, começando por letra, e evite palavras reservadas.
recusado | irmã da raiz → A raiz não tem irmãs: adicione uma filha.
recusado | mover a raiz → A raiz não pode ser movida.
recusado | mover para dentro de si → Uma feature não pode ir para dentro da própria subárvore.
recusado | variabilidade em membro → Só features fora de grupo são obrigatórias ou opcionais.
recusado | grupo [4..*] com 3 membros → O mínimo do grupo (4) passa do número de membros (3).
recusado | restrição com feature inexistente → A restrição cita a feature "tablet", que não existe.
recusado | default fora da faixa → default inválido: o mínimo é 10.
recusado | excluir a raiz → A raiz não pode ser excluída.
recusado | primeira para cima → A feature já é a primeira.
boleto sai do grupo      → catalogo:mandatory busca:optional mobile:optional pagamento:mandatory pag_boleto:optional
busca entra no grupo     → grupo[1..*](pag_cartao,pag_pix,busca)
desfazer o grupo         → pag_cartao:optional pag_pix:optional busca:optional
pag_pix para cima        → pag_pix:optional pag_cartao:optional busca:optional
agrupar cartão e busca   → pag_pix:optional grupo[1..1](pag_cartao,busca)
```

- [ ] **Passo 7: Commit**

```bash
git add -A
git commit -m "feat(application): comandos de edição com desfazer/refazer e análise de impacto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: Store do editor

**Arquivos:**

- Substituir: `src/renderer/src/ui/stores/project-store.ts`, `src/renderer/src/ui/stores/project-store-context.ts`, `src/renderer/src/ui/app/composition-root.ts`

**Interfaces:**

- Consome: casos de uso (Tarefa 3), comandos e histórico (Tarefa 4), adapters (Tarefa 2).
- Produz:
  - `ProjectStoreServices { openProject; createProject; saveProject; recentProjects; unsavedChanges }`
  - `ProjectState` com `session`, `saved`, `history`, `selectedFeatureId`, `busy`, `problems`, `warnings`, `conflicts`, `notice`, `recents`, `lastSavedAt` e as ações `loadRecents()`, `open()`, `openRecent(rootPath)`, `create(name, rootId?)`, `save(options?)`, `reload()`, `dismissConflicts()`, `close()`, `run(command): boolean`, `undo()`, `redo()`, `selectFeature(id)`, `dismissNotice()`
  - `editorStateOf(session)`, `hasUnsavedChanges(state)`
  - `useProjectStore(selector)`, `useProjectStoreApi()`

- [ ] **Passo 1: Substituir `src/renderer/src/ui/stores/project-store.ts`**

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
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { findFeature } from '@/domain/feature-model/tree'

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
  readonly recentProjects: { list(): Promise<RecentProject[]> }
  readonly unsavedChanges: UnsavedChangesIndicator
}

export interface ProjectState {
  readonly session: ProjectSession | null
  /** Modelo e assets como estão no disco; comparar com a sessão diz se há alterações. */
  readonly saved: EditorState | null
  readonly history: EditHistory
  readonly selectedFeatureId: string | null
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
  undo(): void
  redo(): void
  selectFeature(featureId: string): void
  dismissNotice(): void
}

export type ProjectStore = StoreApi<ProjectState>

export function editorStateOf(session: ProjectSession): EditorState {
  return { model: session.project.model, assets: session.project.assets }
}

export function hasUnsavedChanges(state: ProjectState): boolean {
  if (state.session === null || state.saved === null) return false
  const { model, assets } = state.session.project
  return model !== state.saved.model || assets !== state.saved.assets
}

const CLOSED = {
  session: null,
  saved: null,
  history: EMPTY_HISTORY,
  selectedFeatureId: null,
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
        saved: editorStateOf(session),
        selectedFeatureId: session.project.model.root.id
      })
      void get().loadRecents()
    }

    const handleOpen = (result: OpenProjectResult): void => {
      if (result.status === 'opened') opened(result.session, result.warnings)
      else set({ busy: false, problems: result.status === 'failed' ? result.problems : [] })
    }

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
          ...(complete ? { saved: editorStateOf(session), lastSavedAt: new Date() } : {})
        })
      },

      async reload() {
        const { session } = get()
        if (session === null) return
        set({ busy: true, problems: [], conflicts: [] })
        handleOpen(await services.openProject.reopen(session.folder.rootPath))
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

      dismissNotice() {
        set({ notice: null })
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
```

- [ ] **Passo 2: Substituir `src/renderer/src/ui/stores/project-store-context.ts`**

```ts
import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { ProjectState, ProjectStore } from './project-store'

/** A composition root (ui/app) fornece a store; as telas só a consomem. */
export const ProjectStoreContext = createContext<ProjectStore | null>(null)

/** Lê uma parte do estado; o componente só renderiza de novo quando essa parte muda. */
export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  return useStore(useProjectStoreApi(), selector)
}

/** A store em si, para ler o estado atual dentro de handlers (atalhos de teclado, por exemplo). */
export function useProjectStoreApi(): ProjectStore {
  const store = useContext(ProjectStoreContext)
  if (store === null) throw new Error('ProjectStoreContext não foi fornecido.')
  return store
}
```

- [ ] **Passo 3: Substituir `src/renderer/src/ui/app/composition-root.ts`**

```ts
import { CreateProject } from '@/application/use-cases/create-project'
import { OpenProject } from '@/application/use-cases/open-project'
import { SaveProject } from '@/application/use-cases/save-project'
import { ElectronProjectFolderPicker } from '@/infrastructure/electron/electron-project-folder-picker'
import { ElectronProjectStorage } from '@/infrastructure/electron/electron-project-storage'
import { ElectronRecentProjects } from '@/infrastructure/electron/electron-recent-projects'
import { ElectronUnsavedChangesIndicator } from '@/infrastructure/electron/electron-unsaved-changes-indicator'
import { ElectronXmlSchemaValidator } from '@/infrastructure/electron/electron-xml-schema-validator'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'
import { createProjectStore, type ProjectStore } from '@/ui/stores/project-store'

/**
 * Único lugar que conhece as implementações concretas (Dependency Inversion):
 * cria os adapters, injeta nos casos de uso e entrega a store pronta para a interface.
 */
export function createAppStore(): ProjectStore {
  const storage = new ElectronProjectStorage()
  const validator = new ElectronXmlSchemaValidator()
  const picker = new ElectronProjectFolderPicker()
  const recents = new ElectronRecentProjects()
  const models = new XmlFeatureModelRepository(storage, validator)
  const repositories = {
    models,
    assets: new XmlAssetCatalogRepository(storage, validator),
    configurations: new XmlConfigurationRepository(storage, validator)
  }
  return createProjectStore({
    openProject: new OpenProject({ picker, recents, ...repositories }),
    createProject: new CreateProject({ picker, models }),
    saveProject: new SaveProject(repositories),
    recentProjects: recents,
    unsavedChanges: new ElectronUnsavedChangesIndicator()
  })
}
```

- [ ] **Passo 4: Tipos e lint**

As telas da Fase 1 continuam funcionando com a store nova (só usam `busy`, `problems`, `warnings`, `lastSavedAt`, `open`, `save` e `close`).

```bash
npm run format && npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 5: Verificar a store com os casos de uso reais**

Crie `.checks/store-check.ts`:

```ts
// Exercita a store do editor com os casos de uso reais sobre cópias do exemplo:
// alterações não salvas, desfazer, gravar, conflito, sobrescrever, recarregar e criar projeto.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as cmd from '../src/renderer/src/application/editing/commands'
import { CreateProject } from '../src/renderer/src/application/use-cases/create-project'
import { OpenProject } from '../src/renderer/src/application/use-cases/open-project'
import { SaveProject } from '../src/renderer/src/application/use-cases/save-project'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '../src/renderer/src/infrastructure/xml/xml-repositories'
import { createProjectStore, hasUnsavedChanges } from '../src/renderer/src/ui/stores/project-store'
import { FixedPicker, FixedRecents, FsStorage, NodeXsdValidator } from './node-adapters'

const example = join(__dirname, '../docs/examples/loja-online')

function storeFor(root: string) {
  const storage = new FsStorage(root)
  const validator = new NodeXsdValidator()
  const picker = new FixedPicker(root)
  const models = new XmlFeatureModelRepository(storage, validator)
  const repos = {
    models,
    assets: new XmlAssetCatalogRepository(storage, validator),
    configurations: new XmlConfigurationRepository(storage, validator)
  }
  const indicator: boolean[] = []
  const store = createProjectStore({
    openProject: new OpenProject({ picker, recents: new FixedRecents(), ...repos }),
    createProject: new CreateProject({ picker, models }),
    saveProject: new SaveProject(repos),
    recentProjects: new FixedRecents(),
    unsavedChanges: {
      set: (value) => {
        if (indicator.at(-1) !== value) indicator.push(value)
      }
    }
  })
  return { store, indicator }
}

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'mdd-store-'))
  cpSync(example, dir, { recursive: true })
  const { store, indicator } = storeFor(dir)
  const state = () => store.getState()
  const dirty = () => hasUnsavedChanges(state())

  await state().open()
  console.log(
    'aberto:',
    state().session?.project.model.name,
    '| seleção:',
    state().selectedFeatureId,
    '| não salvo:',
    dirty()
  )

  state().run(cmd.addChildFeature('busca'))
  console.log('nova feature selecionada:', state().selectedFeatureId, '| não salvo:', dirty())
  console.log(
    'recusa guarda o motivo:',
    state().run(cmd.renameFeature('busca', '')),
    '→',
    state().notice
  )
  state().undo()
  console.log('desfazer volta ao disco:', !dirty(), '| seleção:', state().selectedFeatureId)
  state().redo()
  state().run(cmd.renameFeature('busca', 'Busca rápida'))

  writeFileSync(join(dir, 'model.xml'), readFileSync(join(dir, 'model.xml'), 'utf8') + '\n')
  await state().save()
  console.log('conflito:', JSON.stringify(state().conflicts), '| continua não salvo:', dirty())
  await state().save({ overwrite: true })
  console.log(
    'sobrescrever:',
    JSON.stringify(state().conflicts),
    '| não salvo:',
    dirty(),
    '| gravado:',
    readFileSync(join(dir, 'model.xml'), 'utf8').includes('Busca rápida')
  )

  state().run(cmd.deleteFeature('pag_pix', 'PIX'))
  console.log(
    'exclusão pendente, assets:',
    state().session?.project.assets.assets.length,
    '| não salvo:',
    dirty()
  )
  await state().reload()
  console.log(
    'recarregar descarta:',
    state().session?.project.assets.assets.length,
    'assets | não salvo:',
    dirty(),
    '| histórico:',
    state().history.past.length
  )

  state().close()
  console.log('fechado:', state().session === null)
  console.log('indicador recebeu:', indicator.map(String).join(' '))
  rmSync(dir, { recursive: true })

  const empty = mkdtempSync(join(tmpdir(), 'mdd-novo-'))
  const created = storeFor(empty).store
  await created.getState().create('Minha Linha')
  const model = created.getState().session?.project.model
  console.log(
    'criado:',
    model?.name,
    model?.root.id,
    '| arquivo:',
    readFileSync(join(empty, 'model.xml'), 'utf8').split('\n')[2].trim()
  )
  const again = storeFor(empty).store
  await again.getState().create('Outra')
  console.log(
    'pasta com projeto:',
    again
      .getState()
      .problems.map((p) => p.message)
      .join(' ')
  )
  rmSync(empty, { recursive: true })
}

main()
```

```bash
npx tsx .checks/store-check.ts
```

Esperado, exatamente:

```
aberto: Loja Online | seleção: loja | não salvo: false
nova feature selecionada: nova_feature | não salvo: true
recusa guarda o motivo: false → O nome não pode ficar vazio.
desfazer volta ao disco: true | seleção: loja
conflito: ["model.xml"] | continua não salvo: true
sobrescrever: [] | não salvo: false | gravado: true
exclusão pendente, assets: 4 | não salvo: true
recarregar descarta: 6 assets | não salvo: false | histórico: 0
fechado: true
indicador recebeu: false true false true false true false
criado: Minha Linha minha_linha | arquivo: <feature id="minha_linha" name="Minha Linha"/>
pasta com projeto: Esta pasta já tem um projeto. Use "Abrir projeto".
```

- [ ] **Passo 6: Commit**

```bash
git add -A
git commit -m "feat(ui): store do editor com histórico, seleção e ciclo de vida do projeto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 6: Painéis de propriedades e de restrições

**Arquivos:**

- Gerar (CLI): `src/renderer/src/ui/components/ui/dialog.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`
- Criar: `src/renderer/src/ui/components/CommitField.tsx`, `src/renderer/src/ui/components/use-name-and-id.ts`, `src/renderer/src/ui/components/NameAndIdFields.tsx`, `src/renderer/src/ui/screens/project/group-label.ts`; em `src/renderer/src/ui/screens/project/properties/`: `Field.tsx`, `FeatureProperties.tsx`, `GroupSection.tsx`, `AttributesSection.tsx`, `AttributeForm.tsx`; em `src/renderer/src/ui/screens/project/constraints/`: `ConstraintsPanel.tsx`, `ConstraintForm.tsx`
- Modificar: `package.json`

**Interfaces:**

- Consome: store (Tarefa 5), comandos e impacto (Tarefa 4).
- Produz:
  - `CommitField({ id, value, onCommit(value): boolean, multiline?, placeholder? })`
  - `useNameAndId(taken, fallback): NameAndId` (`name`, `id`, `setName`, `setId`, `problem`) e `NameAndIdFields({ value, htmlId })`: nome e ID de feature nova, com o ID sugerido a partir do nome
  - `describeGroup(group): string` (`alternative`, `or` ou `[min..max]`)
  - `FeatureProperties({ project })`, `ConstraintsPanel({ model })` (montados na Tarefa 7)

- [ ] **Passo 1: Gerar os componentes shadcn e instalar os ícones**

O CLI não instala o `lucide-react`, que o `dialog.tsx` usa (o mesmo tipo de falha do `class-variance-authority` na Fase 0). O botão de fechar do diálogo vem com texto em inglês.

```bash
npx shadcn@latest add dialog input label textarea -y -o < /dev/null
npm install lucide-react
sed -i 's#<span className="sr-only">Close</span>#<span className="sr-only">Fechar</span>#; s#<Button variant="outline">Close</Button>#<Button variant="outline">Fechar</Button>#' src/renderer/src/ui/components/ui/dialog.tsx
```

Esperado: `Created 4 files`, e `grep -c Fechar src/renderer/src/ui/components/ui/dialog.tsx` mostra `2`.

- [ ] **Passo 2: Criar `src/renderer/src/ui/components/CommitField.tsx`**

```tsx
import { useState } from 'react'
import { Input } from '@/ui/components/ui/input'
import { Textarea } from '@/ui/components/ui/textarea'

interface CommitFieldProps {
  readonly id: string
  readonly value: string
  /** Chamado ao sair do campo com o texto alterado; `false` = recusado, o campo volta ao valor. */
  readonly onCommit: (value: string) => boolean
  readonly multiline?: boolean
  readonly placeholder?: string
}

/**
 * Campo que só grava ao terminar de editar: ao sair do campo ou com Enter (Ctrl+Enter no
 * texto longo). Esc descarta. Assim uma palavra digitada vira um único passo de desfazer.
 */
export function CommitField({
  id,
  value,
  onCommit,
  multiline = false,
  placeholder
}: CommitFieldProps): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const [source, setSource] = useState(value)
  if (source !== value) {
    // O valor mudou por fora (desfazer, outra feature selecionada): mostra o novo valor.
    setSource(value)
    setDraft(value)
  }

  const commit = (): void => {
    if (draft !== value && !onCommit(draft)) setDraft(value)
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      setDraft(value)
      event.currentTarget.blur()
    } else if (event.key === 'Enter' && (!multiline || event.ctrlKey)) {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }
  const common = {
    id,
    value: draft,
    placeholder,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onBlur: commit,
    onKeyDown
  }
  return multiline ? <Textarea rows={3} {...common} /> : <Input {...common} />
}
```

- [ ] **Passo 3: Criar os campos de nome e ID de feature nova**

`src/renderer/src/ui/components/use-name-and-id.ts`:

```ts
import { useState } from 'react'
import { checkNewFeatureId } from '@/domain/feature-model/feature-edits'
import { generateId } from '@/domain/shared/identifier-generator'

export interface NameAndId {
  readonly name: string
  readonly id: string
  setName(name: string): void
  setId(id: string): void
  /** Por que ainda não dá para criar, ou `null`. */
  readonly problem: string | null
}

/**
 * Nome e ID de uma feature nova (ADR 0004). O ID acompanha o nome como sugestão até o
 * usuário editá-lo; depois de criada a feature, ele não muda mais.
 */
export function useNameAndId(taken: ReadonlySet<string>, fallback: string): NameAndId {
  const [name, setName] = useState('')
  const [customId, setCustomId] = useState<string | null>(null)
  const id = customId ?? generateId(name, taken, fallback)
  const problem = name.trim() === '' ? 'Informe o nome.' : checkNewFeatureId(id, taken)
  return { name, id, setName, setId: setCustomId, problem }
}
```

`src/renderer/src/ui/components/NameAndIdFields.tsx`:

```tsx
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import type { NameAndId } from './use-name-and-id'

interface NameAndIdFieldsProps {
  readonly value: NameAndId
  /** Prefixo dos `id` HTML dos campos, como "new-feature" → "new-feature-name". */
  readonly htmlId: string
}

/** Campos "Nome" e "ID" de uma feature nova, com o ID sugerido a partir do nome. */
export function NameAndIdFields({ value, htmlId }: NameAndIdFieldsProps): React.JSX.Element {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${htmlId}-name`}>Nome</Label>
        <Input
          id={`${htmlId}-name`}
          autoFocus
          value={value.name}
          onChange={(event) => value.setName(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${htmlId}-id`}>ID</Label>
        <Input
          id={`${htmlId}-id`}
          className="font-mono"
          value={value.id}
          onChange={(event) => value.setId(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Sugerido a partir do nome. Pode ser ajustado agora; depois da criação, não muda.
        </p>
        {value.name.trim() !== '' && value.problem !== null && (
          <p className="text-xs text-destructive">{value.problem}</p>
        )}
      </div>
    </>
  )
}
```

- [ ] **Passo 3b: Criar `src/renderer/src/ui/screens/project/group-label.ts`**

```ts
import type { Group } from '@/domain/feature-model/feature-model'

/** Nome clássico da cardinalidade: alternative [1..1], or [1..*] ou a faixa em si. */
export function describeGroup(group: Group): string {
  if (group.min === 1 && group.max === 1) return 'alternative'
  if (group.min === 1 && group.max === '*') return 'or'
  return `[${group.min}..${group.max}]`
}
```

- [ ] **Passo 4: Criar o painel de propriedades**

`src/renderer/src/ui/screens/project/properties/Field.tsx`:

```tsx
import { Label } from '@/ui/components/ui/label'

interface FieldProps {
  readonly label: string
  readonly htmlFor?: string
  readonly children: React.ReactNode
}

/** Rótulo + conteúdo, com o espaçamento padrão do painel de propriedades. */
export function Field({ label, htmlFor, children }: FieldProps): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
```

`src/renderer/src/ui/screens/project/properties/FeatureProperties.tsx`:

```tsx
import * as cmd from '@/application/editing/commands'
import type { Project } from '@/domain/project/project'
import { findFeature, locateFeature } from '@/domain/feature-model/tree'
import { CommitField } from '@/ui/components/CommitField'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AttributesSection } from './AttributesSection'
import { Field } from './Field'
import { GroupSection } from './GroupSection'

/** Propriedades da feature selecionada (SPEC §7). Cada alteração vira um comando. */
export function FeatureProperties({ project }: { readonly project: Project }): React.JSX.Element {
  const selectedId = useProjectStore((state) => state.selectedFeatureId)
  const run = useProjectStore((state) => state.run)
  const { model } = project
  const feature = selectedId !== null ? findFeature(model.root, selectedId) : undefined
  const location = selectedId !== null ? locateFeature(model.root, selectedId) : undefined
  if (feature === undefined || location === undefined) {
    return <p className="text-sm text-muted-foreground">Selecione uma feature.</p>
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Feature
      </h2>

      {location.kind === 'root' && (
        <Field label="Nome do modelo" htmlFor="model-name">
          <CommitField
            id="model-name"
            value={model.name}
            onCommit={(name) => run(cmd.renameModel(name))}
          />
        </Field>
      )}

      <Field label="Nome" htmlFor="feature-name">
        <CommitField
          id="feature-name"
          value={feature.name}
          onCommit={(name) => run(cmd.renameFeature(feature.id, name))}
        />
      </Field>

      <Field label="ID">
        <p className="text-sm">
          <code>{feature.id}</code>{' '}
          <span className="text-xs text-muted-foreground">gerado na criação; não muda</span>
        </p>
      </Field>

      <Field label="Descrição" htmlFor="feature-description">
        <CommitField
          id="feature-description"
          multiline
          value={feature.description ?? ''}
          placeholder="Opcional (Ctrl+Enter para confirmar)"
          onCommit={(description) => run(cmd.setFeatureDescription(feature.id, description))}
        />
      </Field>

      {location.kind === 'root' && (
        <p className="text-sm text-muted-foreground">A raiz está presente em todo produto.</p>
      )}
      {location.kind === 'solitary' && (
        <Field label="Variabilidade">
          <div className="flex gap-1">
            {(['mandatory', 'optional'] as const).map((variability) => (
              <Button
                key={variability}
                size="sm"
                variant={feature.variability === variability ? 'default' : 'outline'}
                onClick={() => run(cmd.setVariability(feature.id, variability))}
              >
                {variability === 'mandatory' ? '● Obrigatória' : '○ Opcional'}
              </Button>
            ))}
          </div>
        </Field>
      )}
      {location.kind === 'member' && (
        <GroupSection
          parent={location.parent}
          childIndex={location.childIndex}
          memberId={feature.id}
        />
      )}

      <AttributesSection project={project} feature={feature} />
    </section>
  )
}
```

`src/renderer/src/ui/screens/project/properties/GroupSection.tsx`:

```tsx
import { useState } from 'react'
import * as cmd from '@/application/editing/commands'
import type { Feature, GroupMax } from '@/domain/feature-model/feature-model'
import { groupAt } from '@/domain/feature-model/tree'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { describeGroup } from '../group-label'
import { Field } from './Field'

interface GroupSectionProps {
  readonly parent: Feature
  readonly childIndex: number
  /** Membro selecionado; ele identifica o grupo nos comandos. */
  readonly memberId: string
}

/** Cardinalidade do grupo da feature selecionada: alternative, or ou personalizada. */
export function GroupSection({
  parent,
  childIndex,
  memberId
}: GroupSectionProps): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const group = groupAt(parent, childIndex)
  const [min, setMin] = useState(String(group.min))
  const [max, setMax] = useState(String(group.max))
  const [source, setSource] = useState(group)
  if (source !== group) {
    setSource(group)
    setMin(String(group.min))
    setMax(String(group.max))
  }

  const apply = (newMin: number, newMax: GroupMax): boolean =>
    run(cmd.setGroupCardinality(memberId, newMin, newMax))
  const applyCustom = (): void => {
    const parsedMax: GroupMax = max.trim() === '*' ? '*' : Number(max)
    apply(Number(min), parsedMax)
  }

  return (
    <Field label={`Grupo de "${parent.name}" — ${describeGroup(group)}`}>
      <p className="text-xs text-muted-foreground">
        Membros de grupo não são obrigatórios nem opcionais: a cardinalidade decide quantos entram.
      </p>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" onClick={() => apply(1, 1)}>
          Alternative [1..1]
        </Button>
        <Button size="sm" variant="outline" onClick={() => apply(1, '*')}>
          Or [1..*]
        </Button>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Input
          aria-label="Mínimo"
          className="w-16"
          value={min}
          onChange={(event) => setMin(event.target.value)}
        />
        <span>até</span>
        <Input
          aria-label="Máximo (número ou *)"
          className="w-16"
          value={max}
          onChange={(event) => setMax(event.target.value)}
        />
        <Button size="sm" variant="outline" onClick={applyCustom}>
          Aplicar
        </Button>
      </div>
      <Button size="sm" variant="ghost" onClick={() => run(cmd.ungroup(memberId))}>
        Desfazer grupo
      </Button>
    </Field>
  )
}
```

`src/renderer/src/ui/screens/project/properties/AttributesSection.tsx`:

```tsx
import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import * as cmd from '@/application/editing/commands'
import { configurationsUsingAttribute } from '@/application/editing/impact'
import type { Attribute, Feature } from '@/domain/feature-model/feature-model'
import type { Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { AttributeForm } from './AttributeForm'

interface AttributesSectionProps {
  readonly project: Project
  readonly feature: Feature
}

/** `null` = nenhum formulário; `'new'` = criando; ID = editando esse atributo. */
type Editing = null | 'new' | string

export function AttributesSection({ project, feature }: AttributesSectionProps): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const [editing, setEditing] = useState<Editing>(null)
  const [featureId, setFeatureId] = useState(feature.id)
  if (featureId !== feature.id) {
    setFeatureId(feature.id)
    setEditing(null)
  }

  const remove = (attribute: Attribute): void => {
    const users = configurationsUsingAttribute(project, feature.id, attribute.id)
    const warning =
      users.length > 0
        ? `\n\nEstas configurações têm valor para ele e vão abrir como desatualizadas: ${users.join(', ')}.`
        : ''
    if (window.confirm(`Excluir o atributo "${attribute.name}"?${warning}`)) {
      run(cmd.removeAttribute(feature.id, attribute.id))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Atributos</h3>
        <Button size="sm" variant="ghost" onClick={() => setEditing('new')}>
          <Plus /> Adicionar
        </Button>
      </div>

      {feature.attributes.length === 0 && editing !== 'new' && (
        <p className="text-sm text-muted-foreground">Nenhum atributo.</p>
      )}

      <ul className="space-y-1">
        {feature.attributes.map((attribute) =>
          editing === attribute.id ? (
            <li key={attribute.id}>
              <AttributeForm
                initial={attribute}
                onCancel={() => setEditing(null)}
                onSubmit={(draft) => {
                  const done = run(cmd.updateAttribute(feature.id, attribute.id, draft))
                  if (done) setEditing(null)
                }}
              />
            </li>
          ) : (
            <li key={attribute.id} className="flex items-center gap-1 text-sm">
              <span className="flex-1">
                {attribute.name}{' '}
                <code className="text-xs text-muted-foreground">{attribute.id}</code>
                <span className="block text-xs text-muted-foreground">{summarize(attribute)}</span>
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Editar"
                onClick={() => setEditing(attribute.id)}
              >
                <Pencil />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Excluir"
                onClick={() => remove(attribute)}
              >
                <Trash2 />
              </Button>
            </li>
          )
        )}
      </ul>

      {editing === 'new' && (
        <AttributeForm
          onCancel={() => setEditing(null)}
          onSubmit={(draft) => {
            if (run(cmd.addAttribute(feature.id, draft))) setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function summarize(attribute: Attribute): string {
  const parts: string[] = [attribute.type]
  if (attribute.type === 'enum') parts.push(`{${attribute.options.join(', ')}}`)
  if (attribute.min !== undefined || attribute.max !== undefined) {
    parts.push(`${attribute.min ?? '…'} a ${attribute.max ?? '…'}`)
  }
  if (attribute.defaultValue !== undefined) parts.push(`padrão ${attribute.defaultValue}`)
  parts.push(attribute.configurable ? 'escolhido por produto' : 'fixo')
  return parts.join(' · ')
}
```

`src/renderer/src/ui/screens/project/properties/AttributeForm.tsx`:

```tsx
import { useState } from 'react'
import type { AttributeDraft } from '@/domain/feature-model/attribute-edits'
import type { Attribute, AttributeType } from '@/domain/feature-model/feature-model'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'

interface AttributeFormProps {
  readonly initial?: Attribute
  readonly onSubmit: (draft: AttributeDraft) => void
  readonly onCancel: () => void
}

const TYPES: readonly AttributeType[] = ['string', 'number', 'boolean', 'enum']

/**
 * Formulário de atributo. Não valida nada: monta o rascunho e o comando confere as
 * regras M5 (tipos, faixa, default); se recusar, o motivo aparece no aviso da tela.
 */
export function AttributeForm({
  initial,
  onSubmit,
  onCancel
}: AttributeFormProps): React.JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<AttributeType>(initial?.type ?? 'string')
  const [defaultValue, setDefaultValue] = useState(initial?.defaultValue ?? '')
  const [min, setMin] = useState(initial?.min?.toString() ?? '')
  const [max, setMax] = useState(initial?.max?.toString() ?? '')
  const [options, setOptions] = useState(initial?.options.join(', ') ?? '')
  const [fixed, setFixed] = useState(initial !== undefined && !initial.configurable)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    onSubmit({
      name,
      type,
      ...(defaultValue.trim() !== '' ? { defaultValue: defaultValue.trim() } : {}),
      ...(type === 'number' && min.trim() !== '' ? { min: Number(min) } : {}),
      ...(type === 'number' && max.trim() !== '' ? { max: Number(max) } : {}),
      configurable: !fixed,
      options:
        type === 'enum'
          ? options
              .split(',')
              .map((option) => option.trim())
              .filter((option) => option !== '')
          : []
    })
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border p-3 text-sm">
      <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
        <Label htmlFor="attribute-name">Nome</Label>
        <Input
          id="attribute-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Label htmlFor="attribute-type">Tipo</Label>
        <select
          id="attribute-type"
          className="h-9 rounded-md border bg-transparent px-2"
          value={type}
          onChange={(e) => setType(e.target.value as AttributeType)}
        >
          {TYPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        {type === 'enum' && (
          <>
            <Label htmlFor="attribute-options">Opções</Label>
            <Input
              id="attribute-options"
              placeholder="android, ios, ambas"
              value={options}
              onChange={(e) => setOptions(e.target.value)}
            />
          </>
        )}

        {type === 'number' && (
          <>
            <Label>Faixa</Label>
            <div className="flex items-center gap-2">
              <Input aria-label="Mínimo" value={min} onChange={(e) => setMin(e.target.value)} />
              <span>a</span>
              <Input aria-label="Máximo" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </>
        )}

        <Label htmlFor="attribute-default">Padrão</Label>
        <Input
          id="attribute-default"
          placeholder={type === 'boolean' ? 'true ou false' : 'opcional'}
          value={defaultValue}
          onChange={(e) => setDefaultValue(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
        Valor fixo, definido no modelo (senão, cada produto escolhe)
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm">
          {initial ? 'Salvar atributo' : 'Adicionar atributo'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Passo 5: Criar o painel de restrições**

`src/renderer/src/ui/screens/project/constraints/ConstraintsPanel.tsx`:

```tsx
import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import * as cmd from '@/application/editing/commands'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { printExpression } from '@/domain/expression/printer'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { ConstraintForm } from './ConstraintForm'

/** `null` = nenhum formulário; `'new'` = criando; ID = editando essa restrição. */
type Editing = null | 'new' | string

/** Lista e edição das restrições entre ramos (SPEC §7). */
export function ConstraintsPanel({ model }: { readonly model: FeatureModel }): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const [editing, setEditing] = useState<Editing>(null)

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Restrições ({model.constraints.length})
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setEditing('new')}>
          <Plus /> Nova
        </Button>
      </div>

      <ul className="space-y-1">
        {model.constraints.map((constraint) =>
          editing === constraint.id ? (
            <li key={constraint.id}>
              <ConstraintForm
                model={model}
                initial={constraint}
                onCancel={() => setEditing(null)}
                onSubmit={(expression, description) => {
                  const done = run(cmd.updateConstraint(constraint.id, expression, description))
                  if (done) setEditing(null)
                }}
              />
            </li>
          ) : (
            <li key={constraint.id} className="flex items-start gap-1 text-sm">
              <span className="flex-1">
                <code>{printExpression(constraint.expression)}</code>
                {constraint.description && (
                  <span className="block text-xs text-muted-foreground">
                    {constraint.description}
                  </span>
                )}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Editar"
                onClick={() => setEditing(constraint.id)}
              >
                <Pencil />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Excluir"
                onClick={() => run(cmd.removeConstraint(constraint.id))}
              >
                <Trash2 />
              </Button>
            </li>
          )
        )}
      </ul>

      {editing === 'new' && (
        <ConstraintForm
          model={model}
          onCancel={() => setEditing(null)}
          onSubmit={(expression, description) => {
            if (run(cmd.addConstraint(expression, description))) setEditing(null)
          }}
        />
      )}
    </section>
  )
}
```

`src/renderer/src/ui/screens/project/constraints/ConstraintForm.tsx`:

```tsx
import { useState } from 'react'
import type { Expression } from '@/domain/expression/ast'
import { parseExpression } from '@/domain/expression/parser'
import { printExpression } from '@/domain/expression/printer'
import { referencedFeatureIds } from '@/domain/expression/references'
import type { Constraint, FeatureModel } from '@/domain/feature-model/feature-model'
import { featureIdSet } from '@/domain/feature-model/tree'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'

interface ConstraintFormProps {
  readonly model: FeatureModel
  readonly initial?: Constraint
  readonly onSubmit: (expression: Expression, description: string) => void
  readonly onCancel: () => void
}

const MAX_SUGGESTIONS = 8

/**
 * Editor de restrição: mostra o erro de sintaxe com a coluna enquanto se digita e sugere
 * IDs de features para a palavra em andamento. Só confirma uma expressão válida.
 */
export function ConstraintForm({
  model,
  initial,
  onSubmit,
  onCancel
}: ConstraintFormProps): React.JSX.Element {
  const [text, setText] = useState(initial ? printExpression(initial.expression) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const ids = featureIdSet(model.root)

  const parsed = parseExpression(text)
  const unknown = parsed.ok
    ? [...referencedFeatureIds(parsed.value)].filter((id) => !ids.has(id))
    : []
  const partial = /[a-z0-9_]*$/.exec(text)?.[0] ?? ''
  const suggestions =
    partial === ''
      ? []
      : [...ids].filter((id) => id.startsWith(partial) && id !== partial).slice(0, MAX_SUGGESTIONS)

  const complete = (id: string): void => {
    setText(`${text.slice(0, text.length - partial.length)}${id} `)
  }
  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (parsed.ok && unknown.length === 0) onSubmit(parsed.value, description)
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border p-3 text-sm">
      <div className="space-y-1.5">
        <Label htmlFor="constraint-expression">Expressão</Label>
        <Input
          id="constraint-expression"
          autoFocus
          className="font-mono"
          placeholder="pag_pix implies mobile"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Operadores: not, and, or, implies, iff. Use os IDs das features.
        </p>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suggestions.map((id) => (
              <button
                key={id}
                type="button"
                className="rounded bg-muted px-1.5 font-mono text-xs hover:bg-accent"
                onClick={() => complete(id)}
              >
                {id}
              </button>
            ))}
          </div>
        )}
        {text.trim() !== '' && !parsed.ok && (
          <p className="text-xs text-destructive">
            Coluna {parsed.error.column}: {parsed.error.message}
          </p>
        )}
        {unknown.length > 0 && (
          <p className="text-xs text-destructive">Features inexistentes: {unknown.join(', ')}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="constraint-description">Descrição</Label>
        <Input
          id="constraint-description"
          placeholder="Opcional"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={!parsed.ok || unknown.length > 0}>
          {initial ? 'Salvar restrição' : 'Adicionar restrição'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Passo 6: Tipos, lint e commit**

Os painéis ainda não aparecem na tela (a Tarefa 7 os monta); aqui a verificação é de tipos e camadas.

```bash
npm run format && npm run typecheck && npm run lint
git add -A
git commit -m "feat(ui): painéis de propriedades e de restrições

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Esperado: typecheck e lint sem erros.

---

### Tarefa 7: Telas, diálogos e atalhos

**Arquivos:**

- Substituir: `src/renderer/src/ui/app/App.tsx`, `src/renderer/src/ui/screens/start/StartScreen.tsx`, `src/renderer/src/ui/screens/project/FeatureTree.tsx`, `src/renderer/src/ui/screens/project/ProjectScreen.tsx`
- Criar: `src/renderer/src/ui/screens/start/NewProjectDialog.tsx`; em `src/renderer/src/ui/screens/project/`: `editor-dialog.ts`, `ProjectHeader.tsx`, `FeatureToolbar.tsx`, `use-editor-shortcuts.ts`, `dialogs/NewFeatureDialog.tsx`, `dialogs/DeleteFeatureDialog.tsx`, `dialogs/CreateGroupDialog.tsx`, `dialogs/ConflictDialog.tsx`, `dialogs/CloseProjectDialog.tsx`

**Interfaces:**

- Consome: store (Tarefa 5), painéis (Tarefa 6), comandos e impacto (Tarefa 4).
- Produz: a interface completa da Fase 2A.

- [ ] **Passo 1: Substituir `src/renderer/src/ui/app/App.tsx` (com o título da janela)**

```tsx
import { useEffect } from 'react'
import { ProjectScreen } from '@/ui/screens/project/ProjectScreen'
import { StartScreen } from '@/ui/screens/start/StartScreen'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { ProjectStoreContext, useProjectStore } from '@/ui/stores/project-store-context'
import { createAppStore } from './composition-root'

const store = createAppStore()

export function App(): React.JSX.Element {
  return (
    <ProjectStoreContext.Provider value={store}>
      <CurrentScreen />
    </ProjectStoreContext.Provider>
  )
}

function CurrentScreen(): React.JSX.Element {
  const session = useProjectStore((state) => state.session)
  useWindowTitle()
  return session === null ? <StartScreen /> : <ProjectScreen session={session} />
}

/** "• Loja Online — mdd" quando há alterações não salvas (SPEC §8). */
function useWindowTitle(): void {
  const title = useProjectStore((state) =>
    state.session === null
      ? 'mdd'
      : `${hasUnsavedChanges(state) ? '• ' : ''}${state.session.project.model.name} — mdd`
  )
  useEffect(() => {
    document.title = title
  }, [title])
}
```

- [ ] **Passo 2: Tela inicial**

`src/renderer/src/ui/screens/start/StartScreen.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { NewProjectDialog } from './NewProjectDialog'

export function StartScreen(): React.JSX.Element {
  const busy = useProjectStore((state) => state.busy)
  const problems = useProjectStore((state) => state.problems)
  const recents = useProjectStore((state) => state.recents)
  const open = useProjectStore((state) => state.open)
  const openRecent = useProjectStore((state) => state.openRecent)
  const loadRecents = useProjectStore((state) => state.loadRecents)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void loadRecents()
  }, [loadRecents])

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-10">
      <header>
        <h1 className="text-3xl font-semibold">mdd</h1>
        <p className="text-muted-foreground">
          Linhas de produto: Feature Models, configurações e documentação.
        </p>
      </header>

      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => setCreating(true)}>
          <Plus /> Novo projeto
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void open()}>
          <FolderOpen /> {busy ? 'Abrindo…' : 'Abrir projeto'}
        </Button>
      </div>

      <ProblemList title="O projeto não pôde ser aberto" tone="error" problems={problems} />

      {recents.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recentes
          </h2>
          <ul className="divide-y rounded-md border">
            {recents.map((recent) => (
              <li key={recent.rootPath}>
                <button
                  className="w-full px-3 py-2 text-left hover:bg-accent disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void openRecent(recent.rootPath)}
                >
                  <span className="font-medium">{recent.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {recent.rootPath}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {creating && <NewProjectDialog onClose={() => setCreating(false)} />}
    </main>
  )
}
```

`src/renderer/src/ui/screens/start/NewProjectDialog.tsx`:

```tsx
import { NameAndIdFields } from '@/ui/components/NameAndIdFields'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { useNameAndId } from '@/ui/components/use-name-and-id'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface NewProjectDialogProps {
  readonly onClose: () => void
}

const NO_IDS: ReadonlySet<string> = new Set()

/** Pede o nome e o ID da raiz; em seguida o diálogo nativo pede a pasta (SPEC §7). */
export function NewProjectDialog({ onClose }: NewProjectDialogProps): React.JSX.Element {
  const create = useProjectStore((state) => state.create)
  const fields = useNameAndId(NO_IDS, 'raiz')

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (fields.problem !== null) return
    onClose()
    void create(fields.name, fields.id)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>
              O nome vira o nome do modelo e da feature raiz. Em seguida, escolha uma pasta sem
              projeto.
            </DialogDescription>
          </DialogHeader>
          <NameAndIdFields value={fields} htmlId="new-project" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={fields.problem !== null}>
              Escolher pasta…
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Passo 3: Cabeçalho, árvore e barra de ações**

`src/renderer/src/ui/screens/project/editor-dialog.ts`:

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
  | null
```

`src/renderer/src/ui/screens/project/ProjectHeader.tsx`:

```tsx
import { Redo2, Save, Undo2, X } from 'lucide-react'
import type { ProjectSession } from '@/application/project-session'
import { Button } from '@/ui/components/ui/button'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface ProjectHeaderProps {
  readonly session: ProjectSession
  readonly onClose: () => void
}

export function ProjectHeader({ session, onClose }: ProjectHeaderProps): React.JSX.Element {
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
        disabled={undoLabel === undefined}
        title={undoLabel ? `Desfazer: ${undoLabel} (Ctrl+Z)` : 'Nada para desfazer'}
        onClick={undo}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={redoLabel === undefined}
        title={redoLabel ? `Refazer: ${redoLabel} (Ctrl+Y)` : 'Nada para refazer'}
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
```

`src/renderer/src/ui/screens/project/FeatureTree.tsx`:

```tsx
import type { Feature } from '@/domain/feature-model/feature-model'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { describeGroup } from './group-label'

/**
 * Árvore do modelo em lista, com seleção (Fase 2A). O diagrama gráfico a substitui na Fase 2B.
 * ● obrigatória, ○ opcional; membros de grupo aparecem sob o rótulo do grupo.
 */
export function FeatureTree({ root }: { readonly root: Feature }): React.JSX.Element {
  return (
    <ul className="space-y-0.5 text-sm" role="tree">
      <FeatureItem feature={root} />
    </ul>
  )
}

function FeatureItem({ feature }: { readonly feature: Feature }): React.JSX.Element {
  const selected = useProjectStore((state) => state.selectedFeatureId === feature.id)
  const selectFeature = useProjectStore((state) => state.selectFeature)

  return (
    <li role="treeitem" aria-selected={selected}>
      <button
        data-feature-id={feature.id}
        className={`flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left ${
          selected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
        }`}
        onClick={() => selectFeature(feature.id)}
      >
        <span aria-hidden className="w-3 text-center">
          {variabilityMarker(feature)}
        </span>
        <span className="font-medium">{feature.name}</span>
        <code className={`text-xs ${selected ? 'opacity-80' : 'text-muted-foreground'}`}>
          {feature.id}
        </code>
      </button>
      {feature.children.length > 0 && (
        <ul className="ml-4 space-y-0.5 border-l pl-2">
          {feature.children.map((child, index) =>
            child.kind === 'feature' ? (
              <FeatureItem key={child.feature.id} feature={child.feature} />
            ) : (
              <li key={`group-${index}`}>
                <span className="pl-1.5 text-xs uppercase text-muted-foreground">
                  grupo {describeGroup(child.group)}
                </span>
                <ul className="ml-2 space-y-0.5">
                  {child.group.members.map((member) => (
                    <FeatureItem key={member.id} feature={member} />
                  ))}
                </ul>
              </li>
            )
          )}
        </ul>
      )}
    </li>
  )
}

function variabilityMarker(feature: Feature): string {
  if (feature.variability === 'mandatory') return '●'
  if (feature.variability === 'optional') return '○'
  return ''
}
```

`src/renderer/src/ui/screens/project/FeatureToolbar.tsx`:

```tsx
import { ArrowDown, ArrowUp, Group as GroupIcon, ListPlus, Plus, Trash2 } from 'lucide-react'
import * as cmd from '@/application/editing/commands'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { findFeature, locateFeature } from '@/domain/feature-model/tree'
import { Button } from '@/ui/components/ui/button'
import { useProjectStore } from '@/ui/stores/project-store-context'
import type { EditorDialog } from './editor-dialog'

interface FeatureToolbarProps {
  readonly model: FeatureModel
  readonly onOpenDialog: (dialog: EditorDialog) => void
}

/** Ações sobre a feature selecionada; os atalhos equivalentes aparecem na dica de cada botão. */
export function FeatureToolbar({ model, onOpenDialog }: FeatureToolbarProps): React.JSX.Element {
  const selectedId = useProjectStore((state) => state.selectedFeatureId)
  const run = useProjectStore((state) => state.run)
  const feature = selectedId !== null ? findFeature(model.root, selectedId) : undefined
  const location = selectedId !== null ? locateFeature(model.root, selectedId) : undefined
  const isRoot = location?.kind === 'root'
  const hasLooseChildren = feature?.children.some((child) => child.kind === 'feature') ?? false

  if (feature === undefined) return <div className="h-9" />

  return (
    <div className="mb-3 flex flex-wrap gap-1">
      <Button
        size="sm"
        variant="outline"
        title="Adicionar filha (Tab)"
        onClick={() =>
          onOpenDialog({ kind: 'new-feature', placement: 'child', featureId: feature.id })
        }
      >
        <Plus /> Filha
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isRoot}
        title="Adicionar irmã logo abaixo (Enter)"
        onClick={() =>
          onOpenDialog({ kind: 'new-feature', placement: 'sibling', featureId: feature.id })
        }
      >
        <ListPlus /> Irmã
      </Button>
      <Button
        size="icon-sm"
        variant="outline"
        disabled={isRoot}
        title="Mover para cima (Alt+↑)"
        onClick={() => run(cmd.reorderFeature(feature.id, -1))}
      >
        <ArrowUp />
      </Button>
      <Button
        size="icon-sm"
        variant="outline"
        disabled={isRoot}
        title="Mover para baixo (Alt+↓)"
        onClick={() => run(cmd.reorderFeature(feature.id, 1))}
      >
        <ArrowDown />
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!hasLooseChildren}
        title="Juntar filhas soltas num grupo"
        onClick={() => onOpenDialog({ kind: 'create-group', parentId: feature.id })}
      >
        <GroupIcon /> Agrupar filhas…
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isRoot}
        title="Excluir com a subárvore (Delete)"
        onClick={() => onOpenDialog({ kind: 'delete-feature', featureId: feature.id })}
      >
        <Trash2 /> Excluir…
      </Button>
    </div>
  )
}
```

- [ ] **Passo 4: Diálogos**

`src/renderer/src/ui/screens/project/dialogs/NewFeatureDialog.tsx` (Tab e Enter abrem este diálogo, que pede nome e ID):

```tsx
import * as cmd from '@/application/editing/commands'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { featureIdSet, findFeature } from '@/domain/feature-model/tree'
import { NameAndIdFields } from '@/ui/components/NameAndIdFields'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { useNameAndId } from '@/ui/components/use-name-and-id'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface NewFeatureDialogProps {
  readonly model: FeatureModel
  /** Filha da feature indicada, ou irmã logo abaixo dela. */
  readonly placement: 'child' | 'sibling'
  readonly featureId: string
  readonly onClose: () => void
}

/** Cria uma feature pedindo nome e ID (Tab = filha, Enter = irmã). */
export function NewFeatureDialog({
  model,
  placement,
  featureId,
  onClose
}: NewFeatureDialogProps): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const fields = useNameAndId(featureIdSet(model.root), 'feature')
  const target = findFeature(model.root, featureId)

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (fields.problem !== null) return
    const command =
      placement === 'child'
        ? cmd.addChildFeature(featureId, fields.name, fields.id)
        : cmd.addSiblingFeature(featureId, fields.name, fields.id)
    if (run(command)) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {placement === 'child' ? 'Nova filha de' : 'Nova irmã de'} “{target?.name}”
            </DialogTitle>
          </DialogHeader>
          <NameAndIdFields value={fields} htmlId="new-feature" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={fields.problem !== null}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

`src/renderer/src/ui/screens/project/dialogs/DeleteFeatureDialog.tsx`:

```tsx
import * as cmd from '@/application/editing/commands'
import { analyzeFeatureDeletion } from '@/application/editing/impact'
import { printExpression } from '@/domain/expression/printer'
import { findFeature } from '@/domain/feature-model/tree'
import type { Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/components/ui/dialog'
import { useProjectStore } from '@/ui/stores/project-store-context'

interface DeleteFeatureDialogProps {
  readonly project: Project
  readonly featureId: string
  readonly onClose: () => void
}

/** Mostra tudo o que a exclusão leva junto antes de confirmar (SPEC §4.5). */
export function DeleteFeatureDialog({
  project,
  featureId,
  onClose
}: DeleteFeatureDialogProps): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const feature = findFeature(project.model.root, featureId)
  const impact = analyzeFeatureDeletion(project, featureId)
  const nameOf = (id: string): string => findFeature(project.model.root, id)?.name ?? id

  const confirm = (): void => {
    if (feature !== undefined) run(cmd.deleteFeature(featureId, feature.name))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir “{feature?.name ?? featureId}”?</DialogTitle>
          <DialogDescription>
            Dá para desfazer com Ctrl+Z enquanto o projeto estiver aberto.
          </DialogDescription>
        </DialogHeader>

        {!impact.ok ? (
          <p className="text-sm text-destructive">{impact.error}</p>
        ) : (
          <div className="space-y-3 text-sm">
            <Impact title="Features excluídas" items={impact.value.removedFeatureIds.map(nameOf)} />
            <Impact
              title="Restrições removidas inteiras"
              items={impact.value.removedConstraintIds.map((id) => {
                const constraint = project.model.constraints.find((c) => c.id === id)
                return constraint ? printExpression(constraint.expression) : id
              })}
            />
            <Impact
              title="Assets desvinculados (os arquivos continuam no disco)"
              items={impact.value.unlinkedAssetIds.map((id) => {
                const asset = project.assets.assets.find((a) => a.id === id)
                return asset ? asset.path : id
              })}
            />
            <Impact
              title="Configurações que vão abrir como desatualizadas"
              items={[...impact.value.affectedConfigurations]}
            />
            {impact.value.groupChange && <p>{impact.value.groupChange}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!impact.ok} onClick={confirm}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Impact({
  title,
  items
}: {
  readonly title: string
  readonly items: readonly string[]
}): React.JSX.Element | null {
  if (items.length === 0) return null
  return (
    <div>
      <p className="font-medium">
        {title} ({items.length})
      </p>
      <ul className="ml-4 list-disc text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
```

`src/renderer/src/ui/screens/project/dialogs/CreateGroupDialog.tsx`:

```tsx
import { useState } from 'react'
import * as cmd from '@/application/editing/commands'
import type { FeatureModel, GroupMax } from '@/domain/feature-model/feature-model'
import { findFeature } from '@/domain/feature-model/tree'
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
import { useProjectStore } from '@/ui/stores/project-store-context'

interface CreateGroupDialogProps {
  readonly model: FeatureModel
  readonly parentId: string
  readonly onClose: () => void
}

type Kind = 'alternative' | 'or' | 'custom'

/** Escolhe filhas soltas e o tipo do grupo (SPEC §4.5 "criar grupo a partir de filhos"). */
export function CreateGroupDialog({
  model,
  parentId,
  onClose
}: CreateGroupDialogProps): React.JSX.Element {
  const run = useProjectStore((state) => state.run)
  const parent = findFeature(model.root, parentId)
  const loose = (parent?.children ?? []).flatMap((child) =>
    child.kind === 'feature' ? [child.feature] : []
  )
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(loose.map((f) => f.id)))
  const [kind, setKind] = useState<Kind>('alternative')
  const [min, setMin] = useState('1')
  const [max, setMax] = useState('*')

  const toggle = (id: string): void => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  const create = (): void => {
    const [groupMin, groupMax]: [number, GroupMax] =
      kind === 'alternative'
        ? [1, 1]
        : kind === 'or'
          ? [1, '*']
          : [Number(min), max.trim() === '*' ? '*' : Number(max)]
    const ids = loose.map((f) => f.id).filter((id) => selected.has(id))
    if (run(cmd.createGroup(parentId, ids, groupMin, groupMax))) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agrupar filhas de “{parent?.name ?? parentId}”</DialogTitle>
          <DialogDescription>
            O grupo fica na posição da primeira feature escolhida. As features deixam de ser
            obrigatórias ou opcionais: a cardinalidade decide quantas entram no produto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm">
          {loose.map((feature) => (
            <label key={feature.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(feature.id)}
                onChange={() => toggle(feature.id)}
              />
              {feature.name} <code className="text-xs text-muted-foreground">{feature.id}</code>
            </label>
          ))}
        </div>

        <div className="space-y-1 text-sm">
          {(
            [
              ['alternative', 'Alternative [1..1]: exatamente uma'],
              ['or', 'Or [1..*]: pelo menos uma'],
              ['custom', 'Personalizada']
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" checked={kind === value} onChange={() => setKind(value)} />
              {label}
            </label>
          ))}
          {kind === 'custom' && (
            <div className="ml-6 flex items-center gap-2">
              <Input
                aria-label="Mínimo"
                className="w-16"
                value={min}
                onChange={(e) => setMin(e.target.value)}
              />
              <span>até</span>
              <Input
                aria-label="Máximo (número ou *)"
                className="w-16"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={selected.size === 0} onClick={create}>
            Criar grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

`src/renderer/src/ui/screens/project/dialogs/ConflictDialog.tsx`:

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
import { useProjectStore } from '@/ui/stores/project-store-context'

/** Arquivos mudaram fora do app desde a última leitura: sobrescrever, recarregar ou cancelar (SPEC §8). */
export function ConflictDialog(): React.JSX.Element | null {
  const conflicts = useProjectStore((state) => state.conflicts)
  const save = useProjectStore((state) => state.save)
  const reload = useProjectStore((state) => state.reload)
  const dismiss = useProjectStore((state) => state.dismissConflicts)
  if (conflicts.length === 0) return null

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arquivos alterados fora do app</DialogTitle>
          <DialogDescription>
            Estes arquivos mudaram no disco desde que foram abertos (por exemplo, depois de um git
            pull) e não foram gravados:
          </DialogDescription>
        </DialogHeader>
        <ul className="ml-4 list-disc font-mono text-sm">
          {conflicts.map((file) => (
            <li key={file}>{file}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={() => void reload()}>
            Recarregar (descarta minhas alterações)
          </Button>
          <Button variant="destructive" onClick={() => void save({ overwrite: true })}>
            Sobrescrever
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

`src/renderer/src/ui/screens/project/dialogs/CloseProjectDialog.tsx`:

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
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { useProjectStore, useProjectStoreApi } from '@/ui/stores/project-store-context'

/** Fechar o projeto com alterações não salvas pede confirmação (SPEC §8). */
export function CloseProjectDialog({
  onCancel
}: {
  readonly onCancel: () => void
}): React.JSX.Element {
  const store = useProjectStoreApi()
  const close = useProjectStore((state) => state.close)
  const save = useProjectStore((state) => state.save)

  const saveAndClose = async (): Promise<void> => {
    await save()
    // Só fecha se a gravação deu certo; senão o conflito ou o erro aparece na tela.
    if (!hasUnsavedChanges(store.getState())) close()
    else onCancel()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar com alterações não salvas?</DialogTitle>
          <DialogDescription>Se fechar sem salvar, as alterações serão perdidas.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={close}>
            Fechar sem salvar
          </Button>
          <Button onClick={() => void saveAndClose()}>Salvar e fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Passo 5: Atalhos de teclado (`use-editor-shortcuts.ts`)**

```ts
import { useEffect } from 'react'
import * as cmd from '@/application/editing/commands'
import { locateFeature } from '@/domain/feature-model/tree'
import { useProjectStoreApi } from '@/ui/stores/project-store-context'
import type { EditorDialog } from './editor-dialog'

type Shortcut =
  | 'save'
  | 'undo'
  | 'redo'
  | 'add-child'
  | 'add-sibling'
  | 'rename'
  | 'delete'
  | 'move-up'
  | 'move-down'

/**
 * Atalhos da SPEC §7: Tab filha, Enter irmã, F2 renomear, Delete excluir, Alt+↑/↓ reordenar,
 * Ctrl+Z/Ctrl+Y desfazer/refazer, Ctrl+S salvar. Enquanto se digita num campo, só Ctrl+S vale.
 * Com um diálogo aberto (`enabled` falso), nenhum atalho vale: as teclas são do diálogo.
 */
export function useEditorShortcuts(
  openDialog: (dialog: EditorDialog) => void,
  enabled: boolean
): void {
  const store = useProjectStoreApi()

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent): void => {
      const state = store.getState()
      const shortcut = shortcutFor(event)
      if (shortcut === undefined || state.session === null || state.conflicts.length > 0) return
      if (shortcut !== 'save' && isTyping(event.target)) return

      if (shortcut === 'save' || shortcut === 'undo' || shortcut === 'redo') {
        event.preventDefault()
        if (shortcut === 'save') void state.save()
        else if (shortcut === 'undo') state.undo()
        else state.redo()
        return
      }

      // Os demais atalhos agem sobre a feature selecionada; a raiz não tem irmãs nem sai do lugar.
      const id = state.selectedFeatureId
      if (id === null) return
      const isRoot = locateFeature(state.session.project.model.root, id)?.kind === 'root'
      if (isRoot && shortcut !== 'add-child' && shortcut !== 'rename') return

      event.preventDefault()
      switch (shortcut) {
        case 'add-child':
          openDialog({ kind: 'new-feature', placement: 'child', featureId: id })
          break
        case 'add-sibling':
          openDialog({ kind: 'new-feature', placement: 'sibling', featureId: id })
          break
        case 'rename':
          document.getElementById('feature-name')?.focus()
          break
        case 'delete':
          openDialog({ kind: 'delete-feature', featureId: id })
          break
        case 'move-up':
          state.run(cmd.reorderFeature(id, -1))
          break
        case 'move-down':
          state.run(cmd.reorderFeature(id, 1))
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [store, openDialog, enabled])
}

function shortcutFor(event: KeyboardEvent): Shortcut | undefined {
  const withModifier = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  if (withModifier && key === 's') return 'save'
  if (withModifier && key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (withModifier && key === 'y') return 'redo'
  if (withModifier) return undefined
  if (event.altKey && event.key === 'ArrowUp') return 'move-up'
  if (event.altKey && event.key === 'ArrowDown') return 'move-down'
  if (event.key === 'Tab') return 'add-child'
  if (event.key === 'Enter') return 'add-sibling'
  if (event.key === 'F2') return 'rename'
  if (event.key === 'Delete') return 'delete'
  return undefined
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
```

- [ ] **Passo 6: Substituir `src/renderer/src/ui/screens/project/ProjectScreen.tsx`**

```tsx
import { useCallback, useState } from 'react'
import { X } from 'lucide-react'
import type { ProjectSession } from '@/application/project-session'
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
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
import { FeatureTree } from './FeatureTree'
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
        <section className="min-h-0 space-y-4 overflow-auto p-4">
          <ProblemList title="Não foi possível salvar" tone="error" problems={problems} />
          <ProblemList title="Avisos" tone="warning" problems={warnings} />
          <div>
            <FeatureToolbar model={project.model} onOpenDialog={openDialog} />
            <FeatureTree root={project.model.root} />
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

- [ ] **Passo 7: Tipos, lint e build**

```bash
npm run format && npm run typecheck && npm run lint && npx electron-vite build
```

Esperado: sem erros; três `✓ built in ...`.

- [ ] **Passo 8: Percorrer a interface com o roteiro de verificação**

O roteiro abre o projeto pela lista de recentes (sem o diálogo nativo) e usa cliques e teclas de verdade. O app roda com uma pasta de dados própria (`--user-data-dir`), para não mexer nos recentes reais.

Crie `.checks/ui-check.mjs`:

```js
// Roteiro da interface do editor, dirigido pelo protocolo de depuração do Chromium.
// Uso: node .checks/ui-check.mjs <porta> <pasta-do-projeto>
// O app precisa estar aberto na tela inicial, com a pasta na lista de recentes.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [port, projectDir] = process.argv.slice(2)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve))
let nextId = 1
const js = (expression) =>
  new Promise((resolve) => {
    const id = nextId++
    ws.addEventListener('message', function onMessage(event) {
      const message = JSON.parse(event.data)
      if (message.id !== id) return
      ws.removeEventListener('message', onMessage)
      const result = message.result
      resolve(
        result.exceptionDetails
          ? `EXCEÇÃO: ${result.exceptionDetails.exception?.description}`
          : result.result.value
      )
    })
    ws.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true }
      })
    )
  })

// Ações na página
const click = async (selectorOrText) => {
  await js(`(() => {
    const byText = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === ${JSON.stringify(selectorOrText)})
    const target = byText ?? document.querySelector(${JSON.stringify(selectorOrText)})
    if (!target) throw new Error('não achei ' + ${JSON.stringify(selectorOrText)})
    target.click()
  })()`)
  await sleep(250)
}
const key = async (keyName, modifiers = {}) => {
  await js(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(keyName)}, bubbles: true, ctrlKey: ${!!modifiers.ctrl}, altKey: ${!!modifiers.alt}, shiftKey: ${!!modifiers.shift} }))`
  )
  await sleep(250)
}
const type = async (selector, value) => {
  await js(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)})
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
    input.focus()
    setter.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await sleep(250)
  await js(`document.querySelector(${JSON.stringify(selector)}).blur()`)
  await sleep(250)
}
const text = (selector) =>
  js(
    `document.querySelector(${JSON.stringify(selector)})?.innerText.replace(/\\s+/g, ' ').trim() ?? '(nada)'`
  )
const tree = () =>
  js(
    `[...document.querySelectorAll('[data-feature-id]')].map((b) => b.dataset.featureId).join(' ')`
  )
const selected = () =>
  js(`document.querySelector('[aria-selected=true] > button')?.dataset.featureId`)
const title = () => js('document.title')
const log = (label, value) => console.log(label.padEnd(34), '→', value)

// 1. Abrir pelo recente
await click(`button:has(span)`)
for (let i = 0; i < 40 && (await tree()) === ''; i++) await sleep(250)
log('título ao abrir', await title())
log('árvore', await tree())

// 2. Tab abre "Nova filha": o ID acompanha o nome até ser editado
await click('[data-feature-id="busca"]')
await key('Tab')
log('Tab abre o diálogo', await text('[role=dialog] h2'))
await type('#new-feature-name', 'Relatório')
log('ID sugerido', await js(`document.querySelector('#new-feature-id').value`))
await type('#new-feature-id', 'busca')
log('ID repetido', await text('[role=dialog] .text-destructive'))
await type('#new-feature-id', 'busca_relatorio')
await click('Criar')
log('filha criada e selecionada', `${await selected()} | título: ${await title()}`)

// 3. Renomear pelo painel (o ID não muda)
await type('#feature-name', 'Relatório mensal')
log('renomear', await text('[data-feature-id="busca_relatorio"]'))

// 4. Desfazer duas vezes volta ao disco
await key('z', { ctrl: true })
log('Ctrl+Z desfaz o nome', await text('[data-feature-id="busca_relatorio"]'))
await key('z', { ctrl: true })
log(
  'Ctrl+Z remove a feature',
  `${(await tree()).includes('busca_relatorio') ? 'ainda existe' : 'removida'} | título: ${await title()}`
)

// 5. Excluir pag_pix com o diálogo de impacto
await click('[data-feature-id="pag_pix"]')
await key('Delete')
log('diálogo de impacto', await text('[role=dialog]'))
await click('Excluir')
log('depois de excluir', `${await tree()} | ${await text('aside section:last-of-type h2')}`)
await key('z', { ctrl: true })
log(
  'Ctrl+Z restaura',
  `${(await tree()).includes('pag_pix')} | ${await text('aside section:last-of-type h2')}`
)

// 6. Reordenar e edição recusada
await click('[data-feature-id="busca"]')
await key('ArrowUp', { alt: true })
log('Alt+↑ em busca', await tree())
await click('[data-feature-id="pag_pix"]')
await type('input[aria-label="Mínimo"]', '4')
await click('Aplicar')
log('grupo [4..*] recusado', await text('main > div.border-b'))

// 7. Salvar e conflito
await key('s', { ctrl: true })
await sleep(800)
log(
  'Ctrl+S',
  `${await title()} | busca antes de catalogo no disco: ${readFileSync(join(projectDir, 'model.xml'), 'utf8').indexOf('id="busca"') < readFileSync(join(projectDir, 'model.xml'), 'utf8').indexOf('id="catalogo"')}`
)
writeFileSync(
  join(projectDir, 'model.xml'),
  readFileSync(join(projectDir, 'model.xml'), 'utf8') + '\n'
)
await click('[data-feature-id="busca"]')
await key('ArrowDown', { alt: true })
await key('s', { ctrl: true })
await sleep(800)
log('conflito ao salvar', await text('[role=dialog]'))
await click('Recarregar (descarta minhas alterações)')
await sleep(1500)
log('recarregar', `${await tree()} | título: ${await title()}`)

// 8. Fechar com alteração pendente pede confirmação
await click('[data-feature-id="busca"]')
await key('ArrowDown', { alt: true })
await click('Fechar')
log('fechar com alteração', await text('[role=dialog]'))
await click('Fechar sem salvar')
log('tela inicial', await text('main h1'))

ws.close()
```

Prepare uma cópia do exemplo e os recentes, e abra o app compilado:

```bash
rm -rf .checks/ui-data .checks/loja-ui && mkdir -p .checks/ui-data
cp -r docs/examples/loja-online .checks/loja-ui
node -e "require('fs').writeFileSync('.checks/ui-data/recent-projects.json', JSON.stringify([{ rootPath: process.argv[1], name: 'loja-ui' }]))" "$(cygpath -w "$PWD/.checks/loja-ui")"
./node_modules/electron/dist/electron.exe . --user-data-dir="$(cygpath -w "$PWD/.checks/ui-data")" --remote-debugging-port=9333 &
```

Espere a janela aparecer e rode:

```bash
node .checks/ui-check.mjs 9333 "$(cygpath -w "$PWD/.checks/loja-ui")"
```

Esperado, exatamente:

```
título ao abrir                    → Loja Online — mdd
árvore                             → loja catalogo busca mobile pagamento pag_cartao pag_pix pag_boleto
Tab abre o diálogo                 → Nova filha de “Busca”
ID sugerido                        → relatorio
ID repetido                        → O ID "busca" já existe no modelo.
filha criada e selecionada         → busca_relatorio | título: • Loja Online — mdd
renomear                           → ○ Relatório mensal busca_relatorio
Ctrl+Z desfaz o nome               → ○ Relatório busca_relatorio
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

- [ ] **Passo 9: Commit**

```bash
git add -A
git commit -m "feat(ui): editor com painéis, diálogos, atalhos, projeto novo e recentes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 8: Documentação e aceitação da fase

**Arquivos:**

- Modificar: `docs/SPEC.md` (§4.1, §4.5, §6.3, §7, §9), `docs/adr/0004-ids-estaveis-para-features.md`, `docs/adr/0008-camadas-com-lint-sem-testes.md`

**Interfaces:**

- Consome: tudo das Tarefas 1–7.
- Produz: a spec e os ADRs descrevendo o que foi construído.

- [ ] **Passo 0: IDs escolhidos na criação (SPEC §4.1 e ADR 0004)**

Na SPEC, troque o parágrafo que começa com `**IDs.**` por:

```markdown
**IDs.** São sugeridos a partir do nome (minúsculas, sem acento, espaços viram `_`, sufixo `_2`, `_3`… em caso de colisão) e podem ser ajustados **no momento da criação**, nos diálogos "Nova filha", "Nova irmã" e "Novo projeto". Depois de criados, são **imutáveis** na primeira versão (ADR 0004).
```

No ADR 0004, troque a frase `Cada feature tem um ID gerado na criação a partir do nome, no formato `[a-z][a-z0-9_]*`, imutável na primeira versão; o nome de exibição é livre.` por:

```markdown
Cada feature tem um ID no formato `[a-z][a-z0-9_]*`, definido na criação (sugerido a partir do nome e ajustável naquele momento) e imutável depois, na primeira versão; o nome de exibição é livre.
```

- [ ] **Passo 1: Atualizar a SPEC §4.5 (comandos e histórico)**

Troque o parágrafo que começa com `Toda edição do modelo ou dos assets é um **Command**` por:

```markdown
Toda edição do modelo ou dos assets é um **Command** (um objeto com `label` e `run()`) executado pelo histórico de desfazer/refazer (ADR 0008). O comando não sabe se desfazer: como o estado é imutável, o histórico guarda o estado anterior de cada comando, e desfazer é voltar a ele. Depois de cada comando, o histórico confere as regras M1–M5 e A1–A3 e recusa o que as quebraria, mostrando o motivo. O histórico é zerado ao abrir outro projeto.
```

Na lista "Comandos da primeira versão", acrescente antes da linha `- **Feature:** …`:

```markdown
- **Modelo:** renomear.
```

- [ ] **Passo 2: Atualizar os canais (SPEC §6.3)**

Troque a linha ` - **Projetos recentes:** os 10 últimos, gravados em`userData`` por:

```markdown
- **Projetos recentes:** `listRecentProjects` e `reopenProject` (os 10 últimos, gravados em `userData`; só pastas da lista podem ser reabertas sem o diálogo)
- **Janela:** `setUnsavedChanges` (o main pergunta antes de fechar a janela com alterações não salvas)
```

- [ ] **Passo 3: Atualizar a tela inicial (SPEC §7)**

Troque a linha que começa com `**Tela inicial:**` por:

```markdown
**Tela inicial:** novo projeto (nome e ID da raiz, depois uma pasta sem `model.xml`; cria o `model.xml` só com a raiz), abrir projeto e lista de recentes.
```

- [ ] **Passo 4: Dividir a Fase 2 no roadmap (SPEC §9)**

Troque a linha da tabela que começa com `| **2. Editor visual**` por estas duas:

```markdown
| **2A. Edição do modelo** | Operações de edição no domínio, comandos com desfazer/refazer, árvore em lista selecionável, painéis de propriedades e de restrições, diálogos de impacto, de grupo, de conflito e de fechar, atalhos, projeto novo e recentes | Recriar o modelo do exemplo do zero pela interface (escolhendo os IDs na criação) e salvar produz um arquivo igual ao exemplo. Excluir `pag_pix` mostra: 1 restrição removida, 2 assets desvinculados, 1 configuração afetada. Desfazer restaura tudo. |
| **2B. Diagrama** | Diagrama com React Flow e layout automático no lugar da lista, menu de contexto, arrastar e soltar para mover, subárvores recolhíveis | A aceitação da 2A, feita pelo diagrama. |
```

- [ ] **Passo 5: Atualizar o ADR 0008**

Troque a última linha (`- Toda edição do modelo é um Command com …`) por:

```markdown
- Toda edição do modelo é um Command (objeto com `label` e `run()`) executado por um histórico imutável. Os comandos não implementam `undo()`: o histórico guarda o estado anterior de cada comando, e desfazer é voltar a ele. Isso evita escrever a operação inversa de cada edição, que é uma fonte clássica de bugs, e custa pouco porque as versões do estado compartilham tudo o que não mudou. Depois de cada comando, o histórico confere as regras M1–M5 e A1–A3 e recusa o que as quebraria.
```

- [ ] **Passo 6: Formatar e commitar**

```bash
npm run format
git add -A
git commit -m "docs: spec e ADR 0008 refletem os comandos, o histórico e a divisão da Fase 2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Passo 7: Gerar o instalador**

```bash
npm run build:win
```

Esperado: `building target=nsis file=dist\mdd-0.1.0-setup.exe` sem erro.

- [ ] **Passo 8: Aceitação manual (pede o diálogo nativo e o fechamento da janela)**

No `dist/win-unpacked/mdd.exe`:

1. **Projeto novo:** "Novo projeto", Nome `Loja Online`, troque o ID sugerido (`loja_online`) por `loja`, e escolha uma pasta vazia. Abre o editor com a raiz selecionada.
2. **Recriar o exemplo:**
   - Na raiz, preencha a descrição `Raiz da linha de produtos de lojas virtuais.` e adicione o atributo `Versão` (string, padrão `1.0`, valor fixo).
   - Com a raiz selecionada, crie as filhas com Tab (o ID sugerido já está certo): `Catálogo` (depois marque "Obrigatória"), `Busca` (atributo `Máx. resultados`: number, padrão `50`, faixa `10` a `500`), `App mobile` com ID `mobile`, e `Pagamento` (obrigatória).
   - Em Pagamento, crie `Cartão` com ID `pag_cartao`, `PIX` com ID `pag_pix` e `Boleto` com ID `pag_boleto`. Depois use "Agrupar filhas…" com as três e o tipo "Or".
   - No atributo `Plataforma` de App mobile: enum com as opções `android, ios, ambas`.
   - Adicione a restrição `pag_pix implies mobile` com a descrição `PIX exige app mobile`.
   - Ctrl+S. O `model.xml` da pasta deve ser **idêntico** a `docs/examples/loja-online/model.xml`. Confira com `cmp <pasta>/model.xml docs/examples/loja-online/model.xml` (sem saída = idêntico).
3. **Fechar a janela com alteração:** faça uma edição e feche a janela pelo X. Aparece "Há alterações não salvas no projeto." Escolha "Cancelar" e a janela continua aberta. Feche de novo e escolha "Sair sem salvar".
4. **Recentes:** abra o app de novo. A pasta do passo 1 aparece em "Recentes" e abre com um clique.

---

## Aceitação da Fase 2A (SPEC §9)

- [ ] Recriar o modelo do exemplo do zero e salvar produz um arquivo igual (Tarefa 4, Passo 6; Tarefa 8, Passo 8).
- [ ] Excluir `pag_pix` mostra 1 restrição, 2 assets e 1 configuração, e desfazer restaura tudo (Tarefa 4, Passo 6; Tarefa 7, Passo 8).
- [ ] Projeto novo, recentes, indicador de não salvo, Ctrl+S, conflito e confirmação ao fechar funcionam (Tarefa 5, Passo 5; Tarefa 7, Passo 8; Tarefa 8, Passo 8).
