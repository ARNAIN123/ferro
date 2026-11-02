// Estadísticas de progreso: asistencia, series por músculo, evolución por ejercicio y peso corporal.
import { epley } from './marcas'
import { claveDia, inicioSemana, sumarDias } from './semanas'
import type { TipoSerie } from './tipos'

/** Franja de referencia de series semanales por grupo muscular. */
export const FRANJA_SERIES = { min: 10, max: 20 } as const

export type NivelAsistencia = 0 | 1 | 2

export interface CeldaCalor {
  clave: string
  inicio: number
  nivel: NivelAsistencia
  futuro: boolean
}

/**
 * Mapa de calor estilo GitHub: columnas = semanas (lunes arriba), de la más antigua a la actual.
 * Nivel 1 = fui al gimnasio (entrada), nivel 2 = entrené.
 */
export function mapaCalor(entradas: readonly number[], entrenos: readonly number[], ahora: number, semanas = 18): CeldaCalor[][] {
  const nivel = new Map<string, NivelAsistencia>()
  for (const t of entradas) nivel.set(claveDia(t), Math.max(nivel.get(claveDia(t)) ?? 0, 1) as NivelAsistencia)
  for (const t of entrenos) nivel.set(claveDia(t), 2)
  const hoy = claveDia(ahora)
  const primera = sumarDias(inicioSemana(ahora), -7 * (semanas - 1))
  return Array.from({ length: semanas }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const inicio = sumarDias(primera, w * 7 + d)
      const clave = claveDia(inicio)
      return { clave, inicio, nivel: nivel.get(clave) ?? 0, futuro: clave > hoy }
    }),
  )
}

/** Días entrenados en cada una de las últimas `semanas` semanas (de la más antigua a la actual). */
export function asistenciaPorSemana(entrenos: readonly number[], ahora: number, semanas = 12): { inicio: number; dias: number }[] {
  const porSemana = new Map<number, Set<string>>()
  for (const t of entrenos) {
    const s = inicioSemana(t)
    porSemana.set(s, (porSemana.get(s) ?? new Set()).add(claveDia(t)))
  }
  const actual = inicioSemana(ahora)
  return Array.from({ length: semanas }, (_, i) => {
    const inicio = inicioSemana(sumarDias(actual, -7 * (semanas - 1 - i)))
    return { inicio, dias: porSemana.get(inicio)?.size ?? 0 }
  })
}

export function duracionMedia(sesiones: readonly { entrada: number; salida: number | null }[]): number | null {
  const validas = sesiones.filter((s) => s.salida !== null && s.salida > s.entrada)
  if (validas.length === 0) return null
  return validas.reduce((t, s) => t + (s.salida! - s.entrada), 0) / validas.length
}

export interface PuntoEjercicio {
  sesionId: string
  fecha: number
  e1rm: number
  volumen: number
  mejor: { peso: number; reps: number }
}

/** Evolución de un ejercicio por sesión (cronológica): 1RM estimado, volumen y mejor serie. */
export function evolucionEjercicio(
  series: readonly { sesionId: string; tipo: TipoSerie; peso: number; reps: number }[],
  fechas: ReadonlyMap<string, number>,
): PuntoEjercicio[] {
  const porSesion = new Map<string, PuntoEjercicio>()
  for (const s of series) {
    if (s.tipo === 'calentamiento' || s.reps <= 0) continue
    const fecha = fechas.get(s.sesionId)
    if (fecha === undefined) continue
    const p = porSesion.get(s.sesionId) ?? { sesionId: s.sesionId, fecha, e1rm: 0, volumen: 0, mejor: { peso: 0, reps: 0 } }
    const e = epley(s.peso, s.reps)
    if (e > p.e1rm) {
      p.e1rm = e
      p.mejor = { peso: s.peso, reps: s.reps }
    }
    p.volumen += s.peso * s.reps
    porSesion.set(s.sesionId, p)
  }
  return [...porSesion.values()].sort((a, b) => a.fecha - b.fecha)
}

export interface PuntoPeso {
  fecha: string
  kg: number
  media: number
}

/** Media móvil de 7 días naturales (incluye el propio día y los 6 anteriores con registro). */
export function mediaMovil(registros: readonly { fecha: string; kg: number }[], dias = 7): PuntoPeso[] {
  const orden = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const aTiempo = (f: string) => {
    const [a, m, d] = f.split('-').map(Number)
    return new Date(a!, m! - 1, d!).getTime()
  }
  return orden.map((r, i) => {
    const limite = claveDia(sumarDias(aTiempo(r.fecha), -(dias - 1)))
    const ventana = orden.slice(0, i + 1).filter((x) => x.fecha >= limite)
    const media = ventana.reduce((t, x) => t + x.kg, 0) / ventana.length
    return { fecha: r.fecha, kg: r.kg, media: Math.round(media * 100) / 100 }
  })
}
