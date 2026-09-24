# Fase 5 — Correções da revisão final

Registro das correções feitas depois da revisão final do branch da Fase 5 (`git diff 7de6ede..92a5e4a`), no próprio branch `fase-5-geracao`, antes do merge na `main`. O código está no commit `fix(generation): recuperar a versão anterior, gerar a chave do diálogo e recusar fragmento fora do UTF-8`. Este documento guarda o porquê e as versões novas dos roteiros que reproduzem os problemas, já que `.checks/` não vai para o git.

## Os problemas

1. **I1, a geração seguinte apagava, sem perguntar, a única versão anterior.** Quando a troca falha e a volta também falha, a mensagem diz "A versão anterior ficou em `saida/.<chave>.old/`". Um app que cai entre as duas trocas deixa o mesmo estado: a `.old` existe, e `saida/<chave>/` não. Na geração seguinte, `exists(key)` dava falso (a pasta do produto não existe), não havia pergunta, e o `write()` apagava a `.old` como sobra, com o que o usuário tivesse posto nela à mão.
2. **I2, "Substituir" podia substituir a pasta de outra configuração sem perguntar.** O diálogo `replace-output` guardava só a pasta, e "Substituir" chamava a geração com `replace: true` para a configuração **aberta no momento**. Se o usuário gerava A, clicava em B na lista enquanto a geração rodava e confirmava "Substituir `saida/A/`?", a store gerava B com `replace: true`, e `saida/B/` era substituída sem pergunta.
3. **I3, um fragmento fora do UTF-8, sem declaração de codificação, passava com os acentos trocados.** O `readText` decodifica como UTF-8 e troca os bytes inválidos por U+FFFD: `<t>Visão</t>` salvo em Latin-1 chegava com um U+FFFD no lugar do `ã`, passava no `xmllint` e entrava assim no produto. A SPEC §4.4 promete fragmentos em UTF-8.

## A correção

- **I1** (`write-product-folder.ts`, `generate-product.ts`): `WriteProductFolder.recover(key)` põe de volta a versão anterior. Se `saida/<chave>/` não existe e `saida/.<chave>.old/` existe, a `.old` volta a ser `saida/<chave>/`. O `GenerateProduct.execute` o chama depois da derivação e antes do `exists`, com ou sem `replace`: a pasta passa a existir, e a tela pergunta antes de substituir. Se a volta falhar, a geração para sem apagar nada e devolve `write-failed`, com o problema em `saida/.<chave>.old/` ("Não foi possível pôr a versão anterior de volta em `saida/<chave>/`: …") e o `previousAt`; o diálogo diz "A versão anterior ficou em `saida/.<chave>.old/`." Uma `.old` junto da pasta do produto continua sendo sobra de uma troca que deu certo, e o `write()` a apaga.
- **I2** (`generation-actions.ts`, `use-generate-product.ts`, `editor-dialog.ts`, `GenerationDialogs.tsx`, `ConfiguratorWorkspace.tsx`): a geração leva a chave explicitamente, `generateProduct(key, options)`. O diálogo `replace-output` guarda `key` e `folder`, e "Substituir" gera essa chave; o botão gera a chave da configuração aberta. A store usa a chave recebida e continua recusando sem projeto aberto ou com outra geração em andamento. A faixa verde continua sendo da chave gerada.
- **I3** (`fragment-source.ts`, `xml-product-deriver.ts`): `firstUndecodedLine(content)` dá a linha do primeiro U+FFFD (escrito `'\u{FFFD}'` no código), contando as quebras de linha como o resto do arquivo (`\r\n`, `\r` e `\n`). O deriver a confere logo depois da codificação declarada e antes do `xmllint`: "O arquivo não está em UTF-8: salve-o em UTF-8."

## Os itens menores corrigidos

- **M1, a conferência dos fragmentos toda de uma vez** (`xml-product-deriver.ts`). O `xmllint-wasm` abre um worker por chamada, com 16 MB de memória inicial: o revisor mediu 630 MB de pico com 50 fragmentos em paralelo e 1,7 GB com 150. A função `mapAtMost` limita a 4 conferências ao mesmo tempo, e cada resultado fica no índice do seu fragmento, então os problemas continuam na ordem do plano.
- **M2, uma exceção deixava o botão em "Gerando…"** (`generation-actions.ts`). O caso de uso agora roda num `try/finally`, e o `generating` volta a `false` (se o projeto ainda é o mesmo) mesmo quando ele lança. A rejeição continua subindo para quem chamou.
- **M6, o caminho do problema numa falha ao gravar um arquivo** (`write-product-folder.ts`). O `FileProblem.file` recebia o caminho relativo à pasta do produto (`product.xml`); agora recebe o caminho no projeto, `saida/.<chave>.tmp/<caminho>`.
- **M8, a faixa verde só sumia pela chave diferente** (`generation-actions.ts`, `project-store.ts`). A faixa voltava se a configuração fosse renomeada de A para A2 e de volta para A, ou se uma nova configuração ganhasse a chave A, e depois de uma falha na escrita ainda oferecia "Abrir pasta" para uma pasta que podia não existir mais. Agora `withoutGenerationOf` limpa a última geração ao renomear a configuração da chave gerada (quando a chave muda), ao excluí-la, e quando uma geração da mesma chave termina em `write-failed`.
- **M9, ADR 0006.** O bullet do DOCTYPE registra que ele leva junto os valores padrão de atributos definidos na DTD, como o `@class` do DITA, o que importa para um deriver DITA no futuro.

## Os itens que ficaram sem correção

- **`copy` não restrito a `saida/`:** o `writeText` já escreve em qualquer lugar do projeto, e o único chamador do `copy` escreve na `.tmp`.
- **Sem novas tentativas em `EPERM`/`EBUSY` passageiros:** nunca ocorreu nas dezenas de rodadas, e a mensagem manda gerar de novo.
- **Mensagens de sistema com caminhos absolutos nos diálogos:** cosmético; é o padrão das mensagens de disco do app.
- **Colisões na saída** (um recurso chamado `product.xml` na raiz, um asset dentro de `saida/`): configurações improváveis.
- **O corpo da spec do desenho descreve dois detalhes de antes do protótipo:** a nota do topo aponta para o plano.
- **Validar o `product.xml` montado com o `xmllint`:** a extração já passa por dois parsers, e 15 casos extras do revisor passaram.

## Os roteiros

### `generate-product-check.mts`

A versão do plano da Fase 5 (Tarefa 3) ganha os casos 11 a 15 e um quarto parâmetro no `generator`, o validador, para o caso 15 contar as conferências ao mesmo tempo. Ela usa o `generation-support.mts` do plano, sem mudança. Os casos novos:

- **11 (I1):** continua do caso 8, em que a troca e a volta falharam e a versão anterior ficou só na `.old`. Com um arquivo posto à mão na `.old`, gerar sem `replace` pede confirmação, e `saida/loja-basica/` volta com o arquivo; gerar com `replace` depois substitui normalmente.
- **12 (I1):** simula o app que caiu entre as duas trocas (a pasta do produto vira `.old`, e sobra uma `.tmp`), com um armazenamento cujo `rename` falha: a geração para, diz onde está a versão anterior, e nada é apagado.
- **13 (I3):** um fragmento gravado em Latin-1, sem declaração de codificação.
- **14 (M6):** um armazenamento cujo `writeText` falha.
- **15 (M1):** 14 fragmentos (10 extras ancorados na raiz), com o 2 malformado (passa pelo `xmllint`) e o 9 ausente (responde logo): no máximo 4 conferências ao mesmo tempo, e os problemas na ordem do plano. Depois, com os dois corrigidos, o produto sai com os fragmentos na ordem do plano.

Crie `.checks/generate-product-check.mts`:

```ts
// Geração do produto sobre cópias de docs/examples/loja-online (plano da Fase 5, Tarefa 3;
// casos 11 a 15 das correções da revisão final).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DOMParser, type Element } from '@xmldom/xmldom'
import type { ProjectStorage } from '@/application/ports/project-storage'
import type { XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import {
  GenerateProduct,
  type GenerateProductResult
} from '@/application/use-cases/generate-product'
import { ResolveConfiguration } from '@/application/use-cases/resolve-configuration'
import { WriteProductFolder } from '@/application/use-cases/write-product-folder'
import type { Asset } from '@/domain/assets/asset-catalog'
import type { Configuration } from '@/domain/configuration/configuration'
import { err } from '@/domain/shared/result'
import { LogicSolverConstraintSolver } from '@/infrastructure/solver/logic-solver-constraint-solver'
import { extractFragmentRoot } from '@/infrastructure/xml/fragment-source'
import { XmlProductDeriver } from '@/infrastructure/xml/xml-product-deriver'
import {
  canonical,
  DiskStorage,
  fixedClock,
  freshExample,
  holdOpen,
  NodeXmlValidator,
  productSchemaIssues,
  readProject,
  sameBytes,
  writeFileIn
} from './generation-support.mts'

const log = (label: string, value: unknown): void => console.log(label.padEnd(40), '→', value)
const resolver = new ResolveConfiguration(new LogicSolverConstraintSolver())
const expected = readFileSync('docs/examples/produto-esperado/loja-basica/product.xml', 'utf8')

function generator(
  folder: string,
  storage: ProjectStorage = new DiskStorage(folder),
  at = '2026-09-24T14:03:05.123Z',
  validator: XmlSchemaValidator = new NodeXmlValidator()
) {
  return new GenerateProduct({
    resolveConfiguration: resolver,
    deriver: new XmlProductDeriver(storage, validator),
    writer: new WriteProductFolder(storage, 'saida'),
    clock: fixedClock(at)
  })
}
const summary = (result: GenerateProductResult): string => {
  switch (result.kind) {
    case 'generated':
      return `gerado em ${result.folder} às ${result.generatedAt.toISOString()}`
    case 'needs-confirmation':
      return `precisa confirmar: ${result.folder}`
    case 'problems':
    case 'write-failed':
      return `${result.kind}${'previousAt' in result && result.previousAt ? ` (anterior em ${result.previousAt})` : ''}\n${result.problems
        .map(
          (p) =>
            `${' '.repeat(43)}${p.file}${p.line ? `:${p.line}` : ''}${p.subject ? ` [${p.subject}]` : ''} ${p.message}`
        )
        .join('\n')}`
  }
}
const tree = (folder: string, prefix = ''): string[] =>
  existsSync(folder)
    ? readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? tree(join(folder, entry.name), `${prefix}${entry.name}/`)
          : [`${prefix}${entry.name}`]
      )
    : ['(não existe)']

// 1. loja-basica: equivalente ao esperado, conforme o product.xsd, com o .svg copiado
const a = freshExample('basica')
const projectA = readProject(a)
log('1. gerar loja-basica', summary(await generator(a).execute(projectA, 'loja-basica')))
const product = readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8')
log('   arquivos em saida/', tree(join(a, 'saida')).join(', '))
log('   igual ao esperado (sem espaços)', canonical(product) === canonical(expected))
log('   conforme o product.xsd', (await productSchemaIssues(product)).join(' | ') || 'sim')
log('   generatedAt', /generatedAt="([^"]+)"/.exec(product)?.[1])
log(
  '   .svg idêntico',
  sameBytes(join(a, 'docs/img/pix-fluxo.svg'), join(a, 'saida/loja-basica/docs/img/pix-fluxo.svg'))
)
const intact = [
  'docs/loja/visao-geral.xml',
  'docs/busca/busca.xml',
  'docs/busca/busca-app.xml',
  'docs/pagamento/pix.xml'
].every((path) => {
  const root = extractFragmentRoot(readFileSync(join(a, path), 'utf8'))
  return root.ok && product.includes(root.value)
})
log('   fragmentos intactos no product.xml', intact)
console.log(product.split('\n').slice(0, 12).join('\n'))

// 2. de novo, sem substituir: pede confirmação e não mexe na pasta
const before = readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8')
log(
  '2. gerar de novo',
  summary(await generator(a, undefined, '2026-09-24T15:00:00Z').execute(projectA, 'loja-basica'))
)
log('   pasta intacta', readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8') === before)

// 3. substituir, com restos de uma geração interrompida
writeFileIn(a, 'saida/.loja-basica.tmp/resto.txt', 'x')
writeFileIn(a, 'saida/.loja-basica.old/resto.txt', 'x')
writeFileIn(a, 'saida/loja-basica/a-mao.txt', 'colocado à mão')
log(
  '3. substituir',
  summary(
    await generator(a, undefined, '2026-09-24T15:00:00Z').execute(projectA, 'loja-basica', {
      replace: true
    })
  )
)
log('   arquivos em saida/', tree(join(a, 'saida')).join(', '))
log(
  '   generatedAt',
  /generatedAt="([^"]+)"/.exec(readFileSync(join(a, 'saida/loja-basica/product.xml'), 'utf8'))?.[1]
)

// 4. pag_boleto selecionado e boleto.xml ausente: falha e não grava nada
const b = freshExample('boleto')
renameSync(join(b, 'docs/pagamento/boleto.xml'), join(b, 'docs/pagamento/boleto-renomeado.xml'))
const comBoleto: Configuration = {
  ...readProject(b).configurations[0].configuration,
  decisions: [
    { featureId: 'busca', state: 'selected' },
    { featureId: 'pag_cartao', state: 'selected' },
    { featureId: 'pag_pix', state: 'selected' },
    { featureId: 'pag_boleto', state: 'selected' }
  ]
}
const projectB = {
  ...readProject(b),
  configurations: [{ key: 'loja-basica', configuration: comBoleto }]
}
log('4. boleto ausente', summary(await generator(b).execute(projectB, 'loja-basica')))
log('   saida/ existe?', existsSync(join(b, 'saida')))

// 5. vários problemas de uma vez: malformado, entidade, codificação e recurso ausente
const c = freshExample('problemas')
writeFileIn(
  c,
  'docs/pagamento/pix.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n<topic xmlns="urn:exemplo:doc">\n  <title>PIX\n</topic>\n'
)
writeFileIn(
  c,
  'docs/busca/busca.xml',
  '<?xml version="1.0"?>\n<!DOCTYPE topic SYSTEM "topic.dtd">\n<topic>\n  <p>Busca&nbsp;rápida</p>\n</topic>\n'
)
writeFileIn(
  c,
  'docs/loja/visao-geral.xml',
  '<?xml version="1.0" encoding="ISO-8859-1"?>\n<topic/>\n'
)
renameSync(join(c, 'docs/img/pix-fluxo.svg'), join(c, 'docs/img/outro.svg'))
log('5. vários problemas', summary(await generator(c).execute(readProject(c), 'loja-basica')))
log('   saida/ existe?', existsSync(join(c, 'saida')))

// 6. fragmento sem namespace, com DOCTYPE e comentários antes da raiz
const d = freshExample('sem-namespace')
writeFileIn(
  d,
  'docs/busca/busca-app.xml',
  '\u{FEFF}<?xml version="1.0" encoding="utf-8"?>\r\n<!-- cabeçalho -->\r\n<!DOCTYPE topic [\r\n  <!ELEMENT topic ANY>\r\n]>\r\n<topic id="app">\r\n  <pre>  linha 1\r\n    linha 2</pre>\r\n</topic>\r\n<!-- fim -->\r\n'
)
log('6. sem namespace', summary(await generator(d).execute(readProject(d), 'loja-basica')))
const productD = readFileSync(join(d, 'saida/loja-basica/product.xml'), 'utf8')
const fragmentD = [
  ...productD.matchAll(/<fragment asset="doc_busca_app"[^>]*>\r?\n(.*?)\r?\n\s*<\/fragment>/gs)
][0]?.[1]
log('   o fragmento no product.xml', JSON.stringify(fragmentD))
const topics = new DOMParser().parseFromString(productD, 'text/xml').getElementsByTagName('topic')
const appTopic = Array.from(topics).find(
  (t) => (t as Element).getAttribute('id') === 'app'
) as Element
log('   namespace do <topic> embutido', JSON.stringify(appTopic.namespaceURI))
log('   conforme o product.xsd', (await productSchemaIssues(productD)).join(' | ') || 'sim')

// 7. a troca falha: a pasta anterior volta para o lugar
const e = freshExample('troca')
await generator(e).execute(readProject(e), 'loja-basica')
const disk = new DiskStorage(e)
let renames = 0
const failingPlace: ProjectStorage = Object.assign(Object.create(disk), {
  rename: async (from: string, to: string) =>
    ++renames === 2
      ? err({ code: 'io' as const, message: 'falha simulada' })
      : disk.rename(from, to)
})
log(
  '7. troca falha',
  summary(
    await generator(e, failingPlace).execute(readProject(e), 'loja-basica', { replace: true })
  )
)
log('   arquivos em saida/', tree(join(e, 'saida')).join(', '))

// 8. a troca e a volta falham: a mensagem diz onde ficou a anterior
renames = 0
const failingBoth: ProjectStorage = Object.assign(Object.create(disk), {
  rename: async (from: string, to: string) =>
    ++renames >= 2 ? err({ code: 'io' as const, message: 'falha simulada' }) : disk.rename(from, to)
})
log(
  '8. troca e volta falham',
  summary(await generator(e, failingBoth).execute(readProject(e), 'loja-basica', { replace: true }))
)
log('   arquivos em saida/', tree(join(e, 'saida')).join(', '))

// 9. um arquivo da pasta aberto em outro programa (a trava do Windows)
const f = freshExample('trava')
await generator(f).execute(readProject(f), 'loja-basica')
const antes = readFileSync(join(f, 'saida/loja-basica/product.xml'), 'utf8')
const holder = await holdOpen(join(f, 'saida/loja-basica/product.xml'))
log(
  '9. arquivo aberto',
  summary(
    await generator(f, undefined, '2026-09-24T16:00:00Z').execute(readProject(f), 'loja-basica', {
      replace: true
    })
  )
)
holder.kill()
log('   arquivos em saida/', tree(join(f, 'saida')).join(', '))
log(
  '   product.xml anterior intacto',
  readFileSync(join(f, 'saida/loja-basica/product.xml'), 'utf8') === antes
)

// 10. configuração que não existe mais / incompleta
log('10. chave inexistente', summary(await generator(a).execute(projectA, 'nao-existe')))
const incompleta = {
  ...projectA,
  configurations: [
    {
      key: 'loja-basica',
      configuration: { ...projectA.configurations[0].configuration, decisions: [] }
    }
  ]
}
log('    incompleta', summary(await generator(a).execute(incompleta, 'loja-basica')))

// 11. depois do caso 8 (a troca e a volta falharam), com um arquivo posto à mão na .old: a
// versão anterior volta para o lugar antes da pergunta, e nada é apagado
writeFileIn(e, 'saida/.loja-basica.old/a-mao.txt', 'colocado à mão')
log(
  '11. gerar depois da falha',
  summary(
    await generator(e, undefined, '2026-09-24T17:00:00Z').execute(readProject(e), 'loja-basica')
  )
)
log('    arquivos em saida/', tree(join(e, 'saida')).join(', '))
log(
  '    substituir',
  summary(
    await generator(e, undefined, '2026-09-24T17:00:00Z').execute(readProject(e), 'loja-basica', {
      replace: true
    })
  )
)
log('    arquivos em saida/', tree(join(e, 'saida')).join(', '))

// 12. o app caiu entre as duas trocas, e a volta da .old falha: a geração para sem apagar nada
renameSync(join(e, 'saida/loja-basica'), join(e, 'saida/.loja-basica.old'))
writeFileIn(e, 'saida/.loja-basica.tmp/product.xml', '<product/>')
const failingRecovery: ProjectStorage = Object.assign(Object.create(disk), {
  rename: async () => err({ code: 'io' as const, message: 'falha simulada' })
})
log(
  '12. a volta da .old falha',
  summary(await generator(e, failingRecovery).execute(readProject(e), 'loja-basica'))
)
log('    arquivos em saida/', tree(join(e, 'saida')).join(', '))

// 13. fragmento em Latin-1, sem declaração de codificação: recusado na linha do "ã"
const g = freshExample('latin1')
writeFileSync(
  join(g, 'docs/busca/busca.xml'),
  Buffer.from('<topic>\n  <title>Busca</title>\n  <p>Visão geral</p>\n</topic>\n', 'latin1')
)
log('13. fragmento em Latin-1', summary(await generator(g).execute(readProject(g), 'loja-basica')))
log('    saida/ existe?', existsSync(join(g, 'saida')))

// 14. a gravação de um arquivo do produto falha: o problema aponta o caminho no projeto
const h = freshExample('gravacao')
const diskH = new DiskStorage(h)
const failingWrite: ProjectStorage = Object.assign(Object.create(diskH), {
  writeText: async () => err({ code: 'io' as const, message: 'disco cheio' })
})
log(
  '14. gravação falha',
  summary(await generator(h, failingWrite).execute(readProject(h), 'loja-basica'))
)
log('    arquivos em saida/', tree(join(h, 'saida')).join(', '))

// 15. muitos fragmentos: no máximo 4 conferências ao mesmo tempo, e os problemas na ordem do
// plano (o 2 passa pelo xmllint e demora mais que o 9, que falta)
const k = freshExample('muitos')
const extras = Array.from({ length: 10 }, (_, index): Asset => {
  const number = String(index + 1).padStart(2, '0')
  return {
    id: `extra_${number}`,
    kind: 'fragment',
    path: `docs/extra/extra-${number}.xml`,
    anchor: 'loja'
  }
})
for (const asset of extras) {
  if (asset.id === 'extra_09') continue
  writeFileIn(
    k,
    asset.path,
    asset.id === 'extra_02' ? '<topic>\n  <p>aberto\n</topic>\n' : `<topic id="${asset.id}"/>\n`
  )
}
const projectK = readProject(k)
const manyFragments = {
  ...projectK,
  assets: { assets: [...projectK.assets.assets, ...extras] }
}
const plainValidator = new NodeXmlValidator()
let inFlight = 0
let mostInFlight = 0
const countingValidator: XmlSchemaValidator = {
  async validate(schema, fileName, content) {
    mostInFlight = Math.max(mostInFlight, ++inFlight)
    const issues = await plainValidator.validate(schema, fileName, content)
    inFlight--
    return issues
  }
}
log(
  '15. 14 fragmentos',
  summary(
    await generator(k, undefined, undefined, countingValidator).execute(
      manyFragments,
      'loja-basica'
    )
  )
)
log('    conferências ao mesmo tempo', mostInFlight)
for (const asset of extras) {
  if (asset.id === 'extra_02') writeFileIn(k, asset.path, '<topic/>\n')
  if (asset.id === 'extra_09') writeFileIn(k, asset.path, '<topic/>\n')
}
mostInFlight = 0
log(
  '    corrigidos',
  summary(
    await generator(k, undefined, undefined, countingValidator).execute(
      manyFragments,
      'loja-basica'
    )
  )
)
log('    conferências ao mesmo tempo', mostInFlight)
const productK = readFileSync(join(k, 'saida/loja-basica/product.xml'), 'utf8')
log(
  '    ordem no product.xml',
  [...productK.matchAll(/<fragment asset="([^"]+)"/g)].map((match) => match[1]).join(' ')
)
```

Rode (leva uns segundos; o caso 9 abre um PowerShell escondido):

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generate-product-check.mts
```

Antes da correção (este roteiro sobre o código de `92a5e4a`), os casos 1 a 10 saíram iguais ao plano, e os casos novos deram:

```
11. gerar depois da falha                → gerado em saida/loja-basica às 2026-09-24T17:00:00.000Z
    arquivos em saida/                   → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
    substituir                           → gerado em saida/loja-basica às 2026-09-24T17:00:00.000Z
    arquivos em saida/                   → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
12. a volta da .old falha                → write-failed
                                           saida/loja-basica/ Não foi possível colocar o produto em saida/loja-basica/: falha simulada
    arquivos em saida/                   →
13. fragmento em Latin-1                 → gerado em saida/loja-basica às 2026-09-24T14:03:05.123Z
    saida/ existe?                       → true
14. gravação falha                       → write-failed
                                           product.xml Não foi possível gravar saida/.loja-basica.tmp/product.xml: disco cheio
    arquivos em saida/                   → (não existe)
15. 14 fragmentos                        → problems
                                           docs/extra/extra-02.xml:3 [extra_02] Opening and ending tag mismatch: p line 2 and topic
                                           docs/extra/extra-09.xml [extra_09] Arquivo ausente.
    conferências ao mesmo tempo          → 13
    corrigidos                           → gerado em saida/loja-basica às 2026-09-24T14:03:05.123Z
    conferências ao mesmo tempo          → 14
    ordem no product.xml                 → doc_loja extra_01 extra_02 extra_03 extra_04 extra_05 extra_06 extra_07 extra_08 extra_09 extra_10 doc_busca doc_busca_app doc_pix
```

- No caso 11, a geração não perguntou nada, e o `a-mao.txt` sumiu com a `.old`.
- No caso 12, a geração apagou a `.old` e a `.tmp` e, com o `rename` falhando, não pôs nada no lugar: `saida/` ficou vazia.
- No caso 13, o fragmento em Latin-1 foi gerado.
- No caso 14, o problema apontava `product.xml`.
- No caso 15, 13 e 14 conferências rodaram ao mesmo tempo (o número exato depende do tempo de cada uma).

Depois da correção, esperado, exatamente:

```
1. gerar loja-basica                     → gerado em saida/loja-basica às 2026-09-24T14:03:05.123Z
   arquivos em saida/                    → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
   igual ao esperado (sem espaços)       → true
   conforme o product.xsd                → sim
   generatedAt                           → 2026-09-24T14:03:05Z
   .svg idêntico                         → true
   fragmentos intactos no product.xml    → true
<?xml version="1.0" encoding="UTF-8"?>
<product xmlns="urn:mdd:product" schemaVersion="1" name="Loja Básica" model="Loja Online" generatedAt="2026-09-24T14:03:05Z">
  <features>
    <feature id="loja" name="Loja Online">
      <attribute id="versao">1.0</attribute>
    </feature>
    <feature id="catalogo" name="Catálogo"/>
    <feature id="busca" name="Busca">
      <attribute id="max_resultados">100</attribute>
    </feature>
    <feature id="mobile" name="App mobile">
      <attribute id="plataforma">android</attribute>
2. gerar de novo                         → precisa confirmar: saida/loja-basica
   pasta intacta                         → true
3. substituir                            → gerado em saida/loja-basica às 2026-09-24T15:00:00.000Z
   arquivos em saida/                    → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
   generatedAt                           → 2026-09-24T15:00:00Z
4. boleto ausente                        → problems
                                           docs/pagamento/boleto.xml [doc_boleto] Arquivo ausente.
   saida/ existe?                        → false
5. vários problemas                      → problems
                                           docs/loja/visao-geral.xml:1 [doc_loja] A codificação ISO-8859-1 não é suportada: salve o arquivo em UTF-8.
                                           docs/busca/busca.xml:4 [doc_busca] A entidade &nbsp; não é suportada: use o próprio caractere ou uma referência numérica, como &#160;.
                                           docs/pagamento/pix.xml:4 [doc_pix] Opening and ending tag mismatch: title line 3 and topic
                                           docs/img/pix-fluxo.svg [img_pix] Arquivo ausente.
   saida/ existe?                        → false
6. sem namespace                         → gerado em saida/loja-basica às 2026-09-24T14:03:05.123Z
   o fragmento no product.xml            → "          <topic xmlns=\"\" id=\"app\">\r\n  <pre>  linha 1\r\n    linha 2</pre>\r\n</topic>"
   namespace do <topic> embutido         → null
   conforme o product.xsd                → sim
7. troca falha                           → write-failed
                                           saida/loja-basica/ Não foi possível colocar o produto em saida/loja-basica/: falha simulada
   arquivos em saida/                    → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
8. troca e volta falham                  → write-failed (anterior em saida/.loja-basica.old/)
                                           saida/loja-basica/ Não foi possível colocar o produto em saida/loja-basica/: falha simulada
   arquivos em saida/                    → .loja-basica.old/docs/img/pix-fluxo.svg, .loja-basica.old/product.xml
9. arquivo aberto                        → write-failed
                                           saida/loja-basica/ Não foi possível substituir saida/loja-basica/: feche os arquivos dessa pasta e gere de novo.
   arquivos em saida/                    → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
   product.xml anterior intacto          → true
10. chave inexistente                    → problems
                                           configurations/nao-existe.xml A configuração não existe mais.
    incompleta                           → problems
                                           configurations/loja-basica.xml A configuração precisa estar completa para gerar o produto.
11. gerar depois da falha                → precisa confirmar: saida/loja-basica
    arquivos em saida/                   → loja-basica/a-mao.txt, loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
    substituir                           → gerado em saida/loja-basica às 2026-09-24T17:00:00.000Z
    arquivos em saida/                   → loja-basica/docs/img/pix-fluxo.svg, loja-basica/product.xml
12. a volta da .old falha                → write-failed (anterior em saida/.loja-basica.old/)
                                           saida/.loja-basica.old/ Não foi possível pôr a versão anterior de volta em saida/loja-basica/: falha simulada
    arquivos em saida/                   → .loja-basica.old/docs/img/pix-fluxo.svg, .loja-basica.old/product.xml, .loja-basica.tmp/product.xml
13. fragmento em Latin-1                 → problems
                                           docs/busca/busca.xml:3 [doc_busca] O arquivo não está em UTF-8: salve-o em UTF-8.
    saida/ existe?                       → false
14. gravação falha                       → write-failed
                                           saida/.loja-basica.tmp/product.xml Não foi possível gravar saida/.loja-basica.tmp/product.xml: disco cheio
    arquivos em saida/                   → (não existe)
15. 14 fragmentos                        → problems
                                           docs/extra/extra-02.xml:3 [extra_02] Opening and ending tag mismatch: p line 2 and topic
                                           docs/extra/extra-09.xml [extra_09] Arquivo ausente.
    conferências ao mesmo tempo          → 4
    corrigidos                           → gerado em saida/loja-basica às 2026-09-24T14:03:05.123Z
    conferências ao mesmo tempo          → 4
    ordem no product.xml                 → doc_loja extra_01 extra_02 extra_03 extra_04 extra_05 extra_06 extra_07 extra_08 extra_09 extra_10 doc_busca doc_busca_app doc_pix
```

### `generation-store-check.mts`

A versão do plano da Fase 5 (Tarefa 4) passa a chave em todas as chamadas de `generateProduct`. O caso 1 mudou: a store não olha mais a configuração aberta, então ele confere a recusa sem projeto aberto e roda antes do `open()`. Os casos novos:

- **9 (I2):** com `loja-outra` aberta, gerar `loja-basica` com `replace` (o "Substituir" de um diálogo aberto antes de trocar de configuração) chama o caso de uso com `loja-basica`, e a última geração fica com ela.
- **10 e 11 (M8):** renomear ou excluir outra configuração não mexe na faixa; renomear ou excluir a gerada a apaga, e ela não volta quando o nome volta nem quando uma configuração nova ganha a mesma chave.
- **12 (M8):** uma falha na escrita de outra chave mantém a faixa; da mesma chave, apaga.
- **13 (M2):** o caso de uso lança; a store rejeita, e o `generating` volta a `false`.

Crie `.checks/generation-store-check.mts`:

```ts
// Store da geração com portas falsas (plano da Fase 5, Tarefa 4; casos 9 a 13 das correções
// da revisão final).
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
import { readFileSync } from 'node:fs'
import type { ProjectSession } from '@/application/project-session'
import type { GenerateProductResult } from '@/application/use-cases/generate-product'
import { err, ok } from '@/domain/shared/result'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import { createProjectStore, hasUnsavedChanges } from '@/ui/stores/project-store'

const read = (path: string) =>
  parseXmlRoot(readFileSync(`docs/examples/loja-online/${path}`, 'utf8'))
const model = decodeFeatureModel(read('model.xml'))
const assets = decodeAssetCatalog(read('assets.xml'))
const basica = decodeConfiguration(read('configurations/loja-basica.xml'))
if (!model.ok || !assets.ok || !basica.ok) throw new Error('o exemplo não abriu')
const session = (): ProjectSession => ({
  folder: { rootPath: 'C:\\loja', name: 'loja' },
  project: {
    model: model.value,
    assets: assets.value,
    configurations: [{ key: 'loja-basica', configuration: basica.value }]
  },
  hashes: { model: 'x', assets: 'y', configurations: { 'loja-basica': 'z' } }
})
const notUsed = async (): Promise<never> => {
  throw new Error('não usado neste roteiro')
}

// A geração falsa: devolve o próximo resultado da fila; cada uma pode ser segurada.
const results: GenerateProductResult[] = []
const calls: string[] = []
let hold: Promise<void> | null = null
let throwNext = false
const opened: string[] = []
const store = createProjectStore({
  openProject: {
    execute: async () => ({ status: 'opened', session: session(), warnings: [] }),
    reopen: async () => ({ status: 'opened', session: session(), warnings: [] })
  },
  createProject: { execute: notUsed },
  saveProject: { execute: notUsed },
  resolveConfiguration: { execute: () => notUsed() as never },
  recentProjects: { list: async () => [] },
  unsavedChanges: { set: () => {} },
  checkAssetFiles: { execute: async () => new Map() },
  filePicker: { pickFile: notUsed },
  assetOpener: { open: notUsed },
  generateProduct: {
    async execute(_project, key, options) {
      calls.push(`${key}${options?.replace ? ' (substituir)' : ''}`)
      if (hold !== null) await hold
      if (throwNext) {
        throwNext = false
        throw new Error('falha inesperada')
      }
      return results.shift()!
    }
  },
  outputFolderOpener: {
    async open(folder) {
      opened.push(folder)
      return folder.endsWith('sumiu') ? err({ code: 'not-found', message: 'não existe' }) : ok(null)
    }
  }
})
const state = () => store.getState()
const log = (label: string, value: unknown): void => console.log(label.padEnd(36), '→', value)
const last = () => {
  const generation = state().lastGeneration
  return generation === null ? '(nenhuma)' : `${generation.key} → ${generation.folder}`
}
const generated = (folder: string): GenerateProductResult => ({
  kind: 'generated',
  folder,
  generatedAt: new Date('2026-09-24T14:03:00Z')
})

// 1. Sem projeto aberto, nada acontece
log('1. sem projeto aberto', await state().generateProduct('loja-basica'))
log('   chamadas', calls.length)
await state().open()

// 2. Gerar: "gerando" durante, a última geração depois, sem mudar o "•"
state().openConfiguration('loja-basica')
let release = (): void => {}
hold = new Promise((resolve) => (release = resolve))
results.push(generated('saida/loja-basica'))
const pending = state().generateProduct('loja-basica')
log('2. durante: gerando', state().generating)
log('   segundo clique', await state().generateProduct('loja-basica'))
hold = null
release()
log('   resultado', (await pending)?.kind)
log('   depois: gerando', state().generating)
log('   última geração', last())
log('   alterações não salvas', hasUnsavedChanges(state()))
log('   chamadas', calls.join(', '))

// 3. Pede confirmação e substitui
results.push({ kind: 'needs-confirmation', folder: 'saida/loja-basica' })
log('3. de novo', (await state().generateProduct('loja-basica'))?.kind)
results.push(generated('saida/loja-basica'))
log('   substituir', (await state().generateProduct('loja-basica', { replace: true }))?.kind)
log('   chamadas', calls.slice(-2).join(', '))

// 4. Problemas: a última geração continua a de antes
results.push({ kind: 'problems', problems: [] })
log('4. problemas', (await state().generateProduct('loja-basica'))?.kind)
log('   última geração', last())

// 5. Abrir a pasta; a falha vira aviso
await state().openGeneratedFolder()
log('5. abriu', opened.join(', '))
store.setState({
  lastGeneration: { key: 'loja-basica', folder: 'saida/sumiu', generatedAt: new Date() }
})
await state().openGeneratedFolder()
log('   aviso', state().notice)

// 6. Dispensar a faixa
state().dismissLastGeneration()
log('6. depois do ×', last())

// 7. Recarregar o projeto no meio da geração: o resultado é descartado
results.push(generated('saida/loja-basica'))
hold = new Promise((resolve) => (release = resolve))
const during = state().generateProduct('loja-basica')
await state().reload()
hold = null
release()
log('7. recarregado no meio', await during)
log('   gerando', state().generating)
log('   última geração', last())

// 8. Fechar o projeto zera a última geração
state().openConfiguration('loja-basica')
results.push(generated('saida/loja-basica'))
await state().generateProduct('loja-basica')
state().close()
log('8. depois de fechar', last())

// 9. O "Substituir" de um diálogo aberto antes de trocar de configuração gera a chave do
// diálogo, e não a configuração aberta
await state().open()
state().openConfiguration('loja-basica')
state().duplicateConfiguration('loja-basica', 'Loja Outra')
log('9. configuração aberta', state().openConfigurationKey)
results.push(generated('saida/loja-basica'))
log(
  '   substituir loja-basica',
  (await state().generateProduct('loja-basica', { replace: true }))?.kind
)
log('   chamada', calls.at(-1))
log('   última geração', last())

// 10. Renomear a configuração gerada apaga a faixa, que não volta com o nome de volta
const keys = () =>
  state()
    .session!.project.configurations.map((entry) => entry.key)
    .join(', ')
state().renameConfiguration('loja-outra', 'Loja Outra 2')
log('10. renomear outra', last())
state().renameConfiguration('loja-basica', 'Loja Básica 2')
log('    renomear a gerada', last())
state().renameConfiguration('loja-basica-2', 'Loja Básica')
log('    nome de volta', `${keys()} | ${last()}`)

// 11. Excluir a configuração gerada apaga a faixa; uma nova com a mesma chave não a traz
results.push(generated('saida/loja-basica'))
await state().generateProduct('loja-basica')
state().deleteConfiguration('loja-outra-2')
log('11. excluir outra', last())
state().deleteConfiguration('loja-basica')
log('    excluir a gerada', last())
state().createConfiguration('Loja Básica')
log('    nova com a mesma chave', `${keys()} | ${last()}`)

// 12. Uma falha na escrita apaga a faixa da mesma chave, e não a de outra
results.push(generated('saida/loja-basica'))
await state().generateProduct('loja-basica')
results.push({ kind: 'write-failed', problems: [] })
log(
  '12. falha na escrita de outra',
  `${(await state().generateProduct('outra'))?.kind} | ${last()}`
)
results.push({ kind: 'write-failed', problems: [] })
log(
  '    falha na escrita da gerada',
  `${(await state().generateProduct('loja-basica'))?.kind} | ${last()}`
)

// 13. O caso de uso lança: o botão não fica preso em "Gerando…"
throwNext = true
log(
  '13. o caso de uso lança',
  await state()
    .generateProduct('loja-basica')
    .catch((error: Error) => `rejeitou: ${error.message}`)
)
log('    gerando', state().generating)
```

Rode:

```bash
npx tsx --tsconfig tsconfig.web.json .checks/generation-store-check.mts
```

Antes da correção, a store não recebia a chave: `generateProduct(options)` gerava a configuração aberta. Para ver o código de `92a5e4a` com estes casos, o roteiro rodou numa cópia com a chave tirada de todas as chamadas (`generateProduct('loja-basica', { replace: true })` virou `generateProduct({ replace: true })`), como o app chamava. A saída foi:

```
1. sem projeto aberto                → null
   chamadas                          → 0
2. durante: gerando                  → true
   segundo clique                    → null
   resultado                         → generated
   depois: gerando                   → false
   última geração                    → loja-basica → saida/loja-basica
   alterações não salvas             → false
   chamadas                          → loja-basica
3. de novo                           → needs-confirmation
   substituir                        → generated
   chamadas                          → loja-basica, loja-basica (substituir)
4. problemas                         → problems
   última geração                    → loja-basica → saida/loja-basica
5. abriu                             → saida/loja-basica
   aviso                             → Não foi possível abrir saida/sumiu/: não existe
6. depois do ×                       → (nenhuma)
7. recarregado no meio               → null
   gerando                           → false
   última geração                    → (nenhuma)
8. depois de fechar                  → (nenhuma)
9. configuração aberta               → loja-outra
   substituir loja-basica            → generated
   chamada                           → loja-outra (substituir)
   última geração                    → loja-outra → saida/loja-basica
10. renomear outra                   → loja-outra → saida/loja-basica
    renomear a gerada                → loja-outra → saida/loja-basica
    nome de volta                    → loja-basica, loja-outra-2 | loja-outra → saida/loja-basica
11. excluir outra                    → loja-outra-2 → saida/loja-basica
    excluir a gerada                 → loja-outra-2 → saida/loja-basica
    nova com a mesma chave           → loja-basica | loja-outra-2 → saida/loja-basica
12. falha na escrita de outra        → write-failed | loja-basica → saida/loja-basica
    falha na escrita da gerada       → write-failed | loja-basica → saida/loja-basica
13. o caso de uso lança              → rejeitou: falha inesperada
    gerando                          → true
```

- No caso 9, o "Substituir" de `loja-basica` gerou `loja-outra` (`loja-outra (substituir)`).
- Nos casos 10 e 11, a faixa não sumiu ao renomear nem ao excluir.
- No caso 12, a falha na escrita não apagou a faixa.
- No caso 13, o `generating` ficou `true`.

Com o caso 9 gerando a configuração aberta, a "última geração" dos casos 10 a 12 é de outras chaves; a diferença que importa é a faixa nunca sumir.

Depois da correção, esperado, exatamente:

```
1. sem projeto aberto                → null
   chamadas                          → 0
2. durante: gerando                  → true
   segundo clique                    → null
   resultado                         → generated
   depois: gerando                   → false
   última geração                    → loja-basica → saida/loja-basica
   alterações não salvas             → false
   chamadas                          → loja-basica
3. de novo                           → needs-confirmation
   substituir                        → generated
   chamadas                          → loja-basica, loja-basica (substituir)
4. problemas                         → problems
   última geração                    → loja-basica → saida/loja-basica
5. abriu                             → saida/loja-basica
   aviso                             → Não foi possível abrir saida/sumiu/: não existe
6. depois do ×                       → (nenhuma)
7. recarregado no meio               → null
   gerando                           → false
   última geração                    → (nenhuma)
8. depois de fechar                  → (nenhuma)
9. configuração aberta               → loja-outra
   substituir loja-basica            → generated
   chamada                           → loja-basica (substituir)
   última geração                    → loja-basica → saida/loja-basica
10. renomear outra                   → loja-basica → saida/loja-basica
    renomear a gerada                → (nenhuma)
    nome de volta                    → loja-basica, loja-outra-2 | (nenhuma)
11. excluir outra                    → loja-basica → saida/loja-basica
    excluir a gerada                 → (nenhuma)
    nova com a mesma chave           → loja-basica | (nenhuma)
12. falha na escrita de outra        → write-failed | loja-basica → saida/loja-basica
    falha na escrita da gerada       → write-failed | (nenhuma)
13. o caso de uso lança              → rejeitou: falha inesperada
    gerando                          → false
```

### Regressão

Sem janela, depois da correção:

- `generation-plan-check.mts` (31 linhas), `output-guard-check.mts` (16 linhas) e `fragment-source-check.mts` (17 linhas): iguais ao plano da Fase 5;
- `generate-product-check.mts`: as 51 linhas dos casos 1 a 10 iguais ao plano;
- `generation-store-check.mts`: as linhas dos casos 2 a 8 iguais ao plano; a do caso 1 mudou de "sem configuração aberta" para "sem projeto aberto", como explicado acima;
- `configurator-store-check.mts` (21 linhas) e `assets-store-check.mts` (20 linhas): iguais ao plano da Fase 4.

`npm run typecheck`, `npm run lint` e `npm run build` passaram, com os três avisos de `eval` do `logic-solver` no build.
