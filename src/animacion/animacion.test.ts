import { describe, expect, it } from 'vitest'
import catalogo from '../catalogo/ejercicios.json'
import type { Material, Musculo } from '../domain/tipos'
import { asignarAnimacion, type EjercicioAnimable } from './asignacion'
import { interpolar, L, resolverLateral, TOBILLO, type Control } from './esqueleto'
import { enLaSecuencia, FOTOGRAMAS, generarEscena } from './fotogramas'
import { dist, ik } from './geometria'
import { sentadilla } from './patrones'

interface EntradaCatalogo {
  id: string
  nombre: string
  material: Material
  principales: Musculo[]
}
const biblioteca: EjercicioAnimable[] = (catalogo.ejercicios as unknown as EntradaCatalogo[]).map((e) => ({
  id: e.id,
  nombre: e.nombre,
  material: e.material,
  musculosPrincipales: e.principales,
}))

describe('cinemática', () => {
  it('la cinemática inversa respeta las longitudes y llega al objetivo si puede', () => {
    const r = ik([0, 0], [20, 30], L.muslo, L.tibia, 1)
    expect(dist([0, 0], r.medio)).toBeCloseTo(L.muslo, 6)
    expect(dist(r.medio, r.fin)).toBeCloseTo(L.tibia, 6)
    expect(dist(r.fin, [20, 30])).toBeLessThan(1e-6)
  })

  it('si el objetivo queda lejos, el miembro se estira hacia él sin alargarse', () => {
    const r = ik([0, 0], [0, 500], L.brazo, L.antebrazo, -1)
    expect(dist([0, 0], r.fin)).toBeCloseTo(L.brazo + L.antebrazo, 1)
  })

  it('las rodillas se doblan hacia delante y los codos hacia atrás', () => {
    expect(ik([0, 0], [0, 60], L.muslo, L.tibia, 1).medio[0]).toBeGreaterThan(0)
    expect(ik([0, 0], [20, 10], L.brazo, L.antebrazo, -1).medio[1]).toBeGreaterThan(0)
  })

  it('interpola controles con la misma forma y rechaza los que no la tienen', () => {
    const a: Control = { cadera: [0, 0], tronco: 180, brazos: [{ brazo: 0, antebrazo: 0 }, { brazo: 0, antebrazo: 0 }], piernas: [{ tobillo: [0, 80] }, { tobillo: [0, 80] }] }
    const b: Control = { ...a, tronco: 100, brazos: [{ brazo: 90, antebrazo: 90 }, { brazo: 90, antebrazo: 90 }] }
    expect(interpolar(a, b, 0.5).tronco).toBe(140)
    expect(() => interpolar(a, { ...b, brazos: [{ mano: [0, 0] }, { mano: [0, 0] }] }, 0.5)).toThrow()
  })
})

describe('línea de tiempo', () => {
  it('con dos poses va y vuelve, con pausas en los extremos', () => {
    expect(enLaSecuencia(0, 2)).toEqual({ de: 0, a: 0, f: 0 })
    expect(enLaSecuencia(0.5, 2)).toEqual({ de: 1, a: 1, f: 0 })
    const mitad = enLaSecuencia(0.29, 2)
    expect(mitad.de).toBe(0)
    expect(mitad.f).toBeGreaterThan(0.3)
    expect(mitad.f).toBeLessThan(0.7)
  })

  it('con más poses las recorre en orden y vuelve a la primera', () => {
    expect(enLaSecuencia(0.05, 3).de).toBe(0)
    expect(enLaSecuencia(0.4, 3).de).toBe(1)
    const ultima = enLaSecuencia(0.95, 3)
    expect([ultima.de, ultima.a]).toEqual([2, 0])
  })
})

describe('biomecánica básica', () => {
  it('en la sentadilla los pies no se mueven y la cadera baja', () => {
    const a = sentadilla({ carga: 'espalda' })
    const poses = a.claves.map((c) => resolverLateral(c as Control))
    for (const p of poses) expect(p.piernas[0].tobillo[1]).toBeCloseTo(TOBILLO, 1)
    expect(poses[0]!.piernas[0].tobillo[0]).toBeCloseTo(poses[1]!.piernas[0].tobillo[0], 1)
    expect(poses[1]!.cadera[1]).toBeGreaterThan(poses[0]!.cadera[1] + 30)
    // Rodilla por delante del tobillo abajo
    expect(poses[1]!.piernas[0].rodilla[0]).toBeGreaterThan(poses[1]!.piernas[0].tobillo[0])
  })

  it('en el multipower la barra sube y baja en vertical', () => {
    const a = sentadilla({ carga: 'multipower' })
    const [arriba, abajo] = a.claves.map((c) => resolverLateral(c as Control))
    expect(Math.abs(arriba!.brazos[0].agarre[0] - abajo!.brazos[0].agarre[0])).toBeLessThan(4)
  })
})

describe('todos los ejercicios de la biblioteca', () => {
  it('tienen una regla propia (ninguno usa la animación genérica)', () => {
    const genericos = biblioteca.filter((e) => asignarAnimacion(e).regla === 'genérica').map((e) => e.id)
    expect(genericos).toEqual([])
  })

  it('generan una escena válida: misma estructura en cada fotograma y sin números raros', () => {
    for (const e of biblioteca) {
      const { animacion } = asignarAnimacion(e)
      const escena = generarEscena(animacion, e.musculosPrincipales)
      expect(escena.viewBox.every(Number.isFinite), e.id).toBe(true)
      expect(escena.viewBox[2], e.id).toBeGreaterThan(80)
      for (const f of escena.formas) {
        if (f.tipo === 'path') {
          expect(f.d.length === 1 || f.d.length === FOTOGRAMAS, `${e.id} ${f.k}`).toBe(true)
          for (const d of f.d) expect(d.includes('NaN') || d.includes('Infinity'), `${e.id} ${f.k}`).toBe(false)
        } else {
          expect([...f.cx, ...f.cy].every(Number.isFinite), `${e.id} ${f.k}`).toBe(true)
        }
      }
    }
  }, 60_000)

  it('resaltan los músculos principales', () => {
    for (const e of biblioteca.slice(0, 60)) {
      const escena = generarEscena(asignarAnimacion(e).animacion, e.musculosPrincipales)
      expect(escena.formas.some((f) => f.clase === 'musculo'), e.id).toBe(true)
    }
  })
})
