import { describe, expect, it } from 'vitest'
import { diasDelMes, diasQueCuentan, estadoMes, historialMensual, mensajeMes } from './objetivoMensual'
import { claveDia } from './semanas'

const t = (a: number, m: number, d: number, h = 18) => new Date(a, m - 1, d, h).getTime()
/** Días entrenados del mes `m` del año `a` (números de día). */
const enMes = (a: number, m: number, ...ds: number[]) => new Set(ds.map((d) => claveDia(t(a, m, d))))
const rango = (desde: number, hasta: number) => Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)

describe('días que cuentan', () => {
  it('una entrada o un entreno terminado; como mucho una vez por día', () => {
    const dias = diasQueCuentan([t(2026, 11, 2, 9), t(2026, 11, 3, 18)], [t(2026, 11, 2, 10), t(2026, 11, 4, 19)])
    expect([...dias].sort()).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
  })
})

describe('meses de 28, 29, 30 y 31 días', () => {
  it('cuenta bien la longitud del mes', () => {
    expect(diasDelMes(t(2026, 2, 10))).toBe(28)
    expect(diasDelMes(t(2028, 2, 10))).toBe(29)
    expect(diasDelMes(t(2026, 11, 10))).toBe(30)
    expect(diasDelMes(t(2026, 12, 10))).toBe(31)
  })
})

describe('objetivo mensual', () => {
  it('principio de mes sin haber ido: hoy cuenta como disponible', () => {
    const e = estadoMes(new Set(), 16, t(2026, 11, 1, 8))
    expect(e).toMatchObject({ hechos: 0, faltan: 16, disponibles: 30, margen: 14, situacion: 'posible' })
    expect(mensajeMes(e)).toBe('Puedes saltarte 14 días más y seguir cumpliéndolo')
  })

  it('principio de mes habiendo ido hoy: hoy ya no está disponible', () => {
    const e = estadoMes(enMes(2026, 11, 1), 16, t(2026, 11, 1, 20))
    expect(e).toMatchObject({ hechos: 1, faltan: 15, disponibles: 29, margen: 14 })
  })

  it('a mitad de mes, hoy entrenado o no cambia los disponibles, no el margen', () => {
    const antes = estadoMes(enMes(2026, 11, ...rango(2, 9)), 16, t(2026, 11, 12, 8))
    // 8 hechos, faltan 8; quedan 18 días después de hoy y hoy: 19
    expect(antes).toMatchObject({ hechos: 8, faltan: 8, disponibles: 19, margen: 11 })
    const despues = estadoMes(enMes(2026, 11, ...rango(2, 9), 12), 16, t(2026, 11, 12, 20))
    expect(despues).toMatchObject({ hechos: 9, faltan: 7, disponibles: 18, margen: 11 })
  })

  it('margen 0: no puedes saltarte ningún día más', () => {
    // Día 24 de noviembre sin haber ido: 9 hechos → faltan 7; disponibles 6 (25–30) + hoy = 7
    const e = estadoMes(enMes(2026, 11, ...rango(1, 9)), 16, t(2026, 11, 24, 8))
    expect(e).toMatchObject({ hechos: 9, faltan: 7, disponibles: 7, margen: 0, situacion: 'posible' })
    expect(mensajeMes(e)).toBe('No puedes saltarte ningún día más')
  })

  it('margen de 1 día en singular', () => {
    const e = estadoMes(enMes(2026, 11, ...rango(1, 10)), 16, t(2026, 11, 24, 8))
    expect(mensajeMes(e)).toBe('Puedes saltarte 1 día más y seguir cumpliéndolo')
  })

  it('ya imposible', () => {
    const e = estadoMes(enMes(2026, 11, 2, 5), 16, t(2026, 11, 20, 8))
    // faltan 14, quedan 10 (21–30) + hoy = 11
    expect(e).toMatchObject({ hechos: 2, faltan: 14, disponibles: 11, margen: -3, situacion: 'imposible' })
    expect(mensajeMes(e)).toBe('Este mes ya no es posible: te faltan 14 días y quedan 11')
  })

  it('cumplido, con días extra', () => {
    const justo = estadoMes(enMes(2026, 11, ...rango(1, 16)), 16, t(2026, 11, 20))
    expect(justo).toMatchObject({ situacion: 'cumplido', extra: 0, faltan: 0 })
    expect(mensajeMes(justo)).toBe('Objetivo cumplido')
    const extra = estadoMes(enMes(2026, 11, ...rango(1, 18)), 16, t(2026, 11, 20))
    expect(mensajeMes(extra)).toBe('Objetivo cumplido · 2 días extra')
    expect(mensajeMes(estadoMes(enMes(2026, 11, ...rango(1, 17)), 16, t(2026, 11, 20)))).toBe('Objetivo cumplido · 1 día extra')
  })

  it('último día del mes, sin haber ido: solo queda hoy', () => {
    const posible = estadoMes(enMes(2026, 11, ...rango(1, 15)), 16, t(2026, 11, 30, 8))
    expect(posible).toMatchObject({ faltan: 1, disponibles: 1, margen: 0, situacion: 'posible' })
    const imposible = estadoMes(enMes(2026, 11, ...rango(1, 13)), 16, t(2026, 11, 30, 8))
    expect(mensajeMes(imposible)).toBe('Este mes ya no es posible: te faltan 3 días y queda 1')
  })

  it('último día del mes, ya entrenado: no queda ninguno', () => {
    const e = estadoMes(enMes(2026, 11, ...rango(1, 14), 30), 16, t(2026, 11, 30, 21))
    expect(e).toMatchObject({ hechos: 15, faltan: 1, disponibles: 0, situacion: 'imposible' })
    expect(mensajeMes(e)).toBe('Este mes ya no es posible: te falta 1 día y no queda ninguno')
  })

  it('febrero de 28 días: el día 1 caben como mucho 28', () => {
    const e = estadoMes(new Set(), 16, t(2026, 2, 1, 8))
    expect(e).toMatchObject({ diasDelMes: 28, disponibles: 28, margen: 12 })
    expect(estadoMes(new Set(), 16, t(2026, 2, 28, 8))).toMatchObject({ disponibles: 1, situacion: 'imposible' })
    expect(estadoMes(new Set(), 29, t(2026, 2, 1, 8)).situacion).toBe('imposible')
  })

  it('mes de 31 días: un día más disponible que en uno de 30', () => {
    expect(estadoMes(new Set(), 16, t(2026, 12, 1, 8))).toMatchObject({ diasDelMes: 31, disponibles: 31, margen: 15 })
    expect(estadoMes(new Set(), 16, t(2026, 12, 31, 8))).toMatchObject({ disponibles: 1 })
  })

  it('no cuenta días de otros meses', () => {
    const dias = new Set([...enMes(2026, 10, ...rango(1, 31)), ...enMes(2026, 12, 1, 2)])
    expect(estadoMes(dias, 16, t(2026, 11, 15)).hechos).toBe(0)
  })
})

describe('historial mensual', () => {
  it('del mes actual hacia atrás, con cumplidos y no cumplidos', () => {
    const dias = new Set([...enMes(2026, 9, ...rango(1, 16)), ...enMes(2026, 10, ...rango(1, 10)), ...enMes(2026, 11, 2, 3)])
    const h = historialMensual(dias, 16, t(2026, 11, 5), t(2026, 9, 3))
    expect(h.map((m) => [claveDia(m.inicio), m.hechos, m.cumplido, m.enCurso])).toEqual([
      ['2026-11-01', 2, false, true],
      ['2026-10-01', 10, false, false],
      ['2026-09-01', 16, true, false],
    ])
  })

  it('cruza el cambio de año y respeta el máximo', () => {
    const h = historialMensual(new Set(), 16, t(2027, 2, 5), t(2026, 1, 1), 4)
    expect(h.map((m) => claveDia(m.inicio))).toEqual(['2027-02-01', '2027-01-01', '2026-12-01', '2026-11-01'])
  })
})
