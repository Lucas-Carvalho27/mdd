import type { AssetCatalog } from '@/domain/assets/asset-catalog'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import type { Result } from '@/domain/shared/result'

/** O que o editor altera: o modelo e o mapeamento de assets (a exclusão em cascata mexe nos dois). */
export interface EditorState {
  readonly model: FeatureModel
  readonly assets: AssetCatalog
}

export interface CommandOutcome {
  readonly state: EditorState
  /** Feature a destacar depois do comando, como a que acabou de ser criada. */
  readonly focusFeatureId?: string
}

/**
 * Uma edição como objeto (Command Pattern, ADR 0008): a interface cria o comando e o
 * histórico executa, guarda e desfaz. O comando não sabe desfazer a si mesmo: como o
 * estado é imutável, o histórico guarda o estado anterior e desfazer é voltar a ele.
 */
export interface EditorCommand {
  /** Texto curto para "Desfazer …", como `Excluir "Busca"`. */
  readonly label: string
  run(state: EditorState): Result<CommandOutcome, string>
}
