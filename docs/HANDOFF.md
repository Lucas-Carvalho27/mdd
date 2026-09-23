# Handoff — onde paramos e como continuar

Atualizado em 23/09/2026. Leia este arquivo primeiro ao retomar o projeto.

## Estado atual

| Fase                      | Situação       | Onde está                                                                                                                                           |
| ------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Fundação               | Concluída      | `main` (GitHub)                                                                                                                                     |
| 1. Domínio e persistência | Concluída      | `main` (GitHub)                                                                                                                                     |
| 2A. Edição do modelo      | Concluída      | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md](superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md) |
| **2B. Diagrama visual**   | **A planejar** | —                                                                                                                                                   |
| 3. Configurador           | A planejar     | —                                                                                                                                                   |
| 4. Assets                 | A planejar     | —                                                                                                                                                   |
| 5. Geração                | A planejar     | —                                                                                                                                                   |

O app abre uma pasta de projeto, valida os XMLs em três etapas (XML bem-formado, XSD e regras do domínio), mostra o modelo numa lista e salva tudo de volta sem mudar um byte. Com a Fase 2A, também:

- edita o modelo (features, grupos, atributos e restrições), com desfazer/refazer e diálogo de impacto ao excluir;
- cria projetos e reabre os recentes;
- mostra "•" no título com alterações não salvas e salva com Ctrl+S;
- pergunta o que fazer quando um arquivo foi alterado fora do app, e confirma antes de fechar com alterações.

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

## Próximo passo: Fase 2B (diagrama)

A SPEC §9 descreve a entrega: diagrama com React Flow e layout automático no lugar da lista, menu de contexto, arrastar e soltar para mover e subárvores recolhíveis. A aceitação é a mesma da 2A, feita pelo diagrama. O [ADR 0007](adr/0007-diagrama-com-layout-automatico.md) registra a decisão do layout.

Para começar, peça ao Claude, numa sessão nova:

> Leia docs/HANDOFF.md e escreva o plano da Fase 2B, prototipando e verificando o código numa cópia descartável antes, como nas fases anteriores.

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
- **Os scripts de `.checks/` não vão para o git.** Num clone novo, recrie os que precisar a partir dos planos. O `cdp-eval.mjs` está no plano da Fase 1 (Tarefa 6, Passo 8). O `ui-check.mjs` está no plano da 2A (Tarefa 7, Passo 8).
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
