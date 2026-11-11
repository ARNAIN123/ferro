import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { anguloCercano, aspectoDeNivel, BRILLO_NIVEL, INTENSIDAD_NIVEL, colorCss, factorOclusion, idDeCanal, limitarAltura, limitarZoom, MEZCLA_NIVEL, musculoDeRegion, regionDeMusculo, ZOOM_MAX } from './cuerpo3d'
import { MUSCULOS } from './tipos'

describe('cuerpo 3D', () => {
  it('las regiones del modelo son los músculos de Ferro en el mismo orden', () => {
    const info = JSON.parse(readFileSync(new URL('../../public/modelos/cuerpo.json', import.meta.url), 'utf-8')) as { regiones: string[]; triangulos: number }
    expect(info.regiones).toEqual([...MUSCULOS])
    for (const m of MUSCULOS) expect(musculoDeRegion(regionDeMusculo(m))).toBe(m)
    expect(musculoDeRegion(0)).toBeNull()
    // Ligero para el móvil.
    expect(info.triangulos).toBeLessThanOrEqual(150_000)
  })

  it('cada músculo tiene superficie en el modelo', () => {
    const info = JSON.parse(readFileSync(new URL('../../public/modelos/cuerpo.json', import.meta.url), 'utf-8')) as { caras_por_region: Record<string, number> }
    // Los más pequeños (redondo menor, infraespinoso) tienen menos caras, pero se pueden tocar con zoom.
    for (const m of MUSCULOS) expect(info.caras_por_region[m] ?? 0, m).toBeGreaterThan(150)
  })

  it('el modelo pesa menos de 10 MB', () => {
    expect(readFileSync(new URL('../../public/modelos/cuerpo.glb', import.meta.url)).byteLength).toBeLessThan(10_000_000)
  })

  it('lee el id de región del canal de color', () => {
    expect(idDeCanal(9 / 255)).toBe(9)
    expect(idDeCanal(23 / 255 + 0.0004)).toBe(23)
  })

  it('más nivel, más acento y brillo solo en los niveles altos', () => {
    const arcilla = [0.5, 0.5, 0.5] as const
    const acento = [1, 0.2, 0] as const
    for (let n = 1; n <= 5; n++) {
      expect(MEZCLA_NIVEL[n]).toBeGreaterThan(MEZCLA_NIVEL[n - 1]!)
      expect(BRILLO_NIVEL[n]).toBeGreaterThanOrEqual(BRILLO_NIVEL[n - 1]!)
      if (n > 1) expect(INTENSIDAD_NIVEL[n]).toBeGreaterThan(INTENSIDAD_NIVEL[n - 1]!)
      // Cada nivel se ve más naranja (más rojo respecto al azul) que el anterior.
      const a = aspectoDeNivel(n, arcilla, acento).color
      const b = aspectoDeNivel(n - 1, arcilla, acento).color
      expect(a[0] - a[2]).toBeGreaterThan(b[0] - b[2])
    }
    expect(aspectoDeNivel(0, arcilla, acento)).toEqual({ color: arcilla, brillo: 0 })
    expect(aspectoDeNivel(5, arcilla, acento).color).toEqual(acento)
    expect(aspectoDeNivel(2, arcilla, acento).brillo).toBe(0)
    expect(aspectoDeNivel(5, arcilla, acento).brillo).toBeGreaterThan(0)
    expect(aspectoDeNivel(0, arcilla, acento, true).brillo).toBeGreaterThan(0)
  })

  it('la oclusión oscurece sin llegar a negro', () => {
    expect(factorOclusion(1)).toBe(1)
    expect(factorOclusion(0)).toBeCloseTo(0.55)
    expect(factorOclusion(0.5)).toBeLessThan(1)
  })

  it('convierte colores CSS a lineal', () => {
    expect(colorCss('#ffffff')).toEqual([1, 1, 1])
    expect(colorCss('#000')).toEqual([0, 0, 0])
    expect(colorCss('rgb(255 255 255)')).toEqual([1, 1, 1])
    expect(colorCss('#ff6b1f')[0]).toBe(1)
  })

  it('gira por el camino corto y limita zoom y altura', () => {
    expect(anguloCercano(2 * Math.PI + 0.1, 0)).toBeCloseTo(2 * Math.PI)
    expect(anguloCercano(-3, Math.PI)).toBeCloseTo(-Math.PI)
    expect(limitarZoom(10)).toBe(ZOOM_MAX)
    expect(limitarZoom(0.3)).toBe(1)
    expect(limitarAltura(5, 1)).toBeCloseTo(1.71 / 2)
    expect(limitarAltura(1.5, 2)).toBeLessThanOrEqual(1.71 / 2 + 1.71 / 4)
  })
})
