import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { anguloCercano, aspectoDeNivel, BRILLO_NIVEL, INTENSIDAD_NIVEL, colorCss, factorOclusion, idDeCanal, limitarAltura, limitarZoom, MEZCLA_NIVEL, musculoDeRegion, NUM_REGIONES, porRegion, ZOOM_MAX } from './cuerpo3d'
import { REGIONES_MODELO } from './musculos'

describe('cuerpo 3D', () => {
  it('las regiones del modelo son las de REGIONES_MODELO, cada una de su grupo', () => {
    const info = JSON.parse(readFileSync(new URL('../../public/modelos/cuerpo.json', import.meta.url), 'utf-8')) as { regiones: string[]; triangulos: number }
    expect(info.regiones).toEqual([...REGIONES_MODELO])
    expect(NUM_REGIONES).toBe(48)
    expect(musculoDeRegion(REGIONES_MODELO.indexOf('pectoral_costal') + 1)).toBe('pecho')
    expect(musculoDeRegion(0)).toBeNull()
    const colores = porRegion((m) => m ?? 'nada')
    expect(colores).toHaveLength(49)
    expect(colores[0]).toBe('nada')
    expect(colores[REGIONES_MODELO.indexOf('gemelo_lateral') + 1]).toBe('gemelos')
    // Ligero para el móvil.
    expect(info.triangulos).toBeLessThanOrEqual(150_000)
  })

  it('cada región tiene superficie en el modelo', () => {
    const info = JSON.parse(readFileSync(new URL('../../public/modelos/cuerpo.json', import.meta.url), 'utf-8')) as { caras_por_region: Record<string, number> }
    for (const r of REGIONES_MODELO) expect(info.caras_por_region[r] ?? 0, r).toBeGreaterThan(150)
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
