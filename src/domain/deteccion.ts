// Paso de los eventos de la detección nativa (entradas y salidas del gimnasio) a la base de datos.
import type { Entrada } from './tipos'

export type EventoDeteccion =
  | { id: string; tipo: 'entrada'; hora: number }
  /** `entrada` es la hora de la entrada a la que corresponde la salida. */
  | { id: string; tipo: 'salida'; hora: number; entrada: number }

export interface PlanDeteccion {
  nuevas: Entrada[]
  cambios: { id: string; cambios: Partial<Entrada> }[]
  /** Sesiones cuya hora de llegada se adelanta a la de la entrada detectada. */
  llegadas: { sesionId: string; hora: number }[]
  /** Entreno en curso que se cierra con la hora de salida. */
  cerrar: { sesionId: string; salida: number } | null
}

const cerca = (a: number, b: number, horas: number) => Math.abs(a - b) < horas * 3600_000

/**
 * Decide qué cambiar en la base de datos para unos eventos de la detección:
 * - Entrada: se crea, salvo que ya haya otra en la ventana de deduplicación. Si esa otra la creó el
 *   respaldo del entreno (porque el aviso llegó tarde), se corrige con la hora detectada, que es la real.
 * - Salida: se apunta en su entrada y, si hay un entreno en curso que empezó antes, se cierra con esa hora.
 */
export function planificarEventos(
  eventos: readonly EventoDeteccion[],
  entradas: readonly Entrada[],
  enCurso: { id: string; entrada: number } | null,
  horas: number,
): PlanDeteccion {
  const plan: PlanDeteccion = { nuevas: [], cambios: [], llegadas: [], cerrar: null }
  const todas: Entrada[] = entradas.map((e) => ({ ...e }))
  const cambiar = (e: Entrada, cambios: Partial<Entrada>) => {
    Object.assign(e, cambios)
    const previo = plan.cambios.find((c) => c.id === e.id)
    if (previo) Object.assign(previo.cambios, cambios)
    else plan.cambios.push({ id: e.id, cambios: { ...cambios } })
  }

  for (const ev of [...eventos].sort((a, b) => a.hora - b.hora)) {
    if (ev.tipo === 'entrada') {
      if (todas.some((e) => e.id === ev.id)) continue
      const previa = todas.find((e) => cerca(e.hora, ev.hora, horas))
      if (!previa) {
        const nueva: Entrada = { id: ev.id, hora: ev.hora, origen: 'deteccion' }
        todas.push({ ...nueva })
        plan.nuevas.push(nueva)
      } else if (previa.origen === 'entreno' && ev.hora < previa.hora) {
        cambiar(previa, { hora: ev.hora, origen: 'deteccion' })
        if (previa.sesionId) plan.llegadas.push({ sesionId: previa.sesionId, hora: ev.hora })
      }
      continue
    }

    const suya =
      todas.find((e) => e.origen === 'deteccion' && e.hora === ev.entrada) ??
      todas
        .filter((e) => e.hora <= ev.hora && cerca(e.hora, ev.hora, horas * 2))
        .sort((a, b) => b.hora - a.hora)[0]
    if (suya && suya.salida === undefined) cambiar(suya, { salida: ev.hora })
    if (enCurso && enCurso.entrada <= ev.hora) plan.cerrar = { sesionId: enCurso.id, salida: ev.hora }
  }
  return plan
}
