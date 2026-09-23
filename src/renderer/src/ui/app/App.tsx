import { useEffect } from 'react'
import { ProjectScreen } from '@/ui/screens/project/ProjectScreen'
import { StartScreen } from '@/ui/screens/start/StartScreen'
import { hasUnsavedChanges } from '@/ui/stores/project-store'
import { ProjectStoreContext, useProjectStore } from '@/ui/stores/project-store-context'
import { createAppStore } from './composition-root'

const store = createAppStore()

export function App(): React.JSX.Element {
  return (
    <ProjectStoreContext.Provider value={store}>
      <CurrentScreen />
    </ProjectStoreContext.Provider>
  )
}

function CurrentScreen(): React.JSX.Element {
  const session = useProjectStore((state) => state.session)
  useWindowTitle()
  return session === null ? <StartScreen /> : <ProjectScreen session={session} />
}

/** "• Loja Online — mdd" quando há alterações não salvas (SPEC §8). */
function useWindowTitle(): void {
  const title = useProjectStore((state) =>
    state.session === null
      ? 'mdd'
      : `${hasUnsavedChanges(state) ? '• ' : ''}${state.session.project.model.name} — mdd`
  )
  useEffect(() => {
    document.title = title
  }, [title])
}
