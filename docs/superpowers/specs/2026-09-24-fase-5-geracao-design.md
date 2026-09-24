# Fase 5 — Geração: desenho

Aprovado em 24/09/2026. Detalha a linha da Fase 5 da [SPEC](../../SPEC.md) §9, a geração da §4.4, as portas da §6.2, os canais da §6.3 e o botão "Gerar produto" da §7.

> O protótipo refinou alguns pontos deste desenho: a ordem das conferências dos fragmentos (`xmllint` e depois `@xmldom/xmldom`), os recursos do plano como assets, o `GenerateProduct` sem o `ProjectStorage` direto e os diálogos num componente próprio. Veja "O que o protótipo respondeu" no [plano](../plans/2026-09-24-fase-5-geracao.md); a SPEC já reflete esses pontos.

## Objetivo

Gerar o produto de uma configuração completa: a pasta `saida/<chave>/`, com o `product.xml` (os fragmentos embutidos) e os recursos copiados. `<chave>` é o nome do arquivo da configuração, sem `.xml`. O configurador ganha o botão **Gerar produto**.

**Aceitação (SPEC §9):**

- Gerar `loja-basica` produz o equivalente a `docs/examples/produto-esperado/loja-basica/product.xml`, mais `docs/img/pix-fluxo.svg` idêntico byte a byte. A comparação ignora espaços, comentários e `generatedAt`.
- Com `pag_boleto` selecionado e `boleto.xml` ausente, a geração falha, lista o problema e não grava nada: nem a pasta `saida/` é criada.

**Não muda:**

- os formatos dos arquivos do projeto e o salvar;
- a aba Assets, que continua com ok / ausente;
- o histórico de desfazer e o "•" de não salvo: gerar não é uma edição.

**Fora desta fase:**

- o estado "XML malformado" na aba Assets (ele só aparece no diálogo de erros da geração);
- gerar todas as configurações de uma vez;
- escolher outra pasta de saída;
- abrir o `product.xml` direto;
- histórico de gerações;
- outros derivers (DITA, DocBook), que o ADR 0006 deixa para depois.

## Decisões

- **Gera do que está na tela.** Modelo, assets e configuração vêm da memória, com as alterações não salvas. O botão e o resultado olham para a mesma coisa: o botão só liga quando a configuração da tela está completa. Os fragmentos e os recursos são sempre lidos do disco, porque o app não os edita.
- **Sucesso numa faixa verde, sem diálogo:** não interrompe, e gerar de novo só atualiza a hora.
- **"XML malformado" só no diálogo de erros da geração.** Se fizer falta na aba Assets, a conferência de fragmentos da geração já fica pronta para ser reaproveitada.
- **Escrita e troca nas camadas do renderer, sobre portas; o main só com canais genéricos e protegidos.** Alternativas descartadas:
  - **uma operação única de "publicar saída" no main:** tiraria a lógica da troca das camadas, e o main passaria a conhecer o formato da saída;
  - **tudo no main:** duplicaria o escritor de XML nos dois processos.

## Fluxo

```
configuração na tela ──► 1. Plano (domínio, puro)
                          │ recusa se a configuração não estiver completa
                          ▼
                         2. Derivação (XmlProductDeriver, infraestrutura)
                          │ lê e confere os fragmentos e os recursos, monta o product.xml
                          │ algum problema? → devolve todos, nada é gravado
                          ▼
                         3. saida/<chave>/ já existe e não veio "substituir"?
                          │ → devolve "precisa confirmar", e a tela pergunta
                          ▼
                         4. Escrita (WriteProductFolder, aplicação): pasta temporária e troca
```

O caso de uso `GenerateProduct` faz essa sequência e devolve um de quatro resultados:

| Resultado         | Traz                                          | A tela mostra                      |
| ----------------- | --------------------------------------------- | ---------------------------------- |
| gerado            | a pasta (`saida/loja-basica/`) e a hora       | a faixa verde                      |
| problemas         | a lista de `FileProblem` da derivação         | o diálogo "Não foi possível gerar" |
| precisa confirmar | a pasta que já existe                         | o diálogo "Substituir …?"          |
| falha na escrita  | os problemas de disco e onde ficou a anterior | o diálogo "Não foi possível gerar" |

É o padrão do `SaveProject`: a tela pergunta e chama de novo com `replace: true`. A derivação vem antes da pergunta, então nunca se confirma uma substituição que depois falharia. Ao confirmar, tudo roda de novo, o que também pega um arquivo mudado enquanto o diálogo estava aberto.

A hora vem da porta `Clock`, lida pelo caso de uso: ela entra no `generatedAt` do `product.xml` e na faixa verde.

## O plano (domínio)

`planGeneration(model, catalog, configuration, resolution)` é uma função pura em `domain/generation/`. Se a resolução não for de uma configuração completa (SPEC §4.2), devolve erro: a regra "só gera configuração completa" fica no domínio, e não só no botão desligado. Senão, devolve o `GenerationPlan`:

- **`productName`** e **`modelName`:** os atributos `name` e `model` do `<product>` (o nome da configuração e o do modelo).
- **`features`:** as features selecionadas, em pré-ordem, cada uma com o ID, o nome e os valores finais dos atributos, na ordem do modelo. Atributo fixo leva o `default`; configurável leva o valor da configuração ou, sem ele, o `default`. Numa configuração completa, todo atributo tem valor.
- **`root`:** a árvore de seções. Cada feature selecionada vira uma seção, aninhada como na árvore (uma feature selecionada sempre tem o pai selecionado). Cada seção guarda os **fragmentos** incluídos, na ordem do `assets.xml`.
- **`resources`:** os caminhos dos recursos incluídos, sem repetição, na ordem do `assets.xml`. Recursos não aparecem no `product.xml`; só são copiados.

**Inclusão** (SPEC §4.3): um asset entra quando a âncora está selecionada **e** a condição, se houver, é verdadeira. A condição é avaliada por `evaluateExpression(expression, selecionadas)`, novo em `domain/expression/`, sobre o conjunto das features selecionadas (`not`, `and`, `or`, `implies`, `iff`, `true`, `false`).

O `generatedAt` não entra no plano, para ele continuar puro.

## Derivação: verificação e `product.xml` (infraestrutura)

A porta `ProductDeriver` recebe o plano e o `generatedAt` e devolve os arquivos do produto ou a lista de problemas:

- **arquivos de texto:** `product.xml`, com o conteúdo pronto;
- **cópias:** os caminhos dos recursos, que vão para o mesmo caminho dentro da pasta de saída.

O adapter `XmlProductDeriver` verifica todas as fontes antes de montar qualquer coisa, e lista todos os problemas de uma vez. Cada caminho é conferido uma vez só, mesmo que dois assets usem o mesmo arquivo.

**Recursos:** precisam ser arquivos que existem (`stat`). Faltou: "arquivo ausente".

**Fragmentos:** cada um é lido como texto UTF-8 e passa por três conferências:

1. **Codificação:** uma declaração com `encoding` diferente de UTF-8 é um problema.
2. **Extração da raiz:** só o elemento raiz vai para o produto, com o texto exatamente como está no arquivo. Saem a declaração XML, o DOCTYPE, os comentários e as instruções de processamento de fora da raiz, e o BOM.
3. **XML bem-formado:** o trecho extraído é conferido pelo `xmllint` do main. A porta `XmlSchemaValidator` passa a aceitar a conferência sem schema. Como o trecho não tem DOCTYPE, uma entidade além das 5 do XML e das referências numéricas (`&nbsp;`, por exemplo) aparece como erro aqui: fora do arquivo original, ela deixaria de existir (ADR 0006). O número da linha é convertido para o do arquivo original.

Cada problema vira um `FileProblem`, com o caminho do arquivo, a linha (quando houver), o ID do asset em `subject` e a mensagem. Os textos lidos seguem para o `product.xml` sem ser lidos de novo.

**O `product.xml`,** gravado pelo escritor determinístico (SPEC §5), com os atributos na ordem do exemplo esperado:

- `<product xmlns="urn:mdd:product" schemaVersion="1" name model generatedAt>`, com `<features>` e `<content>`;
- `generatedAt` em UTC, sem milissegundos: `2026-09-24T14:03:00Z`;
- cada fragmento dentro de `<fragment asset="…" xml:base="<pasta do fragmento>/">`, com `./` para um fragmento na raiz do projeto;
- dentro do `<fragment>`, a raiz do fragmento **sem nenhuma mudança nos espaços internos**. Um bloco `<pre>` continua igual. Só a tag de abertura recebe o recuo do `product.xml`, e o escritor ganha um nó de "texto cru" para isso;
- **`xmlns=""`:** se a raiz do fragmento não declara um namespace padrão, ela recebe `xmlns=""` na tag de abertura. Sem isso, os elementos sem prefixo do fragmento herdariam o `urn:mdd:product` do produto e mudariam de significado. As demais declarações de namespace já estão na própria raiz, porque o fragmento é um documento completo.

## Escrita e troca (aplicação)

`WriteProductFolder` recebe a chave, os arquivos do produto e a opção `replace`. Trabalha só com a porta `ProjectStorage`, sem saber nada de XML, e assim um deriver futuro (DITA, DocBook) reaproveita a troca.

1. Apaga os restos de uma geração interrompida: `saida/.<chave>.tmp/` e `saida/.<chave>.old/`.
2. Grava os arquivos de texto e copia os recursos, **byte a byte**, para `saida/.<chave>.tmp/`.
3. Se `saida/<chave>/` existe, renomeia-a para `saida/.<chave>.old/`. Depois renomeia a `.tmp` para `saida/<chave>/` e apaga a `.old`.
4. **Falhas:**
   - no passo 2, ou ao renomear a pasta antiga: apaga a `.tmp`, e a pasta antiga fica onde estava;
   - ao renomear a `.tmp`: a `.old` volta a ser `saida/<chave>/`, e a `.tmp` é apagada;
   - se nem a volta der certo, a mensagem diz onde está a versão anterior (`saida/.<chave>.old/`);
   - o caso comum no Windows é um arquivo da pasta aberto em outro programa, que impede renomear. A mensagem é: "Não foi possível substituir `saida/loja-basica/`: feche os arquivos dessa pasta e gere de novo."

Renomear a antiga, em vez de apagá-la primeiro, garante que uma falha no meio não deixe o usuário sem nenhuma das duas versões. Apagar a `.old` no fim é a única etapa que pode falhar depois da troca: o produto novo já está no lugar, e a sobra sai na próxima geração.

## Processo main e IPC

- **Canais novos:**
  - `copy(de, para)`: copia um arquivo do projeto para outro caminho do projeto, criando as pastas e substituindo um arquivo que já esteja no destino; a origem precisa ser um arquivo;
  - `rename(de, para)`;
  - `removeDirectory(caminho)`: apaga a pasta com tudo o que tem dentro; uma pasta que não existe conta como apagada.
- **Proteção de `saida/`:** `rename` e `removeDirectory` só aceitam caminhos **dentro de `saida/`**, nunca a própria `saida/`, e recusam os outros com `outside-project`. A comparação ignora maiúsculas, como o Windows. Assim, um defeito no renderer nunca apaga nem move o projeto.
- **`openPath`:** continua abrindo arquivos do projeto e passa a abrir **pastas só dentro de `saida/`**, para o "Abrir pasta" da faixa.
- **`validateXml`** aceita a conferência sem schema (só XML bem-formado).
- **O nome `saida`** fica numa constante em `src/shared/`. O main a usa na proteção, e a composition root a entrega ao `WriteProductFolder`: a aplicação não importa `shared/`, e o nome continua num lugar só.

## Tela

**Na barra da configuração aberta,** ao lado de Renomear, Duplicar e Excluir, entra o botão **Gerar produto**:

- **Desligado** quando a configuração não está completa, com uma dica que diz o motivo no texto da barra de status, por exemplo "Complete a configuração para gerar: 2 indecisas, 1 atributo sem valor". Em conflito ou com o modelo vazio, também fica desligado.
- **Enquanto gera,** mostra "Gerando…" e não aceita outro clique.

**Diálogos** (entram no `EditorDialog`, que já existe):

- **Substituir:** "Substituir `saida/loja-basica/`?", com o texto "A pasta já existe e será trocada pelo produto novo. O que você tiver colocado nela à mão será perdido." e os botões **Substituir** e **Cancelar**.
- **Não foi possível gerar:** a lista no formato do `ProblemList` (arquivo, linha, asset e mensagem), com a frase "Nada foi gravado." ou, na falha da troca, "A pasta anterior foi mantida." (ou onde ela ficou).

**Faixa verde,** acima do diagrama, como as faixas de problemas do configurador: "Produto gerado em `saida/loja-basica/` às 14:03", com **Abrir pasta** (abre no Explorer) e ×.

- A store guarda só a última geração: a chave, a pasta e a hora.
- A faixa aparece quando a configuração aberta é a que foi gerada: some ao trocar de configuração e volta ao voltar para ela.
- Some no ×, ao gerar outra configuração, ao renomear a configuração (a chave muda) e ao fechar o projeto. Gerar de novo atualiza a hora.
- Uma falha ao abrir a pasta aparece na faixa amarela de avisos, como o "Abrir" dos assets.

Não há atalho de teclado para gerar.

## Arquitetura

Segue as camadas da SPEC §6. As regras de import continuam sendo conferidas pelo lint.

| Unidade                                         | Faz                                                                                                                                                         | Depende de                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `domain/expression/evaluator.ts`                | `evaluateExpression(expression, selected)`: o valor da expressão com as features do conjunto verdadeiras e as demais falsas.                                | `domain/`                                                                                 |
| `domain/assets/asset-inclusion.ts`              | `isAssetIncluded(asset, selected)`: a âncora está selecionada e a condição, se houver, é verdadeira (SPEC §4.3).                                            | `domain/`                                                                                 |
| `domain/generation/generation-plan.ts`          | `GenerationPlan` e `planGeneration(model, catalog, configuration, resolution)`, com erro para configuração incompleta.                                      | `domain/`                                                                                 |
| `application/ports/clock.ts`                    | `Clock.now()`.                                                                                                                                              | —                                                                                         |
| `application/ports/product-deriver.ts`          | `ProductDeriver.derive(plan, generatedAt)`: os arquivos do produto (textos e cópias) ou a lista de `FileProblem`.                                           | `domain/`                                                                                 |
| `application/ports/project-storage.ts`          | Ganha `copy`, `rename` e `removeDirectory`.                                                                                                                 | —                                                                                         |
| `application/ports/xml-schema-validator.ts`     | Aceita a conferência sem schema (só XML bem-formado).                                                                                                       | —                                                                                         |
| `application/ports/output-folder-opener.ts`     | `OutputFolderOpener.open(pasta)`: abre a pasta gerada no gerenciador de arquivos.                                                                           | —                                                                                         |
| `application/use-cases/write-product-folder.ts` | `WriteProductFolder`: a pasta temporária e a troca, com as falhas acima.                                                                                    | `ProjectStorage`                                                                          |
| `application/use-cases/generate-product.ts`     | `GenerateProduct`: resolve, planeja, deriva, confere se a pasta existe e escreve; devolve um dos quatro resultados.                                         | `ResolveConfiguration`, `ProductDeriver`, `WriteProductFolder`, `Clock`, `ProjectStorage` |
| `infrastructure/xml/xml-writer.ts`              | Ganha o nó de texto cru.                                                                                                                                    | —                                                                                         |
| `infrastructure/xml/fragment-source.ts`         | A extração da raiz do fragmento: a posição no texto, a linha inicial, a codificação declarada e se falta o namespace padrão.                                | —                                                                                         |
| `infrastructure/xml/xml-product-deriver.ts`     | `XmlProductDeriver`: a verificação das fontes e o `product.xml`.                                                                                            | `ProjectStorage`, `XmlSchemaValidator`                                                    |
| `infrastructure/electron/`                      | `copy`, `rename` e `removeDirectory` no `ElectronProjectStorage`; a conferência sem schema no `ElectronXmlSchemaValidator`; o `ElectronOutputFolderOpener`. | `application/ports`, `shared/`                                                            |
| `infrastructure/system/system-clock.ts`         | `SystemClock`.                                                                                                                                              | `application/ports`                                                                       |
| `shared/`, `preload/`, `main/`                  | A constante `saida`; os canais novos; a proteção de `saida/` no `ProjectRoot`; `openPath` com pastas de `saida/`; `validateXml` sem schema.                 | `electron`, `fs`                                                                          |
| `ui/stores/generation-actions.ts`               | As ações de geração da store, num arquivo próprio como o `assets-actions.ts`: gerar, a última geração, abrir a pasta e fechar a faixa.                      | `application/`                                                                            |
| `ui/screens/configurator/`                      | O botão na barra, a faixa verde e os dois diálogos.                                                                                                         | store                                                                                     |
| `ui/app/composition-root.ts`                    | Instancia os adapters novos, o `WriteProductFolder` com a constante `saida` e o `GenerateProduct`.                                                          | `infrastructure/`, `shared/`                                                              |

Sem dependências novas: o `@xmldom/xmldom` e o `xmllint-wasm` já estão no projeto.

## Riscos a eliminar no protótipo (antes do plano)

1. **`xmllint-wasm` sem schema:** a chamada, os números de linha, e se `&nbsp;` num trecho sem DOCTYPE vira erro. Também se um DOCTYPE com DTD externa (comum em DITA) faz o `xmllint` tentar carregá-la.
2. **Extração da raiz:** BOM; comentários e instruções antes da raiz; DOCTYPE com subconjunto interno (que pode ter `>` e `[`); CDATA ou comentário com texto parecido com a tag de fechamento; comentários depois da raiz; a conversão das linhas para o arquivo original.
3. **`xmlns=""`:** o `product.xml` gerado passa no `product.xsd` (que importa o `xml.xsd`), e o fragmento sem namespace fica sem namespace quando o produto é lido.
4. **Renomear pasta no Windows** com um arquivo dela aberto em outro programa, ou com o Explorer mostrando a pasta: que erro volta, e se um roteiro consegue reproduzir a trava.
5. **Proteção de `saida/`:** `saida` sozinha, `saida/../model.xml`, `saida2/`, `SAIDA/x` e caminhos absolutos.
6. **A comparação com o esperado:** ignorar espaços entre elementos, comentários e `generatedAt`, sem esconder uma diferença de verdade no texto dos fragmentos.

O plano da fase só é escrito com essas respostas, e contém o código já verificado.

## Verificação

Sem testes automatizados (ADR 0008).

- **Checagens de sempre:** `npm run typecheck`, `npm run lint` e `npm run build`, com Prettier antes de cada commit.
- **`generation-plan-check.mts`:**
  - o plano da `loja-basica`: as features com os atributos, as seções e os assets de cada seção;
  - `busca` sem `mobile`, que deixa o `doc_busca_app` de fora;
  - uma configuração incompleta, recusada;
  - o avaliador com os cinco operadores e as constantes.
- **`generate-product-check.mts`,** com o armazenamento do Node sobre uma cópia do exemplo e um relógio fixo:
  - o `product.xml` equivalente ao esperado, e válido no `product.xsd`; o `.svg` idêntico byte a byte;
  - com `pag_boleto` e sem o `boleto.xml`: o problema, e nenhuma pasta `saida/`;
  - um fragmento malformado, com a linha certa; um com `&nbsp;`; um com outra codificação;
  - um fragmento sem namespace recebendo o `xmlns=""`; um com DOCTYPE e comentários antes da raiz;
  - a pasta existente pedindo confirmação, e a substituição;
  - restos de `.tmp` e `.old` limpos;
  - a volta da pasta antiga quando a troca falha, com um armazenamento que falha de propósito.
- **`output-guard-check.mts`:** a proteção de `saida/` no main.
- **`geracao-ui.mjs`,** pelo protocolo de depuração do Chromium, no modo de desenvolvimento e no `mdd.exe`:
  - o botão desligado com a dica, e ligado quando a configuração fica completa;
  - gerar e ver a faixa; trocar de configuração e voltar;
  - o diálogo de substituir, com Cancelar e com Substituir;
  - o diálogo de problemas;
  - "Abrir pasta", com o `shell.openPath` trocado pelo registrador do `main-process.mjs`.
- **`aceitacao-5.mjs`** no `mdd.exe`: os dois critérios da SPEC §9.
- **Regressão:** `ui-check.mjs` (2A), `configurador-ui.mjs` (Fase 3) e `assets-ui.mjs` (Fase 4).
- **Checagem à mão com o usuário** no `mdd.exe`:
  - "Abrir pasta" abre o Explorer de verdade;
  - com um arquivo da pasta gerada aberto em outro programa, gerar de novo mostra o aviso e mantém a pasta anterior. Se o protótipo conseguir reproduzir a trava por roteiro, este item passa para o roteiro.
- **Documentação,** na última tarefa: a SPEC (§4.4 com o `xmlns=""`, as entidades e a troca pela `.old`; §6.2 com as portas; §6.3 com os canais; §7 com o botão e a faixa) e o handoff.

Os roteiros abrem janelas na tela do usuário, então o momento é combinado com ele antes.
