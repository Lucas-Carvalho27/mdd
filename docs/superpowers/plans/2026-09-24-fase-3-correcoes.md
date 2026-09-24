# Fase 3 — Correções da revisão final

Registro das correções feitas depois da revisão final do branch da Fase 3 (`git diff ca5ddc9..085b453`), no branch `fase-3-correcoes`. O código está no commit `fix(configuration): salvar nunca perde uma configuração`; este documento guarda o porquê e o roteiro que reproduz os defeitos, já que `.checks/` não vai para o git.

## Os defeitos

Os dois estavam no salvar das configurações (`SaveProject` e `configuration-entries.ts`) e podiam perder uma configuração inteira.

1. **Renomear com conflito apagava o arquivo antigo.** O `SaveProject` gravava as configurações e depois excluía os arquivos das chaves que saíram da lista, mesmo quando a gravação do arquivo novo tinha falhado. Exemplo: alguém cria `loja-premium.xml` fora do app; no app, "Loja Básica" é renomeada para "Loja Premium" e salva. A gravação dá conflito, mas `loja-basica.xml` é apagado. "Recarregar (descarta minhas alterações)" então perde a configuração. O comentário do código prometia o contrário ("um arquivo renomeado nunca some antes de o novo existir").
2. **Chaves que só diferem na caixa.** A SPEC aceita qualquer `configurations/*.xml`, então um arquivo criado à mão pode ser `Loja.xml` (chave `Loja`). As chaves geradas pelo app são minúsculas, e a colisão era conferida com diferença de caixa. No Windows, `Loja.xml` e `loja.xml` são o mesmo arquivo:
   - criar "Loja" gerava `loja` e, com "Sobrescrever", uma configuração gravava por cima da outra;
   - excluir `Loja` e criar "Loja" de novo: "Sobrescrever" gravava `loja.xml` e, em seguida, a exclusão de `Loja` apagava esse mesmo arquivo;
   - renomear "Loja X" (`Loja.xml`) para "Loja" trocava a chave para `loja`: a gravação dava conflito e a exclusão apagava o arquivo.

## A correção

- `SaveProject`: as exclusões só acontecem se todas as configurações foram gravadas; senão, ficam para o próximo salvar. Uma chave antiga que só difere na caixa de uma chave mantida não é excluída (é o arquivo que acabou de ser gravado); só o hash dela sai da sessão.
- `configurationKey`: a colisão ignora a caixa. `keyAfterRename`: renomear mantém a chave quando só a caixa mudaria. `sameKey` compara duas chaves como o Windows compara nomes de arquivo.
- O diálogo de renomear mostra o nome de arquivo que de fato vai ficar (`keyAfterRename`).
- SPEC §8 registra as duas regras.

## O roteiro

O armazenamento em memória imita o Windows: sem diferença de caixa, guardando a caixa com que o arquivo foi criado. Crie `.checks/save-safety-check.mts`:

```ts
// Salvar nunca perde uma configuração: renomear com conflito e nomes que só diferem na caixa
// (correções da revisão da Fase 3). O armazenamento imita o Windows: "Loja.xml" e
// "loja.xml" são o mesmo arquivo, que guarda a caixa com que foi criado.
// Uso: npx tsx --tsconfig tsconfig.web.json .checks/save-safety-check.mts
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { ProjectStorage, StorageError } from '@/application/ports/project-storage'
import type { ProjectSession } from '@/application/project-session'
import { SaveProject } from '@/application/use-cases/save-project'
import type { Configuration } from '@/domain/configuration/configuration'
import {
  addConfiguration,
  removeConfiguration,
  renameConfiguration
} from '@/domain/project/configuration-entries'
import type { ConfigurationEntry } from '@/domain/project/project'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeConfiguration, encodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'
import {
  XmlAssetCatalogRepository,
  XmlConfigurationRepository,
  XmlFeatureModelRepository
} from '@/infrastructure/xml/xml-repositories'

const example = (path: string): string => readFileSync(`docs/examples/loja-online/${path}`, 'utf8')
const decodedModel = decodeFeatureModel(parseXmlRoot(example('model.xml')))
const decodedConfiguration = decodeConfiguration(
  parseXmlRoot(example('configurations/loja-basica.xml'))
)
if (!decodedModel.ok || !decodedConfiguration.ok) throw new Error('o exemplo não abriu')
const model = decodedModel.value
const basica = decodedConfiguration.value
const log = (label: string, value: unknown): void => console.log(label.padEnd(40), '→', value)
const hash = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex')
const named = (name: string): Configuration => ({ ...basica, name })

/** Pasta em memória sem diferença de caixa, com as pré-condições do processo main. */
function windowsFolder(initial: Record<string, string>) {
  const files = new Map<string, { name: string; content: string }>()
  const put = (path: string, content: string): void => {
    const name = files.get(path.toLowerCase())?.name ?? path
    files.set(path.toLowerCase(), { name, content })
  }
  for (const [path, content] of Object.entries(initial)) put(path, content)
  const get = (path: string): string | undefined => files.get(path.toLowerCase())?.content
  const changed = (path: string): StorageError => ({ code: 'changed-externally', message: path })
  const storage: ProjectStorage = {
    async readText(path) {
      const content = get(path)
      return content === undefined
        ? err({ code: 'not-found', message: path })
        : ok({ content, hash: hash(content) })
    },
    async writeText(path, content, precondition) {
      const current = get(path)
      const violated =
        (precondition.kind === 'must-not-exist' && current !== undefined) ||
        (precondition.kind === 'hash' &&
          (current === undefined || hash(current) !== precondition.expectedHash))
      if (violated) return err(changed(path))
      put(path, content)
      return ok(hash(content))
    },
    async list() {
      return ok([])
    },
    async remove(path, precondition): Promise<Result<null, StorageError>> {
      const current = get(path)
      if (current === undefined) return ok(null)
      if (precondition.kind === 'hash' && hash(current) !== precondition.expectedHash) {
        return err(changed(path))
      }
      files.delete(path.toLowerCase())
      return ok(null)
    }
  }
  const validator = { validate: async () => [] }
  const save = new SaveProject({
    models: new XmlFeatureModelRepository(storage, validator),
    assets: new XmlAssetCatalogRepository(storage, validator),
    configurations: new XmlConfigurationRepository(storage, validator)
  })
  /** As configurações no disco, com a caixa do nome do arquivo e o nome de exibição. */
  const disk = (): string =>
    [...files.values()]
      .filter((file) => file.name.startsWith('configurations/'))
      .map((file) => `${file.name.slice(15)}="${file.content.match(/name="([^"]+)"/)?.[1]}"`)
      .sort()
      .join(' ') || '(nenhuma)'
  return { save, disk }
}

function session(
  entries: readonly ConfigurationEntry[],
  hashes: Record<string, string>
): ProjectSession {
  return {
    folder: { rootPath: 'memória', name: 'memória' },
    project: { model, assets: { assets: [] }, configurations: entries },
    hashes: { model: hash(example('model.xml')), assets: null, configurations: hashes }
  }
}

const unwrap = <T>(result: Result<T, string>): T => {
  if (!result.ok) throw new Error(result.error)
  return result.value
}

// 1. Renomear para uma chave cujo arquivo foi criado fora do app
{
  const basicaXml = encodeConfiguration(basica)
  const { save, disk } = windowsFolder({
    'model.xml': example('model.xml'),
    'configurations/loja-basica.xml': basicaXml,
    'configurations/loja-premium.xml': encodeConfiguration(named('Premium de fora'))
  })
  const entries = [{ key: 'loja-basica', configuration: basica }]
  const renamed = unwrap(renameConfiguration(entries, 'loja-basica', 'Loja Premium'))
  const first = await save.execute(session(renamed.entries, { 'loja-basica': hash(basicaXml) }))
  log('1. conflitos', first.conflicts.join(' '))
  log('   disco depois de salvar', disk())
  const second = await save.execute(first.session, { overwrite: true })
  log('   disco depois de sobrescrever', disk())
  log('   hashes depois', Object.keys(second.session.hashes.configurations).join(' '))
}

// 2. Criar "Loja" com Loja.xml (feito à mão) no disco
{
  const entries = [{ key: 'Loja', configuration: named('Loja') }]
  log('2. chave da nova "Loja"', unwrap(addConfiguration(entries, 'Loja')).key)
}

// 3. Excluir Loja.xml e criar "Loja" de novo: vira loja.xml, o mesmo arquivo no Windows
{
  const antiga = encodeConfiguration(named('Loja antiga'))
  const { save, disk } = windowsFolder({
    'model.xml': example('model.xml'),
    'configurations/Loja.xml': antiga
  })
  const entries = [{ key: 'Loja', configuration: named('Loja antiga') }]
  const recreated = unwrap(addConfiguration(removeConfiguration(entries, 'Loja'), 'Loja'))
  const first = await save.execute(session(recreated.entries, { Loja: hash(antiga) }))
  log('3. conflitos', first.conflicts.join(' '))
  log('   disco depois de salvar', disk())
  const second = await save.execute(first.session, { overwrite: true })
  log('   disco depois de sobrescrever', disk())
  log('   hashes depois', Object.keys(second.session.hashes.configurations).join(' '))
}

// 4. Renomear Loja.xml ("Loja X") para "Loja": a chave só mudaria de caixa
{
  const antiga = encodeConfiguration(named('Loja X'))
  const { save, disk } = windowsFolder({
    'model.xml': example('model.xml'),
    'configurations/Loja.xml': antiga
  })
  const entries = [{ key: 'Loja', configuration: named('Loja X') }]
  const renamed = unwrap(renameConfiguration(entries, 'Loja', 'Loja'))
  log('4. chave depois de renomear', renamed.key)
  const saved = await save.execute(session(renamed.entries, { Loja: hash(antiga) }))
  log('   conflitos', saved.conflicts.join(' ') || '(nenhum)')
  log('   disco depois de salvar', disk())
}
```

Rode:

```bash
npx tsx --tsconfig tsconfig.web.json .checks/save-safety-check.mts
```

Antes da correção, a saída foi:

```
1. conflitos                             → configurations/loja-premium.xml
   disco depois de salvar                → loja-premium.xml="Premium de fora"
   disco depois de sobrescrever          → loja-premium.xml="Loja Premium"
   hashes depois                         → loja-premium
2. chave da nova "Loja"                  → loja
3. conflitos                             → configurations/loja.xml
   disco depois de salvar                → (nenhuma)
   disco depois de sobrescrever          → loja.xml="Loja"
   hashes depois                         → loja
4. chave depois de renomear              → loja
   conflitos                             → configurations/loja.xml
   disco depois de salvar                → (nenhuma)
```

Depois da correção, esperado, exatamente:

```
1. conflitos                             → configurations/loja-premium.xml
   disco depois de salvar                → loja-basica.xml="Loja Básica" loja-premium.xml="Premium de fora"
   disco depois de sobrescrever          → loja-premium.xml="Loja Premium"
   hashes depois                         → loja-premium
2. chave da nova "Loja"                  → loja-2
3. conflitos                             → configurations/loja.xml
   disco depois de salvar                → Loja.xml="Loja antiga"
   disco depois de sobrescrever          → Loja.xml="Loja"
   hashes depois                         → loja
4. chave depois de renomear              → Loja
   conflitos                             → (nenhum)
   disco depois de salvar                → Loja.xml="Loja"
```

Nos casos 1, 3 e 4, o arquivo antigo continua no disco depois do salvar com conflito, e "Recarregar" o encontra. O caso 2 ganha a chave `loja-2`.

A regressão da Fase 3 continuou igual ao plano: `configurations-check.mts` (24 linhas), `configurator-store-check.mts` (21 linhas) e `resolution-check.mts` (a linha do tempo por resolução deu cinco números entre 28 e 42 ms). O `configurador-ui.mjs`, que renomeia, duplica, exclui e salva, também bateu no `mdd.exe` (veja o handoff).
