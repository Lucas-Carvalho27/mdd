# Handoff — onde paramos e como continuar

Atualizado em 24/09/2026. Leia este arquivo primeiro ao retomar o projeto.

## Estado atual

| Fase                      | Situação                                          | Onde está                                                                                                                                           |
| ------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Fundação               | Concluída                                         | `main` (GitHub)                                                                                                                                     |
| 1. Domínio e persistência | Concluída                                         | `main` (GitHub)                                                                                                                                     |
| 2A. Edição do modelo      | Concluída                                         | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md](superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md) |
| 2B. Diagrama visual       | Concluída                                         | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-2b-diagrama.md](superpowers/plans/2026-09-23-fase-2b-diagrama.md)                 |
| 3. Configurador           | Código concluído; aceitação no `mdd.exe` pendente | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-3-configurador.md](superpowers/plans/2026-09-23-fase-3-configurador.md)           |
| **4. Assets**             | **A planejar**                                    | —                                                                                                                                                   |
| 5. Geração                | A planejar                                        | —                                                                                                                                                   |

O app abre uma pasta de projeto, valida os XMLs em três etapas (XML bem-formado, XSD e regras do domínio), mostra o modelo e salva tudo de volta sem mudar um byte. Com as Fases 2A, 2B e 3, também:

- mostra o modelo num diagrama na notação clássica, com layout automático, zoom, "ajustar à tela" e subárvores recolhíveis;
- edita o modelo (features, grupos, atributos e restrições), com desfazer/refazer e diálogo de impacto ao excluir;
- edita também pelo diagrama: menu de contexto no nó e arrastar e soltar para mudar o pai de uma feature;
- cria projetos e reabre os recentes;
- mostra "•" no título com alterações não salvas e salva com Ctrl+S;
- pergunta o que fazer quando um arquivo foi alterado fora do app, e confirma antes de fechar com alterações;
- resolve cada configuração com o solver SAT e a mostra no diagrama em modo configuração, com decisões por clique, valores de atributos, lista de configurações e faixas para configurações desatualizadas ou em conflito.

Documentos de referência:

- [CONTEXT.md](../CONTEXT.md): glossário do domínio.
- [SPEC.md](SPEC.md): especificação completa e roadmap (§9).
- [adr/](adr/): as decisões de arquitetura e o porquê de cada uma.
- [superpowers/plans/](superpowers/plans/): um plano por fase, com o código de cada tarefa.

## Aceitação da Fase 2A (feita em 23/09/2026)

Na primeira tentativa, a Tarefa 8 foi mesclada na `main` sem a aceitação do Passo 8. A pedido do usuário, a `main` voltou para `49d8188`. A aceitação foi feita depois, e só então o branch voltou para a `main`.

Tudo rodou no `dist/win-unpacked/mdd.exe` gerado por `npm run build:win`:

- **Passo 8 do plano da 2A, os 4 itens:**
  1. "Novo projeto" com Nome `Loja Online`: o ID sugerido foi `loja_online`, trocado por `loja`. O projeto foi criado numa pasta vazia.
  2. O exemplo foi recriado do zero pela interface: descrição e atributo fixo da raiz; filhas com Tab e irmãs com Enter; IDs `mobile`, `pag_cartao`, `pag_pix` e `pag_boleto` escolhidos na criação; grupo Or; atributos number e enum; a restrição. Depois do Ctrl+S, `cmp` contra `docs/examples/loja-online/model.xml` não mostrou diferença: o arquivo é idêntico.
  3. Com uma alteração pendente, fechar a janela pediu confirmação: "Alterações não salvas" / "Há alterações não salvas no projeto.", com os botões "Sair sem salvar" e "Cancelar". Cancelar manteve a janela aberta, com o "•". "Sair sem salvar" encerrou o app, e o disco ficou sem a alteração.
  4. Ao abrir o app de novo, a pasta apareceu em Recentes e abriu com um clique.
- **Roteiro da Tarefa 7 (`ui-check.mjs`):** a saída bateu com a esperada no plano nas 19 linhas. O roteiro cobre o diálogo de impacto ao excluir `pag_pix` (1 restrição, 2 assets, 1 configuração), desfazer, a edição recusada, o conflito ao salvar e o fechamento pelo app.

**Como foi feito sem operar a tela:** a janela foi dirigida pelo protocolo de depuração do Chromium, com entrada de verdade (`Input.dispatchMouseEvent`, `Input.insertText` e `Input.dispatchKeyEvent`). Os diálogos nativos foram respondidos pelo inspetor do Node no processo main (veja "Como trabalhamos"): o app pediu cada diálogo com o título, a mensagem e os botões certos, e a resposta foi injetada. **Não foi conferido:** o desenho dos diálogos nativos do Windows na tela, que é responsabilidade do Electron.

## Aceitação da Fase 2B (feita em 23/09/2026)

A spec do desenho está em [docs/superpowers/specs/2026-09-23-fase-2b-diagrama-design.md](superpowers/specs/2026-09-23-fase-2b-diagrama-design.md). O plano foi escrito com o código já verificado num protótipo descartável e aplicado com um commit por tarefa.

Tudo rodou no `dist/win-unpacked/mdd.exe` gerado por `npm run build:win`, com as saídas iguais às esperadas no plano:

- **Recriar o exemplo pelo diagrama** (Tarefa 4, Passo 4). O exemplo foi recriado do zero usando menu de contexto, Tab, a barra de ações e um arrasto do Boleto até o arco do grupo. O `cmp` contra `docs/examples/loja-online/model.xml` mostrou arquivo idêntico. O mesmo roteiro confere ainda:
  - o arrasto de Pagamento para dentro da própria subárvore fica vermelho e é recusado com o motivo;
  - recolher e expandir funcionam.
- **Fechar com alteração pendente e recentes** (Passo 5), como na 2A.
- **Roteiro da 2A pelo diagrama** (Passo 6). O `ui-check.mjs` bateu nas 19 linhas. Só mudaram, como previsto, as duas linhas em que o texto do nó perdeu o ○, que passou para a linha do diagrama.
- **Roteiro do diagrama** (Tarefa 3, Passo 12, 27 linhas), rodado no app compilado:
  - as pontas das linhas (●/○), as três notações de grupo e nenhum texto cortado;
  - o menu de contexto, e Enter num item dele não disparando o atalho;
  - o arrasto até uma feature, até o arco e até um nó recolhido;
  - a exclusão pelo menu com o diálogo de impacto;
  - a rolagem até a feature nova fora da tela.

## Aceitação da Fase 3 (parcial, 24/09/2026)

O plano está em [docs/superpowers/plans/2026-09-23-fase-3-configurador.md](superpowers/plans/2026-09-23-fase-3-configurador.md), escrito com o código já verificado num protótipo descartável. No protótipo, a aceitação inteira passou no `mdd.exe` empacotado.

**Feito no branch `fase-3-configurador`, mesclado na `main` em 24/09/2026 a pedido do usuário, com a aceitação no `mdd.exe` ainda pendente.** Houve um commit por tarefa. As Tarefas 1 a 4 passaram por revisão de código, todas aprovadas; a Tarefa 5 (correção do empacotamento e documentação) e a revisão final do branch inteiro não foram feitas.

- os roteiros `resolution-check.mts`, `configurations-check.mts` e `configurator-store-check.mts` deram as saídas esperadas no plano. Os três primeiros casos do `resolution-check` são a aceitação da SPEC §9 no domínio:
  - `loja-basica` completa, com `mobile` propagada;
  - sem a decisão de `pag_pix`, `mobile` indecisa;
  - com `pag_pix` excluída do modelo, a referência órfã;
- o roteiro completo do configurador (`configurador-ui.mjs`) deu a saída esperada no app compilado em modo de desenvolvimento (`electron.exe .`, sobre o `out/`);
- a regressão da 2A (`ui-check.mjs`, 19 linhas) e da 2B (`diagrama-ui.mjs`, 27 linhas) bateu com o esperado (Tarefa 4, Passo 16).

**Defeito de empacotamento encontrado e corrigido.** O `electron-builder.yml` não excluía `.checks/` nem `.superpowers/`, e o `app.asar` levava os projetos de teste, os perfis do Chromium dos roteiros e os pacotes de revisão. Nesta pasta, o `mdd.exe` gerado não abria: o `package.json` dentro do `app.asar` saía com o tamanho certo, mas com bytes de outro arquivo. A causa exata não foi provada, mas o sintoma sumiu com as duas exclusões. No build novo, o `app.asar` não tem mais essas pastas, e o `package.json` interno é JSON válido (`mdd 0.1.0`).

**Pendente: a aceitação no `mdd.exe` empacotado** (plano da Fase 3, Tarefa 5, Passos 2 a 4). Ficou para depois a pedido do usuário, porque os roteiros abrem e fecham janelas na tela dele:

- `configurador-ui.mjs` no `mdd.exe`;
- as duas partes do `aceitacao-3.mjs`;
- fechar com uma decisão pendente, com `main-dialogs.mjs`.

Antes da interrupção, uma primeira execução do `configurador-ui.mjs` no `mdd.exe` novo bateu com o esperado nas 35 primeiras linhas: abas, `loja-basica` completa com `mobile` travada, os cliques em `pag_pix`, os valores, a lista e o salvar. Então o app empacotado abre e o solver roda dentro do `app.asar`. A execução parou no passo seguinte, excluir `pag_pix` pela tecla Delete na aba Modelo: o diálogo de impacto não abriu. A causa não foi apurada. O mesmo passo passou no protótipo empacotado e no modo de desenvolvimento, e a falha aconteceu enquanto as janelas mexiam na tela do usuário. As tentativas seguintes esbarraram em restos das anteriores (uma configuração a mais na cópia do projeto), porque a cópia não foi preparada de novo. Ao retomar, prepare a cópia do zero, como no plano, e confira esse passo.

Os roteiros já estão em `.checks/`. Antes de rodar, combine com o usuário um momento em que as janelas não atrapalhem. Se a aceitação achar um defeito, corrija num branch novo a partir da `main`.

## Próximo passo: Fase 4 (assets)

Antes, feche a Fase 3: rode a aceitação pendente no `mdd.exe` (seção acima). A revisão final do branch da Fase 3 também ficou por fazer (`git diff ca5ddc9..<merge>`).

A SPEC §9 descreve a entrega da Fase 4:

- a aba de assets;
- o vínculo com âncora e condição;
- o estado do arquivo;
- abrir no programa padrão.

A aceitação: a aba mostra os 6 assets do exemplo. Renomear `boleto.xml` fora do app faz o asset aparecer como ausente.

Para começar, peça ao Claude, numa sessão nova:

> Leia docs/HANDOFF.md e escreva o plano da Fase 4, prototipando e verificando o código numa cópia descartável antes, como nas fases anteriores.

## Decisão sobre IDs (registrada na SPEC e no ADR 0004)

A Fase 2A **mudou a regra de IDs** (ADR 0004):

- **Antes:** o ID era gerado do nome na criação e nunca mudava.
- **Agora:** ao criar uma feature (Tab, Enter ou botões) ou um projeto, abre um diálogo com **Nome** e **ID**. O ID é sugerido a partir do nome e pode ser ajustado **só naquele momento**. Depois fica imutável, como antes.
- **Motivo:** sem isso, toda feature criada pela interface nasceria com ID `nova_feature`, e seria impossível recriar o exemplo `loja-online` (o critério de aceitação da Fase 2).

## Checagens manuais ainda não confirmadas

Estas foram deixadas de lado porque dependiam do diálogo nativo de pastas. Agora dá para fazê-las com a técnica do inspetor do main (veja abaixo):

- **Fase 0:** em `dist/win-unpacked/mdd.exe`, "Abrir pasta de projeto" em `docs/examples/loja-online` lista os arquivos sem mensagem vermelha.
- **Fase 1** (plano da Fase 1, Tarefa 7 Passo 9 e Tarefa 8 Passo 7):
  - abrir o exemplo e ver as 8 features, a restrição, os 6 assets e a configuração;
  - Salvar sem mudar o `git status`;
  - editar o `model.xml` por fora e ver o erro ao salvar;
  - abrir as cópias quebradas (`loja-duplicado`, `loja-hifen`, `loja-max0`) e ver o erro com arquivo e linha. O plano da Fase 1 tem os comandos para recriá-las.

## Como trabalhamos (e vale manter)

- **Uma fase por vez, com um plano por fase.** Antes de escrever o plano, o código é prototipado e verificado numa cópia descartável do repositório. O plano contém o código já testado.
- **Sem testes automatizados** (ADR 0008). A verificação usa typecheck, lint e scripts descartáveis em `.checks/`, rodados com `npx tsx` ou `node`. A interface é checada pelo protocolo de depuração do Chromium (`--remote-debugging-port`).
- **Um branch por fase**, com um commit por tarefa e merge local na `main` ao fim, depois das checagens.
- **Os scripts de `.checks/` não vão para o git.** Num clone novo, recrie os que precisar a partir dos planos. O `cdp-eval.mjs` está no plano da Fase 1 (Tarefa 6, Passo 8). O `ui-check.mjs` está no plano da 2A (Tarefa 7, Passo 8). Os roteiros da 2B (`diagram-check.mts`, `store-check.mts`, `cdp.mjs`, `diagrama-ui.mjs`, `main-dialogs.mjs` e `aceitacao-2b.mjs`) estão no plano da 2B. Os da Fase 3 (`resolution-check.mts`, `configurations-check.mts`, `configurator-store-check.mts`, `quit.mjs`, `configurador-ui.mjs` e `aceitacao-3.mjs`) estão no plano da Fase 3.
- **Para dirigir a interface sem o diálogo nativo:** rode o app com `--user-data-dir` apontando para uma pasta própria e com um `recent-projects.json` que já contém o projeto. O projeto abre pela lista de recentes. O roteiro `ui-check.mjs` da 2A faz isso.
- **Para responder os diálogos nativos sem a tela:** rode o app também com `--inspect=9229` (funciona no `mdd.exe` empacotado) e conecte no inspetor do Node (`http://127.0.0.1:9229/json`). Com `Runtime.evaluate` e `includeCommandLineAPI: true`, o `require('electron')` fica disponível. Aí basta trocar `dialog.showOpenDialog` por uma função que devolve `{ canceled: false, filePaths: [pasta] }`, e `dialog.showMessageBoxSync` por uma que devolve o índice do botão escolhido. O main lê `electron.dialog.*` na hora da chamada, então a troca vale na hora. Para simular o X da janela, chame `BrowserWindow.getAllWindows()[0].close()`, que dispara o mesmo evento `close`.

## Armadilhas já encontradas

- **Electron 44** não baixa o binário no `npm install`. Por isso o `postinstall` roda `install-electron`.
- **CLI do shadcn:** não instala todas as dependências dos componentes (faltaram `class-variance-authority` e `lucide-react`) e gera textos em inglês ("Close"). Confira os imports depois de cada `npx shadcn add`.
- **`git commit -m` no PowerShell 5.1** quebra mensagens que têm aspas. Use o Git Bash ou `git commit -F arquivo`.
- **Quebras de linha:** o `.gitattributes` força LF. Sem isso, o `core.autocrlf=true` desta máquina quebraria a comparação byte a byte dos XMLs.
- **`xmllint-wasm`** funciona de dentro do `app.asar` sem `asarUnpack`. Isso já foi testado.
- **Scripts de verificação da interface:** entre digitar num campo e sair dele, espere um pouco. O React precisa processar a digitação antes do `blur`.
- **Janela sem o foco do Windows** (por exemplo, quando o usuário está usando outra janela): `focus()` e `blur()` chamados por script não disparam eventos, e os campos que gravam ao sair (`CommitField`) não gravam. Ligue `Emulation.setFocusEmulationEnabled({ enabled: true })` na conexão do protocolo antes do roteiro.
- **Controle de tela no diálogo de pastas:** não aceita digitar o caminho no campo "Pasta:", só navegar com cliques. Além de lento, isso ocupa a tela do usuário. Prefira o inspetor do main.
- **Recentes:** o `reopenProject` só aceita pastas que já estão na lista, para que o renderer não possa apontar a raiz do projeto para qualquer lugar.
- **React Flow e o mouse:** um nó que não é arrastável nem selecionável e não tem handler de clique fica com `pointer-events: none`. A raiz do diagrama é assim, por isso os nós de feature levam `style: { pointerEvents: 'all' }`.
- **elkjs `mrtree`:** usa o mesmo espaçamento nas duas direções e ignora `nodeNodeBetweenLayers`. O `x` vem do elkjs; o `y` sai do nível (`diagram-layout.ts`).
- **Menus e atalhos:** Enter num item do menu de contexto também chegaria ao atalho da janela. O atalho ignora teclas com `defaultPrevented`.
- **Scripts `.mts` com `@/`:** rode com `npx tsx --tsconfig tsconfig.web.json` (o alias está no tsconfig do renderer). Com extensão `.ts`, o `await` no topo falha, porque o projeto é CommonJS.
- **`logic-solver` e a CSP:** o `minisat.js` tem `eval`, e a página o bloqueia. Os caminhos usados não chamam `eval`, então o solver funciona; o `npm run build` avisa três vezes "Use of eval … is strongly discouraged", e é esperado.
- **`logic-solver` reaproveitado:** cada `solveAssuming` deixa as perguntas seguintes mais lentas. Use um solver novo por resolução (`LogicSolverConstraintSolver.load`).
- **Seletores do Zustand:** um seletor que calcula algo (como a resolução) precisa devolver o mesmo objeto enquanto nada muda, senão o React entra em laço. O `ResolveConfiguration` guarda o resultado num `WeakMap` indexado pela configuração.
- **Fechar o app num roteiro:** com alteração pendente, fechar pelo protocolo faz o main abrir o diálogo nativo e esperar. Use `.checks/quit.mjs`, que avisa `setUnsavedChanges(false)` antes, e nunca `taskkill /IM electron.exe`.
- **Captura de tela pelo protocolo:** `Page.captureScreenshot` trava com a janela em segundo plano; chame `Page.bringToFront` antes.
- **O que vai para o instalador:** a lista `files` do `electron-builder.yml` precisa excluir as pastas de rascunho (`.checks/` e `.superpowers/`). Sem isso, elas entram no `app.asar`, e nesta pasta o `package.json` interno saiu corrompido e o `mdd.exe` não abria.
- **Roteiros de interface abrem janelas na tela do usuário:** os cliques vão direto para a janela do app, sem tomar o mouse, mas as janelas abrindo e fechando incomodam. Combine com o usuário antes de rodar, e não abra o `mdd.exe` na mão enquanto eles rodam.
