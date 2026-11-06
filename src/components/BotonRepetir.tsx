import { useEffect, useRef, type ReactNode } from 'react'
import { intervaloRepeticion } from '../domain/regla'

interface Props {
  accion: () => void
  etiqueta: string
  children: ReactNode
  className?: string
}

/** Botón que repite su acción mientras se mantiene pulsado, cada vez más rápido. */
export function BotonRepetir({ accion, etiqueta, children, className = '' }: Props) {
  const temporizador = useRef<number | null>(null)
  const ultimaAccion = useRef(accion)
  useEffect(() => {
    ultimaAccion.current = accion
  })
  useEffect(() => () => parar(), [])

  const parar = () => {
    if (temporizador.current !== null) window.clearTimeout(temporizador.current)
    temporizador.current = null
  }

  const empezar = () => {
    parar()
    const inicio = performance.now()
    ultimaAccion.current()
    const siguiente = () => {
      temporizador.current = window.setTimeout(() => {
        ultimaAccion.current()
        siguiente()
      }, intervaloRepeticion(performance.now() - inicio))
    }
    siguiente()
  }

  return (
    <button
      type="button"
      aria-label={etiqueta}
      onPointerDown={(e) => {
        e.preventDefault()
        empezar()
      }}
      onPointerUp={parar}
      onPointerLeave={parar}
      onPointerCancel={parar}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          ultimaAccion.current()
        }
      }}
      className={`grid min-h-12 touch-none place-items-center rounded-2xl bg-surface-2 font-semibold select-none active:bg-line ${className}`}
    >
      {children}
    </button>
  )
}
