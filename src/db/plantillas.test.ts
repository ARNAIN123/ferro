import { describe, expect, it } from 'vitest'
import { PLANTILLAS } from './plantillas'
import { EJERCICIOS_SEMILLA } from './seed-ejercicios'

describe('biblioteca y plantillas', () => {
  it('tiene unos 80 ejercicios con id único', () => {
    const ids = EJERCICIOS_SEMILLA.map((e) => e.id)
    expect(ids.length).toBeGreaterThanOrEqual(75)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('las plantillas solo usan ejercicios de la biblioteca y rangos válidos', () => {
    const ids = new Set(EJERCICIOS_SEMILLA.map((e) => e.id))
    for (const p of PLANTILLAS)
      for (const r of p.rutinas)
        for (const [id, series, min, max] of r.ejercicios) {
          expect(ids.has(id), `${p.nombre} / ${r.nombre}: ${id}`).toBe(true)
          expect(series).toBeGreaterThan(0)
          expect(min).toBeLessThanOrEqual(max)
        }
  })
})
