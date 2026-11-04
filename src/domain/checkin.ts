// Entradas al gimnasio en la app: la más reciente y cuál usar al empezar un entreno.
// La decisión de la entrada y la salida (distancia, precisión, deduplicación) es nativa: ver Reglas.kt.

/** Entrada más reciente dentro de la ventana de deduplicación, si la hay. */
export function entradaReciente<T extends { hora: number }>(entradas: readonly T[], ahora: number, horas: number): T | null {
  const desde = ahora - horas * 3600_000
  let mejor: T | null = null
  for (const e of entradas) if (e.hora > desde && e.hora <= ahora && (!mejor || e.hora > mejor.hora)) mejor = e
  return mejor
}

/** Si llegué hace más de esto, la hora de inicio del entreno es más fiable que la de la entrada. */
export const MAX_ESPERA_ENTRADA_MS = 60 * 60_000

/**
 * Qué entrada usar al empezar un entreno:
 * - una entrada reciente sin entreno (y de hace menos de una hora) se vincula y marca la hora de llegada;
 * - si la entrada reciente ya tiene un entreno (segundo entreno en la misma visita), no se crea otra;
 * - si no hay ninguna, se crea una ahora (origen 'entreno').
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
