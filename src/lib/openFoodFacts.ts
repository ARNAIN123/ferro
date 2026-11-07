// Open Food Facts (https://world.openfoodfacts.org): base de datos abierta de productos (licencia
// ODbL; datos de los productos, Database Contents License). Solo se consulta cuando escaneo un código
// o busco un producto; lo que añado se guarda en el móvil y ya no hace falta conexión.
import type { Alimento } from '../domain/tiposNutricion'

const CAMPOS = 'code,product_name,product_name_es,generic_name_es,brands,nutriments,serving_quantity,serving_size'

interface ProductoOff {
  code?: string
  product_name?: string
  product_name_es?: string
  generic_name_es?: string
  brands?: string
  serving_quantity?: number | string
  serving_size?: string
  nutriments?: Record<string, number | string | undefined>
}

const numero = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

/** Convierte un producto de Open Food Facts en un alimento de Ferro (null si no trae valores). */
export function aAlimento(p: ProductoOff): Alimento | null {
  const n = p.nutriments ?? {}
  const kcal = numero(n['energy-kcal_100g']) ?? (numero(n['energy_100g']) !== null ? (numero(n['energy_100g']) as number) / 4.184 : null)
  const proteina = numero(n['proteins_100g'])
  const carbohidratos = numero(n['carbohydrates_100g'])
  const grasa = numero(n['fat_100g'])
  if (kcal === null || proteina === null || carbohidratos === null || grasa === null || !p.code) return null
  const nombre = (p.product_name_es || p.product_name || p.generic_name_es || '').trim()
  if (!nombre) return null
  const racion = numero(p.serving_quantity)
  const r1 = (v: number) => Math.round(v * 10) / 10
  return {
    id: `off-${p.code}`,
    nombre,
    marca: p.brands?.split(',')[0]?.trim() || undefined,
    codigo: p.code,
    origen: 'off',
    estado: null,
    por100: { kcal: Math.round(kcal), proteina: r1(proteina), carbohidratos: r1(carbohidratos), grasa: r1(grasa), fibra: r1(numero(n['fiber_100g']) ?? 0) },
    raciones: racion && racion > 0 ? [{ nombre: p.serving_size ? `1 ración (${p.serving_size})` : '1 ración', gramos: Math.round(racion) }] : [],
    creado: Date.now(),
  }
}

/** Producto por su código de barras. null si no está en Open Food Facts o no trae valores. */
export async function productoPorCodigo(codigo: string, senal?: AbortSignal): Promise<Alimento | null> {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=${CAMPOS}&lc=es`, { signal: senal })
  if (r.status === 404) return null
  if (!r.ok) throw new Error('Open Food Facts no responde')
  const j = (await r.json()) as { status?: number; product?: ProductoOff }
  return j.status === 1 && j.product ? aAlimento({ ...j.product, code: j.product.code ?? codigo }) : null
}

/** Busca productos por texto (preferentemente de España). */
export async function buscarProductos(texto: string, senal?: AbortSignal): Promise<Alimento[]> {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(texto)}&search_simple=1&action=process&json=1` +
    `&page_size=24&lc=es&tagtype_0=countries&tag_contains_0=contains&tag_0=spain&fields=${CAMPOS}`
  const r = await fetch(url, { signal: senal })
  if (!r.ok) throw new Error('Open Food Facts no responde')
  const j = (await r.json()) as { products?: ProductoOff[] }
  return (j.products ?? []).map(aAlimento).filter((a): a is Alimento => a !== null)
}
