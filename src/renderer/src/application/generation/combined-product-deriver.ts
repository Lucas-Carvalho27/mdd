import type { GenerationPlan } from '@/domain/generation/generation-plan'
import { err, ok, type Result } from '@/domain/shared/result'
import type { FileProblem } from '../file-problem'
import type { ProductDeriver, ProductFile } from '../ports/product-deriver'

/**
 * Os formatos do produto juntos (Fase 7): o product.xml e a página. Confere todos e devolve
 * todos os problemas de uma vez. Um arquivo copiado por mais de um formato é copiado uma vez;
 * um arquivo copiado com o nome de um arquivo gerado (como `index.html` na raiz) é problema,
 * porque o substituiria.
 */
export class CombinedProductDeriver implements ProductDeriver {
  private readonly derivers: readonly ProductDeriver[]

  constructor(derivers: readonly ProductDeriver[]) {
    this.derivers = derivers
  }

  async derive(
    plan: GenerationPlan,
    generatedAt: Date
  ): Promise<Result<readonly ProductFile[], FileProblem[]>> {
    const results = await Promise.all(
      this.derivers.map((deriver) => deriver.derive(plan, generatedAt))
    )
    const problems = results.flatMap((result) => (result.ok ? [] : result.error))
    if (problems.length > 0) return err(problems)

    const files = results.flatMap((result) => (result.ok ? result.value : []))
    const texts = files.filter((file) => file.kind === 'text')
    const generated = new Set(texts.map((file) => file.path.toLowerCase()))
    const copied = new Set<string>()
    const copies: ProductFile[] = []
    for (const file of files) {
      if (file.kind !== 'copy') continue
      const key = file.path.toLowerCase()
      if (generated.has(key)) {
        problems.push({
          file: file.path,
          severity: 'error',
          message: `O arquivo ${file.path} do projeto substituiria o ${file.path} gerado: mude o nome dele.`
        })
      } else if (!copied.has(key)) {
        copied.add(key)
        copies.push(file)
      }
    }
    return problems.length > 0 ? err(problems) : ok([...texts, ...copies])
  }
}
