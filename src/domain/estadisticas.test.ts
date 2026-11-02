import { describe, expect, it } from 'vitest'
import { asistenciaPorSemana, duracionMedia, evolucionEjercicio, mapaCalor, mediaMovil } from './estadisticas'

const dia = (a: number, m: number, d: number, h = 18) => new Date(a, m - 1, d, h).getTime()

describe('asistencia', () => {
  const ahora = dia(2026, 11, 4)

  it('mapa de calor: semanas en columnas, lunes primero, nivel 2 si entrené', () => {
    const mapa = mapaCalor([dia(2026, 11, 2), dia(2026, 11, 3)], [dia(2026, 11, 3)], ahora, 2)
    expect(mapa).toHaveLength(2)
    expect(mapa[1]![0]!.clave).toBe('2026-11-02')
    expect(mapa[1]![0]!.nivel).toBe(1)
    expect(mapa[1]![1]!.nivel).toBe(2)
    expect(mapa[1]![2]!.futuro).toBe(false)
    expect(mapa[1]![3]!.futuro).toBe(true)
    expect(mapa[0]![0]!.clave).toBe('2026-10-26')
  })

  it('días por semana de la más antigua a la actual', () => {
    const r = asistenciaPorSemana([dia(2026, 11, 2), dia(2026, 11, 2, 9), dia(2026, 10, 27), dia(2026, 10, 29)], ahora, 3)
    expect(r.map((x) => x.dias)).toEqual([0, 2, 1])
  })

  it('duración media de las sesiones cerradas', () => {
    expect(duracionMedia([{ entrada: 0, salida: 3600_000 }, { entrada: 0, salida: 1800_000 }, { entrada: 0, salida: null }])).toBe(2700_000)
    expect(duracionMedia([])).toBeNull()
  })
})

describe('evolución de un ejercicio', () => {
  it('1RM estimado, volumen y mejor serie por sesión, en orden cronológico', () => {
    const fechas = new Map([
      ['s2', 2],
      ['s1', 1],
    ])
    const r = evolucionEjercicio(
      [
        { sesionId: 's2', tipo: 'normal', peso: 100, reps: 5 },
        { sesionId: 's1', tipo: 'normal', peso: 90, reps: 10 },
        { sesionId: 's1', tipo: 'calentamiento', peso: 60, reps: 10 },
        { sesionId: 's1', tipo: 'normal', peso: 90, reps: 8 },
      ],
      fechas,
    )
    expect(r.map((p) => p.sesionId)).toEqual(['s1', 's2'])
    expect(r[0]!.volumen).toBe(1620)
    expect(r[0]!.mejor).toEqual({ peso: 90, reps: 10 })
    expect(r[0]!.e1rm).toBeCloseTo(120, 5)
  })
})

describe('peso corporal', () => {
  it('media móvil de 7 días naturales', () => {
    const r = mediaMovil([
      { fecha: '2026-11-01', kg: 80 },
      { fecha: '2026-11-03', kg: 79 },
      { fecha: '2026-11-07', kg: 78 },
      { fecha: '2026-11-08', kg: 77 },
    ])
    expect(r.map((p) => p.media)).toEqual([80, 79.5, 79, 78])
  })
})
