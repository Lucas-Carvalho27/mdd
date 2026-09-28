/**
 * Quem mostra a página da visualização (Fase 8): no app, o processo main, que a serve num
 * esquema próprio, isolada do app (ADR 0011).
 */
export interface PagePreviewHost {
  /** O endereço em que a última página entregue fica disponível. */
  readonly address: string
  /** Entrega a página; o endereço passa a servi-la. */
  show(html: string): Promise<void>
}
