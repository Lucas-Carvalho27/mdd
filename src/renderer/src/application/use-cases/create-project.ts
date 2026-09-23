import { EMPTY_ASSET_CATALOG } from '@/domain/assets/asset-catalog'
import { createFeatureModel } from '@/domain/feature-model/new-model'
import { fileError, type FileProblem } from '../file-problem'
import type { ProjectFolderPicker } from '../ports/project-folder-picker'
import type { FeatureModelRepository } from '../ports/repositories'
import type { ProjectSession } from '../project-session'

export type CreateProjectResult =
  | { readonly status: 'cancelled' }
  | { readonly status: 'created'; readonly session: ProjectSession }
  | { readonly status: 'failed'; readonly problems: FileProblem[] }

export interface CreateProjectDependencies {
  readonly picker: ProjectFolderPicker
  readonly models: FeatureModelRepository
}

/**
 * Cria um projeto numa pasta escolhida pelo usuário (SPEC §7): grava um model.xml só com a
 * raiz. Recusa pastas que já têm um model.xml, para nunca sobrescrever um projeto.
 */
export class CreateProject {
  private readonly deps: CreateProjectDependencies

  constructor(deps: CreateProjectDependencies) {
    this.deps = deps
  }

  /** Sem `rootId`, o ID da raiz é gerado a partir do nome. */
  async execute(name: string, rootId?: string): Promise<CreateProjectResult> {
    const model = createFeatureModel(name, rootId)
    if (!model.ok) return { status: 'failed', problems: [fileError('model.xml', model.error)] }

    const picked = await this.deps.picker.pick()
    if (!picked.ok) return { status: 'failed', problems: [fileError('.', picked.error.message)] }
    if (picked.value === null) return { status: 'cancelled' }

    const saved = await this.deps.models.save(model.value, null)
    if (!saved.ok) {
      const problem =
        saved.error.kind === 'conflict'
          ? fileError('model.xml', 'Esta pasta já tem um projeto. Use "Abrir projeto".')
          : saved.error.problem
      return { status: 'failed', problems: [problem] }
    }

    return {
      status: 'created',
      session: {
        folder: picked.value,
        project: { model: model.value, assets: EMPTY_ASSET_CATALOG, configurations: [] },
        hashes: { model: saved.value, assets: null, configurations: {} }
      }
    }
  }
}
