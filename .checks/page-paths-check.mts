// Os caminhos citados pela página (Fase 7): relativos à pasta do arquivo, reescritos para o index.html.
//   npx tsx --tsconfig tsconfig.web.json .checks/page-paths-check.mts
import { formatSrcset, pageUrl, resolveCitedUrl, srcsetCandidates } from '@/domain/pages/page-paths'

const cases: [string, string][] = [
  ['docs/pagamento/pix.html', '../img/pix-fluxo.svg'],
  ['docs/pagamento/pix.html', 'img/a.png?v=2#topo'],
  ['docs/pagamento/pix.html', './guia.pdf'],
  ['docs/pagamento/pix.html', 'Slides%20por%20Feature/06.pptx'],
  ['docs/pagamento/pix.html', '..\\img\\b.png'],
  ['moldura.html', 'css/site.css'],
  ['moldura.html', '  css/site.css  '],
  ['docs/pix.html', '../../fora.png'],
  ['docs/pix.html', '/img/a.png'],
  ['docs/pix.html', 'https://exemplo.com/a.png'],
  ['docs/pix.html', '//cdn.exemplo.com/a.js'],
  ['docs/pix.html', 'mailto:a@b.com'],
  ['docs/pix.html', 'tel:+5532999'],
  ['docs/pix.html', 'data:image/png;base64,AAAA'],
  ['docs/pix.html', 'javascript:void(0)'],
  ['docs/pix.html', '#pagamento'],
  ['docs/pix.html', '?aba=2'],
  ['docs/pix.html', ''],
  ['docs/pix.html', '..']
]
for (const [from, url] of cases) {
  const cited = resolveCitedUrl(from, url)
  const shown = cited.kind === 'file' ? `file ${cited.path} → ${pageUrl(cited.path, cited.suffix)}` : cited.kind
  console.log(`${from} + ${JSON.stringify(url)} → ${shown}`)
}
console.log(`pageUrl: ${pageUrl('Slides por Feature/06 - Acesso à Plataforma.pptx', '')}`)
console.log(`pageUrl: ${pageUrl('docs/100%/a#b?.png', '#x')}`)
const candidates = srcsetCandidates(' img/a.png 1x,img/b.png   2x , img/c.png ')
console.log(`srcset: ${JSON.stringify(candidates)} → ${formatSrcset(candidates)}`)
