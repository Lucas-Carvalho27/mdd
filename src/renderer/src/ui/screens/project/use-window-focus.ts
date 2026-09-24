import { useEffect } from 'react'

/** Chama `onFocus` quando a janela do app volta a ter o foco (por exemplo, vindo do Explorer). */
export function useWindowFocus(onFocus: () => void): void {
  useEffect(() => {
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [onFocus])
}
