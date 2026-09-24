/**
 * Estado do arquivo de um asset (SPEC §4.3): calculado, nunca salvo. "XML malformado" só é
 * conferido na geração (Fase 5).
 */
export type AssetFileStatus = 'ok' | 'missing'
