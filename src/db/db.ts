import Dexie, { type EntityTable } from 'dexie'
import {
  AJUSTES_POR_DEFECTO,
  type Ajustes,
  type Ejercicio,
  type Entrada,
  type Molestia,
  type PesoCorporal,
  type Rutina,
  type RutinaEjercicio,
  type Serie,
  type Sesion,
  type SesionEjercicio,
} from '../domain/tipos'
import { EJERCICIOS_SEMILLA } from './seed-ejercicios'

export class FerroDB extends Dexie {
  ejercicios!: EntityTable<Ejercicio, 'id'>
  rutinas!: EntityTable<Rutina, 'id'>
  rutinaEjercicios!: EntityTable<RutinaEjercicio, 'id'>
  entradas!: EntityTable<Entrada, 'id'>
  sesiones!: EntityTable<Sesion, 'id'>
  sesionEjercicios!: EntityTable<SesionEjercicio, 'id'>
  series!: EntityTable<Serie, 'id'>
  molestias!: EntityTable<Molestia, 'id'>
  pesosCorporales!: EntityTable<PesoCorporal, 'id'>
  ajustes!: EntityTable<Ajustes, 'id'>

  constructor() {
    super('ferro')
    this.version(1).stores({
      ejercicios: 'id, musculoPrincipal',
      rutinas: 'id, posicionCiclo',
      rutinaEjercicios: 'id, rutinaId, ejercicioId',
      entradas: 'id, hora',
      sesiones: 'id, estado, entrada, rutinaId',
      sesionEjercicios: 'id, sesionId, ejercicioId',
      series: 'id, sesionId, sesionEjercicioId, ejercicioId',
      molestias: 'id, sesionId, ejercicioId',
      pesosCorporales: 'id, &fecha',
      ajustes: 'id',
    })
    this.on('populate', (tx) => {
      tx.table('ejercicios').bulkAdd(EJERCICIOS_SEMILLA)
      tx.table('ajustes').add(AJUSTES_POR_DEFECTO)
    })
  }
}

export const db = new FerroDB()

/** Añade ejercicios nuevos de la biblioteca en actualizaciones de la app sin tocar los existentes. */
export async function completarBiblioteca(): Promise<void> {
  const existentes = new Set(await db.ejercicios.toCollection().primaryKeys())
  const nuevos = EJERCICIOS_SEMILLA.filter((e) => !existentes.has(e.id))
  if (nuevos.length) await db.ejercicios.bulkAdd(nuevos)
  if (!(await db.ajustes.get('ajustes'))) await db.ajustes.add(AJUSTES_POR_DEFECTO)
}

/** Pide al navegador que no borre IndexedDB por falta de espacio. */
export async function pedirPersistencia(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
