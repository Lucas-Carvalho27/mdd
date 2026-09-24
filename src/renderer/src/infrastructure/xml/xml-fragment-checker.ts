import type { FileProblem } from '@/application/file-problem'
import type { FragmentChecker } from '@/application/ports/fragment-checker'
import type { XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import { encodingProblem } from '@/domain/fragments/encoding'
import { err, type Result } from '@/domain/shared/result'
import { extractFragmentRoot } from './fragment-source'
import type { DecodeProblem } from './xml-reader'

/**
 * As conferências de um fragmento (SPEC §4.4), na ordem: a codificação, o xmllint (XML
 * bem-formado) e o @xmldom/xmldom, que extrai a raiz. A geração usa a raiz extraída; o
 * editor de fragmentos, só os problemas.
 */
export class XmlFragmentChecker implements FragmentChecker {
  private readonly validator: XmlSchemaValidator

  constructor(validator: XmlSchemaValidator) {
    this.validator = validator
  }

  /** O texto da raiz, pronto para o product.xml, ou os problemas. */
  async extractRoot(path: string, content: string): Promise<Result<string, DecodeProblem[]>> {
    const encoding = encodingProblem(content)
    if (encoding !== undefined) return err([encoding])
    const issues = await this.validator.validate(null, path, content)
    if (issues.length > 0) return err(issues)
    return extractFragmentRoot(content)
  }

  async check(path: string, content: string): Promise<FileProblem[]> {
    const root = await this.extractRoot(path, content)
    if (root.ok) return []
    return root.error.map((issue) => ({
      file: path,
      line: issue.line,
      severity: 'error',
      message: issue.message
    }))
  }
}
