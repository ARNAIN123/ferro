import { esEfectiva, volumenDe } from './marcas'
import type { TipoSerie } from './tipos'

export interface ResumenSesion {
  duracionMs: number
  series: number
  repsTotales: number
  volumen: number
}

interface SerieResumen {
  tipo: TipoSerie
  peso: number
  reps: number
  completada: boolean
}

/** Resumen de una sesión con sus series completadas (los calentamientos no cuentan). */
export function resumirSesion(sesion: { entrada: number; salida: number | null }, series: readonly SerieResumen[], ahora = Date.now()): ResumenSesion {
  const hechas = series.filter((s) => s.completada && esEfectiva(s))
  return {
    duracionMs: Math.max(0, (sesion.salida ?? ahora) - sesion.entrada),
    series: hechas.length,
    repsTotales: hechas.reduce((t, s) => t + s.reps, 0),
    volumen: volumenDe(hechas),
  }
}

export interface Comparacion {
  volumen: number
  volumenPct: number | null
  series: number
  duracionMs: number
}

export function compararSesiones(actual: ResumenSesion, anterior: ResumenSesion): Comparacion {
  return {
    volumen: actual.volumen - anterior.volumen,
    volumenPct: anterior.volumen > 0 ? ((actual.volumen - anterior.volumen) / anterior.volumen) * 100 : null,
    series: actual.series - anterior.series,
    duracionMs: actual.duracionMs - anterior.duracionMs,
  }
}
