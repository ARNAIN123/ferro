// Intensidad muscular y niveles para pintar el avatar (la correspondencia con el dibujo está en domain/avatar).
import type { Musculo, TipoSerie } from './tipos'

export interface TrabajoMuscular {
  /** Series ponderadas: 1 si es músculo principal del ejercicio, 0,5 si es secundario. */
  series: number
  /** Series ponderadas que aporta cada ejercicio a este músculo. */
  porEjercicio: Map<string, number>
}

interface MusculosDe {
  musculosPrincipales: readonly Musculo[]
  musculosSecundarios: readonly Musculo[]
}

/**
 * Intensidad muscular: cada serie cuenta 1 para los músculos principales del ejercicio
 * y 0,5 para los secundarios. Los calentamientos no cuentan.
 */
export function trabajoMuscular(
  series: readonly { ejercicioId: string; tipo?: TipoSerie; cantidad?: number }[],
  ejercicios: ReadonlyMap<string, MusculosDe>,
): Map<Musculo, TrabajoMuscular> {
  const total = new Map<Musculo, TrabajoMuscular>()
  const sumar = (m: Musculo, ejercicioId: string, n: number) => {
    const t = total.get(m) ?? { series: 0, porEjercicio: new Map<string, number>() }
    t.series += n
    t.porEjercicio.set(ejercicioId, (t.porEjercicio.get(ejercicioId) ?? 0) + n)
    total.set(m, t)
  }
  for (const s of series) {
    if (s.tipo === 'calentamiento') continue
    const e = ejercicios.get(s.ejercicioId)
    if (!e) continue
    const n = s.cantidad ?? 1
    for (const m of e.musculosPrincipales) sumar(m, s.ejercicioId, n)
    for (const m of e.musculosSecundarios) if (!e.musculosPrincipales.includes(m)) sumar(m, s.ejercicioId, n * 0.5)
  }
  return total
}

/** Mapa del propio ejercicio: principales a intensidad máxima y secundarios suaves. */
export function nivelesDeEjercicio(e: MusculosDe): Map<Musculo, number> {
  const niveles = new Map<Musculo, number>()
  for (const m of e.musculosSecundarios) niveles.set(m, 2)
  for (const m of e.musculosPrincipales) niveles.set(m, NIVELES)
  return niveles
}

export const NIVELES = 5

/** Escalas de intensidad: límite inferior de los niveles 2 a 5 (el nivel 1 es cualquier valor > 0). */
export const ESCALAS = {
  /** Una sesión o una rutina. */
  sesion: [2, 4, 6, 9],
  /** Series por semana: los mismos niveles que el avatar de Hoy (1–3, 4–6, 7–10, 11–15, 16+). */
  semana: [4, 7, 11, 16],
} as const

export function nivelIntensidad(valor: number, escala: readonly number[]): number {
  if (valor <= 0) return 0
  let nivel = 1
  for (const limite of escala) if (valor >= limite) nivel++
  return Math.min(nivel, NIVELES)
}

/** Rótulos de la leyenda para una escala: "1–3", "4–7"… "16+". */
export function rotulosEscala(escala: readonly number[]): string[] {
  const bordes = [0, ...escala]
  return bordes.map((b, i) => {
    const desde = i === 0 ? 1 : b
    const siguiente = bordes[i + 1]
    if (siguiente === undefined) return `${desde}+`
    const hasta = siguiente - 1
    return hasta <= desde ? `${desde}` : `${desde}–${hasta}`
  })
}

/** Niveles por músculo a partir del trabajo, opcionalmente dividiendo entre semanas (media semanal). */
export function nivelesDeTrabajo(trabajo: ReadonlyMap<Musculo, TrabajoMuscular>, escala: readonly number[], semanas = 1): Map<Musculo, number> {
  const niveles = new Map<Musculo, number>()
  for (const [m, t] of trabajo) {
    const n = nivelIntensidad(t.series / semanas, escala)
    if (n > 0) niveles.set(m, n)
  }
  return niveles
}

/** Grupos musculares grandes que una rutina o un ciclo debería trabajar. */
export const GRUPOS_GRANDES: { nombre: string; musculos: Musculo[] }[] = [
  { nombre: 'Pecho', musculos: ['pecho'] },
  { nombre: 'Espalda', musculos: ['dorsales', 'espalda_alta'] },
  { nombre: 'Hombros', musculos: ['hombros'] },
  { nombre: 'Cuádriceps', musculos: ['cuadriceps'] },
  { nombre: 'Isquiotibiales', musculos: ['isquiotibiales'] },
  { nombre: 'Glúteos', musculos: ['gluteos', 'abductores'] },
]

/**
 * Grupos grandes que no se trabajan en ningún día del ciclo. Se considera trabajado
 * si suma al menos `minimo` series ponderadas (con 2 basta con un ejercicio secundario serio).
 */
export function gruposSinTrabajar(trabajo: ReadonlyMap<Musculo, TrabajoMuscular>, minimo = 2): string[] {
  return GRUPOS_GRANDES.filter((g) => g.musculos.reduce((t, m) => t + (trabajo.get(m)?.series ?? 0), 0) < minimo).map((g) => g.nombre)
}
