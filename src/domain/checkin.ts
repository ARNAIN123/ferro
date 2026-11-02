// Detección de la entrada al gimnasio: deduplicación y geovalla.

export interface Coordenadas {
  lat: number
  lng: number
}

const RADIO_TIERRA_M = 6_371_000

/** Distancia en metros entre dos puntos (fórmula del haversine). */
export function distanciaMetros(a: Coordenadas, b: Coordenadas): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Lecturas con más error que esto no sirven para decidir nada. */
export const PRECISION_MAXIMA_M = 500

/**
 * ¿Estoy dentro del radio del gimnasio? Se concede un margen de hasta la mitad del radio
 * según la precisión del GPS (dentro de un edificio la señal empeora).
 */
export function dentroDelGimnasio(posicion: Coordenadas & { precision?: number }, gimnasio: Coordenadas, radioM: number): boolean {
  const precision = posicion.precision ?? 0
  if (precision > PRECISION_MAXIMA_M) return false
  const margen = Math.min(precision, radioM) / 2
  return distanciaMetros(posicion, gimnasio) <= radioM + margen
}

/** Deduplicación: como mucho una entrada cada `horas` horas. */
export function puedeRegistrarEntrada(entradas: readonly { hora: number }[], ahora: number, horas: number): boolean {
  const desde = ahora - horas * 3600_000
  return !entradas.some((e) => e.hora > desde && e.hora <= ahora)
}

/** Entrada más reciente dentro de la ventana de deduplicación, si la hay. */
export function entradaReciente<T extends { hora: number }>(entradas: readonly T[], ahora: number, horas: number): T | null {
  const desde = ahora - horas * 3600_000
  let mejor: T | null = null
  for (const e of entradas) if (e.hora > desde && e.hora <= ahora && (!mejor || e.hora > mejor.hora)) mejor = e
  return mejor
}

/** El enlace de check-in llega como /checkin o como cualquier ruta con ?checkin=auto. */
export function esEnlaceCheckin(ruta: string, busqueda: string): boolean {
  return ruta.replace(/\/+$/, '') === '/checkin' || new URLSearchParams(busqueda).get('checkin') === 'auto'
}

/** Si llegué hace más de esto, la hora de inicio del entreno es más fiable que la de la entrada. */
export const MAX_ESPERA_ENTRADA_MS = 60 * 60_000

/**
 * Qué entrada usar al empezar un entreno:
 * - una entrada reciente sin entreno (y de hace menos de una hora) se vincula y marca la hora de llegada;
 * - si la entrada reciente ya tiene un entreno (segundo entreno en la misma visita), no se crea otra;
 * - si no hay ninguna, se crea una manual ahora.
 */
export function vincularEntrada<T extends { hora: number; sesionId?: string }>(
  entradas: readonly T[],
  ahora: number,
  horas: number,
): { entrada: T | null; crear: boolean; vincular: boolean } {
  const reciente = entradaReciente(entradas, ahora, horas)
  if (!reciente) return { entrada: null, crear: true, vincular: true }
  if (reciente.sesionId) return { entrada: reciente, crear: false, vincular: false }
  if (ahora - reciente.hora > MAX_ESPERA_ENTRADA_MS) return { entrada: reciente, crear: false, vincular: false }
  return { entrada: reciente, crear: false, vincular: true }
}
