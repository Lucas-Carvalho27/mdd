import type { Group } from '@/domain/feature-model/feature-model'

/** Nome clássico da cardinalidade: alternative [1..1], or [1..*] ou a faixa em si. */
export function describeGroup(group: Group): string {
  if (group.min === 1 && group.max === 1) return 'alternative'
  if (group.min === 1 && group.max === '*') return 'or'
  return `[${group.min}..${group.max}]`
}
