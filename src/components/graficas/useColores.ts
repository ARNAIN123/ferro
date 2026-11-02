import { useEffect, useState } from 'react'

export interface Colores {
  acento: string
  texto: string
  tenue: string
  linea: string
  superficie: string
  superficie2: string
}

function leer(): Colores {
  const css = getComputedStyle(document.documentElement)
  const v = (n: string) => css.getPropertyValue(n).trim()
  return {
    acento: v('--accent'),
    texto: v('--text'),
    tenue: v('--muted'),
    linea: v('--line'),
    superficie: v('--surface'),
    superficie2: v('--surface-2'),
  }
}

/** Colores del tema actual para las gráficas SVG (se actualizan al cambiar de tema). */
export function useColores(): Colores {
  const [colores, setColores] = useState(leer)
  useEffect(() => {
    const obs = new MutationObserver(() => setColores(leer()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return colores
}
