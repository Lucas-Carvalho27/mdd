import { RESERVED_WORDS } from '../expression/identifier'

/**
 * Gera um ID a partir de um nome (SPEC §4.1): sem acentos, minúsculo, cada trecho que não
 * for letra ou dígito vira "_", e um sufixo _2, _3… evita colisões e palavras reservadas.
 * Ex.: "Pagamento com PIX" → "pagamento_com_pix".
 */
export function generateId(name: string, taken: ReadonlySet<string>, fallback: string): string {
  const base = slugify(name) || fallback
  if (!taken.has(base) && !RESERVED_WORDS.has(base)) return base
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}_${suffix}`
    if (!taken.has(candidate)) return candidate
  }
}

function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (slug === '') return ''
  return /^[a-z]/.test(slug) ? slug : `f_${slug}`
}
