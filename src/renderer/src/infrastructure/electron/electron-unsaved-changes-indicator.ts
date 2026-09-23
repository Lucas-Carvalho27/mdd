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
