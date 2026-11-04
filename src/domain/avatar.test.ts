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

  it('cada región pertenece como mucho a un músculo, y los tendones a ninguno', () => {
    const vistas = new Map<RegionAvatar, string>()
    for (const m of MUSCULOS)
      for (const r of REGIONES_AVATAR[m]) {
        expect(vistas.get(r), r).toBeUndefined()
        vistas.set(r, m)
      }
    for (const r of NO_MUSCULO) expect(musculoDeRegionAvatar(r)).toBeNull()
  })

  it('los grupos que pide la ronda 2 están separados en el dibujo', () => {
    for (const r of [
      'pectoral_superior',
      'pectoral_inferior',
      'deltoides_anterior',
      'deltoides_lateral',
      'deltoides_posterior',
      'braquial',
      'trapecio_medio',
      'gluteo_medio',
      'soleo',
    ] as RegionAvatar[])
      expect(dibujadas.has(r), r).toBe(true)
    expect(musculoDeRegionAvatar('soleo')).toBe('gemelos')
    expect(musculoDeRegionAvatar('deltoides_posterior')).toBe('hombros')
  })

  it('todas las regiones de un músculo comparten su nivel', () => {
    const r = nivelesPorRegionAvatar(new Map([['pecho', 4], ['hombros', 2]]))
    expect(r.get('pectoral_superior')).toBe(4)
    expect(r.get('pectoral_inferior')).toBe(4)
    expect(r.get('deltoides_lateral')).toBe(2)
    expect(r.get('biceps')).toBeUndefined()
  })
})

describe('niveles del avatar de la semana', () => {
  it('1–3, 4–6, 7–10, 11–15 y 16 o más series', () => {
    const nivel = (s: number) => nivelIntensidad(s, ESCALA_SEMANA_AVATAR)
    expect([0, 0.5, 3, 3.5, 4, 6.5, 7, 10.5, 11, 15.5, 16, 30].map(nivel)).toEqual([0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
    expect(rotulosEscala(ESCALA_SEMANA_AVATAR)).toEqual(['1–3', '4–6', '7–10', '11–15', '16+'])
  })
})
