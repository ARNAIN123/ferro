import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { choquePulgar, colocarPulgar, distanciaSegmentos, RADIO_DEDO, RADIO_PULGAR } from './pulgar'

const V = (x: number, y: number, z: number) => new Vector3(x, y, z)

describe('distancia entre segmentos', () => {
  it('paralelos, cruzados, en el extremo y degenerados', () => {
    expect(distanciaSegmentos(V(0, 0, 0), V(1, 0, 0), V(0, 1, 0), V(1, 1, 0))).toBeCloseTo(1, 9)
    expect(distanciaSegmentos(V(-1, 0, 0), V(1, 0, 0), V(0, -1, 0.5), V(0, 1, 0.5))).toBeCloseTo(0.5, 9)
    // El punto más cercano es un extremo.
    expect(distanciaSegmentos(V(0, 0, 0), V(1, 0, 0), V(2, 1, 0), V(3, 1, 0))).toBeCloseTo(Math.SQRT2, 9)
    expect(distanciaSegmentos(V(0, 0, 0), V(0, 0, 0), V(0, 2, 0), V(0, 3, 0))).toBeCloseTo(2, 9)
    expect(distanciaSegmentos(V(0, 0, 0), V(1, 0, 0), V(0.5, 0.3, 0), V(0.5, 0.3, 0))).toBeCloseTo(0.3, 9)
  })
})

describe('pulgar en un puño', () => {
  // Un «puño» de juguete: cuatro dedos como barras verticales en fila, y el pulgar que empieza al lado.
  const dedos = [0, 0.02, 0.04, 0.06].map((z) => [V(0.03, 0, z), V(0.03, 0.04, z)] as const)
  const base = V(0, 0.02, -0.02)

  it('si la primera idea choca con un dedo, la corrige sin alejarse del puño', () => {
    // La primera idea atraviesa los dedos; se pide pasar por delante (x = 0,03 + radios).
    const delante = 0.03 + RADIO_PULGAR + RADIO_DEDO + 0.001
    const p = { base, largos: [0.035, 0.03] as const, dedos, objetivos: [V(0.03, 0.02, 0.01), V(delante, 0.02, 0.05)] as const }
    const dirs = colocarPulgar(p)
    // La primera idea (derecha a los objetivos) se mete en los dedos; la elegida, casi nada.
    const idea = [p.objetivos[0].clone().sub(base).normalize(), V(1, 0, 0)] as const
    expect(choquePulgar(p, idea)).toBeGreaterThan(0.01)
    expect(choquePulgar(p, dirs)).toBeLessThan(0.003)
    const punta = base.clone().add(dirs[0].clone().multiplyScalar(0.035)).add(dirs[1].clone().multiplyScalar(0.03))
    expect(punta.distanceTo(p.objetivos[1])).toBeLessThan(0.05)
  })

  it('si no hay choque, va derecho a su objetivo', () => {
    const p = { base, largos: [0.035, 0.03] as const, dedos, objetivos: [V(-0.03, 0.02, -0.02), V(-0.06, 0.02, -0.02)] as const }
    const [d1, d2] = colocarPulgar(p)
    expect(d1.angleTo(V(-1, 0, 0))).toBeLessThan(0.01)
    expect(d2.angleTo(V(-1, 0, 0))).toBeLessThan(0.01)
  })
})
