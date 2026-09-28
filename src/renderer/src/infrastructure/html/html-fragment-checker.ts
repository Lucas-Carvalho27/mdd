import type { FileProblem } from '@/application/file-problem'
import type { FragmentChecker } from '@/application/ports/fragment-checker'
import { encodingProblem, type EncodingProblem } from '@/domain/fragments/encoding'
import {
  findMarkers,
  frameCountProblems,
  type Marker,
  type MarkerRole
} from '@/domain/pages/markers'
import { isFramePath } from '@/domain/pages/page-layout'
import { err, ok, type Result } from '@/domain/shared/result'
import { lineAt } from '@/domain/shared/text-lines'
import { readHtmlSource, type HtmlProblem, type HtmlSource } from './html-source'

const BOM = '\u{FEFF}'

/** O fragmento HTML ou a moldura lidos: o texto (sem BOM), os marcadores e a leitura do HTML. */
export interface InspectedHtml {
  readonly text: string
  readonly role: MarkerRole
  /** Os marcadores que valem, fora os que já deram problema pelo lugar. */
  readonly markers: readonly Marker[]
  readonly source: HtmlSource
  /** Os problemas que não dependem do modelo nem da configuração, na ordem do texto. */
  readonly problems: readonly HtmlProblem[]
}

/**
 * As conferências de um fragmento HTML ou da moldura (SPEC §4.4, Fase 7), na ordem: a
 * codificação, os marcadores e o HTML. Os IDs dos marcadores dependem do modelo, e a feature
 * selecionada e os arquivos citados, da configuração e do disco: ficam com quem os tem.
 */
export function inspectHtml(path: string, content: string): Result<InspectedHtml, EncodingProblem> {
  const encoding = encodingProblem(content)
  if (encoding !== undefined) return err(encoding)
  const text = content.startsWith(BOM) ? content.slice(BOM.length) : content
  const role: MarkerRole = isFramePath(path) ? 'frame' : 'fragment'
  const found = findMarkers(text)
  const source = readHtmlSource(text, role, found.markers)
  const markers = found.markers.filter((marker) => source.places.has(marker.start))
  const problems = [
    ...found.problems,
    ...source.problems,
    ...(role === 'frame' ? frameCountProblems(markers) : [])
  ].sort((a, b) => a.offset - b.offset)
  return ok({ text, role, markers, source, problems })
}

/** Confere um fragmento HTML ou a moldura, no editor (Fase 7). */
export class HtmlFragmentChecker implements FragmentChecker {
  async check(path: string, content: string): Promise<FileProblem[]> {
    const inspected = inspectHtml(path, content)
    if (!inspected.ok) return [{ file: path, severity: 'error', ...inspected.error }]
    const { text, problems } = inspected.value
    return problems.map((problem) => problemAt(path, text, problem))
  }
}

export function problemAt(
  file: string,
  text: string,
  problem: HtmlProblem,
  subject?: string
): FileProblem {
  return {
    file,
    line: lineAt(text, problem.offset),
    subject,
    severity: 'error',
    message: problem.message
  }
}
