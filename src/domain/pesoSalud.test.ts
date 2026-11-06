import { describe, expect, it } from 'vitest'
import { planificarPesosSalud } from './pesoSalud'

const h = (d: number, hora: number) => new Date(2026, 10, d, hora).getTime()

describe('peso desde Health Connect', () => {
  it('añade un registro por día con la última medición de ese día', () => {
    const r = planificarPesosSalud([], [
      { kg: 80.44, hora: h(3, 7) },
      { kg: 80.12, hora: h(3, 21) },
      { kg: 79.96, hora: h(4, 7) },
    ])
    expect(r.nuevos).toEqual([
      { fecha: '2026-11-03', kg: 80.1 },
      { fecha: '2026-11-04', kg: 80 },
    ])
    expect(r.actualizar).toEqual([])
  })

  it('no duplica: si el día ya está importado y no cambia, no hace nada', () => {
    const r = planificarPesosSalud([{ id: 'a', fecha: '2026-11-03', kg: 80.1, origen: 'salud' }], [{ kg: 80.12, hora: h(3, 21) }])
    expect(r).toEqual({ nuevos: [], actualizar: [] })
  })

  it('actualiza lo importado si la báscula trae una medición más reciente', () => {
    const r = planificarPesosSalud([{ id: 'a', fecha: '2026-11-03', kg: 80.4, origen: 'salud' }], [{ kg: 80.1, hora: h(3, 21) }])
    expect(r.actualizar).toEqual([{ id: 'a', kg: 80.1 }])
  })

  it('nunca pisa lo que apunté a mano (con o sin origen)', () => {
    const r = planificarPesosSalud(
      [
        { id: 'a', fecha: '2026-11-03', kg: 81 },
        { id: 'b', fecha: '2026-11-04', kg: 80.5, origen: 'manual' },
      ],
      [
        { kg: 80.1, hora: h(3, 8) },
        { kg: 80.2, hora: h(4, 8) },
      ],
    )
    expect(r).toEqual({ nuevos: [], actualizar: [] })
  })

  it('descarta valores imposibles', () => {
    expect(planificarPesosSalud([], [{ kg: 0, hora: h(3, 8) }, { kg: 900, hora: h(4, 8) }]).nuevos).toEqual([])
  })
})
