// Cálculos de nutrición: gasto, objetivo con sus límites de seguridad, recalibración semanal,
// reparto entre días de entreno y de descanso, macros, "Cerrar el día" y avisos amables.
// Todo son funciones puras con tests (nutricion.test.ts).

import { basalKatchMcArdle } from './cuerpo'

export type Sexo = 'hombre' | 'mujer'
export type ObjetivoNutricion = 'perder' | 'mantener' | 'ganar'
export type Ritmo = 'suave' | 'moderado' | 'rapido'

/** Porcentaje del peso por semana según el ritmo. */
export const RITMO_PORCENTAJE: Record<Ritmo, number> = { suave: 0.25, moderado: 0.5, rapido: 0.75 }
/** Nunca más rápido que esto (% del peso por semana). */
export const RITMO_MAXIMO = 1
/** kcal que equivalen a 1 kg de peso corporal (grasa con algo de agua y tejido). */
export const KCAL_POR_KG = 7700
/** Efecto térmico de los alimentos: energía que se gasta en digerir (≈10 % de lo que se come). */
export const EFECTO_TERMICO = 0.1
/** Como mucho se mueve el objetivo esto cada semana. */
export const AJUSTE_MAXIMO_SEMANAL = 150
/** Días que se usa la estimación antes de empezar a recalibrar con datos reales. */
export const DIAS_SOLO_ESTIMACION = 14
export const PROTEINA_POR_DEFECTO = 2
export const PROTEINA_MIN = 1.6
export const PROTEINA_MAX = 2.2
export const GRASA_MINIMA_G_KG = 0.7

const redondear10 = (v: number) => Math.round(v / 10) * 10
/** Redondea a decenas sin bajar nunca del basal (si hace falta, redondea hacia arriba). */
const conSuelo = (v: number, basal: number) => Math.max(redondear10(v), Math.ceil(basal / 10) * 10)

/** Metabolismo basal (Mifflin-St Jeor, 1990): 10·kg + 6,25·cm − 5·edad + 5 (hombre) o − 161 (mujer). */
export function metabolismoBasal(d: { sexo: Sexo; kg: number; alturaCm: number; edad: number }): number {
  return Math.round(10 * d.kg + 6.25 * d.alturaCm - 5 * d.edad + (d.sexo === 'hombre' ? 5 : -161))
}

export type FormulaBasal = 'katch' | 'mifflin'
export const NOMBRE_FORMULA_BASAL: Record<FormulaBasal, string> = { katch: 'Katch-McArdle', mifflin: 'Mifflin-St Jeor' }

/**
 * Metabolismo basal con la mejor fórmula para los datos que hay: si se conoce el porcentaje de grasa,
 * Katch-McArdle (con la masa magra: no confunde el músculo con la grasa); si no, Mifflin-St Jeor.
 */
export function basalDe(d: { sexo: Sexo; kg: number; alturaCm: number; edad: number; grasaPct?: number | null }): { kcal: number; formula: FormulaBasal } {
  return d.grasaPct != null ? { kcal: basalKatchMcArdle(d.kg, d.grasaPct), formula: 'katch' } : { kcal: metabolismoBasal(d), formula: 'mifflin' }
}

/**
 * Gasto diario estimado: basal + actividad real (pasos y entrenos, calorías netas que ya calcula la
 * app) + efecto térmico de los alimentos. Como el efecto térmico es ≈10 % de lo que se come, y lo
 * que se come ≈ el gasto: gasto = (basal + actividad) / 0,9.
 */
export function gastoEstimado(basal: number, actividadMedia: number): number {
  return Math.round((basal + Math.max(0, actividadMedia)) / (1 - EFECTO_TERMICO))
}

/** Porcentaje del peso por semana del ritmo elegido, nunca por encima del máximo. */
export const porcentajeSemanal = (ritmo: Ritmo) => Math.min(RITMO_PORCENTAJE[ritmo], RITMO_MAXIMO)

/** Déficit (o superávit) diario en kcal para el ritmo elegido. */
export function deltaDiario(kg: number, ritmo: Ritmo): number {
  return ((kg * porcentajeSemanal(ritmo)) / 100) * (KCAL_POR_KG / 7)
}

export interface ObjetivoCalorico {
  kcal: number
  /** El objetivo habría quedado por debajo del basal y se ha subido hasta él. */
  limitadoPorBasal: boolean
}

/** Objetivo diario a partir del gasto, con el límite de seguridad del metabolismo basal. */
export function objetivoCalorico(d: { gasto: number; basal: number; objetivo: ObjetivoNutricion; ritmo: Ritmo; kg: number }): ObjetivoCalorico {
  const delta = deltaDiario(d.kg, d.ritmo)
  const bruto = d.objetivo === 'perder' ? d.gasto - delta : d.objetivo === 'ganar' ? d.gasto + delta : d.gasto
  const kcal = conSuelo(bruto, d.basal)
  return { kcal, limitadoPorBasal: bruto < d.basal }
}

// ── Recalibración semanal ───────────────────────────────────────────────────────────────────

export interface DiaIngesta {
  fecha: string
  /** kcal registradas ese día; null si no registré nada. */
  kcal: number | null
}

export interface Recalibracion {
  /** Gasto real calculado con lo que comí y lo que cambió mi peso; null si no hay datos suficientes. */
  gastoReal: number | null
  nuevoObjetivo: number
  /** Por qué no se ajustó o cuánto se ajustó. */
  motivo: 'pocos_registros' | 'poco_peso' | 'ajustado' | 'limitado' | 'sin_cambios'
  mediaIngesta: number | null
  /** Cambio de peso por semana según la tendencia (kg). */
  cambioSemanal: number | null
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** Media de los pesos de los 7 días que acaban en `fin` (incluido). */
function mediaSieteDias(pesos: readonly { fecha: string; kg: number }[], fin: string, inicio: string): number | null {
  const dentro = pesos.filter((p) => p.fecha <= fin && p.fecha >= inicio)
  return dentro.length >= 3 ? (media(dentro.map((p) => p.kg)) as number) : null
}

const desplazar = (fecha: string, dias: number) => {
  const d = new Date(`${fecha}T12:00`)
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Cada lunes: con las últimas 2 semanas, gasto real = lo que comí de media − lo que cambió el peso
 * (tendencia de la media de 7 días, 7.700 kcal por kg). El objetivo se mueve como mucho ±150 kcal y
 * nunca baja del basal. Hacen falta al menos 10 días con comidas registradas y pesos suficientes.
 */
export function recalibrar(d: {
  /** Último día incluido (el domingo anterior al lunes del ajuste). */
  hasta: string
  ingestas: readonly DiaIngesta[]
  pesos: readonly { fecha: string; kg: number }[]
  objetivoActual: number
  basal: number
  objetivo: ObjetivoNutricion
  ritmo: Ritmo
  kg: number
}): Recalibracion {
  const desde = desplazar(d.hasta, -13)
  const registrados = d.ingestas.filter((i) => i.fecha >= desde && i.fecha <= d.hasta && i.kcal !== null && i.kcal > 0).map((i) => i.kcal as number)
  const sin = (motivo: Recalibracion['motivo'], extra: Partial<Recalibracion> = {}): Recalibracion => ({
    gastoReal: null,
    nuevoObjetivo: d.objetivoActual,
    motivo,
    mediaIngesta: media(registrados),
    cambioSemanal: null,
    ...extra,
  })
  if (registrados.length < 10) return sin('pocos_registros')
  const inicial = mediaSieteDias(d.pesos, desplazar(desde, 6), desde)
  const final = mediaSieteDias(d.pesos, d.hasta, desplazar(d.hasta, -6))
  if (inicial === null || final === null) return sin('poco_peso')
  const mediaIngesta = media(registrados) as number
  // Las dos medias están separadas 7 días.
  const cambioSemanal = final - inicial
  const gastoReal = Math.round(mediaIngesta - (cambioSemanal * KCAL_POR_KG) / 7)
  const ideal = objetivoCalorico({ gasto: gastoReal, basal: d.basal, objetivo: d.objetivo, ritmo: d.ritmo, kg: d.kg }).kcal
  const limitado = Math.min(d.objetivoActual + AJUSTE_MAXIMO_SEMANAL, Math.max(d.objetivoActual - AJUSTE_MAXIMO_SEMANAL, ideal))
  const nuevoObjetivo = conSuelo(limitado, d.basal)
  return {
    gastoReal,
    nuevoObjetivo,
    motivo: nuevoObjetivo === d.objetivoActual ? 'sin_cambios' : limitado !== ideal ? 'limitado' : 'ajustado',
    mediaIngesta: Math.round(mediaIngesta),
    cambioSemanal: Math.round(cambioSemanal * 100) / 100,
  }
}

// ── Días de entreno y de descanso, y macros ─────────────────────────────────────────────────

/** Los días de entreno llevan un 8 % más (en hidratos) y los de descanso lo compensan. */
export const EXTRA_DIA_ENTRENO = 0.08

/**
 * Objetivo de un día concreto: los días de entreno algo más y los de descanso algo menos, de modo
 * que el total de la semana sea el mismo (7 × objetivo). Ningún día baja del basal: si el objetivo
 * medio está cerca del basal, la diferencia entre días se reduce (o desaparece).
 */
export function objetivoDelDia(objetivo: number, entrena: boolean, diasEntrenoSemana: number, basal = 0): number {
  const n = Math.min(7, Math.max(0, Math.round(diasEntrenoSemana)))
  if (n === 0 || n === 7) return objetivo
  const margen = Math.max(0, objetivo - basal)
  const extra = Math.min(objetivo * EXTRA_DIA_ENTRENO, (margen * (7 - n)) / n)
  if (entrena) return Math.round(objetivo + extra)
  return Math.max(Math.ceil(basal), Math.round(objetivo - (extra * n) / (7 - n)))
}

export interface Macros {
  proteina: number
  carbohidratos: number
  grasa: number
}

/**
 * Proteína primero (g/kg, 1,6–2,2), grasa al menos 0,7 g/kg (o el 25 % de las kcal si es más) y el
 * resto en hidratos. La grasa se calcula con el objetivo medio, para que entre días de entreno y de
 * descanso solo cambien los hidratos.
 */
export function macrosDelDia(d: { kcalDia: number; kcalMedia: number; kg: number; proteinaGkg: number }): Macros {
  const gkg = Math.min(PROTEINA_MAX, Math.max(PROTEINA_MIN, d.proteinaGkg))
  const proteina = Math.round(d.kg * gkg)
  const grasa = Math.round(Math.max(GRASA_MINIMA_G_KG * d.kg, (0.25 * d.kcalMedia) / 9))
  const carbohidratos = Math.max(0, Math.round((d.kcalDia - proteina * 4 - grasa * 9) / 4))
  return { proteina, carbohidratos, grasa }
}

/** Días de entreno por semana que salen de mi objetivo mensual (16 al mes ≈ 3,7 a la semana). */
export const diasEntrenoSemana = (objetivoMensual: number) => (objetivoMensual * 7) / 30.44

/** Objetivo de un día concreto (kcal y macros) a partir del objetivo medio del perfil. */
export function objetivoDia(d: { objetivoKcal: number; basal: number; proteinaGkg: number; kg: number; entrena: boolean; objetivoMensual: number }): { kcal: number } & Macros {
  const kcal = objetivoDelDia(d.objetivoKcal, d.entrena, diasEntrenoSemana(d.objetivoMensual), d.basal)
  return { kcal, ...macrosDelDia({ kcalDia: kcal, kcalMedia: d.objetivoKcal, kg: d.kg, proteinaGkg: d.proteinaGkg }) }
}

// ── Cerrar el día ───────────────────────────────────────────────────────────────────────────

export interface Valores100 {
  kcal: number
  proteina: number
  carbohidratos: number
  grasa: number
}

export interface Habitual {
  id: string
  nombre: string
  por100: Valores100
  raciones: readonly { nombre: string; gramos: number }[]
  usos: number
}

export interface Sugerencia {
  partes: { id: string; nombre: string; gramos: number; racion: string | null }[]
  kcal: number
  proteina: number
}

const valoresDe = (h: Habitual, g: number) => ({ kcal: (h.por100.kcal * g) / 100, proteina: (h.por100.proteina * g) / 100 })

/** Cantidades razonables de un alimento: sus raciones (una o dos) y algunos gramos redondos. */
function cantidades(h: Habitual): { gramos: number; racion: string | null }[] {
  const r = h.raciones.flatMap((x) => [
    { gramos: x.gramos, racion: x.nombre },
    { gramos: x.gramos * 2, racion: `2 × ${x.nombre.replace(/^1 /, '')}` },
  ])
  const g = [50, 100, 150, 200].map((gramos) => ({ gramos, racion: null }))
  return [...r, ...g].filter((c) => c.gramos > 0 && c.gramos <= 500)
}

/**
 * Propuestas para cerrar el día con lo que me queda, solo con mis alimentos habituales: de uno o
 * dos alimentos, sin pasarse de las kcal (10 % de margen) y acercándose sobre todo a la proteína.
 */
export function sugerirCierre(restante: { kcal: number; proteina: number }, habituales: readonly Habitual[], maximo = 3): Sugerencia[] {
  if (restante.kcal < 60 || habituales.length === 0) return []
  const base = [...habituales].sort((a, b) => b.usos - a.usos).slice(0, 14)
  const opciones = base.map((h) => ({ h, cs: cantidades(h) }))
  const candidatas: (Sugerencia & { error: number })[] = []
  const evaluar = (partes: { h: Habitual; gramos: number; racion: string | null }[]) => {
    const t = partes.reduce((s, p) => ({ kcal: s.kcal + valoresDe(p.h, p.gramos).kcal, proteina: s.proteina + valoresDe(p.h, p.gramos).proteina }), { kcal: 0, proteina: 0 })
    if (t.kcal > restante.kcal * 1.1 || t.kcal < restante.kcal * 0.5) return
    const errorKcal = Math.abs(restante.kcal - t.kcal) / restante.kcal
    const errorProt = restante.proteina > 5 ? Math.abs(restante.proteina - t.proteina) / restante.proteina : 0
    candidatas.push({
      partes: partes.map((p) => ({ id: p.h.id, nombre: p.h.nombre, gramos: p.gramos, racion: p.racion })),
      kcal: Math.round(t.kcal),
      proteina: Math.round(t.proteina),
      error: errorKcal + 2 * errorProt,
    })
  }
  for (const [i, a] of opciones.entries()) {
    for (const ca of a.cs) {
      evaluar([{ h: a.h, ...ca }])
      for (const b of opciones.slice(i + 1)) for (const cb of b.cs) evaluar([{ h: a.h, ...ca }, { h: b.h, ...cb }])
    }
  }
  candidatas.sort((x, y) => x.error - y.error)
  // Sin repetir la misma combinación de alimentos.
  const vistas = new Set<string>()
  const salida: Sugerencia[] = []
  for (const c of candidatas) {
    const clave = c.partes.map((p) => p.id).sort().join('+')
    if (vistas.has(clave)) continue
    vistas.add(clave)
    salida.push({ partes: c.partes, kcal: c.kcal, proteina: c.proteina })
    if (salida.length >= maximo) break
  }
  return salida
}

// ── Avisos amables ──────────────────────────────────────────────────────────────────────────

/**
 * ¿He comido muy por debajo del objetivo (menos del 70 %) varios días seguidos? Solo cuenta días
 * ya terminados con algo registrado. `dias` va del más reciente al más antiguo.
 */
export function comeMuyPoco(dias: readonly { kcal: number | null; objetivo: number }[], seguidos = 3, umbral = 0.7): boolean {
  let n = 0
  for (const d of dias) {
    if (d.kcal === null || d.kcal <= 0) break
    if (d.kcal < d.objetivo * umbral) n++
    else break
    if (n >= seguidos) return true
  }
  return false
}
