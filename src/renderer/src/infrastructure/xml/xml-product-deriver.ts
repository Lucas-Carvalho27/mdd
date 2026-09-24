import type { FileProblem } from '@/application/file-problem'
import type { ProductDeriver, ProductFile } from '@/application/ports/product-deriver'
import type { ProjectStorage } from '@/application/ports/project-storage'
import type { XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import { firstPerPath, type Asset } from '@/domain/assets/asset-catalog'
import type { GenerationPlan, PlannedSection } from '@/domain/generation/generation-plan'
import { err, ok, type Result } from '@/domain/shared/result'
import { declaredEncoding, extractFragmentRoot } from './fragment-source'
import type { DecodeProblem } from './xml-reader'
import { element, rawXml, textElement, writeXmlDocument, type XmlElement } from './xml-writer'

const NAMESPACE = 'urn:mdd:product'

/**
 * O produto em XML (SPEC §4.4, ADR 0006): o product.xml com cada fragmento embutido e os
 * recursos copiados. Confere todas as fontes antes e devolve todos os problemas de uma vez.
 */
export class XmlProductDeriver implements ProductDeriver {
  private readonly storage: ProjectStorage
  private readonly validator: XmlSchemaValidator

  constructor(storage: ProjectStorage, validator: XmlSchemaValidator) {
    this.storage = storage
    this.validator = validator
  }

  async derive(
    plan: GenerationPlan,
    generatedAt: Date
  ): Promise<Result<readonly ProductFile[], FileProblem[]>> {
    // Um caminho usado por dois assets é conferido uma vez só. As conferências de cada tipo
    // rodam juntas, e os problemas saem na ordem do plano.
    const fragments = firstPerPath(fragmentsOf(plan.root))
    const roots = await Promise.all(fragments.map((asset) => this.loadFragment(asset)))
    const resources = await Promise.all(plan.resources.map((asset) => this.checkResource(asset)))
    const problems = [...roots, ...resources].flatMap((result) => (result.ok ? [] : result.error))
    if (problems.length > 0) return err(problems)

    const rootByPath = new Map<string, string>()
    fragments.forEach((asset, index) => {
      const root = roots[index]
      if (root.ok) rootByPath.set(asset.path, root.value)
    })
    return ok([
      { kind: 'text', path: 'product.xml', content: writeProduct(plan, generatedAt, rootByPath) },
      ...plan.resources.map((asset): ProductFile => ({ kind: 'copy', path: asset.path }))
    ])
  }

  /** Lê o fragmento e devolve o texto da raiz, pronto para entrar no product.xml. */
  private async loadFragment(asset: Asset): Promise<Result<string, FileProblem[]>> {
    const read = await this.storage.readText(asset.path)
    if (!read.ok) {
      const message = read.error.code === 'not-found' ? 'Arquivo ausente.' : read.error.message
      return err([problem(asset, { message })])
    }
    const content = read.value.content
    // O conteúdo foi lido como UTF-8; com outra codificação, os acentos já chegam trocados.
    const encoding = declaredEncoding(content)
    if (encoding !== undefined && !/^utf-?8$/i.test(encoding)) {
      return err([
        problem(asset, {
          line: 1,
          message: `A codificação ${encoding} não é suportada: salve o arquivo em UTF-8.`
        })
      ])
    }
    const issues = await this.validator.validate(null, asset.path, content)
    if (issues.length > 0) return err(issues.map((issue) => problem(asset, issue)))
    const root = extractFragmentRoot(content)
    return root.ok ? root : err(root.error.map((issue) => problem(asset, issue)))
  }

  private async checkResource(asset: Asset): Promise<Result<null, FileProblem[]>> {
    const entry = await this.storage.stat(asset.path)
    if (entry.ok && entry.value === 'file') return ok(null)
    return err([problem(asset, { message: 'Arquivo ausente.' })])
  }
}

function problem(asset: Asset, issue: DecodeProblem): FileProblem {
  return {
    file: asset.path,
    line: issue.line,
    subject: asset.id,
    severity: 'error',
    message: issue.message
  }
}

function fragmentsOf(section: PlannedSection): Asset[] {
  return [...section.fragments, ...section.children.flatMap(fragmentsOf)]
}

function writeProduct(
  plan: GenerationPlan,
  generatedAt: Date,
  rootByPath: ReadonlyMap<string, string>
): string {
  const sectionElement = (section: PlannedSection): XmlElement =>
    element(
      'section',
      [['feature', section.featureId]],
      [
        ...section.fragments.map((asset) =>
          element(
            'fragment',
            [
              ['asset', asset.id],
              ['xml:base', baseOf(asset.path)]
            ],
            [rawXml(rootByPath.get(asset.path) ?? '')]
          )
        ),
        ...section.children.map(sectionElement)
      ]
    )

  return writeXmlDocument(
    element(
      'product',
      [
        ['xmlns', NAMESPACE],
        ['schemaVersion', '1'],
        ['name', plan.productName],
        ['model', plan.modelName],
        ['generatedAt', generatedAt.toISOString().replace(/\.\d{3}Z$/, 'Z')]
      ],
      [
        element(
          'features',
          [],
          plan.features.map((feature) =>
            element(
              'feature',
              [
                ['id', feature.id],
                ['name', feature.name]
              ],
              feature.attributes.map((attribute) =>
                textElement('attribute', attribute.value, [['id', attribute.id]])
              )
            )
          )
        ),
        element('content', [], [sectionElement(plan.root)])
      ]
    )
  )
}

/** A pasta do fragmento, que resolve os caminhos relativos dentro dele: "docs/pagamento/". */
function baseOf(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash < 0 ? './' : path.slice(0, slash + 1)
}
