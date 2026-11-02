import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { historialReciente, ultimasSeriesDe } from '../../db/entreno'
import type { Ejercicio, Molestia, Serie, Sesion, SesionEjercicio } from '../../domain/tipos'

export interface EjercicioVista {
  se: SesionEjercicio
  ejercicio: Ejercicio | undefined
  series: Serie[]
  molestia: Molestia | undefined
  pendientes: number
}

export interface DatosEntreno {
  sesion: Sesion
  ejercicios: EjercicioVista[]
}

/** Entreno en curso con todo lo necesario para pintarlo. `null` si no hay ninguno; `undefined` mientras carga. */
export function useEntreno(): DatosEntreno | null | undefined {
  return useLiveQuery(async () => {
    const sesion = await db.sesiones.where('estado').equals('en_curso').first()
    if (!sesion) return null
    const [lista, series, molestias] = await Promise.all([
      db.sesionEjercicios.where('sesionId').equals(sesion.id).sortBy('orden'),
      db.series.where('sesionId').equals(sesion.id).toArray(),
      db.molestias.where('sesionId').equals(sesion.id).toArray(),
    ])
    const fichas = await db.ejercicios.bulkGet(lista.map((s) => s.ejercicioId))
    const ejercicios = lista.map((se, i): EjercicioVista => {
      const propias = series.filter((s) => s.sesionEjercicioId === se.id).sort((a, b) => a.orden - b.orden)
      return {
        se,
        ejercicio: fichas[i],
        series: propias,
        molestia: molestias.find((m) => m.ejercicioId === se.ejercicioId),
        pendientes: propias.filter((s) => !s.completada).length,
      }
    })
    return { sesion, ejercicios }
  }, [])
}

export interface HistorialEjercicioEnCurso {
  /** Lo que hice la última vez (para mostrarlo y prerrellenar). */
  ultima: Serie[]
  /** Últimas sesiones desde el último reinicio de progresión, de la más reciente a la más antigua. */
  recientes: Serie[][]
}

/** Historial de cada ejercicio de la sesión (sin contar la sesión actual). */
export function useHistorial(
  sesionId: string | undefined,
  ejercicios: { id: string; reinicio?: number }[],
): Map<string, HistorialEjercicioEnCurso> | undefined {
  const clave = ejercicios.map((e) => `${e.id}:${e.reinicio ?? 0}`).join('|')
  return useLiveQuery(async () => {
    const mapa = new Map<string, HistorialEjercicioEnCurso>()
    if (!sesionId) return mapa
    for (const e of ejercicios) {
      if (mapa.has(e.id)) continue
      mapa.set(e.id, {
        ultima: await ultimasSeriesDe(e.id, sesionId),
        recientes: await historialReciente(e.id, sesionId, e.reinicio ?? 0),
      })
    }
    return mapa
  }, [sesionId, clave])
}
