import Dexie, { type EntityTable } from 'dexie'
import { VERSION_CATALOGO } from '../catalogo/version'
import { migrarDatosV1, migrarMusculosEjercicio, sincronizarCatalogo, type DatosV1, type EjercicioCatalogo, type EjercicioRetirado } from '../domain/migracion'
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
import type { GrasaCorporal, MedidaCorporal } from '../domain/cuerpo'
import type { AguaDia, Alimento, PerfilNutricion, Plato, RegistroComida } from '../domain/tiposNutricion'

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
  // Nutrición (v4)
  alimentos!: EntityTable<Alimento, 'id'>
  comidas!: EntityTable<RegistroComida, 'id'>
  platos!: EntityTable<Plato, 'id'>
  agua!: EntityTable<AguaDia, 'id'>
  nutricion!: EntityTable<PerfilNutricion, 'id'>
  // Perfil corporal (v6)
  medidas!: EntityTable<MedidaCorporal, 'id'>
  grasas!: EntityTable<GrasaCorporal, 'id'>

  constructor(nombre = 'ferro') {
    super(nombre)
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

    // v2: la biblioteca pasa a Free Exercise DB. Se cambian los id de los ejercicios y todas
    // sus referencias, conservando historial, rutinas y notas (ver domain/migracion.ts).
    this.version(2)
      .stores({ ejercicios: 'id, categoria' })
      .upgrade(async (tx) => {
        const t = (n: keyof DatosV1) => tx.table(n)
        const datos: DatosV1 = {
          ejercicios: await t('ejercicios').toArray(),
          rutinaEjercicios: await t('rutinaEjercicios').toArray(),
          sesionEjercicios: await t('sesionEjercicios').toArray(),
          series: await t('series').toArray(),
          molestias: await t('molestias').toArray(),
        }
        const migrados = migrarDatosV1(datos)
        await t('ejercicios').clear()
        await t('ejercicios').bulkAdd(migrados.ejercicios)
        await t('rutinaEjercicios').bulkPut(migrados.rutinaEjercicios)
        await t('sesionEjercicios').bulkPut(migrados.sesionEjercicios)
        await t('series').bulkPut(migrados.series)
        await t('molestias').bulkPut(migrados.molestias)
        // Fuerza a sincronizar el catálogo completo en el siguiente arranque.
        await tx.table('ajustes').where('id').equals('ajustes').modify((a: Ajustes) => {
          delete a.versionCatalogo
        })
      })

    // v3 (ronda 2): los músculos pasan a ser las regiones del avatar (pectoral superior e inferior,
    // deltoides anterior/lateral/posterior…). La biblioteca nueva (peso libre, poleas y multipower) se
    // aplica al sincronizar el catálogo: los ejercicios usados que quedan fuera se conservan como retirados.
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table('ejercicios').toCollection().modify((e: Ejercicio) => {
          Object.assign(e, migrarMusculosEjercicio(e))
        })
        await tx.table('ajustes').where('id').equals('ajustes').modify((a: Ajustes) => {
          delete a.versionCatalogo
        })
      })

    // v4 (ronda 3): la sección de nutrición. Solo se añaden tablas nuevas y vacías; no se toca nada
    // de lo que ya había.
    this.version(4).stores({
      alimentos: 'id, codigo, nombre',
      comidas: 'id, fecha, alimentoId, [fecha+comida]',
      platos: 'id, nombre',
      agua: 'id',
      nutricion: 'id',
    })

    // v5 (ronda 4): división muscular completa. Los músculos de cada ejercicio (los propios y los
    // retirados; los de la biblioteca se ponen al día al sincronizar el catálogo) pasan de las 23
    // zonas a los músculos y porciones nuevos, con las mismas reglas que la biblioteca. No se borra
    // nada: el historial semanal se calcula de las series, así que sigue siendo coherente.
    this.version(5)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table('ejercicios').toCollection().modify((e: Ejercicio) => {
          Object.assign(e, migrarMusculosEjercicio(e))
        })
        await tx.table('ajustes').where('id').equals('ajustes').modify((a: Ajustes) => {
          delete a.versionCatalogo
        })
      })

    // v6 (ronda 4, avatar personalizado): medidas con cinta y porcentaje de grasa, con fecha. Solo se
    // añaden tablas nuevas y vacías; lo demás del perfil corporal va en los ajustes. No se toca nada más.
    this.version(6).stores({
      medidas: 'id, &fecha',
      grasas: 'id, fecha',
    })

    // v7 (ronda 5): división muscular simple. Los músculos de cada ejercicio (los propios y los
    // retirados; los de la biblioteca se ponen al día al sincronizar el catálogo) pasan a los 18
    // grupos. No se borra nada: el historial semanal se calcula de las series y sigue coherente.
    this.version(7)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table('ejercicios').toCollection().modify((e: Ejercicio) => {
          Object.assign(e, migrarMusculosEjercicio(e))
        })
        await tx.table('ajustes').where('id').equals('ajustes').modify((a: Ajustes) => {
          delete a.versionCatalogo
        })
      })

    this.on('populate', (tx) => {
      tx.table('ajustes').add(AJUSTES_POR_DEFECTO)
    })
  }
}

export const db = new FerroDB()

let sincronizando: Promise<void> | null = null

/**
 * Vuelca el catálogo de ejercicios en la base de datos si ha cambiado de versión
 * (primera vez, tras migrar o al actualizar la app). Conserva notas y personalizados.
 */
export function prepararCatalogo(): Promise<void> {
  sincronizando ??= (async () => {
    if (!(await db.ajustes.get('ajustes'))) await db.ajustes.put(AJUSTES_POR_DEFECTO)
    const ajustes = await db.ajustes.get('ajustes')
    if (ajustes?.versionCatalogo === VERSION_CATALOGO) return
    const { default: catalogo } = await import('../catalogo/ejercicios.json')
    await db.transaction('rw', [db.ejercicios, db.ajustes, db.rutinaEjercicios, db.sesionEjercicios, db.series, db.molestias], async () => {
      const existentes = await db.ejercicios.toArray()
      // Ejercicios con historial, en rutinas o con molestias: no se borran aunque salgan de la biblioteca.
      const usados = new Set<string>()
      for (const t of [db.rutinaEjercicios, db.sesionEjercicios, db.series, db.molestias] as const)
        for (const id of (await t.orderBy('ejercicioId').uniqueKeys()) as string[]) usados.add(id)
      for (const se of await db.sesionEjercicios.filter((s) => Boolean(s.sustituyeA)).toArray()) usados.add(se.sustituyeA!)
      const { poner, borrar } = sincronizarCatalogo(
        catalogo.ejercicios as EjercicioCatalogo[],
        existentes,
        usados,
        catalogo.retirados as EjercicioRetirado[],
      )
      await db.ejercicios.bulkDelete(borrar)
      await db.ejercicios.bulkPut(poner)
      await db.ajustes.update('ajustes', { versionCatalogo: VERSION_CATALOGO })
    })
  })().finally(() => {
    sincronizando = null
  })
  return sincronizando
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
