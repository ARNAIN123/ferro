import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { FerroDB } from './db'

// La app instalada tiene la base de datos en la versión 3 (ronda 2). Al instalar la versión con
// nutrición, Dexie la sube a la 4: solo se añaden tablas, y todo lo anterior tiene que seguir igual.
describe('actualizar la base de datos de la v3 a la v4 (nutrición)', () => {
  it('conserva todos los datos y añade las tablas nuevas vacías', async () => {
    const nombre = 'ferro-prueba-v3'
    const vieja = new Dexie(nombre)
    vieja.version(3).stores({
      ejercicios: 'id, categoria',
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
    await vieja.open()
    await vieja.table('rutinas').add({ id: 'r1', nombre: 'Torso A', posicionCiclo: 0 })
    await vieja.table('sesiones').add({ id: 's1', estado: 'terminada', entrada: 1, rutinaId: 'r1' })
    await vieja.table('series').add({ id: 'x1', sesionId: 's1', sesionEjercicioId: 'se1', ejercicioId: 'e1', peso: 60, reps: 8 })
    await vieja.table('pesosCorporales').add({ id: 'p1', fecha: '2026-11-01', kg: 80 })
    await vieja.table('ajustes').add({ id: 'ajustes', objetivoMensual: 16 })
    vieja.close()

    const nueva = new FerroDB(nombre)
    await nueva.open()
    expect(nueva.verno).toBe(4)
    expect(await nueva.rutinas.get('r1')).toMatchObject({ nombre: 'Torso A' })
    expect(await nueva.sesiones.count()).toBe(1)
    expect(await nueva.series.get('x1')).toMatchObject({ peso: 60, reps: 8 })
    expect(await nueva.pesosCorporales.get('p1')).toMatchObject({ kg: 80 })
    expect(await nueva.ajustes.get('ajustes')).toMatchObject({ objetivoMensual: 16 })
    expect(await nueva.comidas.count()).toBe(0)
    expect(await nueva.alimentos.count()).toBe(0)
    nueva.close()
  })
})
