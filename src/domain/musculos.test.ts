import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import catalogo from '../catalogo/ejercicios.json'
import { opacidadSobreProfundo, profundoDeMarca } from './cuerpo3d'
import { debajoDe, ENCIMA_DE, esProfundo, GRUPOS, hermanos, INFO_MUSCULO, MUSCULOS_DE_GRUPO, nivelesPorZona, nombresDeMusculos, PROFUNDOS, rutaDe } from './musculos'
import { esListaNueva, musculosFinos } from './reasignacion'
import { MUSCULOS, ZONAS, type Material, type Musculo } from './tipos'

const modelo = JSON.parse(readFileSync(new URL('../../public/modelos/cuerpo.json', import.meta.url), 'utf-8')) as {
  profundos: string[]
  encima: Record<string, string[]>
  caras_por_region: Record<string, number>
}
const biblioteca = catalogo.ejercicios as unknown as { id: string; nombre: string; material: Material; principales: Musculo[]; secundarios: Musculo[] }[]

describe('división muscular completa (ronda 4)', () => {
  it('están todos los músculos de la lista, cada uno en su grupo', () => {
    const lista: Record<string, Musculo[]> = {
      cuello: ['esternocleidomastoideo'],
      hombros: ['deltoides_anterior', 'deltoides_lateral', 'deltoides_posterior'],
      pecho: ['pectoral_clavicular', 'pectoral_esternal', 'pectoral_costal', 'serrato_anterior'],
      espalda: ['trapecio_superior', 'trapecio_medio', 'trapecio_inferior', 'romboides', 'dorsal_ancho', 'redondo_mayor', 'infraespinoso', 'redondo_menor', 'erectores_espinales'],
      brazos: ['biceps', 'braquial', 'braquiorradial', 'triceps_larga', 'triceps_lateral', 'triceps_medial', 'flexores_antebrazo', 'extensores_antebrazo'],
      core: ['recto_abdominal', 'oblicuos'],
      cadera: ['gluteo_mayor', 'gluteo_medio', 'gluteo_menor', 'tensor_fascia_lata', 'psoas_iliaco'],
      piernas: ['recto_femoral', 'vasto_lateral', 'vasto_medial', 'sartorio', 'aductores', 'biceps_femoral', 'semitendinoso', 'semimembranoso', 'gemelo_medial', 'gemelo_lateral', 'soleo', 'tibial_anterior', 'peroneos'],
    }
    for (const g of GRUPOS) for (const m of lista[g]!) expect(MUSCULOS_DE_GRUPO[g], `${m} en ${g}`).toContain(m)
    // Cada músculo está en un grupo y tiene nombre y zona 2D.
    expect(GRUPOS.flatMap((g) => MUSCULOS_DE_GRUPO[g]).sort()).toEqual([...MUSCULOS].sort())
    for (const m of MUSCULOS) {
      expect(INFO_MUSCULO[m].nombre.length, m).toBeGreaterThan(3)
      expect(ZONAS, m).toContain(INFO_MUSCULO[m].zona)
    }
  })

  it('auditoría: todo músculo que trabaja algún ejercicio existe y tiene su región en el modelo', () => {
    for (const e of biblioteca)
      for (const m of [...e.principales, ...e.secundarios]) {
        expect(MUSCULOS, `${e.nombre}: ${m}`).toContain(m)
        expect(modelo.caras_por_region[m] ?? 0, m).toBeGreaterThan(0)
      }
    // Los que la auditoría añadió a la lista mínima.
    for (const m of ['esplenio', 'supraespinoso', 'subescapular'] as const) expect(biblioteca.some((e) => [...e.principales, ...e.secundarios].includes(m)), m).toBe(true)
  })

  it('las porciones se agrupan en su músculo', () => {
    expect(hermanos('triceps_larga')).toEqual(['triceps_lateral', 'triceps_medial'])
    expect(hermanos('biceps')).toEqual([])
    expect(rutaDe('vasto_medial')).toBe('Piernas › Cuádriceps')
    expect(rutaDe('oblicuos')).toBe('Core')
    expect(nombresDeMusculos(['recto_femoral', 'vasto_lateral', 'vasto_medial', 'gluteo_mayor'])).toEqual(['Cuádriceps', 'Glúteo mayor'])
    expect(nombresDeMusculos(['vasto_lateral', 'vasto_medial'])).toEqual(['Vasto lateral', 'Vasto medial'])
    expect(nombresDeMusculos(['dorsal_ancho', 'triceps_larga', 'triceps_lateral', 'triceps_medial'])).toEqual(['Dorsal ancho', 'Tríceps'])
  })

  it('las zonas 2D toman el nivel más alto de sus músculos', () => {
    const z = nivelesPorZona(new Map<Musculo, number>([['romboides', 2], ['trapecio_medio', 4], ['biceps', 1]]))
    expect(z.get('espalda_media')).toBe(4)
    expect(z.get('biceps')).toBe(1)
  })
})

describe('músculos profundos', () => {
  it('son los mismos, y en el mismo orden, que las piezas de dentro del modelo', () => {
    expect([...PROFUNDOS]).toEqual(modelo.profundos)
    for (const m of ['gluteo_menor', 'psoas_iliaco'] as const) expect(esProfundo(m)).toBe(true)
    expect(esProfundo('gluteo_medio')).toBe(false)
    PROFUNDOS.forEach((m, i) => expect(profundoDeMarca(i + 1)).toBe(m))
    expect(profundoDeMarca(0)).toBeNull()
    for (const m of PROFUNDOS) expect(modelo.caras_por_region[m], m).toBeGreaterThan(500)
  })

  it('lo que la ficha dice que tienen encima es piel que el modelo vuelve translúcida', () => {
    for (const m of PROFUNDOS) {
      const encima = ENCIMA_DE[m] ?? []
      expect(encima.length, m).toBeGreaterThan(0)
      for (const s of encima) {
        expect(modelo.encima[m], `${s} sobre ${m}`).toContain(s)
        expect(debajoDe(s)).toContain(m)
      }
    }
    expect(debajoDe('gluteo_medio')).toEqual(['gluteo_menor'])
    expect(debajoDe('biceps')).toEqual([])
  })

  it('la piel de encima es opaca si no se trabajan ni se eligen, y más translúcida con más nivel', () => {
    expect(opacidadSobreProfundo(0)).toBe(1)
    for (let n = 1; n <= 5; n++) expect(opacidadSobreProfundo(n)).toBeLessThan(opacidadSobreProfundo(n - 1))
    expect(opacidadSobreProfundo(5)).toBeGreaterThanOrEqual(0.45)
    expect(opacidadSobreProfundo(0, true)).toBeLessThan(opacidadSobreProfundo(5))
  })
})

describe('reasignación de músculos de los ejercicios', () => {
  const de = (nombre: string) => biblioteca.find((e) => e.nombre === nombre)!

  it('todos los ejercicios de la biblioteca están en la división completa, sin repetir principales en secundarios', () => {
    for (const e of biblioteca) {
      expect(e.principales.length, e.nombre).toBeGreaterThan(0)
      expect(esListaNueva([...e.principales, ...e.secundarios]) || [...e.principales, ...e.secundarios].every((m) => (MUSCULOS as readonly string[]).includes(m)), e.nombre).toBe(true)
      for (const m of e.secundarios) expect(e.principales, `${e.nombre}: ${m}`).not.toContain(m)
    }
  })

  it('el remo con barra: dorsal ancho, romboides y trapecio medio; redondo mayor, deltoides posterior, bíceps y braquial', () => {
    const e = de('Remo con barra')
    expect(e.principales).toEqual(['dorsal_ancho', 'romboides', 'trapecio_medio'])
    expect(e.secundarios).toEqual(expect.arrayContaining(['redondo_mayor', 'deltoides_posterior', 'biceps', 'braquial']))
  })

  it('afina por el tipo de movimiento y por el nombre', () => {
    expect(de('Press inclinado con barra').principales).toEqual(['pectoral_clavicular'])
    expect(de('Press declinado con barra').principales).toEqual(['pectoral_esternal', 'pectoral_costal'])
    expect(de('Curl martillo').principales).toEqual(['braquial', 'braquiorradial'])
    expect(de('Curl de muñeca prono con barra en banco').principales).toEqual(['extensores_antebrazo'])
    expect(de('Peso muerto sumo').principales).toContain('aductores')
    expect(de('Abducción de cadera en polea').principales).toEqual(['gluteo_medio', 'gluteo_menor'])
    expect(de('Rotación interna en polea').principales).toEqual(['subescapular'])
    expect(de('Elevaciones laterales con mancuernas').secundarios).toContain('supraespinoso')
    expect(de('Cuello boca abajo con disco').principales).toContain('esplenio')
  })

  it('convierte los ejercicios de antes y no toca los que ya están al día', () => {
    const antes = { nombre: 'Jalón al pecho en máquina', material: 'maquina' as Material, musculosPrincipales: ['dorsales'], musculosSecundarios: ['biceps', 'espalda_media'] }
    const r = musculosFinos(antes)
    expect(r.principales).toEqual(['dorsal_ancho', 'redondo_mayor'])
    expect(r.secundarios).toEqual(expect.arrayContaining(['biceps', 'braquial', 'romboides']))
    expect(musculosFinos({ ...antes, musculosPrincipales: r.principales, musculosSecundarios: r.secundarios })).toEqual(r)
    // Un músculo que no cambia de nombre (bíceps) solo no basta para saber si la lista es nueva: se convierte igual y no cambia.
    expect(musculosFinos({ nombre: 'Curl raro', material: 'otro', musculosPrincipales: ['biceps'], musculosSecundarios: [] }).principales).toEqual(['biceps'])
    expect(musculosFinos({ nombre: 'Sin músculos', material: 'otro', musculosPrincipales: [], musculosSecundarios: [] })).toEqual({ principales: [], secundarios: [] })
  })
})
