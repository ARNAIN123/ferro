import { describe, expect, it } from 'vitest'
import { esCompuestoGrande, filtrarEjercicios, FILTROS_INICIALES, valoresPorDefecto } from './biblioteca'
import type { Ejercicio } from './tipos'

const e = (id: string, nombre: string, extra: Partial<Ejercicio> = {}): Ejercicio => ({
  id,
  nombre,
  alias: '',
  musculosPrincipales: ['pecho'],
  musculosSecundarios: [],
  material: 'barra',
  categoria: 'fuerza',
  nivel: 'principiante',
  mecanica: 'compuesto',
  instrucciones: [],
  imagenes: 2,
  notasFijas: '',
  personalizado: false,
  archivado: false,
  ...extra,
})

const lista = [
  e('banca', 'Press de banca con barra', { alias: 'Barbell Bench Press' }),
  e('jalon', 'Jalón al pecho agarre ancho', { alias: 'Wide-Grip Lat Pulldown, polea alta', musculosPrincipales: ['dorsales'], musculosSecundarios: ['biceps'], material: 'polea' }),
  e('curl', 'Curl con barra', { musculosPrincipales: ['biceps'], mecanica: 'aislamiento' }),
  e('estir', 'Estiramiento de pecho', { categoria: 'estiramientos', material: 'ninguno' }),
  e('viejo', 'Mi press archivado', { personalizado: true, archivado: true }),
]

describe('filtros de la biblioteca', () => {
  it('por defecto muestra solo fuerza y no archivados', () => {
    expect(filtrarEjercicios(lista, FILTROS_INICIALES).map((x) => x.id)).toEqual(['curl', 'jalon', 'banca'])
  })

  it('busca en español y en inglés sin tildes', () => {
    expect(filtrarEjercicios(lista, { ...FILTROS_INICIALES, texto: 'jalon' }).map((x) => x.id)).toEqual(['jalon'])
    expect(filtrarEjercicios(lista, { ...FILTROS_INICIALES, texto: 'bench press' }).map((x) => x.id)).toEqual(['banca'])
  })

  it('al buscar por texto ignora la categoría', () => {
    expect(filtrarEjercicios(lista, { ...FILTROS_INICIALES, texto: 'estiramiento' }).map((x) => x.id)).toEqual(['estir'])
  })

  it('por músculo incluye secundarios pero pone primero los principales', () => {
    const r = filtrarEjercicios(lista, { ...FILTROS_INICIALES, musculo: 'biceps' }).map((x) => x.id)
    expect(r).toEqual(['curl', 'jalon'])
  })

  it('por material y por categoría', () => {
    expect(filtrarEjercicios(lista, { ...FILTROS_INICIALES, material: 'polea' }).map((x) => x.id)).toEqual(['jalon'])
    expect(filtrarEjercicios(lista, { ...FILTROS_INICIALES, categoria: null }).length).toBe(4)
  })

  it('puede mostrar los archivados', () => {
    expect(filtrarEjercicios(lista, { ...FILTROS_INICIALES, archivados: true }).map((x) => x.id)).toEqual(['viejo'])
  })
})

describe('valores por defecto en una rutina', () => {
  it('3 × 8–12 con 90 s; 150 s en compuestos grandes', () => {
    expect(valoresPorDefecto(lista[0]!)).toEqual({ series: 3, repsMin: 8, repsMax: 12, descansoSeg: 150 })
    expect(valoresPorDefecto(lista[2]!)).toEqual({ series: 3, repsMin: 8, repsMax: 12, descansoSeg: 90 })
  })

  it('un compuesto en polea o de un músculo pequeño no es "grande"', () => {
    expect(esCompuestoGrande(lista[1]!)).toBe(false)
    expect(esCompuestoGrande({ mecanica: 'compuesto', musculosPrincipales: ['biceps'], material: 'barra' })).toBe(false)
    expect(esCompuestoGrande({ mecanica: 'compuesto', musculosPrincipales: ['hombros'], material: 'barra' })).toBe(true)
    expect(esCompuestoGrande({ mecanica: 'compuesto', musculosPrincipales: ['cuadriceps'], material: 'maquina' })).toBe(true)
  })
})
