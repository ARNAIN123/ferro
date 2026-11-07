import { readFileSync } from 'node:fs'
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { esqueletoDePrueba } from './esqueletoDePrueba'
import { anguloArticulacion, dosHuesos, giroEntreBases, interpolar } from './ik'
import { Rig, type Extremo } from './rig'

const articulaciones = (JSON.parse(readFileSync(new URL('../../public/modelos/cuerpo-rig.json', import.meta.url), 'utf-8')) as { articulaciones: Record<string, number[]> }).articulaciones

describe('cinemática inversa', () => {
  it('dos huesos: respeta las longitudes, llega al objetivo y dobla hacia el polo', () => {
    const s = new Vector3(0, 1.4, 0)
    const t = new Vector3(0.2, 1.0, 0.25)
    const { medio, fin, alcanzado } = dosHuesos(s, t, 0.28, 0.25, new Vector3(0, 0, -1))
    expect(alcanzado).toBe(true)
    expect(medio.distanceTo(s)).toBeCloseTo(0.28, 6)
    expect(medio.distanceTo(fin)).toBeCloseTo(0.25, 6)
    expect(fin.distanceTo(t)).toBeLessThan(1e-6)
    // El codo queda del lado del polo (detrás).
    const centro = s.clone().add(t).multiplyScalar(0.5)
    expect(medio.z).toBeLessThan(centro.z)
  })

  it('fuera de alcance se estira sin hiperextenderse', () => {
    const s = new Vector3(0, 0, 0)
    const r = dosHuesos(s, new Vector3(0, -2, 0), 0.43, 0.37, new Vector3(0, 0, 1))
    expect(r.alcanzado).toBe(false)
    expect(anguloArticulacion(s, r.medio, r.fin)).toBeLessThan(180)
    expect(anguloArticulacion(s, r.medio, r.fin)).toBeGreaterThan(170)
  })

  it('el giro entre bases lleva la dirección y la secundaria de reposo a las deseadas', () => {
    const q = giroEntreBases(new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0))
    expect(new Vector3(0, -1, 0).applyQuaternion(q).distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-6)
    expect(new Vector3(0, 0, 1).applyQuaternion(q).distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-6)
  })

  it('interpolación continua: pasa por las claves y no se sale de su rango', () => {
    const claves = [
      { t: 0, p: { y: 1 } },
      { t: 1, p: { y: 0.6 } },
      { t: 2, p: { y: 0 } },
      { t: 2.3, p: { y: 0 } },
      { t: 3.3, p: { y: 1 } },
    ]
    expect(interpolar(claves, 1).y).toBeCloseTo(0.6)
    expect(interpolar(claves, 2.15).y).toBeCloseTo(0)
    for (let t = 0; t <= 3.3; t += 0.05) {
      const y = interpolar(claves, t).y
      expect(y).toBeGreaterThanOrEqual(-1e-9)
      expect(y).toBeLessThanOrEqual(1 + 1e-9)
    }
  })
})

describe('rig', () => {
  it('pone las manos y los pies donde se le pide y mantiene las longitudes', () => {
    const rig = new Rig(esqueletoDePrueba(articulaciones))
    const tronco = rig.aplicarTronco({ pelvis: { pos: [0, 0.75, -0.2], rot: [25, 0, 0] }, columna: [10, 0, 0] })
    const mano = (lado: 'L' | 'R'): Extremo => {
      const s = lado === 'L' ? 1 : -1
      return { pos: [0.25 * s, 0.72, 0.12], polo: [0.3 * s, 0, -1], dir: [0, -1, 0], normal: [0, 0, -1] }
    }
    const pie = (lado: 'L' | 'R'): Extremo => {
      const s = lado === 'L' ? 1 : -1
      return { pos: [0.14 * s, 0.066, -0.04], polo: [0.2 * s, 0, 1], dir: [0, -0.3, 1], normal: [0, 1, 0.3] }
    }
    const r = rig.aplicarExtremos({ L: mano('L'), R: mano('R') }, { L: pie('L'), R: pie('R') })
    expect(r.alcanzado['mano.L']).toBe(true)
    expect(r.muneca.L.distanceTo(new Vector3(0.25, 0.72, 0.12))).toBeLessThan(0.002)
    expect(r.tobillo.R.distanceTo(new Vector3(-0.14, 0.066, -0.04))).toBeLessThan(0.002)
    expect(r.codo.L.distanceTo(tronco.hombro.L)).toBeCloseTo(rig.longitud('brazo.L', 'antebrazo.L'), 3)
    expect(r.rodilla.R.distanceTo(tronco.cadera.R)).toBeCloseTo(rig.longitud('muslo.R', 'pierna.R'), 3)
    // La rodilla, hacia delante (hacia el polo).
    expect(r.rodilla.L.z).toBeGreaterThan(tronco.cadera.L.z)
  })
})
