import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { distanciaSegmentos, PULGAR_PUNO, pulgarEnPuno } from './pulgar'

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

describe('pulgar en el puño', () => {
  it('sigue a la mano y la derecha es el espejo de la izquierda', () => {
    const giro = new Quaternion().setFromAxisAngle(V(0, 0, 1), 0.7)
    const izq = pulgarEnPuno(true, giro, 3)
    const der = pulgarEnPuno(false, giro, 3)
    PULGAR_PUNO.forEach(([x, y, z], i) => {
      expect(izq[i]!.length()).toBeCloseTo(1, 6)
      expect(izq[i]!.distanceTo(V(x, y, z).normalize().applyQuaternion(giro))).toBeLessThan(1e-9)
      expect(der[i]!.distanceTo(V(-x, y, z).normalize().applyQuaternion(giro))).toBeLessThan(1e-9)
    })
    // Sin metacarpiano, las dos falanges.
    expect(pulgarEnPuno(true, giro, 2).map((d) => d.toArray())).toEqual(izq.slice(1).map((d) => d.toArray()))
  })
})
