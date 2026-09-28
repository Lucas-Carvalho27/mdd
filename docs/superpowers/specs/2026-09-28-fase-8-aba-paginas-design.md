# Fase 8 — Aba Páginas: desenho

Aprovado em 28/09/2026. As decisões de produto foram tomadas na sessão de perguntas da Fase 7 e estão no fim do [desenho da Fase 7](2026-09-28-fase-7-paginas-html-design.md) ("Fase 8, decidida junto"). Este desenho acrescenta o como: o isolamento da página, de onde vem cada arquivo e quando a página se atualiza. As escolhas técnicas, aprovadas pelo usuário, estão em "Decisões técnicas".

## Objetivo

Ver, dentro do app, a página da configuração aberta, montada ao vivo a partir do projeto como está na tela, sem gravar nada em `saida/`. A janela ganha a aba **Páginas**, depois de Fragmentos.

**Aceitação**, sobre o exemplo `herby`:

1. A aba Páginas, com `completa-atibaia` aberta, mostra a página. O HTML servido é o mesmo `index.html` que a geração gravaria, mais o script da visualização (veja "O script da visualização").
2. Editar um fragmento na aba Fragmentos, sem salvar, e voltar à aba Páginas: a página mostra o texto novo, na mesma posição da rolagem. Trocar um valor de atributo no configurador também muda a página.
3. Com a configuração incompleta, a aba mostra o que falta, com o texto da dica do botão "Gerar produto".
4. Um fragmento com uma tag aberta: a página aparece mesmo assim, com a barra de problemas embaixo. Clicar no problema abre o arquivo na aba Fragmentos, na linha.
5. Um script da página não enxerga o app: `window.mdd` não existe dentro dela, e ler o `parent` dá erro de origem. Um link `https:` abre no navegador do sistema, e um `#ancora` rola a própria página.
6. Os botões Celular (375 px), Tablet (768 px) e Largura toda mudam a largura, e as media queries do CSS respondem.
7. "Gerar produto" na aba gera como na aba Configurações. A faixa verde, nas duas abas, ganha **Abrir no navegador**, que abre o `saida/<nome>/index.html` no navegador padrão.
8. Num projeto sem fragmento HTML (o `loja-online`), a aba explica isso e oferece "Novo fragmento". Sem `moldura.html`, a página usa a moldura padrão, e a aba oferece **Criar moldura**, que cria o arquivo e o abre na aba Fragmentos.
9. Checagem à mão com o usuário no `mdd.exe`: a aparência da aba, a rolagem mantida enquanto se edita, as larguras e um link externo.

**Não muda:** a geração, o formato dos arquivos, as abas Modelo, Assets e Fragmentos (a não ser por abrir um arquivo numa linha, a pedido da aba Páginas) e a aba Configurações (a não ser pela faixa verde).

**Fora desta fase:** a página de uma configuração incompleta; zoom e impressão; as ferramentas de desenvolvedor para os scripts da página; o tema escuro; a variabilidade anotativa (os `perfis` do herby).

## Decisões técnicas (aprovadas)

1. **A página roda num `<iframe>` isolado, servido por um protocolo próprio do app** (`mdd-page:`), e não numa janela ou num processo separados. Detalhes e alternativas em "O isolamento".
2. **A visualização mostra a página mesmo com problemas**, no melhor esforço: um marcador que não resolve fica como está escrito, uma imagem que falta aparece quebrada, e um fragmento fora do UTF-8 fica de fora. A geração continua recusando tudo isso.
3. **Um script pequeno entra só na visualização**, antes do `</body>`: ele guarda e devolve a posição da rolagem e repassa o Ctrl+S ao app. O `index.html` gerado não o leva.
4. **Os fragmentos abertos na aba Fragmentos entram com o texto do editor**, inclusive a moldura; o resto (os outros fragmentos, as imagens e o CSS) vem do disco. É a decisão da Q4 ("ao vivo, com as alterações não salvas").
5. **Links para fora da página** (`https:`, `http:` e `mailto:`) abrem no programa padrão do sistema; a navegação dentro da página (`#ancora`) fica nela; outro esquema é ignorado.

## O isolamento

A página do usuário pode ter scripts e carregar recursos da internet (Q14), e não pode enxergar o app (`window.mdd`) nem o disco. O app tem uma CSP rígida (`default-src 'self'; script-src 'self'`), que um `<iframe srcdoc>` ou uma URL `blob:` herdariam: os scripts e as fontes de CDN da página seriam bloqueados.

**A escolha:** o processo main registra o esquema `mdd-page:` (privilegiado: `standard`, `secure`, `supportFetchAPI`) e responde a ele:

- `mdd-page://pagina/index.html`: a última página montada pelo renderer, guardada na memória do main;
- `mdd-page://pagina/<caminho>`: um arquivo do projeto aberto, só leitura, pelo `ProjectRoot` (nada fora da pasta, e só arquivos).

A resposta não tem CSP própria, então os scripts e a internet funcionam dentro da página. O `<iframe>` tem `sandbox="allow-scripts allow-popups allow-forms allow-modals"`, **sem** `allow-same-origin` nem `allow-top-navigation`: a página fica numa origem opaca, sem acesso ao documento do app, e o preload só existe no quadro principal, então `window.mdd` não existe nela. A CSP do app ganha só `frame-src mdd-page:`.

Os links: o main intercepta a navegação do quadro (`will-frame-navigate`). Um endereço fora de `mdd-page:` é cancelado e, se for `https:`, `http:` ou `mailto:`, aberto com `shell.openExternal`. O `target="_blank"` já cai no `setWindowOpenHandler`, que faz o mesmo.

Alternativas descartadas:

- **`<iframe srcdoc>` ou `blob:`**: herdam a CSP do app, e a página perderia os scripts e a internet.
- **`WebContentsView`** (a página num processo à parte, posicionado sobre a aba): o isolamento é o mais forte, mas a vista fica por cima de tudo, inclusive dos diálogos e menus do app, e a posição e o tamanho teriam de acompanhar a aba a cada redimensionamento. É trabalho demais para um ganho pequeno sobre o `<iframe>` com sandbox.
- **`<webview>`**: o Electron o desaconselha, e ele exige ligar o `webviewTag`.

## O script da visualização

Como a página fica numa origem opaca, o app não consegue ler a rolagem dela. O main acrescenta, antes do `</body>` da página servida, um script que:

- a cada rolagem, avisa o app pela `postMessage` a posição (`scrollY`);
- ao carregar, volta à posição recebida no endereço (`index.html?y=…`);
- repassa o Ctrl+S ao app (com o foco dentro da página, as teclas não chegam ao app).

O app só aceita mensagens que vêm do `<iframe>` da aba (`event.source`) e com o formato esperado.

## Tela

### A aba Páginas

A faixa lateral ganha a quinta aba: Modelo | Configurações | Assets | Fragmentos | **Páginas**.

- **À esquerda, a lista de configurações** só para escolher. É a mesma configuração aberta da aba Configurações: abrir numa aba abre na outra. Criar, renomear, duplicar e excluir continuam só na aba Configurações.
- **Acima da página, a barra:** o nome da configuração; os botões de largura (Celular, Tablet, Largura toda); **Recarregar** (relê do disco os arquivos que a página usa); **Gerar produto**, com a mesma dica da aba Configurações.
- **No centro, a página**, na largura escolhida, centralizada, com a altura toda.
- **Abaixo, a barra de problemas**, quando houver, como na aba Fragmentos: arquivo, linha e mensagem. Clicar abre o arquivo na aba Fragmentos, com o cursor na linha.
- **A faixa verde** da geração, com "Abrir pasta", **Abrir no navegador** e ×. A mesma faixa, com o botão novo, aparece na aba Configurações.

### Sem página

A aba explica o motivo no centro, no lugar da página:

- nenhuma configuração aberta: "Escolha uma configuração à esquerda";
- configuração incompleta, em conflito ou com o modelo vazio: o que falta, com o texto da dica do botão "Gerar produto";
- projeto sem fragmento HTML: o que é uma página, com o botão "Novo fragmento".

Sem `moldura.html`, a página aparece com a moldura padrão, e a barra mostra "Moldura padrão" com o botão **Criar moldura**, que cria `moldura.html` com a moldura padrão (a mesma de "Novo fragmento") e o abre na aba Fragmentos.

## Comportamento

### De onde vem a página

O caso de uso `PreviewPage` monta a página do projeto na tela, como a geração:

1. o plano da configuração aberta (`planGeneration`), com as decisões e os valores não salvos;
2. o `HtmlPageDeriver`, num modo de visualização, sobre um armazenamento que devolve o texto do editor para os fragmentos abertos com alteração (`EditedFragmentsStorage`, um decorador do `ProjectStorage`) e o disco para o resto;
3. o resultado: a página e a lista de problemas. Com problemas, a página sai mesmo assim (Decisão técnica 2).

O renderer entrega a página ao main (canal `setPreviewPage`) e recarrega o `<iframe>` com a rolagem guardada.

### Quando a página se atualiza

- meio segundo depois da última mudança no que entra nela: o texto de um fragmento aberto (inclusive a moldura), o modelo, os assets, as decisões e os valores da configuração aberta, ou a troca da configuração;
- no botão Recarregar e quando a janela volta ao foco, para pegar os arquivos mudados por fora;
- ao entrar na aba.

Uma montagem que termina depois de outra mais nova é descartada, como a conferência dos fragmentos.

### Atalhos

Na aba Páginas vale só o Ctrl+S, como no configurador. Com o foco dentro da página, o Ctrl+S chega pelo script da visualização.

## Arquitetura

**Processo main e IPC:**

- `src/main/page-preview.ts`: o registro do esquema (antes do `app.whenReady`), a resposta com a página na memória ou com um arquivo do projeto, o script da visualização e a interceptação da navegação do quadro.
- `src/shared/ipc.ts`: o canal `setPreviewPage(html)` e a origem `mdd-page://pagina/`.
- `src/renderer/index.html`: `frame-src mdd-page:` na CSP.

**Aplicação:**

- porta `PagePreviewHost`: `show(html)`, que entrega a página ao main;
- `EditedFragmentsStorage`: o `ProjectStorage` com o texto dos fragmentos abertos com alteração;
- caso de uso `PreviewPage`: o plano, o deriver no modo de visualização e o resultado (página e problemas, ou o motivo de não haver página).

**Infraestrutura:** o `HtmlPageDeriver` ganha o modo de visualização (monta mesmo com problemas; não confere se os arquivos citados existem, porque o navegador mostra a falta); o `ElectronPagePreviewHost`.

**Interface:**

- `ui/screens/pages/`: `PagesWorkspace`, `PageFrame` (o `<iframe>`, as mensagens e a rolagem), `PageBar` e `PageProblems`;
- `ui/stores/pages-actions.ts`: a página, os problemas, a largura, a rolagem e a montagem com o atraso e o descarte;
- telas que já existem: `ViewRail` (a aba), `ProjectScreen`, `GenerationBanner` ("Abrir no navegador") e `fragments-actions.ts` (abrir um arquivo numa linha).

## Verificação

Sem testes automatizados (ADR 0008). Roteiros em `.checks/`:

- `edited-storage-check.mts`: o texto do editor no lugar do disco, só para os fragmentos abertos com alteração;
- `page-preview-check.mts`: a página do herby na memória, com um fragmento editado e não salvo, com um problema (a página sai assim mesmo) e com a configuração incompleta;
- `aba-paginas-ui.mjs`, pelo protocolo de depuração, no modo de desenvolvimento e no `mdd.exe`: a página no `<iframe>` (lida pelo quadro dela no protocolo), a atualização ao editar, a rolagem mantida, o isolamento (`window.mdd` e `parent`), um link externo (com o `shell.openExternal` trocado por um registrador), as larguras, a barra de problemas, "Criar moldura" e "Abrir no navegador";
- regressão: `paginas-ui.mjs` (Fase 7), `fragmentos-ui.mjs`, `geracao-ui.mjs`, `configurador-ui.mjs` e as stores.

## Documentos

- ADR 0011: a visualização da página num `<iframe>` com sandbox, servido por um protocolo próprio, e por que não `srcdoc`, `blob:`, `WebContentsView` ou `<webview>`.
- SPEC: §6.3 (o canal e o protocolo), §7 (a aba Páginas) e §9 (a Fase 8).
- HANDOFF, ao fim da fase.
