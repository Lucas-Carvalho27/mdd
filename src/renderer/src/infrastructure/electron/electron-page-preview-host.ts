import type { PagePreviewHost } from '@/application/ports/page-preview-host'

/** O processo main serve a página no esquema próprio da visualização (ADR 0011). */
export class ElectronPagePreviewHost implements PagePreviewHost {
  readonly address: string

  /** `address` vem da composition root (`PREVIEW_ADDRESS`, em `src/shared/ipc.ts`). */
  constructor(address: string) {
    this.address = address
  }

  show(html: string): Promise<void> {
    return window.mdd.setPreviewPage(html)
  }
}
