import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import catalogo from '../catalogo/ejercicios.json'
import { aGrupos, GRUPO_DE_REGION, grupoDeNombre, grupoDeRegion, INFO_MUSCULO, nivelesPorZona, nombresDeMusculos, REGIONES_MODELO, zonaDe } from './musculos'
import { MUSCULOS, ZONAS, type Musculo } from './tipos'

const leer = (archivo: string) => JSON.parse(readFileSync(new URL(`../../public/modelos/${archivo}`, import.meta.url), 'utf-8'))
const cuerpo = leer('cuerpo.json') as { regiones: string[]; caras_por_region: Record<string, number> }
const avatar = leer('avatar.json') as { regiones: string[]; texels_por_region: number[] }
const biblioteca = catalogo.ejercicios as unknown as { id: string; nombre: string; principales: Musculo[]; secundarios: Musculo[] }[]

describe('división muscular simple (ronda 5)', () => {
  it('son los 18 grupos grandes, cada uno con nombre y sus zonas 2D', () => {
    expect([...MUSCULOS].map((m) => INFO_MUSCULO[m].nombre)).toEqual([
      'Cuello',
      'Trapecio',
      'Hombros',
      'Pecho',
      'Bíceps',
      'Tríceps',
      'Antebrazos',
      'Espalda alta',
      'Dorsales',
      'Lumbares',
      'Abdominales',
      'Oblicuos',
      'Glúteos',
      'Abductores',
      'Aductores',
      'Cuádriceps',
      'Isquiotibiales',
      'Gemelos',
    ])
    for (const m of MUSCULOS) {
      expect(INFO_MUSCULO[m].zonas.length, m).toBeGreaterThan(0)
      for (const z of INFO_MUSCULO[m].zonas) expect(ZONAS, m).toContain(z)
    }
    // Cada zona 2D es de un solo grupo.
    const zonas = MUSCULOS.flatMap((m) => INFO_MUSCULO[m].zonas)
    expect(new Set(zonas).size).toBe(zonas.length)
    expect(zonaDe('pecho')).toBe('pectoral_inferior')
  })

  it('cada región de los modelos 3D es de un grupo y todos los grupos tienen superficie', () => {
    // Los dos modelos tienen las mismas 48 regiones, en el mismo orden que REGIONES_MODELO.
    expect(cuerpo.regiones).toEqual([...REGIONES_MODELO])
    expect(avatar.regiones).toEqual([...REGIONES_MODELO])
    for (const m of MUSCULOS) {
      const suyas = REGIONES_MODELO.filter((r) => GRUPO_DE_REGION[r] === m)
      expect(suyas.length, m).toBeGreaterThan(0)
      expect(suyas.reduce((t, r) => t + (cuerpo.caras_por_region[r] ?? 0), 0), m).toBeGreaterThan(200)
      expect(suyas.reduce((t, r) => t + (avatar.texels_por_region[REGIONES_MODELO.indexOf(r) + 1] ?? 0), 0), m).toBeGreaterThan(200)
    }
    expect(grupoDeRegion(REGIONES_MODELO.indexOf('vasto_medial') + 1)).toBe('cuadriceps')
    expect(grupoDeRegion(REGIONES_MODELO.indexOf('romboides') + 1)).toBe('espalda_alta')
    expect(grupoDeRegion(0)).toBeNull()
  })

  it('el reparto de los músculos de antes en los grupos', () => {
    const casos: [string, Musculo][] = [
      ['esplenio', 'cuello'],
      ['trapecio_superior', 'trapecio'],
      ['trapecio_medio', 'espalda_alta'],
      ['romboides', 'espalda_alta'],
      ['infraespinoso', 'espalda_alta'],
      ['supraespinoso', 'hombros'],
      ['subescapular', 'hombros'],
      ['redondo_mayor', 'dorsales'],
      ['serrato_anterior', 'pecho'],
      ['braquial', 'biceps'],
      ['braquiorradial', 'antebrazos'],
      ['triceps_medial', 'triceps'],
      ['psoas_iliaco', 'abdominales'],
      ['gluteo_menor', 'abductores'],
      ['tensor_fascia_lata', 'abductores'],
      ['sartorio', 'cuadriceps'],
      ['semimembranoso', 'isquiotibiales'],
      ['soleo', 'gemelos'],
      ['tibial_anterior', 'gemelos'],
    ]
    for (const [antes, grupo] of casos) expect(grupoDeNombre(antes), antes).toBe(grupo)
  })

  it('los nombres de cualquier versión se convierten, y los de ahora se quedan igual', () => {
    // Zonas de las rondas 2–3 y nombres de la v1.
    expect(grupoDeNombre('pectoral_superior')).toBe('pecho')
    expect(grupoDeNombre('espalda_media')).toBe('espalda_alta')
    expect(grupoDeNombre('abdomen')).toBe('abdominales')
    expect(grupoDeNombre('gluteo_medio')).toBe('abductores')
    expect(grupoDeNombre('espalda')).toBe('dorsales')
    expect(grupoDeNombre('desconocido')).toBeNull()
    for (const m of MUSCULOS) expect(grupoDeNombre(m)).toBe(m)

    const r = aGrupos(['dorsal_ancho', 'redondo_mayor'], ['biceps', 'braquial', 'romboides', 'dorsal_ancho', 'inventado'])
    expect(r).toEqual({ principales: ['dorsales'], secundarios: ['biceps', 'espalda_alta'] })
    expect(aGrupos(r.principales, r.secundarios)).toEqual(r)
    expect(aGrupos([], [])).toEqual({ principales: [], secundarios: [] })
  })

  it('nombres de una lista y niveles por zona 2D', () => {
    expect(nombresDeMusculos(['cuadriceps', 'gluteos', 'cuadriceps'])).toEqual(['Cuádriceps', 'Glúteos'])
    const z = nivelesPorZona(new Map<Musculo, number>([['hombros', 3], ['biceps', 1]]))
    expect(z.get('deltoides_lateral')).toBe(3)
    expect(z.get('braquial')).toBe(1)
  })
})

describe('músculos de los ejercicios de la biblioteca', () => {
  const de = (nombre: string) => biblioteca.find((e) => e.nombre === nombre)!

  it('todos están en los grupos, con algún principal y sin repetir principales en secundarios', () => {
    for (const e of biblioteca) {
      expect(e.principales.length, e.nombre).toBeGreaterThan(0)
      for (const m of [...e.principales, ...e.secundarios]) expect(MUSCULOS, `${e.nombre}: ${m}`).toContain(m)
      for (const m of e.secundarios) expect(e.principales, `${e.nombre}: ${m}`).not.toContain(m)
    }
    // Todos los grupos tienen algún ejercicio como principal.
    for (const m of MUSCULOS) expect(biblioteca.some((e) => e.principales.includes(m)), m).toBe(true)
  })

  it('algunos de los de siempre', () => {
    expect(de('Press de banca con barra')).toMatchObject({ principales: ['pecho'], secundarios: ['hombros', 'triceps'] })
    expect(de('Remo con barra').principales).toEqual(['dorsales', 'espalda_alta'])
    expect(de('Curl martillo').principales).toEqual(['biceps', 'antebrazos'])
    expect(de('Peso muerto sumo').principales).toContain('aductores')
    expect(de('Abducción de cadera en polea').principales).toEqual(['abductores'])
    expect(de('Elevaciones laterales con mancuernas').principales).toEqual(['hombros'])
  })
})
