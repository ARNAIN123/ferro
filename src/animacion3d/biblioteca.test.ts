import { readFileSync } from 'node:fs'
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { EjercicioAnimable } from '../animacion/asignacion'
import catalogo from '../catalogo/ejercicios.json'
import type { Material, Musculo } from '../domain/tipos'
import { definicion3D, esPiloto } from './biblioteca'
import { GROSOR, MEDIO_ANCHO_BANCO } from './desde2d'
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
  }, 60_000)

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
  }, 60_000)

  it('el cuerpo se apoya en bancos, atriles y cajones sin atravesarlos, ni tampoco el suelo (como mucho 1,5 cm)', () => {
    const rig = new Rig(esqueletoDePrueba(articulaciones))
    const tronco = /^(cadera|lumbar|dorsal|pecho|cuello|cabeza|clavicula|muslo)/
    const fallos: string[] = []
    for (const e of biblioteca) {
      if (esPiloto(e.id)) continue
      const d = definicion3D(e)
      d.preparar?.(rig)
      const tapizados: { a: Vector3; b: Vector3; n: Vector3; medio: number; cuenta: RegExp }[] = []
      for (const p of d.material) {
        if (p.tipo !== 'bancoLibre' || !p.arriba) continue
        const atril = (p.ancho ?? 0) > 0.4
        tapizados.push({ a: new Vector3(...p.asiento[0]), b: new Vector3(...p.asiento[1]), n: new Vector3(...p.arriba), medio: atril ? 0.3 : MEDIO_ANCHO_BANCO, cuenta: atril ? /^(brazo|antebrazo)/ : tronco })
        if (p.respaldo && p.arribaRespaldo) tapizados.push({ a: new Vector3(...p.respaldo[0]), b: new Vector3(...p.respaldo[1]), n: new Vector3(...p.arribaRespaldo), medio: MEDIO_ANCHO_BANCO, cuenta: tronco })
      }
      const cajas = d.material.flatMap((p) => (p.tipo === 'caja' ? [p] : []))
      const rep = duracionRep(d)
      let peor = 0
      // Lo más cerca que llega el cuerpo a cada tapizado y a cada tapa (algo tiene que apoyarse).
      const contacto = tapizados.map(() => Infinity)
      const contactoCaja = cajas.map(() => Infinity)
      for (let i = 0; i < 16; i++) {
        d.colocar(interpolar(d.claves, (rep * i) / 16), rig)
        rig.recorrerSuperficie((q) => {
          tapizados.forEach((t, j) => {
            if (Math.abs(q.x - t.a.x) > t.medio + 0.05) return
            const dir = t.b.clone().sub(t.a)
            const largo = dir.length()
            const dd = q.clone().sub(t.a)
            const u = dd.dot(dir.normalize())
            if (u >= -0.02 && u <= largo + 0.02) contacto[j] = Math.min(contacto[j]!, Math.abs(dd.dot(t.n)))
          })
          cajas.forEach((c, j) => {
            if (Math.abs(q.x - c.centro[0]) <= c.tam[0] / 2 + 0.03 && Math.abs(q.z - c.centro[2]) <= c.tam[2] / 2 + 0.03) contactoCaja[j] = Math.min(contactoCaja[j]!, Math.abs(q.y - c.tam[1]))
          })
        })
        rig.recorrerSuperficie((q, h) => {
          if (!/^(pierna|pie|punta|mano|dedos)/.test(h)) peor = Math.max(peor, -q.y)
          for (const t of tapizados) {
            if (!t.cuenta.test(h) || Math.abs(q.x - t.a.x) > t.medio) continue
            const dir = t.b.clone().sub(t.a)
            const largo = dir.length()
            const dd = q.clone().sub(t.a)
            const u = dd.dot(dir.normalize())
            const alto = dd.dot(t.n)
            if (u >= 0 && u <= largo && alto < 0 && alto > -GROSOR) peor = Math.max(peor, -alto)
          }
          for (const c of cajas) {
            if (Math.abs(q.x - c.centro[0]) <= c.tam[0] / 2 && Math.abs(q.z - c.centro[2]) <= c.tam[2] / 2 && q.y <= c.tam[1]) peor = Math.max(peor, Math.min(c.tam[1] - q.y, q.y))
          }
        })
      }
      if (peor > 0.015) fallos.push(`${e.nombre}: ${(peor * 100).toFixed(1)} cm`)
      contacto.forEach((c) => c > 0.03 && fallos.push(`${e.nombre}: banco sin nada apoyado (${(c * 100).toFixed(0)} cm)`))
      // Los bloques de la barra (a los lados) no tocan el cuerpo: solo se miran los cajones del centro.
      contactoCaja.forEach((c, j) => Math.abs(cajas[j]!.centro[0]) < 0.5 && c > 0.03 && fallos.push(`${e.nombre}: cajón sin nada encima (${(c * 100).toFixed(0)} cm)`))
    }
    expect(fallos).toEqual([])
  }, 60_000)

  it('cada cable va a su mano (con dos poleas, una a cada mano) y el material va en las manos', () => {
    const rig = new Rig(esqueletoDePrueba(articulaciones))
    const fallos: string[] = []
    for (const e of biblioteca) {
      if (esPiloto(e.id)) continue
      const d = definicion3D(e)
      const rep = duracionRep(d)
      for (let i = 0; i < 16; i += 5) {
        const estado = d.colocar(interpolar(d.claves, (rep * i) / 16), rig)
        const r = rig.ultimo!
        const manos = (['L', 'R'] as const).map((l) => r.muneca[l])
        const cerca = (p: Vector3, max: number) => manos.some((m) => m.distanceTo(p) < max)
        estado.agarresPolea?.forEach((g, j) => {
          const c = estado.cables![j]!
          if (g.manos) {
            // Un agarre para las dos manos: las dos en él (a la misma altura y a la misma distancia).
            const [m0, m1] = g.manos
            if (Math.abs(m0.y - m1.y) > 0.15 || Math.abs(m0.z - m1.z) > 0.15) fallos.push(`${e.nombre}: una mano fuera del agarre de la polea`)
          } else if (!cerca(c.enganche, 0.15) && !(['L', 'R'] as const).some((l) => r.tobillo[l].distanceTo(c.enganche) < 0.1)) fallos.push(`${e.nombre}: cable lejos de la mano`)
        })
        if (estado.barra && !cerca(estado.barra, 0.75)) fallos.push(`${e.nombre}: barra lejos de las manos`)
        for (const m of Object.values(estado.mancuernas ?? {})) if (m && !cerca(m.centro, 0.12)) fallos.push(`${e.nombre}: mancuerna fuera de la mano`)
      }
    }
    expect([...new Set(fallos)].slice(0, 20)).toEqual([])
  }, 60_000)
})
