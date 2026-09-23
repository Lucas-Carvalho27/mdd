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
  { ignores: ['**/node_modules', '**/dist', '**/out', '.checks'] },
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
