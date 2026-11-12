import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CUERPO_POR_DEFECTO, MEDIDAS, type DatosCuerpo } from '../domain/cuerpo'
import { REGIONES_MODELO } from '../domain/musculos'
import { construirForma, normalesAvatar, pesosEsquinas, volumenLitros } from './forma'
import { medirAvatar, perimetroConvexo } from './medidas'
import { modeloDesdeGlb, type InfoAvatar } from './modelo'
import { cuerpoDeMakeHuman, resolverForma, resolverMacro } from './resolver'

const glb = readFileSync('public/modelos/avatar.glb')
const info = JSON.parse(readFileSync('public/modelos/avatar.json', 'utf8')) as InfoAvatar
const modelo = modeloDesdeGlb(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer, info)
const REF = { sexo: 1, edad: 0, musculo: 0.5, peso: 0.5 }

describe('modelo del avatar', () => {
  it('tiene las regiones de los modelos, en el mismo orden', () => {
    expect(info.regiones).toEqual([...REGIONES_MODELO])
  })

  it('cada región tiene superficie en el mapa de regiones', () => {
    REGIONES_MODELO.forEach((r, i) => expect(info.texels_por_region[i + 1], r).toBeGreaterThan(300))
  })

  it('lleva el esqueleto de 24 huesos con sus extremos y una esquina de MakeHuman por deformador', () => {
    expect(info.huesos).toHaveLength(24)
    for (const h of info.huesos) expect(info.articulaciones[h], h).toBeDefined()
    for (const cola of Object.values(info.colas)) expect(info.articulaciones[cola], cola).toBeDefined()
    expect(info.macro.esquinas).toHaveLength(36)
    expect(info.macro.esquinas.filter((c) => c.morfo < 0)).toHaveLength(1)
    expect(modelo.morfos).toHaveLength(35 + info.objetivos.length)
    expect(modelo.vertices).toBe(info.vertices)
  })

  it('los pesos de las esquinas suman 1, como en MakeHuman', () => {
    for (const p of [REF, { sexo: 0, edad: 0.3, musculo: 0.8, peso: 0.2 }, { sexo: 1, edad: 1, musculo: 0, peso: 1 }]) {
      expect(pesosEsquinas(info, p).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9)
    }
    // En la referencia solo pesa su esquina: la forma es la del archivo.
    const forma = construirForma(modelo, REF)
    expect(Math.max(...forma.posiciones.map((v, i) => Math.abs(v - modelo.posiciones[i]!)))).toBeLessThan(1e-4)
  })
})

describe('forma del avatar', () => {
  it('está de pie en el suelo y mide lo que se le pide', () => {
    const forma = construirForma(modelo, { ...REF, musculo: 0.9, peso: 0.8, alturaM: 1.82 })
    let suelo = Infinity
    let techo = -Infinity
    for (let i = 0; i < info.vertices_forma; i++) {
      suelo = Math.min(suelo, forma.posiciones[i * 3 + 1]!)
      techo = Math.max(techo, forma.posiciones[i * 3 + 1]!)
    }
    expect(suelo).toBeCloseTo(0, 5)
    expect(techo).toBeCloseTo(1.82, 4)
    expect(forma.alto).toBeCloseTo(1.82, 4)
  })

  it('recalcula las articulaciones con la forma', () => {
    const medio = construirForma(modelo, REF)
    const grueso = construirForma(modelo, { ...REF, musculo: 0, peso: 1 })
    const mujer = construirForma(modelo, { ...REF, sexo: 0 })
    // Siguen dentro del cuerpo y en su sitio: el hombro, por encima del codo, y este, de la muñeca.
    for (const f of [medio, grueso, mujer]) {
      expect(f.articulaciones['brazo.L']![1]).toBeGreaterThan(f.articulaciones['antebrazo.L']![1])
      expect(f.articulaciones['antebrazo.L']![1]).toBeGreaterThan(f.articulaciones['mano.L']![1])
      expect(f.articulaciones['muslo.L']![1]).toBeGreaterThan(f.articulaciones['pierna.L']![1])
      expect(f.articulaciones['muslo.L']![0]).toBeCloseTo(-f.articulaciones['muslo.R']![0], 2)
    }
    // La mujer de MakeHuman es más baja: sus caderas quedan más abajo. Con piernas más largas, suben.
    expect(mujer.articulaciones['muslo.L']![1]).toBeLessThan(medio.articulaciones['muslo.L']![1] - 0.05)
    const largas = construirForma(modelo, { ...REF, objetivos: { piernas: 1 } })
    expect(largas.articulaciones['muslo.L']![1]).toBeGreaterThan(medio.articulaciones['muslo.L']![1] + 0.05)
    // Con más peso, los brazos se abren para no meterse en el cuerpo.
    expect(grueso.articulaciones['mano.L']![0]).toBeGreaterThan(medio.articulaciones['mano.L']![0] + 0.03)
  })

  it('los músculos profundos van con la piel', () => {
    const medio = construirForma(modelo, REF)
    const alto = construirForma(modelo, { ...REF, alturaM: 1.9 })
    const k = 1.9 / medio.alto
    for (let i = modelo.union.primero; i < modelo.vertices; i += 97) {
      expect(alto.posiciones[i * 3 + 1]!).toBeCloseTo(medio.posiciones[i * 3 + 1]! * k, 3)
    }
  })

  it('las normales miran hacia fuera y son unitarias', () => {
    const forma = construirForma(modelo, REF)
    const n = normalesAvatar(modelo, forma.posiciones)
    let fuera = 0
    for (let i = 0; i < info.vertices_forma; i += 7) {
      expect(Math.hypot(n[i * 3]!, n[i * 3 + 1]!, n[i * 3 + 2]!)).toBeCloseTo(1, 3)
      // En el tronco, la normal se aleja del eje del cuerpo.
      if (modelo.parte[i] === 0 && n[i * 3]! * forma.posiciones[i * 3]! + n[i * 3 + 2]! * forma.posiciones[i * 3 + 2]! > 0) fuera++
    }
    expect(fuera).toBeGreaterThan(500)
  })

  it('el volumen coincide con la tabla del modelo', () => {
    for (const [s, m, w] of [[1, 0.5, 0.5], [1, 0, 1], [0, 1, 0.5], [1, 0.75, 0.25]] as const) {
      const forma = construirForma(modelo, { sexo: s, edad: 0, musculo: m, peso: w })
      const tabla = info.macro.volumen[s]![0]![Math.round(m * 8)]![Math.round(w * 8)]!
      expect(volumenLitros(modelo, forma.posiciones) / tabla).toBeCloseTo(1, 2)
    }
  })
})

describe('cinta métrica', () => {
  it('mide un círculo', () => {
    const puntos: [number, number][] = Array.from({ length: 360 }, (_, i) => [Math.cos((i * Math.PI) / 180), Math.sin((i * Math.PI) / 180)])
    expect(perimetroConvexo([...puntos, [0, 0], [0.2, 0.1]])).toBeCloseTo(2 * Math.PI, 3)
  })

  it('las medidas del cuerpo medio son las de una persona', () => {
    const r = resolverForma(modelo, CUERPO_POR_DEFECTO)
    console.log('cuerpo por defecto', JSON.stringify(r.medidas), 'músculo', r.parametros.musculo, 'peso', r.parametros.peso, 'definición', r.definicion)
    const limites: Record<string, [number, number]> = {
      cuello: [33, 42], hombros: [100, 125], pecho: [88, 108], cintura: [72, 92], cadera: [86, 104], brazo: [26, 36], antebrazo: [23, 31], muslo: [48, 62], gemelo: [32, 41],
    }
    for (const m of MEDIDAS) {
      expect(r.medidas[m], m).toBeGreaterThan(limites[m]![0])
      expect(r.medidas[m], m).toBeLessThan(limites[m]![1])
    }
  })

  it('crecen con el peso', () => {
    const medio = medirAvatar(modelo, construirForma(modelo, { ...REF, alturaM: 1.75 }), 1)
    const grueso = medirAvatar(modelo, construirForma(modelo, { ...REF, musculo: 0, peso: 1, alturaM: 1.75 }), 1)
    for (const m of MEDIDAS) expect(grueso[m], m).toBeGreaterThan(medio[m])
    expect(grueso.cintura - medio.cintura).toBeGreaterThan(25)
  })
})

describe('del perfil a la forma', () => {
  const persona: DatosCuerpo = { sexo: 'hombre', edad: 28, alturaCm: 178, kg: 80, grasaPct: 15 }

  it('el avatar pesa lo que la persona y tiene su grasa', () => {
    for (const d of [persona, { ...persona, kg: 65, grasaPct: 12 }, { ...persona, kg: 98, grasaPct: 28 }, { sexo: 'mujer', edad: 35, alturaCm: 164, kg: 60, grasaPct: 26 }] as DatosCuerpo[]) {
      const m = resolverMacro(info, d)
      console.log(d.sexo, d.kg, 'kg', d.grasaPct, '% →', 'músculo', m.musculo, 'peso', m.peso, 'da', m.kg.toFixed(1), 'kg y', m.grasa.toFixed(1), '%')
      expect(Math.abs(m.kg - d.kg) / d.kg).toBeLessThan(0.04)
      expect(Math.abs(m.grasa - d.grasaPct!)).toBeLessThan(5)
    }
  })

  it('sin dato de grasa, manda el peso', () => {
    for (const kg of [55, 70, 85, 100, 120]) {
      const m = resolverMacro(info, { sexo: 'hombre', edad: 30, alturaCm: 175, kg })
      console.log(kg, 'kg sin grasa →', 'músculo', m.musculo, 'peso', m.peso, 'da', m.kg.toFixed(1), 'kg y', m.grasa.toFixed(1), '%')
      expect(Math.abs(m.kg - kg) / kg).toBeLessThan(0.06)
    }
  })

  it('con más peso, el avatar es más ancho; con menos grasa, más definido', () => {
    const a = resolverForma(modelo, persona)
    const b = resolverForma(modelo, { ...persona, kg: 95, grasaPct: 27 })
    expect(b.medidas.cintura).toBeGreaterThan(a.medidas.cintura + 8)
    expect(b.definicion).toBeLessThan(a.definicion - 0.3)
    expect(resolverForma(modelo, { ...persona, grasaPct: 9 }).definicion).toBeGreaterThan(a.definicion)
    // La masa de la tabla coincide con la de la malla.
    const c = cuerpoDeMakeHuman(info, 1, 0, 0.5, 0.5, 1.75)
    expect(c.kg).toBeGreaterThan(60)
    expect(c.kg).toBeLessThan(75)
  })

  it('ajusta las medidas de cinta', () => {
    const medidas = { cuello: 39, cintura: 88, brazo: 37, muslo: 60, pecho: 104, gemelo: 39, cadera: 100, antebrazo: 30, hombros: 122 }
    const t0 = performance.now()
    const r = resolverForma(modelo, { ...persona, medidas })
    console.log('medidas pedidas', JSON.stringify(medidas), '\nmedidas del avatar', JSON.stringify(r.medidas), `\n${(performance.now() - t0).toFixed(0)} ms`, JSON.stringify(r.parametros.objetivos))
    for (const [m, cm] of Object.entries(medidas)) expect(Math.abs(r.medidas[m as keyof typeof medidas] - cm), m).toBeLessThan(1.5)
  })

  it('el ajuste fino cambia las proporciones sin cambiar la altura', () => {
    const a = resolverForma(modelo, persona)
    const b = resolverForma(modelo, { ...persona, ajuste: { piernas: 1, hombros: 1 } })
    expect(b.forma.alto).toBeCloseTo(a.forma.alto, 3)
    expect(b.forma.articulaciones['muslo.L']![1]).toBeGreaterThan(a.forma.articulaciones['muslo.L']![1] + 0.015)
    expect(b.forma.articulaciones['brazo.L']![0]).toBeGreaterThan(a.forma.articulaciones['brazo.L']![0] + 0.005)
  })
})
