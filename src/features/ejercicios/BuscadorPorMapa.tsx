import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, type ReactNode } from 'react'
import { MiniaturaEjercicio } from '../../components/animacion/AnimacionEjercicio'
import { MapaMuscular } from '../../components/mapa/MapaMuscular'
import { db } from '../../db/db'
import { contarUsos, ejerciciosDeMusculo } from '../../domain/biblioteca'
import { NOMBRE_MATERIAL, NOMBRE_MUSCULO } from '../../domain/etiquetas'
import type { Ejercicio, Musculo } from '../../domain/tipos'

interface Props {
  musculo: Musculo | null
  onMusculo: (m: Musculo | null) => void
  /** Ejercicios que no deben salir (p. ej. los que ya están en la rutina). */
  excluir?: readonly string[]
  /** Envoltorio de cada fila (enlace a la ficha o botón de selección) y lo que va a su derecha. */
  fila: (e: Ejercicio, contenido: ReactNode) => ReactNode
  altoMapa?: string
}

/**
 * El único buscador de ejercicios: la figura → toco un músculo → dos listas, "Principal" (su músculo
 * principal es ese) y "También lo trabajan" (lo tienen como secundario). Primero los que más uso.
 */
export function BuscadorPorMapa({ musculo, onMusculo, excluir = [], fila, altoMapa = 'h-72' }: Props) {
  const datos = useLiveQuery(async () => {
    const [ejercicios, enEntrenos, enRutinas] = await Promise.all([db.ejercicios.toArray(), db.sesionEjercicios.toArray(), db.rutinaEjercicios.toArray()])
    return { ejercicios, usos: contarUsos(enEntrenos, enRutinas) }
  }, [])
  const listas = useMemo(() => {
    if (!datos || !musculo) return null
    const fuera = new Set(excluir)
    return ejerciciosDeMusculo(
      datos.ejercicios.filter((e) => !fuera.has(e.id)),
      musculo,
      datos.usos,
    )
  }, [datos, musculo, excluir])

  return (
    <div>
      <MapaMuscular
        niveles={musculo ? new Map([[musculo, 5]]) : new Map()}
        seleccionado={musculo}
        onTocar={(m) => onMusculo(m === musculo ? null : m)}
        className={altoMapa}
      />
      {!musculo ? (
        <p className="mt-2 text-center text-sm text-muted">Toca un músculo para ver sus ejercicios. Arrastra para ver la espalda.</p>
      ) : (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="condensada text-2xl font-extrabold">{NOMBRE_MUSCULO[musculo]}</h3>
            <button type="button" onClick={() => onMusculo(null)} className="min-h-10 px-2 text-sm font-medium text-muted">
              Cambiar músculo
            </button>
          </div>
          {listas && (
            <>
              <Seccion titulo="Principal" lista={listas.principal} fila={fila} vacio="Ningún ejercicio lo trabaja como principal." />
              <Seccion titulo="También lo trabajan" lista={listas.tambien} fila={fila} vacio="Ninguno lo trabaja como secundario." />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Seccion({ titulo, lista, fila, vacio }: { titulo: string; lista: Ejercicio[]; fila: Props['fila']; vacio: string }) {
  return (
    <section className="mt-3">
      <h4 className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
        {titulo} <span className="num font-normal">{lista.length}</span>
      </h4>
      {lista.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">{vacio}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {lista.map((e) => (
            <li key={e.id}>
              {fila(
                e,
                <>
                  <MiniaturaEjercicio ejercicio={e} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 leading-snug font-semibold">{e.nombre}</span>
                    <span className="mt-0.5 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                      {NOMBRE_MATERIAL[e.material]}
                      {e.personalizado && ' · Propio'}
                    </span>
                  </span>
                </>,
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
