import { describe, expect, it } from 'vitest'
import { crearCopia, necesitaCopia, seriesACsv, TABLAS, validarCopia, type NombreTabla } from './copias'

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
