import { describe, expect, it } from 'vitest'
import { rutaDeEnlace } from './EnlacesNativos'

describe('enlaces de los accesos directos', () => {
  it('convierte ferro://app/… en una ruta de la app', () => {
    expect(rutaDeEnlace('ferro://app/?peso=1')).toBe('/?peso=1')
    expect(rutaDeEnlace('ferro://app/empezar')).toBe('/empezar')
    expect(rutaDeEnlace('ferro://app')).toBe('/')
  })
  it('ignora enlaces que no son de Ferro', () => {
    expect(rutaDeEnlace('https://ejemplo.com/peso')).toBeNull()
    expect(rutaDeEnlace('ferro://otra/cosa')).toBeNull()
  })
})
