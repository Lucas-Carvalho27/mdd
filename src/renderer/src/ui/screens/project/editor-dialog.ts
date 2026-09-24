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
