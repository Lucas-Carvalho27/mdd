/*
 * Converte o herby original (XML, em C:/Users/lucas/Desktop/herby) no exemplo
 * docs/examples/herby (HTML), conforme a spec da Fase 7. O original só é lido.
 *
 *   npx tsx --tsconfig tsconfig.web.json .checks/herby-convert.mts tabela
 *     mostra a tabela perfil × features e o estado de cada configuração; não grava nada.
 *   npx tsx --tsconfig tsconfig.web.json .checks/herby-convert.mts gravar
 *     grava o exemplo (menos a moldura.html e o css/herby.css, escritos à mão).
 *   … fragmentos
 *     como gravar, mas sem as configurações.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Element, Node } from '@xmldom/xmldom'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import type { Asset } from '@/domain/assets/asset-catalog'
import type { AttributeValue, Configuration, ManualDecision } from '@/domain/configuration/configuration'
import { configurationStatus, isSelected, type ConfigurationStatus } from '@/domain/configuration/resolution'
import type { Attribute, Feature, FeatureChild, FeatureModel } from '@/domain/feature-model/feature-model'
import { childFeatures, featuresInPreOrder } from '@/domain/feature-model/traversal'
import { validateFeatureModel } from '@/domain/feature-model/validation'
import { configurationKey } from '@/domain/project/configuration-entries'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { decodeAssetCatalog, encodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { encodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel, encodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'

const ORIGINAL = 'C:/Users/lucas/Desktop/herby'
const ORIGINAL_FRAGMENTS = `${ORIGINAL}/Fragmentos XML`
const TARGET = 'docs/examples/herby'
const FRAGMENTS_DIRECTORY = 'fragmentos'
const mode = process.argv[2] ?? 'tabela'

/** O arquivo do fragmento (sem .xml) → a feature do modelo. */
const FEATURE_OF: Record<string, string> = {
  plataforma: 'herby',
  preparacao: 'preparacao',
  'acesso-plataforma': 'acesso_a_plataforma',
  'informacoes-gerais': 'informacoes_gerais',
  'gestao-base-dados': 'gestao_da_base_de_dados',
  lixeira: 'lixeira',
  'sincronizacao-dados': 'sincronizacao_rede_estadual',
  'template-dados': 'template_de_dados',
  impressao: 'impressao_dos_cartoes',
  'impressao-herby': 'impressao_na_herby',
  'impressao-sistema-externo': 'impressao_no_saev',
  'aplicacao-correcao': 'aplicacao_e_correcao',
  'processamento-foto': 'processamento_por_foto',
  'educacao-especial': 'educacao_especial',
  'avaliacao-fluencia': 'avaliacao_de_fluencia_audio',
  'correcao-ia-fluencia': 'correcao_por_ia',
  'monitoramento-resultados': 'monitoramento_e_resultados',
  progresso: 'progresso',
  resultados: 'resultados',
  'resultados-detalhados': 'resultados_detalhados',
  relatorios: 'relatorios',
  graficos: 'graficos',
  'qrcode-resultados': 'qr_code_de_resultados'
}

/** A correção do nome e do ID (Q41). */
const RENAMED = { from: 'educacao_especia', to: 'educacao_especial', name: 'Educação Especial' }

/** Obrigatórias no original, mas seis decks não as têm (Q43): viram opcionais. */
const MADE_OPTIONAL = new Set(['preparacao', 'acesso_a_plataforma', 'impressao_dos_cartoes'])

/** Onde fica cada variável (Q34); as que não estão aqui ficam na raiz. */
const OWNER_OF_VARIABLE: Record<string, string> = {
  avaliacao: 'informacoes_gerais',
  data_treinamento: 'informacoes_gerais',
  prazo_envio_template: 'informacoes_gerais',
  data_liberacao_cartoes: 'informacoes_gerais',
  url_template: 'template_de_dados',
  contato_operacoes: 'template_de_dados'
}
const ROOT = 'herby'

/** O nome de exibição de cada perfil; a chave da configuração sai dele, como no app. */
const PROFILE_NAMES: Record<string, string> = {
  completa: 'Completa',
  'completa-atibaia': 'Completa Atibaia',
  'rondonia-primeiros-passos': 'Rondônia Primeiros Passos',
  'rondonia-paic-proalfa': 'Rondônia PAIC PROALFA',
  epv: 'EPV',
  'fgv-formularios': 'FGV Formulários',
  'fluencia-saev': 'Fluência SAEV',
  'fluencia-legado': 'Fluência Legado',
  'sed-com-detalhes': 'SED com detalhes',
  'sed-sem-detalhes': 'SED sem detalhes',
  'sem-gestao-base': 'Sem gestão da base',
  'sem-resultados-detalhados': 'Sem resultados detalhados',
  'resultados-ia-fluencia': 'Resultados da IA de Fluência'
}

// ---------- leitura do original ----------

function readXml(path: string): Element {
  return parseXmlRoot(readFileSync(path, 'utf8'))
}

function elements(parent: Element): Element[] {
  const result: Element[] = []
  for (let index = 0; index < parent.childNodes.length; index++) {
    const node = parent.childNodes[index]
    if (node.nodeType === 1) result.push(node as Element)
  }
  return result
}

function attr(element: Element, name: string): string | undefined {
  return element.hasAttribute(name) ? element.getAttribute(name)! : undefined
}

interface Variable {
  readonly name: string
  readonly defaultValue: string
  readonly description: string
  readonly byProfile: ReadonlyMap<string, string>
}

const variables: Variable[] = elements(readXml(`${ORIGINAL_FRAGMENTS}/_variaveis.xml`)).map((node) => ({
  name: attr(node, 'nome')!,
  defaultValue: attr(node, 'padrao') ?? '',
  description: attr(node, 'descricao') ?? attr(node, 'nome')!,
  byProfile: new Map(elements(node).map((value) => [attr(value, 'perfil')!, value.textContent ?? '']))
}))
const variableByName = new Map(variables.map((variable) => [variable.name, variable]))
const ownerOf = (name: string): string => OWNER_OF_VARIABLE[name] ?? ROOT

interface SourceFragment {
  readonly base: string
  readonly featureId: string
  readonly root: Element
  /** Os perfis citados no <origem slides="perfil#n …"> de qualquer bloco. */
  readonly profiles: ReadonlySet<string>
}

const sources: SourceFragment[] = readdirSync(ORIGINAL_FRAGMENTS)
  .filter((name) => name.endsWith('.xml') && !name.startsWith('_'))
  .map((name) => {
    const base = name.slice(0, -'.xml'.length)
    const featureId = FEATURE_OF[base]
    if (featureId === undefined) throw new Error(`Fragmento sem feature: ${name}`)
    const root = readXml(`${ORIGINAL_FRAGMENTS}/${name}`)
    const profiles = new Set<string>()
    for (const origin of Array.from(root.getElementsByTagName('origem'))) {
      for (const slide of (attr(origin, 'slides') ?? '').split(/\s+/).filter(Boolean)) {
        profiles.add(slide.split('#')[0])
      }
    }
    return { base, featureId, root, profiles }
  })

// ---------- modelo ----------

function withVariables(feature: Feature): Feature {
  const renamed = {
    ...(feature.id === RENAMED.from ? { ...feature, id: RENAMED.to, name: RENAMED.name } : feature),
    ...(MADE_OPTIONAL.has(feature.id) ? { variability: 'optional' as const } : {})
  }
  const attributes: Attribute[] = variables
    .filter((variable) => ownerOf(variable.name) === renamed.id)
    .map((variable) => ({
      id: variable.name,
      name: variable.description,
      type: 'string',
      defaultValue: variable.defaultValue,
      configurable: true,
      options: []
    }))
  const children: FeatureChild[] = renamed.children.map((child) =>
    child.kind === 'feature'
      ? { kind: 'feature', feature: withVariables(child.feature) }
      : { kind: 'group', group: { ...child.group, members: child.group.members.map(withVariables) } }
  )
  return { ...renamed, attributes: [...renamed.attributes, ...attributes], children }
}

const decodedModel = decodeFeatureModel(readXml(`${ORIGINAL}/model.xml`))
if (!decodedModel.ok) throw new Error(JSON.stringify(decodedModel.error))
const model: FeatureModel = { ...decodedModel.value, root: withVariables(decodedModel.value.root) }
const modelIssues = validateFeatureModel(model)
if (modelIssues.length > 0) throw new Error(`Modelo inválido: ${JSON.stringify(modelIssues)}`)

const preorder = featuresInPreOrder(model.root)
const depthOf = new Map<string, number>()
const parentOf = new Map<string, string>()
const measure = (feature: Feature, depth: number): void => {
  depthOf.set(feature.id, depth)
  for (const child of childFeatures(feature)) {
    parentOf.set(child.id, feature.id)
    measure(child, depth + 1)
  }
}
measure(model.root, 0)
for (const source of sources) {
  if (!depthOf.has(source.featureId)) throw new Error(`Feature inexistente: ${source.featureId}`)
}

// ---------- fragmentos HTML ----------

const escapeText = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const escapeAttribute = (text: string): string => escapeText(text).replaceAll('"', '&quot;')
const indent = (line: string): string => (line === '' ? '' : `  ${line}`)

function marker(name: string): string {
  if (!variableByName.has(name)) throw new Error(`Variável desconhecida: ${name}`)
  return `{{${ownerOf(name)}.${name}}}`
}

/** O conteúdo de um elemento de texto: texto, <destaque>, <ui> e <var>. */
function inline(element: Element): string {
  let html = ''
  for (let index = 0; index < element.childNodes.length; index++) {
    const node: Node = element.childNodes[index]
    if (node.nodeType === 3) {
      html += escapeText((node.nodeValue ?? '').replace(/\s*\n\s*/g, ' '))
      continue
    }
    if (node.nodeType !== 1) continue
    const child = node as Element
    switch (child.localName) {
      case 'destaque':
        html += `<strong>${inline(child)}</strong>`
        break
      case 'ui':
        html += `<span class="ui">${inline(child)}</span>`
        break
      case 'var':
        html += marker(attr(child, 'nome')!)
        break
      default:
        throw new Error(`Elemento inesperado no texto: <${child.localName}>`)
    }
  }
  return html.trim()
}

/** O elemento com `perfis` vai para dentro de um <template>, que o navegador não mostra (Q37). */
function withProfiles(element: Element, lines: string[]): string[] {
  const profiles = attr(element, 'perfis')
  if (profiles === undefined) return lines
  return [`<template data-perfis="${escapeAttribute(profiles)}">`, ...lines.map(indent), '</template>']
}

function image(element: Element): string[] {
  const img = `<img src="${escapeAttribute(attr(element, 'src')!)}" alt="${escapeAttribute(attr(element, 'alt') ?? '')}">`
  const caption = elements(element).find((child) => child.localName === 'legenda')
  const lines = caption
    ? ['<figure>', indent(img), indent(`<figcaption>${inline(caption)}</figcaption>`), '</figure>']
    : [img]
  return withProfiles(element, lines)
}

function list(element: Element): string[] {
  const tag = attr(element, 'tipo') === 'numerada' ? 'ol' : 'ul'
  return [`<${tag}>`, ...elements(element).map((item) => indent(`<li>${inline(item)}</li>`)), `</${tag}>`]
}

function table(element: Element): string[] {
  const row = (cells: Element[], tag: string): string[] => [
    '<tr>',
    ...cells.map((cell) => indent(`<${tag}>${inline(cell)}</${tag}>`)),
    '</tr>'
  ]
  const header = elements(element).filter((child) => child.localName === 'cabecalho')
  const rows = elements(element).filter((child) => child.localName === 'linha')
  return [
    '<table>',
    ...(header.length > 0
      ? [indent('<thead>'), ...header.flatMap((line) => row(elements(line), 'th')).map((l) => indent(indent(l))), indent('</thead>')]
      : []),
    indent('<tbody>'),
    ...rows.flatMap((line) => row(elements(line), 'td')).map((l) => indent(indent(l))),
    indent('</tbody>'),
    '</table>'
  ]
}

function contents(element: Element): string[] {
  return elements(element).flatMap((child): string[] => {
    switch (child.localName) {
      case 'texto':
        return [`<p>${inline(child)}</p>`]
      case 'imagem':
        return image(child)
      case 'lista':
        return list(child)
      case 'tabela':
        return table(child)
      case 'legenda':
        return [`<p class="legenda">${inline(child)}</p>`]
      case 'origem':
        return []
      default:
        throw new Error(`Elemento inesperado em <${element.localName}>: <${child.localName}>`)
    }
  })
}

function block(element: Element, level: number): string[] {
  const id = escapeAttribute(attr(element, 'id')!)
  const heading = (text: string): string => `<h${level}>${text}</h${level}>`
  const title = attr(element, 'titulo')
  let lines: string[]
  switch (element.localName) {
    case 'secao':
      lines = [
        `<section class="secao" id="${id}">`,
        ...(title !== undefined ? [indent(heading(escapeText(title)))] : []),
        ...contents(element).map(indent),
        '</section>'
      ]
      break
    case 'passo':
      lines = [
        `<section class="passo" id="${id}">`,
        indent(heading(`Passo ${escapeText(attr(element, 'n')!)} — ${escapeText(title ?? '')}`)),
        ...contents(element).map(indent),
        '</section>'
      ]
      break
    case 'aviso':
      lines = [
        `<aside class="aviso ${escapeAttribute(attr(element, 'tipo') ?? '')}" id="${id}">`,
        ...contents(element).map(indent),
        '</aside>'
      ]
      break
    default:
      throw new Error(`Bloco inesperado: <${element.localName}>`)
  }
  return withProfiles(element, lines)
}

function toHtml(source: SourceFragment): string {
  const level = Math.min(2 + depthOf.get(source.featureId)!, 5)
  const lines: string[] = []
  for (const child of elements(source.root)) {
    switch (child.localName) {
      case 'titulo':
        lines.push(`<h${level}>${inline(child)}</h${level}>`)
        break
      case 'resumo':
        lines.push(`<p class="resumo">${inline(child)}</p>`)
        break
      default:
        lines.push('', ...block(child, Math.min(level + 1, 6)))
    }
  }
  return `${lines.join('\n')}\n`
}

/** O texto do título, com as variáveis no valor padrão: vira o nome do asset. */
function plainTitle(source: SourceFragment): string {
  const title = elements(source.root).find((child) => child.localName === 'titulo')!
  return inline(title).replace(/\{\{[a-z_]+\.([a-z_]+)\}\}/g, (_, name: string) => variableByName.get(name)!.defaultValue)
}

// ---------- assets ----------

const decodedAssets = decodeAssetCatalog(readXml(`${ORIGINAL}/assets.xml`))
if (!decodedAssets.ok) throw new Error(JSON.stringify(decodedAssets.error))
const fragmentAssets: Asset[] = sources.map((source) => ({
  id: source.base.replaceAll('-', '_'),
  kind: 'fragment',
  path: `${FRAGMENTS_DIRECTORY}/${source.base}.html`,
  anchor: source.featureId,
  name: plainTitle(source)
}))
const cssAsset: Asset = { id: 'css_herby', kind: 'resource', path: 'css/herby.css', anchor: ROOT, name: 'Estilo da página' }
/** Agrupados pela âncora, na pré-ordem do modelo (SPEC §4.3). */
const assets: Asset[] = preorder.flatMap((feature) => [
  ...fragmentAssets.filter((asset) => asset.anchor === feature.id),
  ...(feature.id === ROOT ? [cssAsset] : []),
  ...decodedAssets.value.assets.filter((asset) => asset.anchor === feature.id)
])

// ---------- configurações ----------

const allProfiles = [
  ...new Set([
    ...Object.keys(PROFILE_NAMES),
    ...sources.flatMap((source) => [...source.profiles]),
    ...variables.flatMap((variable) => [...variable.byProfile.keys()])
  ])
]

/** As features do perfil pelo <origem>, com os ancestrais (um filho implica o pai) e a raiz. */
function wantedFeatures(profile: string): Set<string> {
  const wanted = new Set<string>([ROOT])
  for (const source of sources) {
    if (!source.profiles.has(profile)) continue
    for (let id: string | undefined = source.featureId; id !== undefined; id = parentOf.get(id)) wanted.add(id)
  }
  return wanted
}

interface BuiltConfiguration {
  readonly profile: string
  readonly key: string
  readonly configuration: Configuration
  readonly wanted: ReadonlySet<string>
  readonly selected: ReadonlySet<string>
  readonly notes: readonly string[]
  readonly status: ConfigurationStatus
}

const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const takenKeys = new Set<string>()

function buildConfiguration(profile: string): BuiltConfiguration {
  const name = PROFILE_NAMES[profile] ?? profile
  const key = configurationKey(name, takenKeys)
  takenKeys.add(key)
  const wanted = wantedFeatures(profile)
  const values: AttributeValue[] = []
  for (const feature of preorder) {
    if (!wanted.has(feature.id)) continue
    for (const attribute of feature.attributes) {
      const value = variableByName.get(attribute.id)?.byProfile.get(profile)
      if (value !== undefined) values.push({ featureId: feature.id, attributeId: attribute.id, value })
    }
  }
  let decisions: ManualDecision[] = []
  const notes: string[] = []
  const configurationWith = (list: ManualDecision[]): Configuration => ({ name, decisions: list, values })

  // Em pré-ordem, decide só o que continua indeciso: o arquivo fica com as decisões mínimas.
  for (const feature of preorder) {
    const resolution = resolver.execute(model, configurationWith(decisions))
    if (resolution.kind !== 'resolved') break
    const status = resolution.features.get(feature.id)!
    const want = wanted.has(feature.id)
    if (status.kind === 'undecided') {
      const attempt = [...decisions, { featureId: feature.id, state: want ? 'selected' : 'deselected' } as const]
      if (resolver.execute(model, configurationWith(attempt)).kind === 'conflict') {
        notes.push(`${feature.id}: ${want ? 'selecionar' : 'excluir'} dá conflito com o modelo`)
      } else {
        decisions = attempt
      }
    } else if (isSelected(status) !== want) {
      notes.push(
        `${feature.id}: o modelo ${isSelected(status) ? 'obriga a ter' : 'impede'}, mas o <origem> ${want ? 'tem' : 'não tem'} slides do perfil`
      )
    }
  }
  const configuration = configurationWith(decisions)
  const resolution = resolver.execute(model, configuration)
  const selected = new Set(
    resolution.kind === 'resolved'
      ? [...resolution.features].filter(([, status]) => isSelected(status)).map(([id]) => id)
      : []
  )
  return { profile, key, configuration, wanted, selected, notes, status: configurationStatus(resolution) }
}

const configurations = allProfiles.map(buildConfiguration)

// ---------- saída ----------

function printTable(): void {
  const header = configurations.map((_, index) => `${index + 1}`)
  console.log(`| Feature | ${header.join(' | ')} |`)
  console.log(`| --- | ${header.map(() => ':-:').join(' | ')} |`)
  for (const feature of preorder) {
    const cells = configurations.map((built) => {
      const want = built.wanted.has(feature.id)
      const has = built.selected.has(feature.id)
      if (want === has) return has ? '✓' : '·'
      return has ? '✓!' : '✗!'
    })
    const label = `${'  '.repeat(depthOf.get(feature.id)!)}${feature.name}`
    console.log(`| ${label} | ${cells.join(' | ')} |`)
  }
  console.log('')
  configurations.forEach((built, index) => {
    const { status } = built
    const state = !status.valid
      ? 'em conflito'
      : status.complete
        ? 'completa'
        : `incompleta (${status.undecidedCount} indecisas, ${status.missingValueCount} sem valor)`
    console.log(`${index + 1}. ${built.configuration.name} (${built.key}.xml, perfil "${built.profile}"): ${state}`)
    for (const note of built.notes) console.log(`   - ${note}`)
    for (const value of built.configuration.values) console.log(`   · ${value.featureId}.${value.attributeId} = ${value.value}`)
  })
  const hidden = sources.reduce((total, source) => total + source.root.getElementsByTagName('*').length, 0)
  console.log(`\n${sources.length} fragmentos, ${hidden} elementos, ${assets.length} assets, ${allProfiles.length} perfis.`)
}

function copyTree(from: string, to: string): number {
  let count = 0
  for (const name of readdirSync(from)) {
    const source = join(from, name)
    const target = join(to, name)
    if (statSync(source).isDirectory()) {
      count += copyTree(source, target)
    } else {
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(source, target)
      count++
    }
  }
  return count
}

function write(): void {
  const write = (path: string, content: string): void => {
    const full = `${TARGET}/${path}`
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content, 'utf8')
  }
  // A moldura e o CSS são escritos à mão: sobrevivem a uma nova conversão.
  for (const generated of ['model.xml', 'assets.xml', 'configurations', FRAGMENTS_DIRECTORY, 'Slides por Feature']) {
    rmSync(`${TARGET}/${generated}`, { recursive: true, force: true })
  }
  write('model.xml', encodeFeatureModel(model))
  write('assets.xml', encodeAssetCatalog({ assets }))
  const written = mode === 'gravar' ? configurations : []
  for (const built of written) write(`configurations/${built.key}.xml`, encodeConfiguration(built.configuration))
  for (const source of sources) write(`${FRAGMENTS_DIRECTORY}/${source.base}.html`, toHtml(source))
  const images = copyTree(`${ORIGINAL_FRAGMENTS}/img`, `${TARGET}/${FRAGMENTS_DIRECTORY}/img`)
  const slides = copyTree(`${ORIGINAL}/Slides por Feature`, `${TARGET}/Slides por Feature`)
  console.log(`gravado: ${sources.length} fragmentos, ${written.length} configurações, ${images} imagens, ${slides} arquivos de slides`)
  for (const handWritten of ['moldura.html', 'css/herby.css']) {
    if (!existsSync(`${TARGET}/${handWritten}`)) console.log(`falta escrever à mão: ${handWritten}`)
  }
}

if (mode === 'tabela') printTable()
else if (mode === 'gravar' || mode === 'fragmentos') write()
else throw new Error(`Modo desconhecido: ${mode}`)
