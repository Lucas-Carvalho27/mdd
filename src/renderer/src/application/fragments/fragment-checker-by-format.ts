import { fragmentFormat, type FragmentFormat } from '@/domain/fragments/fragment-format'
import type { FileProblem } from '../file-problem'
import type { FragmentChecker } from '../ports/fragment-checker'

/** Confere cada fragmento com o checker do formato dele, pela extensão (Fase 7). */
export class FragmentCheckerByFormat implements FragmentChecker {
  private readonly checkers: Readonly<Record<FragmentFormat, FragmentChecker>>

  constructor(checkers: Readonly<Record<FragmentFormat, FragmentChecker>>) {
    this.checkers = checkers
  }

  check(path: string, content: string): Promise<FileProblem[]> {
    return this.checkers[fragmentFormat(path) ?? 'xml'].check(path, content)
  }
}
