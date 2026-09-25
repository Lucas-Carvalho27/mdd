# Handoff — onde paramos e como continuar

Atualizado em 25/09/2026. Leia este arquivo primeiro ao retomar o projeto.

## Estado atual

| Fase                      | Situação     | Onde está                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Fundação               | Concluída    | `main` (GitHub)                                                                                                                                                                                                                                                                    |
| 1. Domínio e persistência | Concluída    | `main` (GitHub)                                                                                                                                                                                                                                                                    |
| 2A. Edição do modelo      | Concluída    | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md](superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md)                                                                                                                                |
| 2B. Diagrama visual       | Concluída    | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-2b-diagrama.md](superpowers/plans/2026-09-23-fase-2b-diagrama.md)                                                                                                                                                |
| 3. Configurador           | Concluída    | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-3-configurador.md](superpowers/plans/2026-09-23-fase-3-configurador.md); correções da revisão final em [docs/superpowers/plans/2026-09-24-fase-3-correcoes.md](superpowers/plans/2026-09-24-fase-3-correcoes.md) |
| 4. Assets                 | Concluída    | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-24-fase-4-assets.md](superpowers/plans/2026-09-24-fase-4-assets.md)                                                                                                                                                      |
| 5. Geração                | Concluída    | `main`. Plano em [docs/superpowers/plans/2026-09-24-fase-5-geracao.md](superpowers/plans/2026-09-24-fase-5-geracao.md); correções da revisão final em [docs/superpowers/plans/2026-09-24-fase-5-correcoes.md](superpowers/plans/2026-09-24-fase-5-correcoes.md)                    |
| 6. Editor de fragmentos   | Em andamento | Plano pronto em [docs/superpowers/plans/2026-09-24-fase-6-editor-fragmentos.md](superpowers/plans/2026-09-24-fase-6-editor-fragmentos.md); o código ainda não entrou. Veja "Fase 6 em andamento"                                                                                   |

O app abre uma pasta de projeto, valida os XMLs em três etapas (XML bem-formado, XSD e regras do domínio), mostra o modelo e salva tudo de volta sem mudar um byte. Com as Fases 2A, 2B, 3 e 4, também:

- mostra o modelo num diagrama na notação clássica, com layout automático, zoom, "ajustar à tela" e subárvores recolhíveis;
- edita o modelo (features, grupos, atributos e restrições), com desfazer/refazer e diálogo de impacto ao excluir;
- edita também pelo diagrama: menu de contexto no nó e arrastar e soltar para mudar o pai de uma feature;
- cria projetos e reabre os recentes;
- mostra "•" no título com alterações não salvas e salva com Ctrl+S;
- pergunta o que fazer quando um arquivo foi alterado fora do app, e confirma antes de fechar com alterações;
- resolve cada configuração com o solver SAT e a mostra no diagrama em modo configuração, com decisões por clique, valores de atributos, lista de configurações e faixas para configurações desatualizadas ou em conflito.
- vincula arquivos do projeto às features na aba Assets, com o estado de cada arquivo (ok ou ausente), trocar arquivo, reordenar, desvincular e abrir no programa padrão, e mostra os assets ancorados no painel da feature.
- gera o produto de uma configuração completa em `saida/<nome>/`, com o `product.xml` e os recursos copiados, conferindo todas as fontes antes e sem gravar nada quando há problema.

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

## Aceitação da Fase 3 (feita em 24/09/2026)

O plano está em [docs/superpowers/plans/2026-09-23-fase-3-configurador.md](superpowers/plans/2026-09-23-fase-3-configurador.md), escrito com o código já verificado num protótipo descartável.

**Código:** feito no branch `fase-3-configurador`, com um commit por tarefa, e mesclado na `main` em 24/09/2026 a pedido do usuário. As Tarefas 1 a 4 passaram por revisão de código, todas aprovadas.

**Antes do `mdd.exe`, no modo de desenvolvimento:**

- os roteiros `resolution-check.mts`, `configurations-check.mts` e `configurator-store-check.mts` deram as saídas esperadas no plano. Os três primeiros casos do `resolution-check` são a aceitação da SPEC §9 no domínio:
  - `loja-basica` completa, com `mobile` propagada;
  - sem a decisão de `pag_pix`, `mobile` indecisa;
  - com `pag_pix` excluída do modelo, a referência órfã;
- o roteiro completo do configurador (`configurador-ui.mjs`) deu a saída esperada no app compilado (`electron.exe .`, sobre o `out/`);
- a regressão da 2A (`ui-check.mjs`, 19 linhas) e da 2B (`diagrama-ui.mjs`, 27 linhas) bateu com o esperado (Tarefa 4, Passo 16).

**Defeito de empacotamento encontrado e corrigido.** O `electron-builder.yml` não excluía `.checks/` nem `.superpowers/`, e o `app.asar` levava os projetos de teste, os perfis do Chromium dos roteiros e os pacotes de revisão. Nesta pasta, o `mdd.exe` gerado não abria: o `package.json` dentro do `app.asar` saía com o tamanho certo, mas com bytes de outro arquivo. A causa exata não foi provada, mas o sintoma sumiu com as duas exclusões. No build novo, o `app.asar` não tem mais essas pastas, e o `package.json` interno é JSON válido (`mdd 0.1.0`).

**Revisão final do branch inteiro** (`git diff ca5ddc9..085b453`): encontrou dois defeitos no salvar das configurações, os dois com perda de dados:

- renomear com conflito apagava o arquivo antigo antes de o novo existir;
- chaves que só diferem na caixa (`Loja.xml` × `loja.xml`), que no Windows são o mesmo arquivo.

A correção veio no branch `fase-3-correcoes`, mesclado na `main`. O registro, com o roteiro `save-safety-check.mts` e a saída antes e depois, está em [docs/superpowers/plans/2026-09-24-fase-3-correcoes.md](superpowers/plans/2026-09-24-fase-3-correcoes.md). A regressão da Fase 3 (os três roteiros acima) continuou igual ao plano.

**No `mdd.exe` empacotado** (Tarefa 5, Passos 2 a 4), com o código já corrigido, `npm run build:win` sem erro (só os três avisos de `eval` do `logic-solver`) e cópias do projeto preparadas do zero:

- **`configurador-ui.mjs`** (Passo 2): a saída foi igual à do plano nas 50 linhas, terminando em `erros no console → nenhum` e `app fechado`. O solver roda dentro do `app.asar`, com a CSP. O passo que tinha falhado numa tentativa anterior, excluir `pag_pix` pela tecla Delete na aba Modelo, abriu o diálogo de impacto normalmente. A causa daquela falha não foi apurada: ela aconteceu enquanto as janelas mexiam na tela do usuário, e as tentativas seguintes usaram uma cópia do projeto com restos das anteriores.
- **`aceitacao-3.mjs`, parte 1** (Passo 3): igual ao plano nas 11 linhas. `loja-basica` completa com `mobile` travada; sem a decisão de `pag_pix`, `mobile` indecisa; excluir `pag_pix` e salvar não mexeu no `loja-basica.xml`.
- **`aceitacao-3.mjs`, parte 2, e fechar com decisão pendente** (Passo 4): igual ao plano nas 9 linhas. Ao reabrir, `loja-basica` aparece desatualizada, com a faixa e a referência órfã. Uma decisão pendente pediu confirmação ao fechar: "Cancelar" manteve a janela, e "Sair sem salvar" encerrou o app. O `cmp` do `loja-basica.xml` com o exemplo não mostrou diferença.

**Não foi refeito no `mdd.exe`:** a regressão da 2A e da 2B (Tarefa 4, Passo 16), que passou no modo de desenvolvimento. A correção só mexe no salvar e na lista de configurações.

## Aceitação da Fase 4 (feita em 24/09/2026)

O desenho está em [docs/superpowers/specs/2026-09-24-fase-4-assets-design.md](superpowers/specs/2026-09-24-fase-4-assets-design.md), e o plano, em [docs/superpowers/plans/2026-09-24-fase-4-assets.md](superpowers/plans/2026-09-24-fase-4-assets.md). O plano foi escrito com o código já verificado num protótipo descartável (inclusive no `mdd.exe`) e conferido com ele por script: os trechos "Troque / por", aplicados em ordem, reproduzem os arquivos do protótipo. A execução foi feita no branch `fase-4-assets`, com um commit por tarefa, e o `src` terminou idêntico ao do protótipo.

**Roteiros, todos com a saída esperada no plano:**

- `asset-edits-check.mts` (31 linhas): os 6 assets do exemplo recriados por comandos, passando por todas as operações, dão um `assets.xml` idêntico ao exemplo;
- `asset-files-check.mts`, `project-root-check.mts` e `assets-store-check.mts`;
- `configurator-store-check.mts` (Fase 3), com os serviços novos: igual ao plano da Fase 3;
- `assets-ui.mjs` (50 linhas), no modo de desenvolvimento e no `mdd.exe`;
- `aceitacao-4.mjs` no `mdd.exe`: parte 1, os 6 assets e `boleto.xml` renomeado fora do app aparecendo como ausente; parte 2, os 6 assets vinculados pela interface, fora de ordem, e o `assets.xml` salvo idêntico ao do exemplo.

**Regressão (Tarefa 4, Passo 23):** o `ui-check.mjs` (2A) saiu igual; o `configurador-ui.mjs` (Fase 3) também, com a diferença prevista na dica do desfazer ("Desfazer vale só nas abas Modelo e Assets"). O `diagrama-ui.mjs` (2B) saiu igual numa de três rodadas; nas outras, parou num arrasto ou num clique logo depois de "Ajustar à tela". Para separar isso da Fase 4, o mesmo roteiro rodou três vezes no `mdd.exe` de antes da fase (gerado de manhã, com as correções da Fase 3): falhou uma vez, também num arrasto. A instabilidade é do roteiro, e não desta fase (veja "Armadilhas").

**Achado na execução:** logo depois de um build, a tela inicial demorou mais que os 2 segundos fixos do `run-ui.sh`, e o roteiro clicou antes de a lista de recentes aparecer. O `run-ui.sh` passou a esperar a lista (o plano já traz essa versão).

**Checagem à mão** (Tarefa 5, Passo 4), feita pelo usuário no `mdd.exe`, sobre uma cópia do exemplo em `.checks/aceitacao-manual/`. Ele confirmou os três resultados esperados:

- a aba Assets mostrou os 6 assets, todos ok;
- renomear `boleto.xml` no Explorer e voltar ao app com um clique deixou "Guia do boleto" ausente, com o resumo "6 assets · 1 ausente";
- Abrir em "Fluxo do PIX" abriu o `.svg` no programa padrão.

Isso cobre o que os roteiros só simulam: a volta real do foco pelo Windows e o `shell.openPath` de verdade.

O branch `fase-4-assets` foi mesclado na `main` em 24/09/2026 e enviado ao GitHub.

## Aceitação da Fase 5 (feita em 24/09/2026)

O desenho está em [docs/superpowers/specs/2026-09-24-fase-5-geracao-design.md](superpowers/specs/2026-09-24-fase-5-geracao-design.md), e o plano, em [docs/superpowers/plans/2026-09-24-fase-5-geracao.md](superpowers/plans/2026-09-24-fase-5-geracao.md). O plano foi escrito com o código já verificado num protótipo descartável. A execução foi feita no branch `fase-5-geracao`, com um commit por tarefa, cada tarefa revisada e aprovada, e o `src` terminou idêntico ao do protótipo (34 arquivos).

**Roteiros, todos com a saída esperada no plano:**

- `generation-plan-check.mts` (Tarefa 1), `output-guard-check.mts` (Tarefa 2), `fragment-source-check.mts` e `generate-product-check.mts` (Tarefa 3, 10 casos, inclusive a trava do Windows no caso 9), `generation-store-check.mts` (Tarefa 4): cada um falhou antes da sua tarefa e deu a saída do plano depois;
- `geracao-ui.mjs`, no modo de desenvolvimento (Tarefa 4, Passo 16) e no `mdd.exe` (Tarefa 5, Passo 3): confirma que a geração roda dentro do `app.asar`, com o `xmllint` no main.

**Regressão** (Tarefa 4, Passo 17): `ui-check.mjs` (2A), `configurador-ui.mjs` (Fase 3), `assets-ui.mjs` (Fase 4), `configurator-store-check.mts` e `assets-store-check.mts`: iguais ao esperado. O `assets-ui.mjs` saiu vazio (só `app fechado`) na primeira rodada, logo depois da rodada anterior, com as portas 9229 e 9333 ainda em `TIME_WAIT`; numa segunda rodada, com uns segundos de pausa, saiu igual ao plano — sem relação com esta fase (veja "Armadilhas"). O `diagrama-ui.mjs` (2B) não rodou: a fase não mexe no diagrama nem na aba Modelo.

**No `mdd.exe` empacotado** (Tarefa 5, Passos 1 a 3): `npm run build:win` sem erro (`building target=nsis file=dist\mdd-0.1.0-setup.exe`). O `aceitacao-5.mjs` saiu igual ao plano: parte 1, com `pag_boleto` selecionado e `boleto.xml` ausente, o diálogo "Não foi possível gerar" listou `docs/pagamento/boleto.xml [doc_boleto] Arquivo ausente.`, e a pasta `saida/` não foi criada; parte 2, o `product.xml` gerado é equivalente ao `produto-esperado/loja-basica/product.xml`, e o `pix-fluxo.svg` é idêntico.

**Checagem à mão** (Tarefa 5, Passo 4), feita pelo usuário no `mdd.exe`, sobre uma cópia do exemplo em `.checks/aceitacao-manual/`: gerou `loja-basica` pela interface, a faixa verde apareceu com a pasta e a hora, e "Abrir pasta" abriu o Explorer em `saida\loja-basica`, com o `product.xml` e `docs\img\pix-fluxo.svg`. Ele respondeu que tudo pareceu certo.

**Revisão final do branch inteiro** (`git diff 7de6ede..92a5e4a`): encontrou três problemas importantes, corrigidos no próprio branch antes do merge:

- **I1, a geração seguinte apagava a única versão anterior.** Quando a troca e a volta falhavam, ou o app caía entre as duas trocas, a versão anterior ficava só em `saida/.<chave>.old/`, e a geração seguinte a apagava como sobra, sem perguntar. Agora a geração a põe de volta em `saida/<chave>/` antes da pergunta de substituir (`WriteProductFolder.recover`); se não conseguir, para sem apagar nada e diz onde ela está.
- **I2, "Substituir" podia substituir a pasta de outra configuração.** O diálogo guardava só a pasta, e a store gerava a configuração aberta no momento: gerar A, abrir B durante a geração e confirmar "Substituir `saida/A/`?" substituía `saida/B/` sem perguntar. Agora a geração leva a chave, e o diálogo guarda a sua.
- **I3, fragmento fora do UTF-8 passava com os acentos trocados.** Sem declaração de codificação, um fragmento salvo em Latin-1 chegava com U+FFFD no lugar dos acentos e passava no `xmllint`. Agora é um problema na linha do primeiro byte inválido.

Também foram corrigidos cinco itens menores: no máximo 4 fragmentos conferidos ao mesmo tempo (cada `xmllint` abre um worker); uma exceção do caso de uso não deixa mais o botão em "Gerando…"; o problema de uma gravação que falha aponta o caminho no projeto; a faixa verde some ao renomear ou excluir a configuração gerada e numa falha na escrita dela; e o ADR 0006 registra que os valores padrão de atributos da DTD (como o `@class` do DITA) saem junto com o DOCTYPE. Os demais itens menores da revisão ficaram registrados sem correção, cada um com o motivo. O registro completo, com os problemas, as correções, as versões novas do `generate-product-check.mts` e do `generation-store-check.mts` e a saída de cada roteiro antes e depois, está em [docs/superpowers/plans/2026-09-24-fase-5-correcoes.md](superpowers/plans/2026-09-24-fase-5-correcoes.md).

O branch `fase-5-geracao` foi mesclado na `main` em 24/09/2026.

## Próximo passo

Com a Fase 5, as fases 0 a 5 da primeira versão estão concluídas, e as checagens manuais das Fases 0 e 1 também (veja abaixo). O usuário pediu, em seguida, um editor de XML integrado ao app: um editor de texto simples, com realce de sintaxe, para criar e editar os fragmentos dentro da aplicação. Virou a **Fase 6 (editor de fragmentos)**, em andamento (veja "Fase 6 em andamento" abaixo). Os itens da fase "Depois" da SPEC §9 continuam em aberto.

## Fase 6 em andamento (parada em 25/09/2026)

**Desenho aprovado:** [docs/superpowers/specs/2026-09-24-fase-6-editor-fragmentos-design.md](superpowers/specs/2026-09-24-fase-6-editor-fragmentos-design.md). Em resumo:

- editor com CodeMirror 6 numa aba nova, "Fragmentos", só para os fragmentos;
- o texto salva junto com o projeto, no mesmo "•", Ctrl+S e confirmação ao fechar;
- erro de XML não impede salvar, mas gera um aviso;
- "Vincular a uma feature…" no editor e "Editar" na aba Assets;
- arquivo fora do UTF-8 fica só para leitura;
- BOM e quebras de linha mantidos.

**Plano pronto:** [docs/superpowers/plans/2026-09-24-fase-6-editor-fragmentos.md](superpowers/plans/2026-09-24-fase-6-editor-fragmentos.md), com seis tarefas: domínio, conferência de fragmento, aplicação, store, a aba Fragmentos e a aceitação com os documentos (ADR 0009, SPEC e spec do desenho).

- O plano foi montado por script a partir do protótipo (`.checks/plan-template-6.md` e `build-plan-6.py`) e conferido pelo `verify-plan-6.py`: os 62 trechos "Troque / por", aplicados em ordem sobre `dc1dcd7`, reproduzem os arquivos, e cada arquivo inteiro e cada saída aparecem iguais no plano, depois do Prettier.
- Cada tarefa foi aplicada sozinha, em ordem, num branch descartável por tarefa (`.checks/por-tarefa.sh`): os roteiros novos falharam antes e deram a saída do plano depois, com typecheck e lint limpos. No fim, o `src/` ficou idêntico ao do protótipo.
- O que o protótipo respondeu, inclusive as correções da spec do desenho, está na seção de mesmo nome do plano.

**O que aconteceu em 25/09/2026:**

- O `fragmentos-ui.mjs` rodou pela primeira vez e achou um defeito: um fragmento novo salvo sumia da árvore até a próxima leitura das pastas. A correção está no `saveFragments` (`fragments-actions.ts`), e o `fragments-store-check.mts` passou a mostrar a árvore logo depois de salvar.
- O próprio roteiro tinha três erros: o `cmTile` do `@codemirror/view` 6.43, a cor minificada pelo build e a conexão com o processo main que não fechava. Os três viram armadilhas na Tarefa 6 do plano.
- O passo 15 do roteiro passou a mostrar o estado do arquivo na aba Assets (`cartao:ok`), que é o critério 4 da aceitação.
- A regressão de interface (`ui-check`, `configurador-ui`, `assets-ui` e `geracao-ui`) e a das stores saíram iguais aos planos.
- No `mdd.exe` (`npm run build:win`), o `fragmentos-ui.mjs` deu a mesma saída do modo de desenvolvimento (antes da mudança no passo 15, que só acrescenta o estado do arquivo).
- Os documentos da Tarefa 6 (ADR 0009, SPEC e spec do desenho) foram escritos no protótipo e entram no branch da fase pelo plano.

**Branches** (só no repositório local; o GitHub ainda tem a versão de 24/09):

- `fase-6-editor-fragmentos`: a spec, este handoff e o plano. O código ainda não entrou.
- `prototipo-fase-6`: o protótipo descartável, com a pasta `.checks/` (os roteiros novos e os das fases anteriores, as saídas conferidas em `.checks/out/` e os scripts do plano). **Nunca mescle este branch:** ele é só a fonte do plano. Como ele tem arquivos em `.checks/` que o git conhece, trabalhe nele num clone separado, e não no clone do branch da fase.

**Próximos passos:**

1. **Executar o plano** no branch `fase-6-editor-fragmentos`, tarefa por tarefa, com revisão (superpowers:subagent-driven-development).
   - Os roteiros de `.checks/` podem vir do branch do protótipo sem passar pelo índice do git: `git archive prototipo-fase-6 .checks | tar -x`, na raiz (a pasta é ignorada pelo git; num clone novo, use `origin/prototipo-fase-6`). Assim vêm também os roteiros das fases anteriores, já nas versões que os planos esperam.
   - O `fragment-source-check.mts` de lá já tem o import da Tarefa 2 (Passo 8), e o passo fica só para conferir.
2. Os roteiros de interface abrem janelas: combinar o momento com o usuário (Tarefa 5, Passos 15 e 16; Tarefa 6, Passo 2).
3. A checagem à mão com o usuário no `mdd.exe` (Tarefa 6, Passo 3). Depois, o merge local na `main` e o envio ao GitHub.

## Decisão sobre IDs (registrada na SPEC e no ADR 0004)

A Fase 2A **mudou a regra de IDs** (ADR 0004):

- **Antes:** o ID era gerado do nome na criação e nunca mudava.
- **Agora:** ao criar uma feature (Tab, Enter ou botões) ou um projeto, abre um diálogo com **Nome** e **ID**. O ID é sugerido a partir do nome e pode ser ajustado **só naquele momento**. Depois fica imutável, como antes.
- **Motivo:** sem isso, toda feature criada pela interface nasceria com ID `nova_feature`, e seria impossível recriar o exemplo `loja-online` (o critério de aceitação da Fase 2).

## Checagens manuais das Fases 0 e 1 (feitas)

Estas tinham ficado de lado porque dependiam do diálogo nativo de pastas. Em 24/09/2026, o usuário informou que já as fez, e elas não precisam mais ser feitas:

- **Fase 0:** em `dist/win-unpacked/mdd.exe`, "Abrir pasta de projeto" em `docs/examples/loja-online` lista os arquivos sem mensagem vermelha.
- **Fase 1** (plano da Fase 1, Tarefa 7 Passo 9 e Tarefa 8 Passo 7):
  - abrir o exemplo e ver as 8 features, a restrição, os 6 assets e a configuração;
  - Salvar sem mudar o `git status`;
  - editar o `model.xml` por fora e ver o erro ao salvar;
  - abrir as cópias quebradas (`loja-duplicado`, `loja-hifen`, `loja-max0`) e ver o erro com arquivo e linha.

## Como trabalhamos (e vale manter)

- **Uma fase por vez, com um plano por fase.** Antes de escrever o plano, o código é prototipado e verificado numa cópia descartável do repositório. O plano contém o código já testado.
- **Sem testes automatizados** (ADR 0008). A verificação usa typecheck, lint e scripts descartáveis em `.checks/`, rodados com `npx tsx` ou `node`. A interface é checada pelo protocolo de depuração do Chromium (`--remote-debugging-port`).
- **Um branch por fase**, com um commit por tarefa e merge local na `main` ao fim, depois das checagens.
- **Os scripts de `.checks/` não vão para o git.** Num clone novo, recrie os que precisar a partir dos planos. O `cdp-eval.mjs` está no plano da Fase 1 (Tarefa 6, Passo 8). O `ui-check.mjs` está no plano da 2A (Tarefa 7, Passo 8). Os roteiros da 2B (`diagram-check.mts`, `store-check.mts`, `cdp.mjs`, `diagrama-ui.mjs`, `main-dialogs.mjs` e `aceitacao-2b.mjs`) estão no plano da 2B. Os da Fase 3 (`resolution-check.mts`, `configurations-check.mts`, `configurator-store-check.mts`, `quit.mjs`, `configurador-ui.mjs` e `aceitacao-3.mjs`) estão no plano da Fase 3. O `save-safety-check.mts` está nas correções da Fase 3 ([docs/superpowers/plans/2026-09-24-fase-3-correcoes.md](superpowers/plans/2026-09-24-fase-3-correcoes.md)). Os da Fase 4 (`asset-edits-check.mts`, `asset-files-check.mts`, `project-root-check.mts`, `assets-store-check.mts`, `main-process.mjs`, `run-ui.sh`, `assets-ui.mjs` e `aceitacao-4.mjs`) estão no plano da Fase 4, cada um num passo "Escrever `.checks/<nome>`"; o `ui-check.mjs` precisa das duas mudanças da 2B (plano da 2B, Tarefa 4, Passo 6). Os da Fase 5 (`generation-plan-check.mts`, `output-guard-check.mts`, `fragment-source-check.mts`, `generation-support.mts`, `generate-product-check.mts`, `generation-store-check.mts`, `geracao-ui.mjs` e `aceitacao-5.mjs`) estão no plano da Fase 5; as versões corrigidas do `generate-product-check.mts` e do `generation-store-check.mts` estão nas correções da Fase 5 ([docs/superpowers/plans/2026-09-24-fase-5-correcoes.md](superpowers/plans/2026-09-24-fase-5-correcoes.md)). O `run-ui.sh` prepara a cópia do exemplo, abre o app, espera a tela inicial, roda um roteiro e fecha: prefira-o a montar os comandos à mão. Num plano, cada roteiro vem depois de uma linha "Crie `.checks/<nome>`:", e dá para extraí-los com um script pequeno em vez de copiar à mão.
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
- **Nomes de arquivo no Windows não diferenciam caixa:** `Loja.xml` e `loja.xml` são o mesmo arquivo. Qualquer lista de arquivos com chave tirada do nome (como as configurações) precisa comparar as chaves sem caixa (`sameKey` em `configuration-entries.ts`). O `save-safety-check.mts` tem um armazenamento em memória que imita isso.
- **O que vai para o instalador:** a lista `files` do `electron-builder.yml` precisa excluir as pastas de rascunho (`.checks/` e `.superpowers/`). Sem isso, elas entram no `app.asar`, e nesta pasta o `package.json` interno saiu corrompido e o `mdd.exe` não abria.
- **Foco da janela nos roteiros:** o Windows não deixa um app em segundo plano tomar o foco de outra janela, então `BrowserWindow.focus()` pelo inspetor não é confiável quando o usuário está usando outra janela (e `blur()` não tira o foco). Para exercitar o que acontece "quando a janela volta ao foco", dispare `window.dispatchEvent(new Event('focus'))` na página. Com uma troca de foco de verdade, o renderer recebe `blur` e `focus`, cada um duas vezes.
- **`shell.openPath` num roteiro:** troque-o por um registrador pelo inspetor do main (`.checks/main-process.mjs`). Um arquivo de extensão sem programa associado não serve de teste "sem janela": o Windows pode abrir o diálogo "Como você deseja abrir este arquivo?".
- **Atalhos e `<select>`:** um `<select>` com foco não tem desfazer próprio. Ctrl+Z e Ctrl+Y vão para o histórico; as demais teclas ficam com a lista.
- **Campo que grava ao sair e Esc:** `blur()` dispara o `onBlur` na hora, com o texto antigo na closure. Marque o cancelamento num `ref` antes do `blur()` (veja o `ConditionField`).
- **Arquivo `.tsx` só exporta componentes** (`react-refresh/only-export-components`): funções e hooks compartilhados vão para um `.ts` ao lado (`expression-check.ts`, `use-file-status.ts`).
- **`diagrama-ui.mjs` instável:** os arrastos e o clique logo depois de "Ajustar à tela" falham às vezes, cada vez num ponto diferente, também na versão de antes da Fase 4 (uma em três rodadas). Se a saída divergir a partir de um arrasto ou parar em `não achei`, rode de novo.
- **Tela inicial logo depois de um build:** demora mais que alguns segundos para mostrar os recentes. Espere a lista aparecer antes de clicar (o `run-ui.sh` faz isso).
- **Roteiros de interface abrem janelas na tela do usuário:** os cliques vão direto para a janela do app, sem tomar o mouse, mas as janelas abrindo e fechando incomodam. Combine com o usuário antes de rodar, e não abra o `mdd.exe` na mão enquanto eles rodam.
- **`xmllint` e `@xmldom/xmldom` se completam:** o `xmllint` é rigoroso com a sintaxe, mas aceita prefixo de namespace sem declaração e, com DOCTYPE de DTD externa, entidades como `&nbsp;`; o `xmldom` pega esses dois casos, mas aceita `&` solto e atributo sem aspas. Para conferir um fragmento, rode os dois, nessa ordem.
- **Posições do `@xmldom/xmldom`:** ele converte as quebras de linha antes de ler, e as posições deixam de bater com o texto original. Passe `normalizeLineEndings: (source) => source` e conte as linhas como ele (`\r\n`, `\r` e `\n`). Ele também recusa o BOM: tire-o antes.
- **Renomear pasta no Windows:** falha com `EPERM` se um arquivo dela estiver aberto em outro processo (mesmo com permissão de exclusão) e com `EBUSY` se ela for o diretório atual de outro processo. Para reproduzir num roteiro, um PowerShell segura o arquivo (`generation-support.mts`).
- **BOM no código:** escreva `'\u{FEFF}'`. A forma de quatro dígitos pode virar um BOM literal, invisível, ao passar pela ferramenta de escrita.
- **Rodadas seguidas do `run-ui.sh`:** logo depois de uma rodada, as portas 9229 e 9333 podem ficar em `TIME_WAIT`, e o roteiro seguinte sai vazio (só `app fechado`). Espere uns segundos entre as rodadas e rode de novo.
