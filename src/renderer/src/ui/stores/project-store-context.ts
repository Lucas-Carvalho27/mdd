import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { ProjectState, ProjectStore } from './project-store'

/** A composition root (ui/app) fornece a store; as telas só a consomem. */
export const ProjectStoreContext = createContext<ProjectStore | null>(null)

/** Lê uma parte do estado; o componente só renderiza de novo quando essa parte muda. */
export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  return useStore(useProjectStoreApi(), selector)
}

/** A store em si, para ler o estado atual dentro de handlers (atalhos de teclado, por exemplo). */
export function useProjectStoreApi(): ProjectStore {
  const store = useContext(ProjectStoreContext)
  if (store === null) throw new Error('ProjectStoreContext não foi fornecido.')
  return store
}
