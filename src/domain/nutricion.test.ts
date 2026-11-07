import { describe, expect, it } from 'vitest'
import {
  comeMuyPoco,
  deltaDiario,
  gastoEstimado,
  macrosDelDia,
  metabolismoBasal,
  objetivoCalorico,
  objetivoDelDia,
  recalibrar,
  sugerirCierre,
  type DiaIngesta,
  type Habitual,
} from './nutricion'

describe('gasto inicial', () => {
  it('Mifflin-St Jeor para hombre y mujer', () => {
    // 10·80 + 6,25·180 − 5·30 + 5 = 1780
    expect(metabolismoBasal({ sexo: 'hombre', kg: 80, alturaCm: 180, edad: 30 })).toBe(1780)
    // 10·60 + 6,25·165 − 5·30 − 161 = 1320,25
    expect(metabolismoBasal({ sexo: 'mujer', kg: 60, alturaCm: 165, edad: 30 })).toBe(1320)
  })

  it('basal + actividad real + efecto térmico de los alimentos', () => {
    expect(gastoEstimado(1780, 470)).toBe(2500)
    expect(gastoEstimado(1800, -50)).toBe(2000)
  })
})

describe('objetivo y límites de seguridad', () => {
  it('perder al 0,5 % semanal: 80 kg → 0,4 kg/semana ≈ 440 kcal/día de déficit', () => {
    expect(deltaDiario(80, 'moderado')).toBeCloseTo(440, 0)
    expect(objetivoCalorico({ gasto: 2500, basal: 1780, objetivo: 'perder', ritmo: 'moderado', kg: 80 })).toEqual({ kcal: 2060, limitadoPorBasal: false })
  })

  it('mantener y ganar', () => {
    expect(objetivoCalorico({ gasto: 2500, basal: 1780, objetivo: 'mantener', ritmo: 'rapido', kg: 80 }).kcal).toBe(2500)
    expect(objetivoCalorico({ gasto: 2500, basal: 1780, objetivo: 'ganar', ritmo: 'suave', kg: 80 }).kcal).toBe(2720)
  })

  it('nunca por debajo del metabolismo basal', () => {
    const r = objetivoCalorico({ gasto: 2000, basal: 1780, objetivo: 'perder', ritmo: 'rapido', kg: 80 })
    expect(r.kcal).toBe(1780)
    expect(r.limitadoPorBasal).toBe(true)
  })

  it('el ritmo nunca supera el 1 % del peso por semana', () => {
    // Rápido es 0,75 %: por debajo del máximo
    expect(deltaDiario(100, 'rapido')).toBeLessThanOrEqual(((100 * 1) / 100) * (7700 / 7))
  })
})

const dias = (desde: string, n: number, kcal: number | null): DiaIngesta[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${desde}T12:00`)
    d.setDate(d.getDate() + i)
    return { fecha: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, kcal }
  })
const pesosLineales = (desde: string, n: number, kg0: number, porDia: number) =>
  dias(desde, n, null).map((d, i) => ({ fecha: d.fecha, kg: kg0 + porDia * i }))

describe('recalibración semanal', () => {
  const base = { hasta: '2026-11-15', basal: 1780, objetivo: 'perder' as const, ritmo: 'moderado' as const, kg: 80 }

  it('calcula el gasto real con lo comido y la tendencia del peso', () => {
    // Como 2000 kcal y pierdo 0,5 kg por semana → gasto real = 2000 + 0,5·7700/7 = 2550
    const r = recalibrar({ ...base, ingestas: dias('2026-11-02', 14, 2000), pesos: pesosLineales('2026-11-02', 14, 81, -0.5 / 7), objetivoActual: 2100 })
    expect(r.gastoReal).toBe(2550)
    expect(r.cambioSemanal).toBeCloseTo(-0.5, 2)
    // Ideal 2550 − 440 = 2110 → sube 10
    expect(r.nuevoObjetivo).toBe(2110)
    expect(r.motivo).toBe('ajustado')
  })

  it('como mucho ±150 kcal por semana', () => {
    // Gasto real muy alto → el ideal sube mucho, pero solo se mueven 150
    const r = recalibrar({ ...base, ingestas: dias('2026-11-02', 14, 2600), pesos: pesosLineales('2026-11-02', 14, 81, -0.6 / 7), objetivoActual: 2000 })
    expect(r.nuevoObjetivo).toBe(2150)
    expect(r.motivo).toBe('limitado')
    const baja = recalibrar({ ...base, ingestas: dias('2026-11-02', 14, 1800), pesos: pesosLineales('2026-11-02', 14, 80, 0.3 / 7), objetivoActual: 2300 })
    expect(baja.nuevoObjetivo).toBe(2150)
  })

  it('nunca por debajo del basal aunque los datos lo pidan', () => {
    const r = recalibrar({ ...base, ingestas: dias('2026-11-02', 14, 1500), pesos: pesosLineales('2026-11-02', 14, 80, 0.4 / 7), objetivoActual: 1850 })
    expect(r.nuevoObjetivo).toBeGreaterThanOrEqual(1780)
  })

  it('sin suficientes días registrados o sin pesos no se ajusta', () => {
    const pocos = recalibrar({ ...base, ingestas: [...dias('2026-11-02', 8, 2000), ...dias('2026-11-10', 6, null)], pesos: pesosLineales('2026-11-02', 14, 80, 0), objetivoActual: 2100 })
    expect(pocos).toMatchObject({ motivo: 'pocos_registros', nuevoObjetivo: 2100 })
    const sinPeso = recalibrar({ ...base, ingestas: dias('2026-11-02', 14, 2000), pesos: [], objetivoActual: 2100 })
    expect(sinPeso).toMatchObject({ motivo: 'poco_peso', nuevoObjetivo: 2100 })
  })
})

describe('días de entreno y descanso', () => {
  it('el total de la semana se mantiene', () => {
    const objetivo = 2200
    for (const n of [2, 3, 4, 5]) {
      const total = n * objetivoDelDia(objetivo, true, n) + (7 - n) * objetivoDelDia(objetivo, false, n)
      expect(Math.abs(total - 7 * objetivo)).toBeLessThanOrEqual(7)
      expect(objetivoDelDia(objetivo, true, n)).toBeGreaterThan(objetivoDelDia(objetivo, false, n))
    }
    expect(objetivoDelDia(2200, true, 0)).toBe(2200)
  })
})

describe('macros', () => {
  it('proteína primero, grasa mínima y el resto en hidratos', () => {
    const m = macrosDelDia({ kcalDia: 2200, kcalMedia: 2200, kg: 80, proteinaGkg: 2 })
    expect(m.proteina).toBe(160)
    expect(m.grasa).toBe(61) // 25 % de 2200 / 9 > 0,7·80 = 56
    expect(m.carbohidratos).toBe(253)
    expect(m.proteina * 4 + m.carbohidratos * 4 + m.grasa * 9).toBeCloseTo(2200, -1)
  })

  it('la proteína se queda entre 1,6 y 2,2 g/kg', () => {
    expect(macrosDelDia({ kcalDia: 2200, kcalMedia: 2200, kg: 80, proteinaGkg: 3 }).proteina).toBe(176)
    expect(macrosDelDia({ kcalDia: 2200, kcalMedia: 2200, kg: 80, proteinaGkg: 1 }).proteina).toBe(128)
  })

  it('entre días de entreno y de descanso solo cambian los hidratos', () => {
    const entreno = macrosDelDia({ kcalDia: 2380, kcalMedia: 2200, kg: 80, proteinaGkg: 2 })
    const descanso = macrosDelDia({ kcalDia: 2050, kcalMedia: 2200, kg: 80, proteinaGkg: 2 })
    expect(entreno.proteina).toBe(descanso.proteina)
    expect(entreno.grasa).toBe(descanso.grasa)
    expect(entreno.carbohidratos).toBeGreaterThan(descanso.carbohidratos)
  })
})

const habitual = (id: string, kcal: number, proteina: number, raciones: [string, number][], usos: number): Habitual => ({
  id,
  nombre: id,
  por100: { kcal, proteina, carbohidratos: 0, grasa: 0 },
  raciones: raciones.map(([nombre, gramos]) => ({ nombre, gramos })),
  usos,
})

describe('cerrar el día', () => {
  const habituales = [
    habitual('pollo', 165, 31, [['1 filete', 110]], 20),
    habitual('arroz', 130, 2.7, [['1 plato', 200]], 15),
    habitual('yogur', 59, 10.2, [['1 yogur', 125]], 8),
    habitual('galletas', 467, 6, [['1 galleta', 6]], 2),
  ]

  it('propone combinaciones de mis alimentos que encajan con lo que me queda', () => {
    const s = sugerirCierre({ kcal: 500, proteina: 45 }, habituales)
    expect(s.length).toBeGreaterThan(0)
    for (const x of s) {
      expect(x.kcal).toBeLessThanOrEqual(550)
      expect(x.partes.length).toBeLessThanOrEqual(2)
    }
    // La mejor lleva pollo (la proteína manda)
    expect(s[0]!.partes.some((p) => p.id === 'pollo')).toBe(true)
    expect(Math.abs(s[0]!.proteina - 45)).toBeLessThan(15)
  })

  it('no repite combinaciones y no propone nada si queda muy poco', () => {
    const s = sugerirCierre({ kcal: 500, proteina: 45 }, habituales)
    expect(new Set(s.map((x) => x.partes.map((p) => p.id).sort().join('+'))).size).toBe(s.length)
    expect(sugerirCierre({ kcal: 40, proteina: 3 }, habituales)).toEqual([])
    expect(sugerirCierre({ kcal: 500, proteina: 45 }, [])).toEqual([])
  })
})

describe('avisos amables', () => {
  it('solo avisa si como muy poco varios días seguidos', () => {
    const d = (kcal: number | null) => ({ kcal, objetivo: 2000 })
    expect(comeMuyPoco([d(1200), d(1300), d(1100)])).toBe(true)
    expect(comeMuyPoco([d(1200), d(1800), d(1100)])).toBe(false)
    expect(comeMuyPoco([d(1200), d(1300)])).toBe(false)
    // Un día sin registrar no cuenta como "comer poco"
    expect(comeMuyPoco([d(1200), d(null), d(1100), d(1000)])).toBe(false)
  })

  it('el redondeo a decenas nunca deja el objetivo por debajo del basal', () => {
    const o = objetivoCalorico({ gasto: 2160, basal: 1792, objetivo: 'perder', ritmo: 'moderado', kg: 82.4 })
    expect(o).toEqual({ kcal: 1800, limitadoPorBasal: true })
    expect(o.kcal).toBeGreaterThanOrEqual(1792)
  })

  it('ningún día (ni el de descanso) baja del basal, y la semana suma lo mismo', () => {
    // Objetivo pegado al basal: no hay reparto entre días.
    expect(objetivoDelDia(1800, false, 4, 1792)).toBeGreaterThanOrEqual(1792)
    expect(objetivoDelDia(1800, true, 4, 1792)).toBeLessThanOrEqual(1806)
    // Con algo de margen, el reparto se reduce para no bajar del basal.
    const [entreno, descanso] = [objetivoDelDia(2000, true, 4, 1900), objetivoDelDia(2000, false, 4, 1900)]
    expect(descanso).toBeGreaterThanOrEqual(1900)
    expect(Math.abs(4 * entreno + 3 * descanso - 7 * 2000)).toBeLessThanOrEqual(4)
    // Lejos del basal, el reparto normal (8 %).
    expect(objetivoDelDia(2500, true, 4, 1700)).toBe(2700)
  })
})
