import { useId, type KeyboardEvent } from 'react'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { musculoDeRegion, NIVELES, nivelesPorRegion, type RegionMapa } from '../../domain/mapaMuscular'
import type { Musculo } from '../../domain/tipos'
import { ESPALDA, FRENTE, SILUETA_ESPALDA, SILUETA_FRENTE, type ParteMapa } from './trazados'

/** Opacidad del acento para cada nivel (0 = sin trabajar). */
const OPACIDAD = [0, 0.3, 0.48, 0.66, 0.84, 1]
const PIEL = new Set<RegionMapa>(['cabeza', 'manos', 'pies', 'tobillos', 'rodillas', 'tibial'])

interface Props {
  /** Nivel 0–5 de cada músculo. */
  niveles: ReadonlyMap<Musculo, number>
  seleccionado?: Musculo | null
  onTocar?: (m: Musculo) => void
  /** Texto accesible de cada músculo (por defecto, su nombre). */
  describir?: (m: Musculo) => string
  className?: string
  /** Solo la vista frontal (miniaturas). */
  soloFrente?: boolean
}

/**
 * Figura anatómica frontal y trasera en gris neutro, con volumen. Los músculos trabajados
 * se tiñen del color de acento con más intensidad cuanto más se han trabajado.
 */
export function MapaMuscular({ niveles, seleccionado, onTocar, describir, className = '', soloFrente }: Props) {
  const uid = useId().replace(/:/g, '')
  const porRegion = nivelesPorRegion(niveles)
  const vistas = soloFrente
    ? [{ partes: FRENTE, silueta: SILUETA_FRENTE, x: 0, nombre: 'frontal' }]
    : [
        { partes: FRENTE, silueta: SILUETA_FRENTE, x: 0, nombre: 'frontal' },
        { partes: ESPALDA, silueta: SILUETA_ESPALDA, x: 724, nombre: 'trasera' },
      ]

  return (
    <div className={`flex justify-center gap-1 ${className}`}>
      {vistas.map((v) => (
        <svg
          key={v.nombre}
          viewBox={`${v.x + 40} 90 644 1290`}
          className="h-full max-h-full w-auto"
          role="group"
          aria-label={`Vista ${v.nombre} del cuerpo`}
        >
          <defs>
            <radialGradient id={`${uid}-vol`} cx="38%" cy="30%" r="80%">
              <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.4" />
            </radialGradient>
            <linearGradient id={`${uid}-luz`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
              <stop offset="1" stopColor="#000" stopOpacity="0.25" />
            </linearGradient>
            <radialGradient id={`${uid}-suelo`}>
              <stop offset="0" stopColor="#000" stopOpacity="0.38" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx={v.x + 362} cy={1350} rx={190} ry={26} fill={`url(#${uid}-suelo)`} />
          <path d={v.silueta} fill="var(--mapa-pliegue)" />
          <path d={v.silueta} fill={`url(#${uid}-luz)`} />
          {v.partes.map((p) => (
            <Region
              key={p.region}
              parte={p}
              nivel={porRegion.get(p.region) ?? 0}
              seleccionada={seleccionado != null && musculoDeRegion(p.region) === seleccionado}
              volumen={`url(#${uid}-vol)`}
              onTocar={onTocar}
              describir={describir}
            />
          ))}
        </svg>
      ))}
    </div>
  )
}

interface RegionProps {
  parte: ParteMapa
  nivel: number
  seleccionada: boolean
  volumen: string
  onTocar?: (m: Musculo) => void
  describir?: (m: Musculo) => string
}

function Region({ parte, nivel, seleccionada, volumen, onTocar, describir }: RegionProps) {
  const musculo = musculoDeRegion(parte.region)
  const base = parte.region === 'pelo' ? 'var(--mapa-pelo)' : PIEL.has(parte.region) ? 'var(--mapa-piel)' : 'var(--mapa-musculo)'
  const tocable = Boolean(onTocar && musculo)
  const tocar = () => musculo && onTocar?.(musculo)

  return (
    <g
      {...(tocable && {
        role: 'button',
        tabIndex: 0,
        'aria-label': musculo ? (describir?.(musculo) ?? NOMBRE_MUSCULO[musculo]) : undefined,
        'aria-pressed': seleccionada,
        onClick: tocar,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            tocar()
          }
        },
        className: 'cursor-pointer outline-none',
      })}
    >
      {parte.d.map((d, i) => (
        <g key={i}>
          <path d={d} fill={base} />
          {nivel > 0 && <path d={d} fill="var(--accent)" fillOpacity={OPACIDAD[Math.min(nivel, NIVELES)]} />}
          <path d={d} fill={volumen} pointerEvents="none" />
          {seleccionada && <path d={d} fill="none" stroke="var(--text)" strokeWidth={5} pointerEvents="none" />}
        </g>
      ))}
    </g>
  )
}

/** Leyenda pequeña: gris sin trabajar y la escala de 5 niveles. */
export function LeyendaMapa({ rotulos, unidad }: { rotulos?: string[]; unidad?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-muted" aria-label="Leyenda de intensidad">
      <span className="flex items-center gap-1">
        <span className="size-3 rounded-[3px] bg-[var(--mapa-musculo)]" /> Sin trabajar
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
