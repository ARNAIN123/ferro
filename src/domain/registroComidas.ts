// Registro de comidas: valores de una cantidad, totales del día, recientes y frecuentes, búsqueda,
// reto de fruta y verdura y resumen semanal. Funciones puras con tests.
import type { Habitual, Valores100 } from './nutricion'
import type { Comida, RegistroComida, Reto } from './tiposNutricion'

const r1 = (v: number) => Math.round(v * 10) / 10

/** Valores de `gramos` de un alimento a partir de sus valores por 100 g. */
export function valoresDe(por100: Valores100, gramos: number): Valores100 {
  const k = gramos / 100
  return { kcal: Math.round(por100.kcal * k), proteina: r1(por100.proteina * k), carbohidratos: r1(por100.carbohidratos * k), grasa: r1(por100.grasa * k) }
}

export const CERO: Valores100 = { kcal: 0, proteina: 0, carbohidratos: 0, grasa: 0 }

export function sumar(registros: readonly { valores: Valores100 }[]): Valores100 {
  const t = registros.reduce(
    (s, r) => ({
      kcal: s.kcal + r.valores.kcal,
      proteina: s.proteina + r.valores.proteina,
      carbohidratos: s.carbohidratos + r.valores.carbohidratos,
      grasa: s.grasa + r.valores.grasa,
    }),
    CERO,
  )
  return { kcal: Math.round(t.kcal), proteina: r1(t.proteina), carbohidratos: r1(t.carbohidratos), grasa: r1(t.grasa) }
}

export interface Reciente {
  alimentoId: string
  nombre: string
  /** Última cantidad que usé (para añadirlo igual con un toque). */
  gramos: number
  racion: string | null
  puntos: number
}

/**
 * Mis recientes y frecuentes para una comida y una hora: cuenta más lo que suelo tomar en esa
 * comida, a esa hora y hace poco. `ahora` en ms; `registros` de las últimas semanas.
 */
export function recientesPara(registros: readonly RegistroComida[], comida: Comida, ahora: number, maximo = 12, favoritos: readonly string[] = []): Reciente[] {
  const hora = new Date(ahora).getHours() + new Date(ahora).getMinutes() / 60
  const porAlimento = new Map<string, Reciente & { ultima: number }>()
  for (const r of registros) {
    const dias = Math.max(0, (ahora - r.hora) / 86_400_000)
    const h = new Date(r.hora).getHours() + new Date(r.hora).getMinutes() / 60
    const cercaDeHora = Math.abs(h - hora) <= 2 ? 1 : 0
    const p = (r.comida === comida ? 3 : 1) + cercaDeHora + Math.max(0, 2 - dias / 15)
    const previo = porAlimento.get(r.alimentoId)
    if (!previo) porAlimento.set(r.alimentoId, { alimentoId: r.alimentoId, nombre: r.nombre, gramos: r.gramos, racion: r.racion, puntos: p, ultima: r.hora })
    else {
      previo.puntos += p
      if (r.hora > previo.ultima) Object.assign(previo, { gramos: r.gramos, racion: r.racion, ultima: r.hora, nombre: r.nombre })
    }
  }
  for (const id of favoritos) {
    const x = porAlimento.get(id)
    if (x) x.puntos += 2
  }
  return [...porAlimento.values()]
    .sort((a, b) => b.puntos - a.puntos || b.ultima - a.ultima)
    .slice(0, maximo)
    .map(({ ultima: _u, ...x }) => x)
}

/** Texto en minúsculas y sin acentos, para buscar. */
export const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Buscar alimentos por nombre: todas las palabras tienen que aparecer; primero los que empiezan igual. */
export function buscar<T extends { nombre: string; marca?: string }>(lista: readonly T[], texto: string, maximo = 30): T[] {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean)
  if (!palabras.length) return []
  const con = lista
    .map((x) => ({ x, n: normalizar(`${x.nombre} ${x.marca ?? ''}`) }))
    .filter(({ n }) => palabras.every((p) => n.includes(p)))
  con.sort((a, b) => Number(!a.n.startsWith(palabras[0]!)) - Number(!b.n.startsWith(palabras[0]!)) || a.n.length - b.n.length)
  return con.slice(0, maximo).map(({ x }) => x)
}

/** Comida que toca por la hora (para "Añadir" sin elegir). */
export function comidaPorHora(ahora: number, entrena: boolean): Comida {
  const h = new Date(ahora).getHours()
  if (h < 11) return 'desayuno'
  if (h < 16) return 'comida'
  if (h < 19) return entrena ? 'antes' : 'merienda'
  return 'cena'
}

// ── Reto de fruta y verdura ─────────────────────────────────────────────────────────────────

/** Frutas y verduras para probar poco a poco, con una forma fácil de tomarlas con lo que ya como. */
export const RETOS: readonly { alimentoId: string; como: string }[] = [
  { alimentoId: 'g-platano', como: 'En un batido con leche y copos de avena, o troceado con el yogur.' },
  { alimentoId: 'g-tomate-triturado-lata', como: 'Unas cucharadas en la salsa de la pasta: casi no se nota.' },
  { alimentoId: 'g-fresas', como: 'Con yogur griego o en el batido de la mañana.' },
  { alimentoId: 'g-espinacas', como: 'Un puñado dentro de la tortilla o mezclado con la pasta caliente.' },
  { alimentoId: 'g-manzana', como: 'Troceada con el yogur o de merienda.' },
  { alimentoId: 'g-pimiento-rojo', como: 'En tiras, a la plancha junto al pollo.' },
  { alimentoId: 'g-arandanos', como: 'Un puñado sobre el yogur o la avena.' },
  { alimentoId: 'g-zanahoria', como: 'Rallada fina en la carne picada o en la salsa de la pasta.' },
  { alimentoId: 'g-brocoli', como: '3 minutos al microondas y mezclado con el arroz o la pasta.' },
  { alimentoId: 'g-kiwi', como: 'De postre: partido por la mitad y con cuchara.' },
  { alimentoId: 'g-champinones', como: 'Salteados con la carne o en la salsa de la pasta.' },
  { alimentoId: 'g-mango', como: 'En el batido de proteína.' },
  { alimentoId: 'g-naranja', como: 'En zumo natural con el desayuno o entera de merienda.' },
  { alimentoId: 'g-calabacin', como: 'En dados pequeños en la salsa de la pasta o con la carne picada.' },
  { alimentoId: 'g-guisantes', como: 'Un puñado con el arroz o la pasta.' },
  { alimentoId: 'g-uvas', como: 'Un racimo pequeño de merienda.' },
]

/**
 * Reto de la semana: el siguiente de la lista que no he probado ya. Los que no me gustan no vuelven
 * a salir. Si ya los he visto todos, no hay reto.
 */
export function retoDeLaSemana(lunes: string, retos: readonly Reto[]): { alimentoId: string; como: string; estado: Reto['estado'] } | null {
  const esta = retos.find((r) => r.semana === lunes)
  if (esta) {
    const r = RETOS.find((x) => x.alimentoId === esta.alimentoId)
    return r ? { ...r, estado: esta.estado } : null
  }
  const vistos = new Set(retos.map((r) => r.alimentoId))
  const siguiente = RETOS.find((r) => !vistos.has(r.alimentoId))
  return siguiente ? { ...siguiente, estado: 'propuesto' } : null
}

// ── Resumen semanal ─────────────────────────────────────────────────────────────────────────

export interface ResumenSemana {
  diasRegistrados: number
  mediaKcal: number | null
  mediaProteina: number | null
}

/** Media de calorías y proteína de los días con algo registrado. */
export function resumenSemana(registros: readonly RegistroComida[]): ResumenSemana {
  const porDia = new Map<string, RegistroComida[]>()
  for (const r of registros) porDia.set(r.fecha, [...(porDia.get(r.fecha) ?? []), r])
  const totales = [...porDia.values()].map(sumar)
  const n = totales.length
  return {
    diasRegistrados: n,
    mediaKcal: n ? Math.round(totales.reduce((s, t) => s + t.kcal, 0) / n) : null,
    mediaProteina: n ? Math.round(totales.reduce((s, t) => s + t.proteina, 0) / n) : null,
  }
}

// ── Habituales y días de entreno ────────────────────────────────────────────────────────────

/**
 * Mis alimentos habituales (para "Cerrar el día"): lo que más he registrado, con sus valores por
 * 100 g sacados del propio registro. `raciones` permite usar las raciones del alimento si las tiene.
 * Los que marqué como "no me gusta" no se proponen nunca.
 */
export function habitualesDe(
  registros: readonly RegistroComida[],
  raciones: (alimentoId: string) => readonly { nombre: string; gramos: number }[] = () => [],
  excluidos: ReadonlySet<string> = new Set(),
): Habitual[] {
  const porAlimento = new Map<string, { r: RegistroComida; usos: number }>()
  for (const r of registros) {
    if (r.gramos <= 0 || excluidos.has(r.alimentoId)) continue
    const previo = porAlimento.get(r.alimentoId)
    if (!previo) porAlimento.set(r.alimentoId, { r, usos: 1 })
    else {
      previo.usos++
      if (r.hora > previo.r.hora) previo.r = r
    }
  }
  return [...porAlimento.values()].map(({ r, usos }) => ({
    id: r.alimentoId,
    nombre: r.nombre,
    por100: {
      kcal: (r.valores.kcal * 100) / r.gramos,
      proteina: (r.valores.proteina * 100) / r.gramos,
      carbohidratos: (r.valores.carbohidratos * 100) / r.gramos,
      grasa: (r.valores.grasa * 100) / r.gramos,
    },
    raciones: raciones(r.alimentoId),
    usos,
  }))
}

/**
 * ¿Ese día es de entreno? Lo que marque a mano manda; si no, cuenta que haya entrenado o que la app
 * me haya detectado en el gimnasio ese día.
 */
export function esDiaDeEntreno(fecha: string, manual: Readonly<Record<string, boolean>> | undefined, diasConEntreno: ReadonlySet<string>): boolean {
  const m = manual?.[fecha]
  return m ?? diasConEntreno.has(fecha)
}
