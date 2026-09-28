# Fase 5 — Geração: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** gerar o produto de uma configuração completa. O configurador ganha o botão **Gerar produto**, que grava `saida/<chave>/product.xml`, com os fragmentos embutidos, e copia os recursos. Antes de gravar, confere todas as fontes; com qualquer problema, não grava nada.

**Arquitetura:**

- **Domínio** (puro): o avaliador de expressões, a inclusão de assets e o plano de geração (SPEC §4.4, passo 1).
- **Aplicação:** as portas `Clock`, `ProductDeriver` e `OutputFolderOpener`; `ProjectStorage` com `copy`, `rename` e `removeDirectory`; `XmlSchemaValidator` sem schema; o caso de uso `WriteProductFolder` (pasta temporária e troca, igual para qualquer formato) e o `GenerateProduct`, que junta tudo.
- **Infraestrutura:** o `XmlProductDeriver` (a verificação dos fragmentos e dos recursos e o `product.xml`), a extração da raiz dos fragmentos, o nó de texto cru no escritor de XML, o `SystemClock` e os adapters do Electron.
- **Processo main e IPC:** canais `copy`, `rename` e `removeDirectory`; renomear e apagar pastas só dentro de `saida/`; `openPath` abre pastas de `saida/`; `validateXml` sem schema.
- **Interface:** as ações de geração da store num arquivo próprio; o botão na barra da configuração; a faixa verde da última geração; os diálogos de substituir e de problemas.

**Stack:** a das fases anteriores. Sem dependências novas: o `@xmldom/xmldom` e o `xmllint-wasm` já estão no projeto.

**Spec:** [docs/superpowers/specs/2026-09-24-fase-5-geracao-design.md](../specs/2026-09-24-fase-5-geracao-design.md) (o desenho aprovado) e [docs/SPEC.md](../../SPEC.md): §3 (a pasta `saida/`), §4.3 (inclusão), §4.4 (geração), §6.2 e §6.3 (portas e canais), §7 (o botão "Gerar produto") e §9 (linha da Fase 5). Veja também os ADRs [0006](../../adr/0006-geracao-agnostica-de-vocabulario.md) e [0008](../../adr/0008-camadas-com-lint-sem-testes.md). O protótipo refinou alguns pontos do desenho; eles estão em "O que o protótipo respondeu", e a Tarefa 5 os leva para a spec do desenho e para a SPEC.

## Restrições globais

- **Sem testes automatizados** (ADR 0008).
  - Cada tarefa verifica com `npm run typecheck`, `npm run lint` e scripts descartáveis em `.checks/`.
  - `.checks/` fica fora do git, do ESLint e do Prettier.
  - Os scripts `.mts` rodam com `npx tsx --tsconfig tsconfig.web.json`, por causa do alias `@/`. Os `.mjs` rodam com `node`.
  - Os roteiros da interface usam `.checks/cdp.mjs` (plano da 2B, Tarefa 3, Passo 12), `.checks/quit.mjs` (plano da Fase 3, Tarefa 4, Passo 15), `.checks/main-process.mjs` e `.checks/run-ui.sh` (plano da Fase 4, Tarefa 4, Passos 1 e 2). Num clone novo, recrie-os a partir desses planos.
- **Camadas** (SPEC §6.1): `domain/` não importa nada de fora dele; `application/` só `domain/`; só `ui/app/` conhece `infrastructure/`. O lint barra violações.
- **Imports:** dentro de `domain/`, relativos; nas demais camadas, alias `@/`. A composition root importa `src/shared/ipc.ts` por caminho relativo.
- **Idioma:** identificadores em inglês; textos da interface, mensagens, comentários e documentação em português.
- **Regras do lint:**
  - toda função tem tipo de retorno explícito;
  - as regras de hooks do React 19 estão ligadas: nada de `setState` síncrono dentro de effect, nada de ler ref durante o render;
  - um arquivo `.tsx` só exporta componentes (`react-refresh/only-export-components`): funções, hooks e constantes compartilhadas vão para um `.ts` ao lado.
- **Classes do Tailwind** sempre escritas por inteiro no código (nada de `` `bg-${cor}` ``), senão o Tailwind não as gera.
- **O nome `saida`** só aparece em `OUTPUT_DIRECTORY` (`src/shared/ipc.ts`). O main o usa na proteção; a aplicação o recebe da composition root, porque não importa `shared/`.
- **O BOM no código** é escrito como `'\u{FEFF}'`. Não use a forma de quatro dígitos (barra invertida, `u`, `FEFF`): a ferramenta de escrita pode trocá-la por um BOM literal, que é invisível. Depois de criar `fragment-source.ts` e os roteiros, confira com `grep -c 'u{FEFF}'`.
- **Gerar não é uma edição:** não passa pelo histórico de desfazer e não mexe no "•" de não salvo.
- **Commits:** rode `npm run format` antes de cada commit. Os commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Shell:** todo comando roda na raiz do repositório com **Git Bash**, no branch `fase-5-geracao`.
- **Roteiros de interface abrem janelas na tela do usuário:** combine o momento com ele antes. Para fechar o app, use `.checks/quit.mjs`, nunca `taskkill /IM electron.exe`. O `generate-product-check.mts` também abre um PowerShell escondido por alguns segundos, para segurar um arquivo aberto.

## O que o protótipo respondeu

O código deste plano foi prototipado e verificado numa cópia descartável do repositório. Cada tarefa foi aplicada sozinha sobre o commit do desenho: o roteiro dela falhou antes e deu a saída deste plano depois, e o typecheck e o lint passaram.

**Os seis riscos do desenho:**

1. **`xmllint-wasm` sem schema.** A chamada é `validateXML({ xml, schema: [] })`, e o erro vem com a linha certa. Num arquivo com DOCTYPE de DTD externa (comum em DITA), o `xmllint` não carrega a DTD e aceita `&nbsp;` sem reclamar. Por isso as entidades são conferidas depois, pelo `@xmldom/xmldom`.
2. **Extração da raiz.**
   - O `xmldom` dá linha e coluna de todos os nós de fora da raiz. O fim da raiz é o começo do nó seguinte (espaço, comentário ou instrução), o que resolve um CDATA ou comentário com `</t>` dentro.
   - O `xmldom` converte as quebras de linha antes de ler, inclusive `\r` sozinho, e aí as posições não batem com o texto original. Com `normalizeLineEndings` devolvendo o texto como está, e a conta de linhas igual à dele (`\r\n`, `\r` e `\n`), a posição cai no lugar certo.
   - O `xmldom` recusa o BOM: ele sai antes.
   - Numa entidade, o `xmldom` aponta o começo do texto, que pode estar linhas acima. A linha certa é a da primeira ocorrência da entidade a partir dali.
   - O `xmllint` aceita um prefixo de namespace sem declaração: só registra um "namespace error" no `rawOutput`, sem invalidar. O `xmldom` recusa. Em compensação, o `xmldom` aceita erros de sintaxe que o `xmllint` pega (`&` solto, atributo sem aspas ou sem valor, `]]>` no texto, caractere de controle). Por isso a ordem é: `xmllint` primeiro, `xmldom` depois.
3. **`xmlns=""`.** O `product.xml` gerado passa no `product.xsd` (com o `xml.xsd` pré-carregado), e o `<topic>` embutido de um fragmento sem namespace continua sem namespace quando o produto é lido.
4. **Renomear pasta no Windows.** Com um arquivo da pasta aberto em outro processo, renomear falha com `EPERM`, mesmo que o arquivo tenha sido aberto com permissão de exclusão. Com a pasta como diretório atual de outro processo, falha com `EBUSY`. Um roteiro reproduz isso (um PowerShell segura o arquivo), e a checagem à mão da trava virou o caso 9 do `generate-product-check.mts`. A mensagem não traz o erro do sistema, que tem os caminhos absolutos inteiros.
5. **Proteção de `saida/`.** O `path.relative` do Windows ignora maiúsculas: `SAIDA/x` é aceito, porque é a mesma pasta. `saida/..loja` é um nome válido, e `../loja/saida/x` aponta para a mesma pasta. São recusados `saida`, `saida/.`, `Saida/..`, `saida/../model.xml`, `saida2/x`, `docs/saida/x` e caminhos absolutos.
6. **A comparação com o esperado.** Uma forma canônica ignora comentários, espaços entre elementos, a quantidade de espaços dentro dos textos, as declarações de namespace e o `generatedAt`, e compara os elementos pelo namespace de verdade. Para não esconder uma diferença no texto dos fragmentos, o roteiro confere à parte que cada fragmento aparece byte a byte no `product.xml`.

**Achados pelo caminho** (a Tarefa 5 leva para a spec do desenho e para a SPEC):

7. **Recursos do plano:** um asset por caminho, e não só o caminho, para o problema citar o asset. A função `firstPerPath` fica no catálogo de assets e serve ao plano e ao deriver.
8. **`GenerateProduct` não depende do `ProjectStorage` direto:** pergunta ao `WriteProductFolder` (`exists`), que sabe onde fica a pasta.
9. **Uma só `ResolveConfiguration`** na composition root, para a tela e para a geração: o resultado guardado serve às duas.
10. **A store devolve o resultado da geração** em vez de guardar o diálogo. O hook `useGenerateProduct` escolhe o diálogo pelo resultado e é usado pelo botão e pelo "Substituir". Os dois diálogos ficam num componente próprio, `GenerationDialogs`.
11. **`generating`** impede um segundo clique. Fechar ou recarregar o projeto no meio zera o estado da geração (`GENERATION_CLOSED` entra no `CLOSED`), e o resultado que chega depois é descartado, como nas ações de assets.
12. **A dica do botão desligado** fica num `span` em volta dele, porque um botão desligado não recebe os eventos do mouse.
13. **Mensagens:** "Arquivo ausente." para fragmento e recurso; a codificação aponta a linha 1; a entidade tem mensagem em português; os erros de sintaxe do `xmllint` ficam em inglês, como na leitura do projeto.
14. **Regressão:** o `ui-check.mjs` (2A), o `configurador-ui.mjs` (Fase 3), o `assets-ui.mjs` (Fase 4) e os roteiros de store das Fases 3 e 4 saíram iguais. O `diagrama-ui.mjs` (2B) não foi rodado: esta fase não mexe no diagrama nem na aba Modelo.

## Mapa de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `domain/expression/evaluator.ts` | `evaluateExpression` |
| `domain/assets/asset-inclusion.ts` | `isAssetIncluded` |
| `domain/assets/asset-catalog.ts` | `firstPerPath` |
| `domain/generation/generation-plan.ts` | `GenerationPlan` e `planGeneration` |
| `shared/ipc.ts`, `preload/index.ts` | `OUTPUT_DIRECTORY`; canais `copy`, `rename` e `removeDirectory`; `validateXml` sem schema |
| `main/project-root.ts` | `resolveInOutput` |
| `main/ipc/file-handlers.ts` | Os três canais; `openPath` com pastas de `saida/` |
| `main/ipc/xml-handlers.ts`, `main/xml/schema-validator.ts` | Validação sem schema |
| `application/ports/project-storage.ts`, `xml-schema-validator.ts` | As operações novas nas portas |
| `application/ports/clock.ts`, `product-deriver.ts`, `output-folder-opener.ts` | Portas novas |
| `application/use-cases/write-product-folder.ts` | Pasta temporária e troca |
| `application/use-cases/generate-product.ts` | Planejar, derivar, perguntar e gravar |
| `infrastructure/xml/xml-writer.ts` | Nó de texto cru |
| `infrastructure/xml/fragment-source.ts` | Codificação declarada e extração da raiz |
| `infrastructure/xml/xml-product-deriver.ts` | Verificação das fontes e `product.xml` |
| `infrastructure/system/system-clock.ts` | `SystemClock` |
| `infrastructure/electron/*` | As operações novas no `ElectronProjectStorage` e no `ElectronXmlSchemaValidator`; `ElectronOutputFolderOpener` |
| `ui/stores/generation-actions.ts`, `project-store.ts` | Ações de geração, montadas na store |
| `ui/screens/configurator/*` | Botão, faixa, diálogos, textos e o hook `useGenerateProduct` |
| `ui/screens/project/editor-dialog.ts`, `ProjectScreen.tsx` | Os dois diálogos novos |
| `ui/app/composition-root.ts` | Injeta os serviços novos |

(Os caminhos em `domain/`, `application/`, `infrastructure/` e `ui/` ficam em `src/renderer/src/`; os de `shared/`, `preload/` e `main/`, em `src/`.)

---

### Tarefa 1: Domínio — o plano de geração

**Arquivos:**

- Criar: `src/renderer/src/domain/expression/evaluator.ts`, `src/renderer/src/domain/assets/asset-inclusion.ts`, `src/renderer/src/domain/generation/generation-plan.ts`
- Modificar: `src/renderer/src/domain/assets/asset-catalog.ts`
- Verificação: `.checks/generation-plan-check.mts`

**Interfaces:**

- Consome: `Expression` (`domain/expression/ast.ts`); `Asset`, `AssetCatalog` (`domain/assets/asset-catalog.ts`); `storedValue(configuration, featureId, attributeId)` (`domain/configuration/attribute-values.ts`); `configurationStatus`, `isSelected`, `Resolution` (`domain/configuration/resolution.ts`); `childFeatures`, `featuresInPreOrder` (`domain/feature-model/traversal.ts`); `Result`, `ok`, `err` (`domain/shared/result.ts`); `ResolveConfiguration` e `LogicSolverConstraintSolver` (só no roteiro).
- Produz:
  - `evaluateExpression(expression: Expression, trueIds: ReadonlySet<string>): boolean` (`evaluator.ts`)
  - `isAssetIncluded(asset: Asset, selected: ReadonlySet<string>): boolean` (`asset-inclusion.ts`)
  - `firstPerPath(assets: readonly Asset[]): Asset[]` (`asset-catalog.ts`)
  - `PlannedAttribute` (`id`, `value`), `PlannedFeature` (`id`, `name`, `attributes`), `PlannedSection` (`featureId`, `fragments: readonly Asset[]`, `children`), `GenerationPlan` (`productName`, `modelName`, `features`, `root`, `resources: readonly Asset[]`) e `planGeneration(model, catalog, configuration, resolution): Result<GenerationPlan, string>` (`generation-plan.ts`)

- [ ] **Passo 1: Conferir o branch**

```bash
git switch fase-5-geracao
git log --oneline -3
```

Esperado: o branch tem o commit do desenho (`docs: desenho da Fase 5 (geração)`) e o deste plano.

- [ ] **Passo 2: Escrever o roteiro `.checks/generation-plan-check.mts`**

Confere o plano da `loja-basica` (features, atributos, seções e recursos), a condição do `doc_busca_app`, a recusa de uma configuração incompleta, o recurso repetido e o avaliador.

@@FILE .checks/generation-plan-check.mts@@

- [ ] **Passo 3: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generation-plan-check.mts
```

Esperado: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/domain' …`, porque os módulos novos ainda não existem.

- [ ] **Passo 4: Criar `src/renderer/src/domain/expression/evaluator.ts`**

@@FILE src/renderer/src/domain/expression/evaluator.ts@@

- [ ] **Passo 5: `src/renderer/src/domain/assets/asset-catalog.ts`**

@@EDITS src/renderer/src/domain/assets/asset-catalog.ts@@

- [ ] **Passo 6: Criar `src/renderer/src/domain/assets/asset-inclusion.ts`**

@@FILE src/renderer/src/domain/assets/asset-inclusion.ts@@

- [ ] **Passo 7: Criar `src/renderer/src/domain/generation/generation-plan.ts`**

@@FILE src/renderer/src/domain/generation/generation-plan.ts@@

- [ ] **Passo 8: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generation-plan-check.mts
```

Esperado, exatamente:

@@OUT generation-plan-check@@

As features, os atributos e as seções são os do `docs/examples/produto-esperado/loja-basica/product.xml`.

- [ ] **Passo 9: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 10: Commit**

```bash
npm run format
git add src/renderer/src/domain
git commit -m "feat(domain): plano de geração, avaliador de expressões e inclusão de assets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 2: Processo main, IPC e as portas de arquivo

**Arquivos:**

- Modificar: `src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/project-root.ts`, `src/main/ipc/file-handlers.ts`, `src/main/ipc/xml-handlers.ts`, `src/main/xml/schema-validator.ts`
- Modificar: `src/renderer/src/application/ports/project-storage.ts`, `src/renderer/src/application/ports/xml-schema-validator.ts`, `src/renderer/src/infrastructure/electron/electron-project-storage.ts`, `src/renderer/src/infrastructure/electron/electron-xml-schema-validator.ts`
- Verificação: `.checks/output-guard-check.mts`

**Interfaces:**

- Consome: `ProjectRoot` (`resolve`, `requireRoot`, `escapesRoot`); `withinProject`, `fail`, `ok` (`main/ipc/`); `validateXML` (`xmllint-wasm`).
- Produz:
  - `OUTPUT_DIRECTORY = 'saida'`; `IpcChannel.copy`, `IpcChannel.rename`, `IpcChannel.removeDirectory`; na `MddApi`, `copy(fromPath, toPath)`, `rename(fromPath, toPath)` e `removeDirectory(relativePath)`, todos `Promise<IpcResult<null>>`, e `validateXml(schema: XmlSchemaName | null, fileName, content)` (`shared/ipc.ts`)
  - `ProjectRoot.resolveInOutput(relativePath): string | null` (`main/project-root.ts`)
  - `ProjectStorage.copy(from, to)`, `rename(from, to)` e `removeDirectory(path)`, todos `Promise<Result<null, StorageError>>` (`application/ports/project-storage.ts`)
  - `XmlSchemaValidator.validate(schema: XmlSchema | null, fileName, content)` (`application/ports/xml-schema-validator.ts`)

- [ ] **Passo 1: Escrever o roteiro `.checks/output-guard-check.mts`**

@@FILE .checks/output-guard-check.mts@@

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/output-guard-check.mts
```

Esperado: `TypeError: root.resolveInOutput is not a function`.

- [ ] **Passo 3: `src/shared/ipc.ts`**

@@EDITS src/shared/ipc.ts@@

- [ ] **Passo 4: `src/preload/index.ts`**

@@EDITS src/preload/index.ts@@

- [ ] **Passo 5: `src/main/project-root.ts`**

@@EDITS src/main/project-root.ts@@

- [ ] **Passo 6: `src/main/ipc/file-handlers.ts`**

`rename` e `removeDirectory` só aceitam caminhos dentro de `saida/`. O `openPath` passa a abrir pastas, mas só as de `saida/`.

@@EDITS src/main/ipc/file-handlers.ts@@

- [ ] **Passo 7: Validação sem schema no main**

Em `src/main/xml/schema-validator.ts`:

@@EDITS src/main/xml/schema-validator.ts@@

Em `src/main/ipc/xml-handlers.ts`:

@@EDITS src/main/ipc/xml-handlers.ts@@

- [ ] **Passo 8: As portas**

Em `src/renderer/src/application/ports/project-storage.ts`:

@@EDITS src/renderer/src/application/ports/project-storage.ts@@

Em `src/renderer/src/application/ports/xml-schema-validator.ts`:

@@EDITS src/renderer/src/application/ports/xml-schema-validator.ts@@

- [ ] **Passo 9: Os adapters do Electron**

Em `src/renderer/src/infrastructure/electron/electron-project-storage.ts`:

@@EDITS src/renderer/src/infrastructure/electron/electron-project-storage.ts@@

Em `src/renderer/src/infrastructure/electron/electron-xml-schema-validator.ts`:

@@EDITS src/renderer/src/infrastructure/electron/electron-xml-schema-validator.ts@@

- [ ] **Passo 10: Rodar o roteiro**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/output-guard-check.mts
```

Esperado, exatamente:

@@OUT output-guard-check@@

- [ ] **Passo 11: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 12: Commit**

```bash
npm run format
git add src/shared src/preload src/main src/renderer/src/application/ports src/renderer/src/infrastructure/electron
git commit -m "feat(ipc): copiar, renomear e apagar pastas dentro de saida/, e XML bem-formado sem schema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 3: Derivação XML e escrita com troca

**Arquivos:**

- Criar: `src/renderer/src/application/ports/clock.ts`, `src/renderer/src/application/ports/product-deriver.ts`, `src/renderer/src/application/use-cases/write-product-folder.ts`, `src/renderer/src/application/use-cases/generate-product.ts`
- Criar: `src/renderer/src/infrastructure/xml/fragment-source.ts`, `src/renderer/src/infrastructure/xml/xml-product-deriver.ts`, `src/renderer/src/infrastructure/system/system-clock.ts`
- Modificar: `src/renderer/src/infrastructure/xml/xml-writer.ts`
- Verificação: `.checks/fragment-source-check.mts`, `.checks/generation-support.mts`, `.checks/generate-product-check.mts`

**Interfaces:**

- Consome: `planGeneration`, `GenerationPlan`, `PlannedSection`, `firstPerPath` (Tarefa 1); `ProjectStorage` com `copy`, `rename`, `removeDirectory` e `XmlSchemaValidator` sem schema (Tarefa 2); `FileProblem`, `fileError` (`application/file-problem.ts`); `DecodeProblem` (`infrastructure/xml/xml-reader.ts`); `element`, `textElement`, `writeXmlDocument` (`infrastructure/xml/xml-writer.ts`); `ProjectRoot` do main (só no roteiro, para imitar os limites do main).
- Produz:
  - `Clock` (`now(): Date`) (`ports/clock.ts`)
  - `ProductFile` (`{ kind: 'text'; path; content }` ou `{ kind: 'copy'; path }`) e `ProductDeriver.derive(plan, generatedAt): Promise<Result<readonly ProductFile[], FileProblem[]>>` (`ports/product-deriver.ts`)
  - `WriteProductResult` e `WriteProductFolder(storage, outputDirectory)`, com `folderOf(key): string`, `exists(key): Promise<boolean>` e `write(key, files): Promise<WriteProductResult>` (`use-cases/write-product-folder.ts`)
  - `GenerateProductResult` (`generated` com `folder` e `generatedAt`; `problems`; `needs-confirmation` com `folder`; `write-failed` com `problems` e `previousAt?`), `GenerateOptions` (`replace`), `GenerateProductDependencies` (`resolveConfiguration`, `deriver`, `writer`, `clock`) e `GenerateProduct.execute(project, key, options?)` (`use-cases/generate-product.ts`)
  - `XmlRaw`, `XmlNode` e `rawXml(raw)`; os filhos de `element` passam a ser `XmlNode` (`xml-writer.ts`)
  - `declaredEncoding(content): string | undefined` e `extractFragmentRoot(content): Result<string, DecodeProblem[]>` (`fragment-source.ts`)
  - `XmlProductDeriver(storage, validator)` e `SystemClock`

- [ ] **Passo 1: Escrever o roteiro `.checks/fragment-source-check.mts`**

@@FILE .checks/fragment-source-check.mts@@

- [ ] **Passo 2: Escrever `.checks/generation-support.mts`**

O apoio dos roteiros da geração: um `ProjectStorage` sobre o disco com os limites do processo main (usa o próprio `ProjectRoot`), o `xmllint` como no main, a leitura do exemplo, a forma canônica para comparar com o esperado e um PowerShell que segura um arquivo aberto.

@@FILE .checks/generation-support.mts@@

- [ ] **Passo 3: Escrever o roteiro `.checks/generate-product-check.mts`**

Dez casos sobre cópias do exemplo em `.checks/geracao/`, inclusive a troca que falha (com um armazenamento que falha de propósito) e a trava do Windows (caso 9).

@@FILE .checks/generate-product-check.mts@@

Confira o BOM escrito como escape nos dois roteiros:

```bash
grep -c 'u{FEFF}' .checks/fragment-source-check.mts .checks/generate-product-check.mts
```

Esperado: `3` e `1`.

- [ ] **Passo 4: Rodar e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-source-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
```

Esperado: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/infrastructure' …` no primeiro e `… '@/application' …` no segundo.

- [ ] **Passo 5: As portas `Clock` e `ProductDeriver`**

Crie `src/renderer/src/application/ports/clock.ts`:

@@FILE src/renderer/src/application/ports/clock.ts@@

Crie `src/renderer/src/application/ports/product-deriver.ts`:

@@FILE src/renderer/src/application/ports/product-deriver.ts@@

- [ ] **Passo 6: O nó de texto cru em `src/renderer/src/infrastructure/xml/xml-writer.ts`**

@@EDITS src/renderer/src/infrastructure/xml/xml-writer.ts@@

- [ ] **Passo 7: Criar `src/renderer/src/infrastructure/xml/fragment-source.ts`**

@@FILE src/renderer/src/infrastructure/xml/fragment-source.ts@@

Confira o BOM escrito como escape:

```bash
grep -c 'u{FEFF}' src/renderer/src/infrastructure/xml/fragment-source.ts
```

Esperado: `1`.

- [ ] **Passo 8: Criar `src/renderer/src/infrastructure/xml/xml-product-deriver.ts`**

@@FILE src/renderer/src/infrastructure/xml/xml-product-deriver.ts@@

- [ ] **Passo 9: Criar `src/renderer/src/application/use-cases/write-product-folder.ts`**

@@FILE src/renderer/src/application/use-cases/write-product-folder.ts@@

- [ ] **Passo 10: Criar `src/renderer/src/application/use-cases/generate-product.ts`**

@@FILE src/renderer/src/application/use-cases/generate-product.ts@@

- [ ] **Passo 11: Criar `src/renderer/src/infrastructure/system/system-clock.ts`**

@@FILE src/renderer/src/infrastructure/system/system-clock.ts@@

- [ ] **Passo 12: Rodar a extração**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/fragment-source-check.mts
```

Esperado, exatamente:

@@OUT fragment-source-check@@

- [ ] **Passo 13: Rodar a geração**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
```

Esperado, exatamente:

@@OUT generate-product-check@@

O que o roteiro mostra, em resumo:

- o `loja-basica` gerado é equivalente ao esperado, passa no `product.xsd`, tem os fragmentos intactos e o `.svg` idêntico;
- gerar de novo pede confirmação sem mexer na pasta; substituir limpa as sobras `.tmp` e `.old` e o que foi posto à mão;
- com `pag_boleto` e sem `boleto.xml`, o problema aparece, e nem a pasta `saida/` é criada;
- quatro problemas diferentes aparecem de uma vez, na ordem do plano, cada um com o arquivo, a linha e o asset;
- o fragmento sem namespace ganha `xmlns=""` e mantém os espaços e as quebras de linha dele;
- quando a troca falha, a pasta anterior volta; quando a volta também falha, a mensagem diz onde ela ficou;
- com um arquivo da pasta aberto em outro programa, a pasta anterior fica intacta.

- [ ] **Passo 14: Checagens**

```bash
npm run typecheck
npm run lint
```

Esperado: sem erros.

- [ ] **Passo 15: Commit**

```bash
npm run format
git add src/renderer/src/application src/renderer/src/infrastructure
git commit -m "feat(generation): derivação XML do produto e escrita com pasta temporária e troca

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 4: O botão, a faixa e os diálogos

**Arquivos:**

- Criar: `src/renderer/src/application/ports/output-folder-opener.ts`, `src/renderer/src/infrastructure/electron/electron-output-folder-opener.ts`, `src/renderer/src/ui/stores/generation-actions.ts`
- Criar: `src/renderer/src/ui/screens/configurator/use-generate-product.ts`, `src/renderer/src/ui/screens/configurator/GenerationBanner.tsx`, `src/renderer/src/ui/screens/configurator/GenerationDialogs.tsx`
- Modificar: `src/renderer/src/ui/stores/project-store.ts`, `src/renderer/src/ui/screens/project/editor-dialog.ts`, `src/renderer/src/ui/screens/configurator/configuration-texts.ts`, `src/renderer/src/ui/screens/configurator/ConfiguratorWorkspace.tsx`, `src/renderer/src/ui/screens/project/ProjectScreen.tsx`, `src/renderer/src/ui/app/composition-root.ts`
- Verificação: `.checks/generation-store-check.mts`, `.checks/geracao-ui.mjs`; regressão com `.checks/ui-check.mjs`, `.checks/configurador-ui.mjs`, `.checks/assets-ui.mjs`, `.checks/configurator-store-check.mts` e `.checks/assets-store-check.mts`

**Interfaces:**

- Consome: `GenerateProduct`, `GenerateProductResult`, `GenerateOptions`, `WriteProductFolder`, `XmlProductDeriver`, `SystemClock` (Tarefa 3); `OUTPUT_DIRECTORY` e `window.mdd.openPath` (Tarefa 2); `configurationStatus`, `ConfigurationStatus` (`domain/configuration/resolution.ts`); `ProblemList`; `Dialog*` e `Button` (shadcn); `EditorDialog`; `openConfigurationEntry`, `ProjectState` e `createProjectStore` (`ui/stores/project-store.ts`).
- Produz:
  - `OutputFolderOpener.open(folder): Promise<Result<null, StorageError>>` e `ElectronOutputFolderOpener`
  - `GenerationServices` (`generateProduct`, `outputFolderOpener`), `LastGeneration` (`key`, `folder`, `generatedAt`), `GenerationState` (`generating`, `lastGeneration`, `generateProduct(options?)`, `openGeneratedFolder()`, `dismissLastGeneration()`), `GENERATION_CLOSED` e `createGenerationActions(set, get, services)` (`generation-actions.ts`)
  - `EditorDialog` com `{ kind: 'replace-output'; folder }` e `{ kind: 'generation-problems'; problems; note }`
  - `generationBlockedReason(resolution): string | null` (`configuration-texts.ts`)
  - `useGenerateProduct(onOpenDialog)`, `GenerationBanner({ configurationKey })` e `GenerationDialogs({ dialog, onOpenDialog, onClose })`

- [ ] **Passo 1: Escrever o roteiro `.checks/generation-store-check.mts`**

A store com a geração e o abridor de pasta falsos.

@@FILE .checks/generation-store-check.mts@@

- [ ] **Passo 2: Escrever o roteiro `.checks/geracao-ui.mjs`**

@@FILE .checks/geracao-ui.mjs@@

- [ ] **Passo 3: Rodar a store e ver falhar**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
```

Esperado: `TypeError: state(...).generateProduct is not a function`.

- [ ] **Passo 4: A porta `OutputFolderOpener` e o adapter**

Crie `src/renderer/src/application/ports/output-folder-opener.ts`:

@@FILE src/renderer/src/application/ports/output-folder-opener.ts@@

Crie `src/renderer/src/infrastructure/electron/electron-output-folder-opener.ts`:

@@FILE src/renderer/src/infrastructure/electron/electron-output-folder-opener.ts@@

- [ ] **Passo 5: Criar `src/renderer/src/ui/stores/generation-actions.ts`**

@@FILE src/renderer/src/ui/stores/generation-actions.ts@@

- [ ] **Passo 6: Montar as ações em `src/renderer/src/ui/stores/project-store.ts`**

@@EDITS src/renderer/src/ui/stores/project-store.ts@@

- [ ] **Passo 7: Os diálogos novos em `src/renderer/src/ui/screens/project/editor-dialog.ts`**

@@EDITS src/renderer/src/ui/screens/project/editor-dialog.ts@@

- [ ] **Passo 8: O motivo do botão desligado em `src/renderer/src/ui/screens/configurator/configuration-texts.ts`**

A parte "2 indecisas, 1 atributo sem valor" passa a ser compartilhada com a barra de status.

@@EDITS src/renderer/src/ui/screens/configurator/configuration-texts.ts@@

- [ ] **Passo 9: Criar `src/renderer/src/ui/screens/configurator/use-generate-product.ts`**

@@FILE src/renderer/src/ui/screens/configurator/use-generate-product.ts@@

- [ ] **Passo 10: A faixa e os diálogos**

Crie `src/renderer/src/ui/screens/configurator/GenerationBanner.tsx`:

@@FILE src/renderer/src/ui/screens/configurator/GenerationBanner.tsx@@

Crie `src/renderer/src/ui/screens/configurator/GenerationDialogs.tsx`:

@@FILE src/renderer/src/ui/screens/configurator/GenerationDialogs.tsx@@

- [ ] **Passo 11: O botão e a faixa em `src/renderer/src/ui/screens/configurator/ConfiguratorWorkspace.tsx`**

@@EDITS src/renderer/src/ui/screens/configurator/ConfiguratorWorkspace.tsx@@

- [ ] **Passo 12: Os diálogos em `src/renderer/src/ui/screens/project/ProjectScreen.tsx`**

@@EDITS src/renderer/src/ui/screens/project/ProjectScreen.tsx@@

- [ ] **Passo 13: Injetar os serviços em `src/renderer/src/ui/app/composition-root.ts`**

@@EDITS src/renderer/src/ui/app/composition-root.ts@@

- [ ] **Passo 14: Rodar a store**

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
```

Esperado, exatamente:

@@OUT generation-store-check@@

- [ ] **Passo 15: Checagens e build**

```bash
npm run typecheck
npm run lint
npm run build
```

Esperado: sem erros. O build avisa três vezes "Use of eval … is strongly discouraged" (`logic-solver`, esperado desde a Fase 3).

- [ ] **Passo 16: Rodar o roteiro da geração**

Combine o momento com o usuário: o app abre e fecha na tela dele.

```bash
bash .checks/run-ui.sh dev .checks/geracao-ui.mjs 9229
```

Esperado, exatamente:

@@OUT geracao-ui@@

A hora da faixa aparece como `HH:MM`. O "Fechar" repetido nos diálogos é o × do próprio diálogo, com o rótulo para leitor de tela.

- [ ] **Passo 17: Regressão das Fases 2A, 3 e 4**

```bash
bash .checks/run-ui.sh dev .checks/ui-check.mjs
bash .checks/run-ui.sh dev .checks/configurador-ui.mjs
bash .checks/run-ui.sh dev .checks/assets-ui.mjs 9229
npx tsx --tsconfig tsconfig.web.json .checks/configurator-store-check.mts
npx tsx --tsconfig tsconfig.web.json .checks/assets-store-check.mts
```

Esperado do `ui-check.mjs`, exatamente (a saída do plano da 2B, Tarefa 4, Passo 6, mais `app fechado`):

@@OUT ui-check@@

Do `configurador-ui.mjs`, exatamente (a saída do plano da Fase 3, Tarefa 4, Passo 15, com a dica do desfazer da Fase 4):

@@OUT configurador-ui@@

Do `assets-ui.mjs`, exatamente a saída do plano da Fase 4 (Tarefa 4, Passo 22):

@@OUT assets-ui@@

O `configurator-store-check.mts` e o `assets-store-check.mts` dão as mesmas saídas dos planos das Fases 3 e 4. O `diagrama-ui.mjs` (2B) não precisa rodar: esta fase não mexe no diagrama nem na aba Modelo.

- [ ] **Passo 18: Commit**

```bash
npm run format
git add src/renderer/src
git commit -m "feat(ui): botão Gerar produto, faixa da última geração e diálogos de substituir e de problemas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tarefa 5: Aceitação no app empacotado e documentação

**Arquivos:**

- Modificar: `docs/SPEC.md`, `docs/adr/0006-geracao-agnostica-de-vocabulario.md`, `docs/superpowers/specs/2026-09-24-fase-5-geracao-design.md`, `docs/HANDOFF.md`
- Verificação: `.checks/aceitacao-5.mjs`

**Interfaces:**

- Consome: tudo das Tarefas 1–4.
- Produz: o instalador, o registro da aceitação e a SPEC atualizada com as decisões da fase.

- [ ] **Passo 1: Gerar o instalador**

```bash
npm run build:win
```

Esperado: `building target=nsis file=dist\mdd-0.1.0-setup.exe` sem erro.

- [ ] **Passo 2: Escrever `.checks/aceitacao-5.mjs`**

Os dois critérios da SPEC §9, pela interface.

@@FILE .checks/aceitacao-5.mjs@@

- [ ] **Passo 3: Rodar a aceitação e o roteiro da geração no `mdd.exe`**

Combine o momento com o usuário.

```bash
bash .checks/run-ui.sh ./dist/win-unpacked/mdd.exe .checks/aceitacao-5.mjs
bash .checks/run-ui.sh ./dist/win-unpacked/mdd.exe .checks/geracao-ui.mjs 9229
```

Esperado da aceitação, exatamente:

@@OUT aceitacao-5@@

Do `geracao-ui.mjs`: a mesma saída da Tarefa 4, Passo 16. Os dois confirmam que a geração funciona dentro do `app.asar`, com o `xmllint` no main e a CSP no renderer.

- [ ] **Passo 4: A checagem à mão, com o usuário**

O roteiro troca o `shell.openPath` por um registrador. Falta a abertura de verdade. Peça ao usuário, com o `mdd.exe` aberto numa cópia do exemplo (por exemplo, `.checks/aceitacao-manual/`, para não mexer no `docs/examples`):

1. na aba Configurações, abrir `loja-basica` e clicar em **Gerar produto**: a faixa verde aparece com a pasta e a hora;
2. clicar em **Abrir pasta**: o Explorer abre `saida\loja-basica`, com o `product.xml` e a pasta `docs\img` com o `pix-fluxo.svg`.

Registre no handoff o que ele viu.

- [ ] **Passo 5: A SPEC (`docs/SPEC.md`)**

1. Em §4.4, troque os passos 2, 3 e 4 por:

```markdown
2. **Verificação.** Todos os arquivos do plano existem, e todos os fragmentos são XML bem-formado em UTF-8, sem prefixos de namespace sem declaração e sem entidades além das cinco do XML e das referências numéricas (`&nbsp;`, por exemplo, deixaria de existir fora do arquivo original, porque o DOCTYPE fica de fora). Se houver qualquer problema, **nada é gravado** e todos os problemas são listados de uma vez, com o arquivo, a linha e o asset.
3. **Escrita.** Grava numa pasta temporária `saida/.<nome>.tmp/`:
   - `product.xml` conforme `product.xsd`. Cada fragmento vira `<fragment asset="…" xml:base="<pasta do fragmento>/">` contendo o elemento raiz do arquivo com o texto exatamente como está (sem BOM, declaração XML, DOCTYPE nem os comentários de fora da raiz). Se a raiz não declara um namespace padrão, ela recebe `xmlns=""`, para os elementos sem prefixo não herdarem o `urn:mdd:product`. Um fragmento na raiz do projeto recebe `xml:base="./"`.
   - Cada recurso incluído é copiado byte a byte para `<saída>/<path>`, mantendo a estrutura de pastas.
4. **Troca.** Se `saida/<nome>/` já existir, pede confirmação para substituir. Depois renomeia a pasta antiga para `saida/.<nome>.old/`, renomeia a temporária para o lugar dela e apaga a `.old`. Se algo falhar, a temporária é apagada e a pasta antiga fica, ou volta, no lugar; no Windows, um arquivo da pasta aberto em outro programa impede a troca. As sobras de uma geração interrompida são apagadas na seguinte.

A geração usa o projeto como está na tela, com as alterações não salvas; os fragmentos e os recursos vêm do disco. Gerar não entra no histórico de desfazer.
```

2. Em §6.2:
   - na linha do `ProjectStorage`, troque a responsabilidade por "Ler, escrever, listar, conferir (`stat`), copiar, renomear e remover arquivos e pastas dentro do projeto; renomear e apagar pastas só dentro de `saida/`. A escrita recebe o hash esperado para detectar alteração externa (§8).";
   - na linha do `ProductDeriver`, troque a responsabilidade por "Receber um `GenerationPlan` e a hora da geração, conferir as fontes e devolver os arquivos do produto (textos e cópias), ou todos os problemas. A pasta temporária e a troca ficam com o caso de uso `WriteProductFolder`, igual para qualquer formato.";
   - na linha do `XmlSchemaValidator`, troque a responsabilidade por "Etapas 1 e 2 da leitura (§5): XML bem-formado e conforme o XSD. Sem schema, só XML bem-formado (fragmentos da geração).";
   - acrescente, depois da linha do `AssetOpener`:

```markdown
| `OutputFolderOpener` | Abrir uma pasta gerada (`saida/<nome>`) no gerenciador de arquivos. | `ElectronOutputFolderOpener` |
```

3. Em §6.3, troque os itens **Arquivos**, **XML** e **Shell** da lista de canais por:

```markdown
  - **Arquivos:** `readText`, `writeText` (com hash esperado; cria as pastas), `stat`, `list`, `copy` (cria as pastas), `remove` (com hash esperado), e `rename` e `removeDirectory`, só dentro de `saida/`
  - **XML:** `validateXml` (etapas 1 e 2 da leitura, §5; sem schema, só XML bem-formado)
  - **Shell:** `openPath` (`shell.openPath`, para arquivos do projeto e pastas dentro de `saida/`)
```

4. Em §7, troque a linha "Botão **Gerar produto** (Fase 5), habilitado só quando a configuração está completa." por:

```markdown
- Botão **Gerar produto**, ligado só quando a configuração está completa; desligado, a dica diz o que falta. Gera do que está na tela, com as alterações não salvas.
  - Se `saida/<nome>/` já existe, pergunta antes de substituir.
  - Os problemas aparecem num diálogo com todos os itens (arquivo, linha, asset e mensagem) e o aviso de que nada foi gravado.
  - O sucesso aparece numa faixa verde acima do diagrama, com a pasta, a hora, "Abrir pasta" (no gerenciador de arquivos) e ×. A faixa é da configuração gerada: some ao trocar de configuração e volta ao voltar para ela.
```

- [ ] **Passo 6: O ADR 0006**

Em `docs/adr/0006-geracao-agnostica-de-vocabulario.md`, no fim de "Consequences", acrescente:

```markdown
- O DOCTYPE dos fragmentos fica de fora do produto, então só valem as cinco entidades do XML e as referências numéricas; `&nbsp;` e afins são recusados na verificação (Fase 5).
- Um fragmento cuja raiz não declara um namespace padrão recebe `xmlns=""` ao ser embutido, para os seus elementos sem prefixo não caírem no namespace do `product.xml`.
```

- [ ] **Passo 7: A spec do desenho**

Em `docs/superpowers/specs/2026-09-24-fase-5-geracao-design.md`, logo abaixo da linha "Aprovado em 24/09/2026. …", acrescente:

```markdown
> O protótipo refinou alguns pontos deste desenho: a ordem das conferências dos fragmentos (`xmllint` e depois `@xmldom/xmldom`), os recursos do plano como assets, o `GenerateProduct` sem o `ProjectStorage` direto e os diálogos num componente próprio. Veja "O que o protótipo respondeu" no [plano](../plans/2026-09-24-fase-5-geracao.md); a SPEC já reflete esses pontos.
```

- [ ] **Passo 8: O handoff (`docs/HANDOFF.md`)**

- Na tabela "Estado atual", troque a linha da Fase 5 por:

```markdown
| 5. Geração | Concluída | `main`. Plano em [docs/superpowers/plans/2026-09-24-fase-5-geracao.md](superpowers/plans/2026-09-24-fase-5-geracao.md) |
```

- Na lista do que o app faz, acrescente: "gera o produto de uma configuração completa em `saida/<nome>/`, com o `product.xml` e os recursos copiados, conferindo todas as fontes antes e sem gravar nada quando há problema".
- Depois de "Aceitação da Fase 4", acrescente a seção "Aceitação da Fase 5 (feita em <data>)". Ela registra o que os Passos 3 e 4 desta tarefa mostraram, os roteiros das Tarefas 1 a 4 e a regressão da Tarefa 4, Passo 17. Escreva o que de fato aconteceu; se algo divergir do esperado, registre a divergência.
- Troque a seção "Próximo passo: Fase 5 (geração)" por "Próximo passo". Com a Fase 5, as fases 0 a 5 da primeira versão estão concluídas. A seção lista o que resta, para o usuário escolher: as checagens manuais ainda não confirmadas das Fases 0 e 1 (a seção que já existe) e os itens da fase "Depois" da SPEC §9.
- Em "Como trabalhamos", acrescente aos roteiros da lista: "Os da Fase 5 (`generation-plan-check.mts`, `output-guard-check.mts`, `fragment-source-check.mts`, `generation-support.mts`, `generate-product-check.mts`, `generation-store-check.mts`, `geracao-ui.mjs` e `aceitacao-5.mjs`) estão no plano da Fase 5."
- Em "Armadilhas já encontradas", acrescente:

```markdown
- **`xmllint` e `@xmldom/xmldom` se completam:** o `xmllint` é rigoroso com a sintaxe, mas aceita prefixo de namespace sem declaração e, com DOCTYPE de DTD externa, entidades como `&nbsp;`; o `xmldom` pega esses dois casos, mas aceita `&` solto e atributo sem aspas. Para conferir um fragmento, rode os dois, nessa ordem.
- **Posições do `@xmldom/xmldom`:** ele converte as quebras de linha antes de ler, e as posições deixam de bater com o texto original. Passe `normalizeLineEndings: (source) => source` e conte as linhas como ele (`\r\n`, `\r` e `\n`). Ele também recusa o BOM: tire-o antes.
- **Renomear pasta no Windows:** falha com `EPERM` se um arquivo dela estiver aberto em outro processo (mesmo com permissão de exclusão) e com `EBUSY` se ela for o diretório atual de outro processo. Para reproduzir num roteiro, um PowerShell segura o arquivo (`generation-support.mts`).
- **BOM no código:** escreva `'\u{FEFF}'`. A forma de quatro dígitos pode virar um BOM literal, invisível, ao passar pela ferramenta de escrita.
```

- [ ] **Passo 9: Commit**

```bash
npm run format
git add docs/SPEC.md docs/adr/0006-geracao-agnostica-de-vocabulario.md docs/superpowers/specs/2026-09-24-fase-5-geracao-design.md docs/HANDOFF.md
git commit -m "docs: spec, ADR 0006 e handoff registram a Fase 5

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Depois das checagens, o branch volta para a `main` com merge local, como nas fases anteriores.

---

## Aceitação da Fase 5 (SPEC §9)

- [ ] Gerar `loja-basica` produz o equivalente a `produto-esperado/loja-basica/`, mais o `docs/img/pix-fluxo.svg` idêntico (Tarefa 3, Passo 13; Tarefa 5, Passo 3).
- [ ] Com `pag_boleto` selecionado e `boleto.xml` ausente, a geração falha, lista o problema e não grava nada (Tarefa 3, Passo 13; Tarefa 5, Passo 3).
- [ ] Todos os problemas aparecem de uma vez, com arquivo, linha e asset (Tarefa 3, Passo 13; Tarefa 4, Passo 16).
- [ ] Gerar de novo pergunta antes de substituir; a troca nunca deixa o usuário sem nenhuma das versões (Tarefa 3, Passo 13; Tarefa 4, Passo 16).
- [ ] O botão só liga com a configuração completa, e a dica diz o que falta (Tarefa 4, Passo 16).
- [ ] A faixa verde mostra a pasta e a hora, e "Abrir pasta" abre o Explorer (Tarefa 4, Passo 16, registrado; Tarefa 5, Passo 4, de verdade).
- [ ] O main só renomeia e apaga pastas dentro de `saida/` (Tarefa 2, Passo 10).
- [ ] As fases anteriores continuam iguais (Tarefa 4, Passo 17).
