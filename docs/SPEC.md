# mdd — Especificação da primeira versão

> Linguagem do domínio: [CONTEXT.md](../CONTEXT.md). Decisões de arquitetura: [docs/adr/](adr/).
> Schemas: [docs/schemas/](schemas/). Projeto de exemplo: [docs/examples/loja-online/](examples/loja-online/).

## 1. Visão geral

Aplicação desktop (Electron + React + TypeScript), de uso pessoal e com arquivos locais, para:

1. **Modelar** a variabilidade de uma linha de produtos num Feature Model editado como diagrama gráfico.
2. **Configurar** produtos, com propagação completa das regras do modelo por um solver SAT.
3. **Vincular assets** (arquivos do projeto) às features.
4. **Gerar** o `product.xml` de documentação de cada produto, que ferramentas externas convertem depois para as mídias finais.

A arquitetura é em camadas, com SOLID e Clean Code. Não há testes automatizados na primeira versão (ADR 0008); a aceitação de cada fase é manual, com o projeto de exemplo (§9).

## 2. Escopo

**Na primeira versão (fases 0–5):**

- Feature Model com features obrigatórias e opcionais, grupos com cardinalidade `[min..max]` (alternative e or são casos particulares), restrições proposicionais livres e atributos tipados (fixos ou configuráveis).
- Editor visual com layout automático, painel de propriedades, painel de restrições e undo/redo.
- Configurador com propagação completa, valores de atributos e detecção de configuração desatualizada.
- Assets com âncora e condição de presença.
- Geração do produto: `product.xml` com fragmentos embutidos mais os recursos copiados.

**Fora da primeira versão (fase "Depois"):** clones, restrições com atributos, análises do modelo (`ModelAnalyzer`: features mortas etc.), variabilidade anotativa, renderers por mídia, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes automatizados.

## 3. Projeto em disco

```
meu-projeto/
  model.xml                  obrigatório — o Feature Model
  assets.xml                 opcional — ausente = nenhum asset (criado ao salvar)
  configurations/*.xml       opcional — uma configuração por arquivo
  saida/<configuração>/      criado pela geração
  …                          fragmentos e recursos, em qualquer subpasta
```

- Todo caminho gravado nos arquivos é **relativo à pasta do projeto**, usa `/` como separador e não pode sair da pasta (`..` que escape da raiz é inválido).
- O nome do arquivo de uma configuração (sem `.xml`) é a identidade dela; renomear a configuração renomeia o arquivo. Esse nome é gerado a partir do nome de exibição (slug).

## 4. Domínio

### 4.1 Feature Model

**Estrutura.** Uma árvore com exatamente uma **feature raiz**. Os filhos de uma feature são, em ordem, features solitárias e grupos intercalados. A ordem entre irmãos é semântica: define a ordem das seções no produto gerado.

**Invariantes** (erro = o arquivo não abre, ou o comando de edição é recusado):

| #   | Regra                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Os IDs de feature são únicos no modelo, seguem `[a-z][a-z0-9_]*` e não são palavras reservadas (`not and or implies iff true false`).                                                                                                                                        |
| M2  | A raiz não tem `variability`. Uma feature solitária sempre tem. Um membro de grupo nunca tem.                                                                                                                                                                                |
| M3  | Um grupo tem ao menos 1 membro. `min ≥ 0`. `max` é `*` ou um inteiro `≥ max(min, 1)`. `min ≤ número de membros`.                                                                                                                                                             |
| M4  | As restrições têm IDs únicos, expressão sintaticamente válida e só referenciam IDs de features existentes.                                                                                                                                                                   |
| M5  | Os IDs de atributo são únicos dentro da feature. `min`/`max` só existem em `number`, com `min ≤ max`. `enum` tem ao menos uma `option`, sem valores repetidos. `default`, se existir, é um valor válido para o tipo. Atributo fixo (`configurable="false"`) exige `default`. |

**Aviso** (não bloqueia): um grupo com `max` maior que o número de membros é tratado como `*`, e um grupo com 1 membro só é sinalizado.

**IDs.** São sugeridos a partir do nome (minúsculas, sem acento, espaços viram `_`, sufixo `_2`, `_3`… em caso de colisão) e podem ser ajustados **no momento da criação**, nos diálogos "Nova filha", "Nova irmã" e "Novo projeto". Depois de criados, são **imutáveis** na primeira versão (ADR 0004).

**Linguagem de expressões** (usada em restrições e condições de presença):

```ebnf
expr     = iff ;
iff      = implies , { "iff" , implies } ;
implies  = or , [ "implies" , implies ] ;        (* associativa à direita *)
or       = and , { "or" , and } ;
and      = unary , { "and" , unary } ;
unary    = "not" , unary | primary ;
primary  = ID | "true" | "false" | "(" , expr , ")" ;
ID       = letra-minúscula , { letra-minúscula | dígito | "_" } ;  (* exceto palavras reservadas *)
```

Precedência, da mais forte para a mais fraca: `not`, `and`, `or`, `implies`, `iff`. Erros de sintaxe informam a posição (coluna). Ao salvar, a expressão é gravada na **forma canônica** (espaços simples, parênteses só onde necessário), para que o arquivo seja determinístico.

**Semântica.** O modelo equivale à conjunção de:

1. a raiz é verdadeira;
2. para cada feature `c` com pai `p`: `c implies p`;
3. para cada solitária obrigatória `c` com pai `p`: `p implies c`;
4. para cada grupo de `p` com membros `m1..mk` e cardinalidade `[a..b]`: `p implies (a ≤ m1 + … + mk ≤ b')`, com `b' = k` quando `b` for `*` ou maior que `k`;
5. todas as restrições.

O domínio constrói essa fórmula como uma árvore (`Formula`, que além dos operadores lógicos tem um nó de cardinalidade). Resolver a fórmula é trabalho da infraestrutura (§6.3).

### 4.2 Configuração

Uma configuração guarda só as **decisões manuais** (`selected` ou `deselected`) e os **valores de atributos** (ADR 0005). Todo o resto é calculado.

**Resolução** (feita sempre que o modelo ou as decisões mudam):

1. Se a fórmula do modelo, sozinha, for insatisfatível → **modelo vazio**: o configurador avisa que o modelo não admite nenhum produto.
2. Referências a features ou atributos que não existem mais → **referências órfãs**, que são ignoradas no cálculo.
3. Se a fórmula mais as decisões manuais for insatisfatível → **em conflito**: nenhuma propagação é mostrada, e a tela lista as decisões manuais para o usuário remover até voltar a ser válida.
4. Caso contrário, o solver encontra uma solução σ. Para cada feature `f` sem decisão manual, testa se a fórmula + decisões + `f ≠ σ(f)` é satisfatível. Se não for, `f` recebe a **decisão propagada** `σ(f)`; se for, `f` fica **indecisa**. Soluções encontradas nos testes são reaproveitadas para pular features que já apareceram com os dois valores.

**Estados calculados:**

| Estado        | Condição                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Válida        | Não está em conflito.                                                                                                                  |
| Completa      | Válida, sem features indecisas e com todo atributo configurável de feature selecionada tendo valor (o da configuração ou o `default`). |
| Desatualizada | Tem referências órfãs, está em conflito, ou tem valor de atributo inválido para o tipo.                                                |

**Valores de atributos.** `number` deve ser decimal dentro de `min..max`; `boolean` deve ser `true` ou `false`; `enum` deve ser uma das `option`; `string` aceita qualquer texto. Valores de features não selecionadas continuam no arquivo, mas são ignorados. Um valor para um atributo que ficou fixo no modelo conta como referência órfã. Um valor inválido de uma feature selecionada conta como atributo sem valor.

**Regras de interação:** uma feature com decisão propagada não aceita decisão manual contrária (fica travada na interface). Um clique nunca deixa a configuração em conflito: se o próximo estado do ciclo contradisser as outras decisões, a decisão sobre a feature é removida, e ela passa a mostrar o valor que o modelo impõe. Decisões e valores novos entram na ordem do modelo (pré-ordem), para o arquivo não depender da ordem dos cliques. Configurações incompletas podem ser salvas. A geração só é liberada para configurações completas.

### 4.3 Assets

Um asset tem `id` único (no mesmo formato de ID de feature), `kind` (`fragment` ou `resource`), `path`, `anchor` (ID de feature) e, opcionalmente, `name` e `condition`. O `id` é sugerido pelo nome do arquivo ao vincular (`pix-fluxo.svg` → `pix_fluxo`) e pode ser ajustado só nesse momento; depois não muda, nem ao trocar o arquivo (ADR 0004).

**Invariantes:** A1 — `path` é relativo e fica dentro do projeto. A2 — `anchor` existe no modelo. A3 — `condition`, se existir, é uma expressão válida que só referencia features existentes.

**Inclusão.** Um asset entra no produto quando a âncora está selecionada **e** a condição (se existir) é verdadeira para a configuração. A ordem dos assets de uma mesma âncora é a ordem no `assets.xml`.

**Ordem no arquivo.** Um asset novo, ou que troca de âncora, entra como o último da âncora, na posição que mantém o `assets.xml` agrupado na ordem das âncoras no modelo (pré-ordem). Assim o arquivo não depende da ordem em que os vínculos foram feitos. Reordenar troca o asset de lugar com o vizinho da mesma âncora.

**Estado do arquivo** (calculado, não salvo): _ok_ (o caminho é um arquivo que existe), _ausente_ (não existe, é uma pasta ou não pode ser conferido) ou, só para fragmentos e verificado na geração, _XML malformado_.

### 4.4 Geração

Entrada: uma configuração **completa**. Saída: `saida/<nome-do-arquivo-da-configuração>/`.

1. **Plano (domínio, puro).** Calcula as features selecionadas em pré-ordem, os valores finais dos atributos (fixo → `default`; configurável → valor da configuração ou `default`), a árvore de seções (uma seção por feature selecionada, aninhada como na árvore) e, para cada seção, os assets incluídos (§4.3).
2. **Verificação.** Todos os arquivos do plano existem, e todos os fragmentos são XML bem-formado em UTF-8, sem prefixos de namespace sem declaração e sem entidades além das cinco do XML e das referências numéricas (`&nbsp;`, por exemplo, deixaria de existir fora do arquivo original, porque o DOCTYPE fica de fora). Um fragmento que não está em UTF-8 é recusado: com a declaração de outra codificação, na linha 1; sem declaração, na linha do primeiro byte que não é UTF-8 (um acento salvo em Latin-1, por exemplo). Se houver qualquer problema, **nada é gravado** e todos os problemas são listados de uma vez, com o arquivo, a linha e o asset.
3. **Escrita.** Grava numa pasta temporária `saida/.<nome>.tmp/`:
   - `product.xml` conforme `product.xsd`. Cada fragmento vira `<fragment asset="…" xml:base="<pasta do fragmento>/">` contendo o elemento raiz do arquivo com o texto exatamente como está (sem BOM, declaração XML, DOCTYPE nem os comentários de fora da raiz). Se a raiz não declara um namespace padrão, ela recebe `xmlns=""`, para os elementos sem prefixo não herdarem o `urn:mdd:product`. Um fragmento na raiz do projeto recebe `xml:base="./"`.
   - Cada recurso incluído é copiado byte a byte para `<saída>/<path>`, mantendo a estrutura de pastas.
4. **Troca.** Antes da pergunta, a geração recupera a versão anterior: uma `saida/.<nome>.old/` sem a pasta `saida/<nome>/` (a troca e a volta falharam, ou o app caiu entre as duas trocas) volta a ser `saida/<nome>/`. Se ela não voltar, a geração para sem apagar nada e diz onde está a versão anterior. Só então, se `saida/<nome>/` existir, pede confirmação para substituir. Depois renomeia a pasta antiga para `saida/.<nome>.old/`, renomeia a temporária para o lugar dela e apaga a `.old`. Se algo falhar, a temporária é apagada e a pasta antiga fica, ou volta, no lugar; no Windows, um arquivo da pasta aberto em outro programa impede a troca. As sobras de uma geração interrompida são apagadas na seguinte: a temporária e uma `.old` junto da pasta do produto (ela sobrou de uma troca que deu certo).

A geração usa o projeto como está na tela, com as alterações não salvas; os fragmentos e os recursos vêm do disco. Gerar não entra no histórico de desfazer.

Referência de resultado: [docs/examples/produto-esperado/loja-basica/](examples/produto-esperado/loja-basica/). A comparação ignora espaços em branco e `generatedAt`.

### 4.5 Edição e evolução do modelo

Toda edição do modelo ou dos assets é um **Command** (um objeto com `label` e `run()`) executado pelo histórico de desfazer/refazer (ADR 0008). O comando não sabe se desfazer: como o estado é imutável, o histórico guarda o estado anterior de cada comando, e desfazer é voltar a ele. Depois de cada comando, o histórico confere as regras M1–M5 e A1–A3 e recusa o que as quebraria, mostrando o motivo. O histórico é zerado ao abrir outro projeto.

Comandos da primeira versão:

- **Modelo:** renomear.
- **Feature:** adicionar filho, adicionar irmão, renomear (só o nome), editar descrição, mudar variabilidade, mover para outro pai, reordenar entre irmãos, excluir (com a subárvore).
- **Grupo:** criar grupo a partir de filhos, mudar cardinalidade, desfazer grupo (os membros viram solitárias opcionais), mover para dentro ou para fora de um grupo.
- **Atributo:** adicionar, editar, excluir.
- **Restrição:** adicionar, editar, excluir.
- **Asset:** vincular, editar (nome, tipo, âncora, condição), reordenar, desvincular.

Regras:

- Mover uma feature para dentro da própria subárvore é recusado.
- Ao entrar num grupo, a feature perde a variabilidade. Ao sair, vira opcional.
- Se um grupo ficar vazio, ele é removido. Se ficar com `min` maior que o número de membros, `min` é reduzido e o diálogo de impacto avisa.
- **Excluir feature ou atributo mostra o impacto antes** (Q24):
  - restrições que citam qualquer feature excluída são **removidas inteiras**;
  - assets ancorados nessas features, ou com condição que as cite, são **desvinculados** (os arquivos ficam no disco);
  - configurações que as referenciam são **contadas e listadas**, mas não alteradas: elas aparecem como desatualizadas quando forem abertas.

  Tudo isso é um único comando, e desfazer restaura tudo.

## 5. Formatos de arquivo

| Arquivo                | Namespace               | Schema                                         | Exemplo                                                                |
| ---------------------- | ----------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `model.xml`            | `urn:mdd:feature-model` | [feature-model.xsd](schemas/feature-model.xsd) | [model.xml](examples/loja-online/model.xml)                            |
| `assets.xml`           | `urn:mdd:assets`        | [assets.xsd](schemas/assets.xsd)               | [assets.xml](examples/loja-online/assets.xml)                          |
| `configurations/*.xml` | `urn:mdd:configuration` | [configuration.xsd](schemas/configuration.xsd) | [loja-basica.xml](examples/loja-online/configurations/loja-basica.xml) |
| `product.xml` (gerado) | `urn:mdd:product`       | [product.xsd](schemas/product.xsd)             | [product.xml](examples/produto-esperado/loja-basica/product.xml)       |

**Leitura em três etapas.** Cada etapa para no primeiro tipo de erro e reporta tudo o que encontrou:

1. XML bem-formado → erro com arquivo e linha.
2. Conformidade com o XSD → erro com arquivo e linha.
3. Invariantes do domínio (§4) → erro com arquivo e ID do elemento.

As etapas 1 e 2 são feitas juntas pelo `xmllint-wasm` no processo main (canal `validateXml`). A etapa 3 roda no renderer, depois que o codec converte o XML com `@xmldom/xmldom`; erros de sintaxe em expressões também informam a linha.

Um arquivo com erro não é aberto, e o app nunca tenta corrigir sozinho.

**Escrita determinística:** UTF-8 com declaração XML, recuo de 2 espaços, ordem de atributos igual à do schema, atributos opcionais omitidos quando têm o valor padrão (por exemplo, `configurable` só aparece quando é `false`) e expressões na forma canônica. Abrir e salvar sem alterações produz um arquivo idêntico byte a byte aos exemplos.

**Versão:** todo arquivo tem `schemaVersion="1"`. Um arquivo com versão desconhecida não é aberto.

## 6. Arquitetura

### 6.1 Camadas e pastas

```
src/
  shared/ipc.ts            contrato tipado da API exposta pelo preload
  main/                    processo main do Electron: janela, IPC, disco, shell, diálogos, validação XSD
  preload/                 contextBridge → window.mdd
  renderer/src/
    domain/                TypeScript puro. Não importa nada fora de domain/.
      shared/              Id, Result, erros de domínio
      expression/          AST, tokenizer, parser, printer canônico, avaliador, referências
      feature-model/       FeatureModel, Feature, Group, Attribute, Constraint, invariantes, operações
      formula/             semântica do modelo → Formula (§4.1)
      configuration/       Configuration, Resolution, estados
      assets/              Asset, AssetCatalog, inclusão
      generation/          GenerationPlan (§4.4 passo 1)
    application/           Importa só domain/.
      ports/               interfaces (§6.2)
      commands/            EditorCommand, CommandHistory, comandos concretos
      use-cases/           abrir/salvar projeto, resolver configuração, gerar produto…
    infrastructure/        Implementa os ports. Importa application/ e domain/.
      electron/            adapters sobre window.mdd
      xml/                 codecs por arquivo, escritor determinístico, leitura com @xmldom/xmldom
      solver/              LogicSolverConstraintSolver + logic-solver.d.ts
    ui/                    React. Importa application/ e domain/; infrastructure/ só em ui/app/.
      app/                 composition root: instancia adapters e injeta via Context
      stores/              Zustand: estado de tela que chama use cases
      screens/             start, editor, configurator, assets, generation
      diagram/             nós e arestas do React Flow, layout com elkjs
      components/ui/       componentes shadcn/ui
```

A pasta de telas se chama `screens/`, e não `features/`, para não colidir com o termo **Feature** do domínio. As regras de import acima são aplicadas por `eslint-plugin-boundaries`, e uma violação é **erro** de lint.

**Idioma:** identificadores de código em inglês; texto da interface e documentação em português. Mapeamento dos termos:

| Glossário            | Código               |
| -------------------- | -------------------- |
| Projeto              | `Project`            |
| Feature Model        | `FeatureModel`       |
| Grupo                | `Group`              |
| Restrição            | `Constraint`         |
| Expressão            | `Expression`         |
| Atributo             | `Attribute`          |
| Configuração         | `Configuration`      |
| Decisão manual       | `ManualDecision`     |
| Decisão propagada    | `PropagatedDecision` |
| Resolução            | `Resolution`         |
| Asset                | `Asset`              |
| Fragmento            | `fragment`           |
| Recurso              | `resource`           |
| Âncora               | `anchor`             |
| Condição de presença | `presenceCondition`  |
| Geração              | `Generation`         |
| Produto gerado       | `GeneratedProduct`   |
| Seção                | `Section`            |

### 6.2 Ports (em `application/ports`)

| Port                                                                          | Responsabilidade                                                                                                                                                                                                                                        | Adapter v1                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `ProjectStorage`                                                              | Ler, escrever, listar, conferir (`stat`), copiar, renomear e remover arquivos e pastas dentro do projeto; renomear e apagar pastas só dentro de `saida/`. A escrita recebe o hash esperado para detectar alteração externa (§8).                        | `ElectronProjectStorage`                                    |
| `FeatureModelRepository`, `AssetCatalogRepository`, `ConfigurationRepository` | Carregar e salvar cada tipo de arquivo, devolvendo erros de leitura estruturados (§5).                                                                                                                                                                  | `Xml*Repository` (codecs + `ProjectStorage`)                |
| `ConstraintSolver`                                                            | Carregar uma `Formula` e responder a satisfatibilidade sob uma suposição (um literal), devolvendo uma solução. Cada resolução carrega a fórmula num solver novo (ADR 0002).                                                                             | `LogicSolverConstraintSolver`                               |
| `ProductDeriver`                                                              | Receber um `GenerationPlan` e a hora da geração, conferir as fontes e devolver os arquivos do produto (textos e cópias), ou todos os problemas. A pasta temporária e a troca ficam com o caso de uso `WriteProductFolder`, igual para qualquer formato. | `XmlProductDeriver`                                         |
| `AssetOpener`                                                                 | Abrir um arquivo no programa padrão do sistema.                                                                                                                                                                                                         | `ElectronAssetOpener`                                       |
| `OutputFolderOpener`                                                          | Abrir uma pasta gerada (`saida/<nome>`) no gerenciador de arquivos.                                                                                                                                                                                     | `ElectronOutputFolderOpener`                                |
| `ProjectFolderPicker`                                                         | Escolher a pasta do projeto.                                                                                                                                                                                                                            | `ElectronProjectFolderPicker`                               |
| `ProjectFilePicker`                                                           | Escolher um arquivo dentro do projeto, num diálogo que começa na raiz. Devolve o caminho relativo e recusa um arquivo de fora.                                                                                                                          | `ElectronProjectFilePicker`                                 |
| `XmlSchemaValidator`                                                          | Etapas 1 e 2 da leitura (§5): XML bem-formado e conforme o XSD. Sem schema, só XML bem-formado (fragmentos da geração).                                                                                                                                 | `ElectronXmlSchemaValidator` (IPC → `xmllint-wasm` no main) |
| `Clock`                                                                       | Data e hora atuais (para `generatedAt`).                                                                                                                                                                                                                | `SystemClock`                                               |

### 6.3 Processo main e IPC

- `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true`.
- O preload expõe só `window.mdd`, tipado por `src/shared/ipc.ts`.
- O main mantém a **raiz do projeto aberto** e recusa qualquer operação de arquivo fora dela.
- Canais:
  - **Arquivos:** `readText`, `writeText` (com hash esperado; cria as pastas), `stat`, `list`, `copy` (cria as pastas), `remove` (com hash esperado), e `rename` e `removeDirectory`, só dentro de `saida/`
  - **XML:** `validateXml` (etapas 1 e 2 da leitura, §5; sem schema, só XML bem-formado)
  - **Diálogos:** `openProjectFolder`, `pickFileInProject`, `confirm`
  - **Shell:** `openPath` (`shell.openPath`, para arquivos do projeto e pastas dentro de `saida/`)
  - **Projetos recentes:** `listRecentProjects` e `reopenProject` (os 10 últimos, gravados em `userData`; só pastas da lista podem ser reabertas sem o diálogo)
  - **Janela:** `setUnsavedChanges` (o main pergunta antes de fechar a janela com alterações não salvas)

O solver roda no renderer, de forma síncrona. Se ficar lento em modelos grandes, ele passa para um Web Worker trocando só o adapter.

### 6.4 Estado da interface

As stores do Zustand guardam o estado de tela (projeto aberto, seleção, configuração aberta, resolução, marcadores de alterações não salvas) e chamam use cases e comandos. Nenhuma regra de domínio fica em componente ou store. As stores recebem as dependências da composition root, nunca instanciam adapters.

## 7. Interface

**Tela inicial:** novo projeto (nome e ID da raiz, depois uma pasta sem `model.xml`; cria o `model.xml` só com a raiz), abrir projeto e lista de recentes.

**Janela do projeto:**

- barra lateral com as abas **Modelo**, **Configurações** e **Assets**;
- área central com o diagrama;
- painel direito de propriedades;
- barra de status.

**Modelo (editor):**

- Diagrama com React Flow e layout elkjs de cima para baixo (ADR 0007). A notação é a clássica:
  - círculo cheio = obrigatória, círculo vazio = opcional;
  - arco vazio = alternative, arco cheio = or, rótulo `[n..m]` nos demais grupos.
- Subárvores recolhíveis, zoom e "ajustar à tela".
- Menu de contexto do nó: adicionar filho, adicionar irmão, criar grupo, mover para cima ou para baixo, recolher, excluir.
- Arrastar e soltar:
  - soltar sobre uma feature = virar o último filho dela;
  - soltar sobre um arco de grupo = virar membro do grupo;
  - alvo inválido = indicação visual e recusa.
- Painel de propriedades da feature: nome, ID (só leitura), descrição, variabilidade, atributos, assets ancorados. Painel do grupo: cardinalidade (alternative / or / personalizada).
- Painel de **restrições** (lista + editor):
  - o erro de sintaxe aparece com a posição enquanto se digita;
  - sugestão de IDs de features;
  - a restrição só é confirmada quando é válida.
- Atalhos:

  | Ação               | Atalho          |
  | ------------------ | --------------- |
  | Adicionar filho    | Tab             |
  | Adicionar irmão    | Enter           |
  | Renomear           | F2              |
  | Excluir            | Delete          |
  | Reordenar          | Alt+↑ / Alt+↓   |
  | Desfazer / refazer | Ctrl+Z / Ctrl+Y |
  | Salvar             | Ctrl+S          |

**Configurações:**

- A barra lateral é uma faixa estreita com as abas. Na aba Configurações, a lista fica à esquerda, o diagrama no centro e os valores dos atributos à direita.
- Lista com criar, renomear, duplicar e excluir (com confirmação); o nome do arquivo aparece enquanto se digita o nome. Como o resto do projeto, essas operações só chegam ao disco ao salvar: excluir apaga o arquivo, e renomear grava o arquivo novo e apaga o antigo.
- Abrir uma configuração mostra **o mesmo diagrama em modo configuração**, com a estrutura só para leitura. Estados dos nós:
  - selecionada manual (✓);
  - desselecionada manual (✕);
  - selecionada ou desselecionada **propagada** (com cadeado e dica "decidido pelo modelo");
  - indecisa.
- Um clique alterna entre indecisa → selecionada → desselecionada → indecisa. Nós propagados não respondem ao clique. Em conflito, ou com o modelo vazio, nada é propagado: os nós mostram só as decisões manuais e não respondem.
- Painel direito: valores dos atributos das features selecionadas, com validação por tipo. Campo vazio = sem valor (vale o `default`, se houver); um valor que não serve para o tipo é recusado com o motivo.
- Barra de status: válida / completa / incompleta (N indecisas, M atributos sem valor) / em conflito / modelo vazio, com "desatualizada" quando for o caso.
- Uma configuração desatualizada exibe faixas com:
  - as referências órfãs, com a ação "remover referências órfãs";
  - no caso de conflito, a lista de decisões manuais com a ação de remover cada uma;
  - os valores inválidos, com a ação de remover cada um.
- Desfazer, refazer e os atalhos de edição valem só na aba Modelo; no configurador, só Ctrl+S.
- Botão **Gerar produto**, ligado só quando a configuração está completa; desligado, a dica diz o que falta. Gera do que está na tela, com as alterações não salvas.
  - Se `saida/<nome>/` já existe, pergunta antes de substituir.
  - Os problemas aparecem num diálogo com todos os itens (arquivo, linha, asset e mensagem) e o aviso de que nada foi gravado.
  - O sucesso aparece numa faixa verde acima do diagrama, com a pasta, a hora, "Abrir pasta" (no gerenciador de arquivos) e ×. A faixa é da configuração gerada: some ao trocar de configuração e volta ao voltar para ela.

**Assets:**

- Na aba Assets, a lista fica no centro, agrupada por âncora na ordem do modelo, e as propriedades do asset selecionado ficam à direita.
- Cada linha mostra o tipo, o nome (ou o nome do arquivo), o caminho, a condição e o estado do arquivo (ok / ausente), com as ações abrir (desligada quando ausente), mover para cima ou para baixo dentro da âncora e desvincular (sem confirmação: tem desfazer, e o arquivo fica no disco).
- O painel edita nome, tipo, âncora e condição, e tem "Trocar arquivo…", que muda só o caminho. Trocar a âncora leva o asset para o fim da nova âncora.
- Para vincular, o arquivo é escolhido em um diálogo que começa na pasta do projeto. Um arquivo fora do projeto é recusado com a orientação de copiá-lo para dentro. Depois vem o diálogo com o tipo (sugerido pela extensão: `.xml` → fragmento, demais → recurso), o nome (opcional), o ID (sugerido pelo nome do arquivo e ajustável só ali) e a âncora.
- A condição usa o mesmo editor das restrições; vazio = sem condição. Uma expressão inválida não é gravada.
- O estado dos arquivos é conferido ao abrir o projeto, ao entrar na aba, quando a janela volta ao foco, depois de qualquer mudança nos assets (inclusive desfazer) e no botão "Atualizar".
- Todas as edições de assets são comandos do histórico: desfazer e refazer valem nas abas Modelo e Assets (também com o foco numa lista de opções). Tab, Enter, F2, Delete e Alt+↑/↓ valem só na aba Modelo.
- O painel da feature, na aba Modelo, lista os assets ancorados nela, com o estado de cada arquivo e o botão "Vincular arquivo…".

## 8. Comportamentos transversais

- **Salvar é manual** (Ctrl+S) e grava tudo o que tiver alteração (modelo, assets e configurações, inclusive apagando os arquivos das configurações excluídas ou renomeadas). Os arquivos só são apagados depois que todas as configurações foram gravadas; se alguma gravação falhar, a exclusão fica para o próximo salvar. Como no Windows `Loja.xml` e `loja.xml` são o mesmo arquivo, duas chaves de configuração que só diferem na caixa contam como a mesma. O título da janela mostra `•` quando há algo não salvo. Fechar a janela ou o projeto com alterações pendentes pede confirmação.
- **Alteração externa:** o app guarda o hash de cada arquivo ao ler. Ao salvar, se o arquivo no disco mudou (por exemplo, depois de um `git pull`), ele pergunta se deve **sobrescrever**, **recarregar** (descartando as alterações locais daquele arquivo) ou **cancelar**. Nunca sobrescreve em silêncio.
- **Erros** de leitura seguem §5. Erros de disco e de geração aparecem em diálogo com todos os itens.
- **Interface em português. Empacotamento para Windows** (electron-builder, instalador NSIS).

## 9. Roadmap e aceitação

A aceitação de cada fase é manual e usa `docs/examples/loja-online`.

| Fase                          | Entrega                                                                                                                                                                                                                        | Aceitação                                                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0. Fundação**               | electron-vite + React + TS, Tailwind + shadcn/ui, ESLint + boundaries + Prettier, estrutura de pastas, IPC seguro com a raiz do projeto, empacotamento Windows                                                                 | `npm run dev` abre a janela. Um import proibido (React dentro de `domain/`) gera erro de lint. `npm run build:win` gera o instalador.                                                                                                                  |
| **1. Domínio e persistência** | Domínio completo do modelo, das expressões, das configurações e dos assets. Codecs XML dos três arquivos. Leitura em três etapas. Abrir e salvar projeto. Visualização provisória em lista.                                    | Abrir o exemplo mostra a árvore. Salvar sem alterações gera arquivos idênticos byte a byte. Um ID duplicado, um ID com hífen ou `max="0"` geram erro com arquivo e linha.                                                                              |
| **2A. Edição do modelo**      | Operações de edição no domínio, comandos com desfazer/refazer, árvore em lista selecionável, painéis de propriedades e de restrições, diálogos de impacto, de grupo, de conflito e de fechar, atalhos, projeto novo e recentes | Recriar o modelo do exemplo do zero pela interface (escolhendo os IDs na criação) e salvar produz um arquivo igual ao exemplo. Excluir `pag_pix` mostra: 1 restrição removida, 2 assets desvinculados, 1 configuração afetada. Desfazer restaura tudo. |
| **2B. Diagrama**              | Diagrama com React Flow e layout automático no lugar da lista, menu de contexto, arrastar e soltar para mover, subárvores recolhíveis                                                                                          | A aceitação da 2A, feita pelo diagrama.                                                                                                                                                                                                                |
| **3. Configurador**           | Adapter do solver, resolução, modo configuração no diagrama, valores de atributos, lista de configurações, configuração desatualizada                                                                                          | `loja-basica` abre completa, com `mobile` selecionada por propagação e travada. Remover a decisão de `pag_pix` deixa `mobile` indecisa. Depois de excluir `pag_pix` no modelo e salvar, `loja-basica` abre como desatualizada, com a referência órfã.  |
| **4. Assets**                 | Aba de assets, vínculo com âncora e condição, estado do arquivo, abrir no programa padrão                                                                                                                                      | A aba mostra os 6 assets do exemplo. Renomear `boleto.xml` fora do app faz o asset aparecer como ausente.                                                                                                                                              |
| **5. Geração**                | Plano, verificação, `XmlProductDeriver`, pasta temporária e troca                                                                                                                                                              | Gerar `loja-basica` produz o equivalente a `produto-esperado/loja-basica/` (mais `docs/img/pix-fluxo.svg`). Com `pag_boleto` selecionado e `boleto.xml` ausente, a geração falha e não grava nada.                                                     |
| **Depois**                    | `ModelAnalyzer`, variabilidade anotativa, renderers por mídia, restrições com atributos, clones, import de FeatureIDE ou UVL, adapters DITA ou DocBook, undo no configurador, testes                                           | —                                                                                                                                                                                                                                                      |

## 10. Em aberto

- **Mídias prioritárias** para os renderers (fase "Depois"): a definir.
- **Vocabulário de documentação padrão** (DITA, DocBook ou nenhum): adiado de propósito (ADR 0006).
- **Tamanho alvo de modelo** para desempenho do solver: sem requisito; a referência informal é algumas centenas de features.
