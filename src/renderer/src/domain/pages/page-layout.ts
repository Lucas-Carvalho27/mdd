/*
 * Os nomes fixos da página (SPEC §4.4, Fase 7): a moldura, opcional, fica na raiz do projeto,
 * e a página gerada fica na raiz da pasta do produto, ao lado do product.xml.
 */

export const FRAME_PATH = 'moldura.html'
export const PAGE_PATH = 'index.html'
export const PRODUCT_PATH = 'product.xml'

/** A moldura quando o projeto não tem `moldura.html`, e o texto de uma moldura nova. */
export const DEFAULT_FRAME = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{produto}}</title>
</head>
<body>
{{conteudo}}
</body>
</html>
`

/** O arquivo é a moldura (na raiz, sem diferenciar caixa, como no Windows). */
export function isFramePath(path: string): boolean {
  return path.toLowerCase() === FRAME_PATH
}
