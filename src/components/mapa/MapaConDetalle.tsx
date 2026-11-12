import { useState } from 'react'
import type { TrabajoMuscular } from '../../domain/mapaMuscular'
import { INFO_MUSCULO } from '../../domain/musculos'
import type { Musculo } from '../../domain/tipos'
import { fmtKg, plural } from '../../lib/formato'
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

/** Mapa muscular con leyenda; al tocar un músculo se abre su ficha debajo. */
export function MapaConDetalle({ trabajo, niveles, nombres, rotulos, unidad, periodo, alto = 'h-80' }: Props) {
  const [sel, setSel] = useState<Musculo | null>(null)
  const describir = (m: Musculo) => {
    const s = trabajo.get(m)?.series ?? 0
    return `${INFO_MUSCULO[m].nombre}: ${s ? `${fmtKg(s)} ${plural(s, 'serie')}` : 'sin trabajar'}`
  }

  return (
    <div>
      <MapaMuscular niveles={niveles} seleccionado={sel} onTocar={(m) => setSel(sel === m ? null : m)} describir={describir} className={alto} />
      <div className="mt-2">
        <LeyendaMapa rotulos={rotulos} unidad={unidad} />
      </div>
      <FichaMusculo sel={sel} trabajo={trabajo} nombres={nombres} periodo={periodo} alElegir={setSel} />
    </div>
  )
}

interface PropsFicha {
  sel: Musculo | null
  trabajo: ReadonlyMap<Musculo, TrabajoMuscular>
  nombres: ReadonlyMap<string, string>
  periodo: string
  alElegir: (m: Musculo | null) => void
}

/** Ficha de un músculo: sus series en el periodo y los ejercicios que lo han trabajado. */
export function FichaMusculo({ sel, trabajo, nombres, periodo, alElegir }: PropsFicha) {
  const t = sel ? trabajo.get(sel) : undefined

  return (
    <div className="mt-3 min-h-16 rounded-2xl bg-surface-2 px-4 py-3" aria-live="polite">
      {!sel ? (
        <p className="text-sm text-muted">Toca un músculo para ver su ficha: sus series y qué ejercicios lo han trabajado.</p>
      ) : (
        <>
          <p className="flex items-baseline justify-between gap-2">
            <span className="font-bold">{INFO_MUSCULO[sel].nombre}</span>
            <span className="ml-auto shrink-0 text-sm text-muted">
              {t ? (
                <>
                  <span className="num text-lg text-fg">{fmtKg(t.series)}</span> {plural(t.series, 'serie')} {periodo}
                </>
              ) : (
                `Sin trabajar ${periodo}`
              )}
            </span>
            <button type="button" onClick={() => alElegir(null)} aria-label="Cerrar la ficha" className="-my-2 -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-lg leading-none text-muted active:bg-surface">
              ×
            </button>
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
  )
}
