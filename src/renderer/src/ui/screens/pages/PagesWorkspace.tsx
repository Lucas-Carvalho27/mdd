import { useCallback, useEffect, useRef } from 'react'
import { FilePlus2 } from 'lucide-react'
import type { Project } from '@/domain/project/project'
import { Button } from '@/ui/components/ui/button'
import { ConfigurationList } from '@/ui/screens/configurator/ConfigurationList'
import { generationBlockedReason } from '@/ui/screens/configurator/configuration-texts'
import { GenerationBanner } from '@/ui/screens/configurator/GenerationBanner'
import type { EditorDialog } from '@/ui/screens/project/editor-dialog'
import { useWindowFocus } from '@/ui/screens/project/use-window-focus'
import { openConfigurationEntry } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { PageBar } from './PageBar'
import { PageFrame } from './PageFrame'
import { PageProblems } from './PageProblems'

/** A página é montada de novo meio segundo depois da última mudança no que entra nela. */
const REFRESH_DELAY_MS = 500

interface PagesWorkspaceProps {
  readonly project: Project
  readonly onOpenDialog: (dialog: EditorDialog) => void
  /** Leva à aba Fragmentos com o arquivo aberto na linha. */
  readonly onShowFragmentAt: (path: string, line: number) => void
  /** Leva à aba Fragmentos com o diálogo "Novo fragmento". */
  readonly onNewFragment: () => void
  /** Cria a `moldura.html` com a moldura padrão e a abre na aba Fragmentos. */
  readonly onCreateFrame: () => Promise<void>
}

/**
 * Aba Páginas (Fase 8): a lista de configurações só para escolher, e a página da configuração
 * aberta, montada ao vivo do projeto como está na tela, num quadro isolado do app.
 */
export function PagesWorkspace({
  project,
  onOpenDialog,
  onShowFragmentAt,
  onNewFragment,
  onCreateFrame
}: PagesWorkspaceProps): React.JSX.Element {
  const entry = useProjectStore(openConfigurationEntry)
  const preview = useProjectStore((state) => state.pagePreview)
  const width = useProjectStore((state) => state.pageWidth)
  const documents = useProjectStore((state) => state.fragmentDocuments)
  const resolution = useProjectStore((state) => state.openResolution())
  const refresh = useProjectStore((state) => state.refreshPage)

  // O projeto (modelo, assets e configurações), a configuração aberta e o texto dos
  // fragmentos abertos: qualquer mudança monta a página de novo, um pouco depois. Ao entrar na
  // aba, na hora: o main ainda guarda a página da última visita.
  const entered = useRef(false)
  useEffect(() => {
    if (!entered.current) {
      entered.current = true
      void refresh()
      return
    }
    const timer = setTimeout(() => void refresh(), REFRESH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [project, entry, documents, refresh])
  // Um arquivo pode ter mudado fora do app, com a janela em segundo plano.
  useWindowFocus(useCallback(() => void refresh(), [refresh]))

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[15rem_1fr]">
      <ConfigurationList configurations={project.configurations} />
      <section data-pages className="flex min-h-0 flex-col gap-3 p-4">
        {preview.kind === 'page' && entry !== null ? (
          <>
            <PageBar
              entry={entry}
              defaultFrame={preview.defaultFrame}
              onOpenDialog={onOpenDialog}
              onCreateFrame={() => void onCreateFrame()}
            />
            <GenerationBanner configurationKey={entry.key} hasPage />
            <PageFrame address={preview.address} version={preview.version} width={width} />
            <PageProblems problems={preview.problems} onOpen={onShowFragmentAt} />
          </>
        ) : (
          <div data-page-empty className="max-w-prose space-y-3 text-sm text-muted-foreground">
            {preview.kind === 'no-page' ? (
              <>
                <p>
                  Este projeto ainda não tem página. Ela é montada a partir dos fragmentos HTML:
                  vincule um arquivo <code>.html</code> a uma feature, e cada configuração ganha uma
                  página com as seções das features selecionadas.
                </p>
                <Button size="sm" onClick={onNewFragment}>
                  <FilePlus2 /> Novo fragmento
                </Button>
              </>
            ) : preview.kind === 'blocked' && resolution !== null ? (
              <p>
                A página aparece quando a configuração estiver completa.{' '}
                {generationBlockedReason(resolution)}
              </p>
            ) : preview.kind === 'idle' || (preview.kind === 'page' && entry === null) ? (
              <p>Montando a página…</p>
            ) : (
              <p>
                {project.configurations.length === 0
                  ? 'Crie uma configuração na aba Configurações para ver a página dela.'
                  : 'Escolha uma configuração à esquerda.'}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
