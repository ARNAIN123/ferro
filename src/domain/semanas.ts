// Fechas locales y semanas (lunes a domingo). Nada de rachas diarias: descansar no rompe nada.

/** Día local en formato AAAA-MM-DD. */
export function claveDia(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function inicioDia(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Lunes a las 00:00 de la semana de `t`. */
export function inicioSemana(t: number): number {
  const d = new Date(inicioDia(t))
  const desdeLunes = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - desdeLunes)
  return d.getTime()
}

export function sumarDias(t: number, dias: number): number {
  const d = new Date(t)
  d.setDate(d.getDate() + dias)
  return d.getTime()
}

/** Los 7 días (inicio de cada uno) de la semana de `t`. */
export function diasDeSemana(t: number): number[] {
  const lunes = inicioSemana(t)
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

/** Número de días distintos entrenados en la semana de `t`. */
export function diasEntrenadosEnSemana(horas: readonly number[], t: number): number {
  const lunes = inicioSemana(t)
  const siguiente = sumarDias(lunes, 7)
  return new Set(horas.filter((h) => h >= lunes && h < siguiente).map(claveDia)).size
}

/**
 * Semanas seguidas cumpliendo el objetivo. La semana actual suma si ya está cumplida,
 * pero si aún no lo está no rompe la racha (todavía quedan días).
 */
export function rachaSemanas(horas: readonly number[], objetivo: number, ahora: number): number {
  if (objetivo <= 0) return 0
  const porSemana = new Map<number, Set<string>>()
  for (const h of horas) {
    const s = inicioSemana(h)
    const dias = porSemana.get(s) ?? new Set<string>()
    dias.add(claveDia(h))
    porSemana.set(s, dias)
  }
  const cumple = (semana: number) => (porSemana.get(semana)?.size ?? 0) >= objetivo
  const actual = inicioSemana(ahora)
  let racha = cumple(actual) ? 1 : 0
  for (let s = inicioSemana(sumarDias(actual, -7)); cumple(s); s = inicioSemana(sumarDias(s, -7))) racha++
  return racha
}
