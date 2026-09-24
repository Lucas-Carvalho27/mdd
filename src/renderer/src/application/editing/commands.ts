import { fileNameOf, type AssetCatalog, type AssetKind } from '@/domain/assets/asset-catalog'
import * as assets from '@/domain/assets/asset-edits'
import * as attributes from '@/domain/feature-model/attribute-edits'
import * as constraints from '@/domain/feature-model/constraint-edits'
import * as features from '@/domain/feature-model/feature-edits'
import type { FeatureModel, GroupMax, Variability } from '@/domain/feature-model/feature-model'
import * as groups from '@/domain/feature-model/group-edits'
import * as newModel from '@/domain/feature-model/new-model'
import type { Expression } from '@/domain/expression/ast'
import { deleteFeature as deleteFeatureCascade } from '@/domain/project/feature-deletion'
import { ok, type Result } from '@/domain/shared/result'
import type { EditorCommand } from './editor-command'

/*
 * Fábricas de comandos: cada função cria um objeto `EditorCommand` que embrulha uma
 * operação pura do domínio. A interface só conhece estas funções, nunca o domínio de edição.
 */

export const NEW_FEATURE_NAME = 'Nova feature'

/** Sem `id`, ele é gerado a partir do nome (ADR 0004). */
export function addChildFeature(
  parentId: string,
  name = NEW_FEATURE_NAME,
  id?: string
): EditorCommand {
  return {
    label: `Adicionar "${name}"`,
    run: (state) => {
      const added = features.addChildFeature(state.model, parentId, name, id)
      if (!added.ok) return added
      return ok({
        state: { ...state, model: added.value.model },
        focusFeatureId: added.value.featureId
      })
    }
  }
}

export function addSiblingFeature(
  siblingId: string,
  name = NEW_FEATURE_NAME,
  id?: string
): EditorCommand {
  return {
    label: `Adicionar "${name}"`,
    run: (state) => {
      const added = features.addSiblingFeature(state.model, siblingId, name, id)
      if (!added.ok) return added
      return ok({
        state: { ...state, model: added.value.model },
        focusFeatureId: added.value.featureId
      })
    }
  }
}

export function renameModel(name: string): EditorCommand {
  return modelCommand(`Renomear modelo para "${name}"`, (model) =>
    newModel.renameModel(model, name)
  )
}

export function renameFeature(featureId: string, name: string): EditorCommand {
  return modelCommand(`Renomear para "${name}"`, (model) =>
    features.renameFeature(model, featureId, name)
  )
}

export function setFeatureDescription(featureId: string, description: string): EditorCommand {
  return modelCommand('Editar descrição', (model) =>
    features.setFeatureDescription(model, featureId, description)
  )
}

export function setVariability(featureId: string, variability: Variability): EditorCommand {
  const label = variability === 'mandatory' ? 'Tornar obrigatória' : 'Tornar opcional'
  return modelCommand(label, (model) => features.setVariability(model, featureId, variability))
}

export function reorderFeature(featureId: string, offset: -1 | 1): EditorCommand {
  return modelCommand(
    offset < 0 ? 'Mover para cima' : 'Mover para baixo',
    (model) => features.reorderFeature(model, featureId, offset),
    featureId
  )
}

export function moveFeature(
  featureId: string,
  destination: features.MoveDestination
): EditorCommand {
  return modelCommand(
    'Mover feature',
    (model) => features.moveFeature(model, featureId, destination),
    featureId
  )
}

export function createGroup(
  parentId: string,
  memberIds: readonly string[],
  min: number,
  max: GroupMax
): EditorCommand {
  return modelCommand('Criar grupo', (model) =>
    groups.createGroup(model, parentId, memberIds, min, max)
  )
}

export function setGroupCardinality(memberId: string, min: number, max: GroupMax): EditorCommand {
  return modelCommand(`Grupo [${min}..${max}]`, (model) =>
    groups.setGroupCardinality(model, memberId, min, max)
  )
}

export function ungroup(memberId: string): EditorCommand {
  return modelCommand('Desfazer grupo', (model) => groups.ungroup(model, memberId))
}

export function addAttribute(featureId: string, draft: attributes.AttributeDraft): EditorCommand {
  return modelCommand(`Adicionar atributo "${draft.name}"`, (model) => {
    const added = attributes.addAttribute(model, featureId, draft)
    return added.ok ? ok(added.value.model) : added
  })
}

export function updateAttribute(
  featureId: string,
  attributeId: string,
  draft: attributes.AttributeDraft
): EditorCommand {
  return modelCommand(`Editar atributo "${draft.name}"`, (model) =>
    attributes.updateAttribute(model, featureId, attributeId, draft)
  )
}

export function removeAttribute(featureId: string, attributeId: string): EditorCommand {
  return modelCommand('Excluir atributo', (model) =>
    attributes.removeAttribute(model, featureId, attributeId)
  )
}

export function addConstraint(expression: Expression, description: string): EditorCommand {
  return modelCommand('Adicionar restrição', (model) => {
    const added = constraints.addConstraint(model, expression, description)
    return added.ok ? ok(added.value.model) : added
  })
}

export function updateConstraint(
  constraintId: string,
  expression: Expression,
  description: string
): EditorCommand {
  return modelCommand('Editar restrição', (model) =>
    constraints.updateConstraint(model, constraintId, expression, description)
  )
}

export function removeConstraint(constraintId: string): EditorCommand {
  return modelCommand('Excluir restrição', (model) =>
    constraints.removeConstraint(model, constraintId)
  )
}

/** Exclusão em cascata: é o único comando que também mexe nos assets. */
export function deleteFeature(featureId: string, featureName: string): EditorCommand {
  return {
    label: `Excluir "${featureName}"`,
    run: (state) => {
      const deletion = deleteFeatureCascade(state.model, state.assets, featureId)
      if (!deletion.ok) return deletion
      return ok({ state: { model: deletion.value.model, assets: deletion.value.assets } })
    }
  }
}

export function linkAsset(draft: assets.AssetDraft): EditorCommand {
  return assetCommand(`Vincular "${fileNameOf(draft.path)}"`, (catalog, model) =>
    assets.linkAsset(model, catalog, draft)
  )
}

export function renameAsset(assetId: string, name: string): EditorCommand {
  return assetCommand('Renomear asset', (catalog) => assets.renameAsset(catalog, assetId, name))
}

export function setAssetKind(assetId: string, kind: AssetKind): EditorCommand {
  return assetCommand(kind === 'fragment' ? 'Tornar fragmento' : 'Tornar recurso', (catalog) =>
    assets.setAssetKind(catalog, assetId, kind)
  )
}

export function setAssetAnchor(assetId: string, anchor: string): EditorCommand {
  return assetCommand('Mudar âncora', (catalog, model) =>
    assets.setAssetAnchor(model, catalog, assetId, anchor)
  )
}

export function setAssetCondition(
  assetId: string,
  condition: Expression | undefined
): EditorCommand {
  return assetCommand(condition ? 'Editar condição' : 'Remover condição', (catalog) =>
    assets.setAssetCondition(catalog, assetId, condition)
  )
}

export function relinkAsset(assetId: string, path: string): EditorCommand {
  return assetCommand(`Trocar arquivo por "${fileNameOf(path)}"`, (catalog) =>
    assets.relinkAsset(catalog, assetId, path)
  )
}

export function reorderAsset(assetId: string, offset: -1 | 1): EditorCommand {
  return assetCommand(offset < 0 ? 'Mover asset para cima' : 'Mover asset para baixo', (catalog) =>
    assets.reorderAsset(catalog, assetId, offset)
  )
}

/** `label` é como o asset aparece na lista, para o "Desfazer: Desvincular …". */
export function unlinkAsset(assetId: string, label: string): EditorCommand {
  return assetCommand(`Desvincular "${label}"`, (catalog) => assets.unlinkAsset(catalog, assetId))
}

function modelCommand(
  label: string,
  edit: (model: FeatureModel) => Result<FeatureModel, string>,
  focusFeatureId?: string
): EditorCommand {
  return {
    label,
    run: (state) => {
      const edited = edit(state.model)
      if (!edited.ok) return edited
      return ok({ state: { ...state, model: edited.value }, focusFeatureId })
    }
  }
}

function assetCommand(
  label: string,
  edit: (catalog: AssetCatalog, model: FeatureModel) => Result<AssetCatalog, string>
): EditorCommand {
  return {
    label,
    run: (state) => {
      const edited = edit(state.assets, state.model)
      if (!edited.ok) return edited
      return ok({ state: { ...state, assets: edited.value } })
    }
  }
}
