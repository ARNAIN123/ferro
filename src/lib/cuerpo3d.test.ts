import { describe, expect, it } from 'vitest'
import { distancia, grosor, relieveMusculo, suavizar, traseraSobreFrontal } from './cuerpo3d'

describe('distancia al borde', () => {
  it('es exacta (euclídea) en una rejilla', () => {
    // 7×7 con una sola semilla en el centro.
    const s = new Uint8Array(49)
    s[3 * 7 + 3] = 1
    const d = distancia(s, 7, 7)
    expect(d[3 * 7 + 3]).toBe(0)
    expect(d[3 * 7 + 6]).toBeCloseTo(3)
    expect(d[0]).toBeCloseTo(Math.hypot(3, 3))
  })

  it('dentro de una banda, la distancia al exterior crece hacia el centro', () => {
    // Banda horizontal de 9 píxeles de alto dentro de una rejilla de 11: exterior arriba y abajo.
    const ancho = 20
    const alto = 11
    const s = new Uint8Array(ancho * alto)
    for (let x = 0; x < ancho; x++) {
      s[x] = 1
      s[(alto - 1) * ancho + x] = 1
    }
    const d = distancia(s, ancho, alto)
    const columna = [...Array(alto).keys()].map((y) => d[y * ancho + 10])
    expect(columna).toEqual([0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0])
  })
})

describe('inflado de la silueta', () => {
  it('el borde no tiene grosor y crece hacia dentro, más despacio en el tronco que en un brazo', () => {
    expect(grosor(1)).toBe(0)
    expect(grosor(10)).toBeGreaterThan(grosor(5))
    // Proporción grosor/anchura: un brazo (radio 10) más redondo que el tronco (radio 50).
    expect(grosor(10) / 10).toBeGreaterThan(grosor(50) / 50)
  })

  it('cada músculo tiene un surco en su contorno y sube hacia el centro', () => {
    expect(relieveMusculo(0, 2, 5)).toBe(0)
    expect(relieveMusculo(3, 2, 5)).toBeLessThan(relieveMusculo(12, 2, 5))
    expect(relieveMusculo(100, 2, 5)).toBeCloseTo(2, 1)
  })
})

describe('vista trasera sobre la cara de atrás', () => {
  it('se refleja en horizontal y se ajusta a la caja frontal', () => {
    const [a, b, c, d, e, f] = traseraSobreFrontal([600, 40, 400, 1000], [40, 30, 400, 1000])
    const ap = (x: number, y: number) => [a * x + c * y + e, b * x + d * y + f]
    // La esquina superior izquierda de la trasera cae en la superior derecha de la frontal.
    expect(ap(600, 40)).toEqual([440, 30])
    expect(ap(1000, 1040)).toEqual([40, 1030])
  })
})

describe('suavizado', () => {
  it('reparte un pico entre sus vecinos sin cambiar un campo constante', () => {
    const pico = new Float32Array(25)
    pico[12] = 9
    const r = suavizar(pico, 5, 5, 1)
    expect(r[12]).toBeCloseTo(1)
    expect(r[6]).toBeCloseTo(1)
    expect(r[0]).toBe(0)
    expect([...suavizar(new Float32Array(25).fill(3), 5, 5, 2)].every((v) => Math.abs(v - 3) < 1e-6)).toBe(true)
  })
})
