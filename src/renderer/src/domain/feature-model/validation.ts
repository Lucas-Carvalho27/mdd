import { isValidFeatureId } from '../expression/identifier'
import { referencedFeatureIds } from '../expression/references'
import { error, warning, type ValidationIssue } from '../shared/validation-issue'
import { checkAttributeValue } from './attribute-value'
import type { Attribute, Feature, FeatureModel, Group } from './feature-model'

type Position = 'root' | 'solitary' | 'member'

/** Confere as invariantes M1–M5 do Feature Model (SPEC §4.1). */
export function validateFeatureModel(model: FeatureModel): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const featureIds = new Set<string>()

  const visit = (feature: Feature, position: Position): void => {
    issues.push(...checkFeatureId(feature, featureIds))
    issues.push(...checkVariability(feature, position))
    issues.push(...checkAttributes(feature))
    for (const child of feature.children) {
      if (child.kind === 'feature') {
        visit(child.feature, 'solitary')
      } else {
        issues.push(...checkGroup(feature.id, child.group))
        child.group.members.forEach((member) => visit(member, 'member'))
      }
    }
  }
  visit(model.root, 'root')

  issues.push(...checkConstraints(model, featureIds))
  return issues
}

// M1
function checkFeatureId(feature: Feature, seen: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!isValidFeatureId(feature.id)) {
    issues.push(
      error(
        `ID "${feature.id}" inválido: use [a-z][a-z0-9_]* e evite palavras reservadas.`,
        feature.id
      )
    )
  }
  if (seen.has(feature.id)) issues.push(error(`ID "${feature.id}" repetido.`, feature.id))
  seen.add(feature.id)
  return issues
}

// M2
function checkVariability(feature: Feature, position: Position): ValidationIssue[] {
  if (position === 'root' && feature.variability !== undefined) {
    return [error('A feature raiz não pode ter variabilidade.', feature.id)]
  }
  if (position === 'solitary' && feature.variability === undefined) {
    return [error('Feature fora de grupo precisa ser obrigatória ou opcional.', feature.id)]
  }
  if (position === 'member' && feature.variability !== undefined) {
    return [error('Membro de grupo não tem variabilidade própria.', feature.id)]
  }
  return []
}

// M3
function checkGroup(parentId: string, group: Group): ValidationIssue[] {
  const subject = `${parentId} (grupo)`
  const count = group.members.length
  const issues: ValidationIssue[] = []
  if (count === 0) issues.push(error('Grupo sem membros.', subject))
  if (group.min < 0) issues.push(error('O mínimo do grupo não pode ser negativo.', subject))
  if (group.max !== '*' && group.max < Math.max(group.min, 1)) {
    issues.push(
      error(`O máximo do grupo deve ser * ou pelo menos ${Math.max(group.min, 1)}.`, subject)
    )
  }
  if (count > 0 && group.min > count) {
    issues.push(
      error(`O mínimo do grupo (${group.min}) passa do número de membros (${count}).`, subject)
    )
  }
  if (group.max !== '*' && count > 0 && group.max > count) {
    issues.push(
      warning(`O máximo do grupo (${group.max}) passa do número de membros e vale como *.`, subject)
    )
  }
  if (count === 1) issues.push(warning('Grupo com um único membro.', subject))
  return issues
}

// M4
function checkConstraints(model: FeatureModel, featureIds: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const constraintIds = new Set<string>()
  for (const constraint of model.constraints) {
    if (constraintIds.has(constraint.id)) {
      issues.push(error(`ID de restrição "${constraint.id}" repetido.`, constraint.id))
    }
    constraintIds.add(constraint.id)
    for (const id of referencedFeatureIds(constraint.expression)) {
      if (!featureIds.has(id)) {
        issues.push(error(`A restrição cita a feature "${id}", que não existe.`, constraint.id))
      }
    }
  }
  return issues
}

// M5
function checkAttributes(feature: Feature): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const attributeIds = new Set<string>()
  for (const attribute of feature.attributes) {
    const subject = `${feature.id}.${attribute.id}`
    if (attributeIds.has(attribute.id)) {
      issues.push(error(`Atributo "${attribute.id}" repetido na feature.`, subject))
    }
    attributeIds.add(attribute.id)
    issues.push(...checkAttribute(attribute).map((message) => error(message, subject)))
  }
  return issues
}

function checkAttribute(attribute: Attribute): string[] {
  const problems: string[] = []
  const hasRange = attribute.min !== undefined || attribute.max !== undefined
  if (attribute.type !== 'number' && hasRange) problems.push('min e max só valem para number.')
  if (attribute.min !== undefined && attribute.max !== undefined && attribute.min > attribute.max) {
    problems.push('min maior que max.')
  }
  if (attribute.type === 'enum') {
    if (attribute.options.length === 0) problems.push('enum precisa de ao menos uma option.')
    if (new Set(attribute.options).size !== attribute.options.length) {
      problems.push('enum com option repetida.')
    }
  } else if (attribute.options.length > 0) {
    problems.push('option só vale para enum.')
  }
  if (attribute.defaultValue !== undefined) {
    const problem = checkAttributeValue(attribute, attribute.defaultValue)
    if (problem !== null) problems.push(`default inválido: ${problem}.`)
  }
  if (!attribute.configurable && attribute.defaultValue === undefined) {
    problems.push('Atributo fixo precisa de default.')
  }
  return problems
}
