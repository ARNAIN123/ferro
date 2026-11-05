import { describe, expect, it } from 'vitest'
import { caloriasDelDia, caloriasNetas, caloriasPasos, densidadSesion, longitudPasoM, metDeSesion, type DensidadSesion } from './calorias'

const MIN = 60_000
const serie = (minuto: number, peso = 60, reps = 10, tipo = 'normal') => ({ hora: minuto * MIN, peso, reps, completada: true, tipo })

describe('pasos', () => {
  it('longitud del paso: 0,414 × altura', () => {
    expect(longitudPasoM(180)).toBeCloseTo(0.745, 3)
  })

  it('0,5 kcal netas por kg y km (ACSM)', () => {
    // 10.000 pasos con 180 cm ≈ 7,45 km; 80 kg → 0,5 × 80 × 7,45 ≈ 298 kcal
    const r = caloriasPasos(10_000, 80, 180)
    expect(r.km).toBeCloseTo(7.452, 2)
    expect(r.kcal).toBeCloseTo(298.1, 0)
  })

  it('escala con el peso y con la altura, y nunca es negativo', () => {
    expect(caloriasPasos(5000, 100, 180).kcal).toBeCloseTo(caloriasPasos(5000, 50, 180).kcal * 2, 6)
    expect(caloriasPasos(5000, 80, 190).kcal).toBeGreaterThan(caloriasPasos(5000, 80, 160).kcal)
    expect(caloriasPasos(-20, 80, 180)).toEqual({ pasos: 0, km: 0, kcal: 0 })
  })
})

describe('densidad de la sesión', () => {
  it('usa la entrada y la salida si están', () => {
    const d = densidadSesion(0, 75 * MIN, [serie(10), serie(13), serie(16)])!
    expect(d.minutos).toBe(75)
    expect(d.series).toBe(3)
    expect(d.volumenKg).toBe(1800)
    expect(d.entreSeriesS).toBe(180)
  })

  it('sin salida, de la primera a la última serie', () => {
    expect(densidadSesion(null, null, [serie(10), serie(12), serie(40)])!.minutos).toBe(30)
    expect(densidadSesion(5 * MIN, null, [serie(10), serie(40)])!.minutos).toBe(35)
  })

  it('los calentamientos no suman series ni volumen, y las pausas largas no son descanso', () => {
    const d = densidadSesion(null, null, [serie(0, 20, 10, 'calentamiento'), serie(2), serie(4), serie(30)])!
    expect(d.series).toBe(3)
    expect(d.volumenKg).toBe(1800)
    expect(d.entreSeriesS).toBe(120) // 2 y 2 min; los 26 min no cuentan
  })

  it('sin series hechas no hay sesión que medir', () => {
    expect(densidadSesion(0, 60 * MIN, [])).toBeNull()
    expect(densidadSesion(0, 60 * MIN, [{ ...serie(5), completada: false }])).toBeNull()
  })
})

describe('MET de fuerza según la densidad', () => {
  const sesion = (o: Partial<DensidadSesion>): DensidadSesion => ({ minutos: 60, series: 20, volumenKg: 10_000, entreSeriesS: 150, ...o })

  it('siempre entre 3,5 y 6', () => {
    expect(metDeSesion(sesion({ series: 4, volumenKg: 500, entreSeriesS: 600 }), 80)).toBe(3.5)
    expect(metDeSesion(sesion({ series: 50, volumenKg: 40_000, entreSeriesS: 45 }), 80)).toBe(6)
  })

  it('más series por minuto, menos descanso o más volumen → más MET', () => {
    const base = metDeSesion(sesion({}), 80)
    expect(base).toBeGreaterThan(3.5)
    expect(base).toBeLessThan(6)
    expect(metDeSesion(sesion({ series: 30 }), 80)).toBeGreaterThan(base)
    expect(metDeSesion(sesion({ entreSeriesS: 90 }), 80)).toBeGreaterThan(base)
    expect(metDeSesion(sesion({ volumenKg: 20_000 }), 80)).toBeGreaterThan(base)
    expect(metDeSesion(sesion({ minutos: 120 }), 80)).toBeLessThan(base)
  })

  it('sin tiempos entre series usa solo las otras señales', () => {
    const m = metDeSesion(sesion({ entreSeriesS: null }), 80)
    expect(m).toBeGreaterThanOrEqual(3.5)
    expect(m).toBeLessThanOrEqual(6)
  })

  it('calorías netas = (MET − 1) × kg × horas', () => {
    expect(caloriasNetas(5, 80, 60)).toBe(320)
    expect(caloriasNetas(3.5, 70, 90)).toBeCloseTo(262.5, 6)
    expect(caloriasNetas(0.5, 70, 90)).toBe(0)
  })
})

describe('calorías del día', () => {
  it('suma pasos y entreno sin contar dos veces los pasos del gimnasio', () => {
    const sesion: DensidadSesion = { minutos: 60, series: 20, volumenKg: 10_000, entreSeriesS: 150 }
    const r = caloriasDelDia({ pasos: 9000, pasosEnEntreno: 1000, kg: 80, alturaCm: 180, sesiones: [sesion] })
    expect(r.pasos.pasos).toBe(8000)
    expect(r.pasos.enEntreno).toBe(1000)
    expect(r.pasos.kcal).toBeCloseTo(caloriasPasos(8000, 80, 180).kcal, 6)
    expect(r.entrenos).toHaveLength(1)
    expect(r.entrenos[0]!.kcal).toBeCloseTo((r.entrenos[0]!.met - 1) * 80, 6)
    expect(r.total).toBeCloseTo(r.pasos.kcal + r.entrenos[0]!.kcal, 6)
  })

  it('los pasos del entreno nunca dejan el día en negativo', () => {
    const r = caloriasDelDia({ pasos: 500, pasosEnEntreno: 800, kg: 80, alturaCm: 180, sesiones: [] })
    expect(r.pasos.pasos).toBe(0)
    expect(r.pasos.enEntreno).toBe(500)
    expect(r.total).toBe(0)
  })

  it('sin entreno, solo los pasos', () => {
    const r = caloriasDelDia({ pasos: 6000, pasosEnEntreno: 0, kg: 70, alturaCm: 170, sesiones: [] })
    expect(r.total).toBeCloseTo(caloriasPasos(6000, 70, 170).kcal, 6)
  })
})
