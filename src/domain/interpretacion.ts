// Limpieza de lo que devuelve la IA al interpretar "200 g de pollo con 80 g de arroz".
// La IA solo propone: aquí se valida todo antes de enseñarlo, y yo lo reviso antes de guardarlo.
import type { Valores100 } from './nutricion'
import type { Estado } from './tiposNutricion'

export interface ItemInterpretado {
  nombre: string
  gramos: number
  estado: Estado
  /** Alimento de mi lista o de la base genérica que coincide; null si la IA ha estimado los valores. */
  alimentoId: string | null
  por100: Valores100
}

export interface EntradaCatalogo {
  id: string
  nombre: string
  estado: Estado
}

/** Esquema JSON de la respuesta (salida estructurada: sin restricciones numéricas). */
export const ESQUEMA_INTERPRETACION = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre corto del alimento en español' },
          gramos: { type: 'number', description: 'Cantidad en gramos (o ml) tal como se pesó' },
          estado: { type: 'string', enum: ['crudo', 'cocinado', 'no_aplica'] },
          alimentoId: { type: 'string', description: 'id del catálogo que coincide, o cadena vacía si ninguno' },
          kcal: { type: 'number', description: 'kcal por 100 g' },
          proteina: { type: 'number', description: 'g de proteína por 100 g' },
          carbohidratos: { type: 'number', description: 'g de hidratos por 100 g' },
          grasa: { type: 'number', description: 'g de grasa por 100 g' },
        },
        required: ['nombre', 'gramos', 'estado', 'alimentoId', 'kcal', 'proteina', 'carbohidratos', 'grasa'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const redondear1 = (n: number) => Math.round(n * 10) / 10

/** Valida la respuesta: descarta lo imposible y solo acepta ids que existen de verdad. */
export function limpiarInterpretacion(datos: unknown, catalogo: readonly EntradaCatalogo[]): ItemInterpretado[] {
  const lista = (datos as { items?: unknown })?.items
  if (!Array.isArray(lista)) return []
  const ids = new Map(catalogo.map((c) => [c.id, c]))
  const items: ItemInterpretado[] = []
  for (const bruto of lista.slice(0, 20)) {
    const b = bruto as Record<string, unknown>
    const nombre = typeof b.nombre === 'string' ? b.nombre.trim().slice(0, 80) : ''
    const gramos = numero(b.gramos)
    if (!nombre || gramos === null || gramos <= 0 || gramos > 3000) continue
    const v = { kcal: numero(b.kcal), proteina: numero(b.proteina), carbohidratos: numero(b.carbohidratos), grasa: numero(b.grasa) }
    if (Object.values(v).some((x) => x === null || x < 0)) continue
    const por100 = { kcal: Math.round(v.kcal!), proteina: redondear1(v.proteina!), carbohidratos: redondear1(v.carbohidratos!), grasa: redondear1(v.grasa!) }
    // 100 g de cualquier cosa no puede tener más de 100 g de macros ni más de 900 kcal (aceite puro).
    if (por100.kcal > 900 || por100.proteina + por100.carbohidratos + por100.grasa > 100.5) continue
    const id = typeof b.alimentoId === 'string' ? b.alimentoId : ''
    const delCatalogo = ids.get(id)
    const estado: Estado = b.estado === 'crudo' || b.estado === 'cocinado' ? b.estado : null
    items.push({ nombre: delCatalogo?.nombre ?? nombre, gramos: Math.round(gramos), estado: delCatalogo ? delCatalogo.estado : estado, alimentoId: delCatalogo ? id : null, por100 })
  }
  return items
}

/** Instrucciones para la IA, con el catálogo para que reutilice mis alimentos. */
export function instruccionesInterpretacion(catalogo: readonly EntradaCatalogo[]): string {
  const lineas = catalogo.map((c) => `${c.id}\t${c.nombre}${c.estado ? ` (${c.estado})` : ''}`).join('\n')
  return [
    'Conviertes la descripción de una comida en una lista de alimentos con su cantidad en gramos.',
    'Reglas:',
    '- Un elemento por alimento. Si la persona no dice la cantidad, usa una ración habitual en España.',
    '- Indica si el peso es en crudo o cocinado cuando importe (carne, pasta, arroz, legumbres); "no_aplica" si da igual.',
    '- Si un alimento coincide con uno del catálogo (mismo alimento y mismo estado), pon su id en alimentoId y copia sus valores aproximados; si no, deja alimentoId vacío y estima los valores por 100 g con datos de composición típicos.',
    '- Valores siempre por 100 g del alimento en el estado indicado.',
    '- No añadas alimentos que no se mencionan.',
    '',
    'Catálogo (id, nombre):',
    lineas,
  ].join('\n')
}
