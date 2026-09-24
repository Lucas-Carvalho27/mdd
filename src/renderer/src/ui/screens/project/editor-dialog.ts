import type { FileProblem } from '@/application/file-problem'

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
  /** Depois do diálogo nativo: o arquivo já escolhido, dentro do projeto. */
  | { readonly kind: 'link-asset'; readonly path: string; readonly anchor: string }
  /** A pasta do produto da configuração `key` já existe: substituir? */
  | { readonly kind: 'replace-output'; readonly key: string; readonly folder: string }
  /** A geração falhou; `note` diz o que aconteceu com o disco. */
  | {
      readonly kind: 'generation-problems'
      readonly problems: readonly FileProblem[]
      readonly note: string
    }
  | null
