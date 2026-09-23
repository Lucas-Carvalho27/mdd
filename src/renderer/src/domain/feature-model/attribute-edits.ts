import { generateId } from '../shared/identifier-generator'
import { err, ok } from '../shared/result'
import { editFeature, notFound, type EditResult } from './feature-edits'
import type { Attribute, FeatureModel } from './feature-model'
import { findFeature } from './tree'

/** Tudo de um atributo menos o ID, que é gerado na criação e não muda (como nas features). */
export type AttributeDraft = Omit<Attribute, 'id'>

export interface AddedAttribute {
  readonly model: FeatureModel
  readonly attributeId: string
}

export function addAttribute(
  model: FeatureModel,
  featureId: string,
  draft: AttributeDraft
): EditResult<AddedAttribute> {
  const feature = findFeature(model.root, featureId)
  if (feature === undefined) return err(notFound(featureId))
  const name = draft.name.trim()
  if (name === '') return err('O nome do atributo não pode ficar vazio.')
  const taken = new Set(feature.attributes.map((attribute) => attribute.id))
  const attributeId = generateId(name, taken, 'atributo')
  const edited = editFeature(model, featureId, (f) => ({
    ...f,
    attributes: [...f.attributes, { ...draft, name, id: attributeId }]
  }))
  return edited.ok ? ok({ model: edited.value, attributeId }) : edited
}

export function updateAttribute(
  model: FeatureModel,
  featureId: string,
  attributeId: string,
  draft: AttributeDraft
): EditResult {
  const feature = findFeature(model.root, featureId)
  if (feature === undefined) return err(notFound(featureId))
  if (!feature.attributes.some((attribute) => attribute.id === attributeId)) {
    return err(`O atributo "${attributeId}" não existe.`)
  }
  const name = draft.name.trim()
  if (name === '') return err('O nome do atributo não pode ficar vazio.')
  return editFeature(model, featureId, (f) => ({
    ...f,
    attributes: f.attributes.map((attribute) =>
      attribute.id === attributeId ? { ...draft, name, id: attributeId } : attribute
    )
  }))
}

export function removeAttribute(
  model: FeatureModel,
  featureId: string,
  attributeId: string
): EditResult {
  const feature = findFeature(model.root, featureId)
  if (feature === undefined) return err(notFound(featureId))
  if (!feature.attributes.some((attribute) => attribute.id === attributeId)) {
    return err(`O atributo "${attributeId}" não existe.`)
  }
  return editFeature(model, featureId, (f) => ({
    ...f,
    attributes: f.attributes.filter((attribute) => attribute.id !== attributeId)
  }))
}
