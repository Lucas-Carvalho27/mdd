# Fase 0 — Fundação: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** esqueleto do app desktop pronto para receber o domínio: Electron + React + TypeScript com Tailwind e shadcn/ui, lint que impõe as camadas, IPC seguro preso à pasta do projeto e instalador Windows.

**Arquitetura:** electron-vite gera três bundles (main, preload, renderer). O main é fino e expõe só operações de arquivo dentro da pasta do projeto aberto. O preload publica essa API em `window.mdd` (contextIsolation + sandbox). O renderer é dividido em `domain / application / infrastructure / ui`, e o `eslint-plugin-boundaries` transforma import proibido em erro.

**Stack:** Node 24, npm 11, Electron 44, electron-vite 5, Vite 7, React 19, TypeScript 5.9, Tailwind CSS 4, shadcn/ui (estilo new-york, pacote `cn`), ESLint 9 + eslint-plugin-boundaries 7, Prettier 3, electron-builder 26.

**Spec:** [docs/SPEC.md](../../SPEC.md) (§6 Arquitetura, §9 Roadmap, linha da Fase 0). ADRs relevantes: [0001](../../adr/0001-desktop-com-electron.md), [0008](../../adr/0008-camadas-com-lint-sem-testes.md).

## Restrições globais

- **Sem testes automatizados** (decisão do projeto, ADR 0008). Cada tarefa verifica com `npm run typecheck`, `npm run lint`, build e checagem manual descrita no passo.
- Identificadores de código em **inglês**. Texto da interface, comentários e documentação em **português**.
- Formatação: Prettier do template (`singleQuote: true`, `semi: false`, `printWidth: 100`, `trailingComma: none`). Rode `npm run format` antes de cada commit.
- Alias do renderer: `@/` → `src/renderer/src/` (o shadcn exige esse formato; `@renderer/` não funciona com o CLI).
- Todo comando é executado na raiz do repositório `C:\Users\lucas\Desktop\mdd` com **Git Bash**.
- Commits terminam com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Mapa de arquivos

| Arquivo                                                     | Responsabilidade                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `package.json`, `electron.vite.config.ts`, `tsconfig*.json` | Build e tipos (três bundles, alias `@/`)                         |
| `electron-builder.yml`                                      | Empacotamento Windows (NSIS)                                     |
| `eslint.config.mjs`                                         | Regras de lint, incluindo as camadas                             |
| `components.json`                                           | Configuração do CLI do shadcn/ui                                 |
| `src/shared/ipc.ts`                                         | Contrato tipado da API `window.mdd` (canais, tipos, resultados)  |
| `src/main/index.ts`                                         | Janela com contextIsolation + sandbox; registra os handlers      |
| `src/main/project-root.ts`                                  | Guarda a pasta aberta; resolve caminhos relativos e recusa fugas |
| `src/main/ipc/results.ts`                                   | `ok()` e `fail()` para `IpcResult`                               |
| `src/main/ipc/project-handlers.ts`                          | Diálogo "abrir pasta do projeto"                                 |
| `src/main/ipc/file-handlers.ts`                             | `list`, `readText`, `writeText` (com pré-condição de hash)       |
| `src/preload/index.ts`, `src/preload/index.d.ts`            | Publica `window.mdd` e declara o tipo global                     |
| `src/renderer/src/{domain,application,infrastructure}/`     | Camadas vazias (preenchidas na Fase 1)                           |
| `src/renderer/src/ui/app/index.css`                         | Tailwind + tema do shadcn                                        |
| `src/renderer/src/ui/app/App.tsx`                           | Tela provisória que prova o IPC (substituída na Fase 1)          |
| `src/renderer/src/ui/components/ui/button.tsx`              | Gerado pelo shadcn                                               |
| `src/renderer/src/main.tsx`                                 | Ponto de entrada do renderer                                     |

---

### Tarefa 1: Scaffold do electron-vite

**Arquivos:**

- Criar (via template): `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `eslint.config.mjs`, `electron-builder.yml`, `.gitignore`, `.editorconfig`, `.prettierrc.yaml`, `.prettierignore`, `.vscode/`, `build/`, `resources/`, `src/`
- Substituir: `README.md`, `electron-builder.yml`

**Interfaces:**

- Consome: nada.
- Produz: scripts npm `dev`, `build`, `build:win`, `typecheck`, `lint`, `format`, usados por todas as tarefas seguintes.

- [ ] **Passo 1: Commitar a documentação que já existe**

```bash
git add CONTEXT.md docs
git commit -m "docs: spec, ADRs, schemas e projeto de exemplo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Passo 2: Gerar o template numa pasta temporária e mover para a raiz**

O CLI apaga o conteúdo da pasta de destino se ela não estiver vazia, por isso ele gera numa subpasta. O nome da subpasta precisa ser um nome de pacote npm válido (sem ponto no início); senão o CLI para e pergunta o nome.

```bash
npm create @quick-start/electron@latest mdd-scaffold -- --template react-ts --skip < /dev/null
rm mdd-scaffold/README.md
cp -r mdd-scaffold/. .
rm -rf mdd-scaffold
```

Esperado: `Scaffolding project in ...\mdd-scaffold... Done.` e a raiz agora tem `package.json`, `src/`, `build/`, `resources/`.

- [ ] **Passo 3: Ajustar o package.json**

```bash
npm pkg set name=mdd version=0.1.0 author=Lucas "description=Linhas de produto: Feature Models, configurações e geração de documentação"
npm pkg delete homepage scripts.build:mac scripts.build:linux
```

- [ ] **Passo 4: Instalar dependências e atualizar o Electron para a versão atual**

```bash
npm install
npm install -D electron@latest
npm pkg set "scripts.postinstall=install-electron && electron-builder install-app-deps"
npm run postinstall
```

O Electron 44 não baixa mais o binário no `npm install`, e o electron-vite 5 não dispara o download sozinho: ele falha com `Error: Electron uninstall`. O `install-electron` (binário do próprio pacote `electron`) baixa o executável, e colocá-lo no `postinstall` garante que um clone novo também funcione.

Esperado: `npm ls electron` mostra `electron@44.x`, e `node_modules/electron/path.txt` contém `electron.exe`.

- [ ] **Passo 5: Substituir `electron-builder.yml` (só Windows, nome mdd)**

```yaml
appId: com.mdd.app
productName: mdd
directories:
  buildResources: build
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!docs/**/*'
  - '!electron.vite.config.{js,ts,mjs,cjs}'
  - '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,components.json,CONTEXT.md,README.md}'
  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'
  - '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
asarUnpack:
  - 'resources/**'
win:
  executableName: mdd
nsis:
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
npmRebuild: false
```

- [ ] **Passo 6: Escrever `README.md`**

```markdown
# mdd

Ferramenta desktop para linhas de produto: modela Feature Models, configura produtos e gera a
documentação de cada produto a partir de fragmentos XML.

- Linguagem do domínio: [CONTEXT.md](CONTEXT.md)
- Especificação: [docs/SPEC.md](docs/SPEC.md)
- Decisões de arquitetura: [docs/adr/](docs/adr/)

## Desenvolvimento

    npm install
    npm run dev        # abre o app com recarga automática
    npm run lint       # inclui as regras de camada
    npm run typecheck
    npm run build:win  # gera o instalador em dist/
```

- [ ] **Passo 7: Verificar**

```bash
npm run typecheck && npm run lint
```

Esperado: os dois terminam sem erros. Depois rode `npm run dev`: abre uma janela com a página de demonstração do electron-vite. Feche a janela.

- [ ] **Passo 8: Commit**

```bash
npm run format
git add -A
git commit -m "chore: scaffold electron-vite com React e TypeScript

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: Tailwind CSS 4 e shadcn/ui

**Arquivos:**

- Modificar: `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.web.json`, `src/renderer/src/main.tsx`
- Criar: `components.json`, `src/renderer/src/ui/app/index.css`, `src/renderer/src/ui/app/App.tsx`
- Gerar (CLI): `src/renderer/src/ui/components/ui/button.tsx`
- Remover: `src/renderer/src/App.tsx`, `src/renderer/src/components/`, `src/renderer/src/assets/`

**Interfaces:**

- Consome: scripts da Tarefa 1.
- Produz: alias `@/` → `src/renderer/src/`; `Button` em `@/ui/components/ui/button`; comando `npx shadcn@latest add <componente> -y -o` para as próximas fases.

- [ ] **Passo 1: Instalar o Tailwind**

```bash
npm install -D tailwindcss @tailwindcss/vite tw-animate-css
```

- [ ] **Passo 2: Substituir `electron.vite.config.ts`**

```ts
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
```

- [ ] **Passo 3: Substituir `tsconfig.json` (o CLI do shadcn lê o alias daqui)**

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.node.json" }, { "path": "./tsconfig.web.json" }],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/renderer/src/*"] }
  }
}
```

- [ ] **Passo 4: Substituir `tsconfig.web.json`**

```json
{
  "extends": "@electron-toolkit/tsconfig/tsconfig.web.json",
  "include": [
    "src/renderer/src/env.d.ts",
    "src/renderer/src/**/*",
    "src/renderer/src/**/*.tsx",
    "src/preload/*.d.ts"
  ],
  "compilerOptions": {
    "composite": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/renderer/src/*"]
    }
  }
}
```

- [ ] **Passo 5: Remover a demonstração do template**

```bash
rm -rf src/renderer/src/App.tsx src/renderer/src/components src/renderer/src/assets
```

- [ ] **Passo 6: Criar `components.json`**

`"utils": "cn"` é o padrão atual do shadcn: os componentes importam `cn` do pacote oficial [`cn`](https://github.com/shadcn-ui/cn) em vez de um `lib/utils.ts` local.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/src/ui/app/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/ui/components",
    "ui": "@/ui/components/ui",
    "utils": "cn",
    "lib": "@/ui/lib",
    "hooks": "@/ui/hooks"
  }
}
```

- [ ] **Passo 7: Criar `src/renderer/src/ui/app/index.css`**

O `shadcn init` não reconhece a estrutura do electron-vite, então o tema entra manualmente.

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Passo 8: Gerar o `Button` pelo CLI**

```bash
npx shadcn@latest add button -y -o < /dev/null
npm install class-variance-authority
```

O CLI instala `cn` e `radix-ui`, mas não o `class-variance-authority`, que o `button.tsx` importa. Por isso a instalação explícita.

Esperado: `Created 1 file: src\renderer\src\ui\components\ui\button.tsx`, e `npm ls cn radix-ui class-variance-authority --depth=0` lista os três.

- [ ] **Passo 9: Criar `src/renderer/src/ui/app/App.tsx` (provisório)**

```tsx
import { Button } from '@/ui/components/ui/button'

export function App(): React.JSX.Element {
  return (
    <main className="flex h-screen flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">mdd</h1>
      <Button className="self-start">Abrir pasta de projeto</Button>
    </main>
  )
}
```

- [ ] **Passo 10: Substituir `src/renderer/src/main.tsx`**

```tsx
import './ui/app/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Passo 11: Verificar**

```bash
npm run format && npm run typecheck && npx electron-vite build
```

Esperado: typecheck sem erros; o build termina com três `✓ built in ...`. Depois rode `npm run dev`: a janela mostra o título "mdd" e um botão preto com cantos arredondados (estilo shadcn). Feche a janela.

- [ ] **Passo 12: Commit**

```bash
git add -A
git commit -m "feat(ui): Tailwind CSS 4 e shadcn/ui com alias @/

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Camadas e lint de dependências

**Arquivos:**

- Criar: `src/renderer/src/domain/.gitkeep`, `src/renderer/src/application/.gitkeep`, `src/renderer/src/infrastructure/.gitkeep`
- Substituir: `eslint.config.mjs`

**Interfaces:**

- Consome: alias `@/` da Tarefa 2.
- Produz: tipos de elemento `main`, `preload`, `shared`, `domain`, `application`, `infrastructure`, `composition` (`ui/app/`) e `ui`. As regras valem para todas as fases seguintes (SPEC §6.1).

- [ ] **Passo 1: Instalar o plugin e o resolvedor de aliases**

```bash
npm install -D eslint-plugin-boundaries eslint-import-resolver-typescript
```

- [ ] **Passo 2: Criar as pastas das camadas**

```bash
mkdir -p src/renderer/src/domain src/renderer/src/application src/renderer/src/infrastructure
touch src/renderer/src/domain/.gitkeep src/renderer/src/application/.gitkeep src/renderer/src/infrastructure/.gitkeep
```

- [ ] **Passo 3: Substituir `eslint.config.mjs`**

```js
import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import boundaries from 'eslint-plugin-boundaries'

// Camadas (docs/SPEC.md §6.1, ADR 0008). As dependências só apontam para dentro.
// A ordem importa: ui/app (composition) precisa vir antes de ui.
const layers = [
  { type: 'main', pattern: 'src/main/**', partialMatch: false },
  { type: 'preload', pattern: 'src/preload/**', partialMatch: false },
  { type: 'shared', pattern: 'src/shared/**', partialMatch: false },
  { type: 'domain', pattern: 'src/renderer/src/domain/**', partialMatch: false },
  { type: 'application', pattern: 'src/renderer/src/application/**', partialMatch: false },
  { type: 'infrastructure', pattern: 'src/renderer/src/infrastructure/**', partialMatch: false },
  { type: 'composition', pattern: 'src/renderer/src/ui/app/**', partialMatch: false },
  { type: 'ui', pattern: 'src/renderer/src/ui/**', partialMatch: false }
]

const allow = (from, to) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: { anyOf: to } } } }
})

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { project: 'tsconfig.json' }
      },
      'boundaries/elements': layers
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          policies: [
            allow('domain', ['domain']),
            allow('application', ['application', 'domain']),
            allow('infrastructure', ['infrastructure', 'application', 'domain', 'shared']),
            allow('ui', ['ui', 'application', 'domain']),
            allow('composition', [
              'composition',
              'ui',
              'infrastructure',
              'application',
              'domain',
              'shared'
            ]),
            allow('main', ['main', 'shared']),
            allow('preload', ['preload', 'shared']),
            allow('shared', ['shared']),
            // Bibliotecas externas e módulos do Node: liberados para todos, menos o domínio,
            // que é TypeScript puro.
            {
              from: { element: { type: '!domain' } },
              allow: { to: { module: { origin: 'external' } } }
            },
            {
              from: { element: { type: '!domain' } },
              allow: { to: { module: { origin: 'core' } } }
            }
          ]
        }
      ]
    }
  },
  {
    // Componentes gerados pelo shadcn exportam variantes junto dos componentes.
    files: ['src/renderer/src/ui/components/ui/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  eslintConfigPrettier
)
```

- [ ] **Passo 4: Provar que a regra barra violações (arquivo descartável)**

Crie `src/renderer/src/domain/probe.ts`:

```ts
import { useState } from 'react'
import { Button } from '@/ui/components/ui/button'

export const probe = [useState, Button]
```

```bash
npx eslint src/renderer/src/domain
```

Esperado: **2 erros** `boundaries/dependencies`, um para `react` ("module with origin \"external\"") e outro para `@/ui/...` ("elements of type \"ui\"").

- [ ] **Passo 5: Remover a sonda e verificar o projeto inteiro**

```bash
rm src/renderer/src/domain/probe.ts
npm run format && npm run lint && npm run typecheck
```

Esperado: lint e typecheck sem erros.

- [ ] **Passo 6: Commit**

```bash
git add -A
git commit -m "chore(lint): impõe as camadas com eslint-plugin-boundaries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: IPC seguro preso à pasta do projeto

**Arquivos:**

- Criar: `src/shared/ipc.ts`, `src/main/project-root.ts`, `src/main/ipc/results.ts`, `src/main/ipc/project-handlers.ts`, `src/main/ipc/file-handlers.ts`
- Substituir: `src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`, `src/renderer/src/ui/app/App.tsx`
- Modificar: `tsconfig.node.json`, `tsconfig.web.json` (incluir `src/shared`)

**Interfaces:**

- Consome: camadas da Tarefa 3 (`composition` pode importar `shared`).
- Produz (usado pelo adapter `ElectronProjectStorage` na Fase 1):
  - `window.mdd: MddApi`
  - `openProjectFolder(): Promise<IpcResult<OpenedProject | null>>`
  - `list(relativeDir: string): Promise<IpcResult<DirectoryEntry[]>>`
  - `readText(relativePath: string): Promise<IpcResult<TextFile>>`
  - `writeText(relativePath: string, content: string, precondition: WritePrecondition): Promise<IpcResult<{ hash: string }>>`
  - `IpcResult<T> = { ok: true; value: T } | { ok: false; error: { code: IpcErrorCode; message: string } }`
  - `IpcErrorCode = 'no-project' | 'outside-project' | 'not-found' | 'changed-externally' | 'io'`

- [ ] **Passo 1: Remover o preload do toolkit (não vamos expor `electronAPI`)**

```bash
npm uninstall @electron-toolkit/preload
```

- [ ] **Passo 2: Incluir `src/shared` nos dois tsconfigs**

Em `tsconfig.node.json`, troque a linha `include` por:

```json
  "include": ["electron.vite.config.*", "src/main/**/*", "src/preload/**/*", "src/shared/**/*"],
```

Em `tsconfig.web.json`, troque a lista `include` por:

```json
  "include": [
    "src/renderer/src/env.d.ts",
    "src/renderer/src/**/*",
    "src/renderer/src/**/*.tsx",
    "src/preload/*.d.ts",
    "src/shared/**/*"
  ],
```

- [ ] **Passo 3: Criar `src/shared/ipc.ts`**

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

export interface MddApi {
  openProjectFolder(): Promise<IpcResult<OpenedProject | null>>
  list(relativeDir: string): Promise<IpcResult<DirectoryEntry[]>>
  readText(relativePath: string): Promise<IpcResult<TextFile>>
  writeText(
    relativePath: string,
    content: string,
    precondition: WritePrecondition
  ): Promise<IpcResult<{ hash: string }>>
}

export const IpcChannel = {
  openProjectFolder: 'mdd:open-project-folder',
  list: 'mdd:list',
  readText: 'mdd:read-text',
  writeText: 'mdd:write-text'
} as const
```

- [ ] **Passo 4: Criar `src/main/project-root.ts`**

```ts
import { isAbsolute, join, relative, resolve, sep } from 'path'

/**
 * Guarda a pasta do projeto aberto e resolve caminhos relativos a ela,
 * recusando qualquer caminho que escape da pasta.
 */
export class ProjectRoot {
  private rootPath: string | null = null

  open(rootPath: string): void {
    this.rootPath = resolve(rootPath)
  }

  get current(): string | null {
    return this.rootPath
  }

  /** Devolve o caminho absoluto, ou `null` se o caminho sair do projeto. */
  resolve(relativePath: string): string | null {
    if (this.rootPath === null) throw new Error('Nenhum projeto aberto.')
    if (isAbsolute(relativePath)) return null
    const absolute = resolve(join(this.rootPath, relativePath))
    const fromRoot = relative(this.rootPath, absolute)
    const escapes = fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)
    return escapes ? null : absolute
  }
}
```

- [ ] **Passo 5: Verificar o `ProjectRoot` isoladamente**

O Node 24 executa TypeScript direto (remoção de tipos), sem compilar:

```bash
node --input-type=module --no-warnings -e "
import { ProjectRoot } from './src/main/project-root.ts'
const r = new ProjectRoot(); r.open('C:/proj')
for (const p of ['model.xml', 'docs/a.xml', '.', '..algo.txt', 'docs/../model.xml', '../fora.txt', 'docs/../../fora.txt', 'C:/Windows/x', '/etc/passwd'])
  console.log(p.padEnd(22), '->', r.resolve(p))
"
```

Esperado: as cinco primeiras linhas mostram um caminho dentro de `C:\proj` (inclusive `..algo.txt` → `C:\proj\..algo.txt`) e as quatro últimas mostram `null`.

- [ ] **Passo 6: Criar `src/main/ipc/results.ts`**

```ts
import type { IpcErrorCode, IpcResult } from '../../shared/ipc'

export function ok<T>(value: T): IpcResult<T> {
  return { ok: true, value }
}

export function fail<T>(code: IpcErrorCode, message: string): IpcResult<T> {
  return { ok: false, error: { code, message } }
}
```

- [ ] **Passo 7: Criar `src/main/ipc/project-handlers.ts`**

```ts
import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { basename } from 'path'
import { IpcChannel, type IpcResult, type OpenedProject } from '../../shared/ipc'
import type { ProjectRoot } from '../project-root'
import { ok } from './results'

export function registerProjectHandlers(root: ProjectRoot): void {
  ipcMain.handle(
    IpcChannel.openProjectFolder,
    async (event): Promise<IpcResult<OpenedProject | null>> => {
      const options: OpenDialogOptions = {
        title: 'Abrir pasta do projeto',
        properties: ['openDirectory', 'createDirectory']
      }
      const window = BrowserWindow.fromWebContents(event.sender)
      const choice = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (choice.canceled || choice.filePaths.length === 0) return ok(null)

      const rootPath = choice.filePaths[0]
      root.open(rootPath)
      return ok({ rootPath, name: basename(rootPath) })
    }
  )
}
```

- [ ] **Passo 8: Criar `src/main/ipc/file-handlers.ts`**

```ts
import { createHash } from 'crypto'
import { ipcMain } from 'electron'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import {
  IpcChannel,
  type DirectoryEntry,
  type IpcResult,
  type TextFile,
  type WritePrecondition
} from '../../shared/ipc'
import type { ProjectRoot } from '../project-root'
import { fail, ok } from './results'

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/** Executa a operação num caminho do projeto, convertendo falhas em IpcResult. */
async function withinProject<T>(
  root: ProjectRoot,
  relativePath: string,
  operation: (absolutePath: string) => Promise<IpcResult<T>>
): Promise<IpcResult<T>> {
  if (root.current === null) return fail('no-project', 'Nenhum projeto aberto.')
  const absolutePath = root.resolve(relativePath)
  if (absolutePath === null) {
    return fail('outside-project', `O caminho "${relativePath}" fica fora do projeto.`)
  }
  try {
    return await operation(absolutePath)
  } catch (error) {
    if (isNotFound(error)) return fail('not-found', `"${relativePath}" não existe.`)
    return fail('io', `Erro ao acessar "${relativePath}": ${(error as Error).message}`)
  }
}

function violatesPrecondition(current: string | null, precondition: WritePrecondition): boolean {
  switch (precondition.kind) {
    case 'overwrite':
      return false
    case 'must-not-exist':
      return current !== null
    case 'hash':
      return current === null || sha256(current) !== precondition.expectedHash
  }
}

export function registerFileHandlers(root: ProjectRoot): void {
  ipcMain.handle(IpcChannel.list, (_event, relativeDir: string) =>
    withinProject<DirectoryEntry[]>(root, relativeDir, async (path) => {
      const entries = await readdir(path, { withFileTypes: true })
      return ok(
        entries
          .filter((entry) => entry.isFile() || entry.isDirectory())
          .map((entry) => ({ name: entry.name, kind: entry.isFile() ? 'file' : 'directory' }))
      )
    })
  )

  ipcMain.handle(IpcChannel.readText, (_event, relativePath: string) =>
    withinProject<TextFile>(root, relativePath, async (path) => {
      const content = await readFile(path, 'utf8')
      return ok({ content, hash: sha256(content) })
    })
  )

  ipcMain.handle(
    IpcChannel.writeText,
    (_event, relativePath: string, content: string, precondition: WritePrecondition) =>
      withinProject<{ hash: string }>(root, relativePath, async (path) => {
        if (violatesPrecondition(await readIfExists(path), precondition)) {
          return fail('changed-externally', `"${relativePath}" foi alterado fora do app.`)
        }
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, content, 'utf8')
        return ok({ hash: sha256(content) })
      })
  )
}
```

- [ ] **Passo 9: Substituir `src/main/index.ts`**

```ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ProjectRoot } from './project-root'
import { registerFileHandlers } from './ipc/file-handlers'
import { registerProjectHandlers } from './ipc/project-handlers'

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

- [ ] **Passo 10: Substituir `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type MddApi } from '../shared/ipc'

const api: MddApi = {
  openProjectFolder: () => ipcRenderer.invoke(IpcChannel.openProjectFolder),
  list: (relativeDir) => ipcRenderer.invoke(IpcChannel.list, relativeDir),
  readText: (relativePath) => ipcRenderer.invoke(IpcChannel.readText, relativePath),
  writeText: (relativePath, content, precondition) =>
    ipcRenderer.invoke(IpcChannel.writeText, relativePath, content, precondition)
}

contextBridge.exposeInMainWorld('mdd', api)
```

- [ ] **Passo 11: Substituir `src/preload/index.d.ts`**

```ts
import type { MddApi } from '../shared/ipc'

declare global {
  interface Window {
    mdd: MddApi
  }
}
```

- [ ] **Passo 12: Substituir `src/renderer/src/ui/app/App.tsx` pela tela que prova o IPC**

```tsx
import { useState } from 'react'
import type { DirectoryEntry, OpenedProject } from '../../../../shared/ipc'
import { Button } from '@/ui/components/ui/button'

/**
 * Tela provisória da Fase 0: prova que o IPC funciona de ponta a ponta.
 * É substituída pela tela inicial na Fase 1.
 */
export function App(): React.JSX.Element {
  const [project, setProject] = useState<OpenedProject | null>(null)
  const [entries, setEntries] = useState<DirectoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  async function openProject(): Promise<void> {
    setError(null)
    const opened = await window.mdd.openProjectFolder()
    if (!opened.ok) return setError(opened.error.message)
    if (opened.value === null) return
    setProject(opened.value)

    const listed = await window.mdd.list('.')
    if (!listed.ok) return setError(listed.error.message)
    setEntries(listed.value)

    const escape = await window.mdd.readText('../fora.txt')
    if (escape.ok) setError('ERRO: o main deixou ler fora do projeto!')
  }

  return (
    <main className="flex h-screen flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">mdd</h1>
      <Button className="self-start" onClick={openProject}>
        Abrir pasta de projeto
      </Button>
      {error && <p className="text-destructive">{error}</p>}
      {project && (
        <section>
          <h2 className="font-medium">{project.name}</h2>
          <p className="text-sm text-muted-foreground">{project.rootPath}</p>
          <ul className="mt-2 list-disc pl-6 text-sm">
            {entries.map((entry) => (
              <li key={entry.name}>
                {entry.name}
                {entry.kind === 'directory' ? '/' : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
```

- [ ] **Passo 13: Verificar tipos e lint**

```bash
npm run format && npm run typecheck && npm run lint
```

Esperado: sem erros.

- [ ] **Passo 14: Verificação manual no app**

Rode `npm run dev`, clique em **Abrir pasta de projeto** e escolha `docs/examples/loja-online`.

Esperado:

- aparece "loja-online", o caminho completo e a lista `assets.xml`, `configurations/`, `docs/`, `model.xml`;
- **nenhuma** mensagem vermelha (se aparecer "ERRO: o main deixou ler fora do projeto!", a trava falhou);
- cancelar o diálogo não muda nada.

Feche a janela.

- [ ] **Passo 15: Commit**

```bash
git add -A
git commit -m "feat(ipc): API window.mdd com contextIsolation, sandbox e trava na pasta do projeto

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: Instalador Windows

**Arquivos:**

- Nenhum arquivo novo; valida o `electron-builder.yml` da Tarefa 1 com o código das Tarefas 2–4.

**Interfaces:**

- Consome: `npm run build:win`.
- Produz: `dist/mdd-0.1.0-setup.exe` (ignorado pelo git).

- [ ] **Passo 1: Gerar o instalador**

```bash
npm run build:win
```

Esperado: o log mostra `building target=nsis file=dist\mdd-0.1.0-setup.exe` sem erro, e `dist/` contém `mdd-0.1.0-setup.exe` e `win-unpacked/mdd.exe`.

- [ ] **Passo 2: Verificar o app empacotado**

Execute `dist/win-unpacked/mdd.exe`, clique em **Abrir pasta de projeto** e escolha `docs/examples/loja-online`.

Esperado: o mesmo resultado do Passo 14 da Tarefa 4. Feche o app.

- [ ] **Passo 3: Confirmar que `dist/` e `out/` não entram no git**

```bash
git status --short
```

Esperado: nenhuma linha com `dist/` ou `out/` (já estão no `.gitignore` do template). Se não houver alterações, a fase está concluída sem novo commit.

---

## Aceitação da Fase 0 (SPEC §9)

- [ ] `npm run dev` abre a janela (Tarefa 2, Passo 11; Tarefa 4, Passo 14).
- [ ] Um import proibido (React dentro de `domain/`) gera erro de lint (Tarefa 3, Passo 4).
- [ ] `npm run build:win` gera o instalador (Tarefa 5).
- [ ] O IPC só enxerga a pasta do projeto aberto (Tarefa 4, Passos 5 e 14).
