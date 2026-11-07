import { describe, expect, it } from 'vitest'
import { aAlimento } from './openFoodFacts'

describe('Open Food Facts', () => {
  it('convierte un producto con valores por 100 g y su ración', () => {
    const a = aAlimento({
      code: '8410000123456',
      product_name: 'Yogur griego natural',
      brands: 'Marca, Otra',
      serving_quantity: '125',
      serving_size: '125 g',
      nutriments: { 'energy-kcal_100g': 97.4, proteins_100g: 9, carbohydrates_100g: 4, fat_100g: 5, fiber_100g: '0,5' },
    })
    expect(a).toMatchObject({
      id: 'off-8410000123456',
      nombre: 'Yogur griego natural',
      marca: 'Marca',
      codigo: '8410000123456',
      origen: 'off',
      por100: { kcal: 97, proteina: 9, carbohidratos: 4, grasa: 5, fibra: 0.5 },
      raciones: [{ nombre: '1 ración (125 g)', gramos: 125 }],
    })
  })

  it('usa la energía en kJ si no viene en kcal, y descarta productos sin valores', () => {
    expect(aAlimento({ code: '1', product_name: 'X', nutriments: { energy_100g: 418.4, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } })!.por100.kcal).toBe(100)
    expect(aAlimento({ code: '1', product_name: 'X', nutriments: { proteins_100g: 1 } })).toBeNull()
    expect(aAlimento({ code: '1', nutriments: { 'energy-kcal_100g': 1, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } })).toBeNull()
  })
})
