import { validateXML } from 'xmllint-wasm'
import type { XmlSchemaIssue, XmlSchemaName } from '../../shared/ipc'
import assetsXsd from '../../../docs/schemas/assets.xsd?raw'
import configurationXsd from '../../../docs/schemas/configuration.xsd?raw'
import featureModelXsd from '../../../docs/schemas/feature-model.xsd?raw'

/*
 * Etapas 1 e 2 da leitura (SPEC §5) com o libxml2 compilado para WebAssembly.
 * Roda no processo main porque o xmllint-wasm usa worker_threads do Node.
 * Os XSDs de docs/schemas/ entram no bundle como texto.
 */

const SCHEMAS: Record<XmlSchemaName, { fileName: string; contents: string }> = {
  'feature-model': { fileName: 'feature-model.xsd', contents: featureModelXsd },
  assets: { fileName: 'assets.xsd', contents: assetsXsd },
  configuration: { fileName: 'configuration.xsd', contents: configurationXsd }
}

const MESSAGE_PREFIX = /^(Schemas validity error|Schemas parser error|parser error)\s*:\s*/

export async function validateAgainstSchema(
  schema: XmlSchemaName,
  fileName: string,
  content: string
): Promise<XmlSchemaIssue[]> {
  const result = await validateXML({
    xml: [{ fileName, contents: content }],
    schema: [SCHEMAS[schema]]
  })
  if (result.valid) return []
  const issues = result.errors
    .map((error) => ({
      line: error.loc?.lineNumber,
      message: error.message.replace(MESSAGE_PREFIX, '').trim()
    }))
    .filter((issue) => issue.message !== '')
  // Em erros de sintaxe o xmllint repete o trecho do arquivo como linhas sem posição.
  const located = issues.filter((issue) => issue.line !== undefined)
  return located.length > 0 ? located : issues
}
