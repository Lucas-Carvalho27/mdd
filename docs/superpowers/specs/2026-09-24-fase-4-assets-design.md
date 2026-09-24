# Fase 4 — Assets: desenho

Aprovado em 24/09/2026. Detalha a linha da Fase 4 da [SPEC](../../SPEC.md) §9, os assets da §4.3 e da §7 e os comandos de asset da §4.5.

> O protótipo refinou alguns pontos deste desenho: a ordem no `assets.xml`, a conferência depois de qualquer mudança nos assets, Ctrl+Z com o foco numa lista de opções e as funções de edição separadas. Veja "O que o protótipo respondeu" no [plano](../plans/2026-09-24-fase-4-assets.md); a SPEC já reflete esses pontos.

## Objetivo

Vincular arquivos do projeto às features. A janela ganha a aba **Assets**, com a lista dos assets agrupados por âncora, o estado de cada arquivo (ok ou ausente) e as ações abrir, editar, trocar arquivo, reordenar e desvincular. O painel da feature, na aba Modelo, passa a mostrar os assets ancorados nela.

**Aceitação (SPEC §9):** a aba mostra os 6 assets do exemplo. Renomear `boleto.xml` fora do app faz o asset aparecer como ausente. Como na 2A, a aceitação também recria os assets do exemplo do zero pela interface, e o `assets.xml` salvo sai idêntico ao do exemplo.

**Não muda:**

- o formato dos arquivos e o `SaveProject`: o `assets.xml` já é gravado, e já é criado quando falta;
- a exclusão em cascata: excluir uma feature já desvincula os assets ancorados nela ou com condição que a cite;
- o configurador e o diagrama.

**Fora desta fase:**

- o estado "XML malformado", que só é conferido na geração (Fase 5);
- vigiar a pasta em tempo real;
- vincular vários arquivos de uma vez;
- arrastar para reordenar;
- busca ou filtro na lista;
- abrir a pasta do arquivo no Explorer.

## Abordagem escolhida

**Lista agrupada por âncora, com painel à direita.** É a estrutura das outras abas (faixa de abas, área central, painel de propriedades) e o que a SPEC §7 descreve. Mostra todos os assets de uma vez, inclusive os ausentes.

Alternativas descartadas:

- **Diagrama com a contagem de assets em cada nó:** reaproveita o diagrama, mas ver todos os assets, e principalmente os ausentes, exige clicar nó por nó. E foge da SPEC.
- **Tabela única com edição em diálogo:** o editor de condição (erro com a posição e sugestão de IDs) fica apertado num diálogo, e cada mudança vira abrir e fechar uma janela.

## Tela

### A aba Assets

A faixa lateral ganha a terceira aba: Modelo | Configurações | **Assets**.

- **Barra do topo:** "Vincular arquivo…", "Atualizar" e um resumo, como "6 assets · 1 ausente".
- **Centro:** um grupo por âncora, com as âncoras na pré-ordem do modelo. Só aparecem as features que têm assets.
  - O cabeçalho do grupo mostra o nome e o ID da feature.
  - Cada linha mostra o ícone do tipo (fragmento ou recurso), o nome (ou o nome do arquivo, quando o asset não tem nome), o caminho em fonte monoespaçada, a condição (se houver) e o estado: **ok** discreto ou **ausente** em vermelho. Antes da primeira resposta, o estado é "verificando…".
  - Botões da linha: **Abrir** (desligado quando o arquivo está ausente), **↑ ↓** (só dentro da mesma âncora; o primeiro não sobe e o último não desce) e **Desvincular**. Desvincular não pede confirmação: tem desfazer, e o arquivo continua no disco.
  - Clicar na linha seleciona o asset.
- **Painel direito**, para o asset selecionado:
  - **ID**, só leitura;
  - **Arquivo:** o caminho e o estado, com **Abrir** e **Trocar arquivo…**;
  - **Nome** (opcional), **Tipo** (fragmento ou recurso) e **Âncora** (lista das features na pré-ordem, com nome e ID);
  - **Condição:** o mesmo editor das restrições, com o erro de sintaxe e a posição enquanto se digita e a sugestão de IDs. Vazio significa sem condição. Só uma expressão válida, que cite apenas features existentes, é gravada. Ao sair do campo com uma expressão inválida, o texto fica com o erro à vista e nada é gravado: o asset continua com a condição anterior.
  - Os campos de texto gravam ao sair, como no painel da feature. Tipo e âncora gravam ao escolher.
- **Sem assets:** a área central explica o que é um asset e mostra o botão "Vincular arquivo…".
- **Sem seleção:** o painel pede para escolher um asset na lista.

### Vincular

1. "Vincular arquivo…" abre o diálogo nativo na pasta do projeto. Cancelar não faz nada.
2. Um arquivo fora do projeto é recusado com a orientação: "O arquivo precisa estar dentro da pasta do projeto. Copie-o para dentro e vincule de novo." Nada muda.
3. Com um arquivo de dentro, abre o diálogo **Vincular arquivo**:
   - **Arquivo:** o caminho relativo, só leitura;
   - **Tipo:** sugerido pela extensão (`.xml` → fragmento; as demais → recurso);
   - **Nome:** opcional, vazio;
   - **ID:** sugerido pelo nome do arquivo sem a extensão, no formato de ID de feature (`pix-fluxo.svg` → `pix_fluxo`), com `_2`, `_3`… se já existir. Pode ser ajustado **só aqui**; depois fica fixo, como o das features (ADR 0004). O ID aparece no `product.xml` gerado (`<fragment asset="…">`), e é o ajuste que permite recriar o exemplo: `visao-geral.xml` sugere `visao_geral`, e o exemplo usa `doc_loja`. Um ID inválido ou repetido aparece em vermelho no campo, e o botão fica desligado. A SPEC §4.3 e o ADR 0004 passam a registrar essa regra para os assets;
   - **Âncora:** já preenchida. Na aba Assets, é a âncora do asset selecionado ou, sem seleção, a feature selecionada no modelo. No painel da feature, é a própria feature.
4. Confirmar cria o asset como o último da âncora, seleciona o asset e confere o estado do arquivo dele.

O mesmo arquivo pode ser vinculado mais de uma vez, por exemplo uma imagem usada em duas seções.

### Editar

Toda mudança é um comando do histórico (SPEC §4.5).

- **Trocar a âncora:** o asset vai para o fim da nova âncora.
- **Trocar arquivo…:** o mesmo diálogo nativo e a mesma recusa de arquivo de fora. Muda só o caminho: ID, nome, tipo, âncora e condição ficam como estão. Depois, o estado do arquivo novo é conferido.
- **Reordenar:** troca o asset de lugar com o vizinho da mesma âncora. A ordem dentro da âncora é a ordem no `assets.xml` e a ordem no produto gerado (SPEC §4.3).

### Estado do arquivo

**Ok** quando o caminho existe e é um arquivo. **Ausente** quando não existe, quando é uma pasta ou quando não dá para conferir (por exemplo, sem permissão). A geração confere de novo antes de gravar (SPEC §4.4).

O app confere todos os assets:

- ao abrir e ao recarregar o projeto;
- ao entrar na aba Assets;
- quando a janela do app volta a ter o foco (por exemplo, depois de renomear um arquivo no Explorer);
- depois de vincular ou trocar um arquivo;
- no botão "Atualizar".

Se uma conferência mais nova terminar antes de uma antiga, a resposta da antiga é descartada.

### Painel da feature (aba Modelo)

Ganha a seção **Assets ancorados**: o nome (ou nome do arquivo) e o estado de cada asset ancorado na feature, na ordem do `assets.xml`, e o botão "Vincular arquivo…", com a feature como âncora.

### Desfazer e atalhos

O histórico é um só (SPEC §4.5).

| Atalho                                | Modelo | Configurações | Assets |
| ------------------------------------- | ------ | ------------- | ------ |
| Ctrl+Z / Ctrl+Y (e os botões)         | sim    | não           | sim    |
| Tab, Enter, F2, Delete, Alt+↑ / Alt+↓ | sim    | não           | não    |
| Ctrl+S                                | sim    | sim           | sim    |

Na aba Assets, desfazer pode voltar uma edição feita no modelo; o botão mostra o rótulo do que vai ser desfeito. Um asset selecionado que deixa de existir (por exemplo, depois de desfazer o vínculo) sai da seleção.

## Arquitetura

Segue as camadas da SPEC §6. As regras de import continuam sendo conferidas pelo lint.

| Unidade                                                      | Faz                                                                                                                                                                                                                                                                                                                                     | Depende de               |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `domain/assets/asset-edits.ts`                               | Operações puras que devolvem `Result`: `linkAsset` (no fim; confere o formato e a unicidade do ID), `updateAsset` (nome, tipo, âncora e condição; trocar a âncora leva ao fim), `relinkAsset`, `reorderAsset` (com o vizinho da mesma âncora) e `unlinkAsset`. Sugestões: `suggestAssetKind` e `suggestAssetId` (sobre o `generateId`). | `domain/`                |
| `domain/assets/asset-groups.ts`                              | `groupAssetsByAnchor(model, catalog)`: grupos na pré-ordem do modelo, só com as âncoras que têm assets, e os assets na ordem do catálogo.                                                                                                                                                                                               | `domain/`                |
| `domain/assets/asset-file-status.ts`                         | `AssetFileStatus = 'ok' \| 'missing'`: o estado do arquivo da SPEC §4.3, calculado e nunca salvo.                                                                                                                                                                                                                                       | —                        |
| `application/editing/commands.ts`                            | Comandos novos, um por operação, com rótulos como `Vincular "boleto.xml"` e `Desvincular "Guia do PIX"`. O histórico já confere A1–A3 depois de cada um.                                                                                                                                                                                | `domain/`                |
| `application/ports/project-storage.ts`                       | Ganha `stat(path)`: arquivo, pasta ou o erro (`not-found` e os demais). Já estava prevista na SPEC §6.3.                                                                                                                                                                                                                                | —                        |
| `application/ports/project-file-picker.ts`                   | `ProjectFilePicker.pickFile()`: o caminho relativo, `null` quando cancelado, ou o erro de arquivo fora do projeto. É a porta própria que a SPEC §6.2 reservou para esta fase.                                                                                                                                                           | —                        |
| `application/ports/asset-opener.ts`                          | `AssetOpener.open(path)`: abre o arquivo no programa padrão, ou devolve o motivo da falha.                                                                                                                                                                                                                                              | —                        |
| `application/use-cases/check-asset-files.ts`                 | `CheckAssetFiles`: recebe o catálogo e devolve o estado por caminho. Confere cada caminho uma vez só, em paralelo.                                                                                                                                                                                                                      | `ProjectStorage`         |
| `shared/ipc.ts`, `preload/`, `main/ipc/`                     | Canais `stat`, `pickFileInProject` e `openPath`. O `pickFileInProject` abre o diálogo na raiz, converte o caminho para relativo com `/` (o `ProjectRoot` ganha `toRelative`) e recusa o que estiver fora. O `openPath` confere se o caminho fica dentro do projeto e existe, e chama `shell.openPath`.                                  | `electron`               |
| `infrastructure/electron/`                                   | `ElectronProjectFilePicker`, `ElectronAssetOpener` e o `stat` no `ElectronProjectStorage`, sobre `window.mdd`.                                                                                                                                                                                                                          | `application/ports`      |
| `ui/stores/assets-actions.ts`                                | As ações de assets da store, num arquivo próprio montado na `project-store`: o asset selecionado, o mapa de estados, `checkAssetFiles` (com descarte da resposta antiga), escolher arquivo, vincular, trocar arquivo e abrir. O resto da store não muda.                                                                                | `application/`           |
| `ui/components/ExpressionInput.tsx`                          | O campo de expressão tirado de dentro do `ConstraintForm`: erro com a posição e sugestão de IDs. Usado pelas restrições e pela condição, para o editor não ficar duplicado.                                                                                                                                                             | `domain/expression`      |
| `ui/screens/assets/`                                         | `AssetsWorkspace` (barra, lista e painel), `AssetList`, `AssetProperties` e `LinkAssetDialog`.                                                                                                                                                                                                                                          | store, `ExpressionInput` |
| `ui/screens/project/properties/AnchoredAssetsSection.tsx`    | A seção "Assets ancorados" do painel da feature.                                                                                                                                                                                                                                                                                        | store                    |
| `ui/screens/project/` (`ViewRail`, `ProjectScreen`, atalhos) | A terceira aba; a conferência quando a janela volta ao foco (`useWindowFocus`); os atalhos com três escopos (desfazer, edição da estrutura e salvar), conforme a tabela acima.                                                                                                                                                          | —                        |
| `ui/app/composition-root.ts`                                 | Instancia os adapters novos e o `CheckAssetFiles`.                                                                                                                                                                                                                                                                                      | `infrastructure/`        |

Sem dependências novas.

## Erros

Os erros aparecem na faixa amarela de avisos que o app já tem, sem mudar nada no projeto:

- **Arquivo de fora do projeto:** a orientação de copiar o arquivo para dentro.
- **Falha ao abrir** (o arquivo sumiu, ou nenhum programa está associado à extensão): "Não foi possível abrir …", com o motivo que o sistema der.
- **Edição recusada** pelas regras A1–A3: o motivo, como nas edições do modelo.

No diálogo de vincular, o ID inválido ou repetido aparece no próprio campo, como no diálogo de nova feature.

## Riscos a eliminar no protótipo (antes do plano)

1. **O caminho escolhido no diálogo.** Converter para relativo no Windows: maiúsculas e minúsculas, `\` e `/`, arquivo em outro disco, e a própria pasta do projeto como escolha.
2. **A volta do foco.** Conferir se o evento `focus` da janela dispara no renderer quando o usuário volta do Explorer. Se não disparar, o main avisa o renderer a partir do evento `focus` do `BrowserWindow`.
3. **O `shell.openPath` no app empacotado.** Uma abertura de verdade, combinada com o usuário, porque abre um programa na tela dele.
4. **O `ExpressionInput` extraído.** As restrições têm de continuar se comportando igual.
5. **As ações de assets num arquivo à parte.** Montá-las na mesma store do Zustand, com os tipos certos e sem import circular.

O plano da fase só é escrito com essas respostas, e contém o código já verificado.

## Verificação

Sem testes automatizados (ADR 0008).

- **Checagens de sempre:** `npm run typecheck`, `npm run lint` e `npm run build`, com Prettier antes de cada commit.
- **`asset-edits-check.mts`:** o domínio e os comandos: vincular, editar, trocar arquivo, reordenar, desvincular, as sugestões de ID e de tipo, o agrupamento, as recusas e o desfazer. O caso principal recria os 6 assets do exemplo do zero, por comandos, e confere que o `assets.xml` sai idêntico ao do exemplo.
- **`asset-files-check.mts`:** o `CheckAssetFiles` sobre um armazenamento em memória: ok, ausente, caminho que é pasta, caminho repetido e erro de leitura.
- **`assets-store-check.mts`:** a store com portas falsas: escolha cancelada, arquivo de fora, resposta antiga descartada e seleção depois de desfazer.
- **`assets-ui.mjs`:** o roteiro da tela pelo protocolo de depuração do Chromium, com entrada real. Os diálogos nativos e o `shell.openPath` são trocados pelo inspetor do main, então nenhum programa abre na tela do usuário: o roteiro registra o que o app pediu. Confere:
  - os 6 assets do exemplo agrupados por âncora;
  - `boleto.xml` renomeado fora do app aparecendo como ausente, e "Trocar arquivo…" voltando a ok;
  - a condição com erro de sintaxe recusada, e uma válida gravada;
  - reordenar, desvincular e desfazer;
  - o arquivo de fora recusado com a orientação;
  - a seção "Assets ancorados" no painel da feature;
  - os atalhos em cada aba.
- **Regressão:** os roteiros da 2A (`ui-check.mjs`), da 2B (`diagrama-ui.mjs`) e da Fase 3 (`configurador-ui.mjs`). A extração do `ExpressionInput` mexe nas restrições, e os atalhos mudam de escopo.
- **Aceitação no `mdd.exe` empacotado:** os 6 assets na aba; `boleto.xml` renomeado fora do app aparecendo como ausente; os assets do exemplo recriados do zero pela interface, com o `assets.xml` salvo idêntico ao do exemplo. Os roteiros abrem janelas na tela do usuário, então o momento é combinado com ele antes.
