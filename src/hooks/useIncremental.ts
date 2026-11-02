import { useEffect, useRef, useState } from 'react'

/**
 * Pinta una lista larga poco a poco: muestra `paso` elementos y añade más al acercarse al final.
 * Evita renderizar los ~900 ejercicios de golpe.
 */
export function useIncremental<T>(lista: readonly T[], paso = 40) {
  const [cuantos, setCuantos] = useState(paso)
  const centinela = useRef<HTMLDivElement>(null)

  useEffect(() => setCuantos(paso), [lista, paso])

  useEffect(() => {
    const el = centinela.current
    if (!el) return
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setCuantos((c) => c + paso)
    }, { rootMargin: '600px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [paso, lista])

  return { visibles: lista.slice(0, cuantos), hayMas: cuantos < lista.length, centinela }
}
