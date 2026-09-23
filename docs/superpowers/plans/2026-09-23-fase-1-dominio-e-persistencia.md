# Fase 1 — Domínio e persistência: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** abrir uma pasta de projeto, ler e validar `model.xml`, `assets.xml` e `configurations/*.xml` em três etapas, mostrar o modelo numa lista provisória e salvar tudo de volta idêntico byte a byte.

**Arquitetura:** o domínio (TypeScript puro, valores imutáveis e funções) define Feature Model, expressões, configurações e assets, com as regras M1–M5 e A1–A3. A aplicação define os ports (`ProjectStorage`, `ProjectFolderPicker`, `XmlSchemaValidator`, repositórios) e os casos de uso `OpenProject` e `SaveProject`. A infraestrutura implementa os repositórios com codecs XML (`@xmldom/xmldom` para ler, um escritor determinístico para gravar) e adapters sobre `window.mdd`. A validação XSD (etapas 1 e 2) roda no processo main com `xmllint-wasm`. A interface usa uma store Zustand criada na composition root.

**Stack:** a da Fase 0, mais `@xmldom/xmldom` 0.9, `xmllint-wasm` 5, `zustand` 5 e, só para verificação, `tsx` 4.

**Spec:** [docs/SPEC.md](../../SPEC.md) §3, §4.1–4.3, §5, §6 e a linha da Fase 1 em §9. ADRs relevantes: [0003](../../adr/0003-xml-com-schema-proprio.md), [0004](../../adr/0004-ids-estaveis-para-features.md), [0005](../../adr/0005-configuracao-guarda-so-decisoes-manuais.md), [0008](../../adr/0008-camadas-com-lint-sem-testes.md).

## Restrições globais

- **Sem testes automatizados** (ADR 0008). Cada tarefa verifica com `npm run typecheck`, `npm run lint` e um **script de verificação descartável** em `.checks/`, executado com `npx tsx`. A pasta `.checks/` é ignorada pelo git, pelo ESLint e pelo Prettier: nada dela é commitado.
- Camadas (SPEC §6.1): o `domain/` não importa nada de fora dele, nem bibliotecas; `application/` importa só `domain/`; `infrastructure/` implementa os ports; só `ui/app/` conhece a infraestrutura. O lint barra violações.
- Dentro de `domain/`, os imports são **relativos** (`../shared/result`). Nas demais camadas, use o alias `@/`.
- Identificadores em inglês; mensagens ao usuário, comentários e documentação em português.
- O domínio é imutável: tipos com `readonly`, sem classes com estado. Casos de uso e adapters são classes que recebem dependências no construtor.
- Rode `npm run format` antes de cada commit. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Todo comando roda na raiz do repositório com **Git Bash**.

**Fora desta fase** (ficam para a Fase 2, quando existir edição): criar projeto novo, lista de projetos recentes, diálogo "sobrescrever / recarregar / cancelar" (nesta fase, um arquivo alterado por fora só gera a mensagem de erro) e confirmação ao fechar com alterações.

## Mapa de arquivos

| Arquivo                                                                                 | Responsabilidade                                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/renderer/src/domain/shared/result.ts`                                              | `Result<T, E>`, `ok()`, `err()`                                                |
| `src/renderer/src/domain/shared/validation-issue.ts`                                    | `ValidationIssue` (erro ou aviso de regra do domínio)                          |
| `src/renderer/src/domain/expression/*.ts`                                               | AST, IDs e palavras reservadas, tokenizer, parser, forma canônica, referências |
| `src/renderer/src/domain/feature-model/feature-model.ts`                                | Tipos do Feature Model                                                         |
| `src/renderer/src/domain/feature-model/traversal.ts`                                    | Filhos e pré-ordem                                                             |
| `src/renderer/src/domain/feature-model/attribute-value.ts`                              | Valor de atributo válido para o tipo                                           |
| `src/renderer/src/domain/feature-model/validation.ts`                                   | Regras M1–M5                                                                   |
| `src/renderer/src/domain/configuration/configuration.ts`                                | Tipos da configuração                                                          |
| `src/renderer/src/domain/assets/asset-catalog.ts`, `validation.ts`                      | Tipos dos assets e regras A1–A3                                                |
| `src/renderer/src/domain/project/project.ts`                                            | Projeto = modelo + assets + configurações                                      |
| `src/renderer/src/application/file-problem.ts`                                          | `FileProblem`: arquivo, linha, elemento e mensagem                             |
| `src/renderer/src/application/ports/*.ts`                                               | `ProjectStorage`, `ProjectFolderPicker`, `XmlSchemaValidator`, repositórios    |
| `src/renderer/src/application/project-session.ts`                                       | Projeto aberto + hashes dos arquivos                                           |
| `src/renderer/src/application/use-cases/open-project.ts`, `save-project.ts`             | Casos de uso                                                                   |
| `src/renderer/src/infrastructure/xml/*.ts`                                              | Escritor, leitor, codecs, arquivo XML genérico, repositórios                   |
| `src/renderer/src/infrastructure/electron/*.ts`                                         | Adapters sobre `window.mdd`                                                    |
| `src/shared/ipc.ts`                                                                     | + canal `validateXml`                                                          |
| `src/main/xml/schema-validator.ts`, `src/main/ipc/xml-handlers.ts`, `src/main/env.d.ts` | Validação XSD no main                                                          |
| `src/renderer/src/ui/stores/*.ts`                                                       | Store Zustand e contexto                                                       |
| `src/renderer/src/ui/components/ProblemList.tsx`                                        | Lista de problemas                                                             |
| `src/renderer/src/ui/screens/start/StartScreen.tsx`                                     | Tela inicial                                                                   |
| `src/renderer/src/ui/screens/project/*.tsx`                                             | Tela do projeto e árvore provisória                                            |
| `src/renderer/src/ui/app/composition-root.ts`, `App.tsx`                                | Composition root e troca de telas                                              |

---

### Tarefa 1: Resultado e linguagem de expressões

**Arquivos:**

- Criar: `src/renderer/src/domain/shared/result.ts` e, em `src/renderer/src/domain/expression/`, os arquivos `ast.ts`, `identifier.ts`, `syntax-error.ts`, `tokenizer.ts`, `parser.ts`, `printer.ts`, `references.ts`
- Modificar: `.gitignore`, `.prettierignore`, `eslint.config.mjs`, `package.json`
- Remover: `src/renderer/src/domain/.gitkeep`

**Interfaces:**

- Consome: nada.
- Produz:
  - `Result<T, E>`, `ok(value)`, `err(error)` em `domain/shared/result.ts`
  - `Expression` e `BinaryOperator` em `domain/expression/ast.ts`
  - `parseExpression(source: string): Result<Expression, ExpressionSyntaxError>`
  - `printExpression(expression: Expression): string` (forma canônica)
  - `referencedFeatureIds(expression: Expression): Set<string>`
  - `isValidFeatureId(value: string): boolean`, `matchesIdentifierFormat(value: string): boolean`, `RESERVED_WORDS`
  - `ExpressionSyntaxError { message: string; column: number }`

- [ ] **Passo 1: Criar o branch da fase**

```bash
git switch -c fase-1-dominio
```

- [ ] **Passo 2: Preparar a pasta de verificação descartável**

```bash
npm install -D tsx
printf '.checks\n' >> .gitignore
printf '.checks\n' >> .prettierignore
```

Em `eslint.config.mjs`, troque a linha de `ignores`:

```js
  { ignores: ['**/node_modules', '**/dist', '**/out', '.checks'] },
```

- [ ] **Passo 3: Criar `src/renderer/src/domain/shared/result.ts`**

```ts
/** Resultado de uma operação que pode falhar, sem usar exceções. */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
```

- [ ] **Passo 4: Criar os arquivos da linguagem de expressões**

`src/renderer/src/domain/expression/ast.ts`:

```ts
export type BinaryOperator = 'and' | 'or' | 'implies' | 'iff'

/** Árvore de uma expressão proposicional sobre IDs de features (SPEC §4.1). */
export type Expression =
  | { readonly kind: 'var'; readonly id: string }
  | { readonly kind: 'const'; readonly value: boolean }
  | { readonly kind: 'not'; readonly operand: Expression }
  | {
      readonly kind: 'binary'
      readonly operator: BinaryOperator
      readonly left: Expression
      readonly right: Expression
    }
```

`src/renderer/src/domain/expression/identifier.ts`:

```ts
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/

/** Palavras da linguagem de expressões; não podem ser usadas como ID de feature (ADR 0004). */
export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  'not',
  'and',
  'or',
  'implies',
  'iff',
  'true',
  'false'
])

/** Segue o formato `[a-z][a-z0-9_]*`, sem checar palavras reservadas. */
export function matchesIdentifierFormat(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value)
}

/** ID que pode aparecer numa expressão: formato válido e não reservado. */
export function isValidFeatureId(value: string): boolean {
  return matchesIdentifierFormat(value) && !RESERVED_WORDS.has(value)
}
```

`src/renderer/src/domain/expression/syntax-error.ts`:

```ts
export interface ExpressionSyntaxError {
  readonly message: string
  /** Coluna (a partir de 1) onde o problema foi encontrado. */
  readonly column: number
}
```

`src/renderer/src/domain/expression/tokenizer.ts`:

```ts
import { err, ok, type Result } from '../shared/result'
import type { ExpressionSyntaxError } from './syntax-error'
import { matchesIdentifierFormat, RESERVED_WORDS } from './identifier'

export type TokenKind =
  'identifier' | 'not' | 'and' | 'or' | 'implies' | 'iff' | 'true' | 'false' | '(' | ')' | 'end'

export interface Token {
  readonly kind: TokenKind
  readonly text: string
  /** Coluna (a partir de 1) do primeiro caractere do token. */
  readonly column: number
}

const WORD_CHARACTER = /[A-Za-z0-9_]/
const WHITESPACE = /\s/

export function tokenize(source: string): Result<Token[], ExpressionSyntaxError> {
  const tokens: Token[] = []
  let index = 0

  while (index < source.length) {
    const character = source[index]
    const column = index + 1

    if (WHITESPACE.test(character)) {
      index++
    } else if (character === '(' || character === ')') {
      tokens.push({ kind: character, text: character, column })
      index++
    } else if (WORD_CHARACTER.test(character)) {
      let end = index
      while (end < source.length && WORD_CHARACTER.test(source[end])) end++
      const word = source.slice(index, end)
      if (RESERVED_WORDS.has(word)) {
        tokens.push({ kind: word as TokenKind, text: word, column })
      } else if (matchesIdentifierFormat(word)) {
        tokens.push({ kind: 'identifier', text: word, column })
      } else {
        return err({
          message: `"${word}" não é um ID válido: use letras minúsculas, dígitos e _, começando por letra.`,
          column
        })
      }
      index = end
    } else {
      return err({ message: `Caractere inesperado "${character}".`, column })
    }
  }

  tokens.push({ kind: 'end', text: '', column: source.length + 1 })
  return ok(tokens)
}
```

`src/renderer/src/domain/expression/parser.ts`:

```ts
import { err, ok, type Result } from '../shared/result'
import type { BinaryOperator, Expression } from './ast'
import type { ExpressionSyntaxError } from './syntax-error'
import { tokenize, type Token, type TokenKind } from './tokenizer'

/**
 * Converte o texto de uma expressão em árvore (gramática em docs/SPEC.md §4.1).
 * Precedência, da mais forte para a mais fraca: not, and, or, implies, iff.
 * `implies` associa à direita; os demais operadores binários, à esquerda.
 */
export function parseExpression(source: string): Result<Expression, ExpressionSyntaxError> {
  const tokens = tokenize(source)
  if (!tokens.ok) return tokens
  if (tokens.value.length === 1) return err({ message: 'A expressão está vazia.', column: 1 })

  try {
    return ok(new ExpressionParser(tokens.value).parse())
  } catch (failure) {
    if (failure instanceof ParseFailure) return err(failure.syntaxError)
    throw failure
  }
}

class ParseFailure {
  readonly syntaxError: ExpressionSyntaxError

  constructor(syntaxError: ExpressionSyntaxError) {
    this.syntaxError = syntaxError
  }
}

class ExpressionParser {
  private readonly tokens: readonly Token[]
  private position = 0

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens
  }

  parse(): Expression {
    const expression = this.parseIff()
    const next = this.peek()
    if (next.kind !== 'end') this.fail(`Faltou um operador antes de "${next.text}".`, next)
    return expression
  }

  private parseIff(): Expression {
    let left = this.parseImplies()
    while (this.match('iff')) left = binary('iff', left, this.parseImplies())
    return left
  }

  private parseImplies(): Expression {
    const left = this.parseOr()
    return this.match('implies') ? binary('implies', left, this.parseImplies()) : left
  }

  private parseOr(): Expression {
    let left = this.parseAnd()
    while (this.match('or')) left = binary('or', left, this.parseAnd())
    return left
  }

  private parseAnd(): Expression {
    let left = this.parseUnary()
    while (this.match('and')) left = binary('and', left, this.parseUnary())
    return left
  }

  private parseUnary(): Expression {
    if (this.match('not')) return { kind: 'not', operand: this.parseUnary() }
    return this.parsePrimary()
  }

  private parsePrimary(): Expression {
    const token = this.peek()
    switch (token.kind) {
      case 'identifier':
        this.position++
        return { kind: 'var', id: token.text }
      case 'true':
      case 'false':
        this.position++
        return { kind: 'const', value: token.kind === 'true' }
      case '(': {
        this.position++
        const inner = this.parseIff()
        if (!this.match(')')) this.fail('Falta fechar o parêntese.', this.peek())
        return inner
      }
      case 'end':
        return this.fail('A expressão terminou antes da hora: falta um operando.', token)
      default:
        return this.fail(
          `Esperava uma feature, "not" ou "(", mas encontrou "${token.text}".`,
          token
        )
    }
  }

  private peek(): Token {
    return this.tokens[this.position]
  }

  private match(kind: TokenKind): boolean {
    if (this.peek().kind !== kind) return false
    this.position++
    return true
  }

  private fail(message: string, token: Token): never {
    throw new ParseFailure({ message, column: token.column })
  }
}

function binary(operator: BinaryOperator, left: Expression, right: Expression): Expression {
  return { kind: 'binary', operator, left, right }
}
```

`src/renderer/src/domain/expression/printer.ts`:

```ts
import type { BinaryOperator, Expression } from './ast'

const BINARY_PRECEDENCE: Record<BinaryOperator, number> = { iff: 1, implies: 2, or: 3, and: 4 }
const NOT_PRECEDENCE = 5
const ATOM_PRECEDENCE = 6

/**
 * Forma canônica da expressão: espaços simples e parênteses só onde necessário.
 * Garante que `parseExpression(printExpression(e))` devolve a mesma árvore.
 */
export function printExpression(expression: Expression): string {
  switch (expression.kind) {
    case 'var':
      return expression.id
    case 'const':
      return String(expression.value)
    case 'not':
      return `not ${printOperand(expression.operand, precedenceOf(expression.operand) < NOT_PRECEDENCE)}`
    case 'binary': {
      const precedence = BINARY_PRECEDENCE[expression.operator]
      const rightAssociative = expression.operator === 'implies'
      const leftPrecedence = precedenceOf(expression.left)
      const rightPrecedence = precedenceOf(expression.right)
      const left = printOperand(
        expression.left,
        leftPrecedence < precedence || (rightAssociative && leftPrecedence === precedence)
      )
      const right = printOperand(
        expression.right,
        rightPrecedence < precedence || (!rightAssociative && rightPrecedence === precedence)
      )
      return `${left} ${expression.operator} ${right}`
    }
  }
}

function printOperand(expression: Expression, parenthesize: boolean): string {
  const text = printExpression(expression)
  return parenthesize ? `(${text})` : text
}

function precedenceOf(expression: Expression): number {
  switch (expression.kind) {
    case 'binary':
      return BINARY_PRECEDENCE[expression.operator]
    case 'not':
      return NOT_PRECEDENCE
    default:
      return ATOM_PRECEDENCE
  }
}
```

`src/renderer/src/domain/expression/references.ts`:

```ts
import type { Expression } from './ast'

/** IDs de features citados na expressão. */
export function referencedFeatureIds(expression: Expression): Set<string> {
  const ids = new Set<string>()
  collect(expression, ids)
  return ids
}

function collect(expression: Expression, ids: Set<string>): void {
  switch (expression.kind) {
    case 'var':
      ids.add(expression.id)
      return
    case 'const':
      return
    case 'not':
      collect(expression.operand, ids)
      return
    case 'binary':
      collect(expression.left, ids)
      collect(expression.right, ids)
      return
  }
}
```

```bash
rm src/renderer/src/domain/.gitkeep
```

- [ ] **Passo 5: Verificar com expressões fixas e 2000 aleatórias**

Crie `.checks/expr-check.ts`:

```ts
import { parseExpression } from '../src/renderer/src/domain/expression/parser'
import { printExpression } from '../src/renderer/src/domain/expression/printer'
import type { Expression } from '../src/renderer/src/domain/expression/ast'

const show = (s: string): void => {
  const r = parseExpression(s)
  console.log(
    JSON.stringify(s).padEnd(28),
    '->',
    r.ok ? printExpression(r.value) : `ERRO col ${r.error.column}: ${r.error.message}`
  )
}
for (const s of [
  'pag_pix implies mobile',
  '  a   and b or c',
  'a and (b or c)',
  'a implies b implies c',
  '(a implies b) implies c',
  'a iff b iff c',
  'a iff (b iff c)',
  'not not a',
  'not (a and b)',
  'a or b and c',
  '(a or b) and c',
  'true or false',
  '',
  'a and',
  'a b',
  '(a and b',
  'Pag',
  'a & b',
  'not',
  'a and or b',
  'and'
])
  show(s)

const ids = ['a', 'b', 'c', 'd']
let seed = 42
const rnd = (n: number): number => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed % n
}
const gen = (depth: number): Expression => {
  const k = depth === 0 ? rnd(2) : rnd(4)
  if (k === 0) return { kind: 'var', id: ids[rnd(4)] }
  if (k === 1)
    return rnd(5) === 0 ? { kind: 'const', value: rnd(2) === 0 } : { kind: 'var', id: ids[rnd(4)] }
  if (k === 2) return { kind: 'not', operand: gen(depth - 1) }
  const ops = ['and', 'or', 'implies', 'iff'] as const
  return { kind: 'binary', operator: ops[rnd(4)], left: gen(depth - 1), right: gen(depth - 1) }
}
let failures = 0
for (let i = 0; i < 2000; i++) {
  const e = gen(5)
  const text = printExpression(e)
  const back = parseExpression(text)
  if (!back.ok || JSON.stringify(back.value) !== JSON.stringify(e)) {
    failures++
    if (failures < 4) console.log('FALHA', text)
  }
}
console.log('ida e volta aleatória: falhas =', failures, 'de 2000')
```

```bash
npx tsx .checks/expr-check.ts
```

Esperado, exatamente:

```
"pag_pix implies mobile"     -> pag_pix implies mobile
"  a   and b or c"           -> a and b or c
"a and (b or c)"             -> a and (b or c)
"a implies b implies c"      -> a implies b implies c
"(a implies b) implies c"    -> (a implies b) implies c
"a iff b iff c"              -> a iff b iff c
"a iff (b iff c)"            -> a iff (b iff c)
"not not a"                  -> not not a
"not (a and b)"              -> not (a and b)
"a or b and c"               -> a or b and c
"(a or b) and c"             -> (a or b) and c
"true or false"              -> true or false
""                           -> ERRO col 1: A expressão está vazia.
"a and"                      -> ERRO col 6: A expressão terminou antes da hora: falta um operando.
"a b"                        -> ERRO col 3: Faltou um operador antes de "b".
"(a and b"                   -> ERRO col 9: Falta fechar o parêntese.
"Pag"                        -> ERRO col 1: "Pag" não é um ID válido: use letras minúsculas, dígitos e _, começando por letra.
"a & b"                      -> ERRO col 3: Caractere inesperado "&".
"not"                        -> ERRO col 4: A expressão terminou antes da hora: falta um operando.
"a and or b"                 -> ERRO col 7: Esperava uma feature, "not" ou "(", mas encontrou "or".
"and"                        -> ERRO col 1: Esperava uma feature, "not" ou "(", mas encontrou "and".
ida e volta aleatória: falhas = 0 de 2000
```

- [ ] **Passo 6: Tipos e lint**

```bash
npm run format && npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 7: Commit**

```bash
git add -A
git commit -m "feat(domain): linguagem de expressões com forma canônica

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: Feature Model e regras M1–M5

**Arquivos:**

- Criar: `src/renderer/src/domain/shared/validation-issue.ts` e, em `src/renderer/src/domain/feature-model/`, os arquivos `feature-model.ts`, `traversal.ts`, `attribute-value.ts`, `validation.ts`

**Interfaces:**

- Consome: `Expression`, `referencedFeatureIds`, `isValidFeatureId` (Tarefa 1).
- Produz:
  - `ValidationIssue { severity: 'error' | 'warning'; subject?: string; message: string }`, `error()`, `warning()`, `hasErrors()`
  - Tipos `FeatureModel`, `Feature`, `FeatureChild`, `Group`, `GroupMax`, `Attribute`, `AttributeType`, `Variability`, `Constraint`
  - `childFeatures(feature: Feature): Feature[]`, `featuresInPreOrder(root: Feature): Feature[]`
  - `checkAttributeValue(attribute: Attribute, value: string): string | null`
  - `validateFeatureModel(model: FeatureModel): ValidationIssue[]`

- [ ] **Passo 1: Criar `src/renderer/src/domain/shared/validation-issue.ts`**

```ts
export type IssueSeverity = 'error' | 'warning'

/** Violação de uma regra do domínio (SPEC §4). Erros bloqueiam; avisos só informam. */
export interface ValidationIssue {
  readonly severity: IssueSeverity
  /** ID do elemento envolvido (feature, restrição, atributo, asset), quando houver. */
  readonly subject?: string
  readonly message: string
}

export function error(message: string, subject?: string): ValidationIssue {
  return { severity: 'error', subject, message }
}

export function warning(message: string, subject?: string): ValidationIssue {
  return { severity: 'warning', subject, message }
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error')
}
```

- [ ] **Passo 2: Criar os tipos em `src/renderer/src/domain/feature-model/feature-model.ts`**

```ts
import type { Expression } from '../expression/ast'

/*
 * O Feature Model é um valor imutável: toda edição (Fase 2) cria um modelo novo.
 * Isso deixa desfazer/refazer simples e evita que a interface veja um modelo pela metade.
 */

export type Variability = 'mandatory' | 'optional'

export type AttributeType = 'string' | 'number' | 'boolean' | 'enum'

export interface Attribute {
  readonly id: string
  readonly name: string
  readonly type: AttributeType
  /** Valor em texto, como aparece no XML; validado conforme o tipo. */
  readonly defaultValue?: string
  readonly min?: number
  readonly max?: number
  /** `false` = valor fixo definido no modelo; `true` = cada configuração escolhe. */
  readonly configurable: boolean
  /** Valores permitidos de um atributo `enum`; vazio nos demais tipos. */
  readonly options: readonly string[]
}

export interface Feature {
  readonly id: string
  readonly name: string
  readonly description?: string
  /** Presente só em features solitárias; ausente na raiz e em membros de grupo. */
  readonly variability?: Variability
  readonly attributes: readonly Attribute[]
  readonly children: readonly FeatureChild[]
}

/** `'*'` = sem limite superior. */
export type GroupMax = number | '*'

export interface Group {
  readonly min: number
  readonly max: GroupMax
  readonly members: readonly Feature[]
}

export type FeatureChild =
  | { readonly kind: 'feature'; readonly feature: Feature }
  | { readonly kind: 'group'; readonly group: Group }

export interface Constraint {
  readonly id: string
  readonly description?: string
  readonly expression: Expression
}

export interface FeatureModel {
  readonly name: string
  readonly root: Feature
  readonly constraints: readonly Constraint[]
}
```

- [ ] **Passo 3: Criar `src/renderer/src/domain/feature-model/traversal.ts`**

```ts
import type { Feature } from './feature-model'

/** Filhos diretos da feature, na ordem do modelo (solitárias e membros de grupo). */
export function childFeatures(feature: Feature): Feature[] {
  return feature.children.flatMap((child) =>
    child.kind === 'feature' ? [child.feature] : child.group.members
  )
}

/** Todas as features em pré-ordem: cada pai antes dos filhos, irmãos na ordem do modelo. */
export function featuresInPreOrder(root: Feature): Feature[] {
  return [root, ...childFeatures(root).flatMap(featuresInPreOrder)]
}
```

- [ ] **Passo 4: Criar `src/renderer/src/domain/feature-model/attribute-value.ts`**

```ts
import type { Attribute } from './feature-model'

const DECIMAL = /^-?\d+(\.\d+)?$/

/**
 * Confere se um valor em texto serve para o atributo (SPEC §4.2).
 * Devolve `null` quando serve, ou a explicação do problema.
 */
export function checkAttributeValue(attribute: Attribute, value: string): string | null {
  switch (attribute.type) {
    case 'string':
      return null
    case 'boolean':
      return value === 'true' || value === 'false' ? null : 'use "true" ou "false"'
    case 'enum':
      return attribute.options.includes(value)
        ? null
        : `use um destes valores: ${attribute.options.join(', ')}`
    case 'number': {
      if (!DECIMAL.test(value)) return `"${value}" não é um número`
      const number = Number(value)
      if (attribute.min !== undefined && number < attribute.min) {
        return `o mínimo é ${attribute.min}`
      }
      if (attribute.max !== undefined && number > attribute.max) {
        return `o máximo é ${attribute.max}`
      }
      return null
    }
  }
}
```

- [ ] **Passo 5: Criar `src/renderer/src/domain/feature-model/validation.ts`**

```ts
import { isValidFeatureId } from '../expression/identifier'
import { referencedFeatureIds } from '../expression/references'
import { error, warning, type ValidationIssue } from '../shared/validation-issue'
import { checkAttributeValue } from './attribute-value'
import type { Attribute, Feature, FeatureModel, Group } from './feature-model'

type Position = 'root' | 'solitary' | 'member'

/** Confere as invariantes M1–M5 do Feature Model (SPEC §4.1). */
export function validateFeatureModel(model: FeatureModel): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const featureIds = new Set<string>()

  const visit = (feature: Feature, position: Position): void => {
    issues.push(...checkFeatureId(feature, featureIds))
    issues.push(...checkVariability(feature, position))
    issues.push(...checkAttributes(feature))
    for (const child of feature.children) {
      if (child.kind === 'feature') {
        visit(child.feature, 'solitary')
      } else {
        issues.push(...checkGroup(feature.id, child.group))
        child.group.members.forEach((member) => visit(member, 'member'))
      }
    }
  }
  visit(model.root, 'root')

  issues.push(...checkConstraints(model, featureIds))
  return issues
}

// M1
function checkFeatureId(feature: Feature, seen: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!isValidFeatureId(feature.id)) {
    issues.push(
      error(
        `ID "${feature.id}" inválido: use [a-z][a-z0-9_]* e evite palavras reservadas.`,
        feature.id
      )
    )
  }
  if (seen.has(feature.id)) issues.push(error(`ID "${feature.id}" repetido.`, feature.id))
  seen.add(feature.id)
  return issues
}

// M2
function checkVariability(feature: Feature, position: Position): ValidationIssue[] {
  if (position === 'root' && feature.variability !== undefined) {
    return [error('A feature raiz não pode ter variabilidade.', feature.id)]
  }
  if (position === 'solitary' && feature.variability === undefined) {
    return [error('Feature fora de grupo precisa ser obrigatória ou opcional.', feature.id)]
  }
  if (position === 'member' && feature.variability !== undefined) {
    return [error('Membro de grupo não tem variabilidade própria.', feature.id)]
  }
  return []
}

// M3
function checkGroup(parentId: string, group: Group): ValidationIssue[] {
  const subject = `${parentId} (grupo)`
  const count = group.members.length
  const issues: ValidationIssue[] = []
  if (count === 0) issues.push(error('Grupo sem membros.', subject))
  if (group.min < 0) issues.push(error('O mínimo do grupo não pode ser negativo.', subject))
  if (group.max !== '*' && group.max < Math.max(group.min, 1)) {
    issues.push(
      error(`O máximo do grupo deve ser * ou pelo menos ${Math.max(group.min, 1)}.`, subject)
    )
  }
  if (count > 0 && group.min > count) {
    issues.push(
      error(`O mínimo do grupo (${group.min}) passa do número de membros (${count}).`, subject)
    )
  }
  if (group.max !== '*' && count > 0 && group.max > count) {
    issues.push(
      warning(`O máximo do grupo (${group.max}) passa do número de membros e vale como *.`, subject)
    )
  }
  if (count === 1) issues.push(warning('Grupo com um único membro.', subject))
  return issues
}

// M4
function checkConstraints(model: FeatureModel, featureIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const constraintIds = new Set<string>()
  for (const constraint of model.constraints) {
    if (constraintIds.has(constraint.id)) {
      issues.push(error(`ID de restrição "${constraint.id}" repetido.`, constraint.id))
    }
    constraintIds.add(constraint.id)
    for (const id of referencedFeatureIds(constraint.expression)) {
      if (!featureIds.has(id)) {
        issues.push(error(`A restrição cita a feature "${id}", que não existe.`, constraint.id))
      }
    }
  }
  return issues
}

// M5
function checkAttributes(feature: Feature): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const attributeIds = new Set<string>()
  for (const attribute of feature.attributes) {
    const subject = `${feature.id}.${attribute.id}`
    if (attributeIds.has(attribute.id)) {
      issues.push(error(`Atributo "${attribute.id}" repetido na feature.`, subject))
    }
    attributeIds.add(attribute.id)
    issues.push(...checkAttribute(attribute).map((message) => error(message, subject)))
  }
  return issues
}

function checkAttribute(attribute: Attribute): string[] {
  const problems: string[] = []
  const hasRange = attribute.min !== undefined || attribute.max !== undefined
  if (attribute.type !== 'number' && hasRange) problems.push('min e max só valem para number.')
  if (attribute.min !== undefined && attribute.max !== undefined && attribute.min > attribute.max) {
    problems.push('min maior que max.')
  }
  if (attribute.type === 'enum') {
    if (attribute.options.length === 0) problems.push('enum precisa de ao menos uma option.')
    if (new Set(attribute.options).size !== attribute.options.length) {
      problems.push('enum com option repetida.')
    }
  } else if (attribute.options.length > 0) {
    problems.push('option só vale para enum.')
  }
  if (attribute.defaultValue !== undefined) {
    const problem = checkAttributeValue(attribute, attribute.defaultValue)
    if (problem !== null) problems.push(`default inválido: ${problem}.`)
  }
  if (!attribute.configurable && attribute.defaultValue === undefined) {
    problems.push('Atributo fixo precisa de default.')
  }
  return problems
}
```

- [ ] **Passo 6: Verificar com um modelo cheio de problemas**

Crie `.checks/model-check.ts`:

```ts
// Confere as regras M1–M5 com um modelo montado à mão, cheio de problemas.
import type { Feature, FeatureModel } from '../src/renderer/src/domain/feature-model/feature-model'
import { featuresInPreOrder } from '../src/renderer/src/domain/feature-model/traversal'
import { validateFeatureModel } from '../src/renderer/src/domain/feature-model/validation'
import { parseExpression } from '../src/renderer/src/domain/expression/parser'

const leaf = (id: string, variability?: 'mandatory' | 'optional'): Feature => ({
  id,
  name: id,
  ...(variability ? { variability } : {}),
  attributes: [],
  children: []
})
const expression = (text: string) => {
  const parsed = parseExpression(text)
  if (!parsed.ok) throw new Error(parsed.error.message)
  return parsed.value
}

const model: FeatureModel = {
  name: 'Teste',
  root: {
    ...leaf('raiz', 'optional'), // M2: raiz com variabilidade
    attributes: [
      { id: 'cor', name: 'Cor', type: 'enum', configurable: true, options: [] }, // M5: enum sem option
      { id: 'peso', name: 'Peso', type: 'number', min: 5, max: 1, configurable: false, options: [] } // M5: min>max, fixo sem default
    ],
    children: [
      { kind: 'feature', feature: leaf('a') }, // M2: solitária sem variabilidade
      { kind: 'feature', feature: leaf('a', 'optional') }, // M1: repetido
      { kind: 'feature', feature: leaf('or', 'optional') }, // M1: reservado
      {
        kind: 'group',
        group: { min: 3, max: 2, members: [leaf('b', 'mandatory'), leaf('c')] } // M3 + M2
      },
      { kind: 'group', group: { min: 0, max: 5, members: [leaf('d')] } } // avisos
    ]
  },
  constraints: [
    { id: 'r1', expression: expression('a implies zzz') }, // M4: feature inexistente
    { id: 'r1', expression: expression('b or c') } // M4: ID repetido
  ]
}

console.log(
  'pré-ordem:',
  featuresInPreOrder(model.root)
    .map((f) => f.id)
    .join(' ')
)
for (const issue of validateFeatureModel(model)) {
  console.log(`${issue.severity.padEnd(7)} [${issue.subject}] ${issue.message}`)
}
```

```bash
npx tsx .checks/model-check.ts
```

Esperado, exatamente:

```
pré-ordem: raiz a a or b c d
error   [raiz] A feature raiz não pode ter variabilidade.
error   [raiz.cor] enum precisa de ao menos uma option.
error   [raiz.peso] min maior que max.
error   [raiz.peso] Atributo fixo precisa de default.
error   [a] Feature fora de grupo precisa ser obrigatória ou opcional.
error   [a] ID "a" repetido.
error   [or] ID "or" inválido: use [a-z][a-z0-9_]* e evite palavras reservadas.
error   [raiz (grupo)] O máximo do grupo deve ser * ou pelo menos 3.
error   [raiz (grupo)] O mínimo do grupo (3) passa do número de membros (2).
error   [b] Membro de grupo não tem variabilidade própria.
warning [raiz (grupo)] O máximo do grupo (5) passa do número de membros e vale como *.
warning [raiz (grupo)] Grupo com um único membro.
error   [r1] A restrição cita a feature "zzz", que não existe.
error   [r1] ID de restrição "r1" repetido.
```

- [ ] **Passo 7: Tipos e lint**

```bash
npm run format && npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 8: Commit**

```bash
git add -A
git commit -m "feat(domain): Feature Model com as regras M1–M5

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Configuração, assets e projeto

**Arquivos:**

- Criar: `src/renderer/src/domain/configuration/configuration.ts`, `src/renderer/src/domain/assets/asset-catalog.ts`, `src/renderer/src/domain/assets/validation.ts`, `src/renderer/src/domain/project/project.ts`

**Interfaces:**

- Consome: `Expression`, `referencedFeatureIds` (Tarefa 1); `FeatureModel`, `featuresInPreOrder`, `error()`, `ValidationIssue` (Tarefa 2).
- Produz:
  - `Configuration { name; decisions: ManualDecision[]; values: AttributeValue[] }`, `ManualDecision`, `AttributeValue`, `DecisionState`
  - `Asset`, `AssetKind`, `AssetCatalog`, `EMPTY_ASSET_CATALOG`
  - `validateAssetCatalog(catalog: AssetCatalog, model: FeatureModel): ValidationIssue[]`, `isInsideProject(path: string): boolean`
  - `Project { model; assets; configurations: ConfigurationEntry[] }`, `ConfigurationEntry { key; configuration }`

- [ ] **Passo 1: Criar `src/renderer/src/domain/configuration/configuration.ts`**

```ts
/*
 * Uma configuração guarda só decisões manuais e valores de atributos (ADR 0005).
 * A resolução (propagação, validade, completude) chega na Fase 3.
 */

export type DecisionState = 'selected' | 'deselected'

export interface ManualDecision {
  readonly featureId: string
  readonly state: DecisionState
}

export interface AttributeValue {
  readonly featureId: string
  readonly attributeId: string
  readonly value: string
}

export interface Configuration {
  readonly name: string
  readonly decisions: readonly ManualDecision[]
  readonly values: readonly AttributeValue[]
}
```

- [ ] **Passo 2: Criar `src/renderer/src/domain/assets/asset-catalog.ts`**

```ts
import type { Expression } from '../expression/ast'

export type AssetKind = 'fragment' | 'resource'

export interface Asset {
  readonly id: string
  readonly kind: AssetKind
  /** Relativo à pasta do projeto, com "/" como separador. */
  readonly path: string
  /** Feature que define onde o asset aparece no produto gerado. */
  readonly anchor: string
  readonly name?: string
  /** Condição de presença opcional; junto com a âncora, define quando o asset entra. */
  readonly condition?: Expression
}

export interface AssetCatalog {
  /** Na ordem do assets.xml, que é a ordem dos assets de uma mesma âncora no produto. */
  readonly assets: readonly Asset[]
}

export const EMPTY_ASSET_CATALOG: AssetCatalog = { assets: [] }
```

- [ ] **Passo 3: Criar `src/renderer/src/domain/assets/validation.ts`**

```ts
import { referencedFeatureIds } from '../expression/references'
import { featuresInPreOrder } from '../feature-model/traversal'
import type { FeatureModel } from '../feature-model/feature-model'
import { error, type ValidationIssue } from '../shared/validation-issue'
import type { AssetCatalog } from './asset-catalog'

/** Confere as invariantes A1–A3 dos assets contra o modelo (SPEC §4.3). */
export function validateAssetCatalog(
  catalog: AssetCatalog,
  model: FeatureModel
): ValidationIssue[] {
  const featureIds = new Set(featuresInPreOrder(model.root).map((feature) => feature.id))
  const assetIds = new Set<string>()
  const issues: ValidationIssue[] = []

  for (const asset of catalog.assets) {
    if (assetIds.has(asset.id)) issues.push(error(`ID de asset "${asset.id}" repetido.`, asset.id))
    assetIds.add(asset.id)

    if (!isInsideProject(asset.path)) {
      issues.push(
        error(`O caminho "${asset.path}" precisa ser relativo e ficar dentro do projeto.`, asset.id)
      )
    }
    if (!featureIds.has(asset.anchor)) {
      issues.push(error(`A âncora "${asset.anchor}" não existe no modelo.`, asset.id))
    }
    if (asset.condition !== undefined) {
      for (const id of referencedFeatureIds(asset.condition)) {
        if (!featureIds.has(id)) {
          issues.push(error(`A condição cita a feature "${id}", que não existe.`, asset.id))
        }
      }
    }
  }
  return issues
}

/** Caminho relativo com "/" que não escapa da pasta do projeto (A1). */
export function isInsideProject(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\') || /^[A-Za-z]:/.test(path)) {
    return false
  }
  let depth = 0
  for (const segment of path.split('/')) {
    if (segment === '..') depth--
    else if (segment !== '.' && segment !== '') depth++
    if (depth < 0) return false
  }
  return true
}
```

- [ ] **Passo 4: Criar `src/renderer/src/domain/project/project.ts`**

```ts
import type { AssetCatalog } from '../assets/asset-catalog'
import type { Configuration } from '../configuration/configuration'
import type { FeatureModel } from '../feature-model/feature-model'

/** Uma configuração e sua identidade: o nome do arquivo sem `.xml` (SPEC §3). */
export interface ConfigurationEntry {
  readonly key: string
  readonly configuration: Configuration
}

/** Conteúdo de uma pasta de projeto: um modelo, seus assets e suas configurações. */
export interface Project {
  readonly model: FeatureModel
  readonly assets: AssetCatalog
  readonly configurations: readonly ConfigurationEntry[]
}
```

- [ ] **Passo 5: Verificar as regras A1–A3**

Crie `.checks/assets-check.ts`:

```ts
// Confere as regras A1–A3 e o teste de caminho dentro do projeto.
import { isInsideProject, validateAssetCatalog } from '../src/renderer/src/domain/assets/validation'
import type { FeatureModel } from '../src/renderer/src/domain/feature-model/feature-model'
import { parseExpression } from '../src/renderer/src/domain/expression/parser'

for (const path of [
  'docs/a.xml',
  'a.png',
  './docs/a.xml',
  'docs/../a.xml',
  '../a.xml',
  'docs/../../a.xml',
  '/etc/a',
  'C:/a',
  'docs\\a.xml',
  ''
])
  console.log(JSON.stringify(path).padEnd(22), isInsideProject(path) ? 'dentro' : 'FORA')

const model: FeatureModel = {
  name: 'Teste',
  root: {
    id: 'raiz',
    name: 'Raiz',
    attributes: [],
    children: [
      {
        kind: 'feature',
        feature: { id: 'a', name: 'A', variability: 'optional', attributes: [], children: [] }
      }
    ]
  },
  constraints: []
}
const condition = parseExpression('a and b')
if (!condition.ok) throw new Error('condição')

const issues = validateAssetCatalog(
  {
    assets: [
      { id: 'ok', kind: 'fragment', path: 'docs/a.xml', anchor: 'a' },
      { id: 'ok', kind: 'resource', path: 'img/a.png', anchor: 'a' }, // A: ID repetido
      { id: 'fora', kind: 'resource', path: '../a.png', anchor: 'a' }, // A1
      { id: 'ancora', kind: 'fragment', path: 'b.xml', anchor: 'x' }, // A2
      { id: 'cond', kind: 'fragment', path: 'c.xml', anchor: 'a', condition: condition.value } // A3
    ]
  },
  model
)
for (const issue of issues) console.log(`${issue.severity} [${issue.subject}] ${issue.message}`)
```

```bash
npx tsx .checks/assets-check.ts
```

Esperado, exatamente:

```
"docs/a.xml"           dentro
"a.png"                dentro
"./docs/a.xml"         dentro
"docs/../a.xml"        dentro
"../a.xml"             FORA
"docs/../../a.xml"     FORA
"/etc/a"               FORA
"C:/a"                 FORA
"docs\\a.xml"          FORA
""                     FORA
error [ok] ID de asset "ok" repetido.
error [fora] O caminho "../a.png" precisa ser relativo e ficar dentro do projeto.
error [ancora] A âncora "x" não existe no modelo.
error [cond] A condição cita a feature "b", que não existe.
```

- [ ] **Passo 6: Tipos e lint**

```bash
npm run format && npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 7: Commit**

```bash
git add -A
git commit -m "feat(domain): configuração, assets com as regras A1–A3 e projeto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: Ports e casos de uso de abrir e salvar

**Arquivos:**

- Criar: `src/renderer/src/application/file-problem.ts`, `src/renderer/src/application/project-session.ts` e, em `src/renderer/src/application/`, os arquivos `ports/project-storage.ts`, `ports/project-folder-picker.ts`, `ports/xml-schema-validator.ts`, `ports/repositories.ts`, `use-cases/open-project.ts`, `use-cases/save-project.ts`
- Remover: `src/renderer/src/application/.gitkeep`

**Interfaces:**

- Consome: domínio das Tarefas 1–3 (`validateFeatureModel`, `validateAssetCatalog`, `EMPTY_ASSET_CATALOG`, `Project`, `ConfigurationEntry`, `Result`).
- Produz:
  - `FileProblem { file; line?; subject?; severity; message }`, `fileError(file, message, line?)`, `fromValidationIssues(file, issues)`
  - `ProjectStorage` com `readText(path)`, `writeText(path, content, precondition)` (devolve o novo hash) e `list(directory)`; `StorageError`, `StoredText`, `StorageEntry`, `WritePrecondition`
  - `ProjectFolderPicker.pick(): Promise<Result<PickedFolder | null, StorageError>>`, `PickedFolder { rootPath; name }`
  - `XmlSchemaValidator.validate(schema: XmlSchema, fileName, content): Promise<XmlSchemaIssue[]>`, `XmlSchema = 'feature-model' | 'assets' | 'configuration'`
  - `FeatureModelRepository`, `AssetCatalogRepository`, `ConfigurationRepository`, `LoadedFile<T>`, `ExpectedHash`, `SaveResult`
  - `ProjectSession { folder; project; hashes: FileHashes }`
  - `new OpenProject({ picker, models, assets, configurations }).execute(): Promise<OpenProjectResult>` (`cancelled` | `opened` com `session` e `warnings` | `failed` com `problems`)
  - `new SaveProject({ models, assets, configurations }).execute(session): Promise<SaveProjectResult>` (`session` com hashes novos + `problems`)

- [ ] **Passo 1: Criar `src/renderer/src/application/file-problem.ts`**

```ts
import type { IssueSeverity, ValidationIssue } from '@/domain/shared/validation-issue'

/** Problema num arquivo do projeto, pronto para mostrar ao usuário (SPEC §5). */
export interface FileProblem {
  /** Caminho relativo à pasta do projeto, como "model.xml". */
  readonly file: string
  readonly line?: number
  /** ID do elemento envolvido, quando o problema vem das regras do domínio. */
  readonly subject?: string
  readonly severity: IssueSeverity
  readonly message: string
}

export function fileError(file: string, message: string, line?: number): FileProblem {
  return { file, line, severity: 'error', message }
}

export function fromValidationIssues(
  file: string,
  issues: readonly ValidationIssue[]
): FileProblem[] {
  return issues.map((issue) => ({ file, ...issue }))
}
```

- [ ] **Passo 2: Criar os ports**

`src/renderer/src/application/ports/project-storage.ts`:

```ts
import type { Result } from '@/domain/shared/result'

export type StorageErrorCode =
  'no-project' | 'outside-project' | 'not-found' | 'changed-externally' | 'io'

export interface StorageError {
  readonly code: StorageErrorCode
  readonly message: string
}

export interface StoredText {
  readonly content: string
  /** Hash do conteúdo lido, usado para detectar alteração externa ao gravar. */
  readonly hash: string
}

export interface StorageEntry {
  readonly name: string
  readonly kind: 'file' | 'directory'
}

export type WritePrecondition =
  | { readonly kind: 'hash'; readonly expectedHash: string }
  | { readonly kind: 'must-not-exist' }
  | { readonly kind: 'overwrite' }

/** Arquivos da pasta do projeto aberto. Caminhos relativos, com "/" como separador. */
export interface ProjectStorage {
  readText(path: string): Promise<Result<StoredText, StorageError>>
  /** Devolve o hash do conteúdo gravado. */
  writeText(
    path: string,
    content: string,
    precondition: WritePrecondition
  ): Promise<Result<string, StorageError>>
  list(directory: string): Promise<Result<StorageEntry[], StorageError>>
}
```

`src/renderer/src/application/ports/project-folder-picker.ts`:

```ts
import type { Result } from '@/domain/shared/result'
import type { StorageError } from './project-storage'

export interface PickedFolder {
  /** Caminho absoluto, só para exibição. */
  readonly rootPath: string
  readonly name: string
}

/** Pede ao usuário a pasta do projeto e passa a usá-la como raiz do `ProjectStorage`. */
export interface ProjectFolderPicker {
  /** `null` quando o usuário cancela. */
  pick(): Promise<Result<PickedFolder | null, StorageError>>
}
```

`src/renderer/src/application/ports/xml-schema-validator.ts`:

```ts
export type XmlSchema = 'feature-model' | 'assets' | 'configuration'

export interface XmlSchemaIssue {
  readonly line?: number
  readonly message: string
}

/** Etapas 1 e 2 da leitura (SPEC §5): XML bem-formado e conforme o XSD. */
export interface XmlSchemaValidator {
  /** Lista vazia = documento válido. */
  validate(schema: XmlSchema, fileName: string, content: string): Promise<XmlSchemaIssue[]>
}
```

`src/renderer/src/application/ports/repositories.ts`:

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
 * Hash que o arquivo deve ter no disco para a gravação seguir,
 * ou `null` quando o arquivo ainda não deve existir.
 */
export type ExpectedHash = string | null

/** Gravação bem-sucedida devolve o novo hash do arquivo. */
export type SaveResult = Result<string, FileProblem[]>

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

- [ ] **Passo 3: Criar `src/renderer/src/application/project-session.ts`**

```ts
import type { Project } from '@/domain/project/project'
import type { PickedFolder } from './ports/project-folder-picker'
import type { ExpectedHash } from './ports/repositories'

/** Hashes dos arquivos como estavam no disco na última leitura ou gravação. */
export interface FileHashes {
  readonly model: string
  /** `null` enquanto o assets.xml não existe no disco. */
  readonly assets: ExpectedHash
  /** Por chave de configuração. */
  readonly configurations: Readonly<Record<string, string>>
}

/** Projeto aberto: o conteúdo e o que é preciso para gravá-lo com segurança. */
export interface ProjectSession {
  readonly folder: PickedFolder
  readonly project: Project
  readonly hashes: FileHashes
}
```

- [ ] **Passo 4: Criar `src/renderer/src/application/use-cases/open-project.ts`**

```ts
import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { validateAssetCatalog } from '@/domain/assets/validation'
import { validateFeatureModel } from '@/domain/feature-model/validation'
import type { ConfigurationEntry } from '@/domain/project/project'
import { fileError, fromValidationIssues, type FileProblem } from '../file-problem'
import type { ProjectFolderPicker } from '../ports/project-folder-picker'
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

  async execute(): Promise<OpenProjectResult> {
    const picked = await this.deps.picker.pick()
    if (!picked.ok) return { status: 'failed', problems: [fileError('.', picked.error.message)] }
    if (picked.value === null) return { status: 'cancelled' }

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
        folder: picked.value,
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

- [ ] **Passo 5: Criar `src/renderer/src/application/use-cases/save-project.ts`**

```ts
import type { FileProblem } from '../file-problem'
import type {
  AssetCatalogRepository,
  ConfigurationRepository,
  FeatureModelRepository
} from '../ports/repositories'
import type { ProjectSession } from '../project-session'

export interface SaveProjectResult {
  /** Sessão com os hashes atualizados dos arquivos que foram gravados. */
  readonly session: ProjectSession
  /** Arquivos que não puderam ser gravados (por exemplo, alterados fora do app). */
  readonly problems: FileProblem[]
}

export interface SaveProjectDependencies {
  readonly models: FeatureModelRepository
  readonly assets: AssetCatalogRepository
  readonly configurations: ConfigurationRepository
}

/**
 * Grava todos os arquivos do projeto. Cada arquivo só é gravado se ainda estiver
 * como na última leitura; os demais seguem sendo gravados e o problema é informado.
 */
export class SaveProject {
  private readonly deps: SaveProjectDependencies

  constructor(deps: SaveProjectDependencies) {
    this.deps = deps
  }

  async execute(session: ProjectSession): Promise<SaveProjectResult> {
    const { project, hashes } = session
    const problems: FileProblem[] = []

    const model = await this.deps.models.save(project.model, hashes.model)
    if (!model.ok) problems.push(...model.error)

    let assetsHash = hashes.assets
    if (hashes.assets !== null || project.assets.assets.length > 0) {
      const assets = await this.deps.assets.save(project.assets, hashes.assets)
      if (assets.ok) assetsHash = assets.value
      else problems.push(...assets.error)
    }

    const configurationHashes: Record<string, string> = { ...hashes.configurations }
    for (const { key, configuration } of project.configurations) {
      const saved = await this.deps.configurations.save(
        key,
        configuration,
        hashes.configurations[key] ?? null
      )
      if (saved.ok) configurationHashes[key] = saved.value
      else problems.push(...saved.error)
    }

    return {
      problems,
      session: {
        ...session,
        hashes: {
          model: model.ok ? model.value : hashes.model,
          assets: assetsHash,
          configurations: configurationHashes
        }
      }
    }
  }
}
```

```bash
rm src/renderer/src/application/.gitkeep
```

- [ ] **Passo 6: Tipos e lint**

Os casos de uso só rodam de verdade na Tarefa 5, quando existirem repositórios. Aqui a verificação é de tipos e de camadas:

```bash
npm run format && npm run typecheck && npm run lint
```

Esperado: sem erros (um import de `infrastructure/` ou de biblioteca dentro de `application/` seria erro de lint).

- [ ] **Passo 7: Commit**

```bash
git add -A
git commit -m "feat(application): ports e casos de uso de abrir e salvar projeto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: Codecs XML e repositórios

**Arquivos:**

- Criar, em `src/renderer/src/infrastructure/xml/`: `xml-writer.ts`, `xml-reader.ts`, `expression-field.ts`, `feature-model-codec.ts`, `assets-codec.ts`, `configuration-codec.ts`, `xml-document-file.ts`, `xml-repositories.ts`
- Modificar: `docs/examples/loja-online/model.xml` (linha 8), `package.json`
- Remover: `src/renderer/src/infrastructure/.gitkeep`

**Interfaces:**

- Consome: ports e `FileProblem` (Tarefa 4); `printExpression`, `parseExpression` (Tarefa 1); tipos do domínio (Tarefas 2 e 3).
- Produz:
  - `new XmlFeatureModelRepository(storage, validator)`, `new XmlAssetCatalogRepository(storage, validator)`, `new XmlConfigurationRepository(storage, validator)`, que implementam os repositórios da Tarefa 4
  - `writeXmlDocument(root: XmlElement): string`, `element()`, `textElement()`
  - `parseXmlRoot(content: string): Element` (`@xmldom/xmldom`)
  - `decodeFeatureModel` / `encodeFeatureModel`, `decodeAssetCatalog` / `encodeAssetCatalog`, `decodeConfiguration` / `encodeConfiguration`

- [ ] **Passo 1: Instalar as bibliotecas de XML**

`@xmldom/xmldom` lê o XML com número de linha em cada elemento, no navegador e no Node. `xmllint-wasm` é o validador XSD: na Tarefa 6 ele passa a rodar no processo main; aqui é usado só pelo script de verificação.

```bash
npm install @xmldom/xmldom xmllint-wasm
```

- [ ] **Passo 2: Pôr o exemplo na ordem canônica de atributos**

O escritor grava os atributos na ordem do XSD (`id name type default min max configurable`), mas a linha 8 do exemplo tem `default` depois de `min`/`max`. Troque a linha 8 de `docs/examples/loja-online/model.xml` por:

```xml
      <attribute id="max_resultados" name="Máx. resultados" type="number" default="50" min="10" max="500"/>
```

- [ ] **Passo 3: Criar o escritor determinístico `xml-writer.ts`**

```ts
/*
 * Escrita determinística de XML (SPEC §5): UTF-8 com declaração, recuo de 2 espaços,
 * atributos na ordem em que são passados e atributos `undefined` omitidos.
 * O mesmo modelo gera sempre os mesmos bytes, o que deixa os diffs do git limpos.
 */

export type XmlAttributes = ReadonlyArray<readonly [name: string, value: string | undefined]>

export interface XmlElement {
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

export function textElement(
  name: string,
  text: string,
  attributes: XmlAttributes = []
): XmlElement {
  return { name, attributes, children: [], text }
}

export function writeXmlDocument(root: XmlElement): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${writeElement(root, 0)}\n`
}

function writeElement(node: XmlElement, depth: number): string {
  const indent = '  '.repeat(depth)
  const attributes = node.attributes
    .filter((attribute): attribute is readonly [string, string] => attribute[1] !== undefined)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('')
  const opening = `${indent}<${node.name}${attributes}`

  if (node.text !== undefined) return `${opening}>${escapeText(node.text)}</${node.name}>`
  if (node.children.length === 0) return `${opening}/>`
  return [
    `${opening}>`,
    ...node.children.map((child) => writeElement(child, depth + 1)),
    `${indent}</${node.name}>`
  ].join('\n')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;')
}
```

- [ ] **Passo 4: Criar o leitor `xml-reader.ts`**

```ts
import { DOMParser, type Element } from '@xmldom/xmldom'

/*
 * Leitura com @xmldom/xmldom (funciona igual no navegador e no Node) e com número de linha
 * em cada elemento, usado para apontar erros das regras do domínio.
 * Só é chamada depois que o documento passou pelo XSD, então a estrutura é confiável.
 */

const ELEMENT_NODE = 1

export interface DecodeProblem {
  readonly line?: number
  readonly subject?: string
  readonly message: string
}

export function parseXmlRoot(content: string): Element {
  const failures: string[] = []
  const document = new DOMParser({
    locator: true,
    onError: (level, message) => {
      if (level !== 'warning') failures.push(message)
    }
  }).parseFromString(content, 'text/xml')
  const root = document.documentElement
  if (failures.length > 0 || root === null) {
    throw new Error(`XML inválido depois da validação: ${failures.join('; ')}`)
  }
  return root
}

export function childElements(parent: Element, localName?: string): Element[] {
  const elements: Element[] = []
  for (let index = 0; index < parent.childNodes.length; index++) {
    const node = parent.childNodes[index]
    if (node.nodeType !== ELEMENT_NODE) continue
    const child = node as Element
    if (localName === undefined || child.localName === localName) elements.push(child)
  }
  return elements
}

export function firstChild(parent: Element, localName: string): Element | undefined {
  return childElements(parent, localName)[0]
}

export function requiredAttribute(element: Element, name: string): string {
  return element.getAttribute(name) ?? ''
}

export function optionalAttribute(element: Element, name: string): string | undefined {
  return element.hasAttribute(name) ? (element.getAttribute(name) ?? undefined) : undefined
}

export function textOf(element: Element): string {
  return element.textContent ?? ''
}

export function lineOf(element: Element): number | undefined {
  return element.lineNumber
}
```

- [ ] **Passo 5: Criar `expression-field.ts`**

```ts
import type { Element } from '@xmldom/xmldom'
import type { Expression } from '@/domain/expression/ast'
import { parseExpression } from '@/domain/expression/parser'
import { lineOf, textOf, type DecodeProblem } from './xml-reader'

/**
 * Lê o texto de um elemento como expressão. Em caso de erro de sintaxe, registra o
 * problema com a linha do elemento e devolve `undefined`.
 */
export function decodeExpression(
  element: Element,
  subject: string,
  problems: DecodeProblem[]
): Expression | undefined {
  const parsed = parseExpression(textOf(element))
  if (parsed.ok) return parsed.value
  problems.push({
    line: lineOf(element),
    subject,
    message: `Expressão inválida (coluna ${parsed.error.column}): ${parsed.error.message}`
  })
  return undefined
}
```

- [ ] **Passo 6: Criar os três codecs**

`feature-model-codec.ts`:

```ts
import type { Element } from '@xmldom/xmldom'
import { printExpression } from '@/domain/expression/printer'
import type {
  Attribute,
  AttributeType,
  Constraint,
  Feature,
  FeatureChild,
  FeatureModel,
  Group,
  Variability
} from '@/domain/feature-model/feature-model'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeExpression } from './expression-field'
import {
  childElements,
  firstChild,
  optionalAttribute,
  requiredAttribute,
  textOf,
  type DecodeProblem
} from './xml-reader'
import { element, textElement, writeXmlDocument, type XmlElement } from './xml-writer'

const NAMESPACE = 'urn:mdd:feature-model'

// Leitura (docs/schemas/feature-model.xsd)

export function decodeFeatureModel(root: Element): Result<FeatureModel, DecodeProblem[]> {
  const problems: DecodeProblem[] = []
  const rootFeature = decodeFeature(firstChild(root, 'feature')!)
  const constraintsElement = firstChild(root, 'constraints')
  const constraints = constraintsElement
    ? childElements(constraintsElement, 'constraint').flatMap((constraint) =>
        decodeConstraint(constraint, problems)
      )
    : []
  if (problems.length > 0) return err(problems)
  return ok({ name: requiredAttribute(root, 'name'), root: rootFeature, constraints })
}

function decodeFeature(node: Element): Feature {
  const description = firstChild(node, 'description')
  const variability = optionalAttribute(node, 'variability') as Variability | undefined
  const children: FeatureChild[] = []
  for (const child of childElements(node)) {
    if (child.localName === 'feature') {
      children.push({ kind: 'feature', feature: decodeFeature(child) })
    } else if (child.localName === 'group') {
      children.push({ kind: 'group', group: decodeGroup(child) })
    }
  }
  return {
    id: requiredAttribute(node, 'id'),
    name: requiredAttribute(node, 'name'),
    ...(description ? { description: textOf(description) } : {}),
    ...(variability ? { variability } : {}),
    attributes: childElements(node, 'attribute').map(decodeAttribute),
    children
  }
}

function decodeGroup(node: Element): Group {
  const max = requiredAttribute(node, 'max')
  return {
    min: Number(requiredAttribute(node, 'min')),
    max: max === '*' ? '*' : Number(max),
    members: childElements(node, 'feature').map(decodeFeature)
  }
}

function decodeAttribute(node: Element): Attribute {
  const defaultValue = optionalAttribute(node, 'default')
  const min = optionalAttribute(node, 'min')
  const max = optionalAttribute(node, 'max')
  return {
    id: requiredAttribute(node, 'id'),
    name: requiredAttribute(node, 'name'),
    type: requiredAttribute(node, 'type') as AttributeType,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(min !== undefined ? { min: Number(min) } : {}),
    ...(max !== undefined ? { max: Number(max) } : {}),
    configurable: optionalAttribute(node, 'configurable') !== 'false',
    options: childElements(node, 'option').map((option) => requiredAttribute(option, 'value'))
  }
}

function decodeConstraint(node: Element, problems: DecodeProblem[]): Constraint[] {
  const id = requiredAttribute(node, 'id')
  const description = optionalAttribute(node, 'description')
  const expression = decodeExpression(firstChild(node, 'expression')!, id, problems)
  if (expression === undefined) return []
  return [{ id, ...(description !== undefined ? { description } : {}), expression }]
}

// Escrita, na ordem de elementos e atributos do XSD

export function encodeFeatureModel(model: FeatureModel): string {
  const constraints =
    model.constraints.length > 0
      ? [element('constraints', [], model.constraints.map(encodeConstraint))]
      : []
  return writeXmlDocument(
    element(
      'featureModel',
      [
        ['xmlns', NAMESPACE],
        ['schemaVersion', '1'],
        ['name', model.name]
      ],
      [encodeFeature(model.root), ...constraints]
    )
  )
}

function encodeFeature(feature: Feature): XmlElement {
  return element(
    'feature',
    [
      ['id', feature.id],
      ['name', feature.name],
      ['variability', feature.variability]
    ],
    [
      ...(feature.description !== undefined
        ? [textElement('description', feature.description)]
        : []),
      ...feature.attributes.map(encodeAttribute),
      ...feature.children.map((child) =>
        child.kind === 'feature' ? encodeFeature(child.feature) : encodeGroup(child.group)
      )
    ]
  )
}

function encodeGroup(group: Group): XmlElement {
  return element(
    'group',
    [
      ['min', String(group.min)],
      ['max', String(group.max)]
    ],
    group.members.map(encodeFeature)
  )
}

function encodeAttribute(attribute: Attribute): XmlElement {
  return element(
    'attribute',
    [
      ['id', attribute.id],
      ['name', attribute.name],
      ['type', attribute.type],
      ['default', attribute.defaultValue],
      ['min', attribute.min?.toString()],
      ['max', attribute.max?.toString()],
      ['configurable', attribute.configurable ? undefined : 'false']
    ],
    attribute.options.map((option) => element('option', [['value', option]]))
  )
}

function encodeConstraint(constraint: Constraint): XmlElement {
  return element(
    'constraint',
    [
      ['id', constraint.id],
      ['description', constraint.description]
    ],
    [textElement('expression', printExpression(constraint.expression))]
  )
}
```

`assets-codec.ts`:

```ts
import type { Element } from '@xmldom/xmldom'
import type { Asset, AssetCatalog, AssetKind } from '@/domain/assets/asset-catalog'
import { printExpression } from '@/domain/expression/printer'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeExpression } from './expression-field'
import {
  childElements,
  firstChild,
  optionalAttribute,
  requiredAttribute,
  type DecodeProblem
} from './xml-reader'
import { element, textElement, writeXmlDocument, type XmlElement } from './xml-writer'

const NAMESPACE = 'urn:mdd:assets'

// Leitura (docs/schemas/assets.xsd)

export function decodeAssetCatalog(root: Element): Result<AssetCatalog, DecodeProblem[]> {
  const problems: DecodeProblem[] = []
  const assets = childElements(root, 'asset').flatMap((asset) => decodeAsset(asset, problems))
  return problems.length > 0 ? err(problems) : ok({ assets })
}

function decodeAsset(node: Element, problems: DecodeProblem[]): Asset[] {
  const id = requiredAttribute(node, 'id')
  const name = optionalAttribute(node, 'name')
  const conditionElement = firstChild(node, 'condition')
  const condition = conditionElement ? decodeExpression(conditionElement, id, problems) : undefined
  if (conditionElement && condition === undefined) return []
  return [
    {
      id,
      kind: requiredAttribute(node, 'kind') as AssetKind,
      path: requiredAttribute(node, 'path'),
      anchor: requiredAttribute(node, 'anchor'),
      ...(name !== undefined ? { name } : {}),
      ...(condition !== undefined ? { condition } : {})
    }
  ]
}

// Escrita, na ordem de elementos e atributos do XSD

export function encodeAssetCatalog(catalog: AssetCatalog): string {
  return writeXmlDocument(
    element(
      'assets',
      [
        ['xmlns', NAMESPACE],
        ['schemaVersion', '1']
      ],
      catalog.assets.map(encodeAsset)
    )
  )
}

function encodeAsset(asset: Asset): XmlElement {
  return element(
    'asset',
    [
      ['id', asset.id],
      ['kind', asset.kind],
      ['path', asset.path],
      ['anchor', asset.anchor],
      ['name', asset.name]
    ],
    asset.condition !== undefined
      ? [textElement('condition', printExpression(asset.condition))]
      : []
  )
}
```

`configuration-codec.ts`:

```ts
import type { Element } from '@xmldom/xmldom'
import type { Configuration, DecisionState } from '@/domain/configuration/configuration'
import { ok, type Result } from '@/domain/shared/result'
import { childElements, requiredAttribute, textOf, type DecodeProblem } from './xml-reader'
import { element, textElement, writeXmlDocument } from './xml-writer'

const NAMESPACE = 'urn:mdd:configuration'

// Leitura (docs/schemas/configuration.xsd)

export function decodeConfiguration(root: Element): Result<Configuration, DecodeProblem[]> {
  return ok({
    name: requiredAttribute(root, 'name'),
    decisions: childElements(root, 'decision').map((decision) => ({
      featureId: requiredAttribute(decision, 'feature'),
      state: requiredAttribute(decision, 'state') as DecisionState
    })),
    values: childElements(root, 'value').map((value) => ({
      featureId: requiredAttribute(value, 'feature'),
      attributeId: requiredAttribute(value, 'attribute'),
      value: textOf(value)
    }))
  })
}

// Escrita, na ordem de elementos e atributos do XSD

export function encodeConfiguration(configuration: Configuration): string {
  return writeXmlDocument(
    element(
      'configuration',
      [
        ['xmlns', NAMESPACE],
        ['schemaVersion', '1'],
        ['name', configuration.name]
      ],
      [
        ...configuration.decisions.map((decision) =>
          element('decision', [
            ['feature', decision.featureId],
            ['state', decision.state]
          ])
        ),
        ...configuration.values.map((value) =>
          textElement('value', value.value, [
            ['feature', value.featureId],
            ['attribute', value.attributeId]
          ])
        )
      ]
    )
  )
}
```

- [ ] **Passo 7: Criar `xml-document-file.ts` (as etapas de leitura de um arquivo)**

```ts
import type { Element } from '@xmldom/xmldom'
import { fileError, type FileProblem } from '@/application/file-problem'
import type { ProjectStorage, StorageError } from '@/application/ports/project-storage'
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
      expectedHash === null ? { kind: 'must-not-exist' } : { kind: 'hash', expectedHash }
    )
    return written.ok ? written : err([this.storageProblem(written.error)])
  }

  private storageProblem(error: StorageError): FileProblem {
    if (error.code === 'changed-externally') {
      return fileError(this.path, 'O arquivo foi alterado fora do app desde a última leitura.')
    }
    return fileError(this.path, error.message)
  }
}
```

- [ ] **Passo 8: Criar `xml-repositories.ts`**

```ts
import { fileError, type FileProblem } from '@/application/file-problem'
import type { ProjectStorage } from '@/application/ports/project-storage'
import type {
  AssetCatalogRepository,
  ConfigurationRepository,
  ExpectedHash,
  FeatureModelRepository,
  LoadedFile,
  SaveResult
} from '@/application/ports/repositories'
import type { XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import type { AssetCatalog } from '@/domain/assets/asset-catalog'
import type { Configuration } from '@/domain/configuration/configuration'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeAssetCatalog, encodeAssetCatalog } from './assets-codec'
import { decodeConfiguration, encodeConfiguration } from './configuration-codec'
import { decodeFeatureModel, encodeFeatureModel } from './feature-model-codec'
import { XmlDocumentFile, type XmlDocumentFormat } from './xml-document-file'

const MODEL_PATH = 'model.xml'
const ASSETS_PATH = 'assets.xml'
const CONFIGURATIONS_DIRECTORY = 'configurations'

const featureModelFormat: XmlDocumentFormat<FeatureModel> = {
  schema: 'feature-model',
  decode: decodeFeatureModel,
  encode: encodeFeatureModel
}

const assetCatalogFormat: XmlDocumentFormat<AssetCatalog> = {
  schema: 'assets',
  decode: decodeAssetCatalog,
  encode: encodeAssetCatalog
}

const configurationFormat: XmlDocumentFormat<Configuration> = {
  schema: 'configuration',
  decode: decodeConfiguration,
  encode: encodeConfiguration
}

export class XmlFeatureModelRepository implements FeatureModelRepository {
  private readonly file: XmlDocumentFile<FeatureModel>

  constructor(storage: ProjectStorage, validator: XmlSchemaValidator) {
    this.file = new XmlDocumentFile(storage, validator, MODEL_PATH, featureModelFormat)
  }

  async load(): Promise<Result<LoadedFile<FeatureModel>, FileProblem[]>> {
    const loaded = await this.file.load()
    if (!loaded.ok) return loaded
    if (loaded.value === null) {
      return err([fileError(MODEL_PATH, 'A pasta não tem model.xml, então não é um projeto mdd.')])
    }
    return ok(loaded.value)
  }

  save(model: FeatureModel, expectedHash: ExpectedHash): Promise<SaveResult> {
    return this.file.save(model, expectedHash)
  }
}

export class XmlAssetCatalogRepository implements AssetCatalogRepository {
  private readonly file: XmlDocumentFile<AssetCatalog>

  constructor(storage: ProjectStorage, validator: XmlSchemaValidator) {
    this.file = new XmlDocumentFile(storage, validator, ASSETS_PATH, assetCatalogFormat)
  }

  load(): Promise<Result<LoadedFile<AssetCatalog> | null, FileProblem[]>> {
    return this.file.load()
  }

  save(catalog: AssetCatalog, expectedHash: ExpectedHash): Promise<SaveResult> {
    return this.file.save(catalog, expectedHash)
  }
}

export class XmlConfigurationRepository implements ConfigurationRepository {
  private readonly storage: ProjectStorage
  private readonly validator: XmlSchemaValidator

  constructor(storage: ProjectStorage, validator: XmlSchemaValidator) {
    this.storage = storage
    this.validator = validator
  }

  async listKeys(): Promise<Result<string[], FileProblem[]>> {
    const listed = await this.storage.list(CONFIGURATIONS_DIRECTORY)
    if (!listed.ok) {
      if (listed.error.code === 'not-found') return ok([])
      return err([fileError(CONFIGURATIONS_DIRECTORY, listed.error.message)])
    }
    return ok(
      listed.value
        .filter((entry) => entry.kind === 'file' && entry.name.endsWith('.xml'))
        .map((entry) => entry.name.slice(0, -'.xml'.length))
        .sort((a, b) => a.localeCompare(b))
    )
  }

  async load(key: string): Promise<Result<LoadedFile<Configuration>, FileProblem[]>> {
    const loaded = await this.fileFor(key).load()
    if (!loaded.ok) return loaded
    if (loaded.value === null) return err([fileError(this.pathFor(key), 'O arquivo não existe.')])
    return ok(loaded.value)
  }

  save(key: string, configuration: Configuration, expectedHash: ExpectedHash): Promise<SaveResult> {
    return this.fileFor(key).save(configuration, expectedHash)
  }

  private fileFor(key: string): XmlDocumentFile<Configuration> {
    return new XmlDocumentFile(this.storage, this.validator, this.pathFor(key), configurationFormat)
  }

  private pathFor(key: string): string {
    return `${CONFIGURATIONS_DIRECTORY}/${key}.xml`
  }
}
```

```bash
rm src/renderer/src/infrastructure/.gitkeep
```

- [ ] **Passo 9: Tipos e lint**

```bash
npm run format && npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 10: Verificar ida e volta e arquivos quebrados com os casos de uso reais**

O script roda `OpenProject` e `SaveProject` de verdade, trocando só os adapters de Electron por versões em Node (disco com `fs`, XSD com `xmllint-wasm`, pasta fixa).

Crie `.checks/node-adapters.ts`:

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

Crie `.checks/roundtrip-check.ts`:

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
import { FixedPicker, FsStorage, NodeXsdValidator } from './node-adapters'

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
    open: new OpenProject({ picker: new FixedPicker(root), ...repos }),
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
    conflict.problems.map((p) => `${p.file}: ${p.message}`).join(' | ')
  )
  // restaura e regrava de verdade
  for (const f of files) writeFileSync(join(dir, f), readFileSync(join(example, f)))
  const saved = await save.execute(opened.session)
  console.log('problemas ao salvar:', saved.problems.length)
  for (const f of files) {
    const same = Buffer.compare(readFileSync(join(example, f)), readFileSync(join(dir, f))) === 0
    console.log(same ? 'IDÊNTICO ' : 'DIFERENTE', f)
  }
  // segunda gravação usando os hashes novos: sem conflito
  const again = await save.execute(saved.session)
  console.log('segunda gravação, problemas:', again.problems.length)
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

Esperado, exatamente. O ponto principal: as três linhas `IDÊNTICO` e nenhum caso quebrado com `ABRIU`. As mensagens de XSD saem aqui com o prefixo do xmllint, que o validador da Tarefa 6 remove.

```
features: loja catalogo busca mobile pagamento pag_cartao pag_pix pag_boleto
avisos: 0 | assets: 6 | configs: loja-basica
conflitos esperados (3): model.xml: O arquivo foi alterado fora do app desde a última leitura. | assets.xml: O arquivo foi alterado fora do app desde a última leitura. | configurations/loja-basica.xml: O arquivo foi alterado fora do app desde a última leitura.
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

- [ ] **Passo 11: Commit**

```bash
git add -A
git commit -m "feat(xml): codecs determinísticos e repositórios dos arquivos do projeto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 6: Validação XSD no processo main

**Arquivos:**

- Criar: `src/main/env.d.ts`, `src/main/xml/schema-validator.ts`, `src/main/ipc/xml-handlers.ts`
- Substituir: `src/shared/ipc.ts`, `src/main/index.ts`, `src/preload/index.ts`

**Interfaces:**

- Consome: `ok()` e `fail()` de `src/main/ipc/results.ts` (Fase 0); os XSDs de `docs/schemas/`.
- Produz:
  - `window.mdd.validateXml(schema: XmlSchemaName, fileName: string, content: string): Promise<IpcResult<XmlSchemaIssue[]>>`
  - `XmlSchemaName = 'feature-model' | 'assets' | 'configuration'`, `XmlSchemaIssue { line?: number; message: string }`
  - `IpcChannel.validateXml = 'mdd:validate-xml'`

- [ ] **Passo 1: Substituir `src/shared/ipc.ts`**

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

export interface MddApi {
  openProjectFolder(): Promise<IpcResult<OpenedProject | null>>
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
  list: 'mdd:list',
  readText: 'mdd:read-text',
  writeText: 'mdd:write-text',
  validateXml: 'mdd:validate-xml'
} as const
```

- [ ] **Passo 2: Declarar o tipo das importações `?raw` em `src/main/env.d.ts`**

Os XSDs entram no bundle do main como texto (`import xsd from '...xsd?raw'`). O Vite faz a importação, mas os tipos do electron-vite não declaram `?raw`.

```ts
/** Importação de arquivos como texto pelo Vite (`import xsd from './x.xsd?raw'`). */
declare module '*?raw' {
  const content: string
  export default content
}
```

- [ ] **Passo 3: Criar `src/main/xml/schema-validator.ts`**

```ts
import { validateXML } from 'xmllint-wasm'
import type { XmlSchemaIssue, XmlSchemaName } from '../../shared/ipc'
import assetsXsd from '../../../docs/schemas/assets.xsd?raw'
import configurationXsd from '../../../docs/schemas/configuration.xsd?raw'
import featureModelXsd from '../../../docs/schemas/feature-model.xsd?raw'

/*
 * Etapas 1 e 2 da leitura (SPEC §5) com o libxml2 compilado para WebAssembly.
 * Roda no processo main porque o xmllint-wasm usa worker_threads do Node.
 * Os XSDs de docs/schemas/ entram no bundle como texto.
 */

const SCHEMAS: Record<XmlSchemaName, { fileName: string; contents: string }> = {
  'feature-model': { fileName: 'feature-model.xsd', contents: featureModelXsd },
  assets: { fileName: 'assets.xsd', contents: assetsXsd },
  configuration: { fileName: 'configuration.xsd', contents: configurationXsd }
}

const MESSAGE_PREFIX = /^(Schemas validity error|Schemas parser error|parser error)\s*:\s*/

export async function validateAgainstSchema(
  schema: XmlSchemaName,
  fileName: string,
  content: string
): Promise<XmlSchemaIssue[]> {
  const result = await validateXML({
    xml: [{ fileName, contents: content }],
    schema: [SCHEMAS[schema]]
  })
  if (result.valid) return []
  const issues = result.errors
    .map((error) => ({
      line: error.loc?.lineNumber,
      message: error.message.replace(MESSAGE_PREFIX, '').trim()
    }))
    .filter((issue) => issue.message !== '')
  // Em erros de sintaxe o xmllint repete o trecho do arquivo como linhas sem posição.
  const located = issues.filter((issue) => issue.line !== undefined)
  return located.length > 0 ? located : issues
}
```

- [ ] **Passo 4: Criar `src/main/ipc/xml-handlers.ts`**

```ts
import { ipcMain } from 'electron'
import {
  IpcChannel,
  type IpcResult,
  type XmlSchemaIssue,
  type XmlSchemaName
} from '../../shared/ipc'
import { validateAgainstSchema } from '../xml/schema-validator'
import { fail, ok } from './results'

export function registerXmlHandlers(): void {
  ipcMain.handle(
    IpcChannel.validateXml,
    async (
      _event,
      schema: XmlSchemaName,
      fileName: string,
      content: string
    ): Promise<IpcResult<XmlSchemaIssue[]>> => {
      try {
        return ok(await validateAgainstSchema(schema, fileName, content))
      } catch (error) {
        return fail('io', `Falha ao validar ${fileName}: ${(error as Error).message}`)
      }
    }
  )
}
```

- [ ] **Passo 5: Registrar os handlers em `src/main/index.ts`**

```ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ProjectRoot } from './project-root'
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
  registerProjectHandlers(projectRoot)
  registerFileHandlers(projectRoot)
  registerXmlHandlers()

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

- [ ] **Passo 6: Expor o canal no preload (`src/preload/index.ts`)**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type MddApi } from '../shared/ipc'

const api: MddApi = {
  openProjectFolder: () => ipcRenderer.invoke(IpcChannel.openProjectFolder),
  list: (relativeDir) => ipcRenderer.invoke(IpcChannel.list, relativeDir),
  readText: (relativePath) => ipcRenderer.invoke(IpcChannel.readText, relativePath),
  writeText: (relativePath, content, precondition) =>
    ipcRenderer.invoke(IpcChannel.writeText, relativePath, content, precondition),
  validateXml: (schema, fileName, content) =>
    ipcRenderer.invoke(IpcChannel.validateXml, schema, fileName, content)
}

contextBridge.exposeInMainWorld('mdd', api)
```

- [ ] **Passo 7: Tipos e lint**

```bash
npm run format && npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 8: Verificar o canal no app em execução**

Crie `.checks/cdp-eval.mjs`. Ele conecta no protocolo de depuração do Chromium e avalia expressões na janela:

```js
// Uso: node cdp-eval.mjs <porta> "<expressão JS>" ["<expressão>" ...]
// Espera a janela do Electron aparecer e imprime o resultado de cada expressão.
const [port, ...expressions] = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let page
for (let i = 0; i < 90 && !page; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
  } catch {}
  if (!page) await sleep(1000)
}
if (!page) {
  console.log('FALHA: nenhuma janela apareceu')
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let nextId = 1
const evaluate = (expression) =>
  new Promise((resolve) => {
    const id = nextId++
    ws.addEventListener('message', function onMessage(event) {
      const message = JSON.parse(event.data)
      if (message.id !== id) return
      ws.removeEventListener('message', onMessage)
      resolve(
        message.result.exceptionDetails
          ? `EXCEÇÃO: ${message.result.exceptionDetails.text}`
          : message.result.result.value
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

// Espera o React montar algo no #root (o Vite compila na primeira carga).
for (let i = 0; i < 30; i++) {
  if (await evaluate("document.getElementById('root')?.childElementCount > 0")) break
  await sleep(1000)
}
console.log('url:', page.url)
for (const expression of expressions)
  console.log(`${expression}  =>`, JSON.stringify(await evaluate(expression)))
ws.close()
```

Em um terminal, deixe o app rodando com a porta de depuração:

```bash
npx electron-vite dev --remoteDebuggingPort 9333
```

Em outro terminal:

```bash
node .checks/cdp-eval.mjs 9333 \
  "window.mdd.validateXml('configuration','ok.xml','<configuration xmlns=\"urn:mdd:configuration\" schemaVersion=\"1\" name=\"x\"/>')" \
  "window.mdd.validateXml('configuration','ruim.xml','<configuration xmlns=\"urn:mdd:configuration\" schemaVersion=\"2\" name=\"x\"/>')" \
  "window.mdd.validateXml('feature-model','quebrado.xml','<featureModel')"
```

Esperado:

- a primeira chamada devolve `{"ok":true,"value":[]}`;
- a segunda, um problema na linha 1 que termina em `does not match the fixed value constraint '1'.`, **sem** o prefixo `Schemas validity error :`;
- a terceira, um único problema na linha 1: `Couldn't find end of Start Tag featureModel line 1`.

Feche o app.

- [ ] **Passo 9: Commit**

```bash
git add -A
git commit -m "feat(ipc): validação XSD com xmllint-wasm no processo main

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 7: Adapters Electron e interface provisória

**Arquivos:**

- Criar: `src/renderer/src/infrastructure/electron/electron-project-storage.ts`, `electron-project-folder-picker.ts`, `electron-xml-schema-validator.ts`; `src/renderer/src/ui/stores/project-store.ts`, `project-store-context.ts`; `src/renderer/src/ui/components/ProblemList.tsx`; `src/renderer/src/ui/screens/start/StartScreen.tsx`; `src/renderer/src/ui/screens/project/FeatureTree.tsx`, `ProjectScreen.tsx`; `src/renderer/src/ui/app/composition-root.ts`
- Substituir: `src/renderer/src/ui/app/App.tsx` (a tela da Fase 0 sai)
- Modificar: `package.json`

**Interfaces:**

- Consome: ports e casos de uso (Tarefa 4), repositórios XML (Tarefa 5), `window.mdd` (Tarefa 6).
- Produz:
  - `ElectronProjectStorage`, `ElectronProjectFolderPicker`, `ElectronXmlSchemaValidator`
  - `createProjectStore(services: ProjectStoreServices): ProjectStore`, `ProjectState` (`session`, `busy`, `problems`, `warnings`, `lastSavedAt`, `open()`, `save()`, `close()`)
  - `ProjectStoreContext`, `useProjectStore(selector)`
  - `createAppStore(): ProjectStore` (composition root)

- [ ] **Passo 1: Instalar o Zustand**

```bash
npm install zustand
```

- [ ] **Passo 2: Criar os adapters sobre `window.mdd`**

`src/renderer/src/infrastructure/electron/electron-project-storage.ts`:

```ts
import type {
  ProjectStorage,
  StorageEntry,
  StorageError,
  StoredText,
  WritePrecondition
} from '@/application/ports/project-storage'
import { ok, type Result } from '@/domain/shared/result'

/** `ProjectStorage` sobre a API `window.mdd` do preload (SPEC §6.3). */
export class ElectronProjectStorage implements ProjectStorage {
  readText(path: string): Promise<Result<StoredText, StorageError>> {
    return window.mdd.readText(path)
  }

  async writeText(
    path: string,
    content: string,
    precondition: WritePrecondition
  ): Promise<Result<string, StorageError>> {
    const written = await window.mdd.writeText(path, content, precondition)
    return written.ok ? ok(written.value.hash) : written
  }

  list(directory: string): Promise<Result<StorageEntry[], StorageError>> {
    return window.mdd.list(directory)
  }
}
```

`src/renderer/src/infrastructure/electron/electron-project-folder-picker.ts`:

```ts
import type { PickedFolder, ProjectFolderPicker } from '@/application/ports/project-folder-picker'
import type { StorageError } from '@/application/ports/project-storage'
import type { Result } from '@/domain/shared/result'

/** Diálogo nativo de pasta; o processo main passa a usar a pasta escolhida como raiz. */
export class ElectronProjectFolderPicker implements ProjectFolderPicker {
  pick(): Promise<Result<PickedFolder | null, StorageError>> {
    return window.mdd.openProjectFolder()
  }
}
```

`src/renderer/src/infrastructure/electron/electron-xml-schema-validator.ts`:

```ts
import type {
  XmlSchema,
  XmlSchemaIssue,
  XmlSchemaValidator
} from '@/application/ports/xml-schema-validator'

/** Validação XSD feita no processo main (xmllint-wasm), chamada por IPC. */
export class ElectronXmlSchemaValidator implements XmlSchemaValidator {
  async validate(schema: XmlSchema, fileName: string, content: string): Promise<XmlSchemaIssue[]> {
    const result = await window.mdd.validateXml(schema, fileName, content)
    return result.ok ? result.value : [{ message: result.error.message }]
  }
}
```

- [ ] **Passo 3: Criar a store e o contexto**

`src/renderer/src/ui/stores/project-store.ts`:

```ts
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { FileProblem } from '@/application/file-problem'
import type { ProjectSession } from '@/application/project-session'
import type { OpenProjectResult } from '@/application/use-cases/open-project'
import type { SaveProjectResult } from '@/application/use-cases/save-project'

/** Casos de uso de que a store precisa; a composition root entrega as implementações. */
export interface ProjectStoreServices {
  readonly openProject: { execute(): Promise<OpenProjectResult> }
  readonly saveProject: { execute(session: ProjectSession): Promise<SaveProjectResult> }
}

export interface ProjectState {
  readonly session: ProjectSession | null
  readonly busy: boolean
  /** Erros da última abertura ou gravação. */
  readonly problems: readonly FileProblem[]
  /** Avisos do projeto aberto; não impedem nada. */
  readonly warnings: readonly FileProblem[]
  readonly lastSavedAt: Date | null
  open(): Promise<void>
  save(): Promise<void>
  close(): void
}

export type ProjectStore = StoreApi<ProjectState>

/** Estado de tela do projeto aberto. As regras ficam nos casos de uso, não aqui. */
export function createProjectStore(services: ProjectStoreServices): ProjectStore {
  return createStore<ProjectState>()((set, get) => ({
    session: null,
    busy: false,
    problems: [],
    warnings: [],
    lastSavedAt: null,

    async open() {
      set({ busy: true, problems: [] })
      const result = await services.openProject.execute()
      switch (result.status) {
        case 'cancelled':
          set({ busy: false })
          return
        case 'failed':
          set({ busy: false, problems: result.problems })
          return
        case 'opened':
          set({
            busy: false,
            session: result.session,
            warnings: result.warnings,
            lastSavedAt: null
          })
          return
      }
    },

    async save() {
      const { session } = get()
      if (session === null) return
      set({ busy: true, problems: [] })
      const result = await services.saveProject.execute(session)
      set({
        busy: false,
        session: result.session,
        problems: result.problems,
        lastSavedAt: result.problems.length === 0 ? new Date() : get().lastSavedAt
      })
    },

    close() {
      set({ session: null, problems: [], warnings: [], lastSavedAt: null })
    }
  }))
}
```

`src/renderer/src/ui/stores/project-store-context.ts`:

```ts
import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { ProjectState, ProjectStore } from './project-store'

/** A composition root (ui/app) fornece a store; as telas só a consomem. */
export const ProjectStoreContext = createContext<ProjectStore | null>(null)

export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  const store = useContext(ProjectStoreContext)
  if (store === null) throw new Error('ProjectStoreContext não foi fornecido.')
  return useStore(store, selector)
}
```

- [ ] **Passo 4: Criar `src/renderer/src/ui/components/ProblemList.tsx`**

```tsx
import type { FileProblem } from '@/application/file-problem'

interface ProblemListProps {
  readonly title: string
  readonly tone: 'error' | 'warning'
  readonly problems: readonly FileProblem[]
}

/** Lista de problemas no formato "arquivo:linha [elemento] mensagem" (SPEC §5). */
export function ProblemList({ title, tone, problems }: ProblemListProps): React.JSX.Element | null {
  if (problems.length === 0) return null
  const border = tone === 'error' ? 'border-destructive/50' : 'border-amber-500/50'
  return (
    <section className={`rounded-md border ${border} p-4`}>
      <h2 className="font-medium">{title}</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {problems.map((problem, index) => (
          <li key={index}>
            <span className="font-mono text-muted-foreground">{locationOf(problem)}</span>{' '}
            {problem.message}
          </li>
        ))}
      </ul>
    </section>
  )
}

function locationOf(problem: FileProblem): string {
  const line = problem.line !== undefined ? `:${problem.line}` : ''
  const subject = problem.subject !== undefined ? ` [${problem.subject}]` : ''
  return `${problem.file}${line}${subject}`
}
```

- [ ] **Passo 5: Criar as telas**

`src/renderer/src/ui/screens/start/StartScreen.tsx`:

```tsx
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
import { useProjectStore } from '@/ui/stores/project-store-context'

export function StartScreen(): React.JSX.Element {
  const busy = useProjectStore((state) => state.busy)
  const problems = useProjectStore((state) => state.problems)
  const open = useProjectStore((state) => state.open)

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-10">
      <header>
        <h1 className="text-3xl font-semibold">mdd</h1>
        <p className="text-muted-foreground">
          Linhas de produto: Feature Models, configurações e documentação.
        </p>
      </header>
      <Button className="self-start" disabled={busy} onClick={() => void open()}>
        {busy ? 'Abrindo…' : 'Abrir projeto'}
      </Button>
      <ProblemList title="O projeto não pôde ser aberto" tone="error" problems={problems} />
    </main>
  )
}
```

`src/renderer/src/ui/screens/project/FeatureTree.tsx`:

```tsx
import type { Attribute, Feature, Group } from '@/domain/feature-model/feature-model'

/**
 * Visualização provisória do modelo em lista (Fase 1). O diagrama chega na Fase 2.
 * ● obrigatória, ○ opcional; membros de grupo aparecem sob o rótulo do grupo.
 */
export function FeatureTree({ root }: { readonly root: Feature }): React.JSX.Element {
  return (
    <ul className="space-y-1 text-sm">
      <FeatureItem feature={root} />
    </ul>
  )
}

function FeatureItem({ feature }: { readonly feature: Feature }): React.JSX.Element {
  return (
    <li>
      <div className="flex flex-wrap items-baseline gap-2">
        <span aria-hidden className="w-3 text-center">
          {feature.variability === 'mandatory'
            ? '●'
            : feature.variability === 'optional'
              ? '○'
              : ''}
        </span>
        <span className="font-medium">{feature.name}</span>
        <code className="text-xs text-muted-foreground">{feature.id}</code>
        {feature.attributes.map((attribute) => (
          <span key={attribute.id} className="rounded bg-muted px-1.5 text-xs">
            {describeAttribute(attribute)}
          </span>
        ))}
      </div>
      {feature.children.length > 0 && (
        <ul className="ml-5 space-y-1 border-l pl-3">
          {feature.children.map((child, index) =>
            child.kind === 'feature' ? (
              <FeatureItem key={child.feature.id} feature={child.feature} />
            ) : (
              <li key={`group-${index}`}>
                <span className="text-xs uppercase text-muted-foreground">
                  grupo {describeGroup(child.group)}
                </span>
                <ul className="ml-2 space-y-1">
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

function describeGroup(group: Group): string {
  if (group.min === 1 && group.max === 1) return 'alternative'
  if (group.min === 1 && group.max === '*') return 'or'
  return `[${group.min}..${group.max}]`
}

function describeAttribute(attribute: Attribute): string {
  const value = attribute.defaultValue !== undefined ? ` = ${attribute.defaultValue}` : ''
  const fixed = attribute.configurable ? '' : ' (fixo)'
  return `${attribute.name}: ${attribute.type}${value}${fixed}`
}
```

`src/renderer/src/ui/screens/project/ProjectScreen.tsx`:

```tsx
import type { ProjectSession } from '@/application/project-session'
import { printExpression } from '@/domain/expression/printer'
import { Button } from '@/ui/components/ui/button'
import { ProblemList } from '@/ui/components/ProblemList'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { FeatureTree } from './FeatureTree'

export function ProjectScreen({
  session
}: {
  readonly session: ProjectSession
}): React.JSX.Element {
  const busy = useProjectStore((state) => state.busy)
  const problems = useProjectStore((state) => state.problems)
  const warnings = useProjectStore((state) => state.warnings)
  const lastSavedAt = useProjectStore((state) => state.lastSavedAt)
  const save = useProjectStore((state) => state.save)
  const close = useProjectStore((state) => state.close)
  const { model, assets, configurations } = session.project

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <div className="flex-1">
          <h1 className="font-semibold">{model.name}</h1>
          <p className="text-xs text-muted-foreground">{session.folder.rootPath}</p>
        </div>
        {lastSavedAt !== null && (
          <span className="text-xs text-muted-foreground">
            Salvo às {lastSavedAt.toLocaleTimeString('pt-BR')}
          </span>
        )}
        <Button variant="outline" onClick={close}>
          Fechar
        </Button>
        <Button disabled={busy} onClick={() => void save()}>
          Salvar
        </Button>
      </header>

      <div className="flex-1 space-y-8 overflow-auto p-6">
        <ProblemList title="Não foi possível salvar" tone="error" problems={problems} />
        <ProblemList title="Avisos" tone="warning" problems={warnings} />

        <Section title="Features">
          <FeatureTree root={model.root} />
        </Section>

        <Section title={`Restrições (${model.constraints.length})`}>
          <ul className="space-y-1 text-sm">
            {model.constraints.map((constraint) => (
              <li key={constraint.id}>
                <code>{printExpression(constraint.expression)}</code>
                {constraint.description && (
                  <span className="text-muted-foreground"> — {constraint.description}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={`Assets (${assets.assets.length})`}>
          <ul className="space-y-1 text-sm">
            {assets.assets.map((asset) => (
              <li key={asset.id}>
                <code>{asset.path}</code> → {asset.anchor}
                {asset.condition && (
                  <span className="text-muted-foreground">
                    {' '}
                    se {printExpression(asset.condition)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={`Configurações (${configurations.length})`}>
          <ul className="space-y-1 text-sm">
            {configurations.map(({ key, configuration }) => (
              <li key={key}>
                {configuration.name}{' '}
                <span className="text-muted-foreground">
                  ({key}.xml, {configuration.decisions.length} decisões)
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </main>
  )
}

function Section({
  title,
  children
}: {
  readonly title: string
  readonly children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}
```

- [ ] **Passo 6: Criar a composition root e trocar o `App.tsx`**

`src/renderer/src/ui/app/composition-root.ts`:

```ts
import { OpenProject } from '@/application/use-cases/open-project'
import { SaveProject } from '@/application/use-cases/save-project'
import { ElectronProjectFolderPicker } from '@/infrastructure/electron/electron-project-folder-picker'
import { ElectronProjectStorage } from '@/infrastructure/electron/electron-project-storage'
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
    openProject: new OpenProject({ picker: new ElectronProjectFolderPicker(), ...repositories }),
    saveProject: new SaveProject(repositories)
  })
}
```

`src/renderer/src/ui/app/App.tsx`:

```tsx
import { ProjectScreen } from '@/ui/screens/project/ProjectScreen'
import { StartScreen } from '@/ui/screens/start/StartScreen'
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
  return session === null ? <StartScreen /> : <ProjectScreen session={session} />
}
```

- [ ] **Passo 7: Tipos, lint e build**

```bash
npm run format && npm run typecheck && npm run lint && npx electron-vite build
```

Esperado: sem erros; o build termina com três `✓ built in ...`.

- [ ] **Passo 8: Verificar a tela inicial**

Com `npx electron-vite dev --remoteDebuggingPort 9333` rodando:

```bash
node .checks/cdp-eval.mjs 9333 "document.title" "document.querySelector('main')?.innerText.replace(/\s+/g,' ')"
```

Esperado: `"mdd"` e `"mdd Linhas de produto: Feature Models, configurações e documentação. Abrir projeto"`.

- [ ] **Passo 9: Verificação manual do fluxo completo (pede o diálogo nativo)**

No app aberto por `npm run dev`:

1. Clique em **Abrir projeto** e escolha `docs/examples/loja-online`. Aparece "Loja Online" com:
   - a árvore com as 8 features, com `●`/`○` e o grupo `or` em Pagamento;
   - os atributos "Versão: string = 1.0 (fixo)", "Máx. resultados: number = 50" e "Plataforma: enum";
   - a restrição `pag_pix implies mobile — PIX exige app mobile`;
   - 6 assets, incluindo "`docs/busca/busca-app.xml` → busca se busca and mobile";
   - a configuração "Loja Básica (loja-basica.xml, 4 decisões)".
2. Clique em **Salvar**. Aparece "Salvo às …", e `git status --short docs/examples` não mostra nenhuma alteração.
3. Edite `docs/examples/loja-online/model.xml` num editor de texto (acrescente um espaço no fim da linha 2) e salve. No app, clique em **Salvar**: aparece "Não foi possível salvar" com `model.xml O arquivo foi alterado fora do app desde a última leitura.` Desfaça a edição no editor.
4. Clique em **Fechar** e volte à tela inicial.

- [ ] **Passo 10: Commit**

```bash
git add -A
git commit -m "feat(ui): abrir e salvar projeto com visualização provisória em lista

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 8: Spec atualizada e aceitação da fase

**Arquivos:**

- Modificar: `docs/SPEC.md` (§5, §6.1, §6.2, §6.3)

**Interfaces:**

- Consome: tudo das Tarefas 1–7.
- Produz: a spec descrevendo o que foi construído.

- [ ] **Passo 1: Atualizar a leitura em três etapas (SPEC §5)**

Troque as linhas

```markdown
1. XML bem-formado (`DOMParser`) → erro com arquivo, linha e coluna.
2. Conformidade com o XSD (`xmllint-wasm`) → erro com arquivo e linha.
3. Invariantes do domínio (§4) → erro com arquivo e ID do elemento.
```

por

```markdown
1. XML bem-formado → erro com arquivo e linha.
2. Conformidade com o XSD → erro com arquivo e linha.
3. Invariantes do domínio (§4) → erro com arquivo e ID do elemento.

As etapas 1 e 2 são feitas juntas pelo `xmllint-wasm` no processo main (canal `validateXml`). A etapa 3 roda no renderer, depois que o codec converte o XML com `@xmldom/xmldom`; erros de sintaxe em expressões também informam a linha.
```

- [ ] **Passo 2: Atualizar as pastas (SPEC §6.1)**

Troque

```
  main/                    processo main do Electron: janela, IPC, disco, shell, diálogos
```

por

```
  main/                    processo main do Electron: janela, IPC, disco, shell, diálogos, validação XSD
```

e troque

```
      xml/                 codecs por arquivo, XmlWriter determinístico, validador xmllint-wasm
```

por

```
      xml/                 codecs por arquivo, escritor determinístico, leitura com @xmldom/xmldom
```

- [ ] **Passo 3: Atualizar os ports (SPEC §6.2)**

Na tabela, troque a linha de `FileDialogs` por estas duas linhas:

```markdown
| `ProjectFolderPicker` | Escolher a pasta do projeto. A escolha de um arquivo dentro do projeto entra na Fase 4, como port próprio. | `ElectronProjectFolderPicker` |
| `XmlSchemaValidator` | Etapas 1 e 2 da leitura (§5): XML bem-formado e conforme o XSD. | `ElectronXmlSchemaValidator` (IPC → `xmllint-wasm` no main) |
```

- [ ] **Passo 4: Atualizar os canais (SPEC §6.3)**

Depois da linha `  - **Arquivos:** ...`, acrescente:

```markdown
- **XML:** `validateXml` (etapas 1 e 2 da leitura, §5)
```

- [ ] **Passo 5: Formatar e commitar**

```bash
npm run format
git add -A
git commit -m "docs: spec reflete a validação XSD no main e os ports da Fase 1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Passo 6: Verificar o app empacotado**

```bash
npm run build:win
```

Rode `dist/win-unpacked/mdd.exe --remote-debugging-port=9334` e, em outro terminal:

```bash
node .checks/cdp-eval.mjs 9334 "window.mdd.validateXml('configuration','ok.xml','<configuration xmlns=\"urn:mdd:configuration\" schemaVersion=\"1\" name=\"x\"/>')"
```

Esperado: `{"ok":true,"value":[]}`. Isso prova que o `xmllint-wasm` (worker + WASM) funciona de dentro do `app.asar`, sem `asarUnpack`. Feche o app.

- [ ] **Passo 7: Aceitação manual com arquivos quebrados**

No `dist/win-unpacked/mdd.exe`, abra cópias do exemplo com um erro cada e confira a mensagem:

```bash
for caso in duplicado hifen max0; do rm -rf "/tmp/loja-$caso"; cp -r docs/examples/loja-online "/tmp/loja-$caso"; done
sed -i 's/id="pag_boleto"/id="pag_pix"/' /tmp/loja-duplicado/model.xml
sed -i 's/id="pag_boleto"/id="pag-boleto"/' /tmp/loja-hifen/model.xml
sed -i 's/max="\*"/max="0"/' /tmp/loja-max0/model.xml
cygpath -w /tmp
```

A última linha mostra onde fica `/tmp` no Windows. Abra cada pasta `loja-*` pelo app. Esperado: "O projeto não pôde ser aberto" com

- `loja-duplicado`: `model.xml:21` … `Duplicate key-sequence ['pag_pix'] …`
- `loja-hifen`: `model.xml:21` … `The value 'pag-boleto' is not accepted by the pattern '[a-z][a-z0-9_]*'.`
- `loja-max0`: `model.xml:18` … `'0' is not a valid value of the union type …GroupMax'.`

---

## Aceitação da Fase 1 (SPEC §9)

- [ ] Abrir o exemplo mostra a árvore (Tarefa 7, Passo 9).
- [ ] Salvar sem alterações gera arquivos idênticos byte a byte (Tarefa 5, Passo 10; Tarefa 7, Passo 9).
- [ ] ID duplicado, ID com hífen e `max="0"` geram erro com arquivo e linha (Tarefa 8, Passo 7).
