import { rutinasDelCiclo } from '../domain/ciclo'
import type { RutinaEjercicio } from '../domain/tipos'
import { nuevoId } from '../lib/id'
import { db } from './db'
import { leerAjustes } from '../hooks/useAjustes'

async function siguientePosicion(): Promise<number> {
  const ultima = await db.rutinas.orderBy('posicionCiclo').last()
  return ultima ? ultima.posicionCiclo + 1 : 0
}

export async function crearRutina(nombre: string): Promise<string> {
  const id = nuevoId()
  await db.rutinas.add({ id, nombre, posicionCiclo: await siguientePosicion(), archivada: false, creada: Date.now() })
  return id
}

export async function renombrarRutina(id: string, nombre: string): Promise<void> {
  await db.rutinas.update(id, { nombre })
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

export async function anadirEjercicioARutina(rutinaId: string, ejercicioId: string): Promise<void> {
  const { descansoDefecto } = await leerAjustes()
  const existentes = await db.rutinaEjercicios.where('rutinaId').equals(rutinaId).toArray()
  await db.rutinaEjercicios.add({
    id: nuevoId(),
    rutinaId,
    ejercicioId,
    orden: existentes.length ? Math.max(...existentes.map((e) => e.orden)) + 1 : 0,
    series: 3,
    repsMin: 8,
    repsMax: 12,
    descansoSeg: descansoDefecto,
    nota: '',
    superserieConSiguiente: false,
  })
}

export async function actualizarEjercicioDeRutina(id: string, cambios: Partial<Omit<RutinaEjercicio, 'id'>>): Promise<void> {
  await db.rutinaEjercicios.update(id, cambios)
}

export async function quitarEjercicioDeRutina(id: string): Promise<void> {
  await db.rutinaEjercicios.delete(id)
}

export async function ordenarEjerciciosDeRutina(ids: string[]): Promise<void> {
  await db.transaction('rw', db.rutinaEjercicios, async () => {
    await Promise.all(ids.map((id, orden) => db.rutinaEjercicios.update(id, { orden })))
  })
}
