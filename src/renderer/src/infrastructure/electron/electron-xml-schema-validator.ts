import type {
  XmlSchema,
  XmlSchemaIssue,
  XmlSchemaValidator
} from '@/application/ports/xml-schema-validator'

/** Validação XSD feita no processo main (xmllint-wasm), chamada por IPC. */
export class ElectronXmlSchemaValidator implements XmlSchemaValidator {
  async validate(schema: XmlSchema, fileName: string, content: string): Promise<XmlSchemaIssue[]> {
    const result = await window.mdd.validateXml(schema, fileName, content)
    return result.ok ? result.value : [{ message: result.error.message }]
  }
}
