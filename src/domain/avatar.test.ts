import { describe, expect, it } from 'vitest'
import { ESPALDA, FRENTE } from '../components/avatar/trazados'
import { ESCALA_SEMANA_AVATAR, musculoDeRegionAvatar, NO_MUSCULO, nivelesPorRegionAvatar, REGIONES_AVATAR, type RegionAvatar } from './avatar'
import { nivelIntensidad, rotulosEscala } from './mapaMuscular'
import { MUSCULOS } from './tipos'

const dibujadas = new Set<RegionAvatar>([...FRENTE.partes, ...ESPALDA.partes].map((p) => p.region))

describe('correspondencia músculo ↔ avatar', () => {
  it('cada músculo de la base de datos se pinta en regiones que existen en el dibujo', () => {
    for (const m of MUSCULOS) {
      expect(REGIONES_AVATAR[m].length, m).toBeGreaterThan(0)
      for (const r of REGIONES_AVATAR[m]) expect(dibujadas.has(r), `${m} → ${r}`).toBe(true)
    }
  })

  it('los tendones no son de ningún músculo y cada región del dibujo es de un solo grupo', () => {
    for (const m of MUSCULOS) for (const r of REGIONES_AVATAR[m]) expect(NO_MUSCULO.has(r), r).toBe(false)
    for (const r of NO_MUSCULO) expect(musculoDeRegionAvatar(r)).toBeNull()
    const todas = MUSCULOS.flatMap((m) => REGIONES_AVATAR[m])
    expect(new Set(todas).size).toBe(todas.length)
    expect(musculoDeRegionAvatar('soleo')).toBe('gemelos')
    expect(musculoDeRegionAvatar('deltoides_posterior')).toBe('hombros')
    expect(musculoDeRegionAvatar('antebrazo_extensores')).toBe('antebrazos')
    expect(musculoDeRegionAvatar('trapecio_medio')).toBe('espalda_alta')
  })

  it('cada grupo pinta todas sus regiones con su nivel', () => {
    const r = nivelesPorRegionAvatar(new Map([['cuadriceps', 4], ['antebrazos', 2], ['triceps', 5]]))
    expect(r.get('recto_femoral')).toBe(4)
    expect(r.get('vasto_medial')).toBe(4)
    expect(r.get('antebrazo_flexores')).toBe(2)
    expect(r.get('triceps')).toBe(5)
    expect(r.get('biceps')).toBeUndefined()
  })

  it('todos los músculos tienen su región en el mapa 2D', () => {
    for (const m of MUSCULOS) expect(REGIONES_AVATAR[m].length, m).toBeGreaterThan(0)
  })
})

describe('niveles del avatar de la semana', () => {
  it('1–3, 4–6, 7–10, 11–15 y 16 o más series', () => {
    const nivel = (s: number) => nivelIntensidad(s, ESCALA_SEMANA_AVATAR)
    expect([0, 0.5, 3, 3.5, 4, 6.5, 7, 10.5, 11, 15.5, 16, 30].map(nivel)).toEqual([0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
    expect(rotulosEscala(ESCALA_SEMANA_AVATAR)).toEqual(['1–3', '4–6', '7–10', '11–15', '16+'])
  })
})
