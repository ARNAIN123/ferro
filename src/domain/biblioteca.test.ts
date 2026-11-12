import { describe, expect, it } from 'vitest'
import { contarUsos, ejerciciosDeMusculo, equivalenteMasParecido, esCompuestoGrande, valoresPorDefecto } from './biblioteca'
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
  notasFijas: '',
  personalizado: false,
  archivado: false,
  ...extra,
})

const lista = [
  e('banca', 'Press de banca con barra', { musculosSecundarios: ['hombros', 'triceps'] }),
  e('inclinado', 'Press inclinado con mancuernas', { musculosPrincipales: ['hombros'], musculosSecundarios: ['pecho'], material: 'mancuernas' }),
  e('aperturas', 'Aperturas con mancuernas', { mecanica: 'aislamiento', material: 'mancuernas' }),
  e('fondos', 'Fondos en paralelas', { material: 'peso_corporal', retirado: true }),
  e('viejo', 'Mi press archivado', { personalizado: true, archivado: true }),
  e('curl', 'Curl con barra', { musculosPrincipales: ['biceps'], mecanica: 'aislamiento' }),
]

describe('buscar ejercicios con el mapa', () => {
  it('separa "Principal" y "También lo trabajan", sin archivados ni retirados', () => {
    const r = ejerciciosDeMusculo(lista, 'pecho')
    expect(r.principal.map((x) => x.id)).toEqual(['aperturas', 'banca'])
    expect(r.tambien.map((x) => x.id)).toEqual(['inclinado'])
    const sup = ejerciciosDeMusculo(lista, 'hombros')
    expect(sup.principal.map((x) => x.id)).toEqual(['inclinado'])
    expect(sup.tambien.map((x) => x.id)).toEqual(['banca'])
  })

  it('primero los que más uso y después por orden alfabético', () => {
    const usos = contarUsos([{ ejercicioId: 'banca' }, { ejercicioId: 'banca' }], [{ ejercicioId: 'banca' }])
    expect(usos.get('banca')).toBe(3)
    expect(ejerciciosDeMusculo(lista, 'pecho', usos).principal.map((x) => x.id)).toEqual(['banca', 'aperturas'])
  })

  it('un músculo sin ejercicios devuelve listas vacías', () => {
    expect(ejerciciosDeMusculo(lista, 'gemelos')).toEqual({ principal: [], tambien: [] })
  })
})

describe('equivalente de un ejercicio retirado', () => {
  it('elige el de la biblioteca que más se parece en músculos, tipo y nombre', () => {
    const maquina = e('maquina', 'Press de pecho en máquina', { material: 'maquina', retirado: true, musculosSecundarios: ['triceps', 'hombros'] })
    expect(equivalenteMasParecido(maquina, lista)?.id).toBe('banca')
    const contractora = e('contractora', 'Contractora de pecho', { material: 'maquina', retirado: true, mecanica: 'aislamiento' })
    expect(equivalenteMasParecido(contractora, lista)?.id).toBe('aperturas')
  })

  it('sin ningún músculo principal en común, no propone nada', () => {
    const gemelos = e('gemelo_medial', 'Gemelos en máquina', { musculosPrincipales: ['gemelos'], retirado: true })
    expect(equivalenteMasParecido(gemelos, lista)).toBeNull()
  })
})

describe('valores por defecto en una rutina', () => {
  it('3 × 8–12 con 90 s; 150 s en compuestos grandes', () => {
    expect(valoresPorDefecto(lista[0]!)).toEqual({ series: 3, repsMin: 8, repsMax: 12, descansoSeg: 150 })
    expect(valoresPorDefecto(lista[2]!)).toEqual({ series: 3, repsMin: 8, repsMax: 12, descansoSeg: 90 })
  })

  it('un compuesto en polea o de un músculo pequeño no es "grande"', () => {
    expect(esCompuestoGrande({ mecanica: 'compuesto', musculosPrincipales: ['dorsales'], material: 'polea' })).toBe(false)
    expect(esCompuestoGrande({ mecanica: 'compuesto', musculosPrincipales: ['biceps'], material: 'barra' })).toBe(false)
    expect(esCompuestoGrande({ mecanica: 'compuesto', musculosPrincipales: ['hombros'], material: 'barra' })).toBe(true)
    expect(esCompuestoGrande({ mecanica: 'compuesto', musculosPrincipales: ['cuadriceps'], material: 'maquina' })).toBe(true)
  })
})
