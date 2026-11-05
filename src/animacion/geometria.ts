// Geometría 2D de las animaciones. Coordenadas SVG (y hacia abajo).
// Ángulos en grados: 0 apunta hacia abajo, 90 hacia delante (derecha), 180 hacia arriba, −90 hacia atrás.

export type P = readonly [number, number]

const RAD = Math.PI / 180

export const dir = (a: number): P => [Math.sin(a * RAD), Math.cos(a * RAD)]
export const mas = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]]
export const menos = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]]
export const por = (a: P, k: number): P => [a[0] * k, a[1] * k]
export const dist = (a: P, b: P): number => Math.hypot(b[0] - a[0], b[1] - a[1])
/** Ángulo de la dirección de `de` a `a`. */
export const angulo = (de: P, a: P): number => Math.atan2(a[0] - de[0], a[1] - de[1]) / RAD
/** Punto a distancia `l` de `o` en la dirección `ang`. */
export const desde = (o: P, ang: number, l: number): P => mas(o, por(dir(ang), l))
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const lerpP = (a: P, b: P, t: number): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
export const punto = (x: number, y: number): P => [x, y]

/**
 * Cinemática inversa de dos segmentos (hombro-codo-muñeca, cadera-rodilla-tobillo).
 * `doblez` 1 gira el primer segmento hacia ángulos mayores (la rodilla hacia delante);
 * −1, hacia ángulos menores (el codo hacia atrás). Si el objetivo queda lejos, el miembro se estira.
 */
export function ik(raiz: P, objetivo: P, a: number, b: number, doblez: 1 | -1): { medio: P; fin: P } {
  const d = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, dist(raiz, objetivo)))
  const base = angulo(raiz, objetivo)
  const coseno = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)))
  const alfa = Math.acos(coseno) / RAD
  const medio = desde(raiz, base + doblez * alfa, a)
  return { medio, fin: desde(medio, angulo(medio, objetivo), b) }
}
