import { useState } from 'react'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import type { TrabajoMuscular } from '../../domain/mapaMuscular'
import type { Musculo } from '../../domain/tipos'
import { fmtKg } from '../../lib/formato'
import { LeyendaMapa, MapaMuscular } from './MapaMuscular'

interface Props {
  trabajo: ReadonlyMap<Musculo, TrabajoMuscular>
  niveles: ReadonlyMap<Musculo, number>
  /** Nombre de cada ejercicio para el detalle al tocar un músculo. */
  nombres: ReadonlyMap<string, string>
  rotulos?: string[]
  unidad?: string
  /** Texto del periodo para el detalle ("esta semana", "en esta sesión"…). */
  periodo: string
  alto?: string
}

/** Mapa muscular con leyenda; al tocar un músculo muestra sus series y qué ejercicios lo trabajaron. */
export function MapaConDetalle({ trabajo, niveles, nombres, rotulos, unidad, periodo, alto = 'h-80' }: Props) {
  const [sel, setSel] = useState<Musculo | null>(null)
  const t = sel ? trabajo.get(sel) : undefined
  const describir = (m: Musculo) => {
    const s = trabajo.get(m)?.series ?? 0
    return `${NOMBRE_MUSCULO[m]}: ${s ? `${fmtKg(s)} series` : 'sin trabajar'}`
  }

  return (
    <div>
      <MapaMuscular niveles={niveles} seleccionado={sel} onTocar={(m) => setSel(sel === m ? null : m)} describir={describir} className={alto} />
      <div className="mt-2">
        <LeyendaMapa rotulos={rotulos} unidad={unidad} />
      </div>
      <div className="mt-3 min-h-16 rounded-2xl bg-surface-2 px-4 py-3" aria-live="polite">
        {!sel ? (
          <p className="text-sm text-muted">Toca un músculo para ver sus series y qué ejercicios lo han trabajado.</p>
        ) : (
          <>
            <p className="flex items-baseline justify-between gap-2">
              <span className="font-bold">{NOMBRE_MUSCULO[sel]}</span>
              <span className="text-sm text-muted">
                {t ? (
                  <>
                    <span className="num text-lg text-fg">{fmtKg(t.series)}</span> series {periodo}
                  </>
                ) : (
                  `Sin trabajar ${periodo}`
                )}
              </span>
            </p>
            {t && (
              <ul className="mt-1.5 space-y-0.5 text-sm">
                {[...t.porEjercicio]
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, n]) => (
                    <li key={id} className="flex justify-between gap-3">
                      <span className="truncate text-muted">{nombres.get(id) ?? 'Ejercicio'}</span>
                      <span className="num shrink-0">{fmtKg(n)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
