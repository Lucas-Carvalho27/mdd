import type { Element } from '@xmldom/xmldom'
import type { Configuration, DecisionState } from '@/domain/configuration/configuration'
import { ok, type Result } from '@/domain/shared/result'
import { childElements, requiredAttribute, textOf, type DecodeProblem } from './xml-reader'
import { element, textElement, writeXmlDocument } from './xml-writer'

const NAMESPACE = 'urn:mdd:configuration'

// Leitura (docs/schemas/configuration.xsd)

export function decodeConfiguration(root: Element): Result<Configuration, DecodeProblem[]> {
  return ok({
    name: requiredAttribute(root, 'name'),
    decisions: childElements(root, 'decision').map((decision) => ({
      featureId: requiredAttribute(decision, 'feature'),
      state: requiredAttribute(decision, 'state') as DecisionState
    })),
    values: childElements(root, 'value').map((value) => ({
      featureId: requiredAttribute(value, 'feature'),
      attributeId: requiredAttribute(value, 'attribute'),
      value: textOf(value)
    }))
  })
}

// Escrita, na ordem de elementos e atributos do XSD

export function encodeConfiguration(configuration: Configuration): string {
  return writeXmlDocument(
    element(
      'configuration',
      [
        ['xmlns', NAMESPACE],
        ['schemaVersion', '1'],
        ['name', configuration.name]
      ],
      [
        ...configuration.decisions.map((decision) =>
          element('decision', [
            ['feature', decision.featureId],
            ['state', decision.state]
          ])
        ),
        ...configuration.values.map((value) =>
          textElement('value', value.value, [
            ['feature', value.featureId],
            ['attribute', value.attributeId]
          ])
        )
      ]
    )
  )
}
