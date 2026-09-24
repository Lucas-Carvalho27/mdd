import { ASSETS_PATH, CONFIGURATIONS_DIRECTORY, MODEL_PATH } from '../project/project-layout'
import { err, ok, type Result } from '../shared/result'

/*
 * Os fragmentos que o editor mostra e cria (Fase 6): os `.xml` do projeto, fora os arquivos
 * do app (model.xml, assets.xml e configurations/), a pasta de saída da geração e o que
 * começa com ponto (.git, .vscode…). Os nomes são comparados sem caixa, como no Windows.
 */

const EXTENSION = '.xml'
/** Os caracteres que o Windows não aceita em nomes de arquivo. */
const FORBIDDEN_CHARACTERS = /[<>:"|?*]/
const ENDS_WITH_DOT_OR_SPACE = /[. ]$/
const DRIVE_LETTER = /^[a-z]:/i

/** A pasta aparece na árvore: não é oculta nem é uma pasta do app ou da geração. */
export function isFragmentFolder(path: string, outputDirectory: string): boolean {
  return !path.split('/').some(isHidden) && reservedReason(path, outputDirectory) === null
}

/** O arquivo é um fragmento que o editor mostra. */
export function isFragmentFile(path: string, outputDirectory: string): boolean {
  return path.toLowerCase().endsWith(EXTENSION) && isFragmentFolder(path, outputDirectory)
}

/** A pasta do arquivo, com a barra no fim: "docs/pagamento/pix.xml" → "docs/pagamento/". */
export function folderOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/') + 1)
}

/**
 * Confere o caminho de um fragmento novo, digitado pelo usuário, contra os que já existem
 * (no disco ou só no editor). Devolve o caminho com "/" e com a grafia das pastas que já
 * existem, ou o motivo da recusa.
 */
export function checkNewFragmentPath(
  input: string,
  outputDirectory: string,
  existing: readonly string[]
): Result<string, string> {
  const path = input.trim().replaceAll('\\', '/')
  if (path === '') return err('Informe o caminho do arquivo, como docs/novo.xml.')
  if (path.startsWith('/') || DRIVE_LETTER.test(path)) {
    return err('Use um caminho relativo à pasta do projeto, como docs/novo.xml.')
  }
  const segments = path.split('/')
  if (segments.includes('..')) return err('O caminho não pode sair da pasta do projeto.')
  if (segments.includes('')) return err('O caminho tem um trecho vazio.')
  if (segments.some((segment) => FORBIDDEN_CHARACTERS.test(segment))) {
    return err('O Windows não aceita os caracteres < > : " | ? * em nomes de arquivo.')
  }
  if (segments.some((segment) => ENDS_WITH_DOT_OR_SPACE.test(segment))) {
    return err('Um nome de pasta ou de arquivo não pode terminar em ponto ou espaço.')
  }
  if (!path.toLowerCase().endsWith(EXTENSION)) return err('O arquivo precisa terminar em .xml.')
  if (segments.some(isHidden)) {
    return err('Nomes começando com ponto ficam fora da árvore de fragmentos.')
  }
  const reserved = reservedReason(path, outputDirectory)
  if (reserved !== null) return err(reserved)

  const adopted = withExistingFolders(segments, existing)
  if (existing.some((other) => sameFile(other, adopted))) return err(`"${adopted}" já existe.`)
  return ok(adopted)
}

function isHidden(name: string): boolean {
  return name.startsWith('.')
}

function sameFile(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/** Por que o caminho é do app ou da geração, e não dos fragmentos; `null` quando não é. */
function reservedReason(path: string, outputDirectory: string): string | null {
  if (sameFile(path, MODEL_PATH) || sameFile(path, ASSETS_PATH)) {
    return `"${path}" é um arquivo do app, editado pelas outras abas.`
  }
  const first = path.split('/')[0]
  if (sameFile(first, CONFIGURATIONS_DIRECTORY)) {
    return `A pasta ${CONFIGURATIONS_DIRECTORY}/ é das configurações.`
  }
  if (sameFile(first, outputDirectory)) return `A pasta ${outputDirectory}/ é da geração.`
  return null
}

/**
 * No Windows, "Docs/novo.xml" cai na pasta "docs/" que já existe. O caminho passa a usar a
 * grafia dela, para o arquivo novo aparecer na árvore junto com os outros.
 */
function withExistingFolders(segments: readonly string[], existing: readonly string[]): string {
  const adopted = [...segments]
  for (let depth = 1; depth < adopted.length; depth++) {
    const prefix = `${adopted.slice(0, depth).join('/')}/`
    const match = existing.find((other) => sameFile(other.slice(0, prefix.length), prefix))
    if (match !== undefined) adopted.splice(0, depth, ...match.split('/').slice(0, depth))
  }
  return adopted.join('/')
}
