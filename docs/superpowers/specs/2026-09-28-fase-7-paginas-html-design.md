# Fase 7 — Páginas HTML: desenho

Aprovado em 28/09/2026, numa sessão de perguntas e respostas com o usuário (42 decisões). Não estava no roadmap: o usuário pediu, além do XML, páginas web montadas de acordo com cada configuração, e uma aba para vê-las dentro do app. O pedido virou duas fases: esta, que gera a página, e a Fase 8, que a mostra (veja "Fase 8, decidida junto" no fim).

O exemplo das duas fases é o projeto real do usuário, o **herby** (tutoriais da plataforma Herby), convertido de XML para HTML. O repositório ficou privado em 28/09/2026 para recebê-lo.

## Objetivo

Escrever fragmentos em **HTML** e gerar, para cada configuração completa, uma **página** `saida/<nome>/index.html`: a moldura do projeto com as seções das features selecionadas, os valores dos atributos no texto, o sumário e os arquivos que a página cita. O XML continua como está.

**Aceitação**, sobre o exemplo `herby`:

1. A aba Fragmentos mostra os 23 `.html` de `fragmentos/` e a `moldura.html`, com realce de HTML. A aba Assets mostra os assets do exemplo, todos ok.
2. Gerar a configuração escolhida na conferência da tabela de perfis (a sugestão é `completa-atibaia`) produz um `index.html` idêntico, byte a byte, ao de `produto-esperado/herby-completa-atibaia/`. A pasta também tem o `herby.css` e as imagens citadas, com a mesma estrutura de pastas.
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
- a variabilidade anotativa (os `perfis` do herby): fase própria, depois, desenhada com os casos reais;
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
- um arquivo copiado (citado ou recurso) com o caminho `index.html` ou `product.xml` na raiz, porque colidiria com o que a geração escreve.

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
  configurations/          uma por perfil
  moldura.html             capa, sumário ("Funcionalidades") e encerramento
  css/herby.css            recurso ancorado na raiz
  fragmentos/*.html        os 23 fragmentos
  fragmentos/img/…         as imagens, como no original
  Slides por Feature/…     os .pptx e o .xlsx, com os 6 vínculos de hoje
```

Os XML do original não entram: o HTML passa a ser a fonte.

**O modelo:**

- o mesmo do original, com "Educação Especia" corrigida para **Educação Especial**, com o ID `educacao_especial` (o exemplo é um projeto novo, e nada referencia o ID antigo);
- as 15 variáveis do `_variaveis.xml` viram atributos `string` configuráveis, com o `padrao` como `default`:
  - na raiz `herby`: `produto`, `titulo_tutorial`, `rede`, `ano`, `site`, `contato_whatsapp`, `contato_email`, `url_scan` e `sistema_externo`;
  - em `informacoes_gerais`: `avaliacao`, `data_treinamento`, `prazo_envio_template` e `data_liberacao_cartoes`;
  - em `template_de_dados`: `url_template` e `contato_operacoes`.

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
| seção com `perfis="…"` (27 das 62)                  | dentro de `<template data-perfis="…">`: fica no arquivo e não aparece na página |
| capa e encerramento do `_estrutura.xml`             | `<header>` e `<footer>` da `moldura.html`                                       |
| agenda                                              | `{{sumario}}`                                                                   |

Efeito conhecido: as imagens citadas dentro de um `<template>` também são copiadas.

**As configurações:** uma por perfil. A feature entra no perfil quando alguma seção do fragmento dela cita o perfil no `<origem slides="…">`. Os valores vêm do `_variaveis.xml` (o valor do perfil, quando existe). **Antes de gravá-las, o roteiro mostra ao usuário a tabela perfil × features**, com os perfis que dão conflito com o modelo (por exemplo, nenhuma ou as duas impressões do grupo alternative) ou que ficam incompletos. O usuário decide cada caso.

**O visual** (`css/herby.css`): sóbrio, com o azul-marinho do cabeçalho da plataforma, texto escuro, avisos com uma faixa lateral, a fonte do sistema e as imagens na largura do texto. Funciona no celular.

**A saída esperada:** `docs/examples/produto-esperado/herby-<perfil>/index.html`, para a configuração da aceitação.

## Arquitetura

As camadas são as de sempre (ADR 0008), com o lint de fronteiras.

**Domínio** (funções puras):

- `domain/fragments/fragment-format.ts`: o formato pela extensão (`xml` ou `html`). O `fragment-path.ts` passa a aceitar as duas extensões, e o `suggestedKind` do `asset-edits.ts` sugere fragmento para as duas.
- `domain/pages/`:
  - `markers.ts`: acha os marcadores num texto (com `\{{` e espaços), confere os IDs contra o modelo e os resolve contra o plano;
  - `page-paths.ts`: resolve um caminho citado a partir da pasta do arquivo, diz se sai do projeto e escreve o caminho relativo ao `index.html`;
  - `table-of-contents.ts`: o sumário, a partir das seções do plano;
  - `page-layout.ts`: o nome `moldura.html`, a moldura padrão e os marcadores reservados.
- `domain/generation/generation-plan.ts`: o plano passa a dizer se a página é gerada (algum asset fragmento `.html` no catálogo) e a levar o necessário para as mensagens dos marcadores (as features e os atributos do modelo, e não só os selecionados).

**Aplicação:**

- A porta `ProductDeriver` não muda. O `GenerateProduct` passa a receber um deriver composto, que junta os arquivos e os problemas dos dois formatos e não repete a cópia de um mesmo caminho.
- A porta `FragmentChecker` não muda. O checker passa a ser escolhido pela extensão. A conferência dos IDs dos marcadores, que precisa do modelo, fica numa função do domínio, chamada pela store junto com o checker.

**Infraestrutura:**

- `infrastructure/html/` (novo):
  - `HtmlFragmentChecker`: as conferências de um fragmento HTML e da moldura, com o **parse5** (o parser de HTML do padrão, com as posições no texto);
  - `HtmlPageDeriver`: lê a moldura e os fragmentos, confere, troca os marcadores e os caminhos pelas posições que o parser dá (o resto do texto fica como está) e monta o `index.html` e as cópias. Ele é feito para ser reaproveitado na visualização da Fase 8, que monta a mesma página na memória.
- `infrastructure/xml/XmlProductDeriver`: passa a ignorar os fragmentos `.html`.
- `infrastructure/fragments/`: o checker composto, por extensão.

**Interface:**

- `xml-editor-setup.ts` vira a montagem do editor por formato, com o `lang-html`, a cor e a sugestão dos marcadores (`@codemirror/autocomplete`).
- `fragments-actions.ts`: o texto inicial do arquivo novo por formato, e os problemas dos marcadores junto com os do checker.
- `FragmentBar`: a moldura.
- Pacotes novos: `parse5`, `@codemirror/lang-html` e `@codemirror/autocomplete`.

**A confirmar no protótipo:**

- se o parse5 dá o que a conferência de tags abertas precisa;
- se o `lang-html` funciona com a CSP;
- se um atributo `string` com `default=""` (a variável `rede`) passa pelo codec e deixa a configuração completa.

## Verificação

Sem testes automatizados (ADR 0008). Roteiros em `.checks/`:

- `markers-check.mts`: sintaxe, escape, `\{{`, espaços, IDs desconhecidos, feature não selecionada, `<style>` e `<script>`;
- `page-paths-check.mts`: caminhos relativos, com `?` e `#`, com espaço, saindo do projeto, começando com `/`, e os que ficam como estão;
- `html-checker-check.mts`: tags abertas, tags opcionais e vazias, tags proibidas, erros do parser, UTF-8, a moldura;
- `html-page-check.mts`: a página montada de um projeto pequeno em memória, com o sumário, o CSS e o JS automáticos sem repetição, as cópias e as colisões;
- `herby-convert.mts`: a conversão do herby, que imprime a tabela de perfis antes de gravar;
- `generate-product-check.mts` (Fase 5): igual ao de antes;
- `paginas-ui.mjs`, pelo protocolo de depuração do Chromium, no modo de desenvolvimento e no `mdd.exe`: realce e sugestão de marcadores, erro de tag aberta, "Novo fragmento" com `.html` e com a moldura, gerar o herby;
- regressão: `fragmentos-ui.mjs` (Fase 6), `geracao-ui.mjs` (Fase 5), `assets-ui.mjs` (Fase 4) e `ui-check.mjs` (2A).

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
