import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { EjercicioAnimable } from '../animacion/asignacion'
import catalogo from '../catalogo/ejercicios.json'
import type { Material, Musculo } from '../domain/tipos'
import { definicion3D, esPiloto } from './biblioteca'
import { duracionRep } from './ejercicios'
import { esqueletoDePrueba } from './esqueletoDePrueba'
import { interpolar } from './ik'
import { Rig } from './rig'

const articulaciones = (JSON.parse(readFileSync(new URL('../../public/modelos/cuerpo-rig.json', import.meta.url), 'utf-8')) as { articulaciones: Record<string, number[]> }).articulaciones
const biblioteca: EjercicioAnimable[] = (catalogo.ejercicios as unknown as { id: string; nombre: string; material: Material; principales: Musculo[] }[]).map((e) => ({
  id: e.id,
  nombre: e.nombre,
  material: e.material,
  musculosPrincipales: e.principales,
}))

describe('animaciones 3D de toda la biblioteca', () => {
  it('cada ejercicio tiene animación 3D con tempo real (subida ~1 s, bajada ~2 s)', () => {
    for (const e of biblioteca) {
      const d = definicion3D(e)
      expect(d.id).toBe(e.id)
      expect(d.claves.length, e.id).toBeGreaterThanOrEqual(7)
      const rep = duracionRep(d)
      expect(rep, e.id).toBeGreaterThan(2.5)
      expect(d.concentrica.length, e.id).toBeGreaterThan(0)
      for (const [a, b] of d.concentrica) expect(b - a, e.id).toBeLessThanOrEqual(1.05)
    }
  })

  it('en toda la repetición el cuerpo es válido: sin números raros y con los pies sobre el suelo', () => {
    const rig = new Rig(esqueletoDePrueba(articulaciones))
    const fallos: string[] = []
    let sinAlcanzar = 0
    let muestras = 0
    for (const e of biblioteca) {
      if (esPiloto(e.id)) continue
      const d = definicion3D(e)
      const rep = duracionRep(d)
      for (let i = 0; i <= 16; i++) {
        const t = (rep * i) / 16
        let estado
        try {
          estado = d.colocar(interpolar(d.claves, t), rig)
        } catch (err) {
          fallos.push(`${e.id}: ${(err as Error).message}`)
          break
        }
        const r = rig.ultimo!
        muestras++
        if (!r.alcanzado['mano.L'] || !r.alcanzado['mano.R']) sinAlcanzar++
        for (const lado of ['L', 'R'] as const) {
          const m = r.muneca[lado]
          if (!Number.isFinite(m.x + m.y + m.z)) fallos.push(`${e.id}: muñeca ${lado} no válida`)
          if (r.tobillo[lado].y < 0.035) fallos.push(`${e.id}: tobillo ${lado} bajo el suelo (${r.tobillo[lado].y.toFixed(3)})`)
        }
        if (estado.barra && !Number.isFinite(estado.barra.y)) fallos.push(`${e.id}: barra no válida`)
      }
    }
    expect([...new Set(fallos)].slice(0, 20)).toEqual([])
    // Casi siempre llegan las dos manos a su sitio (si no, se estiran hacia él).
    expect(sinAlcanzar / muestras).toBeLessThan(0.15)
  })
})
