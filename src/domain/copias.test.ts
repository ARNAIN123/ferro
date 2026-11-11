import { describe, expect, it } from 'vitest'
import { crearCopia, ESQUEMA_ACTUAL, esquemaDeCopia, migrarCopia, necesitaCopia, seriesACsv, TABLAS, validarCopia, type Copia, type NombreTabla } from './copias'

const vacio = () => Object.fromEntries(TABLAS.map((t) => [t, []])) as unknown as Record<NombreTabla, { id: string }[]>

describe('copias de seguridad JSON', () => {
  it('una copia exportada se valida al importarla', () => {
    const datos = { ...vacio(), sesiones: [{ id: 's1' }], rutinas: [{ id: 'r1' }] }
    const r = validarCopia(JSON.parse(JSON.stringify(crearCopia(datos, 0))))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.resumen).toBe('1 entrenos, 1 rutinas y 0 series')
  })

  it('rechaza archivos que no son de Ferro o están dañados', () => {
    expect(validarCopia(null).ok).toBe(false)
    expect(validarCopia({ app: 'otra', version: 1, datos: {} }).ok).toBe(false)
    expect(validarCopia({ app: 'ferro', version: 99, datos: {} }).ok).toBe(false)
    expect(validarCopia({ app: 'ferro', version: 1, datos: { series: 'x' } }).ok).toBe(false)
    expect(validarCopia({ app: 'ferro', version: 1, datos: { series: [{ peso: 1 }] } }).ok).toBe(false)
  })

  it('las tablas que faltan se importan vacías', () => {
    const r = validarCopia({ app: 'ferro', version: 1, datos: { rutinas: [{ id: 'r' }] } })
    expect(r.ok && r.copia.datos.series).toEqual([])
  })
})

describe('copias de versiones anteriores', () => {
  it('las copias nuevas guardan el esquema y no se aceptan las de un esquema futuro', () => {
    expect(crearCopia(vacio(), 0).esquema).toBe(ESQUEMA_ACTUAL)
    expect(validarCopia({ app: 'ferro', version: 1, esquema: ESQUEMA_ACTUAL + 1, datos: {} }).ok).toBe(false)
  })

  it('una copia de la PWA 0.2.0 (sin esquema) se reconoce como esquema 2 y sus músculos pasan a la división completa', () => {
    const ejercicio = { id: 'Dumbbell_Flyes', musculosPrincipales: ['pecho'], musculosSecundarios: ['hombros'] } as { id: string }
    const copia: Copia = { app: 'ferro', version: 1, exportado: '', datos: { ...vacio(), ejercicios: [ejercicio] } }
    expect(esquemaDeCopia(copia)).toBe(2)
    const m = migrarCopia(copia)
    expect(m.esquema).toBe(5)
    expect(m.datos.ejercicios).toEqual([
      { id: 'Dumbbell_Flyes', musculosPrincipales: ['pectoral_esternal'], musculosSecundarios: ['pectoral_clavicular', 'pectoral_costal', 'deltoides_anterior'] },
    ])
  })

  it('una copia del esquema actual no se toca', () => {
    const copia: Copia = { ...crearCopia(vacio(), 0) }
    expect(migrarCopia(copia)).toBe(copia)
  })

  it('una copia del esquema 1 se migra igual que la base de datos: ids nuevos en todas las referencias', () => {
    const viejo = { id: 'press-banca', nombre: 'Press de banca', musculoPrincipal: 'pecho', musculosSecundarios: ['triceps'], material: 'barra', saltoPeso: 2.5, notasFijas: 'Banco 3', personalizado: false, archivado: false }
    const copia: Copia = {
      app: 'ferro',
      version: 1,
      exportado: '',
      datos: {
        ...vacio(),
        ejercicios: [viejo],
        rutinaEjercicios: [{ id: 're', ejercicioId: 'press-banca' } as { id: string }],
        series: [{ id: 'x', ejercicioId: 'press-banca', peso: 80 } as { id: string }],
        pesosCorporales: [{ id: 'p', kg: 78 } as { id: string }],
      },
    }
    expect(esquemaDeCopia(copia)).toBe(1)
    const m = migrarCopia(copia)
    expect(m.esquema).toBe(5)
    expect(m.datos.ejercicios).toMatchObject([{ id: 'Barbell_Bench_Press_-_Medium_Grip', notasFijas: 'Banco 3', musculosPrincipales: ['pectoral_esternal'] }])
    expect(m.datos.rutinaEjercicios).toEqual([{ id: 're', ejercicioId: 'Barbell_Bench_Press_-_Medium_Grip' }])
    expect(m.datos.series).toEqual([{ id: 'x', ejercicioId: 'Barbell_Bench_Press_-_Medium_Grip', peso: 80 }])
    expect(m.datos.pesosCorporales).toEqual([{ id: 'p', kg: 78 }])
  })
})

describe('CSV de series', () => {
  it('usa punto y coma, coma decimal, BOM y escapa comillas', () => {
    const csv = seriesACsv([
      {
        hora: new Date(2026, 10, 2, 18, 5).getTime(),
        rutina: 'A — Torso',
        ejercicio: 'Press "inclinado"; máquina',
        musculo: 'Pecho',
        serie: 1,
        tipo: 'normal',
        peso: 62.5,
        reps: 8,
        rir: 2,
        molestia: '',
      },
    ])
    expect(csv.startsWith('﻿fecha;hora;rutina;ejercicio')).toBe(true)
    expect(csv).toContain('2026-11-02;18:05;A — Torso;"Press ""inclinado""; máquina";Pecho;1;normal;62,5;8;2;')
  })
})

describe('recordatorio de copia', () => {
  const dia = 86400_000
  it('avisa si la última copia tiene más de 2 semanas', () => {
    expect(necesitaCopia(0, 0, 15 * dia)).toBe(true)
    expect(necesitaCopia(0, 0, 13 * dia)).toBe(false)
  })
  it('si nunca hice copia, cuenta desde que empecé a usar la app', () => {
    expect(necesitaCopia(null, null, 100 * dia)).toBe(false)
    expect(necesitaCopia(null, 0, 10 * dia)).toBe(false)
    expect(necesitaCopia(null, 0, 20 * dia)).toBe(true)
  })
})
