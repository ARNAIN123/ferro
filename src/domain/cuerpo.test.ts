import { describe, expect, it } from 'vitest'
import {
  basalKatchMcArdle,
  cuerpoEnFecha,
  definicionMuscular,
  densidadCorporal,
  grasaMarina,
  grasaPorImc,
  grasaVigente,
  haceMeses,
  medidasVigentes,
  pesoTendencia,
  type GrasaCorporal,
  type MedidaCorporal,
} from './cuerpo'
import { basalDe, metabolismoBasal } from './nutricion'
import type { PesoCorporal } from './tipos'

describe('porcentaje de grasa', () => {
  it('método de la Marina de EE. UU.', () => {
    // Hombre de 178 cm, cintura 85 y cuello 38 → ≈ 16,4 %.
    expect(grasaMarina({ sexo: 'hombre', alturaCm: 178, cuello: 38, cintura: 85 })).toBeCloseTo(16.4, 1)
    // Mujer de 165 cm, cintura 72, cadera 98 y cuello 32 → ≈ 27,4 %.
    expect(grasaMarina({ sexo: 'mujer', alturaCm: 165, cuello: 32, cintura: 72, cadera: 98 })).toBeCloseTo(27.4, 1)
    // Más cintura, más grasa.
    expect(grasaMarina({ sexo: 'hombre', alturaCm: 178, cuello: 38, cintura: 100 })!).toBeGreaterThan(25)
    // Sin las medidas necesarias, nada.
    expect(grasaMarina({ sexo: 'hombre', alturaCm: 178, cuello: 38 })).toBeNull()
    expect(grasaMarina({ sexo: 'mujer', alturaCm: 165, cuello: 32, cintura: 72 })).toBeNull()
    expect(grasaMarina({ sexo: 'hombre', alturaCm: 178, cuello: 40, cintura: 39 })).toBeNull()
  })

  it('estimación por el IMC (solo para dar forma al avatar)', () => {
    expect(grasaPorImc({ sexo: 'hombre', edad: 30, alturaCm: 175, kg: 74 })).toBeCloseTo(19.6, 0)
    expect(grasaPorImc({ sexo: 'mujer', edad: 30, alturaCm: 165, kg: 60 })).toBeGreaterThan(grasaPorImc({ sexo: 'hombre', edad: 30, alturaCm: 165, kg: 60 }))
  })

  it('densidad del cuerpo: con más grasa, menos densa', () => {
    expect(densidadCorporal(15)).toBeCloseTo(1.0645, 3)
    expect(densidadCorporal(30)).toBeLessThan(densidadCorporal(10))
  })

  it('con menos grasa, los músculos se marcan más', () => {
    expect(definicionMuscular('hombre', 8)).toBeGreaterThan(definicionMuscular('hombre', 15))
    expect(definicionMuscular('hombre', 15)).toBeGreaterThan(definicionMuscular('hombre', 28))
    // Una mujer con un 22 % se ve como un hombre con un 14 %.
    expect(definicionMuscular('mujer', 22)).toBeCloseTo(definicionMuscular('hombre', 14), 1)
    expect(definicionMuscular('hombre', 40)).toBeGreaterThan(0)
  })
})

describe('metabolismo basal', () => {
  it('Katch-McArdle con la masa magra', () => {
    // 80 kg con un 15 % de grasa: 68 kg de masa magra → 370 + 21,6 · 68.
    expect(basalKatchMcArdle(80, 15)).toBe(1839)
  })

  it('con porcentaje de grasa se usa Katch-McArdle; sin él, Mifflin-St Jeor', () => {
    const d = { sexo: 'hombre' as const, kg: 80, alturaCm: 178, edad: 28 }
    expect(basalDe(d)).toEqual({ kcal: metabolismoBasal(d), formula: 'mifflin' })
    expect(basalDe({ ...d, grasaPct: null })).toEqual({ kcal: metabolismoBasal(d), formula: 'mifflin' })
    expect(basalDe({ ...d, grasaPct: 15 })).toEqual({ kcal: 1839, formula: 'katch' })
    // Con mucha grasa, Katch-McArdle da menos que Mifflin (no cuenta la grasa como músculo).
    expect(basalDe({ ...d, kg: 110, grasaPct: 35 }).kcal).toBeLessThan(metabolismoBasal({ ...d, kg: 110 }))
  })
})

const peso = (fecha: string, kg: number): PesoCorporal => ({ id: fecha, fecha, kg })

describe('peso según la tendencia', () => {
  const pesos = [peso('2026-11-01', 80), peso('2026-11-03', 81), peso('2026-11-05', 79.4), peso('2026-11-07', 80.4)]

  it('es la media de la semana, no el dato de un día', () => {
    expect(pesoTendencia(pesos, '2026-11-07')).toBe(80.2)
    expect(pesoTendencia(pesos, '2026-11-03')).toBe(80.5)
  })

  it('sin pesos esa semana, el último anterior; sin ninguno, null', () => {
    expect(pesoTendencia(pesos, '2026-11-30')).toBe(80.4)
    expect(pesoTendencia(pesos, '2026-10-20')).toBeNull()
  })
})

describe('qué grasa vale cada día', () => {
  const grasas: GrasaCorporal[] = [
    { id: 'a', fecha: '2026-09-01', pct: 20, origen: 'manual' },
    { id: 'b', fecha: '2026-10-15', pct: 17.5, origen: 'salud' },
  ]
  const medidas: MedidaCorporal[] = [{ id: 'm', fecha: '2026-11-01', cuello: 38, cintura: 85 }]

  it('la báscula manda si es reciente', () => {
    expect(grasaVigente({ fecha: '2026-11-05', sexo: 'hombre', alturaCm: 178, grasas, medidas })).toEqual({ pct: 17.5, origen: 'salud', fecha: '2026-10-15' })
  })

  it('si no, lo más nuevo: las medidas (Marina) o lo escrito a mano', () => {
    const r = grasaVigente({ fecha: '2026-11-05', sexo: 'hombre', alturaCm: 178, grasas: grasas.slice(0, 1), medidas })
    expect(r?.origen).toBe('marina')
    expect(r?.pct).toBeCloseTo(16.4, 1)
    expect(grasaVigente({ fecha: '2026-10-01', sexo: 'hombre', alturaCm: 178, grasas: grasas.slice(0, 1), medidas })).toEqual({ pct: 20, origen: 'manual', fecha: '2026-09-01' })
  })

  it('un dato de hace más de cuatro meses ya no vale', () => {
    expect(grasaVigente({ fecha: '2027-03-15', sexo: 'hombre', alturaCm: 178, grasas, medidas })).toBeNull()
  })
})

describe('el cuerpo de un día', () => {
  const pesos = [peso('2026-05-10', 92), peso('2026-11-08', 79.5), peso('2026-11-11', 79.1)]
  const medidas: MedidaCorporal[] = [
    { id: 'm1', fecha: '2026-05-10', cuello: 41, cintura: 100 },
    { id: 'm2', fecha: '2026-11-10', cintura: 86, brazo: 36 },
  ]
  const base = { sexo: 'hombre' as const, edad: 34, alturaCm: 180, pesos, medidas, grasas: [] }

  it('hoy: peso de la tendencia, medidas recientes y grasa de la Marina', () => {
    const c = cuerpoEnFecha({ ...base, fecha: '2026-11-12' })
    expect(c.kg).toBe(79.3)
    expect(c.datos.kg).toBe(79.3)
    // El cuello de mayo es de hace más de cuatro meses: ya no ajusta el avatar ni sirve para la Marina.
    expect(c.datos.medidas).toEqual({ cintura: 86, brazo: 36 })
    expect(c.grasa).toBeNull()
    expect(c.faltan).toEqual([])
  })

  it('hace seis meses: el cuerpo de entonces', () => {
    const c = cuerpoEnFecha({ ...base, fecha: haceMeses('2026-11-12', 6) })
    expect(c.kg).toBe(92)
    expect(c.datos.medidas).toEqual({ cuello: 41, cintura: 100 })
    expect(c.grasa?.origen).toBe('marina')
    expect(c.grasa!.pct).toBeGreaterThan(22)
  })

  it('sin perfil ni peso, valores corrientes y la lista de lo que falta', () => {
    const c = cuerpoEnFecha({ fecha: '2026-11-12', sexo: null, edad: null, alturaCm: null, pesos: [], medidas: [], grasas: [] })
    expect(c.faltan).toEqual(['sexo', 'edad', 'altura', 'peso'])
    expect(c.datos).toMatchObject({ sexo: 'hombre', edad: 30, alturaCm: 175, kg: 70 })
  })

  it('las medidas vigentes son las últimas de cada una', () => {
    expect(medidasVigentes(medidas, '2026-11-12')).toEqual({ cuello: { cm: 41, fecha: '2026-05-10' }, cintura: { cm: 86, fecha: '2026-11-10' }, brazo: { cm: 36, fecha: '2026-11-10' } })
  })

  it('hace N meses, sin pasarse de fin de mes', () => {
    expect(haceMeses('2026-11-12', 1)).toBe('2026-10-12')
    expect(haceMeses('2026-11-12', 6)).toBe('2026-05-12')
    expect(haceMeses('2026-05-31', 3)).toBe('2026-02-28')
    expect(haceMeses('2026-01-15', 1)).toBe('2025-12-15')
  })
})
