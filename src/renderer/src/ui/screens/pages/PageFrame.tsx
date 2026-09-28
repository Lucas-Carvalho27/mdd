import { useEffect, useRef } from 'react'
import { cn } from 'cn'
import type { PageWidth } from '@/ui/stores/pages-actions'
import { useProjectStoreApi } from '@/ui/stores/project-store-context'

/** As larguras da página: celular, tablet e a largura toda. */
const WIDTH_CLASS: Readonly<Record<PageWidth, string>> = {
  mobile: 'w-[375px]',
  tablet: 'w-[768px]',
  full: 'w-full'
}

/**
 * O sandbox da página (ADR 0011): scripts, formulários, alertas e janelas (que o main manda
 * para o navegador do sistema). Sem `allow-same-origin`, a página fica numa origem opaca e não
 * enxerga o app; sem `allow-top-navigation`, não troca a janela do app.
 */
const SANDBOX = 'allow-scripts allow-popups allow-forms allow-modals'

interface PageFrameProps {
  readonly address: string
  /** Muda a cada montagem: o quadro recarrega, com a rolagem guardada. */
  readonly version: number
  readonly width: PageWidth
}

/** A página da configuração, num quadro isolado do app. */
export function PageFrame({ address, version, width }: PageFrameProps): React.JSX.Element {
  const frame = useRef<HTMLIFrameElement>(null)
  const store = useProjectStoreApi()

  useEffect(() => {
    const current = frame.current
    if (current === null) return
    const y = Math.round(store.getState().pageScroll)
    current.src = `${address}?y=${y}&v=${version}`
  }, [address, version, store])

  // As mensagens do script da visualização: a rolagem e o Ctrl+S (a página não enxerga o app,
  // e com o foco nela as teclas não chegam a ele). Só valem as que vêm deste quadro.
  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (frame.current === null || event.source !== frame.current.contentWindow) return
      const data: unknown = event.data
      if (typeof data !== 'object' || data === null || !('mddPreview' in data)) return
      const message = data as { readonly mddPreview: unknown; readonly y?: unknown }
      const state = store.getState()
      if (message.mddPreview === 'scroll' && typeof message.y === 'number') {
        state.setPageScroll(message.y)
      } else if (message.mddPreview === 'save') {
        void state.save()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [store])

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-muted p-3">
      <iframe
        ref={frame}
        title="Página da configuração"
        data-page-frame
        sandbox={SANDBOX}
        className={cn(
          'h-full shrink-0 rounded-md bg-white shadow-sm ring-1 ring-border',
          WIDTH_CLASS[width]
        )}
      />
    </div>
  )
}
