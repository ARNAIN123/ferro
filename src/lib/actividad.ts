// Actividad real reciente para el gasto inicial de nutrición: entrenos de las últimas 4 semanas
// (calorías netas con el MET de la densidad de cada sesión) y pasos de los últimos 7 días.
import { db } from '../db/db'
import { caloriasNetas, caloriasPasos, densidadSesion, metDeSesion } from '../domain/calorias'
import { inicioDia, sumarDias } from '../domain/semanas'
import { Salud, haySalud } from './salud'

/** Pasos al día que se suponen si no hay datos de Health Connect. */
export const PASOS_SUPUESTOS = 5000

export interface ActividadReciente {
  /** kcal netas de media al día (pasos + entrenos). */
  kcal: number
  pasosMedios: number
  pasosReales: boolean
  entrenosSemana: number
}

export async function actividadReciente(kg: number, alturaCm: number): Promise<ActividadReciente> {
  const ahora = Date.now()
  const desde = sumarDias(inicioDia(ahora), -28)
  const sesiones = (await db.sesiones.where('entrada').aboveOrEqual(desde).toArray()).filter((s) => s.estado === 'terminada')
  let kcalEntrenos = 0
  for (const s of sesiones) {
    const series = await db.series.where('sesionId').equals(s.id).toArray()
    const d = densidadSesion(s.entrada, s.salida, series)
    if (d) kcalEntrenos += caloriasNetas(metDeSesion(d, kg), kg, d.minutos)
  }
  let pasosMedios = PASOS_SUPUESTOS
  let pasosReales = false
  if (haySalud()) {
    try {
      const estado = await Salud.estado()
      if (estado.disponible === 'si' && estado.pasos) {
        const hoy = inicioDia(ahora)
        const tramos = Array.from({ length: 7 }, (_, i) => ({ desde: sumarDias(hoy, -7 + i), hasta: sumarDias(hoy, -6 + i) }))
        const { pasos } = await Salud.pasos({ tramos })
        const conDatos = pasos.filter((p) => p > 0)
        if (conDatos.length >= 3) {
          pasosMedios = Math.round(conDatos.reduce((a, b) => a + b, 0) / conDatos.length)
          pasosReales = true
        }
      }
    } catch {
      // Sin pasos reales se usa la suposición.
    }
  }
  return {
    kcal: Math.round(kcalEntrenos / 28 + caloriasPasos(pasosMedios, kg, alturaCm).kcal),
    pasosMedios,
    pasosReales,
    entrenosSemana: Math.round((sesiones.length / 4) * 10) / 10,
  }
}
