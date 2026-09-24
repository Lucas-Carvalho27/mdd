import { findInvalidValues, findMissingValues } from '@/domain/configuration/attribute-values'
import type { Configuration } from '@/domain/configuration/configuration'
import { activeDecisions, findOrphanReferences } from '@/domain/configuration/references'
import { isSelected, type FeatureStatus, type Resolution } from '@/domain/configuration/resolution'
import type { FeatureModel } from '@/domain/feature-model/feature-model'
import { featuresInPreOrder } from '@/domain/feature-model/traversal'
import { and, literal } from '@/domain/formula/formula'
import { modelFormula } from '@/domain/formula/model-formula'
import type { ConstraintSolver, LoadedFormula, Solution } from '../ports/constraint-solver'

/**
 * Resolução de uma configuração (SPEC §4.2): o que as decisões manuais e as regras do
 * modelo decidem sobre cada feature. A interface pede a mesma resolução várias vezes
 * enquanto nada muda; como modelo e configuração são imutáveis, o resultado fica guardado
 * junto do objeto da configuração, e some com ele.
 */
export class ResolveConfiguration {
  private readonly solver: ConstraintSolver
  private readonly cache = new WeakMap<
    Configuration,
    { readonly model: FeatureModel; readonly resolution: Resolution }
  >()

  constructor(solver: ConstraintSolver) {
    this.solver = solver
  }

  execute(model: FeatureModel, configuration: Configuration): Resolution {
    const cached = this.cache.get(configuration)
    if (cached !== undefined && cached.model === model) return cached.resolution
    const resolution = this.resolve(model, configuration)
    this.cache.set(configuration, { model, resolution })
    return resolution
  }

  private resolve(model: FeatureModel, configuration: Configuration): Resolution {
    const base = {
      orphans: findOrphanReferences(model, configuration),
      invalidValues: findInvalidValues(model, configuration)
    }
    const rules = modelFormula(model)
    const decisions = activeDecisions(model, configuration)

    // Um solver novo por resolução, com as decisões como regras: reaproveitar o mesmo
    // solver com suposições fica cada vez mais lento (veja o plano da Fase 3).
    const loaded = this.solver.load(
      and([
        rules,
        ...decisions.map((decision) => literal(decision.featureId, decision.state === 'selected'))
      ])
    )
    const solution = loaded.solve()
    if (solution === null) {
      const empty = this.solver.load(rules).solve() === null
      return empty ? { kind: 'empty-model', ...base } : { kind: 'conflict', ...base, decisions }
    }

    const manual = new Map(decisions.map((decision) => [decision.featureId, decision.state]))
    const features = propagate(model, manual, loaded, solution)
    const selected = new Set(
      [...features].filter(([, status]) => isSelected(status)).map(([id]) => id)
    )
    return {
      kind: 'resolved',
      ...base,
      features,
      missingValues: findMissingValues(model, configuration, selected)
    }
  }
}

/**
 * Passo 4 da SPEC §4.2: para cada feature sem decisão manual, tenta o valor contrário ao
 * da solução σ. Se não houver solução, o valor de σ é propagado; se houver, a feature fica
 * indecisa. Uma feature que já apareceu com os dois valores nas soluções encontradas
 * fica indecisa sem nova pergunta ao solver.
 */
function propagate(
  model: FeatureModel,
  manual: ReadonlyMap<string, 'selected' | 'deselected'>,
  loaded: LoadedFormula,
  sigma: Solution
): Map<string, FeatureStatus> {
  const ids = featuresInPreOrder(model.root).map((feature) => feature.id)
  const seenTrue = new Set<string>()
  const seenFalse = new Set<string>()
  const note = (solution: Solution): void => {
    for (const id of ids) (solution.has(id) ? seenTrue : seenFalse).add(id)
  }
  note(sigma)

  const features = new Map<string, FeatureStatus>()
  for (const id of ids) {
    const state = manual.get(id)
    if (state !== undefined) {
      features.set(id, { kind: 'manual', state })
      continue
    }
    if (seenTrue.has(id) && seenFalse.has(id)) {
      features.set(id, { kind: 'undecided' })
      continue
    }
    const value = sigma.has(id)
    const other = loaded.solve({ id, value: !value })
    if (other === null) {
      features.set(id, { kind: 'propagated', state: value ? 'selected' : 'deselected' })
    } else {
      note(other)
      features.set(id, { kind: 'undecided' })
    }
  }
  return features
}
