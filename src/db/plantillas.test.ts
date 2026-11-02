import { describe, expect, it } from 'vitest'
import catalogo from '../catalogo/ejercicios.json'
import { idMigrado } from '../domain/migracion'
import { PLANTILLAS } from './plantillas'

describe('plantillas', () => {
  it('solo usan ejercicios del catálogo y rangos válidos', () => {
    const ids = new Set(catalogo.ejercicios.map((e) => e.id))
    for (const p of PLANTILLAS)
      for (const r of p.rutinas)
        for (const [id, series, min, max] of r.ejercicios) {
          expect(ids.has(idMigrado(id)), `${p.nombre} / ${r.nombre}: ${id}`).toBe(true)
          expect(series).toBeGreaterThan(0)
          expect(min).toBeLessThanOrEqual(max)
        }
  })
})
