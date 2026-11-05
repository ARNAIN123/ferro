// Objetivo mensual: días al mes que voy al gimnasio. Sustituye a la racha y al objetivo semanal.
import { claveDia, inicioDia, sumarDias } from './semanas'

export const OBJETIVO_MENSUAL_POR_DEFECTO = 16

/** Días que cuentan: los que tienen una entrada registrada o un entreno terminado (uno por día). */
export function diasQueCuentan(entradas: readonly number[], entrenosTerminados: readonly number[]): Set<string> {
  return new Set([...entradas, ...entrenosTerminados].map(claveDia))
}

/** Día 1 del mes de `t` a las 00:00. */
export function inicioMes(t: number): number {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

/** Día 1 del mes siguiente al de `t`. */
export function inicioMesSiguiente(t: number): number {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
}

export function diasDelMes(t: number): number {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export type SituacionMes = 'cumplido' | 'posible' | 'imposible'

export interface EstadoMes {
  /** Día 1 del mes a las 00:00. */
  inicio: number
  diasDelMes: number
  objetivo: number
  /** Días que ya cuentan este mes (hasta hoy incluido). */
  hechos: number
  /** Días que faltan para el objetivo (0 si ya está cumplido). */
  faltan: number
  /** Días del mes en los que todavía puedo ir: los que quedan y hoy, si aún no he ido. */
  disponibles: number
  /** Días que me puedo saltar y seguir cumpliendo (disponibles − faltan). Negativo si ya no es posible. */
  margen: number
  /** Días por encima del objetivo. */
  extra: number
  situacion: SituacionMes
}

/** Cómo va el mes de `ahora` con el objetivo dado. */
export function estadoMes(dias: ReadonlySet<string>, objetivo: number, ahora: number): EstadoMes {
  const inicio = inicioMes(ahora)
  const total = diasDelMes(ahora)
  const hoy = inicioDia(ahora)
  const claveHoy = claveDia(hoy)

  let hechos = 0
  for (let i = 0; i < total; i++) {
    const clave = claveDia(sumarDias(inicio, i))
    if (clave > claveHoy) break
    if (dias.has(clave)) hechos++
  }
  const diaDelMes = new Date(hoy).getDate()
  const despuesDeHoy = total - diaDelMes
  const disponibles = despuesDeHoy + (dias.has(claveHoy) ? 0 : 1)
  const faltan = Math.max(0, objetivo - hechos)
  const margen = disponibles - faltan

  return {
    inicio,
    diasDelMes: total,
    objetivo,
    hechos,
    faltan,
    disponibles,
    margen,
    extra: Math.max(0, hechos - objetivo),
    situacion: faltan === 0 ? 'cumplido' : margen >= 0 ? 'posible' : 'imposible',
  }
}

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`

/** Mensaje de la tarjeta de Hoy. */
export function mensajeMes(e: EstadoMes): string {
  if (e.situacion === 'cumplido') return e.extra > 0 ? `Objetivo cumplido · ${dias(e.extra)} extra` : 'Objetivo cumplido'
  if (e.situacion === 'posible')
    return e.margen === 0
      ? 'No puedes saltarte ningún día más'
      : `Puedes saltarte ${dias(e.margen)} más y seguir cumpliéndolo`
  const faltan = `${e.faltan === 1 ? 'te falta' : 'te faltan'} ${dias(e.faltan)}`
  const quedan = e.disponibles === 0 ? 'no queda ninguno' : `${e.disponibles === 1 ? 'queda' : 'quedan'} ${e.disponibles}`
  return `Este mes ya no es posible: ${faltan} y ${quedan}`
}

export interface MesHistorial {
  inicio: number
  hechos: number
  objetivo: number
  cumplido: boolean
  /** El mes actual: todavía no está cerrado. */
  enCurso: boolean
}

/**
 * Historial de meses, del más reciente al más antiguo, desde el mes de `desde` hasta el actual
 * (como mucho `maximo` meses). Se mide con el objetivo actual.
 */
export function historialMensual(
  dias: ReadonlySet<string>,
  objetivo: number,
  ahora: number,
  desde: number,
  maximo = 12,
): MesHistorial[] {
  const porMes = new Map<string, number>()
  const claveHoy = claveDia(ahora)
  for (const d of dias) if (d <= claveHoy) porMes.set(d.slice(0, 7), (porMes.get(d.slice(0, 7)) ?? 0) + 1)

  const primero = inicioMes(Math.min(desde, ahora))
  const meses: MesHistorial[] = []
  for (let m = inicioMes(ahora); m >= primero && meses.length < maximo; m = inicioMes(m - 1)) {
    const hechos = porMes.get(claveDia(m).slice(0, 7)) ?? 0
    meses.push({ inicio: m, hechos, objetivo, cumplido: hechos >= objetivo, enCurso: meses.length === 0 })
  }
  return meses
}
