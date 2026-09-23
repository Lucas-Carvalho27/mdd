import type { Element } from '@xmldom/xmldom'
import { printExpression } from '@/domain/expression/printer'
import type {
  Attribute,
  AttributeType,
  Constraint,
  Feature,
  FeatureChild,
  FeatureModel,
  Group,
  Variability
} from '@/domain/feature-model/feature-model'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeExpression } from './expression-field'
import {
  childElements,
  firstChild,
  optionalAttribute,
  requiredAttribute,
  textOf,
  type DecodeProblem
} from './xml-reader'
import { element, textElement, writeXmlDocument, type XmlElement } from './xml-writer'

const NAMESPACE = 'urn:mdd:feature-model'

// Leitura (docs/schemas/feature-model.xsd)

export function decodeFeatureModel(root: Element): Result<FeatureModel, DecodeProblem[]> {
  const problems: DecodeProblem[] = []
  const rootFeature = decodeFeature(firstChild(root, 'feature')!)
  const constraintsElement = firstChild(root, 'constraints')
  const constraints = constraintsElement
    ? childElements(constraintsElement, 'constraint').flatMap((constraint) =>
        decodeConstraint(constraint, problems)
      )
    : []
  if (problems.length > 0) return err(problems)
  return ok({ name: requiredAttribute(root, 'name'), root: rootFeature, constraints })
}

function decodeFeature(node: Element): Feature {
  const description = firstChild(node, 'description')
  const variability = optionalAttribute(node, 'variability') as Variability | undefined
  const children: FeatureChild[] = []
  for (const child of childElements(node)) {
    if (child.localName === 'feature') {
      children.push({ kind: 'feature', feature: decodeFeature(child) })
    } else if (child.localName === 'group') {
      children.push({ kind: 'group', group: decodeGroup(child) })
    }
  }
  return {
    id: requiredAttribute(node, 'id'),
    name: requiredAttribute(node, 'name'),
    ...(description ? { description: textOf(description) } : {}),
    ...(variability ? { variability } : {}),
    attributes: childElements(node, 'attribute').map(decodeAttribute),
    children
  }
}

function decodeGroup(node: Element): Group {
  const max = requiredAttribute(node, 'max')
  return {
    min: Number(requiredAttribute(node, 'min')),
    max: max === '*' ? '*' : Number(max),
    members: childElements(node, 'feature').map(decodeFeature)
  }
}

function decodeAttribute(node: Element): Attribute {
  const defaultValue = optionalAttribute(node, 'default')
  const min = optionalAttribute(node, 'min')
  const max = optionalAttribute(node, 'max')
  return {
    id: requiredAttribute(node, 'id'),
    name: requiredAttribute(node, 'name'),
    type: requiredAttribute(node, 'type') as AttributeType,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(min !== undefined ? { min: Number(min) } : {}),
    ...(max !== undefined ? { max: Number(max) } : {}),
    configurable: optionalAttribute(node, 'configurable') !== 'false',
    options: childElements(node, 'option').map((option) => requiredAttribute(option, 'value'))
  }
}

function decodeConstraint(node: Element, problems: DecodeProblem[]): Constraint[] {
  const id = requiredAttribute(node, 'id')
  const description = optionalAttribute(node, 'description')
  const expression = decodeExpression(firstChild(node, 'expression')!, id, problems)
  if (expression === undefined) return []
  return [{ id, ...(description !== undefined ? { description } : {}), expression }]
}

// Escrita, na ordem de elementos e atributos do XSD

export function encodeFeatureModel(model: FeatureModel): string {
  const constraints =
    model.constraints.length > 0
      ? [element('constraints', [], model.constraints.map(encodeConstraint))]
      : []
  return writeXmlDocument(
    element(
      'featureModel',
      [
        ['xmlns', NAMESPACE],
        ['schemaVersion', '1'],
        ['name', model.name]
      ],
      [encodeFeature(model.root), ...constraints]
    )
  )
}

function encodeFeature(feature: Feature): XmlElement {
  return element(
    'feature',
    [
      ['id', feature.id],
      ['name', feature.name],
      ['variability', feature.variability]
    ],
    [
      ...(feature.description !== undefined
        ? [textElement('description', feature.description)]
        : []),
      ...feature.attributes.map(encodeAttribute),
      ...feature.children.map((child) =>
        child.kind === 'feature' ? encodeFeature(child.feature) : encodeGroup(child.group)
      )
    ]
  )
}

function encodeGroup(group: Group): XmlElement {
  return element(
    'group',
    [
      ['min', String(group.min)],
      ['max', String(group.max)]
    ],
    group.members.map(encodeFeature)
  )
}

function encodeAttribute(attribute: Attribute): XmlElement {
  return element(
    'attribute',
    [
      ['id', attribute.id],
      ['name', attribute.name],
      ['type', attribute.type],
      ['default', attribute.defaultValue],
      ['min', attribute.min?.toString()],
      ['max', attribute.max?.toString()],
      ['configurable', attribute.configurable ? undefined : 'false']
    ],
    attribute.options.map((option) => element('option', [['value', option]]))
  )
}

function encodeConstraint(constraint: Constraint): XmlElement {
  return element(
    'constraint',
    [
      ['id', constraint.id],
      ['description', constraint.description]
    ],
    [textElement('expression', printExpression(constraint.expression))]
  )
}
