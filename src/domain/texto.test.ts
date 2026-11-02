import { describe, expect, it } from 'vitest'
import { coincide, normalizar } from './texto'

describe('búsqueda de texto', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(normalizar('Jalón al PECHO')).toBe('jalon al pecho')
    expect(coincide('Extensión de cuádriceps', 'cuadri')).toBe(true)
  })
  it('exige todas las palabras en cualquier orden', () => {
    expect(coincide('Press inclinado con mancuernas', 'mancuernas press')).toBe(true)
    expect(coincide('Press inclinado con mancuernas', 'press barra')).toBe(false)
  })
})
