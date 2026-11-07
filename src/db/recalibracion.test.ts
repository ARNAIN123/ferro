import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PerfilNutricion, RegistroComida } from '../domain/tiposNutricion'
import { db } from './db'
import { recalibrarSiToca } from './recalibracion'

// Lunes 16 de noviembre de 2026, a mediodía.
const LUNES = new Date(2026, 10, 16, 12).getTime()

const perfil = (inicio: string, objetivoKcal = 2200): PerfilNutricion => ({
  id: 'perfil',
  sexo: 'hombre',
  objetivo: 'perder',
  ritmo: 'moderado',
  proteinaGkg: 2,
  inicio,
  basal: 1800,
  gastoInicial: 2700,
  objetivoKcal,
  ajustes: [],
  retoActivo: true,
  retos: [],
})

const dia = (n: number) => `2026-11-${String(n).padStart(2, '0')}`
const comida = (fecha: string, kcal: number): RegistroComida => ({
  id: `c-${fecha}`,
  fecha,
  comida: 'comida',
  alimentoId: 'g-x',
  nombre: 'x',
  gramos: 100,
  racion: null,
  valores: { kcal, proteina: 150, carbohidratos: 0, grasa: 0 },
  hora: new Date(`${fecha}T14:00`).getTime(),
})

beforeEach(async () => {
  await Promise.all([db.nutricion.clear(), db.comidas.clear(), db.pesosCorporales.clear(), db.ajustes.clear()])
  await db.ajustes.put({ id: 'ajustes', edad: 30, alturaCm: 180 } as never)
})

describe('recalibración de los lunes', () => {
  it('las dos primeras semanas mantiene la estimación y se aplica una sola vez por semana', async () => {
    await db.nutricion.put(perfil(dia(9)))
    await db.pesosCorporales.add({ id: 'p', fecha: dia(15), kg: 80 })
    const a = await recalibrarSiToca(LUNES)
    expect(a).toMatchObject({ lunes: dia(16), motivo: 'estimacion', objetivoNuevo: 2200 })
    expect(await recalibrarSiToca(LUNES + 3600_000)).toBeNull()
    expect((await db.nutricion.get('perfil'))!.ajustes).toHaveLength(1)
  })

  it('con dos semanas de datos ajusta como mucho 150 kcal y nunca por debajo del basal', async () => {
    await db.nutricion.put(perfil(dia(1), 1900))
    // Comí 1.900 kcal de media y el peso no se movió: el gasto real es ~1.900, así que para perder
    // habría que bajar mucho; el ajuste se limita a −150 y no baja del basal.
    for (let n = 2; n <= 15; n++) {
      await db.comidas.add(comida(dia(n), 1900))
      await db.pesosCorporales.add({ id: `p${n}`, fecha: dia(n), kg: 80 })
    }
    const a = await recalibrarSiToca(LUNES)
    const basal = (await db.nutricion.get('perfil'))!.basal
    expect(a!.gastoReal).toBe(1900)
    expect(a!.objetivoNuevo).toBeGreaterThanOrEqual(Math.ceil(basal / 10) * 10)
    expect(a!.objetivoNuevo).toBeGreaterThanOrEqual(1900 - 150)
    expect((await db.nutricion.get('perfil'))!.objetivoKcal).toBe(a!.objetivoNuevo)
  })

  it('sin registros suficientes no cambia el objetivo', async () => {
    await db.nutricion.put(perfil(dia(1)))
    await db.pesosCorporales.add({ id: 'p', fecha: dia(15), kg: 80 })
    for (let n = 10; n <= 15; n++) await db.comidas.add(comida(dia(n), 2000))
    const a = await recalibrarSiToca(LUNES)
    expect(a).toMatchObject({ motivo: 'pocos_registros', objetivoNuevo: 2200 })
  })
})
