import { useEffect, useState } from 'react'

/**
 * Hora actual que se refresca cada `intervalo` ms mientras `activo`.
 * Solo sirve para repintar: los cálculos siempre parten de horas absolutas.
 */
export function useAhora(intervalo = 1000, activo = true): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!activo) return
    setAhora(Date.now())
    const t = setInterval(() => setAhora(Date.now()), intervalo)
    const alVolver = () => setAhora(Date.now())
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [intervalo, activo])
  return ahora
}
