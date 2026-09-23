import { referencesAnyFeature, referencesAttribute } from '@/domain/configuration/references'
import type { Project } from '@/domain/project/project'
import { deleteFeature } from '@/domain/project/feature-deletion'
import { err, ok, type Result } from '@/domain/shared/result'

/** O que o diálogo mostra antes de excluir uma feature (SPEC §4.5). */
export interface DeletionImpact {
  readonly removedFeatureIds: readonly string[]
  readonly removedConstraintIds: readonly string[]
  readonly unlinkedAssetIds: readonly string[]
  /** Nomes das configurações que vão abrir como desatualizadas; os arquivos não mudam agora. */
  readonly affectedConfigurations: readonly string[]
  readonly groupChange?: string
}

export function analyzeFeatureDeletion(
  project: Project,
  featureId: string
): Result<DeletionImpact, string> {
  const deletion = deleteFeature(project.model, project.assets, featureId)
  if (!deletion.ok) return err(deletion.error)
  const removed = new Set(deletion.value.removedFeatureIds)
  return ok({
    removedFeatureIds: deletion.value.removedFeatureIds,
    removedConstraintIds: deletion.value.removedConstraintIds,
    unlinkedAssetIds: deletion.value.unlinkedAssetIds,
    affectedConfigurations: project.configurations
      .filter(({ configuration }) => referencesAnyFeature(configuration, removed))
      .map(({ configuration }) => configuration.name),
    ...(deletion.value.groupChange !== undefined ? { groupChange: deletion.value.groupChange } : {})
  })
}

/** Configurações com valor para o atributo; elas ficam desatualizadas se ele for excluído. */
export function configurationsUsingAttribute(
  project: Project,
  featureId: string,
  attributeId: string
): string[] {
  return project.configurations
    .filter(({ configuration }) => referencesAttribute(configuration, featureId, attributeId))
    .map(({ configuration }) => configuration.name)
}
