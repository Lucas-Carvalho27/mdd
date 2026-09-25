import type { FileProblem } from '../file-problem'

/** Confere o texto de um fragmento como a geração confere (SPEC §4.4). */
export interface FragmentChecker {
  /** Lista vazia = o fragmento pode entrar num produto. */
  check(path: string, content: string): Promise<FileProblem[]>
}
