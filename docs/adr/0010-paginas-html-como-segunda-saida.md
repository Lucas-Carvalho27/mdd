# Páginas HTML como segunda saída da geração

Além do `product.xml`, a geração monta uma página, `saida/<nome>/index.html`, quando o projeto tem fragmentos HTML (Fase 7). Os fragmentos HTML são escritos à mão, em arquivos `.html` só com o conteúdo, e a página é a moldura do projeto (`moldura.html`, opcional) com as seções das features selecionadas. O app continua sem conhecer vocabulário nenhum: o HTML é o próprio formato de saída. A página é mais um `ProductDeriver` (`HtmlPageDeriver`), ao lado do `XmlProductDeriver`, e o `CombinedProductDeriver` junta os dois sem mudar a porta.

## Considered Options

- **Converter os fragmentos XML em HTML**, com uma folha XSLT (ou um mapeamento) guardada no projeto. O XML continuaria a fonte, mas cada projeto teria de escrever e manter a conversão, e o app precisaria de uma biblioteca de XSLT. No herby, o exemplo desta fase, o XML não alimentava mais nada, e ele passou a ter o HTML como fonte.
- **XHTML** (HTML com a sintaxe rígida do XML), embutido no `product.xml`. Obrigaria a escrever `<br/>` e a fechar toda tag, sem ganho.

## Consequences

- **Os marcadores são a exceção ao "fragmento intacto" (ADR 0006), só no HTML.** `{{feature.atributo}}` vira o valor do atributo, com o escape do HTML; `{{produto}}`, o nome da configuração; `{{conteudo}}` e `{{sumario}}`, na moldura, as seções e o sumário. O resto do texto entra como o autor escreveu: a geração troca só os trechos dos marcadores e dos caminhos. O fragmento XML continua entrando intacto no `product.xml`.
- **Os caminhos dos fragmentos HTML são relativos à pasta do arquivo**, como os do XML com o `xml:base`. A geração os reescreve para o `index.html`, que fica na raiz da pasta do produto, nos atributos `src`, `href`, `srcset` e `poster`, porque ali o app sabe quais atributos são links (no XML, não sabe).
- **Os arquivos citados vão para a saída sem precisar de asset.** Uma imagem citada por um fragmento entra quando o fragmento entra. Os recursos continuam servindo para o que não é citado, como um `.css` ancorado numa feature, que entra sozinho no `<head>` quando ela está selecionada.
- **A conferência de um fragmento HTML usa o parse5**, o parser de HTML do padrão, com as posições no texto. O HTML normal é aceito (`<br>`, `&nbsp;`, atributo sem aspas), mas uma tag aberta e não fechada no arquivo é problema, porque engoliria as seções seguintes da página. O parse5 não acusa as tags que descarta (um `</section>` a mais, um `<body>` num fragmento): elas são achadas pelo que a árvore não cobre.
- **O editor de fragmentos abre também `.html`**, com o `@codemirror/lang-html`, a cor dos marcadores e a sugestão depois de `{{` (ADR 0009). O `.css` e o `.js` continuam abrindo fora do app.
- **O `index.html` não leva a hora da geração**: duas gerações iguais dão arquivos idênticos, e a aceitação compara byte a byte.
- A visualização da Fase 8 reaproveita o `HtmlPageDeriver`, montando a mesma página na memória.
