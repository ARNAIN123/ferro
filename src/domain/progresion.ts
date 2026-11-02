// Progresión automática: doble progresión, freno por RIR 0 y detección de estancamiento.
import { epley } from './marcas'
import type { TipoSerie } from './tipos'

export interface SerieProgresion {
  tipo: TipoSerie
  peso: number
  reps: number
  rir: number | null
}

export interface Objetivo {
  seriesObjetivo: number
  repsMin: number
  repsMax: number
  salto: number
}

export type TipoSugerencia = 'subir_peso' | 'subir_reps' | 'mantener'

export interface Sugerencia {
  tipo: TipoSugerencia
  /** Peso y reps propuestos para cada serie efectiva, en orden. */
  objetivos: { peso: number; reps: number }[]
  /** Kg que se suben (solo en subir_peso). */
  delta: number
}

/** Solo las series normales cuentan para progresar (ni calentamientos ni drop sets). */
const efectivas = (series: readonly SerieProgresion[]) => series.filter((s) => s.tipo === 'normal')

export const redondear = (kg: number) => Math.round(kg * 100) / 100

/**
 * Doble progresión a partir de la última sesión del ejercicio:
 * - si completé todas las series en el máximo del rango → subir el salto y volver al mínimo de reps;
 * - salvo que el RIR fuera 0 en la mayoría de las series (iba al fallo) → mantener;
 * - si no → mantener el peso e intentar +1 rep en las series que no llegaron al máximo.
 * Devuelve null si no hay historial con el que comparar.
 */
export function sugerirProgresion(ultima: readonly SerieProgresion[], obj: Objetivo): Sugerencia | null {
  const series = efectivas(ultima)
  if (series.length === 0) return null

  const todasAlMaximo = series.length >= obj.seriesObjetivo && series.every((s) => s.reps >= obj.repsMax)
  const alFallo = series.filter((s) => s.rir === 0).length > series.length / 2
  const n = Math.max(obj.seriesObjetivo, 1)
  const ref = (i: number) => series[i] ?? series[series.length - 1]!

  if (todasAlMaximo && !alFallo && obj.salto > 0) {
    const base = Math.max(...series.map((s) => s.peso))
    const peso = redondear(base + obj.salto)
    return { tipo: 'subir_peso', delta: obj.salto, objetivos: Array.from({ length: n }, () => ({ peso, reps: obj.repsMin })) }
  }

  const objetivos = Array.from({ length: n }, (_, i) => {
    const s = ref(i)
    return { peso: s.peso, reps: Math.min(obj.repsMax, Math.max(obj.repsMin, s.reps + 1)) }
  })
  const subeAlgo = objetivos.some((o, i) => o.reps > ref(i).reps)
  return { tipo: subeAlgo ? 'subir_reps' : 'mantener', delta: 0, objetivos }
}

export interface Rendimiento {
  pesoMax: number
  /** Mejores reps con el peso máximo. */
  mejorReps: number
  /** Reps totales con el peso máximo. */
  repsTotales: number
  e1rm: number
}

export function rendimiento(series: readonly SerieProgresion[]): Rendimiento | null {
  const ef = efectivas(series).filter((s) => s.reps > 0)
  if (ef.length === 0) return null
  const pesoMax = Math.max(...ef.map((s) => s.peso))
  const conMax = ef.filter((s) => s.peso === pesoMax)
  return {
    pesoMax,
    mejorReps: Math.max(...conMax.map((s) => s.reps)),
    repsTotales: conMax.reduce((t, s) => t + s.reps, 0),
    e1rm: Math.max(...ef.map((s) => epley(s.peso, s.reps))),
  }
}

/** ¿`a` mejora a `b` en peso o repeticiones? */
export function mejora(a: Rendimiento, b: Rendimiento): boolean {
  if (a.pesoMax > b.pesoMax) return true
  if (a.pesoMax === b.pesoMax && (a.mejorReps > b.mejorReps || a.repsTotales > b.repsTotales)) return true
  return a.e1rm > b.e1rm + 1e-9
}

/**
 * Estancamiento: las últimas `sesionesSinMejora` sesiones no mejoran a lo mejor que había antes de ellas.
 * `sesiones` va de la más reciente a la más antigua.
 */
export function estancado(sesiones: readonly (readonly SerieProgresion[])[], sesionesSinMejora = 3): boolean {
  const cronologicas = sesiones
    .slice(0, sesionesSinMejora + 1)
    .map(rendimiento)
    .filter((r): r is Rendimiento => r !== null)
    .reverse()
  if (cronologicas.length < sesionesSinMejora + 1) return false
  const referencia = cronologicas[0]!
  return cronologicas.slice(1).every((r) => !mejora(r, referencia))
}

/** Bajar un 10 % y reconstruir: redondea hacia abajo al múltiplo del salto. */
export function descarga(peso: number, salto: number, porcentaje = 10): number {
  const bajado = peso * (1 - porcentaje / 100)
  if (salto <= 0) return redondear(bajado)
  return redondear(Math.floor(bajado / salto + 1e-9) * salto)
}

interface SerieActual {
  id: string
  tipo: TipoSerie
  orden: number
  completada: boolean
  peso: number
  reps: number
}

/** Reparte los objetivos entre las series normales pendientes de la sesión actual (en orden). */
export function asignarObjetivos(
  series: readonly SerieActual[],
  objetivos: readonly { peso: number; reps: number }[],
): { id: string; peso: number; reps: number }[] {
  if (objetivos.length === 0) return []
  return [...series]
    .filter((s) => s.tipo === 'normal')
    .sort((a, b) => a.orden - b.orden)
    .flatMap((s, i) => {
      const o = objetivos[i] ?? objetivos[objetivos.length - 1]!
      return s.completada ? [] : [{ id: s.id, peso: o.peso, reps: o.reps }]
    })
}

/** ¿Las series pendientes ya tienen los valores sugeridos? */
export function sugerenciaAplicada(series: readonly SerieActual[], objetivos: readonly { peso: number; reps: number }[]): boolean {
  const asignados = asignarObjetivos(series, objetivos)
  const porId = new Map(series.map((s) => [s.id, s]))
  return asignados.length > 0 && asignados.every((a) => porId.get(a.id)?.peso === a.peso && porId.get(a.id)?.reps === a.reps)
}
