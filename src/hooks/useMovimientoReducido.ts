import { useSyncExternalStore } from 'react'

const consulta = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-reduced-motion: reduce)')
const suscribir = (aviso: () => void) => {
  consulta?.addEventListener('change', aviso)
  return () => consulta?.removeEventListener('change', aviso)
}

/** ¿Ha pedido el sistema reducir el movimiento? */
export const useMovimientoReducido = () => useSyncExternalStore(suscribir, () => consulta?.matches ?? false)
