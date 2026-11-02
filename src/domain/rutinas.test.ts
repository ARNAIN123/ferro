import { describe, expect, it } from 'vitest'
import { ajustarItem, alternarSuperserie, normalizarPlan, planDesdeSesion, type BloqueSesion, type ItemPlan } from './rutinas'

const bloque = (ejercicioId: string, hechas: number, extra: Partial<BloqueSesion> = {}): BloqueSesion => ({
  ejercicioId,
  repsMin: 8,
  repsMax: 12,
  descansoSeg: 90,
  superserieConSiguiente: false,
  series: [
    { tipo: 'calentamiento', completada: true },
    ...Array.from({ length: hechas }, () => ({ tipo: 'normal' as const, completada: true })),
    { tipo: 'normal', completada: false },
  ],
  ...extra,
})

const item = (extra: Partial<ItemPlan> = {}): ItemPlan => ({
  clave: 'k',
  ejercicioId: 'x',
  series: 3,
  repsMin: 8,
  repsMax: 12,
  descansoSeg: 90,
  nota: '',
  superserieConSiguiente: false,
  ...extra,
})

describe('rutina a partir de un entreno', () => {
  it('cuenta solo las series efectivas completadas y salta los ejercicios sin series', () => {
    const plan = planDesdeSesion([bloque('banca', 4), bloque('saltado', 0), bloque('curl', 2, { superserieConSiguiente: true })], (i) => `k${i}`)
    expect(plan.map((p) => [p.ejercicioId, p.series])).toEqual([
      ['banca', 4],
      ['curl', 2],
    ])
    expect(plan[1]!.superserieConSiguiente).toBe(false)
  })

  it('si un ejercicio aparece dos veces suma sus series', () => {
    const plan = planDesdeSesion([bloque('banca', 2), bloque('banca', 1)], (i) => `k${i}`)
    expect(plan).toHaveLength(1)
    expect(plan[0]!.series).toBe(3)
  })
})

describe('edición en línea', () => {
  it('respeta límites y el rango de repeticiones', () => {
    expect(ajustarItem(item({ series: 1 }), 'series', -1).series).toBe(1)
    expect(ajustarItem(item({ repsMin: 12, repsMax: 12 }), 'repsMin', 1)).toMatchObject({ repsMin: 13, repsMax: 13 })
    expect(ajustarItem(item({ repsMin: 8, repsMax: 8 }), 'repsMax', -1)).toMatchObject({ repsMin: 7, repsMax: 7 })
    expect(ajustarItem(item({ descansoSeg: 0 }), 'descansoSeg', -15).descansoSeg).toBe(0)
  })

  it('agrupa en superserie con el siguiente y nunca deja el último en superserie', () => {
    const lista = [item({ clave: 'a' }), item({ clave: 'b' })]
    expect(alternarSuperserie(lista, 0)[0]!.superserieConSiguiente).toBe(true)
    expect(alternarSuperserie(lista, 1)[1]!.superserieConSiguiente).toBe(false)
    expect(normalizarPlan([item({ superserieConSiguiente: true })])[0]!.superserieConSiguiente).toBe(false)
  })
})
