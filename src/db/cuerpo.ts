// Perfil corporal: medidas con cinta y porcentaje de grasa, con fecha (un registro por día).
import { MEDIDAS, type GrasaCorporal, type MedidaCorporal, type NombreMedida } from '../domain/cuerpo'
import { claveDia, sumarDias } from '../domain/semanas'
import { nuevoId } from '../lib/id'
import { Salud, haySalud } from '../lib/salud'
import { db } from './db'

/**
 * Guarda las medidas de un día. Las que llegan con valor se apuntan; las que llegan con null se
 * quitan; las que no llegan se quedan como estaban. Un día sin ninguna medida se borra.
 */
export async function guardarMedidas(fecha: string, valores: Partial<Record<NombreMedida, number | null>>): Promise<void> {
  await db.transaction('rw', db.medidas, async () => {
    const previa = await db.medidas.where('fecha').equals(fecha).first()
    const registro: MedidaCorporal = { ...(previa ?? { id: nuevoId(), fecha }) }
    for (const m of MEDIDAS) {
      const v = valores[m]
      if (v === null) delete registro[m]
      else if (v !== undefined) registro[m] = Math.round(v * 10) / 10
    }
    if (MEDIDAS.some((m) => registro[m] !== undefined)) await db.medidas.put(registro)
    else if (previa) await db.medidas.delete(previa.id)
  })
}

export const borrarMedidas = (id: string) => db.medidas.delete(id)

/** Porcentaje de grasa escrito a mano (uno por día). */
export async function guardarGrasa(fecha: string, pct: number): Promise<void> {
  await db.grasas.put({ id: `manual:${fecha}`, fecha, pct: Math.round(pct * 10) / 10, origen: 'manual' })
}

export const borrarGrasa = (id: string) => db.grasas.delete(id)

const CADA_MS = 10 * 60_000
let ultimaImportacion = 0

/**
 * Trae el porcentaje de grasa que una báscula haya dejado en Health Connect (últimos 6 meses): de
 * cada día vale la última medición. No toca lo escrito a mano. Como mucho cada 10 minutos.
 */
export async function importarGrasaDeSalud(forzar = false): Promise<number> {
  if (!haySalud() || (!forzar && Date.now() - ultimaImportacion < CADA_MS)) return 0
  ultimaImportacion = Date.now()
  const estado = await Salud.estado()
  if (estado.disponible !== 'si' || !estado.grasa) return 0
  const { grasas } = await Salud.grasas({ desde: sumarDias(Date.now(), -180), hasta: Date.now() })
  const delDia = new Map<string, { pct: number; hora: number }>()
  for (const g of grasas) {
    if (!(g.pct >= 3 && g.pct <= 65)) continue
    const dia = claveDia(g.hora)
    const previa = delDia.get(dia)
    if (!previa || g.hora > previa.hora) delDia.set(dia, g)
  }
  const nuevas: GrasaCorporal[] = [...delDia].map(([fecha, g]) => ({ id: `salud:${fecha}`, fecha, pct: Math.round(g.pct * 10) / 10, origen: 'salud' }))
  if (nuevas.length) await db.grasas.bulkPut(nuevas)
  return nuevas.length
}
