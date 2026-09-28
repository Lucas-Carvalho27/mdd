import {
  defaultTreeAdapter,
  html,
  parse,
  parseFragment,
  type DefaultTreeAdapterTypes,
  type ParserError
} from 'parse5'
import type { Marker, MarkerRole } from '@/domain/pages/markers'
import { URL_ATTRIBUTES } from '@/domain/pages/page-paths'

/*
 * A leitura de um fragmento HTML ou da moldura com o parse5 (SPEC §4.4, Fase 7). O parse5
 * monta a árvore como o navegador, com a posição de cada tag no texto. Dela saem os problemas
 * (tags abertas, tags que o navegador descarta, erros de sintaxe), o lugar de cada marcador e
 * os atributos com caminhos. O texto não é reescrito aqui: quem monta a página troca só os
 * trechos que precisa, e o resto fica como o autor escreveu.
 */

type Node = DefaultTreeAdapterTypes.Node
type Element = DefaultTreeAdapterTypes.Element
type ParentNode = DefaultTreeAdapterTypes.ParentNode

export interface HtmlProblem {
  readonly offset: number
  readonly message: string
}

/** Onde o marcador está, e portanto como o valor entra. */
export type MarkerPlace =
  /** No texto: o valor entra escapado. `inBody` diz se está no `<body>` da moldura. */
  | { readonly kind: 'text'; readonly inBody: boolean }
  /** Dentro de `<style>`: o valor entra como está, e um `<` é problema. */
  | { readonly kind: 'raw' }
  | { readonly kind: 'comment' }
  /** No valor de um atributo: quem reescreve é o atributo inteiro (`HtmlAttribute`). */
  | { readonly kind: 'attribute' }

/** Um atributo que precisa ser olhado: tem caminho ou tem marcador no valor. */
export interface HtmlAttribute {
  readonly name: string
  /** O valor já decodificado (`&amp;` → `&`). */
  readonly value: string
  /** O trecho do atributo inteiro, `nome="valor"`, que é trocado quando o valor muda. */
  readonly start: number
  readonly end: number
}

export interface HtmlSource {
  readonly problems: readonly HtmlProblem[]
  /** O lugar de cada marcador, pela posição de início; sem os que já deram problema. */
  readonly places: ReadonlyMap<number, MarkerPlace>
  readonly attributes: readonly HtmlAttribute[]
  /** Na moldura, a posição do `</head>` e do `</body>`, onde entram o CSS e o JS. */
  readonly headEnd?: number
  readonly bodyEnd?: number
}

/** Tags sem fechamento. */
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])
/** Tags que o HTML deixa sem fechar. */
const OPTIONAL_END = new Set([
  'html',
  'head',
  'body',
  'p',
  'li',
  'dt',
  'dd',
  'option',
  'optgroup',
  'rb',
  'rt',
  'rtc',
  'rp',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'colgroup',
  'caption'
])
/** Tags cujo texto não tem tags dentro (o `<` é texto). */
const RAW_TEXT = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'plaintext'
])
const DOCUMENT_ONLY = new Set(['html', 'head', 'body'])
/** Um `<` que, no texto, sempre abre uma tag, um comentário ou um doctype. */
const TAG_START = /<(\/?[A-Za-z]|!)/g
/** Erros de sintaxe que não atrapalham: a moldura não precisa de doctype. */
const IGNORED_ERRORS = new Set(['missing-doctype', 'non-conforming-doctype'])

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'duplicate-attribute': 'Atributo repetido na mesma tag.',
  'unknown-named-character-reference': 'Entidade desconhecida (como &foo;).',
  'missing-semicolon-after-character-reference': 'Falta o ; no fim da entidade.',
  'non-void-html-element-start-tag-with-trailing-solidus':
    'No HTML, /> não fecha esta tag: escreva a tag de fechamento.',
  'eof-in-tag': 'A tag não termina com > antes do fim do arquivo.',
  'eof-in-comment': 'O comentário não termina com -->.',
  'missing-attribute-value': 'Falta o valor do atributo depois do =.',
  'missing-whitespace-between-attributes': 'Falta um espaço entre os atributos.',
  'unexpected-character-in-attribute-name': 'Caractere inesperado no nome do atributo.',
  'unexpected-character-in-unquoted-attribute-value':
    'Caractere inesperado num valor sem aspas: use aspas.',
  'unexpected-equals-sign-before-attribute-name': 'Um = antes do nome do atributo.',
  'invalid-first-character-of-tag-name': 'Um < solto: escreva &lt;.',
  'end-tag-with-attributes': 'Uma tag de fechamento não tem atributos.',
  'missing-end-tag-name': 'Tag de fechamento sem nome (</>).',
  'eof-before-tag-name': 'Um < solto no fim do arquivo: escreva &lt;.',
  'incorrectly-opened-comment': 'Comentário mal aberto: use <!-- … -->.',
  'abrupt-closing-of-empty-comment': 'Comentário mal fechado: use <!-- … -->.',
  'nested-comment': 'Comentário dentro de comentário.'
}

/**
 * Lê o texto como fragmento (dentro de um `<section>`, como ele fica na página) ou como a
 * moldura (um documento inteiro), e acha o lugar de cada marcador.
 */
export function readHtmlSource(
  text: string,
  role: MarkerRole,
  markers: readonly Marker[]
): HtmlSource {
  const problems: HtmlProblem[] = []
  const onParseError = (error: ParserError): void => {
    if (IGNORED_ERRORS.has(error.code)) return
    problems.push({
      offset: error.startOffset,
      message: ERROR_MESSAGES[error.code] ?? `Erro de sintaxe do HTML (${error.code}).`
    })
  }
  const options = { sourceCodeLocationInfo: true, onParseError }
  const root: ParentNode =
    role === 'frame'
      ? parse(text, options)
      : parseFragment(defaultTreeAdapter.createElement('section', html.NS.HTML, []), text, options)

  const nodes = allNodes(root)
  const elements = nodes.filter(isElement)
  problems.push(...unclosedTags(text, elements))
  problems.push(...droppedTags(text, nodes, role))

  const source: HtmlSource = {
    problems,
    places: new Map(),
    attributes: attributesToCheck(elements, markers)
  }
  if (role === 'frame') {
    const head = elements.find((element) => element.tagName === 'head')
    const body = elements.find((element) => element.tagName === 'body')
    const headEnd = head?.sourceCodeLocation?.endTag?.startOffset
    const bodyEnd = body?.sourceCodeLocation?.endTag?.startOffset
    if (headEnd === undefined)
      problems.push({ offset: 0, message: 'A moldura precisa ter </head>.' })
    if (bodyEnd === undefined)
      problems.push({ offset: 0, message: 'A moldura precisa ter </body>.' })
    Object.assign(source, { headEnd, bodyEnd })
  }
  placeMarkers(text, nodes, markers, role, source.places as Map<number, MarkerPlace>, problems)
  problems.sort((a, b) => a.offset - b.offset)
  return source
}

function isElement(node: Node): node is Element {
  return 'tagName' in node
}

/** Todos os nós, na ordem do texto, inclusive o conteúdo dos `<template>`. */
function allNodes(root: ParentNode): Node[] {
  const nodes: Node[] = []
  const visit = (parent: ParentNode): void => {
    for (const child of parent.childNodes) {
      nodes.push(child)
      if ('childNodes' in child) visit(child)
      if ('content' in child) visit(child.content)
    }
  }
  visit(root)
  return nodes
}

function unclosedTags(text: string, elements: readonly Element[]): HtmlProblem[] {
  return elements.flatMap((element): HtmlProblem[] => {
    const location = element.sourceCodeLocation
    const start = location?.startTag
    const end = location?.endTag
    if (start === undefined && end !== undefined) {
      return [{ offset: end.startOffset, message: `</${element.tagName}> sem a tag de abertura.` }]
    }
    if (start === undefined || end !== undefined) return []
    if (VOID.has(element.tagName) || OPTIONAL_END.has(element.tagName)) return []
    // No SVG e no MathML, <circle/> fecha a tag.
    const selfClosing = text.slice(start.startOffset, start.endOffset).endsWith('/>')
    if (selfClosing && element.namespaceURI !== html.NS.HTML) return []
    return [
      {
        offset: start.startOffset,
        message: `A tag <${element.tagName}> é aberta aqui e não é fechada neste arquivo.`
      }
    ]
  })
}

/**
 * As tags que o navegador descarta: um `</section>` a mais, um `<td>` fora da tabela, um
 * `<body>` num fragmento. Elas não aparecem na árvore. Estão nos trechos que nenhum nó cobre
 * ou, quando ficam entre dois textos, dentro do trecho do texto (o parse5 junta os dois).
 */
function droppedTags(text: string, nodes: readonly Node[], role: MarkerRole): HtmlProblem[] {
  const covered: [number, number][] = []
  const inText: [number, number][] = []
  for (const node of nodes) {
    const location = node.sourceCodeLocation
    if (location === undefined || location === null) continue
    if (isElement(node)) {
      const { startTag, endTag } = node.sourceCodeLocation ?? {}
      if (startTag) covered.push([startTag.startOffset, startTag.endOffset])
      if (endTag) covered.push([endTag.startOffset, endTag.endOffset])
      continue
    }
    covered.push([location.startOffset, location.endOffset])
    const parent = 'parentNode' in node ? node.parentNode : null
    const rawParent = parent !== null && isElement(parent) && RAW_TEXT.has(parent.tagName)
    if (node.nodeName === '#text' && !rawParent)
      inText.push([location.startOffset, location.endOffset])
  }
  covered.sort((a, b) => a[0] - b[0])

  const starts: number[] = []
  let position = 0
  for (const [start, end] of covered) {
    if (start > position) starts.push(...tagStartsIn(text, position, start))
    position = Math.max(position, end)
  }
  if (position < text.length) starts.push(...tagStartsIn(text, position, text.length))
  // Um texto juntado pode passar por cima de tags que estão na árvore, como o </body> de uma
  // moldura (o texto depois dele vai para o body): o começo de uma tag da árvore não conta.
  const tagStarts = new Set(covered.map(([start]) => start))
  for (const [start, end] of inText) {
    starts.push(...tagStartsIn(text, start, end).filter((offset) => !tagStarts.has(offset)))
  }

  return [...new Set(starts)].map((offset) => ({
    offset,
    message: droppedMessage(text, offset, role)
  }))
}

function tagStartsIn(text: string, from: number, to: number): number[] {
  const slice = text.slice(from, to)
  return [...slice.matchAll(TAG_START)].map((match) => from + (match.index ?? 0))
}

function droppedMessage(text: string, offset: number, role: MarkerRole): string {
  const tag = /^<(\/?)(!doctype|[A-Za-z][^\s/>]*)/i.exec(text.slice(offset))
  if (tag === null) return 'O navegador ignora este trecho.'
  const [, slash, rawName] = tag
  const name = rawName.toLowerCase()
  if (role === 'fragment' && (name === '!doctype' || DOCUMENT_ONLY.has(name))) {
    return 'Um fragmento não pode ter <!doctype>, <html>, <head> nem <body>: eles ficam na moldura.'
  }
  if (slash === '/') return `</${name}> sem a tag de abertura, ou fechada fora de ordem.`
  return `O navegador ignora a tag <${name}> neste lugar.`
}

/** Os atributos com caminho e os que têm marcador no valor. */
function attributesToCheck(
  elements: readonly Element[],
  markers: readonly Marker[]
): HtmlAttribute[] {
  return elements.flatMap((element) => {
    const locations = element.sourceCodeLocation?.attrs
    if (locations === undefined) return []
    return element.attrs.flatMap((attribute): HtmlAttribute[] => {
      const location = locations[attribute.name]
      if (location === undefined) return []
      const { startOffset: start, endOffset: end } = location
      const hasMarker = markers.some((marker) => marker.start >= start && marker.start < end)
      if (!URL_ATTRIBUTES.has(attribute.name) && !hasMarker) return []
      return [{ name: attribute.name, value: attribute.value, start, end }]
    })
  })
}

function placeMarkers(
  text: string,
  nodes: readonly Node[],
  markers: readonly Marker[],
  role: MarkerRole,
  places: Map<number, MarkerPlace>,
  problems: HtmlProblem[]
): void {
  for (const marker of markers) {
    const place = placeOf(text, nodes, marker.start)
    const reserved = marker.target.kind === 'reserved' ? marker.target.name : null
    const problem = (message: string): void => {
      problems.push({ offset: marker.start, message })
    }
    if (place === 'tag') {
      problem('Um marcador não pode ficar dentro da tag, fora do valor de um atributo.')
    } else if (place === 'script') {
      problem('Marcadores não valem dentro de <script>.')
    } else if (place === null) {
      problem('O navegador ignora o trecho onde está este marcador.')
    } else if ((reserved === 'conteudo' || reserved === 'sumario') && role === 'fragment') {
      problem(`{{${reserved}}} só vale na moldura.`)
    } else if (
      (reserved === 'conteudo' || reserved === 'sumario') &&
      !(place.kind === 'text' && place.inBody)
    ) {
      problem(`{{${reserved}}} precisa ficar no texto do <body>.`)
    } else {
      places.set(marker.start, place)
    }
  }
}

function placeOf(
  text: string,
  nodes: readonly Node[],
  offset: number
): MarkerPlace | 'tag' | 'script' | null {
  for (const node of nodes) {
    if (isElement(node)) {
      const startTag = node.sourceCodeLocation?.startTag
      if (startTag && offset >= startTag.startOffset && offset < startTag.endOffset) {
        const attrs = node.sourceCodeLocation?.attrs ?? {}
        // Só no valor, depois do "=": no nome, o marcador viraria um atributo com esse nome.
        const inAttribute = Object.values(attrs).some((location) => {
          const equals = text.indexOf('=', location.startOffset)
          return (
            equals >= 0 &&
            equals < location.endOffset &&
            offset > equals &&
            offset < location.endOffset
          )
        })
        return inAttribute ? { kind: 'attribute' } : 'tag'
      }
      continue
    }
    const location = node.sourceCodeLocation
    if (!location || offset < location.startOffset || offset >= location.endOffset) continue
    if (node.nodeName === '#comment') return { kind: 'comment' }
    if (node.nodeName !== '#text') return null
    const parent = 'parentNode' in node ? node.parentNode : null
    const parentTag = parent !== null && isElement(parent) ? parent.tagName : null
    if (parentTag === 'script') return 'script'
    if (parentTag === 'style') return { kind: 'raw' }
    return { kind: 'text', inBody: isInBody(node) }
  }
  return null
}

function isInBody(node: Node): boolean {
  for (let current: Node | null = node; current !== null;) {
    if (isElement(current) && current.tagName === 'body') return true
    current = 'parentNode' in current ? current.parentNode : null
  }
  return false
}
