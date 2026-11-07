import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import catalogo from '../catalogo/ejercicios.json'
import { duracionRep, EJERCICIOS_3D, enConcentrica, momento, REPETICIONES } from './ejercicios'
import { esqueletoDePrueba } from './esqueletoDePrueba'
import { anguloArticulacion, interpolar } from './ik'
import { Rig } from './rig'

const articulaciones = (JSON.parse(readFileSync(new URL('../../public/modelos/cuerpo-rig.json', import.meta.url), 'utf-8')) as { articulaciones: Record<string, number[]> }).articulaciones
const ids = new Set((catalogo as { ejercicios: { id: string }[] }).ejercicios.map((e) => e.id))

describe('animaciones 3D: piloto', () => {
  it('son los 10 ejercicios del piloto y existen en la biblioteca', () => {
    expect(EJERCICIOS_3D).toHaveLength(10)
    for (const d of EJERCICIOS_3D) expect(ids.has(d.id), d.id).toBe(true)
  })

  it('tempo real: al menos 4–6 poses por repetición, subida de ~1 s y bajada de ~2 s', () => {
    for (const d of EJERCICIOS_3D) {
      expect(d.claves.length, d.id).toBeGreaterThanOrEqual(7)
      const con = d.concentrica.reduce((s, [a, b]) => s + (b - a), 0)
      expect(con, d.id).toBeCloseTo(1, 1)
      // La bajada (lo que no es subida ni pausa) dura unos 2 s.
      const rep = duracionRep(d)
      expect(rep - con, d.id).toBeGreaterThan(2)
      expect(rep, d.id).toBeLessThan(4.5)
      // La primera y la última pose son la misma: el bucle no salta.
      expect(d.claves[0]!.p, d.id).toEqual(d.claves[d.claves.length - 1]!.p)
    }
  })

  it('el bucle hace 3 repeticiones y una pausa', () => {
    const d = EJERCICIOS_3D[0]!
    const rep = duracionRep(d)
    expect(momento(d, rep * 1.5).rep).toBe(1)
    expect(momento(d, rep * REPETICIONES + 0.5).enPausa).toBe(true)
    expect(momento(d, rep * REPETICIONES + 5).enPausa).toBe(false)
    expect(enConcentrica(d, d.concentrica[0]![0] + 0.1)).toBe(true)
  })

  it('en cada instante las manos y los pies llegan a su sitio, con articulaciones posibles y sobre el suelo', () => {
    const rig = new Rig(esqueletoDePrueba(articulaciones))
    const fallos: string[] = []
    for (const d of EJERCICIOS_3D) {
      const rep = duracionRep(d)
      for (let t = 0; t <= rep + 1e-9; t += rep / 24) {
        const estado = d.colocar(interpolar(d.claves, t), rig)
        const r = rig.ultimo!
        for (const [clave, ok] of Object.entries(r.alcanzado)) if (!ok) fallos.push(`${d.id} no alcanza ${clave} en t=${t.toFixed(2)}`)
        for (const lado of ['L', 'R'] as const) {
          const codo = anguloArticulacion(rig.pos(`brazo.${lado}`), r.codo[lado], r.muneca[lado])
          const rodilla = anguloArticulacion(rig.pos(`muslo.${lado}`), r.rodilla[lado], r.tobillo[lado])
          if (codo < 18) fallos.push(`${d.id} codo ${lado} cerrado (${codo.toFixed(0)}°) en t=${t.toFixed(2)}`)
          if (rodilla < 40) fallos.push(`${d.id} rodilla ${lado} cerrada (${rodilla.toFixed(0)}°) en t=${t.toFixed(2)}`)
          if (r.tobillo[lado].y < 0.04) fallos.push(`${d.id} tobillo ${lado} bajo el suelo`)
        }
        if (estado.barra && estado.barra.y < 0.2) fallos.push(`${d.id} barra bajo el suelo`)
      }
    }
    expect([...new Set(fallos)].slice(0, 15)).toEqual([])
  })
})
