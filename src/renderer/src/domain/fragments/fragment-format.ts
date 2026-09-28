import { DEFAULT_FRAME, isFramePath } from '../pages/page-layout'

/*
 * Os dois formatos de fragmento (Fase 7): o XML, embutido no product.xml, e o HTML, que monta
 * a página. O formato sai da extensão, sem diferenciar caixa.
 */

export type FragmentFormat = 'xml' | 'html'

const EXTENSIONS: Readonly<Record<FragmentFormat, string>> = { xml: '.xml', html: '.html' }

/** O formato do arquivo, ou `null` quando ele não é um fragmento. */
export function fragmentFormat(path: string): FragmentFormat | null {
  const lower = path.toLowerCase()
  if (lower.endsWith(EXTENSIONS.xml)) return 'xml'
  if (lower.endsWith(EXTENSIONS.html)) return 'html'
  return null
}

/**
 * O texto de um fragmento novo. O XML começa só com a declaração: o app não inventa uma raiz,
 * porque a geração não impõe vocabulário (ADR 0006). O HTML começa vazio, e a moldura, com a
 * moldura padrão.
 */
export function initialFragmentText(path: string): string {
  if (isFramePath(path)) return DEFAULT_FRAME
  return fragmentFormat(path) === 'html' ? '' : '<?xml version="1.0" encoding="UTF-8"?>\n'
}
