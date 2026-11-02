import { describe, expect, it } from 'vitest'
import { claveDia, diasDeSemana, diasEntrenadosEnSemana, inicioSemana, rachaSemanas } from './semanas'

// Fechas locales a mediodía para no depender de la zona horaria.
const dia = (a: number, m: number, d: number, hora = 12) => new Date(a, m - 1, d, hora).getTime()

describe('semanas', () => {
  it('empiezan en lunes', () => {
    // 5 nov 2026 es jueves → la semana empieza el lunes 2
    expect(claveDia(inicioSemana(dia(2026, 11, 5)))).toBe('2026-11-02')
    // Un domingo pertenece a la semana del lunes anterior
    expect(claveDia(inicioSemana(dia(2026, 11, 8)))).toBe('2026-11-02')
    expect(claveDia(inicioSemana(dia(2026, 11, 9)))).toBe('2026-11-09')
    expect(diasDeSemana(dia(2026, 11, 5)).map(claveDia)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ])
  })

  it('cuenta días distintos, no sesiones', () => {
    const horas = [dia(2026, 11, 2, 9), dia(2026, 11, 2, 19), dia(2026, 11, 4), dia(2026, 10, 30)]
    expect(diasEntrenadosEnSemana(horas, dia(2026, 11, 5))).toBe(2)
  })
})

describe('racha de semanas', () => {
  const ahora = dia(2026, 11, 4) // miércoles
  // Semanas anteriores: 26 oct, 19 oct, 12 oct
  const semana = (lunes: [number, number, number], dias: number) =>
    Array.from({ length: dias }, (_, i) => new Date(lunes[0], lunes[1] - 1, lunes[2] + i * 2, 18).getTime())

  it('cuenta semanas seguidas que cumplen el objetivo', () => {
    const horas = [...semana([2026, 10, 26], 3), ...semana([2026, 10, 19], 3), ...semana([2026, 10, 12], 2)]
    expect(rachaSemanas(horas, 3, ahora)).toBe(2)
  })

  it('la semana en curso sin cumplir no rompe la racha', () => {
    const horas = [dia(2026, 11, 2), ...semana([2026, 10, 26], 3)]
    expect(rachaSemanas(horas, 3, ahora)).toBe(1)
  })

  it('la semana en curso suma si ya está cumplida', () => {
    const horas = [dia(2026, 11, 2), dia(2026, 11, 3), dia(2026, 11, 4), ...semana([2026, 10, 26], 3)]
    expect(rachaSemanas(horas, 3, ahora)).toBe(2)
  })

  it('una semana sin cumplir corta la racha', () => {
    const horas = [...semana([2026, 10, 26], 1), ...semana([2026, 10, 19], 4)]
    expect(rachaSemanas(horas, 3, ahora)).toBe(0)
  })

  it('varios entrenos el mismo día cuentan como uno', () => {
    const horas = [dia(2026, 10, 26, 9), dia(2026, 10, 26, 19), dia(2026, 10, 27)]
    expect(rachaSemanas(horas, 3, ahora)).toBe(0)
  })
})
