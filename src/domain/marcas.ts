// 1RM estimado (Epley), mejores series y récords personales.
import type { TipoSerie } from './tipos'

export interface SerieHecha {
  sesionId: string
  ejercicioId: string
  tipo: TipoSerie
  peso: number
  reps: number
  hora: number
}

/** Epley: peso × (1 + reps / 30). Con 1 repetición el 1RM es el propio peso. */
export function epley(peso: number, reps: number): number {
  if (reps <= 0 || peso <= 0) return 0
  if (reps === 1) return peso
  return peso * (1 + reps / 30)
}

/** Las series de calentamiento no cuentan para récords, volumen ni progresión. */
export const esEfectiva = (s: { tipo: TipoSerie }): boolean => s.tipo !== 'calentamiento'

export const volumenDe = (series: readonly { tipo: TipoSerie; peso: number; reps: number }[]): number =>
  series.filter(esEfectiva).reduce((t, s) => t + s.peso * s.reps, 0)

export interface Marcas {
  e1rm: number
  pesoMax: number
  /** Serie con mejor 1RM estimado. */
  mejorSerie: { peso: number; reps: number } | null
  /** Mayor volumen en una sola sesión. */
  volumenSesion: number
}

export const MARCAS_VACIAS: Marcas = { e1rm: 0, pesoMax: 0, mejorSerie: null, volumenSesion: 0 }

export function calcularMarcas(series: readonly SerieHecha[]): Marcas {
  const marcas: Marcas = { ...MARCAS_VACIAS }
  const volumenPorSesion = new Map<string, number>()
  for (const s of series) {
    if (!esEfectiva(s) || s.reps <= 0) continue
    const e = epley(s.peso, s.reps)
    if (e > marcas.e1rm) {
      marcas.e1rm = e
      marcas.mejorSerie = { peso: s.peso, reps: s.reps }
    }
    marcas.pesoMax = Math.max(marcas.pesoMax, s.peso)
    volumenPorSesion.set(s.sesionId, (volumenPorSesion.get(s.sesionId) ?? 0) + s.peso * s.reps)
  }
  marcas.volumenSesion = Math.max(0, ...volumenPorSesion.values())
  return marcas
}

export type TipoRecord = 'e1rm' | 'peso' | 'volumen'

export interface RecordSesion {
  ejercicioId: string
  tipo: TipoRecord
  valor: number
  anterior: number
  serie?: { peso: number; reps: number }
}

/**
 * Récords conseguidos en una sesión comparando con todo lo anterior.
 * La primera vez que haces un ejercicio no cuenta como récord (no hay con qué comparar).
 */
export function recordsDeSesion(seriesSesion: readonly SerieHecha[], historialPrevio: readonly SerieHecha[]): RecordSesion[] {
  const records: RecordSesion[] = []
  const porEjercicio = agrupar(seriesSesion, (s) => s.ejercicioId)
  const previoPorEjercicio = agrupar(historialPrevio, (s) => s.ejercicioId)
  for (const [ejercicioId, series] of porEjercicio) {
    const previas = previoPorEjercicio.get(ejercicioId)
    if (!previas?.some(esEfectiva)) continue
    const antes = calcularMarcas(previas)
    const ahora = calcularMarcas(series)
    if (ahora.pesoMax > antes.pesoMax) records.push({ ejercicioId, tipo: 'peso', valor: ahora.pesoMax, anterior: antes.pesoMax })
    if (ahora.e1rm > antes.e1rm + 1e-9)
      records.push({ ejercicioId, tipo: 'e1rm', valor: ahora.e1rm, anterior: antes.e1rm, serie: ahora.mejorSerie ?? undefined })
    if (ahora.volumenSesion > antes.volumenSesion)
      records.push({ ejercicioId, tipo: 'volumen', valor: ahora.volumenSesion, anterior: antes.volumenSesion })
  }
  return records
}

export interface RecordPersonal {
  ejercicioId: string
  marcas: Marcas
  /** Fecha de la serie con mejor 1RM estimado. */
  fecha: number
}

/** Mejor marca de cada ejercicio, para la lista de récords personales. */
export function recordsPersonales(series: readonly SerieHecha[]): RecordPersonal[] {
  const lista: RecordPersonal[] = []
  for (const [ejercicioId, propias] of agrupar(series, (s) => s.ejercicioId)) {
    const marcas = calcularMarcas(propias)
    if (!marcas.mejorSerie) continue
    const mejor = propias.find(
      (s) => esEfectiva(s) && s.peso === marcas.mejorSerie!.peso && s.reps === marcas.mejorSerie!.reps,
    )
    lista.push({ ejercicioId, marcas, fecha: mejor?.hora ?? 0 })
  }
  return lista.sort((a, b) => b.marcas.e1rm - a.marcas.e1rm)
}

export function agrupar<T, K>(lista: readonly T[], clave: (x: T) => K): Map<K, T[]> {
  const mapa = new Map<K, T[]>()
  for (const x of lista) {
    const k = clave(x)
    const grupo = mapa.get(k)
    if (grupo) grupo.push(x)
    else mapa.set(k, [x])
  }
  return mapa
}
