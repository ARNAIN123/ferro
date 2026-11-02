import { describe, expect, it } from 'vitest'
import { asignarObjetivos, descarga, estancado, mejora, rendimiento, sugerenciaAplicada, sugerirProgresion, type SerieProgresion } from './progresion'

const s = (peso: number, reps: number, rir: number | null = null, tipo: SerieProgresion['tipo'] = 'normal'): SerieProgresion => ({
  peso,
  reps,
  rir,
  tipo,
})
const obj = { seriesObjetivo: 3, repsMin: 8, repsMax: 12, salto: 2.5 }

describe('doble progresión', () => {
  it('sin historial no sugiere nada', () => {
    expect(sugerirProgresion([], obj)).toBeNull()
    expect(sugerirProgresion([s(40, 10, null, 'calentamiento')], obj)).toBeNull()
  })

  it('todas las series en el máximo → sube el salto y vuelve al mínimo de reps', () => {
    const sug = sugerirProgresion([s(60, 12), s(60, 12), s(60, 12)], obj)
    expect(sug?.tipo).toBe('subir_peso')
    expect(sug?.delta).toBe(2.5)
    expect(sug?.objetivos).toEqual([
      { peso: 62.5, reps: 8 },
      { peso: 62.5, reps: 8 },
      { peso: 62.5, reps: 8 },
    ])
  })

  it('pasarse del máximo también cuenta', () => {
    expect(sugerirProgresion([s(60, 13), s(60, 12), s(60, 12)], obj)?.tipo).toBe('subir_peso')
  })

  it('usa el salto de cada ejercicio (mancuernas 2 kg, máquina 5 kg)', () => {
    expect(sugerirProgresion([s(20, 12), s(20, 12), s(20, 12)], { ...obj, salto: 2 })?.objetivos[0]?.peso).toBe(22)
    expect(sugerirProgresion([s(50, 12), s(50, 12), s(50, 12)], { ...obj, salto: 5 })?.objetivos[0]?.peso).toBe(55)
  })

  it('si alguna serie no llegó al máximo → mismo peso y +1 rep donde falta', () => {
    const sug = sugerirProgresion([s(60, 12), s(60, 10), s(60, 9)], obj)
    expect(sug?.tipo).toBe('subir_reps')
    expect(sug?.objetivos).toEqual([
      { peso: 60, reps: 12 },
      { peso: 60, reps: 11 },
      { peso: 60, reps: 10 },
    ])
  })

  it('si hice menos series de las previstas no sube peso', () => {
    const sug = sugerirProgresion([s(60, 12), s(60, 12)], obj)
    expect(sug?.tipo).toBe('mantener')
    expect(sug?.objetivos).toHaveLength(3)
  })

  it('ignora calentamientos y drop sets', () => {
    const sug = sugerirProgresion([s(30, 10, null, 'calentamiento'), s(60, 12), s(60, 12), s(60, 12), s(45, 6, null, 'drop')], obj)
    expect(sug?.tipo).toBe('subir_peso')
  })

  it('RIR 0 en la mayoría de las series → no sube peso aunque llegara al máximo', () => {
    const sug = sugerirProgresion([s(60, 12, 0), s(60, 12, 0), s(60, 12, 1)], obj)
    expect(sug?.tipo).toBe('mantener')
    expect(sug?.objetivos.every((o) => o.peso === 60 && o.reps === 12)).toBe(true)
  })

  it('RIR 0 solo en una minoría → sube igualmente', () => {
    expect(sugerirProgresion([s(60, 12, 2), s(60, 12, 1), s(60, 12, 0)], obj)?.tipo).toBe('subir_peso')
  })

  it('sin RIR anotado se comporta como doble progresión normal', () => {
    expect(sugerirProgresion([s(60, 12), s(60, 12, 0), s(60, 12)], obj)?.tipo).toBe('subir_peso')
  })

  it('con salto 0 no puede subir peso', () => {
    expect(sugerirProgresion([s(0, 12), s(0, 12), s(0, 12)], { ...obj, salto: 0 })?.tipo).toBe('mantener')
  })

  it('las reps sugeridas nunca bajan del mínimo del rango', () => {
    expect(sugerirProgresion([s(60, 5), s(60, 5), s(60, 5)], obj)?.objetivos[0]).toEqual({ peso: 60, reps: 8 })
  })
})

describe('estancamiento', () => {
  // Sesiones de la más reciente a la más antigua.
  it('3 sesiones seguidas sin mejorar peso ni reps → estancado', () => {
    const igual = [s(80, 8), s(80, 7), s(80, 6)]
    expect(estancado([igual, igual, igual, igual])).toBe(true)
  })

  it('oscilar sin superar la referencia sigue siendo estancamiento', () => {
    const ref = [s(80, 8), s(80, 8), s(80, 7)]
    const peor = [s(80, 7), s(80, 7), s(80, 6)]
    expect(estancado([ref, peor, ref, ref])).toBe(true)
  })

  it('una mejora en peso o en reps rompe el estancamiento', () => {
    const base = [s(80, 8), s(80, 7)]
    expect(estancado([base, base, [s(82.5, 6), s(82.5, 6)], base])).toBe(false)
    expect(estancado([[s(80, 9), s(80, 7)], base, base, base])).toBe(false)
    expect(estancado([base, [s(80, 8), s(80, 8)], base, base])).toBe(false)
  })

  it('hacen falta al menos 4 sesiones (referencia + 3)', () => {
    const igual = [s(80, 8)]
    expect(estancado([igual, igual, igual])).toBe(false)
  })

  it('solo mira las 4 sesiones más recientes', () => {
    const igual = [s(80, 8)]
    expect(estancado([igual, igual, igual, igual, [s(60, 8)]])).toBe(true)
  })

  it('compara rendimientos', () => {
    const a = rendimiento([s(80, 8), s(80, 6), s(70, 12)])!
    expect(a.pesoMax).toBe(80)
    expect(a.mejorReps).toBe(8)
    expect(a.repsTotales).toBe(14)
    expect(mejora(rendimiento([s(80, 8), s(80, 7)])!, a)).toBe(true)
    expect(mejora(a, a)).toBe(false)
  })
})

describe('descarga del 10 %', () => {
  it('baja un 10 % y redondea hacia abajo al salto', () => {
    expect(descarga(100, 2.5)).toBe(90)
    expect(descarga(62.5, 2.5)).toBe(55)
    expect(descarga(22, 2)).toBe(18)
    expect(descarga(55, 5)).toBe(45)
  })
})

describe('aplicar la sugerencia', () => {
  const actuales = [
    { id: 'c', tipo: 'calentamiento' as const, orden: 0, completada: false, peso: 30, reps: 10 },
    { id: '1', tipo: 'normal' as const, orden: 1, completada: true, peso: 60, reps: 12 },
    { id: '2', tipo: 'normal' as const, orden: 2, completada: false, peso: 60, reps: 10 },
    { id: '3', tipo: 'normal' as const, orden: 3, completada: false, peso: 60, reps: 9 },
  ]
  const objetivos = [
    { peso: 60, reps: 12 },
    { peso: 60, reps: 11 },
    { peso: 60, reps: 10 },
  ]

  it('solo toca series normales pendientes, en orden', () => {
    expect(asignarObjetivos(actuales, objetivos)).toEqual([
      { id: '2', peso: 60, reps: 11 },
      { id: '3', peso: 60, reps: 10 },
    ])
  })

  it('si hay más series que objetivos repite el último', () => {
    expect(asignarObjetivos([...actuales, { ...actuales[3]!, id: '4', orden: 4 }], objetivos).at(-1)).toEqual({ id: '4', peso: 60, reps: 10 })
  })

  it('sabe si ya está aplicada', () => {
    expect(sugerenciaAplicada(actuales, objetivos)).toBe(false)
    const aplicadas = actuales.map((s) => (s.id === '2' ? { ...s, reps: 11 } : s.id === '3' ? { ...s, reps: 10 } : s))
    expect(sugerenciaAplicada(aplicadas, objetivos)).toBe(true)
  })
})
