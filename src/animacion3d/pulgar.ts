// El pulgar de un puño (ronda 5): por encima de los otros dedos, cruzado en diagonal desde el índice
// hasta la segunda falange del corazón y apoyado en ellos de punta a punta. Su postura se midió sobre la
// malla del avatar (no con cápsulas: el eje de cada falange no va por el centro del dedo y la punta se
// estrecha, así que unas cápsulas lo dejaban flotando o metido): se buscó la dirección de cada tramo
// que deja cada trozo del pulgar a menos de ~1,5 mm de la piel de los dedos sin meterse en ella, con
// la última falange cruzada hacia el meñique y la punta sobre la segunda falange del corazón, en cuatro
// cuerpos (mujer de 160 cm y 55 kg; hombres de 170/62, 178/80 y 190/110), y se guardó la media en el
// marco de la mano. Vale para todos porque la mano y el puño cambian de tamaño, no de forma.
import { Quaternion, Vector3 } from 'three'

/**
 * Dirección del metacarpiano y de las dos falanges del pulgar en un puño, en el marco de la mano
 * izquierda (su giro respecto al reposo); la derecha, en espejo (x cambiada de signo).
 */
export const PULGAR_PUNO: readonly (readonly [number, number, number])[] = [
  [-0.4704, -0.0541, 0.8808],
  [0.3932, -0.6297, 0.6699],
  [-0.4772, -0.8391, 0.2613],
]

/**
 * Direcciones (mundo) de los últimos `tramos` tramos del pulgar en un puño, con la mano girada `giroMano`
 * respecto al reposo. Si el cuerpo no tiene metacarpiano, solo las dos falanges.
 */
export function pulgarEnPuno(izquierda: boolean, giroMano: Quaternion, tramos: number): Vector3[] {
  return PULGAR_PUNO.slice(PULGAR_PUNO.length - tramos).map(([x, y, z]) => new Vector3(izquierda ? x : -x, y, z).normalize().applyQuaternion(giroMano))
}

/** Distancia entre dos segmentos (p1–q1 y p2–q2). */
export function distanciaSegmentos(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3): number {
  const d1 = q1.clone().sub(p1)
  const d2 = q2.clone().sub(p2)
  const r = p1.clone().sub(p2)
  const a = d1.dot(d1)
  const e = d2.dot(d2)
  const f = d2.dot(r)
  let s: number
  let t: number
  if (a < 1e-12 && e < 1e-12) return p1.distanceTo(p2)
  if (a < 1e-12) {
    s = 0
    t = Math.min(1, Math.max(0, f / e))
  } else {
    const c = d1.dot(r)
    if (e < 1e-12) {
      t = 0
      s = Math.min(1, Math.max(0, -c / a))
    } else {
      const b = d1.dot(d2)
      const den = a * e - b * b
      s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0
      t = (b * s + f) / e
      if (t < 0) {
        t = 0
        s = Math.min(1, Math.max(0, -c / a))
      } else if (t > 1) {
        t = 1
        s = Math.min(1, Math.max(0, (b - c) / a))
      }
    }
  }
  return p1.clone().add(d1.multiplyScalar(s)).distanceTo(p2.clone().add(d2.multiplyScalar(t)))
}
