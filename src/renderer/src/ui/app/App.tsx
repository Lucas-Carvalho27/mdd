import { ProjectScreen } from '@/ui/screens/project/ProjectScreen'
import { StartScreen } from '@/ui/screens/start/StartScreen'
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
  return session === null ? <StartScreen /> : <ProjectScreen session={session} />
}
