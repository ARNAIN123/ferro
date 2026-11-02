import { describe, expect, it } from 'vitest'
import { fmtCrono, fmtDuracion, fmtKg, parseNumero } from './formato'

describe('formato', () => {
  it('usa coma decimal', () => {
    expect(fmtKg(62.5)).toBe('62,5')
    expect(fmtKg(60)).toBe('60')
  })
  it('formatea cronómetro y duración', () => {
    expect(fmtCrono(95)).toBe('1:35')
    expect(fmtCrono(0.2)).toBe('0:01')
    expect(fmtDuracion(75 * 60000)).toBe('1 h 15 min')
    expect(fmtDuracion(42 * 60000)).toBe('42 min')
  })
  it('lee números con coma o punto', () => {
    expect(parseNumero('62,5')).toBe(62.5)
    expect(parseNumero('7.5')).toBe(7.5)
    expect(parseNumero('')).toBeNull()
    expect(parseNumero('abc')).toBeNull()
  })
})
