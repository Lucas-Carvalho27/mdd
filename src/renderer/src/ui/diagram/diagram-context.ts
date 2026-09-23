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
