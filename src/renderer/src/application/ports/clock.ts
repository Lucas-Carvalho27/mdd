/** Data e hora atuais (SPEC §6.2), para o `generatedAt` do produto gerado. */
export interface Clock {
  now(): Date
}
