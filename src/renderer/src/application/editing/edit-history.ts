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
