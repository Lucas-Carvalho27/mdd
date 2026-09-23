import type { MddApi } from '../shared/ipc'

declare global {
  interface Window {
    mdd: MddApi
  }
}
