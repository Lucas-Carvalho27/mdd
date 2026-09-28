import type { FileProblem } from '@/application/file-problem'
import type { ProductDeriver, ProductFile } from '@/application/ports/product-deriver'
import type { ProjectStorage } from '@/application/ports/project-storage'
import { firstPerPath, type Asset } from '@/domain/assets/asset-catalog'
import type { GenerationPlan } from '@/domain/generation/generation-plan'
import { findMarkers, markerLabel, markerValue, type Marker } from '@/domain/pages/markers'
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  planHtmlFragments,
  sectionsHtml,
  tableOfContents
} from '@/domain/pages/page-assembly'
import { DEFAULT_FRAME, FRAME_PATH, PAGE_PATH, PRODUCT_PATH } from '@/domain/pages/page-layout'
import { formatSrcset, pageUrl, resolveCitedUrl, srcsetCandidates } from '@/domain/pages/page-paths'
import { err, ok, type Result } from '@/domain/shared/result'
import { inspectHtml, problemAt } from './html-fragment-checker'
import type { HtmlAttribute, HtmlSource } from './html-source'

/** Um trecho do texto trocado por outro. */
interface Edit {
  readonly start: number
  readonly end: number
  readonly text: string
}

/** Um arquivo do projeto citado por um fragmento ou pela moldura, que vai para a saída. */
interface Cited {
  readonly path: string
  readonly offset: number
}

/** Um fragmento ou a moldura, com os marcadores e os caminhos já resolvidos, sem aplicar. */
interface Prepared {
  readonly file: string
  readonly subject?: string
  readonly text: string
  readonly source: HtmlSource
  readonly edits: readonly Edit[]
  readonly cited: readonly Cited[]
  /** `{{conteudo}}` e `{{sumario}}` da moldura, montados depois. */
  readonly reserved: readonly Marker[]
}

/**
 * A página do produto (SPEC §4.4, Fase 7): a moldura com as seções das features selecionadas,
 * os marcadores trocados, os caminhos corrigidos para o `index.html`, o sumário e o CSS e o JS
 * incluídos. Devolve o `index.html` e as cópias dos arquivos citados, ou todos os problemas.
 * Os recursos são copiados pelo `XmlProductDeriver`, como antes.
 */
export class HtmlPageDeriver implements ProductDeriver {
  private readonly storage: ProjectStorage

  constructor(storage: ProjectStorage) {
    this.storage = storage
  }

  async derive(plan: GenerationPlan): Promise<Result<readonly ProductFile[], FileProblem[]>> {
    if (!plan.hasPage) return ok([])
    const fragments = firstPerPath(planHtmlFragments(plan.root))
    const loaded = await Promise.all([
      this.loadFrame(),
      ...fragments.map((asset) => this.loadFragment(asset))
    ])
    const problems: FileProblem[] = []
    const prepared: Prepared[] = []
    loaded.forEach((result, index) => {
      if (!result.ok) {
        problems.push(...result.error)
        return
      }
      const subject = index === 0 ? undefined : fragments[index - 1].id
      const done = prepare(result.value.file, result.value.content, plan, subject)
      problems.push(...done.problems)
      if (done.prepared !== null) prepared.push(done.prepared)
    })
    // Os arquivos citados são conferidos também num arquivo com problema: todos de uma vez.
    problems.push(...(await this.checkCited(prepared)))
    if (problems.length > 0) return err(problems)

    const [frame, ...parts] = prepared
    const textByPath = new Map(
      parts.map((part) => [part.file, trimmed(apply(part.text, part.edits))])
    )
    const page = assemble(frame, plan, (asset) => textByPath.get(asset.path) ?? '')
    const copies = uniquePaths(prepared.flatMap((part) => part.cited.map((cited) => cited.path)))
    return ok([
      { kind: 'text', path: PAGE_PATH, content: page },
      ...copies.map((path): ProductFile => ({ kind: 'copy', path }))
    ])
  }

  private async loadFrame(): Promise<Result<{ file: string; content: string }, FileProblem[]>> {
    const read = await this.storage.readText(FRAME_PATH)
    if (read.ok) return ok({ file: FRAME_PATH, content: read.value.content })
    if (read.error.code === 'not-found') return ok({ file: FRAME_PATH, content: DEFAULT_FRAME })
    return err([{ file: FRAME_PATH, severity: 'error', message: read.error.message }])
  }

  private async loadFragment(
    asset: Asset
  ): Promise<Result<{ file: string; content: string }, FileProblem[]>> {
    const read = await this.storage.readText(asset.path)
    if (read.ok) return ok({ file: asset.path, content: read.value.content })
    const message = read.error.code === 'not-found' ? 'Arquivo ausente.' : read.error.message
    return err([{ file: asset.path, subject: asset.id, severity: 'error', message }])
  }

  /** Cada arquivo citado precisa existir e ser um arquivo; é conferido uma vez só. */
  private async checkCited(prepared: readonly Prepared[]): Promise<FileProblem[]> {
    const seen = new Set<string>()
    const checks = prepared.flatMap((part) =>
      part.cited.flatMap((cited) => {
        const key = cited.path.toLowerCase()
        if (seen.has(key)) return []
        seen.add(key)
        return [{ part, cited }]
      })
    )
    const results = await Promise.all(
      checks.map(async ({ part, cited }): Promise<FileProblem[]> => {
        const generated = [PAGE_PATH, PRODUCT_PATH].find(
          (path) => path === cited.path.toLowerCase()
        )
        if (generated !== undefined) {
          const message = `O arquivo ${cited.path} do projeto substituiria o ${generated} gerado: mude o nome dele.`
          return [problemAt(part.file, part.text, { offset: cited.offset, message }, part.subject)]
        }
        const entry = await this.storage.stat(cited.path)
        if (entry.ok && entry.value === 'file') return []
        const message =
          entry.ok && entry.value === 'directory'
            ? `O caminho aponta para uma pasta: ${cited.path}.`
            : `O arquivo citado não existe: ${cited.path}.`
        return [problemAt(part.file, part.text, { offset: cited.offset, message }, part.subject)]
      })
    )
    return results.flat()
  }
}

/**
 * Resolve os marcadores e os caminhos de um fragmento ou da moldura, sem aplicar as trocas, e
 * junta os problemas. Só não há `prepared` quando o arquivo não está em UTF-8.
 */
function prepare(
  file: string,
  content: string,
  plan: GenerationPlan,
  subject: string | undefined
): { readonly prepared: Prepared | null; readonly problems: readonly FileProblem[] } {
  // As posições valem para o texto com "\n", que é o que vai para a página.
  const inspected = inspectHtml(file, content.replace(/\r\n?/g, '\n'))
  if (!inspected.ok) {
    return { prepared: null, problems: [{ file, subject, severity: 'error', ...inspected.error }] }
  }
  const { text, source, markers } = inspected.value
  const problems: FileProblem[] = inspected.value.problems.map((problem) =>
    problemAt(file, text, problem, subject)
  )
  const problem = (offset: number, message: string): void => {
    problems.push(problemAt(file, text, { offset, message }, subject))
  }

  const edits: Edit[] = []
  const reserved: Marker[] = []
  for (const marker of markers) {
    const place = source.places.get(marker.start)
    if (place === undefined || place.kind === 'attribute') continue
    const { target } = marker
    if (target.kind === 'reserved' && target.name !== 'produto') {
      reserved.push(marker)
      continue
    }
    const value = markerValue(target, plan)
    if (!value.ok) {
      problem(marker.start, value.error)
    } else if (place.kind === 'raw' && value.value.includes('<')) {
      problem(
        marker.start,
        `O valor de ${markerLabel(target)} tem <, que não pode entrar num <style>.`
      )
    } else {
      const replacement = place.kind === 'raw' ? value.value : escapeHtmlText(value.value)
      edits.push({ start: marker.start, end: marker.end, text: replacement })
    }
  }

  const cited: Cited[] = []
  for (const attribute of source.attributes) {
    const value = attributeValue(attribute, plan, file, cited, (message) =>
      problem(attribute.start, message)
    )
    if (value !== attribute.value) {
      edits.push({
        start: attribute.start,
        end: attribute.end,
        text: `${attribute.name}="${escapeHtmlAttribute(value)}"`
      })
    }
  }
  return { prepared: { file, subject, text, source, edits, cited, reserved }, problems }
}

/**
 * O valor novo do atributo: os marcadores trocados pelo valor e, num atributo de caminho, os
 * caminhos do projeto reescritos para a página. Os arquivos citados vão para `cited`.
 */
function attributeValue(
  attribute: HtmlAttribute,
  plan: GenerationPlan,
  file: string,
  cited: Cited[],
  problem: (message: string) => void
): string {
  const found = findMarkers(attribute.value)
  for (const syntax of found.problems) problem(syntax.message)
  let value = attribute.value
  for (const marker of [...found.markers].reverse()) {
    const resolved = markerValue(marker.target, plan)
    if (!resolved.ok) {
      problem(resolved.error)
      continue
    }
    value = value.slice(0, marker.start) + resolved.value + value.slice(marker.end)
  }

  const rewrite = (url: string): string => {
    const resolved = resolveCitedUrl(file, url)
    switch (resolved.kind) {
      case 'kept':
        return url
      case 'absolute':
        problem(`Use um caminho relativo em vez de ${url}: na pasta gerada, "/" é a raiz do disco.`)
        return url
      case 'outside':
        problem(`O caminho ${url} sai da pasta do projeto.`)
        return url
      case 'file':
        cited.push({ path: resolved.path, offset: attribute.start })
        return pageUrl(resolved.path, resolved.suffix)
    }
  }
  switch (attribute.name) {
    case 'srcset':
      return formatSrcset(
        srcsetCandidates(value).map((candidate) => ({ ...candidate, url: rewrite(candidate.url) }))
      )
    case 'src':
    case 'href':
    case 'poster':
      return rewrite(value)
    default:
      return value
  }
}

/** A página: a moldura com as seções, o sumário, o CSS e o JS. */
function assemble(frame: Prepared, plan: GenerationPlan, textOf: (asset: Asset) => string): string {
  const edits: Edit[] = [...frame.edits]
  for (const marker of frame.reserved) {
    const isContent = marker.target.kind === 'reserved' && marker.target.name === 'conteudo'
    const text = isContent ? sectionsHtml(plan.root, textOf) : tableOfContents(plan)
    edits.push({ start: marker.start, end: marker.end, text })
  }
  // O CSS e o JS incluídos entram sozinhos, menos os que a moldura já cita.
  const citedByFrame = new Set(frame.cited.map((cited) => cited.path.toLowerCase()))
  const resources = plan.resources.filter((asset) => !citedByFrame.has(asset.path.toLowerCase()))
  const withExtension = (extension: string): Asset[] =>
    resources.filter((asset) => asset.path.toLowerCase().endsWith(extension))
  const styles = withExtension('.css').map(
    (asset) => `<link rel="stylesheet" href="${escapeHtmlAttribute(pageUrl(asset.path, ''))}">\n`
  )
  const scripts = withExtension('.js').map(
    (asset) => `<script src="${escapeHtmlAttribute(pageUrl(asset.path, ''))}"></script>\n`
  )
  const { headEnd, bodyEnd } = frame.source
  if (headEnd !== undefined && styles.length > 0) {
    edits.push({ start: headEnd, end: headEnd, text: styles.join('') })
  }
  if (bodyEnd !== undefined && scripts.length > 0) {
    edits.push({ start: bodyEnd, end: bodyEnd, text: scripts.join('') })
  }
  const page = apply(frame.text, edits)
  return page.endsWith('\n') ? page : `${page}\n`
}

/** Aplica as trocas do fim para o começo, para as posições continuarem valendo. */
function apply(text: string, edits: readonly Edit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end),
      text
    )
}

/** O fragmento sem as linhas em branco do começo e sem os espaços do fim. */
function trimmed(text: string): string {
  return text.replace(/^\n+/, '').replace(/\s+$/, '')
}

function uniquePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>()
  return paths.filter((path) => {
    const key = path.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
