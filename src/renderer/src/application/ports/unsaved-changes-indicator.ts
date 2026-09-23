/** Mostra fora da janela que há alterações não salvas (o main pergunta antes de fechar). */
export interface UnsavedChangesIndicator {
  set(unsaved: boolean): void
}
