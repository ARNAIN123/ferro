import { lazy, Suspense } from 'react'
import type { Musculo } from '../../domain/tipos'
import { Avatar } from '../avatar/Avatar'

// El cuerpo 3D (three.js) se carga aparte: así las pantallas aparecen al momento y el cuerpo llega después.
const Cuerpo3D = lazy(() => import('../cuerpo3d/Cuerpo3D').then((m) => ({ default: m.Cuerpo3D })))

/** Opacidad del acento para cada nivel (0 = sin trabajar). Igual que en el avatar. */
const OPACIDAD = [0, 0.32, 0.5, 0.68, 0.85, 1]

interface Props {
  /** Nivel 0–5 de cada músculo. */
  niveles: ReadonlyMap<Musculo, number>
  seleccionado?: Musculo | null
  onTocar?: (m: Musculo) => void
  /** Texto accesible de cada músculo (por defecto, su nombre). */
  describir?: (m: Musculo) => string
  className?: string
  /** Miniatura: solo la vista frontal en 2D (en las listas no cabe un visor 3D por fila). */
  soloFrente?: boolean
}

/**
 * El mapa muscular de la app: el cuerpo 3D (se gira con el dedo, se acerca pellizcando y se toca un
 * músculo) en todas las pantallas. Si el móvil no tiene WebGL, el mapa 2D con los mismos niveles.
 */
export function MapaMuscular({ soloFrente, ...props }: Props) {
  if (soloFrente) return <Avatar {...props} soloFrente />
  const plano = <Avatar {...props} />
  return (
    <Suspense fallback={<div className={`aspect-[4/5] w-full ${props.className ?? ''}`} aria-hidden />}>
      <Cuerpo3D {...props} sinWebgl={plano} />
    </Suspense>
  )
}

/** Leyenda pequeña: gris sin trabajar y la escala de 5 niveles. */
export function LeyendaMapa({ rotulos, unidad }: { rotulos?: string[]; unidad?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-muted" aria-label="Leyenda de intensidad">
      <span className="flex items-center gap-1">
        <span className="size-3 rounded-[3px] bg-[var(--avatar-musculo)]" /> Sin trabajar
      </span>
      <span className="mx-1 flex items-center gap-0.5">
        {OPACIDAD.slice(1).map((o, i) => (
          <span key={o} className="flex flex-col items-center gap-0.5">
            <span className="h-3 w-5 rounded-[3px] bg-accent first:rounded-l-md last:rounded-r-md" style={{ opacity: o }} />
            {rotulos && <span className="num text-[10px] leading-none">{rotulos[i]}</span>}
          </span>
        ))}
      </span>
      {unidad ? <span>{unidad}</span> : <span>Más trabajo →</span>}
    </div>
  )
}
