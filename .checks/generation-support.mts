// Apoio dos roteiros da geração (plano da Fase 5): o armazenamento em disco com as mesmas
// regras do processo main, o xmllint, a leitura do exemplo e a comparação com o esperado.
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { DOMParser, type Element, type Node } from '@xmldom/xmldom'
import { validateXML } from 'xmllint-wasm'
import { ProjectRoot } from '../src/main/project-root'
import type { ProjectStorage, StorageError } from '@/application/ports/project-storage'
import type { XmlSchema, XmlSchemaValidator } from '@/application/ports/xml-schema-validator'
import type { Project } from '@/domain/project/project'
import { err, ok, type Result } from '@/domain/shared/result'
import { decodeAssetCatalog } from '@/infrastructure/xml/assets-codec'
import { decodeConfiguration } from '@/infrastructure/xml/configuration-codec'
import { decodeFeatureModel } from '@/infrastructure/xml/feature-model-codec'
import { parseXmlRoot } from '@/infrastructure/xml/xml-reader'

const sha = (content: string): string => createHash('sha256').update(content, 'utf8').digest('hex')

/** Uma cópia nova do exemplo em .checks/geracao/<nome>. */
export function freshExample(name: string): string {
  const folder = resolve('.checks/geracao', name)
  rmSync(folder, { recursive: true, force: true })
  cpSync('docs/examples/loja-online', folder, { recursive: true })
  return folder
}

/** O projeto da pasta, lido pelos codecs (sem a validação XSD, que o exemplo já passa). */
export function readProject(folder: string): Project {
  const read = (path: string) => parseXmlRoot(readFileSync(join(folder, path), 'utf8'))
  const model = decodeFeatureModel(read('model.xml'))
  const assets = decodeAssetCatalog(read('assets.xml'))
  const configuration = decodeConfiguration(read('configurations/loja-basica.xml'))
  if (!model.ok || !assets.ok || !configuration.ok) throw new Error('o exemplo não abriu')
  return {
    model: model.value,
    assets: assets.value,
    configurations: [{ key: 'loja-basica', configuration: configuration.value }]
  }
}

/**
 * O ProjectStorage sobre o disco, com os limites do processo main (src/main/ipc/file-handlers.ts):
 * `resolve` para o projeto e `resolveInOutput` para renomear e apagar pastas. As pré-condições
 * de escrita ficam de fora, porque a geração grava sempre com `overwrite`.
 */
export class DiskStorage implements ProjectStorage {
  private readonly root = new ProjectRoot()

  constructor(folder: string) {
    this.root.open(folder)
  }

  private async run<T>(
    path: string | null,
    shown: string,
    operation: (absolute: string) => Promise<Result<T, StorageError>>
  ): Promise<Result<T, StorageError>> {
    if (path === null)
      return err({ code: 'outside-project', message: `"${shown}" fica fora do limite.` })
    try {
      return await operation(path)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return err({ code: 'not-found', message: `"${shown}" não existe.` })
      return err({ code: 'io', message: `Erro ao acessar "${shown}": ${(error as Error).message}` })
    }
  }

  readText(path: string) {
    return this.run(this.root.resolve(path), path, async (absolute) => {
      const content = await readFile(absolute, 'utf8')
      return ok({ content, hash: sha(content) })
    })
  }

  writeText(path: string, content: string) {
    return this.run(this.root.resolve(path), path, async (absolute) => {
      await mkdir(dirname(absolute), { recursive: true })
      await writeFile(absolute, content, 'utf8')
      return ok(sha(content))
    })
  }

  list(directory: string) {
    return this.run(this.root.resolve(directory), directory, async (absolute) =>
      ok(
        (await readdir(absolute, { withFileTypes: true })).map((entry) => ({
          name: entry.name,
          kind: entry.isFile() ? ('file' as const) : ('directory' as const)
        }))
      )
    )
  }

  remove(path: string) {
    return this.run(this.root.resolve(path), path, async (absolute) => {
      if (existsSync(absolute)) await unlink(absolute)
      return ok(null)
    })
  }

  stat(path: string) {
    return this.run(this.root.resolve(path), path, async (absolute) =>
      ok((await stat(absolute)).isDirectory() ? ('directory' as const) : ('file' as const))
    )
  }

  copy(from: string, to: string) {
    const target = this.root.resolve(to)
    return this.run(this.root.resolve(from), from, async (absolute) => {
      if (target === null) return err({ code: 'outside-project' as const, message: to })
      if ((await stat(absolute)).isDirectory())
        return err({ code: 'io' as const, message: 'pasta' })
      await mkdir(dirname(target), { recursive: true })
      await copyFile(absolute, target)
      return ok(null)
    })
  }

  rename(from: string, to: string) {
    const target = this.root.resolveInOutput(to)
    return this.run(this.root.resolveInOutput(from), from, async (absolute) => {
      if (target === null) return err({ code: 'outside-project' as const, message: to })
      await rename(absolute, target)
      return ok(null)
    })
  }

  removeDirectory(path: string) {
    return this.run(this.root.resolveInOutput(path), path, async (absolute) => {
      await rm(absolute, { recursive: true, force: true })
      return ok(null)
    })
  }
}

/** O xmllint do processo main (src/main/xml/schema-validator.ts), sem schema na geração. */
export class NodeXmlValidator implements XmlSchemaValidator {
  async validate(schema: XmlSchema | null, fileName: string, content: string) {
    const schemas =
      schema === null
        ? []
        : [
            {
              fileName: `${schema}.xsd`,
              contents: readFileSync(`docs/schemas/${schema}.xsd`, 'utf8')
            }
          ]
    const result = await validateXML({ xml: [{ fileName, contents: content }], schema: schemas })
    if (result.valid) return []
    const issues = result.errors.map((e) => ({
      line: e.loc?.lineNumber,
      message: e.message
        .replace(/^(Schemas validity error|Schemas parser error|parser error)\s*:\s*/, '')
        .trim()
    }))
    const located = issues.filter((issue) => issue.line !== undefined && issue.message !== '')
    return located.length > 0 ? located : issues
  }
}

export const fixedClock = (iso: string) => ({ now: () => new Date(iso) })

/** O product.xml conforme o product.xsd (que importa o xml.xsd)? */
export async function productSchemaIssues(content: string): Promise<string[]> {
  const result = await validateXML({
    xml: [{ fileName: 'product.xml', contents: content }],
    schema: [
      { fileName: 'product.xsd', contents: readFileSync('docs/schemas/product.xsd', 'utf8') }
    ],
    preload: [{ fileName: 'xml.xsd', contents: readFileSync('docs/schemas/xml.xsd', 'utf8') }]
  })
  return result.valid ? [] : result.errors.map((e) => `${e.loc?.lineNumber}: ${e.message}`)
}

/**
 * Forma canônica para comparar com o esperado: ignora comentários, espaços entre elementos,
 * a quantidade de espaços dentro dos textos, as declarações de namespace e o `generatedAt`.
 * Os elementos são comparados pelo namespace de verdade, não pelo prefixo.
 */
export function canonical(content: string): string {
  const root = new DOMParser().parseFromString(content, 'text/xml').documentElement
  if (root === null) throw new Error('sem raiz')
  const lines: string[] = []
  const walk = (node: Node, depth: number): void => {
    const indent = '  '.repeat(depth)
    if (node.nodeType === 1) {
      const element = node as Element
      const attributes = Array.from(element.attributes)
        .filter(
          (a) => a.name !== 'xmlns' && !a.name.startsWith('xmlns:') && a.name !== 'generatedAt'
        )
        .map((a) => `${a.namespaceURI ? `{${a.namespaceURI}}` : ''}${a.localName}=${a.value}`)
        .sort()
      lines.push(
        `${indent}{${element.namespaceURI ?? ''}}${element.localName} ${attributes.join(' ')}`
      )
      for (const child of Array.from(element.childNodes)) walk(child, depth + 1)
    } else if (node.nodeType === 3 || node.nodeType === 4) {
      const text = (node.nodeValue ?? '').replace(/\s+/g, ' ').trim()
      if (text !== '') lines.push(`${indent}"${text}"`)
    }
  }
  walk(root, 0)
  return lines.join('\n')
}

export function sameBytes(a: string, b: string): boolean {
  return readFileSync(a).equals(readFileSync(b))
}

/** Mantém um arquivo aberto por outro processo (PowerShell), como um editor faria. */
export function holdOpen(path: string): Promise<ChildProcess> {
  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `$f=[System.IO.File]::Open('${path}','Open','Read','Read'); 'ok'; Start-Sleep 60`
    ],
    { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true }
  )
  return new Promise((done) => child.stdout!.once('data', () => done(child)))
}

export function writeFileIn(folder: string, path: string, content: string): void {
  mkdirSync(dirname(join(folder, path)), { recursive: true })
  writeFileSync(join(folder, path), content, 'utf8')
}
