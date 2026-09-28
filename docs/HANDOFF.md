# Handoff — onde paramos e como continuar

Atualizado em 28/09/2026. Leia este arquivo primeiro ao retomar o projeto.

## Estado atual

| Fase                      | Situação                          | Onde está                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Fundação               | Concluída                         | `main` (GitHub)                                                                                                                                                                                                                                                                                                                          |
| 1. Domínio e persistência | Concluída                         | `main` (GitHub)                                                                                                                                                                                                                                                                                                                          |
| 2A. Edição do modelo      | Concluída                         | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md](superpowers/plans/2026-09-23-fase-2a-edicao-do-modelo.md)                                                                                                                                                                                      |
| 2B. Diagrama visual       | Concluída                         | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-2b-diagrama.md](superpowers/plans/2026-09-23-fase-2b-diagrama.md)                                                                                                                                                                                                      |
| 3. Configurador           | Concluída                         | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-23-fase-3-configurador.md](superpowers/plans/2026-09-23-fase-3-configurador.md); correções da revisão final em [docs/superpowers/plans/2026-09-24-fase-3-correcoes.md](superpowers/plans/2026-09-24-fase-3-correcoes.md)                                                       |
| 4. Assets                 | Concluída                         | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-24-fase-4-assets.md](superpowers/plans/2026-09-24-fase-4-assets.md)                                                                                                                                                                                                            |
| 5. Geração                | Concluída                         | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-24-fase-5-geracao.md](superpowers/plans/2026-09-24-fase-5-geracao.md); correções da revisão final em [docs/superpowers/plans/2026-09-24-fase-5-correcoes.md](superpowers/plans/2026-09-24-fase-5-correcoes.md)                                                                 |
| 6. Editor de fragmentos   | Concluída                         | `main` (GitHub). Plano em [docs/superpowers/plans/2026-09-24-fase-6-editor-fragmentos.md](superpowers/plans/2026-09-24-fase-6-editor-fragmentos.md)                                                                                                                                                                                      |
| 7. Páginas HTML           | Concluída (checagem à mão adiada) | `main` (local; o usuário envia ao GitHub). Plano em [docs/superpowers/plans/2026-09-28-fase-7-paginas-html.md](superpowers/plans/2026-09-28-fase-7-paginas-html.md); desenho em [docs/superpowers/specs/2026-09-28-fase-7-paginas-html-design.md](superpowers/specs/2026-09-28-fase-7-paginas-html-design.md), com as decisões da Fase 8 |
| 8. Aba Páginas            | Concluída (checagem à mão adiada) | `main` (local; o envio ao GitHub fica com o usuário). Plano em [docs/superpowers/plans/2026-09-28-fase-8-aba-paginas.md](superpowers/plans/2026-09-28-fase-8-aba-paginas.md); desenho em [docs/superpowers/specs/2026-09-28-fase-8-aba-paginas-design.md](superpowers/specs/2026-09-28-fase-8-aba-paginas-design.md)                     |

O app abre uma pasta de projeto, valida os XMLs em três etapas (XML bem-formado, XSD e regras do domínio), mostra o modelo e salva tudo de volta sem mudar um byte. Com as fases seguintes, também:

- mostra o modelo num diagrama na notação clássica, com layout automático, zoom, "ajustar à tela" e subárvores recolhíveis;
- edita o modelo (features, grupos, atributos e restrições), com desfazer/refazer e diálogo de impacto ao excluir;
- edita também pelo diagrama: menu de contexto no nó e arrastar e soltar para mudar o pai de uma feature;
- cria projetos e reabre os recentes;
- mostra "•" no título com alterações não salvas e salva com Ctrl+S;
- pergunta o que fazer quando um arquivo foi alterado fora do app, e confirma antes de fechar com alterações;
- resolve cada configuração com o solver SAT e a mostra no diagrama em modo configuração, com decisões por clique, valores de atributos, lista de configurações e faixas para configurações desatualizadas ou em conflito.
- vincula arquivos do projeto às features na aba Assets, com o estado de cada arquivo (ok ou ausente), trocar arquivo, reordenar, desvincular e abrir no programa padrão, e mostra os assets ancorados no painel da feature.
- gera o produto de uma configuração completa em `saida/<nome>/`, com o `product.xml` e os recursos copiados, conferindo todas as fontes antes e sem gravar nada quando há problema.
- cria e edita os fragmentos na aba Fragmentos, num editor de XML com realce e a mesma conferência da geração, e os salva junto com o projeto, mantendo o BOM e as quebras de linha de cada arquivo.

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

## Aceitação da Fase 6 (feita em 25/09/2026)

O desenho está em [docs/superpowers/specs/2026-09-24-fase-6-editor-fragmentos-design.md](superpowers/specs/2026-09-24-fase-6-editor-fragmentos-design.md), e o plano, em [docs/superpowers/plans/2026-09-24-fase-6-editor-fragmentos.md](superpowers/plans/2026-09-24-fase-6-editor-fragmentos.md). A fase não estava no roadmap: o usuário pediu um editor de XML dentro do app para os fragmentos.

**Como o código entrou.** O código foi prototipado num clone descartável (branch `prototipo-fase-6`) e verificado lá. Depois, cada tarefa foi aplicada sozinha, em ordem, num branch descartável por tarefa, sobre o `dc1dcd7`: os roteiros novos falharam antes e deram a saída do plano depois, com typecheck e lint limpos (`.checks/por-tarefa.sh`). O plano foi montado por script a partir desse branch e conferido pelo `verify-plan-6.py`. A pedido do usuário, esses seis commits já verificados (um por tarefa, idênticos ao plano) entraram no branch `fase-6-editor-fragmentos`, em vez de o plano ser executado de novo passo a passo. No branch da fase, tudo foi conferido outra vez: typecheck, lint, build e os 13 roteiros sem janela iguais ao plano.

**Achados ao rodar a interface** (antes do plano, no protótipo):

- **Um fragmento novo salvo sumia da árvore** até a próxima leitura das pastas. A correção está no `saveFragments` (`fragments-actions.ts`), e o `fragments-store-check.mts` passou a mostrar a árvore logo depois de salvar.
- **O roteiro `fragmentos-ui.mjs` tinha três erros próprios:** o `cmTile` do `@codemirror/view` 6.43, a cor minificada pelo build e a conexão com o processo main que não fechava (veja "Armadilhas").
- **O critério 4 da aceitação não era conferido por nenhum roteiro:** o passo 15 do `fragmentos-ui.mjs` passou a mostrar o estado do arquivo na aba Assets (`cartao:ok`).

**Roteiros, todos com a saída esperada no plano:**

- `fragment-path-check.mts` e `text-format-check.mts` (Tarefa 1), `fragment-checker-check.mts` (Tarefa 2), `save-fragments-check.mts` (Tarefa 3) e `fragments-store-check.mts` (Tarefa 4);
- `fragmentos-ui.mjs`, no modo de desenvolvimento (Tarefa 5) e no `mdd.exe` gerado pelo `npm run build:win` do branch da fase (Tarefa 6, Passo 2), com saídas idênticas. O `app.asar` não leva `.checks/`.

**Regressão:** `configurations-check` e `save-safety-check` (Tarefa 1), `fragment-source-check` e `generate-product-check` (Tarefa 2), `assets-store-check`, `configurator-store-check` e `generation-store-check` (Tarefa 4), e os roteiros de interface `ui-check`, `configurador-ui`, `assets-ui` e `geracao-ui` (Tarefa 5): todos iguais aos planos das fases anteriores. O `diagrama-ui.mjs` (2B) não rodou: a fase não mexe no diagrama nem na aba Modelo.

**Checagem à mão** (Tarefa 6, Passo 3), feita pelo usuário no `mdd.exe`, sobre uma cópia do exemplo em `.checks/aceitacao-manual/`. Ele respondeu que tudo pareceu perfeito:

1. o `pix.xml` na aba Fragmentos, com as cores do realce, os números de linha e a linha atual destacada, no tema claro;
2. um `>` apagado: a linha sublinhada, a marca na margem e o problema embaixo, com a linha; Ctrl+Z desfez;
3. o `pix.xml` editado no Bloco de Notas, sem alteração no app: ao voltar com um clique, o editor mostrou o texto novo.

O tema escuro não foi visto: o app ainda não o liga (nada aplica a classe `.dark`).

**Revisão final do branch inteiro** (`git diff dc1dcd7..` do código): nenhum problema crítico nem importante. Foram conferidos o estado do CodeMirror guardado por arquivo (inclusive com o `StrictMode` do React montando duas vezes), o salvar com edição durante a gravação, o conflito e o "Recarregar", a volta do foco, a listagem de pastas (atalhos de pasta não são seguidos, então não há ciclo) e o CodeMirror só em `ui/screens/fragments/`. Itens menores, registrados sem correção:

- **Ctrl+S segurado:** o `save()` não confere se já há um salvamento em andamento (o botão do cabeçalho fica desligado, mas o atalho não). Dois salvamentos sobrepostos fazem o segundo acusar um conflito falso, que aparece por um instante. Não há perda de dados, e a falha vem da Fase 2A; a Fase 6 só alarga a janela, porque cada fragmento gravado passa pelo `xmllint`. Reproduzido com o `.checks/double-save-check.mts`. Ficou como tarefa separada.
- **"Recarregar" com o texto igual ao do disco** mantém o histórico de desfazer daquele arquivo. É inofensivo.
- **Nomes reservados do Windows** (`con.xml`, `nul.xml`, `com1.xml`) não são recusados no caminho novo. Neste Windows 11, eles viram arquivos comuns, gravados e relidos sem problema.

O branch `fase-6-editor-fragmentos` foi mesclado na `main` em 25/09/2026 e enviado ao GitHub. O branch `prototipo-fase-6` continua no GitHub só como fonte dos roteiros: **nunca o mescle**.

## Aceitação da Fase 7 (feita em 28/09/2026)

O desenho está em [docs/superpowers/specs/2026-09-28-fase-7-paginas-html-design.md](superpowers/specs/2026-09-28-fase-7-paginas-html-design.md), e o plano, em [docs/superpowers/plans/2026-09-28-fase-7-paginas-html.md](superpowers/plans/2026-09-28-fase-7-paginas-html.md). A fase não estava no roadmap: o usuário pediu páginas HTML montadas pela configuração e uma aba para vê-las no app. As decisões saíram de uma sessão de perguntas e respostas (45 decisões, inclusive as da Fase 8, que ficaram registradas no fim do desenho).

**O exemplo é o herby**, o projeto real do usuário (tutoriais da plataforma Herby), convertido de XML para HTML pelo `.checks/herby-convert.mts` em `docs/examples/herby/`. O original, em `C:\Users\lucas\Desktop\herby`, fica fora do git e não foi alterado. O usuário conferiu a tabela perfil × features antes da gravação das 13 configurações; Preparação, Acesso à Plataforma e Impressão dos Cartões passaram a opcionais no exemplo. O conteúdo com `perfis` (46 dos 96 blocos) fica em `<template data-perfis>`, esperando a variabilidade anotativa.

**Como o código entrou.** Como na Fase 6: o código foi prototipado num clone descartável (branch `prototipo-fase-7`) e verificado lá; depois, cada tarefa foi aplicada sozinha, em ordem, sobre o `e3c0c18`, num branch descartável por tarefa (`.checks/por-tarefa-7.sh`): os roteiros novos falharam antes e deram a saída do plano depois, com typecheck e lint limpos. O plano foi montado por script (`.checks/build-plan-7.py`) e conferido pelo `verify-plan-7.py` (54 marcadores, 0 problemas). Os commits já verificados entraram no branch `fase-7-paginas-html`, onde tudo foi conferido de novo.

**Achados ao montar as tarefas** (além dos do protótipo, que estão no desenho e no plano):

- **O `npm run format` reformataria o exemplo herby** (o Prettier formata HTML e CSS; o XML dos exemplos escapava por não ser formatado). O `docs/examples` foi para o `.prettierignore`, na Tarefa 3.
- Dentro do plano, os blocos da `moldura.html` e do `herby.css` levam `<!-- prettier-ignore -->`, pelo mesmo motivo. Saídas de roteiro com espaço no fim de linha não sobrevivem ao Prettier no Markdown: o `html-checker-check.mts` e o `html-page-check.mts` deixaram de imprimi-los.

**Roteiros, no branch da fase, todos com a saída do plano:** as quatro conferências do `por-tarefa-7.sh` (os roteiros novos e a regressão das Fases 3, 5 e 6); o `paginas-ui.mjs` no modo de desenvolvimento e no `mdd.exe` gerado pelo `npm run build:win` do branch (a geração de `completa-atibaia` pelo botão dá o `index.html` idêntico ao esperado, com 60 arquivos, e nenhum erro no console); e a regressão da interface (`fragmentos-ui`, `geracao-ui`, `assets-ui`, `configurador-ui` e `ui-check`), igual às fases anteriores, com a única diferença prevista na dica do diálogo de fragmento novo. O `diagrama-ui.mjs` (2B) não rodou: a fase não mexe no diagrama.

**Checagem à mão** (Tarefa 5, Passo 3): **adiada a pedido do usuário.** A cópia preparada em `.checks/aceitacao-herby` não tinha a `saida/` gerada pelos passos no `mdd.exe`, e o usuário pediu para seguir com o merge. Ele tinha visto antes a página do herby gerada pelo protótipo, que é a mesma. Fica para uma próxima oportunidade: os quatro passos estão no plano, e a cópia continua em `.checks/aceitacao-herby`.

**Envio ao GitHub:** o envio do `prototipo-fase-7` pelo Claude foi bloqueado pela permissão da sessão. O usuário envia com `git push origin prototipo-fase-7` (o branch está no repositório local, com os roteiros finais no commit `8aa8be4`).

## Aceitação da Fase 8 (feita em 28/09/2026)

O desenho está em [docs/superpowers/specs/2026-09-28-fase-8-aba-paginas-design.md](superpowers/specs/2026-09-28-fase-8-aba-paginas-design.md), e o plano, em [docs/superpowers/plans/2026-09-28-fase-8-aba-paginas.md](superpowers/plans/2026-09-28-fase-8-aba-paginas.md). As decisões de produto foram tomadas na sessão de perguntas da Fase 7; o usuário aprovou as cinco decisões técnicas do desenho (o `<iframe>` com sandbox servido pelo esquema `mdd-page:`, a página mesmo com problemas, o script da visualização, o texto do editor para os fragmentos abertos e os links para fora no navegador do sistema). O ADR 0011 registra o isolamento.

**Como o código entrou.** Como nas Fases 6 e 7: protótipo num clone descartável (branch `prototipo-fase-8`, que guarda também os roteiros), tarefas aplicadas uma a uma sobre o `0091dd4` (`.checks/por-tarefa-8.sh`), plano montado por script e conferido (`verify-plan-8.py`: 43 marcadores, 0 problemas), e os commits verificados no branch `fase-8-aba-paginas`, onde tudo foi conferido de novo.

**Achados do protótipo** (no desenho e no plano): a CSP do app barra a navegação do quadro antes de o main ser consultado, e o `will-frame-navigate` não serve: os links para fora são abertos pelo script da visualização como janela nova; a página da última visita aparecia por meio segundo ao voltar à aba; "Criar moldura" recusava o caminho de uma moldura apagada por fora; a borda do quadro tirava 2 px da largura "Celular"; e, na visualização, a moldura não podia ser "o primeiro arquivo preparado".

**Roteiros, no branch da fase, todos com a saída do plano:** as duas conferências do `por-tarefa-8.sh` (os roteiros novos e a regressão das Fases 5 a 7); o `aba-paginas-ui.mjs` no modo de desenvolvimento e no `mdd.exe` do `npm run build:win` do branch (o isolamento, as larguras, o link externo, a edição sem salvar com a rolagem mantida, o Ctrl+S na página, o valor de atributo, a configuração incompleta, o problema com o clique até a linha, a moldura padrão com "Criar moldura", e gerar e abrir no navegador, sem erro no console); e a regressão da interface (`paginas-ui`, que só ganhou "Abrir no navegador" na faixa, `fragmentos-ui`, `geracao-ui`, `assets-ui`, `configurador-ui` e `ui-check`), igual às fases anteriores.

**Checagem à mão** (Tarefa 4, Passo 3): **adiada a pedido do usuário**, que pediu o merge na `main` em 28/09/2026. A cópia está em `.checks/aceitacao-herby`, e os quatro passos estão no plano.

## Próximo passo

As fases 0 a 8 estão concluídas, e as checagens manuais das Fases 0 e 1 também (veja abaixo).

**A Fase 7 (páginas HTML) está concluída** e mesclada na `main` local em 28/09/2026, com a checagem à mão adiada (veja "Aceitação da Fase 7"). Nada desta sessão foi enviado ao GitHub: a `main`, o `fase-7-paginas-html` e o `prototipo-fase-7` estão só no repositório local, e o usuário os envia ("depois a gente sobe pro git").

**As Fases 7 e 8 estão concluídas** e mescladas na `main` local em 28/09/2026, com as checagens à mão adiadas a pedido do usuário. **O envio ao GitHub fica com o usuário:** o `git push` pelo Claude foi barrado pela permissão da sessão. O comando que envia tudo (a `main` e os branches das fases e dos protótipos) está no fim da seção "Armadilhas já encontradas".

O próximo passo, para o usuário escolher: a variabilidade anotativa (os `perfis` do herby, começando por decidir o que cada perfil significa em features), as checagens à mão das Fases 7 e 8, ou os itens abaixo.

- **O exemplo é o herby**, o projeto real do usuário, em `C:\Users\lucas\Desktop\herby`. Ele está fora do git: **nunca o altere**. A conversão grava só em `docs/examples/herby/`.
- **O repositório ficou privado** em 28/09/2026 para receber o herby, que é material da empresa. Não o torne público de novo sem falar com o usuário.

O que resta, para o usuário escolher:

- a correção do Ctrl+S segurado (veja "Aceitação da Fase 6");
- os itens da fase "Depois" da SPEC §9.

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
- **Os scripts de `.checks/` não vão para o git.** Num clone novo, recrie os que precisar a partir dos planos. O `cdp-eval.mjs` está no plano da Fase 1 (Tarefa 6, Passo 8). O `ui-check.mjs` está no plano da 2A (Tarefa 7, Passo 8). Os roteiros da 2B (`diagram-check.mts`, `store-check.mts`, `cdp.mjs`, `diagrama-ui.mjs`, `main-dialogs.mjs` e `aceitacao-2b.mjs`) estão no plano da 2B. Os da Fase 3 (`resolution-check.mts`, `configurations-check.mts`, `configurator-store-check.mts`, `quit.mjs`, `configurador-ui.mjs` e `aceitacao-3.mjs`) estão no plano da Fase 3. O `save-safety-check.mts` está nas correções da Fase 3 ([docs/superpowers/plans/2026-09-24-fase-3-correcoes.md](superpowers/plans/2026-09-24-fase-3-correcoes.md)). Os da Fase 4 (`asset-edits-check.mts`, `asset-files-check.mts`, `project-root-check.mts`, `assets-store-check.mts`, `main-process.mjs`, `run-ui.sh`, `assets-ui.mjs` e `aceitacao-4.mjs`) estão no plano da Fase 4, cada um num passo "Escrever `.checks/<nome>`"; o `ui-check.mjs` precisa das duas mudanças da 2B (plano da 2B, Tarefa 4, Passo 6). Os da Fase 5 (`generation-plan-check.mts`, `output-guard-check.mts`, `fragment-source-check.mts`, `generation-support.mts`, `generate-product-check.mts`, `generation-store-check.mts`, `geracao-ui.mjs` e `aceitacao-5.mjs`) estão no plano da Fase 5; as versões corrigidas do `generate-product-check.mts` e do `generation-store-check.mts` estão nas correções da Fase 5 ([docs/superpowers/plans/2026-09-24-fase-5-correcoes.md](superpowers/plans/2026-09-24-fase-5-correcoes.md)). Os da Fase 6 (`fragment-path-check.mts`, `text-format-check.mts`, `fragment-checker-check.mts`, `memory-folder.mts`, `save-fragments-check.mts`, `fragments-store-check.mts` e `fragmentos-ui.mjs`) estão no plano da Fase 6; o `fragment-source-check.mts` da Fase 5 troca um import (Tarefa 2, Passo 8). Os da Fase 7 (`markers-check.mts`, `page-paths-check.mts`, `html-checker-check.mts`, `html-page-check.mts`, `herby-convert.mts`, `herby-open-check.mts`, `herby-generate.mts`, `html-store-check.mts` e `paginas-ui.mjs`, mais o `run-ui.sh`, que aceita `EXAMPLE=herby`, e o `fragment-path-check.mts` com os casos `.html`) estão no plano da Fase 7. Os da Fase 8 (`edited-storage-check.mts`, `page-preview-check.mts`, `pages-store-check.mts` e `aba-paginas-ui.mjs`, mais o `main-process.mjs` que registra o `shell.openExternal`) estão no plano da Fase 8. Mais rápido que recriar: o branch `prototipo-fase-8` guarda todos os roteiros, nas versões que os planos esperam (inclusive os das fases anteriores), com as saídas conferidas em `.checks/out/`. Para trazê-los sem passar pelo índice do git, rode na raiz `git archive prototipo-fase-8 .checks | tar -x` (a pasta é ignorada pelo git; use `origin/prototipo-fase-8` num clone depois que o usuário enviar o branch). O `run-ui.sh` prepara a cópia do exemplo, abre o app, espera a tela inicial, roda um roteiro e fecha: prefira-o a montar os comandos à mão. Num plano, cada roteiro vem depois de uma linha "Crie `.checks/<nome>`:", e dá para extraí-los com um script pequeno em vez de copiar à mão.
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
- **O CodeMirror nos roteiros:** o `EditorView` sai do DOM por `document.querySelector('.cm-content').cmTile.root.view` (desde o `@codemirror/view` 6.43; antes era `cmView.view`), como faz o `EditorView.findFromDOM`. É uma propriedade interna: ao atualizar o pacote, confira o `fragmentos-ui.mjs`.
- **Variáveis CSS depois do build:** o build minifica os valores (`oklch(0.46 0.16 262)` vira `oklch(46% .16 262)`), e o `getPropertyValue` devolve o texto minificado. Para comparar uma cor, use a cor calculada de um elemento com `color: var(--nome)`.
- **Roteiro com `connectMain`:** guarde a conexão e chame `main.close()` no fim. Aberta, ela segura o Node, e o `run-ui.sh` nunca chega a fechar o app.
- **O CodeMirror e as quebras de linha:** o editor troca `\r\n` e `\r` por `\n` e não sabe do BOM. O `text-format.ts` guarda o formato do arquivo e o devolve ao gravar; sem isso, salvar trocaria o arquivo inteiro no git.
- **Roteiros no plano e o Prettier:** o Prettier reformata o código dentro dos blocos do Markdown. Um roteiro de `.checks/` (fora do Prettier) só aparece igual no plano se estiver no formato dele; rode `npx prettier --write --ignore-path /dev/null .checks/<roteiro>` antes de montar o plano.
- **Rodadas seguidas do `run-ui.sh`:** logo depois de uma rodada, as portas 9229 e 9333 podem ficar em `TIME_WAIT`, e o roteiro seguinte sai vazio (só `app fechado`). Espere uns segundos entre as rodadas e rode de novo.
- **O parse5 não acusa as tags que descarta:** um `</section>` a mais, um `<td>` fora da tabela ou o `<body>` de um fragmento somem da árvore sem erro. O `html-source.ts` os acha pelo que a árvore não cobre (veja o ADR 0010).
- **Sugestões do CodeMirror:** a fonte registrada no `languageData` precisa ser a mesma função durante todo o estado do editor. Uma função nova a cada consulta faz o CodeMirror descartar a resposta, e a lista não aparece ao digitar.
- **O Prettier e os exemplos:** ele formata HTML e CSS, inclusive dentro dos blocos de um plano. O `docs/examples` está no `.prettierignore`, e os blocos de HTML e CSS de um plano levam `<!-- prettier-ignore -->`.
- **Envio ao GitHub pelo Claude:** nesta máquina, a permissão da sessão pode barrar o `git push`, mesmo com a autorização do usuário. Nesse caso, o usuário envia.
- **A página da visualização e o protocolo de depuração:** o quadro é um alvo `iframe` à parte (`/json` lista o endereço `mdd-page://pagina/index.html`); os roteiros o leem por esse alvo, e esperam uma montagem nova pelo `v=` do endereço, porque a rolagem também muda o `y=`.
- **Navegação de um `<iframe>` e a CSP:** o `frame-src` do app barra a navegação do quadro ainda no renderer; o `will-frame-navigate` do main nem é chamado.
- **O envio ao GitHub desta sessão**, para o usuário rodar: `git push origin main fase-7-paginas-html fase-8-aba-paginas prototipo-fase-7 prototipo-fase-8`. Confira antes que o repositório continua privado: ele leva o exemplo herby, que é material da empresa.
