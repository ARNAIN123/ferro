// Pesos que llegan de una báscula a través de Health Connect: uno por día, sin duplicados y sin
// pisar nunca lo que yo he apuntado a mano.
import { claveDia } from './semanas'

export interface PesoSalud {
  kg: number
  /** Hora de la medición (ms). */
  hora: number
}

export interface PesoGuardado {
  id: string
  fecha: string
  kg: number
  /** 'salud' si vino de Health Connect; sin origen (o 'manual') si lo apunté yo. */
  origen?: 'manual' | 'salud'
}

const PLAUSIBLE = { min: 30, max: 250 }
const redondear = (kg: number) => Math.round(kg * 10) / 10

/**
 * Qué hacer con las mediciones de Health Connect: de cada día vale la última; si ese día no hay
 * registro se añade, si lo hay de Health Connect y ha cambiado se actualiza, y si lo apunté a mano
 * no se toca.
 */
export function planificarPesosSalud(
  existentes: readonly PesoGuardado[],
  salud: readonly PesoSalud[],
): { nuevos: { fecha: string; kg: number }[]; actualizar: { id: string; kg: number }[] } {
  const ultimaDelDia = new Map<string, PesoSalud>()
  for (const m of salud) {
    if (!(m.kg >= PLAUSIBLE.min && m.kg <= PLAUSIBLE.max)) continue
    const dia = claveDia(m.hora)
    const previa = ultimaDelDia.get(dia)
    if (!previa || m.hora > previa.hora) ultimaDelDia.set(dia, m)
  }
  const porFecha = new Map(existentes.map((p) => [p.fecha, p]))
  const nuevos: { fecha: string; kg: number }[] = []
  const actualizar: { id: string; kg: number }[] = []
  for (const [fecha, m] of [...ultimaDelDia].sort((a, b) => a[0].localeCompare(b[0]))) {
    const kg = redondear(m.kg)
    const ya = porFecha.get(fecha)
    if (!ya) nuevos.push({ fecha, kg })
    else if (ya.origen === 'salud' && ya.kg !== kg) actualizar.push({ id: ya.id, kg })
  }
  return { nuevos, actualizar }
}
