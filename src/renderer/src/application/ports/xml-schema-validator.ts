export type XmlSchema = 'feature-model' | 'assets' | 'configuration'

export interface XmlSchemaIssue {
  readonly line?: number
  readonly message: string
}

/** Etapas 1 e 2 da leitura (SPEC §5): XML bem-formado e conforme o XSD. */
export interface XmlSchemaValidator {
  /** Lista vazia = documento válido. */
  validate(schema: XmlSchema, fileName: string, content: string): Promise<XmlSchemaIssue[]>
}
