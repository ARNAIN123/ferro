import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { trabajoMuscular } from '../domain/mapaMuscular'
import { FerroDB } from './db'

const TABLAS_V3 = {
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
}

// La app instalada tiene la base de datos en la versión 3 (ronda 2). Al instalar la versión con
// nutrición, Dexie la sube a la 4: solo se añaden tablas, y todo lo anterior tiene que seguir igual.
describe('actualizar la base de datos de la v3 a la v4 (nutrición)', () => {
  it('conserva todos los datos y añade las tablas nuevas vacías', async () => {
    const nombre = 'ferro-prueba-v3'
    const vieja = new Dexie(nombre)
    vieja.version(3).stores(TABLAS_V3)
    await vieja.open()
    await vieja.table('rutinas').add({ id: 'r1', nombre: 'Torso A', posicionCiclo: 0 })
    await vieja.table('sesiones').add({ id: 's1', estado: 'terminada', entrada: 1, rutinaId: 'r1' })
    await vieja.table('series').add({ id: 'x1', sesionId: 's1', sesionEjercicioId: 'se1', ejercicioId: 'e1', peso: 60, reps: 8 })
    await vieja.table('pesosCorporales').add({ id: 'p1', fecha: '2026-11-01', kg: 80 })
    await vieja.table('ajustes').add({ id: 'ajustes', objetivoMensual: 16 })
    vieja.close()

    const nueva = new FerroDB(nombre)
    await nueva.open()
    expect(nueva.verno).toBeGreaterThanOrEqual(4)
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

// Ronda 4: la base de datos del móvil está en la versión 4 (con nutrición). Al subir a la 5, los
// músculos de los ejercicios pasan a la división completa y no se pierde nada.
describe('actualizar la base de datos de la v4 a la v5 (división muscular completa)', () => {
  it('convierte los músculos de los ejercicios propios y conserva entrenos, nutrición, peso y notas', async () => {
    const nombre = 'ferro-prueba-v4'
    const vieja = new Dexie(nombre)
    vieja.version(4).stores({ ...TABLAS_V3, alimentos: 'id, codigo, nombre', comidas: 'id, fecha, alimentoId, [fecha+comida]', platos: 'id, nombre', agua: 'id', nutricion: 'id' })
    await vieja.open()
    const propio = {
      id: 'mio-1',
      nombre: 'Remo en máquina con pecho apoyado',
      alias: '',
      musculosPrincipales: ['espalda_media', 'dorsales'],
      musculosSecundarios: ['biceps', 'deltoides_posterior'],
      material: 'maquina',
      categoria: 'fuerza',
      nivel: null,
      mecanica: 'compuesto',
      instrucciones: [],
      notasFijas: 'Asiento en el 4',
      personalizado: true,
      archivado: false,
    }
    await vieja.table('ejercicios').add(propio)
    await vieja.table('ejercicios').add({ ...propio, id: 'mio-2', nombre: 'Extensión de cuádriceps', musculosPrincipales: ['cuadriceps'], musculosSecundarios: [], mecanica: 'aislamiento' })
    await vieja.table('sesiones').add({ id: 's1', estado: 'terminada', entrada: 1 })
    await vieja.table('series').add({ id: 'x1', sesionId: 's1', sesionEjercicioId: 'se1', ejercicioId: 'mio-1', peso: 50, reps: 10, completada: true, inicio: 1 })
    await vieja.table('series').add({ id: 'x2', sesionId: 's1', sesionEjercicioId: 'se2', ejercicioId: 'mio-2', peso: 40, reps: 12, completada: true, inicio: 2 })
    await vieja.table('pesosCorporales').add({ id: 'p1', fecha: '2026-11-01', kg: 80 })
    await vieja.table('comidas').add({ id: 'c1', fecha: '2026-11-01', alimentoId: 'a1', comida: 'comida', gramos: 150 })
    await vieja.table('nutricion').add({ id: 'perfil', objetivo: 'mantener' })
    await vieja.table('ajustes').add({ id: 'ajustes', objetivoMensual: 16, versionCatalogo: 'viejo' })
    vieja.close()

    const nueva = new FerroDB(nombre)
    await nueva.open()
    expect(nueva.verno).toBeGreaterThanOrEqual(5)
    const remo = await nueva.ejercicios.get('mio-1')
    // "Zona media de la espalda" → espalda alta; dorsales → dorsales (los grupos de la ronda 5).
    expect(remo?.musculosPrincipales).toEqual(expect.arrayContaining(['dorsales', 'espalda_alta']))
    expect(remo?.musculosSecundarios).toEqual(expect.arrayContaining(['biceps', 'hombros']))
    expect(remo?.notasFijas).toBe('Asiento en el 4')
    expect((await nueva.ejercicios.get('mio-2'))?.musculosPrincipales).toEqual(['cuadriceps'])
    // Nada más cambia.
    expect(await nueva.series.count()).toBe(2)
    expect(await nueva.pesosCorporales.get('p1')).toMatchObject({ kg: 80 })
    expect(await nueva.comidas.get('c1')).toMatchObject({ gramos: 150 })
    expect(await nueva.nutricion.get('perfil')).toMatchObject({ objetivo: 'mantener' })
    // El catálogo se vuelve a sincronizar en el siguiente arranque.
    expect((await nueva.ajustes.get('ajustes'))?.versionCatalogo).toBeUndefined()
    // El historial semanal sigue siendo coherente: las series cuentan para los músculos nuevos.
    const trabajo = trabajoMuscular(await nueva.series.toArray(), new Map((await nueva.ejercicios.toArray()).map((e) => [e.id, e])))
    expect(trabajo.get('espalda_alta')?.series).toBe(1)
    expect(trabajo.get('cuadriceps')?.series).toBe(1)
    nueva.close()
  })
})

// Ronda 5: de la versión 6 a la 7 los músculos de los ejercicios pasan a los 18 grupos. Nada más
// cambia (el perfil corporal de la v6 incluido), y el catálogo se vuelve a sincronizar.
describe('actualizar la base de datos de la v6 a la v7 (grupos musculares)', () => {
  it('agrupa los músculos de los ejercicios y conserva entrenos, nutrición, peso, perfil y ajustes', async () => {
    const nombre = 'ferro-prueba-v6'
    const vieja = new Dexie(nombre)
    vieja.version(6).stores({
      ...TABLAS_V3,
      alimentos: 'id, codigo, nombre',
      comidas: 'id, fecha, alimentoId, [fecha+comida]',
      platos: 'id, nombre',
      agua: 'id',
      nutricion: 'id',
      medidas: 'id, &fecha',
      grasas: 'id, fecha',
    })
    await vieja.open()
    await vieja.table('ejercicios').add({ id: 'mio-1', nombre: 'Remo', musculosPrincipales: ['dorsal_ancho', 'romboides'], musculosSecundarios: ['biceps', 'braquial', 'redondo_mayor'], material: 'maquina', notasFijas: 'Asiento en el 4', personalizado: true })
    await vieja.table('sesiones').add({ id: 's1', estado: 'terminada', entrada: 1 })
    await vieja.table('series').add({ id: 'x1', sesionId: 's1', sesionEjercicioId: 'se1', ejercicioId: 'mio-1', peso: 50, reps: 10, completada: true, inicio: 1 })
    await vieja.table('pesosCorporales').bulkAdd([
      { id: 'p1', fecha: '2026-11-01', kg: 80 },
      { id: 'p2', fecha: '2026-11-08', kg: 79.4, origen: 'salud' },
    ])
    await vieja.table('comidas').add({ id: 'c1', fecha: '2026-11-01', alimentoId: 'a1', comida: 'comida', gramos: 150 })
    await vieja.table('agua').add({ id: '2026-11-01', ml: 1500 })
    await vieja.table('nutricion').add({ id: 'perfil', sexo: 'hombre', objetivo: 'mantener', basal: 1780 })
    await vieja.table('medidas').add({ id: 'm1', fecha: '2026-11-10', cintura: 84 })
    await vieja.table('grasas').add({ id: 'manual:2026-11-10', fecha: '2026-11-10', pct: 16, origen: 'manual' })
    await vieja.table('ajustes').add({ id: 'ajustes', objetivoMensual: 16, alturaCm: 178, edad: 28, sexo: 'hombre', versionCatalogo: 'abc' })
    vieja.close()

    const nueva = new FerroDB(nombre)
    await nueva.open()
    expect(nueva.verno).toBe(7)
    expect(await nueva.ejercicios.get('mio-1')).toMatchObject({ musculosPrincipales: ['dorsales', 'espalda_alta'], musculosSecundarios: ['biceps'], notasFijas: 'Asiento en el 4' })
    expect(await nueva.sesiones.count()).toBe(1)
    expect(await nueva.series.get('x1')).toMatchObject({ peso: 50, reps: 10 })
    expect(await nueva.pesosCorporales.count()).toBe(2)
    expect(await nueva.pesosCorporales.get('p2')).toMatchObject({ kg: 79.4, origen: 'salud' })
    expect(await nueva.comidas.get('c1')).toMatchObject({ gramos: 150 })
    expect(await nueva.agua.get('2026-11-01')).toMatchObject({ ml: 1500 })
    expect(await nueva.nutricion.get('perfil')).toMatchObject({ sexo: 'hombre', basal: 1780 })
    expect(await nueva.medidas.where('fecha').equals('2026-11-10').first()).toMatchObject({ cintura: 84 })
    expect(await nueva.grasas.get('manual:2026-11-10')).toMatchObject({ pct: 16 })
    // Los ajustes se conservan; solo se olvida la versión del catálogo para volver a sincronizarlo.
    const ajustes = await nueva.ajustes.get('ajustes')
    expect(ajustes).toMatchObject({ objetivoMensual: 16, alturaCm: 178, edad: 28, sexo: 'hombre' })
    expect(ajustes?.versionCatalogo).toBeUndefined()
    // El historial semanal sigue siendo coherente: las series cuentan para los grupos nuevos.
    const trabajo = trabajoMuscular(await nueva.series.toArray(), new Map((await nueva.ejercicios.toArray()).map((e) => [e.id, e])))
    expect(trabajo.get('dorsales')?.series).toBe(1)
    expect(trabajo.get('biceps')?.series).toBe(0.5)
    nueva.close()
  })
})
