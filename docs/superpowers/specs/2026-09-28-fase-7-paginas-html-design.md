# Fase 7 — Páginas HTML: desenho

Aprovado em 28/09/2026, numa sessão de perguntas e respostas com o usuário (42 decisões). Não estava no roadmap: o usuário pediu, além do XML, páginas web montadas de acordo com cada configuração, e uma aba para vê-las dentro do app. O pedido virou duas fases: esta, que gera a página, e a Fase 8, que a mostra (veja "Fase 8, decidida junto" no fim).

O exemplo das duas fases é o projeto real do usuário, o **herby** (tutoriais da plataforma Herby), convertido de XML para HTML. O repositório ficou privado em 28/09/2026 para recebê-lo.

> O protótipo (branch local `prototipo-fase-7`, no clone descartável) refinou alguns pontos, já corrigidos abaixo: os marcadores nos comentários, a detecção das tags que o parse5 descarta, os módulos da arquitetura e a colisão de um arquivo citado. Veja "O que o protótipo respondeu".

## Objetivo

Escrever fragmentos em **HTML** e gerar, para cada configuração completa, uma **página** `saida/<nome>/index.html`: a moldura do projeto com as seções das features selecionadas, os valores dos atributos no texto, o sumário e os arquivos que a página cita. O XML continua como está.

**Aceitação**, sobre o exemplo `herby`:

1. A aba Fragmentos mostra os 23 `.html` de `fragmentos/` e a `moldura.html`, com realce de HTML. A aba Assets mostra os assets do exemplo, todos ok.
2. Gerar `completa-atibaia` produz um `index.html` idêntico, byte a byte, ao de `produto-esperado/herby-completa-atibaia/`. A pasta também tem o `herby.css` e as imagens citadas, com a mesma estrutura de pastas.
3. Trocar no configurador o valor de `contato_whatsapp` e gerar de novo muda o número no rodapé da página.
4. Apagar o `</section>` de uma seção de um fragmento: o editor mostra o problema com a linha da tag aberta, e a geração recusa o arquivo.
5. Um marcador de uma feature que não está selecionada na configuração (por exemplo, `{{template_de_dados.url_template}}` num fragmento de outra feature) faz a geração recusar, com o arquivo, a linha e o marcador.
6. Uma imagem citada que não existe faz a geração recusar, com o arquivo e a linha.
7. Regressão: gerar `loja-basica` do `loja-online` continua dando o `product.xml` de antes e **não** cria `index.html` (o projeto não tem fragmento HTML).
8. Checagem à mão com o usuário: abrir o `index.html` gerado no navegador, a aparência da página e a página numa janela estreita (celular).

**Não muda:**

- os formatos de `model.xml`, `assets.xml` e das configurações, e os schemas;
- o `product.xml`: continua saindo sempre, só com os fragmentos XML;
- as conferências e o editor dos fragmentos XML;
- as abas Modelo, Configurações e Assets, a não ser pelo tipo sugerido ao vincular um `.html`.

**Fora desta fase:**

- a aba Páginas (Fase 8);
- a variabilidade anotativa (os `perfis` do herby): Fase 9, depois da aba Páginas, começando por uma rodada de modelagem do que cada perfil significa em features;
- editar `.css` e `.js` dentro do app;
- marcadores nos fragmentos XML;
- várias páginas por configuração;
- `.htm`;
- reescrever caminhos em `url()` de `style="…"` e de `<style>` (os de dentro dos arquivos `.css` não precisam, veja "Caminhos");
- marcadores dentro de `<script>`.

## Abordagem escolhida

**O HTML é escrito à mão**, em arquivos `.html` que só têm o conteúdo. A geração junta os fragmentos das features selecionadas dentro de uma moldura. O app não aprende vocabulário nenhum: o HTML é o próprio formato de saída.

Alternativas descartadas:

- **Converter os fragmentos XML em HTML** com uma folha XSLT (ou um mapeamento) guardada no projeto. Mantém o XML como fonte, mas exige escrever e manter a conversão, e uma biblioteca de XSLT. O usuário confirmou que o XML do herby não alimenta mais nada, então uma fonte só em HTML é mais simples.
- **XHTML** (HTML com a sintaxe rígida do XML), embutido no `product.xml`. Obriga a escrever `<br/>` e a fechar tudo, sem necessidade.

## A página

### Os arquivos

| Arquivo           | Papel                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| fragmento `.html` | Asset do tipo fragmento. Só o conteúdo: `<!doctype>`, `<html>`, `<head>` e `<body>` são recusados.        |
| `moldura.html`    | Opcional, na raiz do projeto. A página em volta do conteúdo: `<head>`, cabeçalho, rodapé. Não é um asset. |
| `.css` e `.js`    | Recursos, como qualquer arquivo. Os incluídos na configuração entram sozinhos na página.                  |

A geração cria `saida/<nome>/index.html` quando o projeto tem **pelo menos um asset fragmento `.html`**, esteja ele incluído na configuração ou não. Sem nenhum, nada muda.

### A moldura

Os marcadores da moldura:

- `{{conteudo}}`: obrigatório, uma única vez, no texto do `<body>` (não dentro de uma tag). Vira a seção da raiz.
- `{{sumario}}`: opcional, no máximo uma vez, no texto do `<body>`.
- `{{produto}}`: o nome da configuração. Vale também nos fragmentos.
- `{{feature.atributo}}`: como nos fragmentos.

A moldura precisa ter `</head>` e `</body>` escritos, e passa pela mesma conferência de tags dos fragmentos (sem a proibição de `<html>`, `<head>` e `<body>`). Sem `moldura.html`, vale a **moldura padrão**:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{produto}}</title>
  </head>
  <body>
    {{conteudo}}
  </body>
</html>
```

"Novo fragmento" com o caminho `moldura.html` na raiz começa com esse texto, e não vazio. Na Fase 8, o botão "Criar moldura" da aba Páginas faz o mesmo.

### As seções

Cada feature selecionada vira um `<section id="<ID da feature>">`, aninhado como no `product.xml`, também quando não tem conteúdo. Dentro dele vêm os fragmentos HTML da feature, na ordem do `assets.xml`, e depois as seções das filhas. Os fragmentos XML ficam de fora da página.

O texto de cada fragmento entra como está, depois de trocar os marcadores e os caminhos: sem o BOM, com as quebras de linha em LF e sem recuo extra (recuar mudaria o conteúdo de um `<pre>`). O `index.html` sai em UTF-8, sem BOM e com LF. Não leva a hora da geração, então duas gerações iguais dão arquivos idênticos.

### O sumário

`{{sumario}}` vira:

```html
<nav class="sumario">
  <ol>
    <li>
      <a href="#preparacao">Preparação</a>
      <ol>
        <li><a href="#acesso_a_plataforma">Acesso à Plataforma</a></li>
      </ol>
    </li>
  </ol>
</nav>
```

Entram as features selecionadas, menos a raiz, aninhadas como na árvore, com o nome escapado. Uma feature sem nenhum fragmento HTML na sua subárvore fica de fora. O CSS decide quantos níveis mostrar.

### Os marcadores

- `{{feature.atributo}}` vira o valor final do atributo: o `default` num atributo fixo; num configurável, o valor da configuração ou o `default`. É o mesmo valor do `product.xml`.
- Valem no texto e nos valores de atributos (`href="tel:{{herby.contato_whatsapp}}"`), com `& < > "` escapados, e dentro de `<style>`, onde o valor entra sem escape, mas um valor com `<` é problema (senão poderia fechar o `<style>`). Dentro de `<script>`, um marcador é problema.
- Espaços dentro das chaves valem: `{{ loja.versao }}`.
- `\{{` escreve `{{` literal.
- Nos comentários HTML, os marcadores também são trocados e conferidos, como no texto. Assim a conferência dos IDs contra o modelo não precisa ler o HTML.
- Os marcadores só existem nos fragmentos HTML e na moldura. O fragmento XML continua entrando intacto no `product.xml` (ADR 0006).

Um marcador que não resolve:

- feature ou atributo que não existe no modelo, ou nome sem ponto desconhecido (`{{contuedo}}`): sempre erro. O editor sublinha, e a geração recusa;
- feature que existe mas não está selecionada na configuração: problema na geração. O caminho certo é uma condição de presença no fragmento;
- `{{conteudo}}` ou `{{sumario}}` num fragmento: erro.

### Caminhos

Nos atributos `src`, `href`, `srcset` e `poster`, um caminho relativo é **relativo à pasta do arquivo** (como no XML, com o `xml:base`). A geração o reescreve para ficar relativo ao `index.html`: `../img/pix-fluxo.svg` num fragmento de `docs/pagamento/` vira `docs/img/pix-fluxo.svg`. Cada trecho do caminho é codificado para URL (um espaço vira `%20`), e `?…` e `#…` ficam como estavam.

**Todo arquivo do projeto citado assim é copiado** para a saída, no mesmo caminho, sem precisar de asset. Vale para os fragmentos e para a moldura.

Ficam como estão, sem cópia: `http:`, `https:`, `//…`, `mailto:`, `tel:`, `data:`, `javascript:` e `#ancora`. É problema:

- um arquivo citado que não existe, ou que é uma pasta;
- um caminho que sai do projeto (`..` demais);
- um caminho começando com `/`, porque na pasta gerada ele apontaria para a raiz do disco;
- um arquivo copiado (citado ou recurso) com o caminho `index.html` ou `product.xml` na raiz, porque colidiria com o que a geração escreve. Um arquivo citado aparece com a linha, junto com os demais problemas; um recurso, quando os dois formatos já foram montados.

Os caminhos de dentro de um `.css` não precisam de correção: os recursos são copiados com a mesma estrutura de pastas.

### CSS e JS automáticos

Cada recurso `.css` incluído na configuração vira um `<link rel="stylesheet" href="…">` numa linha própria antes do `</head>` da moldura, e cada `.js`, um `<script src="…"></script>` antes do `</body>`, na ordem do `assets.xml`. Um caminho que a moldura já cita (comparado sem caixa) não é repetido. Assim, um `tema-escuro.css` ancorado na feature `tema_escuro` só entra quando ela está selecionada.

## A conferência de um fragmento HTML

É a mesma no editor e na geração, na mesma ordem:

1. **Codificação:** o arquivo tem de estar em UTF-8. Um byte inválido é problema na linha dele, e no editor o arquivo abre só para leitura, como na Fase 6.
2. **Erros de sintaxe** que o parser de HTML aponta (atributo repetido, tag cortada no fim do arquivo…).
3. **Tags abertas:** toda tag aberta no fragmento tem de ser fechada nele, na ordem. Ficam de fora as tags vazias (`<img>`, `<br>`…) e as que o HTML deixa sem fechar (`<p>`, `<li>`, `<td>`, `<tr>`, `<option>`…). O problema aponta a linha da tag aberta. Ao juntar os fragmentos, um `<div>` aberto engoliria todas as seções seguintes.
4. **Tags proibidas** num fragmento: `<!doctype>`, `<html>`, `<head>` e `<body>`.
5. **Marcadores:** a sintaxe, e as regras de onde cada um vale.

HTML normal é aceito: `<br>` sem barra, `&nbsp;`, atributo sem aspas.

Conferências que dependem de outros dados: os IDs dos marcadores dependem do modelo, e são conferidos no editor e na geração. A feature não selecionada e os arquivos citados dependem da configuração e do disco, e são conferidos só na geração.

## Tela

### Aba Fragmentos

- A árvore mostra os `.html` junto com os `.xml`, inclusive a `moldura.html`. As regras de fora continuam as mesmas (Fase 6).
- O editor escolhe a linguagem pela extensão: realce de HTML (`@codemirror/lang-html`, que realça também o CSS e o JS de dentro do arquivo) para `.html`.
- Os marcadores aparecem com cor própria. Depois de `{{`, o editor sugere os `feature.atributo` do modelo, além de `produto` (e de `conteudo` e `sumario` na moldura). Um ID que não existe fica sublinhado.
- "Novo fragmento" aceita `.xml` ou `.html` ("O arquivo precisa terminar em .xml ou .html."). Um `.html` novo começa vazio, e a `moldura.html` na raiz começa com a moldura padrão.
- Na barra do arquivo, a moldura mostra "Moldura da página" no lugar do vínculo. Não há "Vincular a uma feature…" para ela.
- Todo o resto da Fase 6 vale igual para o `.html`: salvar junto com o projeto, BOM e quebra de linha preservados, conflito, alteração por fora, "Salvo com erro…".

### Aba Assets

Ao vincular, `.html` é sugerido como fragmento, como o `.xml`. O botão "Editar" vale para os fragmentos `.html`.

### Geração

Nada muda na tela: o botão "Gerar produto", o diálogo de problemas e a faixa verde. Os problemas das páginas entram na mesma lista, com o arquivo, a linha, o asset (vazio na moldura) e a mensagem. "Abrir no navegador" na faixa verde fica para a Fase 8.

## O exemplo herby

Fica em `docs/examples/herby/`, convertido do original em `C:\Users\lucas\Desktop\herby` por um roteiro descartável. **O original não é alterado**: ele não está no git e fica como cópia de segurança, com os XML.

```
docs/examples/herby/
  model.xml, assets.xml
  configurations/          13, uma por perfil
  moldura.html             capa, sumário ("Funcionalidades") e encerramento
  css/herby.css            recurso ancorado na raiz
  fragmentos/*.html        os 23 fragmentos
  fragmentos/img/…         as imagens, como no original
  Slides por Feature/…     os .pptx e o .xlsx, com os 6 vínculos de hoje
```

Os XML do original não entram: o HTML passa a ser a fonte.

**O modelo:**

- o mesmo do original, com "Educação Especia" corrigida para **Educação Especial**, com o ID `educacao_especial` (o exemplo é um projeto novo, e nada referencia o ID antigo);
- Preparação, Acesso à Plataforma e Impressão dos Cartões passam de obrigatórias a **opcionais** (Q43): seis decks reais (fluência, FGV, PAIC/PROALFA e os resultados da IA) não as têm;
- as 15 variáveis do `_variaveis.xml` viram atributos `string` configuráveis, com o `padrao` como `default`:
  - na raiz `herby`: `produto`, `titulo_tutorial`, `rede`, `ano`, `site`, `contato_whatsapp`, `contato_email`, `url_scan` e `sistema_externo`;
  - em `informacoes_gerais`: `avaliacao`, `data_treinamento`, `prazo_envio_template` e `data_liberacao_cartoes`;
  - em `template_de_dados`: `url_template` e `contato_operacoes`.

  A `rede` tem `default=""`: o XSD aceita (`xs:string`), e a configuração fica completa (conferido na conversão).

**A conversão dos fragmentos:**

| herby                                               | HTML                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `<titulo>` da feature                               | `<h2>` na raiz, um nível abaixo a cada profundidade (até `<h5>`)                |
| `<resumo>`                                          | `<p class="resumo">`                                                            |
| `<secao id titulo>`                                 | `<section class="secao" id="…">`, com o título um nível abaixo do da feature    |
| `<passo id n titulo>`                               | `<section class="passo" id="…">`, com o título "Passo n — título"               |
| `<aviso id tipo>`                                   | `<aside class="aviso <tipo>" id="…">`                                           |
| `<texto>`                                           | `<p>`                                                                           |
| `<destaque>`                                        | `<strong>`                                                                      |
| `<ui>`                                              | `<span class="ui">`                                                             |
| `<imagem src alt>`                                  | `<img src alt>`, dentro de `<figure>` com `<figcaption>` quando há `<legenda>`  |
| `<lista tipo="numerada">` / `<lista>` / `<item>`    | `<ol>` / `<ul>` / `<li>`                                                        |
| `<tabela>` / `<cabecalho>` / `<linha>` / `<celula>` | `<table>` / `<thead>` / `<tr>` / `<td>` (`<th>` no cabeçalho)                   |
| `<var nome="x"/>`                                   | `{{<feature do atributo>.x}}`, conforme a lista acima                           |
| `<origem>`, `codigo`, `pai`, `abstrata`             | removidos                                                                       |
| bloco ou imagem com `perfis="…"`                    | dentro de `<template data-perfis="…">`: fica no arquivo e não aparece na página |
| capa e encerramento do `_estrutura.xml`             | `<header>` e `<footer>` da `moldura.html`                                       |
| agenda                                              | `{{sumario}}`                                                                   |

Efeito conhecido: as imagens citadas dentro de um `<template>` também são copiadas.

**O que fica escondido** (Q45): 46 dos 96 blocos (seções, passos e avisos) têm `perfis`. Cinco features ficam só com o título e o resumo em qualquer configuração: Gestão da Base de Dados, Progresso, Lixeira, Informações Gerais e Sincronização. A Fase 7 aceita isso: o mecanismo da página é o mesmo, e o conteúdo volta com a Fase 9.

**As configurações:** 13, uma por perfil, inclusive `resultados-ia-fluencia`, que só aparece no `<origem>` da Correção por IA e vira "Resultados da IA de Fluência" (Q44). A feature entra no perfil quando algum bloco do fragmento dela cita o perfil no `<origem slides="…">`, e os ancestrais dela entram junto. Os valores vêm do `_variaveis.xml` (o valor do perfil, quando existe). O roteiro grava só as decisões mínimas, em pré-ordem: decide cada feature que continua indecisa. O usuário conferiu a tabela perfil × features antes da gravação, em 28/09/2026: as 13 saem completas, sem conflito e sem nenhuma feature forçada pelo modelo.

**O visual** (`css/herby.css`): sóbrio, com o azul-marinho do cabeçalho da plataforma, texto escuro, avisos com uma faixa lateral, a fonte do sistema e as imagens na largura do texto. Funciona no celular.

**A saída esperada:** `docs/examples/produto-esperado/herby-<perfil>/index.html`, para a configuração da aceitação.

## Arquitetura

As camadas são as de sempre (ADR 0008), com o lint de fronteiras.

**Domínio** (funções puras):

- `domain/fragments/fragment-format.ts`: o formato pela extensão (`xml` ou `html`) e o texto de um fragmento novo (a declaração XML, vazio, ou a moldura padrão). O `fragment-path.ts` passa a aceitar as duas extensões, e o `suggestAssetKind` do `asset-edits.ts` sugere fragmento para as duas.
- `domain/pages/`:
  - `page-layout.ts`: os nomes `moldura.html`, `index.html` e `product.xml` e a moldura padrão;
  - `markers.ts`: acha os marcadores num texto (com `\{{` e espaços), confere os IDs de atributo contra o modelo, conta os marcadores da moldura e dá o valor de cada um numa configuração;
  - `page-paths.ts`: resolve um caminho citado a partir da pasta do arquivo, diz se sai do projeto e escreve o endereço na página; lê e escreve o `srcset`;
  - `page-assembly.ts`: o escape do HTML, as seções aninhadas e o sumário.
- `domain/shared/text-lines.ts`: a linha de uma posição no texto. `domain/feature-model/traversal.ts` ganha `attributeIdsByFeature`.
- `domain/generation/generation-plan.ts`: o plano passa a dizer se a página é gerada (`hasPage`: algum asset fragmento `.html` no catálogo) e a levar os IDs dos atributos de todas as features do modelo (`modelAttributes`), para as mensagens dos marcadores.

**Aplicação:**

- A porta `ProductDeriver` não muda. O `CombinedProductDeriver` (`application/generation/`) junta os dois formatos: confere todos, devolve todos os problemas de uma vez, não repete a cópia de um mesmo caminho e recusa uma cópia com o nome de um arquivo gerado.
- A porta `FragmentChecker` não muda. O `FragmentCheckerByFormat` (`application/fragments/`) escolhe o checker pela extensão. A conferência dos IDs dos marcadores, que precisa do modelo, é uma função do domínio (`modelMarkerProblems`), chamada pela store junto com o checker.

**Infraestrutura** (`infrastructure/html/`, novo):

- `html-source.ts`: lê o fragmento (dentro de um `<section>`, como ele fica na página) ou a moldura (um documento inteiro) com o **parse5**, o parser de HTML do padrão, com as posições no texto. Dá os problemas, o lugar de cada marcador, os atributos com caminho ou com marcador e, na moldura, as posições do `</head>` e do `</body>`.
- `HtmlFragmentChecker` e `inspectHtml`: as conferências de um fragmento HTML e da moldura, na ordem, para o editor e para a geração.
- `HtmlPageDeriver`: lê a moldura e os fragmentos, confere, troca os marcadores e os caminhos só nos trechos que mudam (o resto do texto fica como o autor escreveu) e monta o `index.html` e as cópias. Ele é feito para ser reaproveitado na visualização da Fase 8, que monta a mesma página na memória.
- `XmlProductDeriver`: passa a ignorar os fragmentos `.html`.

**Interface:**

- `xml-editor-setup.ts` vira `fragment-editor-setup.ts`: a linguagem pela extensão (`lang-xml` ou `lang-html`) e, no HTML, a cor e a sugestão dos marcadores (`@codemirror/autocomplete`). As cores continuam nas variáveis `--xml-*`.
- `FragmentEditor` e `FragmentsWorkspace`: os marcadores do modelo para a sugestão, e o texto da tela sem arquivo aberto.
- `fragments-actions.ts`: os problemas dos IDs dos marcadores junto com os do checker, conferidos de novo quando o modelo muda, e "Salvo com erro de HTML".
- `FragmentBar`: "Moldura da página". `FragmentDialogs`: a dica "terminando em .xml ou .html".
- Pacotes novos: `parse5`, `@codemirror/lang-html` e `@codemirror/autocomplete`.

**O que o protótipo respondeu:**

- **O parse5 não acusa as tags que descarta.** Um `</section>` a mais, um `<td>` fora da tabela e o `<body>` de um fragmento somem da árvore sem erro. Elas são achadas pelo que a árvore não cobre: os trechos fora de todo nó e, dentro de um texto, um `<` seguido de letra, `/` ou `!`, que só aparece ali quando a tag foi descartada (o parse5 junta dois textos vizinhos num só). O começo de uma tag da árvore não conta, porque o texto depois do `</body>` de uma moldura vai para dentro do `body` e passa por cima dele. Um marcador no **nome** de um atributo (`<p {{a.b}}>`) é problema: só vale no valor, depois do `=`.
- **O `lang-html` funciona com a CSP**, no modo de desenvolvimento e no `mdd.exe`.
- **A fonte de sugestões precisa ser a mesma função durante todo o estado do editor.** O CodeMirror reconhece a fonte pela identidade, e uma função nova a cada consulta faz ele descartar a resposta. Com o Ctrl+Espaço, a lista também traz as tags do próprio HTML.
- **Os arquivos citados são conferidos também num fragmento que já tem outro problema**, para a geração listar tudo de uma vez.
- As 13 configurações do herby geram sem problema, e a página não tem rolagem lateral nem em 375 px.

## Verificação

Sem testes automatizados (ADR 0008). Roteiros em `.checks/`:

- `markers-check.mts`: sintaxe, escape, `\{{`, espaços, IDs desconhecidos, feature não selecionada, `<style>` e `<script>`;
- `page-paths-check.mts`: caminhos relativos, com `?` e `#`, com espaço, saindo do projeto, começando com `/`, e os que ficam como estão;
- `html-checker-check.mts`: tags abertas, tags opcionais e vazias, tags proibidas, erros do parser, UTF-8, a moldura;
- `html-page-check.mts`: a página montada de um projeto pequeno em memória, com o sumário, o CSS e o JS automáticos sem repetição, as cópias e todos os problemas de uma vez;
- `html-store-check.mts`: a aba Fragmentos com HTML, os IDs dos marcadores conferidos de novo quando o modelo muda, o texto inicial e o aviso ao salvar;
- `herby-convert.mts` (a conversão, com a tabela de perfis), `herby-open-check.mts` (o exemplo abre como no app) e `herby-generate.mts` (gera uma configuração do herby pelo `GenerateProduct`);
- `fragment-path-check.mts` (Fase 6), com os casos `.html`, `.htm` e `moldura.html`;
- `paginas-ui.mjs`, pelo protocolo de depuração do Chromium, no modo de desenvolvimento e no `mdd.exe` (`EXAMPLE=herby bash .checks/run-ui.sh …`): realce, marcador colorido, sugestão, ID inexistente, tag aberta, a moldura, "Novo fragmento" com `.htm` e `.html`, e gerar `completa-atibaia` pelo botão, comparando com a saída esperada;
- regressão, iguais às saídas das fases anteriores: `generate-product-check`, `fragment-checker-check`, `save-fragments-check`, `text-format-check`, as stores (`fragments`, `generation`, `assets`, `configurator`), `configurations-check`, `save-safety-check`, e os roteiros de interface `fragmentos-ui` (só com a dica nova do diálogo), `geracao-ui`, `assets-ui`, `configurador-ui` e `ui-check`.

## Documentos

- ADR 0010: páginas HTML como segunda saída da geração. Os fragmentos são HTML escrito à mão, e não uma conversão do XML. Os marcadores são a exceção ao "fragmento intacto", só no HTML. Os arquivos citados são copiados sem asset.
- CONTEXT.md: **Fragmento** passa a ser XML ou HTML. Termos novos: **Página**, **Moldura**, **Marcador** e **Sumário**.
- SPEC: §2 (escopo), §3 (projeto em disco), §4.4 (a página), §7 (Fragmentos e Assets) e §9 (as Fases 7 e 8).
- HANDOFF, atualizado ao fim da fase.

## Fase 8, decidida junto

A Fase 8 terá o próprio desenho, mas as decisões já foram tomadas na mesma sessão:

- **Aba Páginas**, na faixa lateral, depois de Fragmentos. À esquerda fica a lista de configurações, que só serve para escolher e mostra a mesma configuração aberta da aba Configurações. Criar, renomear, duplicar e excluir continuam só lá. No centro, a página, na largura toda.
- **Ao vivo:** a página é montada na memória a partir do projeto como está na tela, com as alterações não salvas, sem gravar em `saida/`. Ela se atualiza meio segundo depois da última mudança (fragmento, moldura, decisão ou atributo), tentando manter a rolagem, e há o botão "Recarregar".
- Só com a **configuração completa**; senão, a aba mostra o que falta, com o texto da dica do botão "Gerar produto".
- **Com problemas**, a página aparece mesmo assim, com a barra de problemas embaixo. Clicar num problema abre o arquivo na linha, na aba Fragmentos. Um marcador que não resolve aparece como texto cru, e gerar continua recusando.
- **Quadro isolado:** scripts e recursos da internet funcionam, sem acesso ao app (`window.mdd`) nem ao disco. Um link externo abre no navegador do sistema.
- **Larguras:** Celular (375 px), Tablet (768 px) e Largura toda.
- A aba tem o botão **Gerar produto**, com a mesma faixa verde. A faixa, nas duas abas, ganha **Abrir no navegador**, que abre o `index.html` gerado no navegador padrão.
- Sem fragmento HTML no projeto, a aba explica isso e oferece "Novo fragmento". Sem moldura, oferece **Criar moldura**.
