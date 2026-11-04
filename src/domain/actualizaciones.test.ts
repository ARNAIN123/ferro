import { describe, expect, it } from 'vitest'
import { actualizacionDisponible, compararVersiones, type ReleaseGithub } from './actualizaciones'

const release = (tag: string, assets: ReleaseGithub['assets'] = []): ReleaseGithub => ({
  tag_name: tag,
  html_url: `https://github.com/yo/ferro/releases/tag/${tag}`,
  body: 'Novedades',
  assets,
})

describe('versiones', () => {
  it('compara por números, no como texto, e ignora la v', () => {
    expect(compararVersiones('0.10.0', '0.9.9')).toBeGreaterThan(0)
    expect(compararVersiones('v0.3.0', '0.3.0')).toBe(0)
    expect(compararVersiones('0.3', '0.3.1')).toBeLessThan(0)
    expect(compararVersiones('1.0.0', '0.99.99')).toBeGreaterThan(0)
  })
})

describe('buscar actualizaciones', () => {
  it('ofrece el APK si la release es más nueva', () => {
    const r = release('v0.4.0', [
      { name: 'notas.txt', browser_download_url: 'https://x/notas.txt' },
      { name: 'ferro-0.4.0.apk', browser_download_url: 'https://x/ferro-0.4.0.apk' },
    ])
    expect(actualizacionDisponible('0.3.0', r)).toEqual({ version: '0.4.0', url: 'https://x/ferro-0.4.0.apk', notas: 'Novedades' })
  })

  it('nada si ya tienes esa versión o una más nueva', () => {
    expect(actualizacionDisponible('0.4.0', release('v0.4.0'))).toBeNull()
    expect(actualizacionDisponible('0.5.0', release('v0.4.0'))).toBeNull()
  })

  it('sin APK adjunto, lleva a la página de la release', () => {
    expect(actualizacionDisponible('0.3.0', release('v0.3.1'))?.url).toBe('https://github.com/yo/ferro/releases/tag/v0.3.1')
  })
})
