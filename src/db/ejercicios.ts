import type { Material, Musculo } from '../domain/tipos'
import { nuevoId } from '../lib/id'
import { db } from './db'

export interface DatosEjercicioPropio {
  nombre: string
  musculosPrincipales: Musculo[]
  musculosSecundarios: Musculo[]
  material: Material
}

/** Ejercicio propio (solo para lo que no existe en la biblioteca). Una vez creado, sus músculos y material quedan fijos. */
export async function crearEjercicio(datos: DatosEjercicioPropio): Promise<string> {
  const id = nuevoId()
  await db.ejercicios.add({
    ...datos,
    id,
    alias: '',
    categoria: 'fuerza',
    nivel: null,
    mecanica: null,
    instrucciones: [],
    imagenes: 0,
    notasFijas: '',
    personalizado: true,
    archivado: false,
  })
  return id
}

/** Mis notas: lo único editable de la ficha de un ejercicio. */
export async function guardarNotas(id: string, notasFijas: string): Promise<void> {
  await db.ejercicios.update(id, { notasFijas })
}

export async function archivarEjercicio(id: string, archivado: boolean): Promise<void> {
  await db.ejercicios.update(id, { archivado })
}

export async function marcarReinicioProgresion(id: string): Promise<void> {
  await db.ejercicios.update(id, { reinicioProgresion: Date.now() })
}
