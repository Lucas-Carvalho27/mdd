import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { ProjectState, ProjectStore } from './project-store'

/** A composition root (ui/app) fornece a store; as telas só a consomem. */
export const ProjectStoreContext = createContext<ProjectStore | null>(null)

export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  const store = useContext(ProjectStoreContext)
  if (store === null) throw new Error('ProjectStoreContext não foi fornecido.')
  return useStore(store, selector)
}
