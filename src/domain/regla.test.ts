import { describe, expect, it } from 'vitest'
import { ajustar, inercia, intervaloRepeticion, marcasCruzadas, recorridoInercia, valorTrasArrastre } from './regla'

describe('regla deslizable', () => {
  it('ajusta al paso sin errores de coma flotante y respeta los límites', () => {
    expect(ajustar(80.04, 0.1, 30, 250)).toBe(80)
    expect(ajustar(80.06, 0.1, 30, 250)).toBe(80.1)
    expect(ajustar(0.1 + 0.2, 0.1, 0, 10)).toBe(0.3)
    expect(ajustar(1000, 0.1, 30, 250)).toBe(250)
    expect(ajustar(12, 0.1, 30, 250)).toBe(30)
    expect(ajustar(127, 5, 0, 2000)).toBe(125)
    expect(ajustar(128, 5, 0, 2000)).toBe(130)
  })

  it('arrastrar hacia la izquierda sube el valor y hacia la derecha lo baja', () => {
    expect(valorTrasArrastre(80, -120, 12, 0.1)).toBeCloseTo(81, 6)
    expect(valorTrasArrastre(80, 36, 12, 0.1)).toBeCloseTo(79.7, 6)
  })

  it('la inercia frena poco a poco y se para en un recorrido finito', () => {
    const a = inercia(2, 100)
    const b = inercia(2, 400)
    expect(a.v).toBeLessThan(2)
    expect(b.v).toBeLessThan(a.v)
    expect(b.dx).toBeGreaterThan(a.dx)
    expect(inercia(2, 10_000).dx).toBeCloseTo(recorridoInercia(2), 3)
    // Un lanzamiento rápido salta varios kilos: 3 px/ms con 12 px por 0,1 kg ≈ 8 kg
    expect((recorridoInercia(3) / 12) * 0.1).toBeGreaterThan(5)
  })

  it('cuenta los pasos y los kilos cruzados para vibrar', () => {
    expect(marcasCruzadas(80, 80.3, 0.1, 1)).toEqual({ pasos: 3, grandes: 0 })
    expect(marcasCruzadas(80.9, 81.2, 0.1, 1)).toEqual({ pasos: 3, grandes: 1 })
    expect(marcasCruzadas(81.2, 79.8, 0.1, 1)).toEqual({ pasos: 14, grandes: 2 })
    expect(marcasCruzadas(80.04, 80.06, 0.1, 1)).toEqual({ pasos: 1, grandes: 0 })
  })

  it('los botones mantenidos aceleran', () => {
    expect(intervaloRepeticion(0)).toBeGreaterThan(intervaloRepeticion(800))
    expect(intervaloRepeticion(800)).toBeGreaterThan(intervaloRepeticion(2000))
    expect(intervaloRepeticion(2000)).toBeGreaterThan(intervaloRepeticion(5000))
  })
})
