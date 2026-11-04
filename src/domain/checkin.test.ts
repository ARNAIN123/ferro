import { describe, expect, it } from 'vitest'
import { entradaReciente, vincularEntrada } from './checkin'

const h = 3600_000

describe('entrada reciente', () => {
  it('devuelve la más nueva dentro de la ventana', () => {
    const entradas = [{ hora: 8 * h, id: 'a' }, { hora: 9 * h, id: 'b' }, { hora: 2 * h, id: 'c' }]
    expect(entradaReciente(entradas, 10 * h, 3)?.id).toBe('b')
    expect(entradaReciente(entradas, 20 * h, 3)).toBeNull()
  })

  it('el límite exacto ya no cuenta e ignora horas futuras (cambio de hora del móvil)', () => {
    expect(entradaReciente([{ hora: 7 * h }], 10 * h, 3)).toBeNull()
    expect(entradaReciente([{ hora: 12 * h }], 10 * h, 3)).toBeNull()
  })
})

describe('vincular la entrada al empezar un entreno', () => {
  const min = 60_000
  it('sin entrada reciente crea una nueva', () => {
    expect(vincularEntrada([], 10 * h, 3)).toEqual({ entrada: null, crear: true, vincular: true })
  })
  it('usa la entrada reciente sin entreno como hora de llegada', () => {
    const e = { hora: 10 * h - 10 * min }
    expect(vincularEntrada([e], 10 * h, 3)).toEqual({ entrada: e, crear: false, vincular: true })
  })
  it('un segundo entreno en la misma visita no crea otra entrada', () => {
    const e = { hora: 9 * h, sesionId: 's1' }
    expect(vincularEntrada([e], 10 * h, 3)).toEqual({ entrada: e, crear: false, vincular: false })
  })
  it('si la entrada es de hace más de una hora no la toma como llegada', () => {
    const e = { hora: 8 * h }
    expect(vincularEntrada([e], 10 * h, 3)).toEqual({ entrada: e, crear: false, vincular: false })
  })
})
