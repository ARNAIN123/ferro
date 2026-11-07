import { describe, expect, it } from 'vitest'
import { instruccionesInterpretacion, limpiarInterpretacion } from './interpretacion'

const catalogo = [
  { id: 'g-pechuga-de-pollo', nombre: 'Pechuga de pollo', estado: 'crudo' as const },
  { id: 'g-arroz-blanco', nombre: 'Arroz blanco', estado: 'crudo' as const },
]

describe('interpretación de comidas con IA', () => {
  it('acepta los alimentos válidos y usa el nombre y estado del catálogo cuando el id existe', () => {
    const r = limpiarInterpretacion(
      {
        items: [
          { nombre: 'pollo', gramos: 200, estado: 'cocinado', alimentoId: 'g-pechuga-de-pollo', kcal: 120, proteina: 22.5, carbohidratos: 0, grasa: 2.6 },
          { nombre: 'Yogur natural', gramos: 125.4, estado: 'no_aplica', alimentoId: '', kcal: 61, proteina: 3.47, carbohidratos: 4.7, grasa: 3.25 },
        ],
      },
      catalogo,
    )
    expect(r).toEqual([
      { nombre: 'Pechuga de pollo', gramos: 200, estado: 'crudo', alimentoId: 'g-pechuga-de-pollo', por100: { kcal: 120, proteina: 22.5, carbohidratos: 0, grasa: 2.6 } },
      { nombre: 'Yogur natural', gramos: 125, estado: null, alimentoId: null, por100: { kcal: 61, proteina: 3.5, carbohidratos: 4.7, grasa: 3.3 } },
    ])
  })

  it('descarta lo imposible y los ids que no existen', () => {
    const r = limpiarInterpretacion(
      {
        items: [
          { nombre: 'nada', gramos: 0, estado: 'crudo', alimentoId: '', kcal: 100, proteina: 1, carbohidratos: 1, grasa: 1 },
          { nombre: 'raro', gramos: 100, estado: 'crudo', alimentoId: '', kcal: 1200, proteina: 1, carbohidratos: 1, grasa: 1 },
          { nombre: 'macros imposibles', gramos: 100, estado: 'crudo', alimentoId: '', kcal: 400, proteina: 60, carbohidratos: 60, grasa: 0 },
          { nombre: 'negativo', gramos: 100, estado: 'crudo', alimentoId: '', kcal: 100, proteina: -1, carbohidratos: 1, grasa: 1 },
          { nombre: 'Pan', gramos: 60, estado: 'no_aplica', alimentoId: 'g-inventado', kcal: 265, proteina: 9, carbohidratos: 49, grasa: 3.2 },
        ],
      },
      catalogo,
    )
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ nombre: 'Pan', alimentoId: null })
    expect(limpiarInterpretacion(null, catalogo)).toEqual([])
    expect(limpiarInterpretacion({ items: 'x' }, catalogo)).toEqual([])
  })

  it('las instrucciones incluyen el catálogo para reutilizar mis alimentos', () => {
    const t = instruccionesInterpretacion(catalogo)
    expect(t).toContain('g-pechuga-de-pollo\tPechuga de pollo (crudo)')
  })
})
