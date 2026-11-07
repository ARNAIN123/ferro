import { describe, expect, it } from 'vitest'
import { buscar, comidaPorHora, esDiaDeEntreno, habitualesDe, recientesPara, resumenSemana, retoDeLaSemana, RETOS, sumar, valoresDe } from './registroComidas'
import type { RegistroComida } from './tiposNutricion'

const t = (d: number, h: number) => new Date(2026, 10, d, h).getTime()
const reg = (id: string, alimentoId: string, comida: RegistroComida['comida'], hora: number, gramos = 100, kcal = 100, proteina = 10): RegistroComida => ({
  id,
  fecha: `2026-11-${String(new Date(hora).getDate()).padStart(2, '0')}`,
  comida,
  alimentoId,
  nombre: alimentoId,
  gramos,
  racion: null,
  valores: { kcal, proteina, carbohidratos: 0, grasa: 0 },
  hora,
})

describe('registro de comidas', () => {
  it('valores de una cantidad a partir de los de 100 g', () => {
    expect(valoresDe({ kcal: 371, proteina: 13, carbohidratos: 74.7, grasa: 1.5 }, 80)).toEqual({ kcal: 297, proteina: 10.4, carbohidratos: 59.8, grasa: 1.2 })
  })

  it('suma los registros del día', () => {
    expect(sumar([reg('a', 'x', 'comida', t(5, 14), 100, 300, 20), reg('b', 'y', 'cena', t(5, 21), 100, 150.4, 12.25)])).toEqual({ kcal: 450, proteina: 32.3, carbohidratos: 0, grasa: 0 })
  })

  it('primero lo que suelo tomar en esa comida y a esa hora, con la última cantidad', () => {
    const registros = [
      reg('1', 'leche', 'desayuno', t(1, 8), 250),
      reg('2', 'leche', 'desayuno', t(2, 8), 200),
      reg('3', 'avena', 'desayuno', t(2, 8)),
      reg('4', 'pollo', 'comida', t(2, 14)),
      reg('5', 'pollo', 'comida', t(3, 14)),
      reg('6', 'pollo', 'cena', t(3, 21)),
    ]
    const desayuno = recientesPara(registros, 'desayuno', t(5, 8))
    expect(desayuno[0]).toMatchObject({ alimentoId: 'leche', gramos: 200 })
    expect(desayuno.map((r) => r.alimentoId)).toContain('pollo')
    const comida = recientesPara(registros, 'comida', t(5, 14))
    expect(comida[0]!.alimentoId).toBe('pollo')
  })

  it('busca por todas las palabras, sin acentos, y primero lo que empieza igual', () => {
    const lista = [{ nombre: 'Pechuga de pollo' }, { nombre: 'Pollo asado' }, { nombre: 'Plátano' }]
    expect(buscar(lista, 'pollo').map((x) => x.nombre)).toEqual(['Pollo asado', 'Pechuga de pollo'])
    expect(buscar(lista, 'platano')).toEqual([{ nombre: 'Plátano' }])
    expect(buscar(lista, 'pechuga pollo')).toHaveLength(1)
    expect(buscar(lista, '  ')).toEqual([])
  })

  it('elige la comida por la hora', () => {
    expect(comidaPorHora(t(5, 8), false)).toBe('desayuno')
    expect(comidaPorHora(t(5, 14), false)).toBe('comida')
    expect(comidaPorHora(t(5, 17), false)).toBe('merienda')
    expect(comidaPorHora(t(5, 17), true)).toBe('antes')
    expect(comidaPorHora(t(5, 22), false)).toBe('cena')
  })

  it('resumen de la semana con los días registrados', () => {
    const r = resumenSemana([reg('a', 'x', 'comida', t(2, 14), 100, 2000, 150), reg('b', 'x', 'comida', t(3, 14), 100, 1800, 130)])
    expect(r).toEqual({ diasRegistrados: 2, mediaKcal: 1900, mediaProteina: 140 })
    expect(resumenSemana([])).toEqual({ diasRegistrados: 0, mediaKcal: null, mediaProteina: null })
  })
})

describe('reto de fruta y verdura', () => {
  it('propone el siguiente que no he probado y respeta lo que no me gusta', () => {
    expect(retoDeLaSemana('2026-11-02', [])).toMatchObject({ alimentoId: RETOS[0]!.alimentoId, estado: 'propuesto' })
    const historial = [
      { alimentoId: RETOS[0]!.alimentoId, semana: '2026-10-26', estado: 'no_gusta' as const },
      { alimentoId: RETOS[1]!.alimentoId, semana: '2026-10-19', estado: 'gusta' as const },
    ]
    expect(retoDeLaSemana('2026-11-02', historial)!.alimentoId).toBe(RETOS[2]!.alimentoId)
  })

  it('la semana con reto guarda su estado', () => {
    expect(retoDeLaSemana('2026-11-02', [{ alimentoId: RETOS[3]!.alimentoId, semana: '2026-11-02', estado: 'probado' }])).toMatchObject({ estado: 'probado' })
  })

  it('cuando ya los he visto todos no hay reto', () => {
    expect(retoDeLaSemana('2027-01-04', RETOS.map((r, i) => ({ alimentoId: r.alimentoId, semana: `s${i}`, estado: 'gusta' as const })))).toBeNull()
  })

  it('habituales: valores por 100 g del último registro, usos y sin los que no me gustan', () => {
    const h = habitualesDe(
      [reg('1', 'pollo', 'comida', t(1, 14), 200, 330, 62), reg('2', 'pollo', 'cena', t(2, 21), 150, 247, 46.5), reg('3', 'kiwi', 'merienda', t(2, 17), 100, 61, 1.1)],
      (id) => (id === 'pollo' ? [{ nombre: '1 filete', gramos: 150 }] : []),
      new Set(['kiwi']),
    )
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ id: 'pollo', usos: 2, raciones: [{ nombre: '1 filete', gramos: 150 }] })
    expect(h[0]!.por100.proteina).toBeCloseTo(31, 5)
  })

  it('día de entreno: manda lo marcado a mano; si no, haber entrenado ese día', () => {
    const entrenos = new Set(['2026-11-05'])
    expect(esDiaDeEntreno('2026-11-05', undefined, entrenos)).toBe(true)
    expect(esDiaDeEntreno('2026-11-06', undefined, entrenos)).toBe(false)
    expect(esDiaDeEntreno('2026-11-06', { '2026-11-06': true }, entrenos)).toBe(true)
    expect(esDiaDeEntreno('2026-11-05', { '2026-11-05': false }, entrenos)).toBe(false)
  })
})
