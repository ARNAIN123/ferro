import { useId, type KeyboardEvent } from 'react'
import { musculoDeRegionAvatar, NO_MUSCULO, nivelesPorRegionAvatar } from '../../domain/avatar'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import type { Musculo } from '../../domain/tipos'
import { ESPALDA, FRENTE, type ParteAvatar, type VistaAvatar } from './trazados'

/** Opacidad del acento para cada nivel (0 = sin trabajar). */
const OPACIDAD = [0, 0.32, 0.5, 0.68, 0.85, 1]

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
 * Avatar muscular: figura anatómica frontal y trasera con cada músculo contorneado, sus fibras y
 * un sombreado suave. Los músculos trabajados se tiñen del color de acento, más intenso cuanto
 * más se han trabajado, con una transición suave entre niveles.
 */
export function Avatar({ niveles, seleccionado, onTocar, describir, className = '', soloFrente }: Props) {
  const uid = useId().replace(/:/g, '')
  const porRegion = nivelesPorRegionAvatar(niveles)
  const vistas: [string, VistaAvatar][] = soloFrente ? [['frontal', FRENTE]] : [['frontal', FRENTE], ['trasera', ESPALDA]]

  // Las dos vistas en un solo SVG: así la figura ocupa todo el ancho sin huecos arriba ni abajo.
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg viewBox={cajaDe(vistas.map(([, v]) => v))} className="block h-auto max-h-full w-full" aria-label="Avatar muscular">
        {vistas.map(([nombre, v]) => {
          const id = `${uid}${nombre[0]}`
          return (
            <g key={nombre} role="group" aria-label={`Vista ${nombre} del cuerpo`}>
              <defs>
                <radialGradient id={`${id}-vol`} cx="38%" cy="28%" r="85%">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
                  <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
                  <stop offset="1" stopColor="#000" stopOpacity="0.32" />
                </radialGradient>
                <linearGradient id={`${id}-luz`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
                  <stop offset="1" stopColor="#000" stopOpacity="0.2" />
                </linearGradient>
                {v.partes.map((p, i) => (
                  <clipPath key={i} id={`${id}-c${i}`}>
                    <path d={p.d} />
                  </clipPath>
                ))}
                {v.partes.map((p, i) =>
                  p.recorte ? (
                    <clipPath key={`r${i}`} id={`${id}-r${i}`}>
                      <path d={p.recorte} />
                    </clipPath>
                  ) : null,
                )}
              </defs>
              <path d={v.silueta} fill="var(--avatar-piel)" stroke="var(--avatar-surco)" strokeWidth={3} strokeLinejoin="round" />
              <path d={v.silueta} fill={`url(#${id}-luz)`} />
              {agrupar(v.partes).map(([clave, { musculo, partes }]) => (
                <Grupo
                  key={clave}
                  musculo={musculo}
                  partes={partes}
                  id={id}
                  nivel={porRegion.get(partes[0]!.p.region) ?? 0}
                  seleccionado={musculo !== null && musculo === seleccionado}
                  onTocar={onTocar}
                  describir={describir}
                />
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** viewBox que abarca todas las vistas (la trasera ya viene desplazada a la derecha de la frontal). */
function cajaDe(vistas: VistaAvatar[]): string {
  const x0 = Math.min(...vistas.map((v) => v.caja[0]))
  const y0 = Math.min(...vistas.map((v) => v.caja[1]))
  const x1 = Math.max(...vistas.map((v) => v.caja[0] + v.caja[2]))
  const y1 = Math.max(...vistas.map((v) => v.caja[1] + v.caja[3]))
  return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`
}

type ParteIndexada = { p: ParteAvatar; i: number }

/**
 * Agrupa las partes por músculo de la base de datos (todas sus regiones, izquierda y derecha, son
 * un solo botón); las regiones sin músculo van sueltas. Guarda el índice de cada parte para sus recortes.
 */
function agrupar(partes: ParteAvatar[]): [string, { musculo: Musculo | null; partes: ParteIndexada[] }][] {
  const grupos = new Map<string, { musculo: Musculo | null; partes: ParteIndexada[] }>()
  partes.forEach((p, i) => {
    const musculo = musculoDeRegionAvatar(p.region)
    const clave = musculo ?? `region:${p.region}`
    const g = grupos.get(clave) ?? { musculo, partes: [] }
    g.partes.push({ p, i })
    grupos.set(clave, g)
  })
  return [...grupos]
}

interface GrupoProps {
  musculo: Musculo | null
  partes: ParteIndexada[]
  id: string
  nivel: number
  seleccionado: boolean
  onTocar?: (m: Musculo) => void
  describir?: (m: Musculo) => string
}

function Grupo({ musculo, partes, id, nivel, seleccionado, onTocar, describir }: GrupoProps) {
  const tocable = Boolean(onTocar && musculo)
  const tocar = () => musculo && onTocar?.(musculo)

  return (
    <g
      {...(tocable && {
        role: 'button',
        tabIndex: 0,
        'aria-label': musculo ? (describir?.(musculo) ?? NOMBRE_MUSCULO[musculo]) : undefined,
        'aria-pressed': seleccionado,
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
      {partes.map(({ p, i }) => {
        const tendon = NO_MUSCULO.has(p.region)
        const cuerpo = (
          <>
            {/* Borde invisible que amplía la zona táctil y cubre las rendijas entre músculos. */}
            {tocable && <path d={p.d} fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke" />}
            <path d={p.d} fill={tendon ? 'var(--avatar-tendon)' : 'var(--avatar-musculo)'} />
            {!tendon && (
              <path
                d={p.d}
                fill="var(--accent)"
                style={{ fillOpacity: OPACIDAD[Math.min(nivel, OPACIDAD.length - 1)], transition: 'fill-opacity 450ms ease' }}
                pointerEvents="none"
              />
            )}
            <path d={p.d} fill={`url(#${id}-vol)`} pointerEvents="none" />
            <g clipPath={`url(#${id}-c${i})`} pointerEvents="none">
              {p.fibras && <path d={p.fibras} fill="none" stroke="var(--avatar-fibra)" strokeOpacity={0.17} strokeWidth={1.1} strokeLinecap="round" />}
              <path d={p.d} fill="none" stroke="var(--avatar-fibra)" strokeOpacity={0.32} strokeWidth={7} />
              {p.recorte && <path d={p.recorte} fill="none" stroke="var(--avatar-surco)" strokeOpacity={0.55} strokeWidth={1.3} />}
            </g>
            <path d={p.d} fill="none" stroke="var(--avatar-surco)" strokeWidth={1.8} strokeLinejoin="round" pointerEvents="none" />
            {seleccionado && <path d={p.d} fill="none" stroke="var(--text)" strokeWidth={4} strokeLinejoin="round" pointerEvents="none" />}
          </>
        )
        return p.recorte ? (
          <g key={i} clipPath={`url(#${id}-r${i})`}>
            {cuerpo}
          </g>
        ) : (
          <g key={i}>{cuerpo}</g>
        )
      })}
    </g>
  )
}
