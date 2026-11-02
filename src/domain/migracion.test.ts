import { describe, expect, it } from 'vitest'
import catalogo from '../catalogo/ejercicios.json'
import { MAPA_IDS_V1, migrarDatosV1, migrarEjercicioV1, sincronizarCatalogo, type EjercicioCatalogo, type EjercicioV1 } from './migracion'
import { MUSCULOS } from './tipos'

const viejo = (id: string, extra: Partial<EjercicioV1> = {}): EjercicioV1 => ({
  id,
  nombre: id,
  musculoPrincipal: 'pecho',
  musculosSecundarios: ['triceps'],
  material: 'barra',
  saltoPeso: 2.5,
  notasFijas: '',
  personalizado: false,
  archivado: false,
  ...extra,
})

describe('migración v1 → v2 de la biblioteca', () => {
  const ids = new Set((catalogo.ejercicios as EjercicioCatalogo[]).map((e) => e.id))

  it('cubre los 88 ejercicios de la biblioteca antigua y todos existen en el catálogo nuevo', () => {
    expect(Object.keys(MAPA_IDS_V1)).toHaveLength(88)
    const faltan = Object.values(MAPA_IDS_V1).filter((id) => !ids.has(id))
    expect(faltan).toEqual([])
  })

  it('convierte un ejercicio: nuevo id, músculos en lista, sin salto de peso y con mis notas', () => {
    const e = migrarEjercicioV1(viejo('press-banca', { notasFijas: 'Banco en 3', reinicioProgresion: 5 }))
    expect(e.id).toBe('Barbell_Bench_Press_-_Medium_Grip')
    expect(e.musculosPrincipales).toEqual(['pecho'])
    expect(e.notasFijas).toBe('Banco en 3')
    expect(e.reinicioProgresion).toBe(5)
    expect('saltoPeso' in e).toBe(false)
  })

  it('"espalda" pasa a "dorsales" y los personalizados conservan su id', () => {
    const e = migrarEjercicioV1(viejo('mi-remo', { personalizado: true, musculoPrincipal: 'espalda', musculosSecundarios: ['biceps', 'espalda'] }))
    expect(e.id).toBe('mi-remo')
    expect(e.musculosPrincipales).toEqual(['dorsales'])
    expect(e.musculosSecundarios).toEqual(['biceps'])
    expect([...e.musculosPrincipales, ...e.musculosSecundarios].every((m) => (MUSCULOS as readonly string[]).includes(m))).toBe(true)
  })

  it('actualiza todas las referencias sin perder ningún registro', () => {
    const datos = {
      ejercicios: [viejo('press-banca', { notasFijas: 'nota' }), viejo('sentadilla'), viejo('propio', { personalizado: true })],
      rutinaEjercicios: [{ id: 're1', ejercicioId: 'press-banca' }, { id: 're2', ejercicioId: 'propio' }],
      sesionEjercicios: [{ id: 'se1', ejercicioId: 'sentadilla', sustituyeA: 'press-banca' }],
      series: [
        { id: 's1', ejercicioId: 'press-banca', peso: 60 },
        { id: 's2', ejercicioId: 'sentadilla', peso: 100 },
        { id: 's3', ejercicioId: 'propio', peso: 10 },
      ],
      molestias: [{ id: 'm1', ejercicioId: 'sentadilla', nota: 'rodilla' }],
    }
    const r = migrarDatosV1(datos)
    expect(r.ejercicios).toHaveLength(3)
    expect(r.rutinaEjercicios.map((x) => x.ejercicioId)).toEqual(['Barbell_Bench_Press_-_Medium_Grip', 'propio'])
    expect(r.sesionEjercicios[0]).toMatchObject({ ejercicioId: 'Barbell_Squat', sustituyeA: 'Barbell_Bench_Press_-_Medium_Grip' })
    expect(r.series.map((x) => x.ejercicioId)).toEqual(['Barbell_Bench_Press_-_Medium_Grip', 'Barbell_Squat', 'propio'])
    expect(r.series.map((x) => x.peso)).toEqual([60, 100, 10])
    expect(r.molestias[0]).toMatchObject({ ejercicioId: 'Barbell_Squat', nota: 'rodilla' })
    expect(r.ejercicios.find((e) => e.id === 'Barbell_Bench_Press_-_Medium_Grip')?.notasFijas).toBe('nota')
  })

  it('si dos antiguos van al mismo nuevo, junta sus notas', () => {
    const r = migrarDatosV1({
      ejercicios: [viejo('a', { notasFijas: 'uno' }), viejo('b', { notasFijas: 'dos' })].map((e, i) => ({ ...e, id: i ? 'curl-barra' : 'curl-barra' })),
      rutinaEjercicios: [],
      sesionEjercicios: [],
      series: [],
      molestias: [],
    })
    expect(r.ejercicios).toHaveLength(1)
    expect(r.ejercicios[0]?.notasFijas).toBe('uno\ndos')
  })
})

describe('sincronización del catálogo', () => {
  const base: EjercicioCatalogo = {
    id: 'X',
    nombre: 'Press',
    alias: 'Press',
    principales: ['pecho'],
    secundarios: [],
    material: 'barra',
    categoria: 'fuerza',
    nivel: 'principiante',
    mecanica: 'compuesto',
    instrucciones: ['Paso'],
    imagenes: 2,
  }

  it('actualiza los datos de la biblioteca y conserva mis notas', () => {
    const [migrado] = migrarDatosV1({ ejercicios: [viejo('X', { notasFijas: 'asiento 4', archivado: true })], rutinaEjercicios: [], sesionEjercicios: [], series: [], molestias: [] }).ejercicios
    const [r] = sincronizarCatalogo([base], [migrado!])
    expect(r).toMatchObject({ id: 'X', nombre: 'Press', imagenes: 2, notasFijas: 'asiento 4', archivado: true, personalizado: false })
  })

  it('no toca ejercicios personalizados', () => {
    const propio = { ...migrarEjercicioV1(viejo('X', { personalizado: true })) }
    expect(sincronizarCatalogo([base], [propio])).toEqual([])
  })

  it('el catálogo generado tiene músculos válidos y nombre en español', () => {
    const lista = catalogo.ejercicios as EjercicioCatalogo[]
    expect(lista.length).toBeGreaterThan(850)
    for (const e of lista) {
      expect(e.principales.length).toBeGreaterThan(0)
      for (const m of [...e.principales, ...e.secundarios]) expect(MUSCULOS).toContain(m)
      expect(e.nombre.trim().length).toBeGreaterThan(2)
    }
  })
})
