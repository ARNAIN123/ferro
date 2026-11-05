import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { ESQUEMA_ACTUAL, TABLAS, type NombreTabla } from '../domain/copias'
import { AJUSTES_POR_DEFECTO } from '../domain/tipos'
import { generarCopiaJson, leerCopia, restaurarCopia } from './copias'
import { db } from './db'

// Datos como los de la PWA instalada (base de datos v2): se exportan, se borra todo
// (como en una instalación nueva de la app Android) y se importan otra vez.
type Fila = { id: string; [campo: string]: unknown }
const DATOS: Record<NombreTabla, Fila[]> = {
  ejercicios: [
    {
      id: 'Barbell_Bench_Press_-_Medium_Grip',
      nombre: 'Press de banca',
      alias: 'Barbell Bench Press - Medium Grip',
      musculosPrincipales: ['pecho'],
      musculosSecundarios: ['hombros', 'triceps'],
      material: 'barra',
      categoria: 'fuerza',
      nivel: 'principiante',
      mecanica: 'compuesto',
      instrucciones: ['Túmbate en el banco.'],
      notasFijas: 'Agarre a un palmo de los hombros',
      personalizado: false,
      archivado: false,
      reinicioProgresion: 1_700_000_000_000,
    },
    {
      id: 'propio-1',
      nombre: 'Remo en mi máquina rara',
      alias: '',
      musculosPrincipales: ['espalda_media'],
      musculosSecundarios: ['biceps'],
      material: 'maquina',
      categoria: 'fuerza',
      nivel: null,
      mecanica: null,
      instrucciones: [],
      notasFijas: 'Asiento en el 4',
      personalizado: true,
      archivado: false,
    },
  ],
  rutinas: [{ id: 'r1', nombre: 'A — Torso', posicionCiclo: 0, archivada: false, creada: 1 }],
  rutinaEjercicios: [
    {
      id: 're1',
      rutinaId: 'r1',
      ejercicioId: 'Barbell_Bench_Press_-_Medium_Grip',
      orden: 0,
      series: 3,
      repsMin: 8,
      repsMax: 12,
      descansoSeg: 150,
      nota: 'Pausa abajo',
      superserieConSiguiente: false,
    },
  ],
  entradas: [{ id: 'e1', hora: 1_730_000_000_000, origen: 'ubicacion', sesionId: 's1' }],
  sesiones: [
    {
      id: 's1',
      rutinaId: 'r1',
      rutinaNombre: 'A — Torso',
      entrada: 1_730_000_000_000,
      salida: 1_730_004_000_000,
      origenEntrada: 'ubicacion',
      estado: 'terminada',
      ultimaActividad: 1_730_003_900_000,
      descansoFin: null,
      descansoDuracion: null,
      ejercicioActivoId: 'se1',
    },
  ],
  sesionEjercicios: [
    {
      id: 'se1',
      sesionId: 's1',
      ejercicioId: 'Barbell_Bench_Press_-_Medium_Grip',
      orden: 0,
      seriesObjetivo: 3,
      repsMin: 8,
      repsMax: 12,
      descansoSeg: 150,
      nota: '',
      superserieConSiguiente: false,
      estado: 'activo',
      anadido: false,
    },
  ],
  series: [
    { id: 'x1', sesionId: 's1', sesionEjercicioId: 'se1', ejercicioId: 'Barbell_Bench_Press_-_Medium_Grip', orden: 0, tipo: 'calentamiento', peso: 40, reps: 10, rir: null, completada: true, hora: 1_730_000_500_000 },
    { id: 'x2', sesionId: 's1', sesionEjercicioId: 'se1', ejercicioId: 'Barbell_Bench_Press_-_Medium_Grip', orden: 1, tipo: 'normal', peso: 62.5, reps: 8, rir: 2, completada: true, hora: 1_730_000_900_000 },
  ],
  molestias: [{ id: 'm1', sesionId: 's1', ejercicioId: 'Barbell_Bench_Press_-_Medium_Grip', nota: 'Hombro derecho', hora: 1_730_001_000_000 }],
  pesosCorporales: [{ id: 'p1', fecha: '2026-10-30', kg: 78.4 }],
  ajustes: [{ ...AJUSTES_POR_DEFECTO, gimnasioLat: 40.4, gimnasioLng: -3.7, ultimaCopia: 5, versionCatalogo: 'x' }],
}

const porId = (filas: Fila[]) => [...filas].sort((a, b) => a.id.localeCompare(b.id))

describe('exportar e importar la copia JSON (de la PWA a la app Android)', () => {
  it('ESQUEMA_ACTUAL coincide con la versión de la base de datos', () => {
    expect(db.verno).toBe(ESQUEMA_ACTUAL)
  })

  it('no se pierde nada: rutinas, entrenos, series, notas, molestias, peso y ajustes', async () => {
    await db.open()
    await db.transaction('rw', TABLAS.map((t) => db.table(t)), async () => {
      for (const t of TABLAS) {
        await db.table(t).clear()
        await db.table(t).bulkAdd(DATOS[t])
      }
    })

    const { nombre, contenido } = await generarCopiaJson()
    expect(nombre).toMatch(/^ferro-copia-\d{4}-\d{2}-\d{2}\.json$/)

    // Instalación nueva: la base de datos empieza vacía (solo con los ajustes por defecto).
    await db.delete()
    await db.open()
    expect(await db.sesiones.count()).toBe(0)

    const leida = await leerCopia(new File([contenido], nombre, { type: 'application/json' }))
    expect(leida.ok).toBe(true)
    if (!leida.ok) return
    expect(leida.resumen).toBe('1 entrenos, 1 rutinas y 2 series')
    await restaurarCopia(leida.copia)

    for (const t of TABLAS) expect(porId(await db.table(t).toArray()), t).toEqual(porId(DATOS[t]))
  })
})
