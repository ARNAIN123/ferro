import { describe, expect, it } from 'vitest'
import { calcularMarcas, epley, recordsDeSesion, recordsPersonales, volumenDe, type SerieHecha } from './marcas'
import { compararSesiones, resumirSesion } from './resumen'

const serie = (sesionId: string, peso: number, reps: number, tipo: SerieHecha['tipo'] = 'normal', ejercicioId = 'banca'): SerieHecha => ({
  sesionId,
  ejercicioId,
  tipo,
  peso,
  reps,
  hora: Number(sesionId.replace(/\D/g, '')) || 0,
})

describe('1RM estimado (Epley)', () => {
  it('aplica peso × (1 + reps/30)', () => {
    expect(epley(100, 10)).toBeCloseTo(133.33, 2)
    expect(epley(60, 1)).toBe(60)
    expect(epley(60, 0)).toBe(0)
  })
})

describe('marcas', () => {
  it('ignora calentamientos y encuentra la mejor serie', () => {
    const m = calcularMarcas([serie('s1', 100, 5), serie('s1', 90, 10), serie('s1', 120, 3, 'calentamiento')])
    expect(m.pesoMax).toBe(100)
    expect(m.mejorSerie).toEqual({ peso: 90, reps: 10 })
    expect(m.volumenSesion).toBe(100 * 5 + 90 * 10)
  })

  it('volumen sin calentamientos', () => {
    expect(volumenDe([serie('s', 20, 10, 'calentamiento'), serie('s', 50, 10), serie('s', 30, 12, 'drop')])).toBe(500 + 360)
  })

  it('detecta récords solo si hay historial previo', () => {
    expect(recordsDeSesion([serie('s2', 100, 5)], [])).toEqual([])
    const records = recordsDeSesion([serie('s2', 82.5, 8), serie('s2', 82.5, 8)], [serie('s1', 80, 8), serie('s1', 80, 8)])
    expect(records.map((r) => r.tipo).sort()).toEqual(['e1rm', 'peso', 'volumen'])
  })

  it('no hay récord si igualo la marca', () => {
    expect(recordsDeSesion([serie('s2', 80, 8)], [serie('s1', 80, 8)])).toEqual([])
  })

  it('lista récords personales por ejercicio', () => {
    const lista = recordsPersonales([serie('s1', 80, 8), serie('s2', 85, 6), serie('s1', 30, 12, 'normal', 'curl')])
    expect(lista.map((r) => r.ejercicioId)).toEqual(['banca', 'curl'])
    expect(lista[0]?.marcas.mejorSerie).toEqual({ peso: 85, reps: 6 })
  })
})

describe('resumen de sesión', () => {
  it('cuenta solo series completadas y efectivas y compara con la anterior', () => {
    const actual = resumirSesion({ entrada: 0, salida: 3600_000 }, [
      { tipo: 'normal', peso: 50, reps: 10, completada: true },
      { tipo: 'calentamiento', peso: 20, reps: 10, completada: true },
      { tipo: 'normal', peso: 50, reps: 10, completada: false },
    ])
    expect(actual).toEqual({ duracionMs: 3600_000, series: 1, repsTotales: 10, volumen: 500 })
    const cmp = compararSesiones(actual, { duracionMs: 3000_000, series: 2, repsTotales: 16, volumen: 400 })
    expect(cmp.volumen).toBe(100)
    expect(cmp.volumenPct).toBe(25)
    expect(cmp.series).toBe(-1)
  })
})
