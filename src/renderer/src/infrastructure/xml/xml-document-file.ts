import type { Element } from '@xmldom/xmldom'
import { fileError, type FileProblem } from '@/application/file-problem'
import type { ProjectStorage, StorageError } from '@/application/ports/project-storage'
import type { ExpectedHash, LoadedFile, SaveResult } from '@/application/ports/repositories'
import type { XmlSchema, XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import { err, ok, type Result } from '@/domain/shared/result'
import { parseXmlRoot, type DecodeProblem } from './xml-reader'

export interface XmlDocumentFormat<T> {
  readonly schema: XmlSchema
  decode(root: Element): Result<T, DecodeProblem[]>
  encode(value: T): string
}

/**
 * Um arquivo XML do projeto. A leitura segue as etapas da SPEC §5:
 * bem-formado e XSD (validador), depois conversão para o domínio (codec).
 */
export class XmlDocumentFile<T> {
  private readonly storage: ProjectStorage
  private readonly validator: XmlSchemaValidator
  private readonly path: string
  private readonly format: XmlDocumentFormat<T>

  constructor(
    storage: ProjectStorage,
    validator: XmlSchemaValidator,
    path: string,
    format: XmlDocumentFormat<T>
  ) {
    this.storage = storage
    this.validator = validator
    this.path = path
    this.format = format
  }

  /** `null` quando o arquivo não existe. */
  async load(): Promise<Result<LoadedFile<T> | null, FileProblem[]>> {
    const read = await this.storage.readText(this.path)
    if (!read.ok) {
      return read.error.code === 'not-found' ? ok(null) : err([this.storageProblem(read.error)])
    }

    const fileName = this.path.split('/').pop() ?? this.path
    const schemaIssues = await this.validator.validate(
      this.format.schema,
      fileName,
      read.value.content
    )
    if (schemaIssues.length > 0) {
      return err(schemaIssues.map((issue) => fileError(this.path, issue.message, issue.line)))
    }

    const decoded = this.format.decode(parseXmlRoot(read.value.content))
    if (!decoded.ok) {
      return err(
        decoded.error.map((problem) => ({ file: this.path, severity: 'error', ...problem }))
      )
    }
    return ok({ value: decoded.value, hash: read.value.hash })
  }

  async save(value: T, expectedHash: ExpectedHash): Promise<SaveResult> {
    const written = await this.storage.writeText(
      this.path,
      this.format.encode(value),
      expectedHash === null ? { kind: 'must-not-exist' } : { kind: 'hash', expectedHash }
    )
    return written.ok ? written : err([this.storageProblem(written.error)])
  }

  private storageProblem(error: StorageError): FileProblem {
    if (error.code === 'changed-externally') {
      return fileError(this.path, 'O arquivo foi alterado fora do app desde a última leitura.')
    }
    return fileError(this.path, error.message)
  }
}
