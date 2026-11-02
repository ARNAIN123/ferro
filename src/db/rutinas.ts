import { rutinasDelCiclo } from '../domain/ciclo'
import type { ItemPlan } from '../domain/rutinas'
import { nuevoId } from '../lib/id'
import { db } from './db'

async function siguientePosicion(): Promise<number> {
  const ultima = await db.rutinas.orderBy('posicionCiclo').filter((r) => !r.archivada).last()
  return ultima ? ultima.posicionCiclo + 1 : 0
}

/**
 * Guarda una rutina del editor de una vez: nombre y lista de ejercicios.
 * Si es nueva se añade al final del ciclo. Devuelve su id.
 */
export async function guardarRutina(borrador: { id: string | null; nombre: string; items: readonly ItemPlan[] }): Promise<string> {
  return db.transaction('rw', db.rutinas, db.rutinaEjercicios, async () => {
    let id = borrador.id
    if (id && (await db.rutinas.get(id))) {
      await db.rutinas.update(id, { nombre: borrador.nombre })
      await db.rutinaEjercicios.where('rutinaId').equals(id).delete()
    } else {
      id = nuevoId()
      await db.rutinas.add({ id, nombre: borrador.nombre, posicionCiclo: await siguientePosicion(), archivada: false, creada: Date.now() })
    }
    const rutinaId = id
    await db.rutinaEjercicios.bulkAdd(
      borrador.items.map((it, orden) => ({
        id: nuevoId(),
        rutinaId,
        ejercicioId: it.ejercicioId,
        orden,
        series: it.series,
        repsMin: it.repsMin,
        repsMax: it.repsMax,
        descansoSeg: it.descansoSeg,
        nota: it.nota,
        superserieConSiguiente: orden < borrador.items.length - 1 && it.superserieConSiguiente,
      })),
    )
    return rutinaId
  })
}

export async function archivarRutina(id: string, archivada: boolean): Promise<void> {
  const posicionCiclo = archivada ? Number.MAX_SAFE_INTEGER : await siguientePosicion()
  await db.rutinas.update(id, { archivada, posicionCiclo })
  await normalizarCiclo()
}

export async function duplicarRutina(id: string): Promise<string | null> {
  const original = await db.rutinas.get(id)
  if (!original) return null
  const nuevaId = nuevoId()
  await db.transaction('rw', db.rutinas, db.rutinaEjercicios, async () => {
    const ejercicios = await db.rutinaEjercicios.where('rutinaId').equals(id).toArray()
    await db.rutinas.add({
      id: nuevaId,
      nombre: `${original.nombre} (copia)`,
      posicionCiclo: await siguientePosicion(),
      archivada: false,
      creada: Date.now(),
    })
    await db.rutinaEjercicios.bulkAdd(ejercicios.map((e) => ({ ...e, id: nuevoId(), rutinaId: nuevaId })))
  })
  return nuevaId
}

export async function eliminarRutina(id: string): Promise<void> {
  await db.transaction('rw', db.rutinas, db.rutinaEjercicios, async () => {
    await db.rutinaEjercicios.where('rutinaId').equals(id).delete()
    await db.rutinas.delete(id)
  })
  await normalizarCiclo()
}

/** Guarda el nuevo orden del ciclo tras arrastrar. */
export async function ordenarCiclo(ids: string[]): Promise<void> {
  await db.transaction('rw', db.rutinas, async () => {
    await Promise.all(ids.map((id, posicionCiclo) => db.rutinas.update(id, { posicionCiclo })))
  })
}

async function normalizarCiclo(): Promise<void> {
  const ciclo = rutinasDelCiclo(await db.rutinas.toArray())
  await ordenarCiclo(ciclo.map((r) => r.id))
}
