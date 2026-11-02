import { useEffect } from 'react'
import type { Tema } from '../domain/tipos'

const COLOR_BARRA = { oscuro: '#11100e', claro: '#f5f2ec' } as const

/** Aplica el tema al <html> y lo recuerda en localStorage para pintarlo antes de arrancar React. */
export function useTema(tema: Tema) {
  useEffect(() => {
    const consulta = matchMedia('(prefers-color-scheme: light)')
    const aplicar = () => {
      const efectivo = tema === 'sistema' ? (consulta.matches ? 'claro' : 'oscuro') : tema
      document.documentElement.dataset.theme = efectivo
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[efectivo])
    }
    aplicar()
    try {
      localStorage.setItem('ferro-tema', tema)
    } catch {
      // Sin localStorage el tema se aplica igual tras cargar.
    }
    if (tema !== 'sistema') return
    consulta.addEventListener('change', aplicar)
    return () => consulta.removeEventListener('change', aplicar)
  }, [tema])
}
