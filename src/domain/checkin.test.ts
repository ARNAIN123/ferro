import { describe, expect, it } from 'vitest'
import { dentroDelGimnasio, distanciaMetros, entradaReciente, esEnlaceCheckin, puedeRegistrarEntrada, vincularEntrada } from './checkin'

const h = 3600_000

describe('deduplicación del check-in', () => {
  it('sin entradas previas siempre registra', () => {
    expect(puedeRegistrarEntrada([], 10 * h, 3)).toBe(true)
  })

  it('bloquea si hubo una entrada en las últimas N horas', () => {
    expect(puedeRegistrarEntrada([{ hora: 8 * h }], 10 * h, 3)).toBe(false)
    expect(puedeRegistrarEntrada([{ hora: 10 * h }], 10 * h, 3)).toBe(false)
  })

  it('permite una nueva pasado el intervalo (el límite exacto ya cuenta como pasado)', () => {
    expect(puedeRegistrarEntrada([{ hora: 7 * h }], 10 * h, 3)).toBe(true)
    expect(puedeRegistrarEntrada([{ hora: 6 * h }], 10 * h, 3)).toBe(true)
  })

  it('respeta las horas configuradas', () => {
    expect(puedeRegistrarEntrada([{ hora: 7 * h }], 10 * h, 4)).toBe(false)
    expect(puedeRegistrarEntrada([{ hora: 9 * h }], 10 * h, 0.5)).toBe(true)
  })

  it('ignora entradas con hora futura (cambio de hora del móvil)', () => {
    expect(puedeRegistrarEntrada([{ hora: 12 * h }], 10 * h, 3)).toBe(true)
  })

  it('devuelve la entrada reciente más nueva', () => {
    const entradas = [{ hora: 8 * h, id: 'a' }, { hora: 9 * h, id: 'b' }, { hora: 2 * h, id: 'c' }]
    expect(entradaReciente(entradas, 10 * h, 3)?.id).toBe('b')
    expect(entradaReciente(entradas, 20 * h, 3)).toBeNull()
  })
})

describe('ubicación del gimnasio', () => {
  const gimnasio = { lat: 41.3874, lng: 2.1686 } // Barcelona

  it('mide distancias reales', () => {
    // 0,001° de latitud ≈ 111 m
    expect(distanciaMetros(gimnasio, { lat: 41.3884, lng: 2.1686 })).toBeCloseTo(111, 0)
    expect(distanciaMetros(gimnasio, gimnasio)).toBe(0)
  })

  it('detecta si estoy dentro del radio', () => {
    expect(dentroDelGimnasio({ lat: 41.3884, lng: 2.1686, precision: 10 }, gimnasio, 200)).toBe(true)
    expect(dentroDelGimnasio({ lat: 41.3904, lng: 2.1686, precision: 10 }, gimnasio, 200)).toBe(false) // ~333 m
  })

  it('da un margen según la precisión del GPS, como mucho medio radio', () => {
    const a210m = { lat: 41.38929, lng: 2.1686 }
    expect(dentroDelGimnasio({ ...a210m, precision: 5 }, gimnasio, 200)).toBe(false)
    expect(dentroDelGimnasio({ ...a210m, precision: 40 }, gimnasio, 200)).toBe(true)
  })

  it('descarta lecturas muy imprecisas', () => {
    expect(dentroDelGimnasio({ ...gimnasio, precision: 800 }, gimnasio, 200)).toBe(false)
  })
})

describe('enlace de check-in', () => {
  it('acepta /checkin y ?checkin=auto', () => {
    expect(esEnlaceCheckin('/checkin', '')).toBe(true)
    expect(esEnlaceCheckin('/checkin/', '')).toBe(true)
    expect(esEnlaceCheckin('/', '?checkin=auto')).toBe(true)
    expect(esEnlaceCheckin('/', '?checkin=no')).toBe(false)
    expect(esEnlaceCheckin('/rutinas', '')).toBe(false)
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
