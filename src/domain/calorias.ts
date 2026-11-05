// Calorías estimadas del día: caminar (pasos) + entreno de fuerza. Siempre netas: lo que se gasta
// por encima de estar en reposo, que es lo que añade la actividad. Son una estimación, no una medida.
//
// Pasos — ecuación metabólica del ACSM para caminar en llano (ACSM's Guidelines for Exercise
// Testing and Prescription): VO2 = 0,1 · velocidad (m/min) + 3,5 ml O2/kg/min. Sin el término de
// reposo (3,5), caminar cuesta 0,1 ml O2 por kg y metro, independientemente de la velocidad.
// Con ~5 kcal por litro de O2: 0,0005 kcal por kg y metro, es decir, 0,5 kcal por kg y km.
// La distancia sale de los pasos y la longitud del paso, estimada como 0,414 × altura (la
// estimación habitual de los podómetros: 0,413 en mujeres y 0,415 en hombres).
//
// Entreno — MET del entrenamiento de fuerza según el Compendium of Physical Activities
// (Ainsworth et al., actualizado por Herrmann et al. en 2024): 3,5 para varios ejercicios con
// esfuerzo moderado y 6,0 para el entrenamiento vigoroso. Se elige un valor en ese rango según la
// densidad real de la sesión, y las calorías netas son (MET − 1) × kg × horas (1 MET ≈ 1 kcal/kg/h).
//
// Para no contar dos veces, los pasos dados durante el entreno se restan de los del día: ese
// movimiento ya está dentro del MET de la sesión.

export const FACTOR_PASO = 0.414
export const KCAL_POR_KG_Y_KM = 0.5
export const MET_MIN = 3.5
export const MET_MAX = 6

/** Longitud media del paso en metros a partir de la altura. */
export const longitudPasoM = (alturaCm: number): number => (FACTOR_PASO * alturaCm) / 100

export interface CaloriasPasos {
  pasos: number
  km: number
  kcal: number
}

/** Calorías netas de caminar `pasos` pasos. */
export function caloriasPasos(pasos: number, kg: number, alturaCm: number): CaloriasPasos {
  const n = Math.max(0, pasos)
  const km = (n * longitudPasoM(alturaCm)) / 1000
  return { pasos: n, km, kcal: KCAL_POR_KG_Y_KM * kg * km }
}

/** Lo que se mide de una sesión para estimar su intensidad. */
export interface DensidadSesion {
  /** Duración real en minutos: de la entrada a la salida, o de la primera a la última serie. */
  minutos: number
  /** Series de trabajo completadas (sin calentamientos). */
  series: number
  /** Volumen: kg × repeticiones de las series de trabajo. */
  volumenKg: number
  /** Mediana del tiempo entre una serie y la siguiente, en segundos (descanso + ejecución). */
  entreSeriesS: number | null
}

interface SerieMedible {
  hora: number | null
  peso: number
  reps: number
  completada: boolean
  tipo?: string
}

const mediana = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const o = [...xs].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2
}

/** Pausas más largas que esto (p. ej. una charla o un cambio de sala) no son descanso entre series. */
const PAUSA_MAXIMA_S = 10 * 60

/**
 * Densidad de una sesión. `inicio` y `fin` son la entrada y la salida si se conocen; si falta
 * alguna, se usa la primera o la última serie. Devuelve null si no hay ninguna serie hecha.
 */
export function densidadSesion(inicio: number | null, fin: number | null, series: readonly SerieMedible[]): DensidadSesion | null {
  const hechas = series.filter((s) => s.completada && s.hora !== null)
  if (hechas.length === 0) return null
  const horas = hechas.map((s) => s.hora!).sort((a, b) => a - b)
  const desde = inicio ?? horas[0]!
  const hasta = fin ?? horas.at(-1)!
  const trabajo = hechas.filter((s) => s.tipo !== 'calentamiento')
  const huecos = horas.slice(1).map((h, i) => (h - horas[i]!) / 1000).filter((s) => s > 0 && s <= PAUSA_MAXIMA_S)
  return {
    // Una sola serie sin entrada ni salida no tiene duración: se le da un minuto.
    minutos: Math.max(1, (hasta - desde) / 60000),
    series: trabajo.length,
    volumenKg: trabajo.reduce((t, s) => t + s.peso * s.reps, 0),
    entreSeriesS: mediana(huecos),
  }
}

const tramo = (x: number, desde: number, hasta: number) => Math.min(1, Math.max(0, (x - desde) / (hasta - desde)))

/**
 * MET de la sesión entre 3,5 y 6 según su densidad. Tres señales, de 0 (suave) a 1 (densa):
 * - series por minuto: de 0,2 (una cada 5 min) a 0,6 (una cada 100 s);
 * - tiempo entre series: de 4 min a 75 s;
 * - volumen por minuto relativo al peso corporal: de 0,5 a 5 veces el peso por minuto.
 */
export function metDeSesion(d: DensidadSesion, kg: number): number {
  const senales: [number, number][] = [
    [tramo(d.series / d.minutos, 0.2, 0.6), 0.35],
    [tramo(d.volumenKg / d.minutos / Math.max(1, kg), 0.5, 5), 0.3],
  ]
  if (d.entreSeriesS !== null) senales.push([1 - tramo(d.entreSeriesS, 75, 240), 0.35])
  const peso = senales.reduce((t, [, p]) => t + p, 0)
  const densidad = senales.reduce((t, [v, p]) => t + v * p, 0) / peso
  return MET_MIN + (MET_MAX - MET_MIN) * densidad
}

/** Calorías netas de una actividad: (MET − 1) × kg × horas. */
export const caloriasNetas = (met: number, kg: number, minutos: number): number => Math.max(0, met - 1) * kg * (minutos / 60)

export interface CaloriasEntreno extends DensidadSesion {
  met: number
  kcal: number
}

export interface CaloriasDia {
  total: number
  pasos: CaloriasPasos & {
    /** Pasos dados durante los entrenos, que no se suman aquí. */
    enEntreno: number
  }
  entrenos: CaloriasEntreno[]
}

/** Estimación del día. `pasosEnEntreno` son los pasos dados dentro de las sesiones. */
export function caloriasDelDia(datos: {
  pasos: number
  pasosEnEntreno: number
  kg: number
  alturaCm: number
  sesiones: readonly DensidadSesion[]
}): CaloriasDia {
  const enEntreno = Math.min(Math.max(0, datos.pasosEnEntreno), Math.max(0, datos.pasos))
  const pasos = caloriasPasos(datos.pasos - enEntreno, datos.kg, datos.alturaCm)
  const entrenos = datos.sesiones.map((d) => {
    const met = metDeSesion(d, datos.kg)
    return { ...d, met, kcal: caloriasNetas(met, datos.kg, d.minutos) }
  })
  return {
    total: pasos.kcal + entrenos.reduce((t, e) => t + e.kcal, 0),
    pasos: { ...pasos, enEntreno },
    entrenos,
  }
}
