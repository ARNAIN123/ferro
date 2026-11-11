import type { ReactNode } from 'react'
import { INFO_MUSCULO } from '../../domain/musculos'
import type { Musculo } from '../../domain/tipos'

interface Props {
  titulo: string
  lista: readonly Musculo[]
  alElegir: (m: Musculo) => void
  /** Lo que acompaña al nombre (sus series, «principal»…). */
  detalle?: (m: Musculo) => ReactNode
  activo?: (m: Musculo) => boolean
  className?: string
}

/**
 * Fila de músculos para elegirlos sin tocar el cuerpo: las otras porciones de un músculo, los
 * profundos (que están dentro y no se pueden tocar hasta que se resaltan), los de encima…
 */
export function EnlacesMusculos({ titulo, lista, alElegir, detalle, activo, className = 'mt-2' }: Props) {
  if (lista.length === 0) return null
  return (
    <p className={`flex flex-wrap items-center gap-1.5 text-xs text-muted ${className}`}>
      <span>{titulo}</span>
      {lista.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => alElegir(m)}
          aria-pressed={activo ? activo(m) : undefined}
          className={`min-h-8 rounded-full border px-2.5 font-medium ${activo?.(m) ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg active:bg-surface'}`}
        >
          {INFO_MUSCULO[m].corto}
          {detalle?.(m)}
        </button>
      ))}
    </p>
  )
}
