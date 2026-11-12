// Cuerpo 3D (public/modelos): cada punto de la piel lleva su número de región (1…48, las de
// REGIONES_MODELO; 0 = sin músculo de Ferro) y la oclusión ambiental horneada. Cada región se pinta
// con el grupo muscular al que pertenece (GRUPO_DE_REGION).
import { grupoDeRegion, REGIONES_MODELO } from './musculos'
import type { Musculo } from './tipos'

/** Número de regiones de los modelos (sin contar la 0). */
export const NUM_REGIONES = REGIONES_MODELO.length

/** Grupo muscular de una región del modelo (null si no es ningún músculo de Ferro). */
export const musculoDeRegion = (id: number): Musculo | null => grupoDeRegion(id)

/** Lo que se pinta en cada región (la 0 incluida) a partir de lo de cada grupo. */
export function porRegion<T>(deGrupo: (m: Musculo | null) => T): T[] {
  return Array.from({ length: NUM_REGIONES + 1 }, (_, id) => deGrupo(grupoDeRegion(id)))
}

/** Lee el id de región guardado en un canal de color (0–1). */
export const idDeCanal = (r: number): number => Math.round(r * 255)

export type RGB = readonly [number, number, number]

/** Cuánto acento lleva cada nivel (0 = arcilla sin trabajar). */
export const MEZCLA_NIVEL: readonly number[] = [0, 0.22, 0.42, 0.62, 0.82, 1]

/** Intensidad del acento de cada nivel: los bajos, un tinte suave; los altos, naranja pleno. */
export const INTENSIDAD_NIVEL: readonly number[] = [1, 0.8, 0.85, 0.9, 0.95, 1]

/** Brillo propio (emisivo) de cada nivel: solo en los niveles altos y sutil. */
export const BRILLO_NIVEL: readonly number[] = [0, 0, 0, 0.04, 0.12, 0.3]

/** La oclusión ambiental oscurece las zonas hundidas sin llegar a negro. */
export const factorOclusion = (ao: number): number => 0.55 + 0.45 * Math.min(1, Math.max(0, ao)) ** 1.5

const mezclar = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Color y brillo de un vértice según el nivel de su músculo (y si está seleccionado). */
export function aspectoDeNivel(nivel: number, arcilla: RGB, acento: RGB, seleccionado = false): { color: RGB; brillo: number } {
  const n = Math.min(5, Math.max(0, Math.round(nivel)))
  const k = INTENSIDAD_NIVEL[n] ?? 1
  const color = mezclar(arcilla, [acento[0] * k, acento[1] * k, acento[2] * k], MEZCLA_NIVEL[n] ?? 0)
  const brillo = BRILLO_NIVEL[n] ?? 0
  if (!seleccionado) return { color, brillo }
  // Seleccionado: algo más claro y con brillo, para verlo aunque no esté trabajado.
  return { color: mezclar(color, [1, 1, 1], 0.18), brillo: Math.max(brillo, 0.18) }
}

/** '#ff6b1f' o 'rgb(255 107 31)' → [r, g, b] lineales 0–1 (para WebGL). */
export function colorCss(texto: string): RGB {
  const t = texto.trim()
  let rgb: number[] | null = null
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t)
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((c) => c + c).join('') : hex[1]!
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  } else {
    const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(t)
    if (m) rgb = [Number(m[1]), Number(m[2]), Number(m[3])]
  }
  if (!rgb) return [0.5, 0.5, 0.5]
  const lineal = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return [lineal(rgb[0]!), lineal(rgb[1]!), lineal(rgb[2]!)]
}

// ── Gestos ──────────────────────────────────────────────────────────────────────────────────

/** Radianes por píxel al arrastrar en horizontal. */
export const GIRO_POR_PIXEL = 0.012
/** El giro sigue con inercia y se frena con esta constante de tiempo (ms). */
export const FRENADO_GIRO = 420
export const ZOOM_MIN = 1
export const ZOOM_MAX = 2.4

/** Ángulo equivalente más cercano a `actual` (para girar por el camino corto). */
export function anguloCercano(actual: number, objetivo: number): number {
  const vuelta = 2 * Math.PI
  return objetivo + Math.round((actual - objetivo) / vuelta) * vuelta
}

export const limitarZoom = (z: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

/** Con zoom se puede subir y bajar la vista, sin salirse del cuerpo (alto ≈ 1,71 m). */
export function limitarAltura(y: number, zoom: number, alto = 1.71): number {
  const margen = (alto / 2) * (1 - 1 / zoom)
  return Math.min(alto / 2 + margen, Math.max(alto / 2 - margen, y))
}
