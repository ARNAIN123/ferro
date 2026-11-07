// Operaciones de datos de la sección de nutrición.
import type { Valores100 } from '../domain/nutricion'
import { valoresDe } from '../domain/registroComidas'
import type { Alimento, AlimentoGenerico, Comida, PerfilNutricion, Plato, RegistroComida } from '../domain/tiposNutricion'
import { nuevoId } from '../lib/id'
import { db } from './db'

/** Un alimento cualquiera: genérico (incluido en la app) o guardado en el móvil. */
export type AlimentoCualquiera = AlimentoGenerico | Alimento

let genericos: Promise<AlimentoGenerico[]> | null = null

/** Base de alimentos genéricos (USDA en español). Se carga la primera vez que hace falta. */
export function alimentosGenericos(): Promise<AlimentoGenerico[]> {
  genericos ??= import('../catalogo/alimentos.json').then((m) => m.default.alimentos as AlimentoGenerico[])
  return genericos
}

export async function buscarAlimentoPorId(id: string): Promise<AlimentoCualquiera | undefined> {
  if (id.startsWith('g-')) return (await alimentosGenericos()).find((a) => a.id === id)
  return db.alimentos.get(id)
}

export async function registrarAlimento(d: {
  fecha: string
  comida: Comida
  alimento: { id: string; nombre: string; por100: Valores100 }
  gramos: number
  racion: string | null
}): Promise<string> {
  const id = nuevoId()
  await db.comidas.add({
    id,
    fecha: d.fecha,
    comida: d.comida,
    alimentoId: d.alimento.id,
    nombre: d.alimento.nombre,
    gramos: d.gramos,
    racion: d.racion,
    valores: valoresDe(d.alimento.por100, d.gramos),
    hora: Date.now(),
  })
  return id
}

/** Cambia la cantidad de un registro (los valores se recalculan con los del alimento). */
export async function cambiarCantidad(id: string, gramos: number, racion: string | null): Promise<void> {
  const r = await db.comidas.get(id)
  if (!r || r.gramos <= 0) return
  // Los valores por 100 g se deducen del propio registro: así no depende de que el alimento siga existiendo.
  const por100 = {
    kcal: (r.valores.kcal * 100) / r.gramos,
    proteina: (r.valores.proteina * 100) / r.gramos,
    carbohidratos: (r.valores.carbohidratos * 100) / r.gramos,
    grasa: (r.valores.grasa * 100) / r.gramos,
  }
  await db.comidas.update(id, { gramos, racion, valores: valoresDe(por100, gramos) })
}

export async function borrarRegistro(id: string): Promise<void> {
  await db.comidas.delete(id)
}

/** Copia lo que comí en una comida de otro día (por ejemplo, el desayuno de ayer). */
export async function repetirComida(deFecha: string, deComida: Comida, aFecha: string, aComida: Comida): Promise<number> {
  const origen = await db.comidas.where('[fecha+comida]').equals([deFecha, deComida]).toArray()
  const ahora = Date.now()
  await db.comidas.bulkAdd(origen.map((r, i) => ({ ...r, id: nuevoId(), fecha: aFecha, comida: aComida, hora: ahora + i })))
  return origen.length
}

export async function guardarPlato(nombre: string, registros: readonly RegistroComida[]): Promise<void> {
  await db.platos.add({
    id: nuevoId(),
    nombre: nombre.trim(),
    items: registros.map((r) => ({ alimentoId: r.alimentoId, nombre: r.nombre, gramos: r.gramos })),
    creado: Date.now(),
    usos: 0,
  })
}

/** Añade un plato guardado: cada alimento con su cantidad, con un toque. */
export async function anadirPlato(plato: Plato, fecha: string, comida: Comida): Promise<void> {
  for (const it of plato.items) {
    const a = await buscarAlimentoPorId(it.alimentoId)
    if (a) await registrarAlimento({ fecha, comida, alimento: a, gramos: it.gramos, racion: null })
  }
  await db.platos.update(plato.id, { usos: plato.usos + 1 })
}

export async function borrarPlato(id: string): Promise<void> {
  await db.platos.delete(id)
}

export async function sumarAgua(fecha: string, ml: number): Promise<void> {
  await db.transaction('rw', db.agua, async () => {
    const actual = await db.agua.get(fecha)
    await db.agua.put({ id: fecha, ml: Math.max(0, (actual?.ml ?? 0) + ml) })
  })
}

/** Guarda (o actualiza) un alimento de Open Food Facts, de la IA o creado por mí. */
export async function guardarAlimento(a: Omit<Alimento, 'creado'> & { creado?: number }): Promise<Alimento> {
  const completo: Alimento = { ...a, creado: a.creado ?? Date.now() }
  await db.alimentos.put(completo)
  return completo
}

export async function guardarPerfil(p: PerfilNutricion): Promise<void> {
  await db.nutricion.put(p)
}

export async function actualizarPerfil(cambios: Partial<Omit<PerfilNutricion, 'id'>>): Promise<void> {
  await db.nutricion.update('perfil', cambios)
}
