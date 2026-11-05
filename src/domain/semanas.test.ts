import { describe, expect, it } from 'vitest'
import { claveDia, diasDeSemana, etiquetaSemana, inicioSemana } from './semanas'

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

  it('etiqueta de la semana', () => {
    expect(etiquetaSemana(dia(2026, 11, 5))).toBe('Semana del 2 al 8 nov')
    expect(etiquetaSemana(dia(2026, 12, 2))).toBe('Semana del 30 nov al 6 dic')
    expect(etiquetaSemana(dia(2027, 1, 1))).toBe('Semana del 28 dic al 3 ene')
  })
})
