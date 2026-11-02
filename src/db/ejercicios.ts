import type { Ejercicio } from '../domain/tipos'
import { nuevoId } from '../lib/id'
import { db } from './db'

export type DatosEjercicio = Pick<
  Ejercicio,
  'nombre' | 'musculoPrincipal' | 'musculosSecundarios' | 'material' | 'saltoPeso' | 'notasFijas'
>

export async function crearEjercicio(datos: DatosEjercicio): Promise<string> {
  const id = nuevoId()
  await db.ejercicios.add({ ...datos, id, personalizado: true, archivado: false })
  return id
}

export async function actualizarEjercicio(id: string, cambios: Partial<Omit<Ejercicio, 'id'>>): Promise<void> {
  await db.ejercicios.update(id, cambios)
}

export async function archivarEjercicio(id: string, archivado: boolean): Promise<void> {
  await db.ejercicios.update(id, { archivado })
}
