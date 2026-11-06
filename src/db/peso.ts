import { planificarPesosSalud } from '../domain/pesoSalud'
import { sumarDias } from '../domain/semanas'
import { nuevoId } from '../lib/id'
import { Salud, haySalud } from '../lib/salud'
import { db } from './db'

/** Un registro por día: si ya había uno ese día, se sustituye (y pasa a ser mío, no de la báscula). */
export async function guardarPeso(fecha: string, kg: number): Promise<void> {
  await db.transaction('rw', db.pesosCorporales, async () => {
    const existente = await db.pesosCorporales.where('fecha').equals(fecha).first()
    if (existente) await db.pesosCorporales.update(existente.id, { kg, origen: 'manual' })
    else await db.pesosCorporales.add({ id: nuevoId(), fecha, kg, origen: 'manual' })
  })
}

export async function borrarPeso(id: string): Promise<void> {
  await db.pesosCorporales.delete(id)
}

const CADA_MS = 10 * 60_000
let ultimaImportacion = 0

/**
 * Trae los pesos de una báscula conectada a Health Connect (últimos 30 días), uno por día y sin
 * pisar los que apunté a mano. Como mucho cada 10 minutos.
 */
export async function importarPesoDeSalud(): Promise<number> {
  if (!haySalud() || Date.now() - ultimaImportacion < CADA_MS) return 0
  ultimaImportacion = Date.now()
  const estado = await Salud.estado()
  if (estado.disponible !== 'si' || !estado.peso) return 0
  const { pesos } = await Salud.pesos({ desde: sumarDias(Date.now(), -30), hasta: Date.now() })
  if (!pesos.length) return 0
  return db.transaction('rw', db.pesosCorporales, async () => {
    const existentes = await db.pesosCorporales.toArray()
    const plan = planificarPesosSalud(existentes, pesos)
    for (const n of plan.nuevos) await db.pesosCorporales.add({ id: nuevoId(), fecha: n.fecha, kg: n.kg, origen: 'salud' })
    for (const a of plan.actualizar) await db.pesosCorporales.update(a.id, { kg: a.kg })
    return plan.nuevos.length + plan.actualizar.length
  })
}
