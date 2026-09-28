# Visualização da página num quadro isolado, servido por um esquema próprio

A aba Páginas (Fase 8) mostra a página da configuração aberta dentro do app, ao vivo. A página é do usuário: pode ter scripts e carregar recursos da internet, e não pode enxergar o app (`window.mdd`) nem o disco. Ela roda num `<iframe>` com `sandbox="allow-scripts allow-popups allow-forms allow-modals"`, sem `allow-same-origin`, servido pelo esquema próprio `mdd-page:`. O processo main registra o esquema (padrão e seguro) e responde a ele com a última página que o renderer montou (`mdd-page://pagina/index.html`, entregue pelo canal `setPreviewPage`) e com os arquivos do projeto aberto, só para leitura.

## Considered Options

- **`<iframe srcdoc>` ou uma URL `blob:`:** herdam a CSP do app (`script-src 'self'`), e a página perderia os scripts e as fontes da internet.
- **`WebContentsView`** (a página num processo à parte, posicionado sobre a aba): o isolamento é o mais forte, mas a vista fica por cima de tudo, inclusive dos diálogos e menus do app, e a posição e o tamanho teriam de acompanhar a aba a cada redimensionamento.
- **`<webview>`:** o Electron o desaconselha, e ele exige ligar o `webviewTag`.

## Consequences

- **A página fica numa origem opaca** (`self.origin` é `null`): ler o `parent` dá `SecurityError`, e o preload só existe no quadro principal, então `window.mdd` não existe nela. A resposta do esquema não tem CSP própria, e a do app não vale dentro do quadro: os scripts e a internet funcionam.
- **A CSP do app ganha só `frame-src mdd-page:`.** Ela também barra o quadro de navegar para fora do esquema, ainda no renderer, antes de o main ser consultado. Por isso os links para fora (`https:`, `http:` e `mailto:`) são abertos pelo script da visualização como janela nova, que o `setWindowOpenHandler` manda para o navegador do sistema. Uma navegação para fora feita por script da página fica barrada.
- **Um script pequeno entra só na página servida**, antes do `</body>`: guarda e devolve a rolagem entre as montagens (o app não consegue lê-la numa origem opaca), repassa o Ctrl+S ao app e abre os links para fora. O app só aceita mensagens do quadro da aba e no formato esperado. O `index.html` gerado não leva esse script.
- **A página da visualização é a da geração, no melhor esforço:** o `HtmlPageDeriver` monta as duas pelo mesmo caminho. Na visualização, os fragmentos abertos com alteração entram com o texto do editor, os arquivos citados não são conferidos (o navegador mostra a falta), e a página sai mesmo com problemas, que a aba lista.
- **Os arquivos do projeto são servidos sem cache**, para "Recarregar" pegar um arquivo mudado por fora.
- Os roteiros de interface chegam à página pelo protocolo de depuração: o quadro é um alvo `iframe` próprio, com o endereço `mdd-page://pagina/index.html`.
