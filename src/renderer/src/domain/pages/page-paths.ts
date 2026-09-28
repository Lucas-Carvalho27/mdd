import { folderOf } from '../fragments/fragment-path'

/*
 * Os caminhos que os fragmentos HTML e a moldura citam em `src`, `href`, `srcset` e `poster`
 * (SPEC §4.4, Fase 7). Um caminho relativo é relativo à pasta do arquivo, como no XML. A
 * página fica na raiz da pasta do produto, e os arquivos citados são copiados para o mesmo
 * caminho que têm no projeto: o caminho na página é o caminho no projeto.
 */

/** Os atributos com caminhos. `srcset` tem uma lista: veja `srcsetCandidates`. */
export const URL_ATTRIBUTES: ReadonlySet<string> = new Set(['src', 'href', 'srcset', 'poster'])

export type CitedUrl =
  /** Fica como está, sem cópia: outro esquema (`https:`, `mailto:`…), `//…`, `#…`, `?…` ou vazio. */
  | { readonly kind: 'kept' }
  /** Começa com "/": na pasta gerada, apontaria para a raiz do disco. */
  | { readonly kind: 'absolute' }
  /** Sai da pasta do projeto. */
  | { readonly kind: 'outside' }
  /** Um arquivo do projeto: `path` é o caminho nele, e `suffix`, o `?…` e o `#…` do original. */
  | { readonly kind: 'file'; readonly path: string; readonly suffix: string }

const SCHEME = /^[a-z][a-z0-9+.-]*:/i
/** Os espaços que o navegador tira do começo e do fim de um endereço. */
const SURROUNDING_SPACE = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g
/** O que precisa ser codificado num trecho do caminho, além dos controles e do espaço. */
const UNSAFE_CHARACTERS = new Set([...'%#?"<>\\^`{|}'])
const DELETE = 0x7f

export function resolveCitedUrl(fromFile: string, url: string): CitedUrl {
  const trimmed = url.replace(SURROUNDING_SPACE, '').replaceAll('\\', '/')
  if (trimmed === '' || SCHEME.test(trimmed) || trimmed.startsWith('//')) return { kind: 'kept' }
  if (trimmed.startsWith('#') || trimmed.startsWith('?')) return { kind: 'kept' }
  if (trimmed.startsWith('/')) return { kind: 'absolute' }

  const cut = trimmed.search(/[?#]/)
  const pathPart = cut < 0 ? trimmed : trimmed.slice(0, cut)
  const suffix = cut < 0 ? '' : trimmed.slice(cut)
  const segments = folderOf(fromFile)
    .split('/')
    .filter((segment) => segment !== '')
  for (const raw of pathPart.split('/')) {
    const segment = decodeSegment(raw)
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (segments.length === 0) return { kind: 'outside' }
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  if (segments.length === 0) return { kind: 'kept' }
  return { kind: 'file', path: segments.join('/'), suffix }
}

/**
 * O endereço do arquivo do projeto na página, que fica na raiz da pasta do produto. Só o que
 * quebraria o endereço é codificado (um espaço vira %20); os acentos ficam como estão.
 */
export function pageUrl(path: string, suffix: string): string {
  return path.split('/').map(encodeSegment).join('/') + suffix
}

function encodeSegment(segment: string): string {
  return [...segment]
    .map((character) => (isUnsafe(character) ? percent(character) : character))
    .join('')
}

function isUnsafe(character: string): boolean {
  const code = character.codePointAt(0) ?? 0
  return code <= 0x20 || code === DELETE || UNSAFE_CHARACTERS.has(character)
}

function percent(character: string): string {
  return [...new TextEncoder().encode(character)]
    .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`)
    .join('')
}

export interface SrcsetCandidate {
  readonly url: string
  /** O que vem depois do endereço, como " 2x" ou " 480w", com o espaço. */
  readonly descriptor: string
}

/** Os candidatos de um `srcset`: "a.png 1x, b.png 2x". */
export function srcsetCandidates(value: string): SrcsetCandidate[] {
  return value
    .split(',')
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate !== '')
    .map((candidate) => {
      const space = candidate.search(/\s/)
      return space < 0
        ? { url: candidate, descriptor: '' }
        : { url: candidate.slice(0, space), descriptor: candidate.slice(space) }
    })
}

export function formatSrcset(candidates: readonly SrcsetCandidate[]): string {
  return candidates.map((candidate) => candidate.url + candidate.descriptor).join(', ')
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
