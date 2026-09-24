# Fase 6 — Editor de fragmentos: desenho

Aprovado em 24/09/2026. É a primeira fase depois da primeira versão (SPEC §9). Não estava no roadmap: o usuário pediu um editor de XML dentro do app para criar e editar os fragmentos sem outro programa.

## Objetivo

Criar e editar os **fragmentos** do projeto (os XMLs de documentação que a geração embute no `product.xml`) dentro do app, num editor de texto com realce de sintaxe. A janela ganha a aba **Fragmentos**, com a árvore dos `.xml` do projeto e o editor do arquivo aberto. O texto editado entra no mesmo "•", no mesmo Ctrl+S e na mesma confirmação ao fechar do resto do projeto.

**Aceitação**, sobre o exemplo `loja-online`:

1. A árvore mostra os 5 `.xml` de `docs/`, sem o `model.xml`, o `assets.xml` e `configurations/`.
2. Abrir `docs/pagamento/pix.xml`, trocar o título e salvar com Ctrl+S: só esse arquivo muda no `git diff`, e a quebra de linha e o BOM ficam como estavam.
3. Apagar o `>` de uma tag: o problema aparece com a linha, e a geração de `loja-basica` também passa a recusar o arquivo.
4. Criar `docs/pagamento/cartao.xml`, escrever um conteúdo válido, salvar e vincular à feature `pag_cartao` (que hoje não tem asset) pelo editor: o arquivo aparece na aba Assets como ok.
5. Checagem à mão com o usuário no `mdd.exe`: a aparência do editor, as cores nos temas claro e escuro e a volta do foco depois de editar um arquivo por fora.

**Não muda:**

- o formato dos arquivos do projeto e o `SaveProject`;
- a geração: as conferências de um fragmento mudam de lugar (veja "Arquitetura"), mas não de comportamento;
- as abas Modelo, Configurações e Assets, a não ser pelo botão "Editar" na aba Assets.

**Fora desta fase:**

- editar `model.xml`, `assets.xml` e as configurações como texto: o app já os edita pela interface e os mantém na memória;
- renomear e excluir arquivos (ficam para o Explorer);
- editar arquivos que não são `.xml`;
- "abrir no editor" a partir dos problemas da geração;
- vigiar a pasta em tempo real;
- recolher pastas na árvore.

## Abordagem escolhida

**CodeMirror 6.** É uma biblioteca feita para editores de código no navegador: realce de XML (`@codemirror/lang-xml`), números de linha, desfazer próprio, busca, sublinhado de erros (`@codemirror/lint`) e fechamento automático de tags. É leve, não usa `eval` nem workers, e roda dentro do `app.asar` com a CSP atual (`style-src` já aceita `'unsafe-inline'`). Os pacotes entram um a um (`state`, `view`, `commands`, `language`, `lang-xml`, `search` e `lint`), em vez do pacote `codemirror` completo, para levar só o necessário.

Alternativas descartadas:

- **Monaco** (o editor do VS Code): pesa vários MB, depende de web workers e exige configuração de empacotamento no electron-vite. É demais para um editor simples com cores.
- **Feito à mão** (uma `<textarea>` transparente sobre um `<pre>` pintado por um tokenizador próprio): sem dependência, mas a sincronia da rolagem e da seleção é frágil, fica lento em arquivos grandes, e números de linha, busca e o desfazer por arquivo teriam de ser feitos do zero.

## Tela

### A aba Fragmentos

A faixa lateral ganha a quarta aba: Modelo | Configurações | Assets | **Fragmentos**.

- **À esquerda, a árvore de arquivos:** as pastas do projeto com os `.xml`, todas abertas, com as pastas antes dos arquivos e cada grupo em ordem alfabética.
  - Ficam de fora `model.xml`, `assets.xml`, `configurations/` e `saida/` (na raiz do projeto), as pastas ocultas (nome começando com `.`, como `.git`) e as pastas sem nenhum `.xml`.
  - Cada arquivo mostra **•** quando tem alteração não salva, **novo** quando ainda não existe no disco e um ícone de clipe quando já é o arquivo de algum asset.
  - No topo: **Novo fragmento** e **Atualizar**.
  - Clicar num arquivo o abre no editor.
- **No centro, o editor:**
  - realce de XML, números de linha, linha atual destacada, fechamento automático de tags;
  - Tab indenta (Esc e depois Tab tira o foco do editor, como manda o CodeMirror para acessibilidade);
  - Ctrl+F abre a busca, com os textos do painel em português (`EditorState.phrases`);
  - Ctrl+Z e Ctrl+Y desfazem e refazem o texto. O histórico de cada arquivo é mantido ao trocar de arquivo, e se perde quando o texto é relido do disco (descartar, atualizar, recarregar);
  - as cores seguem as variáveis de tema do app, nos temas claro e escuro.
- **Acima do editor, a barra do arquivo:** o caminho e:
  - o vínculo, se o arquivo é de algum asset: o nome do asset e a âncora ("Guia do PIX · `pag_pix`"), com "+N" quando há mais de um;
  - senão, **Vincular a uma feature…**, ligado só quando o arquivo existe no disco. Abre o diálogo de vínculo da aba Assets (`LinkAssetDialog`) com o caminho preenchido;
  - **Descartar alterações**, ligado só com alteração não salva, com confirmação: volta ao que está no disco. Num arquivo novo, o arquivo sai da lista.
- **Abaixo do editor, a lista de problemas** do arquivo aberto: cada problema mostra a linha e a mensagem, e clicar leva o cursor até a linha. As mesmas linhas ficam sublinhadas no editor, com a marca na margem.
- **Sem arquivo aberto:** o centro explica o que é um fragmento e mostra o botão "Novo fragmento".
- **Barra de status:** "N fragmentos · M com alterações".

### A conferência

É a mesma da geração, na mesma ordem: a codificação declarada, os bytes que não são UTF-8 ("�"), o `xmllint` e o `@xmldom/xmldom`. Roda ao abrir o arquivo e cerca de meio segundo depois que se para de digitar. Uma conferência que termina depois de outra mais nova é descartada.

### Arquivo só para leitura

Um arquivo que não está em UTF-8 abre **só para leitura**, com uma faixa: "Este arquivo não está em UTF-8. Salve-o em UTF-8 em outro editor para poder editar aqui." Vale quando a declaração diz outra codificação ou quando a leitura encontra bytes inválidos. O app lê os arquivos como UTF-8, e os acentos de um arquivo em Latin-1 já chegam trocados por "�": se o editor deixasse gravar, os originais se perderiam.

### Novo fragmento

Um diálogo pede o caminho, sugerindo a pasta do arquivo aberto (por exemplo, `docs/pagamento/`). O caminho aceita `/` ou `\` e é gravado com `/`. É recusado, com o motivo, quando:

- está vazio, não termina em `.xml`, é absoluto ou tem `..`;
- tem um trecho vazio (`docs//a.xml`), um caractere que o Windows não aceita (`< > : " | ? *`) ou um trecho terminado em ponto ou espaço;
- é `model.xml` ou `assets.xml`, ou fica em `configurations/` ou `saida/`;
- já existe no disco ou entre os arquivos novos, sem diferenciar maiúsculas de minúsculas (no Windows, `Pix.xml` e `pix.xml` são o mesmo arquivo).

O arquivo começa só com a declaração `<?xml version="1.0" encoding="UTF-8"?>` e uma linha em branco, e abre no editor. A lista de problemas diz que falta o elemento raiz até ele ser escrito: o app não inventa uma raiz, porque a geração não impõe vocabulário (ADR 0006). Como as configurações novas, o arquivo só chega ao disco no Ctrl+S; as pastas que faltarem são criadas.

### Na aba Assets

Os assets do tipo fragmento ganham o botão **Editar**, desligado quando o arquivo está ausente. Ele troca para a aba Fragmentos com o arquivo aberto.

## Comportamento

### Salvar

- Um fragmento com texto diferente do salvo acende o "•" do título. Fechar o projeto ou o app pede confirmação, pelo mesmo caminho de hoje (`hasUnsavedChanges`).
- O Ctrl+S grava o projeto (`SaveProject`, como hoje) e depois os fragmentos. Só os fragmentos com alteração são gravados: abrir um arquivo e não mexer nunca o regrava.
- Cada fragmento só é gravado se o disco ainda estiver como na última leitura (precondição de hash). Um arquivo novo só é gravado se ainda não existir (`must-not-exist`).
- Um fragmento alterado fora do app entra no **diálogo de conflito que já existe**, junto com os arquivos do projeto. "Sobrescrever" grava por cima; "Recarregar" relê tudo do disco e descarta as alterações, inclusive as dos fragmentos.
- Uma edição feita durante a gravação é mantida, como no `SaveProject`: o arquivo continua com "•".
- **Erro de XML não impede salvar.** Cada fragmento gravado com problema gera um aviso na faixa de avisos, com o arquivo, a linha e a mensagem do primeiro problema: "Salvo com erro de XML: …". O aviso do arquivo some quando ele é salvo sem problema, ao descartar e ao fechar o projeto. A geração continua recusando o fragmento quebrado.

### Não estragar o arquivo

- **BOM e quebra de linha:** ao abrir, o app guarda se o arquivo tinha BOM e se usava CRLF ou LF (CRLF quando aparece algum `\r\n`). O editor trabalha sem BOM e com `\n`. Ao gravar, o texto volta para o formato original. Sem isso, o CodeMirror trocaria tudo por LF, e o arquivo mudaria inteiro no git.
- **Codificação:** veja "Arquivo só para leitura".

### Alteração feita por fora

Quando a janela volta ao foco (se a aba Fragmentos já foi aberta com este projeto) e no botão Atualizar:

- a árvore é relida: arquivos criados por fora aparecem, e os apagados somem;
- um fragmento aberto **sem** alteração no app é relido, e o editor mostra o texto novo;
- um fragmento **com** alteração no app fica como está; o conflito aparece no Ctrl+S;
- um arquivo sem alteração que foi apagado por fora sai da lista e, se estava exibido, fecha no editor. Com alteração, continua aberto e passa a contar como **novo**.

### Trocar, fechar e recarregar

Fechar ou trocar de projeto descarta os fragmentos abertos (com a confirmação de hoje, se houver algo não salvo). "Recarregar" relê o projeto: os fragmentos abertos saem da lista, e o arquivo exibido continua exibido, relido do disco, se ainda existir.

### Atalhos

Na aba Fragmentos, Ctrl+Z e Ctrl+Y ficam com o editor, e os botões de desfazer e refazer do cabeçalho ficam desligados, como no configurador. Os atalhos de edição do modelo (Tab, Enter, F2, Delete, Alt+↑/↓) não valem. O Ctrl+S salva tudo.

## Arquitetura

As camadas são as de sempre (ADR 0008), com o lint de fronteiras.

**Domínio** (funções puras):

- `domain/project/project-layout.ts`: os nomes `model.xml`, `assets.xml` e `configurations`, hoje soltos em `xml-repositories.ts`, `open-project.ts` e `create-project.ts`, que passam a usá-los daqui. A pasta `saida` continua vindo da composition root.
- `domain/fragments/fragment-path.ts`: as regras de um caminho de fragmento novo (acima) e quais arquivos e pastas aparecem na árvore.
- `domain/fragments/text-format.ts`: identifica o BOM e a quebra de linha, converte o conteúdo do arquivo para o texto do editor e o texto do editor de volta para o formato do arquivo.

**Aplicação:**

- `application/fragments/fragment-document.ts`: o arquivo aberto. Guarda o caminho, o texto atual, o texto salvo (`null` num arquivo novo), o hash da última leitura ou gravação, o formato (BOM e quebra de linha) e o motivo de ficar só para leitura, quando houver. `isModified(document)` compara o texto atual com o salvo.
- Porta `FragmentChecker`: `check(path, content)` devolve os problemas (`FileProblem[]`), lista vazia quando está tudo certo.
- `ListFragmentFiles`: percorre as pastas pela porta `ProjectStorage` e devolve os caminhos que entram na árvore.
- `OpenFragment`: lê o arquivo, identifica o formato e decide se fica só para leitura.
- `SaveFragments`: grava os documentos alterados com as precondições e devolve os documentos atualizados, os conflitos e os problemas, no formato do `SaveProject`, para a store juntar os dois.

**Infraestrutura:**

- `XmlFragmentChecker`: recebe as conferências que hoje estão em `XmlProductDeriver.loadFragment` (codificação, "�", `xmllint`, `@xmldom/xmldom` e a extração da raiz). Implementa a porta `FragmentChecker` e dá ao `XmlProductDeriver` a raiz extraída. Assim o editor e a geração conferem do mesmo jeito. A saída do `generate-product-check.mts` tem de continuar igual.

**Interface:**

- `ui/stores/fragments-actions.ts`, no molde do `assets-actions.ts`: os caminhos da árvore, os documentos abertos, o caminho exibido, os problemas por arquivo, e as ações listar, abrir, editar, criar, descartar e atualizar.
- `project-store.ts`: o `hasUnsavedChanges` passa a olhar os fragmentos; o `save` chama o `SaveFragments` depois do `SaveProject` e junta conflitos, problemas e avisos; fechar e recarregar limpam os documentos.
- `ui/screens/fragments/`: `FragmentsWorkspace`, `FragmentTree`, `FragmentBar`, `FragmentProblems`, `FragmentEditor` (guarda o estado do CodeMirror de cada arquivo, o que mantém o desfazer ao trocar de arquivo), `xml-editor-setup.ts` (extensões, tema e textos em português), `NewFragmentDialog` e `DiscardFragmentDialog`.
- Telas que já existem: `ViewRail` (a aba), `ProjectScreen` (a aba, os atalhos, a barra de status e a volta do foco), `AssetList` (o botão "Editar"). O `LinkAssetDialog` é reaproveitado sem mudança.

## Verificação

Sem testes automatizados (ADR 0008). Roteiros em `.checks/`:

- `fragment-path-check.mts`: caminhos aceitos e recusados, com o motivo de cada recusa;
- `text-format-check.mts`: arquivos com e sem BOM, com CRLF, com LF e sem quebra no fim voltam idênticos, byte a byte, depois de abrir e gravar;
- `save-fragments-check.mts`, com um armazenamento em memória que não diferencia caixa, como o Windows: só os alterados são gravados, arquivo novo, conflito, "Sobrescrever", arquivo apagado por fora e o arquivo só para leitura;
- `fragments-store-check.mts`: o "•", o salvar junto com o projeto, os avisos, o descartar, o atualizar e o fechar;
- `generate-product-check.mts`: igual ao de antes, depois da mudança de lugar das conferências;
- `fragmentos-ui.mjs`, pelo protocolo de depuração do Chromium, no modo de desenvolvimento e no `mdd.exe`: o realce, um erro digitado aparecendo na linha certa, Ctrl+S, o conflito, "Novo fragmento", "Vincular a uma feature…", "Editar" a partir da aba Assets e Ctrl+Z no texto sem mexer no modelo;
- regressão: `ui-check.mjs` (2A), `configurador-ui.mjs` (Fase 3), `assets-ui.mjs` (Fase 4) e `geracao-ui.mjs` (Fase 5).

## Documentos

- ADR 0009: o editor de fragmentos com CodeMirror, e por que não o Monaco nem um editor feito à mão.
- SPEC: §2 (escopo), §6.2 (portas), §7 (a aba Fragmentos), §8 (salvar fragmentos e alteração por fora) e §9 (a Fase 6, com a aceitação acima).
- HANDOFF, atualizado ao fim da fase.
