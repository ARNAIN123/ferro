// Ciclo de rutinas: lo que toca depende de la última rutina hecha, no del día de la semana.

export interface RutinaCiclo {
  id: string
  posicionCiclo: number
  archivada: boolean
}

export interface SesionCiclo {
  rutinaId: string | null
  entrada: number
  estado: 'en_curso' | 'terminada'
}

/** Rutinas activas en el orden del ciclo. */
export function rutinasDelCiclo<T extends RutinaCiclo>(rutinas: readonly T[]): T[] {
  return rutinas.filter((r) => !r.archivada).sort((a, b) => a.posicionCiclo - b.posicionCiclo)
}

/** Id de la rutina del ciclo hecha más recientemente (ignora entrenos libres y rutinas fuera del ciclo). */
export function ultimaRutinaHecha(sesiones: readonly SesionCiclo[], rutinas: readonly RutinaCiclo[]): string | null {
  const enCiclo = new Set(rutinasDelCiclo(rutinas).map((r) => r.id))
  let mejor: SesionCiclo | null = null
  for (const s of sesiones) {
    if (s.estado !== 'terminada' || !s.rutinaId || !enCiclo.has(s.rutinaId)) continue
    if (!mejor || s.entrada > mejor.entrada) mejor = s
  }
  return mejor?.rutinaId ?? null
}

/** La rutina que toca: la siguiente a la última hecha, volviendo al principio al acabar el ciclo. */
export function siguienteRutina<T extends RutinaCiclo>(rutinas: readonly T[], ultimaId: string | null): T | null {
  const ciclo = rutinasDelCiclo(rutinas)
  if (ciclo.length === 0) return null
  const i = ultimaId ? ciclo.findIndex((r) => r.id === ultimaId) : -1
  return ciclo[(i + 1) % ciclo.length] ?? null
}

/** Atajo: qué toca hoy a partir del historial. */
export function rutinaQueToca<T extends RutinaCiclo>(rutinas: readonly T[], sesiones: readonly SesionCiclo[]): T | null {
  return siguienteRutina(rutinas, ultimaRutinaHecha(sesiones, rutinas))
}

/** Mueve un elemento de una posición a otra (para arrastrar y soltar). */
export function mover<T>(lista: readonly T[], desde: number, hasta: number): T[] {
  const copia = [...lista]
  const [item] = copia.splice(desde, 1)
  if (item === undefined) return copia
  copia.splice(Math.max(0, Math.min(hasta, copia.length)), 0, item)
  return copia
}

/** Posiciones consecutivas 0..n-1 según el orden recibido. */
export function numerar<T extends { id: string }>(lista: readonly T[]): { id: string; posicion: number }[] {
  return lista.map((r, posicion) => ({ id: r.id, posicion }))
}

/** Letra del ciclo: A, B, C… (AA, AB… si hubiera más de 26). */
export function letraCiclo(indice: number): string {
  let n = indice
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}
