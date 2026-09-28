import type { Asset } from '../assets/asset-catalog'
import { fragmentFormat } from '../fragments/fragment-format'
import type { GenerationPlan, PlannedSection } from '../generation/generation-plan'

/*
 * A montagem do conteúdo da página (SPEC §4.4, Fase 7): as seções aninhadas como a árvore,
 * com os fragmentos HTML, e o sumário. Os textos dos fragmentos já chegam prontos (marcadores
 * e caminhos trocados): aqui só se junta, sem recuo, para não mudar o conteúdo de um `<pre>`.
 */

export function escapeHtmlText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function escapeHtmlAttribute(text: string): string {
  return escapeHtmlText(text).replaceAll('"', '&quot;')
}

/** Os fragmentos HTML da seção, na ordem do assets.xml. */
export function htmlFragmentsOf(section: PlannedSection): Asset[] {
  return section.fragments.filter((asset) => fragmentFormat(asset.path) === 'html')
}

/** Todos os fragmentos HTML do plano, na ordem da página. */
export function planHtmlFragments(section: PlannedSection): Asset[] {
  return [...htmlFragmentsOf(section), ...section.children.flatMap(planHtmlFragments)]
}

/**
 * As seções, a partir da `section`: um `<section id>` por feature selecionada, também sem
 * conteúdo, com os fragmentos e depois as seções das filhas. `textOf` dá o texto pronto de
 * cada fragmento, sem quebra de linha no fim.
 */
export function sectionsHtml(section: PlannedSection, textOf: (asset: Asset) => string): string {
  const parts = [
    `<section id="${escapeHtmlAttribute(section.featureId)}">`,
    ...htmlFragmentsOf(section).map(textOf),
    ...section.children.map((child) => sectionsHtml(child, textOf)),
    '</section>'
  ]
  return parts.join('\n')
}

/** A subárvore tem algum fragmento HTML: só assim a feature entra no sumário. */
function hasContent(section: PlannedSection): boolean {
  return htmlFragmentsOf(section).length > 0 || section.children.some(hasContent)
}

/** O sumário: as features selecionadas com conteúdo, menos a raiz, aninhadas como a árvore. */
export function tableOfContents(plan: GenerationPlan): string {
  const names = new Map(plan.features.map((feature) => [feature.id, feature.name]))
  const list = (sections: readonly PlannedSection[]): string[] => {
    const shown = sections.filter(hasContent)
    if (shown.length === 0) return []
    return [
      '<ol>',
      ...shown.flatMap((section) => {
        const link = `<a href="#${escapeHtmlAttribute(section.featureId)}">${escapeHtmlText(names.get(section.featureId) ?? section.featureId)}</a>`
        const children = list(section.children)
        return children.length === 0 ? [`<li>${link}</li>`] : [`<li>${link}`, ...children, '</li>']
      }),
      '</ol>'
    ]
  }
  return ['<nav class="sumario">', ...list(plan.root.children), '</nav>'].join('\n')
}
