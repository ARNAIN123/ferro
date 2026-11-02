// Consultas de solo lectura para resúmenes, historial y estadísticas.
import type { SerieHecha } from '../domain/marcas'
import { recordsDeSesion, type RecordSesion } from '../domain/marcas'
import { resumirSesion, type ResumenSesion } from '../domain/resumen'
import type { Ejercicio, Molestia, Serie, Sesion, SesionEjercicio } from '../domain/tipos'
import { db } from './db'

export const aSerieHecha = (s: Serie): SerieHecha => ({
  sesionId: s.sesionId,
  ejercicioId: s.ejercicioId,
  tipo: s.tipo,
  peso: s.peso,
  reps: s.reps,
  hora: s.hora ?? 0,
})

export async function sesionesTerminadas(): Promise<Sesion[]> {
  return (await db.sesiones.where('estado').equals('terminada').toArray()).sort((a, b) => b.entrada - a.entrada)
}

export interface DetalleSesion {
  sesion: Sesion
  bloques: { se: SesionEjercicio; ejercicio: Ejercicio | undefined; series: Serie[]; molestia: Molestia | undefined }[]
  resumen: ResumenSesion
}

export async function detalleSesion(sesionId: string): Promise<DetalleSesion | null> {
  const sesion = await db.sesiones.get(sesionId)
  if (!sesion) return null
  const [lista, series, molestias] = await Promise.all([
    db.sesionEjercicios.where('sesionId').equals(sesionId).sortBy('orden'),
    db.series.where('sesionId').equals(sesionId).toArray(),
    db.molestias.where('sesionId').equals(sesionId).toArray(),
  ])
  const fichas = await db.ejercicios.bulkGet(lista.map((l) => l.ejercicioId))
  const bloques = lista
    .map((se, i) => ({
      se,
      ejercicio: fichas[i],
      series: series.filter((s) => s.sesionEjercicioId === se.id && s.completada).sort((a, b) => a.orden - b.orden),
      molestia: molestias.find((m) => m.ejercicioId === se.ejercicioId),
    }))
    .filter((b) => b.series.length > 0 || b.molestia)
  return { sesion, bloques, resumen: resumirSesion(sesion, series) }
}

export interface DatosResumen extends DetalleSesion {
  records: RecordSesion[]
  anterior: ResumenSesion | null
  nombres: Map<string, string>
}

/** Resumen al terminar: récords frente a todo lo anterior y comparación con la última vez de la misma rutina. */
export async function datosResumen(sesionId: string): Promise<DatosResumen | null> {
  const detalle = await detalleSesion(sesionId)
  if (!detalle) return null
  const { sesion } = detalle
  const anteriores = (await sesionesTerminadas()).filter((s) => s.id !== sesion.id && s.entrada < sesion.entrada)
  const idsAnteriores = new Set(anteriores.map((s) => s.id))

  const seriesSesion = detalle.bloques.flatMap((b) => b.series)
  const ejercicioIds = [...new Set(seriesSesion.map((s) => s.ejercicioId))]
  const previas = (await db.series.where('ejercicioId').anyOf(ejercicioIds).toArray()).filter(
    (s) => s.completada && idsAnteriores.has(s.sesionId),
  )
  const records = recordsDeSesion(seriesSesion.map(aSerieHecha), previas.map(aSerieHecha))

  const ultimaMisma = sesion.rutinaId ? anteriores.find((s) => s.rutinaId === sesion.rutinaId) : undefined
  const anterior = ultimaMisma
    ? resumirSesion(ultimaMisma, await db.series.where('sesionId').equals(ultimaMisma.id).toArray())
    : null

  const nombres = new Map(detalle.bloques.map((b) => [b.se.ejercicioId, b.ejercicio?.nombre ?? '']))
  return { ...detalle, records, anterior, nombres }
}

export interface EntradaHistorial {
  sesion: Sesion
  series: Serie[]
  molestia: Molestia | undefined
}

/** Historial completo de un ejercicio, de lo más reciente a lo más antiguo. */
export async function historialEjercicio(ejercicioId: string): Promise<EntradaHistorial[]> {
  const [series, molestias] = await Promise.all([
    db.series.where('ejercicioId').equals(ejercicioId).filter((s) => s.completada).toArray(),
    db.molestias.where('ejercicioId').equals(ejercicioId).toArray(),
  ])
  const sesionIds = [...new Set([...series.map((s) => s.sesionId), ...molestias.map((m) => m.sesionId)])]
  const sesiones = (await db.sesiones.bulkGet(sesionIds)).filter((s): s is Sesion => !!s && s.estado === 'terminada')
  return sesiones
    .map((sesion) => ({
      sesion,
      series: series.filter((s) => s.sesionId === sesion.id).sort((a, b) => a.orden - b.orden),
      molestia: molestias.find((m) => m.sesionId === sesion.id),
    }))
    .sort((a, b) => b.sesion.entrada - a.sesion.entrada)
}
