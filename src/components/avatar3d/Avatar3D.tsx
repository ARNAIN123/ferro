import { useEffect, useRef, useState } from 'react'
import { musculoDeRegionAvatar, NO_MUSCULO, nivelesPorRegionAvatar } from '../../domain/avatar'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { MUSCULOS, type Musculo } from '../../domain/tipos'
import { useAjustes } from '../../hooks/useAjustes'
import { Avatar } from '../avatar/Avatar'
import { construirCuerpo, type Cuerpo } from './construirCuerpo'
import { crearMotor, type Motor, type Paleta } from './motor'

interface Props {
  /** Nivel 0–5 de cada músculo. */
  niveles: ReadonlyMap<Musculo, number>
  seleccionado?: Musculo | null
  onTocar?: (m: Musculo) => void
  /** Texto accesible de cada músculo (por defecto, su nombre). */
  describir?: (m: Musculo) => string
  className?: string
}

// El cuerpo se construye una sola vez y lo comparten todos los avatares.
let cuerpo: Cuerpo | null = null

const leerPaleta = (): Paleta => {
  const css = getComputedStyle(document.documentElement)
  const v = (n: string) => css.getPropertyValue(n).trim()
  return { musculo: v('--avatar-musculo'), piel: v('--avatar-piel'), tendon: v('--avatar-tendon'), acento: v('--accent') }
}

/**
 * Avatar muscular en 3D: se gira arrastrando con el dedo y un toque corto elige el músculo.
 * Los músculos trabajados se tiñen del color de acento según su nivel. Si el móvil no tiene
 * WebGL, se muestra el avatar 2D.
 */
export function Avatar3D({ niveles, seleccionado, onTocar, describir, className = '' }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const motor = useRef<Motor | null>(null)
  const [sinWebgl, setSinWebgl] = useState(false)
  const [lado, setLado] = useState<'frente' | 'espalda'>('frente')
  const { tema } = useAjustes()
  const tocar = useRef(onTocar)
  tocar.current = onTocar

  useEffect(() => {
    if (!lienzo.current) return
    try {
      cuerpo ??= construirCuerpo()
      const m = crearMotor(lienzo.current, cuerpo, (r) => {
        const musculo = musculoDeRegionAvatar(r)
        if (musculo) tocar.current?.(musculo)
      })
      motor.current = m
      return () => {
        m.destruir()
        motor.current = null
      }
    } catch {
      setSinWebgl(true)
      return undefined
    }
  }, [])

  useEffect(() => {
    const porRegion = nivelesPorRegionAvatar(niveles)
    // Se lee la paleta en el siguiente fotograma: así ya está aplicado el cambio de tema.
    const f = requestAnimationFrame(() =>
      motor.current?.pintar(
        (r) => porRegion.get(r) ?? 0,
        (r) => NO_MUSCULO.has(r),
        (r) => seleccionado != null && musculoDeRegionAvatar(r) === seleccionado,
        leerPaleta(),
      ),
    )
    return () => cancelAnimationFrame(f)
  }, [niveles, seleccionado, tema])

  if (sinWebgl) return <Avatar niveles={niveles} seleccionado={seleccionado} onTocar={onTocar} describir={describir} className={className} />

  const girar = (l: 'frente' | 'espalda') => {
    setLado(l)
    motor.current?.girarA(l === 'frente' ? 0 : Math.PI)
  }

  return (
    // Sin alto propio, la figura toma una proporción de 4:5; con un alto (h-80…), lo llena.
    <div className={`relative aspect-[4/5] w-full ${className}`}>
      <canvas
        ref={lienzo}
        className="absolute inset-0 block h-full w-full touch-pan-y select-none"
        aria-label="Avatar muscular en 3D. Arrastra en horizontal para girarlo."
        role="img"
      />
      <div className="absolute right-0 bottom-0 flex gap-1 rounded-full bg-surface-2/80 p-1 text-xs font-semibold backdrop-blur">
        {(['frente', 'espalda'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => girar(l)}
            aria-pressed={lado === l}
            className={`min-h-9 rounded-full px-3 ${lado === l ? 'bg-accent text-accent-ink' : 'text-muted'}`}
          >
            {l === 'frente' ? 'Frente' : 'Espalda'}
          </button>
        ))}
      </div>
      {/* Para lectores de pantalla y teclado: los músculos como botones. */}
      {onTocar && (
        <ul className="sr-only">
          {MUSCULOS.map((m) => (
            <li key={m}>
              <button type="button" aria-pressed={seleccionado === m} onClick={() => onTocar(m)}>
                {describir?.(m) ?? NOMBRE_MUSCULO[m]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
