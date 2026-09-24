import { openConfigurationEntry } from '@/ui/stores/project-store'
import { useProjectStore } from '@/ui/stores/project-store-context'
import { statusText } from './configuration-texts'

/** Barra de status da aba Configurações: o estado calculado da configuração aberta (SPEC §7). */
export function ConfigurationStatusBar(): React.JSX.Element {
  const entry = useProjectStore(openConfigurationEntry)
  const resolution = useProjectStore((state) => state.openResolution())
  const count = useProjectStore((state) => state.session?.project.configurations.length ?? 0)

  if (entry === null || resolution === null) return <span>{count} configurações</span>
  return (
    <span>
      {entry.configuration.name}: {statusText(resolution)}
    </span>
  )
}
