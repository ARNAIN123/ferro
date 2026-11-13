import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { choquePulgar, colocarPulgar, distanciaSegmentos, puntaPulgar, RADIO_DEDO, RADIO_PULGAR, RADIO_PULGAR_PUNTA, type PulgarEnPuno } from './pulgar'

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
  // Un «puño» de juguete: cuatro dedos como barras verticales en fila (x = 0,03, de z = 0 a 0,06), y el
  // pulgar que empieza en la misma fila, antes del primero, con su punta pedida por fuera de los dedos.
  const dedos = [0, 0.02, 0.04, 0.06].map((z) => [V(0.03, 0, z), V(0.03, 0.04, z)] as const)
  const base = V(0.03, 0.02, -0.035)
  const fuera = 0.03 + RADIO_PULGAR_PUNTA + RADIO_DEDO + 0.001

  it('la punta llega a su sitio pasando por fuera de los dedos, sin meterse en ninguno', () => {
    const p: PulgarEnPuno = {
      base,
      tramos: [
        { largo: 0.04, radio: RADIO_PULGAR, cono: 60 },
        { largo: 0.04, radio: RADIO_PULGAR_PUNTA, cono: 60 },
      ],
      dedos,
      punta: V(fuera, 0.02, 0.03),
    }
    // Derecho a la punta, atravesaría los dedos.
    const derecho = p.punta.clone().sub(base).normalize()
    expect(choquePulgar(p, [derecho, derecho])).toBeGreaterThan(0.01)
    const dirs = colocarPulgar(p)
    expect(choquePulgar(p, dirs)).toBeLessThan(0.002)
    expect(puntaPulgar(p, dirs).distanceTo(p.punta)).toBeLessThan(0.01)
  })

  it('mirando lo que harán los tramos siguientes, el primero gira lo justo para que la punta llegue', () => {
    // Con un primer tramo que, por sí solo, preferiría seguir su idea (hacia atrás), la punta no llegaría.
    const p: PulgarEnPuno = {
      base,
      tramos: [
        { largo: 0.02, radio: 0.004, idea: V(0, 0, -1), cono: 90 },
        { largo: 0.04, radio: RADIO_PULGAR, cono: 60 },
        { largo: 0.04, radio: RADIO_PULGAR_PUNTA, cono: 60 },
      ],
      dedos,
      punta: V(fuera, 0.02, 0.045),
    }
    const dirs = colocarPulgar(p)
    // Siguiendo su idea, el primer tramo se iría hacia atrás 2 cm y la punta no llegaría.
    expect(dirs[0]!.angleTo(V(0, 0, -1))).toBeGreaterThan(0.5)
    expect(puntaPulgar(p, dirs).distanceTo(p.punta)).toBeLessThan(0.01)
    expect(choquePulgar(p, dirs)).toBeLessThan(0.002)
  })

  it('si no hay choque, va derecho a su sitio', () => {
    const p: PulgarEnPuno = {
      base,
      tramos: [
        { largo: 0.035, radio: RADIO_PULGAR, cono: 40 },
        { largo: 0.03, radio: RADIO_PULGAR_PUNTA, cono: 40 },
      ],
      dedos,
      punta: V(0.03, 0.02, -0.1),
    }
    const dirs = colocarPulgar(p)
    // Por pasos de unos grados: casi derecho, y la punta en su sitio.
    expect(dirs[0]!.angleTo(V(0, 0, -1))).toBeLessThan(0.15)
    expect(puntaPulgar(p, dirs).distanceTo(p.punta)).toBeLessThan(0.004)
  })
})
