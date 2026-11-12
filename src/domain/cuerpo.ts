// Perfil corporal (ronda 4): medidas con cinta, porcentaje de grasa y lo que se deduce de ellos.
// Con estos datos se da forma al avatar (src/avatar3d) y, si hay grasa corporal, se calcula el
// metabolismo basal con la fórmula de Katch-McArdle.
import type { Sexo } from './nutricion'
import type { PesoCorporal } from './tipos'

/** Medidas con cinta métrica (cm). */
export const MEDIDAS = ['cuello', 'hombros', 'pecho', 'cintura', 'cadera', 'brazo', 'antebrazo', 'muslo', 'gemelo'] as const
export type NombreMedida = (typeof MEDIDAS)[number]

export const NOMBRE_MEDIDA: Record<NombreMedida, string> = {
  cuello: 'Cuello',
  hombros: 'Hombros',
  pecho: 'Pecho',
  cintura: 'Cintura',
  cadera: 'Cadera',
  brazo: 'Brazo',
  antebrazo: 'Antebrazo',
  muslo: 'Muslo',
  gemelo: 'Gemelo',
}

/** Por dónde se pasa la cinta (igual que la mide el avatar). */
export const AYUDA_MEDIDA: Record<NombreMedida, string> = {
  cuello: 'Por debajo de la nuez, sin apretar.',
  hombros: 'Alrededor de los hombros, por la parte más ancha de los deltoides.',
  pecho: 'A la altura de los pezones, tras soltar el aire.',
  cintura: 'A la altura del ombligo (en mujeres, por la parte más estrecha), sin meter barriga.',
  cadera: 'Por la parte más ancha de los glúteos.',
  brazo: 'Brazo relajado, por la parte más gruesa del bíceps.',
  antebrazo: 'Por la parte más gruesa, cerca del codo.',
  muslo: 'Por la parte más gruesa, de pie.',
  gemelo: 'Por la parte más gruesa, de pie.',
}

/** Valores admitidos (cm): fuera de aquí es casi seguro un error al escribir. */
export const LIMITES_MEDIDA: Record<NombreMedida, readonly [number, number]> = {
  cuello: [25, 60],
  hombros: [80, 170],
  pecho: [60, 170],
  cintura: [45, 180],
  cadera: [60, 180],
  brazo: [15, 65],
  antebrazo: [15, 50],
  muslo: [30, 100],
  gemelo: [20, 65],
}

/** Unas medidas tomadas un día (uno por día); las que no se midieron, sin valor. */
export type MedidaCorporal = { id: string; fecha: string } & Partial<Record<NombreMedida, number>>

/** Porcentaje de grasa de un día: lo escribí yo o lo trajo Health Connect (una báscula). */
export interface GrasaCorporal {
  id: string
  fecha: string
  pct: number
  origen: 'manual' | 'salud'
}

/** Ajuste fino visual del avatar: de −1 a 1 (0 = lo que dicen los datos). */
export interface AjusteFino {
  hombros: number
  piernas: number
  brazos: number
  cintura: number
}
export const AJUSTE_NEUTRO: AjusteFino = { hombros: 0, piernas: 0, brazos: 0, cintura: 0 }

const redondear1 = (v: number) => Math.round(v * 10) / 10
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * Porcentaje de grasa con el método de la Marina de EE. UU. (Hodgdon y Beckett, 1984), en cm:
 * hombres, con cintura, cuello y altura; mujeres, además con la cadera. Sin esas medidas, null.
 */
export function grasaMarina(d: { sexo: Sexo; alturaCm: number; cuello?: number; cintura?: number; cadera?: number }): number | null {
  if (!d.alturaCm || !d.cuello || !d.cintura) return null
  let pct: number
  if (d.sexo === 'hombre') {
    if (d.cintura <= d.cuello) return null
    pct = 495 / (1.0324 - 0.19077 * Math.log10(d.cintura - d.cuello) + 0.15456 * Math.log10(d.alturaCm)) - 450
  } else {
    if (!d.cadera || d.cintura + d.cadera <= d.cuello) return null
    pct = 495 / (1.29579 - 0.35004 * Math.log10(d.cintura + d.cadera - d.cuello) + 0.221 * Math.log10(d.alturaCm)) - 450
  }
  return Number.isFinite(pct) ? redondear1(limitar(pct, 3, 60)) : null
}

/** Densidad del cuerpo (kg/L) para un porcentaje de grasa (Siri, 1961). */
export const densidadCorporal = (grasaPct: number): number => 495 / (limitar(grasaPct, 2, 65) + 450)

/** Metabolismo basal con la masa magra (Katch-McArdle): 370 + 21,6 · kg de masa magra. */
export function basalKatchMcArdle(kg: number, grasaPct: number): number {
  return Math.round(370 + 21.6 * kg * (1 - limitar(grasaPct, 2, 65) / 100))
}

/**
 * Lo marcados que se ven los músculos (fuerza del relieve del avatar, de 0,1 a 1,4): con menos grasa,
 * más definición; con más músculo, algo más también.
 */
export function definicionMuscular(sexo: Sexo, grasaPct: number, musculo = 0.5): number {
  const [magro, graso] = sexo === 'hombre' ? [8, 30] : [16, 38]
  const t = limitar((grasaPct - magro) / (graso - magro), 0, 1)
  return Math.round((1.25 - 1.1 * t) * (0.8 + 0.4 * limitar(musculo, 0, 1)) * 100) / 100
}

const restarDias = (fecha: string, dias: number): string => {
  const d = new Date(`${fecha}T12:00:00`)
  d.setDate(d.getDate() - dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Fecha de hace `meses` meses (AAAA-MM-DD). */
export function haceMeses(fecha: string, meses: number): string {
  const d = new Date(`${fecha}T12:00:00`)
  const dia = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() - meses)
  d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Peso de un día según la tendencia: la media de los pesos de esa semana (los 7 días hasta la fecha).
 * Si esa semana no hay ninguno, el último anterior; si tampoco, null (aún no había registro).
 */
export function pesoTendencia(pesos: readonly PesoCorporal[], fecha: string): number | null {
  const desde = restarDias(fecha, 6)
  const semana = pesos.filter((p) => p.fecha >= desde && p.fecha <= fecha)
  if (semana.length) return Math.round((semana.reduce((s, p) => s + p.kg, 0) / semana.length) * 10) / 10
  let ultimo: PesoCorporal | null = null
  for (const p of pesos) if (p.fecha <= fecha && (!ultimo || p.fecha > ultimo.fecha)) ultimo = p
  return ultimo ? ultimo.kg : null
}

/** La última vez que se tomó cada medida hasta una fecha. */
export function medidasVigentes(registros: readonly MedidaCorporal[], fecha: string): Partial<Record<NombreMedida, { cm: number; fecha: string }>> {
  const r: Partial<Record<NombreMedida, { cm: number; fecha: string }>> = {}
  for (const reg of registros) {
    if (reg.fecha > fecha) continue
    for (const m of MEDIDAS) {
      const cm = reg[m]
      if (cm && (!r[m] || reg.fecha > r[m].fecha)) r[m] = { cm, fecha: reg.fecha }
    }
  }
  return r
}

export interface GrasaVigente {
  pct: number
  /** De dónde sale: una báscula (Health Connect), escrita a mano o calculada con las medidas. */
  origen: 'salud' | 'manual' | 'marina'
  fecha: string
}

/** Health Connect manda si su dato es de los últimos tres meses. */
const DIAS_SALUD_VIGENTE = 90
/** Pasado este tiempo, el porcentaje de grasa ya no vale (como las medidas de cinta). */
export const DIAS_GRASA_VIGENTE = 120

/**
 * Porcentaje de grasa que vale en una fecha: el de la báscula (Health Connect) si es reciente; si
 * no, lo más nuevo entre lo escrito a mano y el método de la Marina con las medidas de cinta. Un dato
 * de hace más de cuatro meses ya no vale (el cuerpo habrá cambiado).
 */
export function grasaVigente(d: { fecha: string; sexo: Sexo; alturaCm: number | null; grasas: readonly GrasaCorporal[]; medidas: readonly MedidaCorporal[] }): GrasaVigente | null {
  const ultima = (origen: GrasaCorporal['origen']) => {
    let u: GrasaCorporal | null = null
    for (const g of d.grasas) if (g.origen === origen && g.fecha <= d.fecha && (!u || g.fecha > u.fecha)) u = g
    return u
  }
  const salud = ultima('salud')
  if (salud && salud.fecha >= restarDias(d.fecha, DIAS_SALUD_VIGENTE)) return { pct: salud.pct, origen: 'salud', fecha: salud.fecha }
  const candidatos: GrasaVigente[] = []
  const manual = ultima('manual')
  if (manual) candidatos.push({ pct: manual.pct, origen: 'manual', fecha: manual.fecha })
  const m = medidasVigentes(d.medidas, d.fecha)
  if (d.alturaCm && m.cuello && m.cintura) {
    const pct = grasaMarina({ sexo: d.sexo, alturaCm: d.alturaCm, cuello: m.cuello.cm, cintura: m.cintura.cm, cadera: m.cadera?.cm })
    const fechas = [m.cuello.fecha, m.cintura.fecha, ...(d.sexo === 'mujer' && m.cadera ? [m.cadera.fecha] : [])].sort()
    // Todas las medidas tienen que ser recientes (no vale un cuello de hace un año con la cintura de hoy).
    if (pct !== null && fechas[0]! >= restarDias(d.fecha, DIAS_GRASA_VIGENTE)) candidatos.push({ pct, origen: 'marina', fecha: fechas.at(-1)! })
  }
  if (salud) candidatos.push({ pct: salud.pct, origen: 'salud', fecha: salud.fecha })
  // Lo más reciente; a igual fecha, por este orden: a mano, Marina, báscula antigua.
  const vigentes = candidatos.filter((c) => c.fecha >= restarDias(d.fecha, DIAS_GRASA_VIGENTE))
  vigentes.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
  return vigentes[0] ?? null
}

/** Lo que hace falta para dar forma al avatar. */
export interface DatosCuerpo {
  sexo: Sexo
  edad: number
  alturaCm: number
  kg: number
  /** Porcentaje de grasa conocido (báscula, a mano o método de la Marina); sin él, se estima. */
  grasaPct?: number | null
  /** Medidas de cinta (cm). */
  medidas?: Partial<Record<NombreMedida, number>>
  ajuste?: Partial<AjusteFino>
}

/** Un cuerpo corriente, para cuando aún no hay datos. */
export const CUERPO_POR_DEFECTO: DatosCuerpo = { sexo: 'hombre', edad: 30, alturaCm: 175, kg: 74, grasaPct: 16 }

/** Las medidas de cinta dejan de dar forma al avatar pasado este tiempo (el cuerpo habrá cambiado). */
export const DIAS_MEDIDA_VIGENTE = 120

export type DatoQueFalta = 'sexo' | 'edad' | 'altura' | 'peso'

export interface CuerpoDelDia {
  datos: DatosCuerpo
  /** Peso según la tendencia de ese día (null si aún no había registro). */
  kg: number | null
  grasa: GrasaVigente | null
  /** Datos del perfil que faltan: el avatar usa un valor corriente en su lugar. */
  faltan: DatoQueFalta[]
}

/**
 * El cuerpo de un día: el perfil, el peso según la tendencia de esa fecha, las medidas de cinta
 * recientes y el porcentaje de grasa que valía entonces.
 */
export function cuerpoEnFecha(d: {
  fecha: string
  sexo: Sexo | null
  edad: number | null
  alturaCm: number | null
  ajuste?: Partial<AjusteFino>
  pesos: readonly PesoCorporal[]
  medidas: readonly MedidaCorporal[]
  grasas: readonly GrasaCorporal[]
}): CuerpoDelDia {
  const faltan: DatoQueFalta[] = []
  if (!d.sexo) faltan.push('sexo')
  if (!d.edad) faltan.push('edad')
  if (!d.alturaCm) faltan.push('altura')
  const sexo = d.sexo ?? CUERPO_POR_DEFECTO.sexo
  const alturaCm = d.alturaCm ?? (sexo === 'hombre' ? 175 : 163)
  const kg = pesoTendencia(d.pesos, d.fecha)
  if (kg === null) faltan.push('peso')
  const grasa = grasaVigente({ fecha: d.fecha, sexo, alturaCm: d.alturaCm, grasas: d.grasas, medidas: d.medidas })
  const desde = restarDias(d.fecha, DIAS_MEDIDA_VIGENTE)
  const medidas: Partial<Record<NombreMedida, number>> = {}
  for (const [m, v] of Object.entries(medidasVigentes(d.medidas, d.fecha)) as [NombreMedida, { cm: number; fecha: string }][]) {
    if (v.fecha >= desde) medidas[m] = v.cm
  }
  return {
    datos: {
      sexo,
      edad: d.edad ?? CUERPO_POR_DEFECTO.edad,
      alturaCm,
      // Sin peso registrado, uno corriente para esa altura (IMC 23).
      kg: kg ?? Math.round(23 * (alturaCm / 100) ** 2),
      grasaPct: grasa?.pct ?? null,
      medidas,
      ajuste: d.ajuste,
    },
    kg,
    grasa,
    faltan,
  }
}
