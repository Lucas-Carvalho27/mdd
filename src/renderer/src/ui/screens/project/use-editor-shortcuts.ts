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

export interface ShortcutScope {
  /** Com um diálogo aberto, nenhum atalho vale: as teclas são do diálogo. */
  readonly enabled: boolean
  /** Desfazer e refazer: nas abas Modelo e Assets, que editam pelo histórico (SPEC §4.5). */
  readonly history: boolean
  /** Tab, Enter, F2, Delete e Alt+↑/↓ editam a estrutura: só na aba Modelo. */
  readonly editing: boolean
}

/**
 * Atalhos da SPEC §7: Tab filha, Enter irmã, F2 renomear, Delete excluir, Alt+↑/↓ reordenar,
 * Ctrl+Z/Ctrl+Y desfazer/refazer, Ctrl+S salvar. Enquanto se digita num campo, só Ctrl+S vale.
 */
export function useEditorShortcuts(
  openDialog: (dialog: EditorDialog) => void,
  { enabled, history, editing }: ShortcutScope
): void {
  const store = useProjectStoreApi()

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent): void => {
      // A tecla já foi tratada por outro componente (por exemplo, Enter ou Tab num menu aberto).
      if (event.defaultPrevented) return
      const state = store.getState()
      const shortcut = shortcutFor(event)
      if (shortcut === undefined || state.session === null || state.conflicts.length > 0) return
      if (shortcut !== 'save' && isTyping(event.target, shortcut)) return
      const isHistory = shortcut === 'undo' || shortcut === 'redo'
      if (isHistory ? !history : shortcut !== 'save' && !editing) return

      if (shortcut === 'save' || isHistory) {
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
  }, [store, openDialog, enabled, history, editing])
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

/**
 * Num campo de texto, as teclas são do campo (inclusive o Ctrl+Z dele). Numa lista de opções
 * não há o que desfazer ali: Ctrl+Z e Ctrl+Y vão para o histórico, e as demais teclas ficam nela.
 */
function isTyping(target: EventTarget | null, shortcut: Shortcut): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName)) return true
  return target.tagName === 'SELECT' && shortcut !== 'undo' && shortcut !== 'redo'
}
