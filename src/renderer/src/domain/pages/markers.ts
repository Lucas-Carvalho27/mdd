import type { GenerationPlan } from '../generation/generation-plan'
import { err, ok, type Result } from '../shared/result'

/*
 * Os marcadores dos fragmentos HTML e da moldura (SPEC §4.4, Fase 7): `{{feature.atributo}}`
 * vira o valor do atributo; `{{produto}}`, o nome da configuração; `{{conteudo}}` e
 * `{{sumario}}`, só na moldura, as seções e o sumário. Espaços dentro das chaves valem, e
 * `\{{` escreve `{{`. Aqui fica só o texto: onde cada marcador pode estar no HTML (numa tag,
 * num `<script>`) é conferido por quem lê o HTML.
 */

export type ReservedMarker = 'conteudo' | 'sumario' | 'produto'

export type MarkerTarget =
  | { readonly kind: 'attribute'; readonly featureId: string; readonly attributeId: string }
  | { readonly kind: 'reserved'; readonly name: ReservedMarker }
  /** `\{{`, que vira `{{`. */
  | { readonly kind: 'escape' }

export interface Marker {
  /** A posição do primeiro caractere (a `\` num escape). */
  readonly start: number
  /** A posição logo depois do último caractere. */
  readonly end: number
  readonly target: MarkerTarget
}

export interface MarkerProblem {
  readonly offset: number
  readonly message: string
}

export interface FoundMarkers {
  readonly markers: readonly Marker[]
  readonly problems: readonly MarkerProblem[]
}

/** Em que arquivo o marcador está: `{{conteudo}}` e `{{sumario}}` só valem na moldura. */
export type MarkerRole = 'fragment' | 'frame'

const OPEN = '{{'
const CLOSE = '}}'
const ESCAPE = '\\'
const NAME = /^([a-z][a-z0-9_]*)(?:\.([a-z][a-z0-9_]*))?$/
const RESERVED: readonly ReservedMarker[] = ['conteudo', 'sumario', 'produto']
const FRAME_ONLY: ReadonlySet<ReservedMarker> = new Set(['conteudo', 'sumario'])

export function findMarkers(text: string): FoundMarkers {
  const markers: Marker[] = []
  const problems: MarkerProblem[] = []
  let from = 0
  for (;;) {
    const start = text.indexOf(OPEN, from)
    if (start < 0) break
    if (start > 0 && text[start - 1] === ESCAPE) {
      markers.push({ start: start - 1, end: start + OPEN.length, target: { kind: 'escape' } })
      from = start + OPEN.length
      continue
    }
    const close = text.indexOf(CLOSE, start + OPEN.length)
    const inner = close < 0 ? '' : text.slice(start + OPEN.length, close)
    // Sem fechamento, ou com outro `{{` antes dele: o problema é deste `{{`, e a busca segue.
    if (close < 0 || inner.includes(OPEN)) {
      problems.push({ offset: start, message: 'Falta o }} que fecha o marcador.' })
      from = start + OPEN.length
      continue
    }
    from = close + CLOSE.length
    const name = NAME.exec(inner.trim())
    const written = text.slice(start, from)
    if (name === null) {
      problems.push({
        offset: start,
        message: `Marcador inválido: ${written}. Use {{feature.atributo}}, e \\{{ para escrever {{.`
      })
    } else if (name[2] !== undefined) {
      markers.push({
        start,
        end: from,
        target: { kind: 'attribute', featureId: name[1], attributeId: name[2] }
      })
    } else if ((RESERVED as readonly string[]).includes(name[1])) {
      markers.push({
        start,
        end: from,
        target: { kind: 'reserved', name: name[1] as ReservedMarker }
      })
    } else {
      problems.push({
        offset: start,
        message: `Marcador desconhecido: ${written}. Use {{feature.atributo}} ou {{produto}}.`
      })
    }
  }
  return { markers, problems }
}

/** O marcador escrito na forma canônica, para as mensagens. */
export function markerLabel(target: MarkerTarget): string {
  switch (target.kind) {
    case 'attribute':
      return `{{${target.featureId}.${target.attributeId}}}`
    case 'reserved':
      return `{{${target.name}}}`
    case 'escape':
      return '\\{{'
  }
}

/**
 * O que está errado num marcador de atributo independentemente da configuração: a feature ou
 * o atributo que não existem no modelo. `null` quando está certo, e nos demais marcadores
 * (onde eles podem ficar é conferido por quem lê o HTML).
 */
export function markerIdProblem(
  target: MarkerTarget,
  modelAttributes: ReadonlyMap<string, readonly string[]>
): string | null {
  if (target.kind !== 'attribute') return null
  const attributes = modelAttributes.get(target.featureId)
  if (attributes === undefined) return `A feature ${target.featureId} não existe no modelo.`
  if (!attributes.includes(target.attributeId)) {
    return `A feature ${target.featureId} não tem o atributo ${target.attributeId}.`
  }
  return null
}

/** Os problemas dos IDs dos marcadores de atributo do texto, contra o modelo (para o editor). */
export function modelMarkerProblems(
  text: string,
  modelAttributes: ReadonlyMap<string, readonly string[]>
): MarkerProblem[] {
  return findMarkers(text).markers.flatMap((marker) => {
    const message = markerIdProblem(marker.target, modelAttributes)
    return message === null ? [] : [{ offset: marker.start, message }]
  })
}

/**
 * Os problemas de contagem da moldura: `{{conteudo}}` uma vez só, e `{{sumario}}` no máximo
 * uma. `markers` são os que valem, na ordem do texto.
 */
export function frameCountProblems(markers: readonly Marker[]): MarkerProblem[] {
  const problems: MarkerProblem[] = []
  const occurrences = (name: ReservedMarker): Marker[] =>
    markers.filter((marker) => marker.target.kind === 'reserved' && marker.target.name === name)
  const content = occurrences('conteudo')
  if (content.length === 0) {
    problems.push({
      offset: 0,
      message: 'A moldura precisa de {{conteudo}}, onde entram as seções.'
    })
  }
  for (const repeated of content.slice(1)) {
    problems.push({ offset: repeated.start, message: '{{conteudo}} só pode aparecer uma vez.' })
  }
  for (const repeated of occurrences('sumario').slice(1)) {
    problems.push({ offset: repeated.start, message: '{{sumario}} só pode aparecer uma vez.' })
  }
  return problems
}

/**
 * O valor de um marcador de atributo ou de `{{produto}}` numa configuração: o mesmo valor do
 * product.xml. `{{conteudo}}` e `{{sumario}}` são montados por quem monta a página.
 */
export function markerValue(target: MarkerTarget, plan: GenerationPlan): Result<string, string> {
  switch (target.kind) {
    case 'escape':
      return ok(OPEN)
    case 'reserved':
      return FRAME_ONLY.has(target.name)
        ? err(`${markerLabel(target)} só vale na moldura.`)
        : ok(plan.productName)
    case 'attribute': {
      const problem = markerIdProblem(target, plan.modelAttributes)
      if (problem !== null) return err(problem)
      const feature = plan.features.find((candidate) => candidate.id === target.featureId)
      if (feature === undefined) {
        return err(
          `${markerLabel(target)}: a feature ${target.featureId} não está selecionada nesta configuração. Use uma condição de presença no fragmento.`
        )
      }
      const attribute = feature.attributes.find((candidate) => candidate.id === target.attributeId)
      // Numa configuração completa, todo atributo de feature selecionada tem valor.
      return attribute === undefined
        ? err(`${markerLabel(target)} está sem valor nesta configuração.`)
        : ok(attribute.value)
    }
  }
}
