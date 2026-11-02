import { describe, expect, it } from 'vitest'
import { letraCiclo, mover, rutinaQueToca, siguienteRutina, ultimaRutinaHecha, type SesionCiclo } from './ciclo'

const A = { id: 'a', posicionCiclo: 0, archivada: false }
const B = { id: 'b', posicionCiclo: 1, archivada: false }
const C = { id: 'c', posicionCiclo: 2, archivada: false }
const rutinas = [C, A, B] // desordenadas a propósito

const sesion = (rutinaId: string | null, entrada: number, estado: SesionCiclo['estado'] = 'terminada'): SesionCiclo => ({
  rutinaId,
  entrada,
  estado,
})

describe('ciclo de rutinas', () => {
  it('sin historial toca la primera del ciclo', () => {
    expect(rutinaQueToca(rutinas, [])?.id).toBe('a')
  })

  it('toca la siguiente a la última hecha', () => {
    expect(rutinaQueToca(rutinas, [sesion('a', 1)])?.id).toBe('b')
    expect(rutinaQueToca(rutinas, [sesion('a', 1), sesion('b', 2)])?.id).toBe('c')
  })

  it('vuelve al principio al acabar el ciclo', () => {
    expect(rutinaQueToca(rutinas, [sesion('c', 5)])?.id).toBe('a')
  })

  it('si elegí otra rutina, sigue a partir de la que hice', () => {
    // Tocaba B, pero hice C: ahora toca A.
    expect(rutinaQueToca(rutinas, [sesion('a', 1), sesion('c', 2)])?.id).toBe('a')
  })

  it('usa la sesión más reciente aunque el array no esté ordenado', () => {
    expect(ultimaRutinaHecha([sesion('b', 9), sesion('a', 3)], rutinas)).toBe('b')
  })

  it('ignora entrenos en curso, entrenos libres y rutinas archivadas', () => {
    const conArchivada = [...rutinas, { id: 'x', posicionCiclo: 3, archivada: true }]
    const sesiones = [sesion('a', 1), sesion('b', 2, 'en_curso'), sesion(null, 3), sesion('x', 4)]
    expect(ultimaRutinaHecha(sesiones, conArchivada)).toBe('a')
    expect(rutinaQueToca(conArchivada, sesiones)?.id).toBe('b')
  })

  it('si la última rutina ya no está en el ciclo, empieza por la primera', () => {
    expect(siguienteRutina(rutinas, 'borrada')?.id).toBe('a')
  })

  it('sin rutinas activas no toca nada', () => {
    expect(siguienteRutina([{ ...A, archivada: true }], null)).toBeNull()
  })

  it('reordena y nombra el ciclo', () => {
    expect(mover(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(mover(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect([0, 1, 25, 26].map(letraCiclo)).toEqual(['A', 'B', 'Z', 'AA'])
  })
})
