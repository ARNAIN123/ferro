// Borrador de rutina para el editor: se guarda de una vez al pulsar "Guardar".
import type { TipoSerie } from './tipos'

export interface ItemPlan {
  /** Clave estable para la lista (no es el id en la base de datos). */
  clave: string
  ejercicioId: string
  series: number
  repsMin: number
  repsMax: number
  descansoSeg: number
  nota: string
  superserieConSiguiente: boolean
}

export interface BloqueSesion {
  ejercicioId: string
  repsMin: number
  repsMax: number
  descansoSeg: number
  superserieConSiguiente: boolean
  series: { tipo: TipoSerie; completada: boolean }[]
}

/**
 * Plan de rutina a partir de un entreno hecho (también un entreno libre): un ejercicio por bloque
 * con tantas series como series efectivas completé (mínimo 1). Si un ejercicio se repite, se suma.
 */
export function planDesdeSesion(bloques: readonly BloqueSesion[], clave: (i: number) => string): ItemPlan[] {
  const items: ItemPlan[] = []
  for (const b of bloques) {
    const hechas = b.series.filter((s) => s.completada && s.tipo !== 'calentamiento').length
    if (hechas === 0) continue
    const previo = items.find((x) => x.ejercicioId === b.ejercicioId)
    if (previo) {
      previo.series += hechas
      continue
    }
    items.push({
      clave: clave(items.length),
      ejercicioId: b.ejercicioId,
      series: hechas,
      repsMin: b.repsMin,
      repsMax: b.repsMax,
      descansoSeg: b.descansoSeg,
      nota: '',
      superserieConSiguiente: b.superserieConSiguiente,
    })
  }
  if (items.length) items[items.length - 1]!.superserieConSiguiente = false
  return items
}

/** Ajusta un valor del plan respetando sus límites y que el mínimo de reps no supere al máximo. */
export function ajustarItem(item: ItemPlan, campo: 'series' | 'repsMin' | 'repsMax' | 'descansoSeg', delta: number): ItemPlan {
  const limites = { series: [1, 12], repsMin: [1, 50], repsMax: [1, 50], descansoSeg: [0, 600] } as const
  const [min, max] = limites[campo]
  const valor = Math.min(max, Math.max(min, item[campo] + delta))
  const nuevo = { ...item, [campo]: valor }
  if (campo === 'repsMin' && nuevo.repsMax < valor) nuevo.repsMax = valor
  if (campo === 'repsMax' && nuevo.repsMin > valor) nuevo.repsMin = valor
  return nuevo
}

/** Alterna la superserie entre el elemento `i` y el siguiente (el último nunca puede tenerla). */
export function alternarSuperserie(items: readonly ItemPlan[], i: number): ItemPlan[] {
  if (i < 0 || i >= items.length - 1) return [...items]
  return items.map((x, k) => (k === i ? { ...x, superserieConSiguiente: !x.superserieConSiguiente } : x))
}

/** Tras reordenar o quitar, el último elemento no puede quedar en superserie con "el siguiente". */
export function normalizarPlan(items: readonly ItemPlan[]): ItemPlan[] {
  return items.map((x, k) => (k === items.length - 1 && x.superserieConSiguiente ? { ...x, superserieConSiguiente: false } : x))
}
