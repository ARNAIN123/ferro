import { nuevoId } from '../lib/id'
import { db } from './db'

/** Un registro por día: si ya había uno hoy, se sustituye. */
export async function guardarPeso(fecha: string, kg: number): Promise<void> {
  await db.transaction('rw', db.pesosCorporales, async () => {
    const existente = await db.pesosCorporales.where('fecha').equals(fecha).first()
    if (existente) await db.pesosCorporales.update(existente.id, { kg })
    else await db.pesosCorporales.add({ id: nuevoId(), fecha, kg })
  })
}

export async function borrarPeso(id: string): Promise<void> {
  await db.pesosCorporales.delete(id)
}
