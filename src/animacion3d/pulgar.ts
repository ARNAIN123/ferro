// El pulgar de un puño (ronda 5): se busca la dirección de sus dos falanges que lo deja lo más pegado
// posible al puño sin meterse en ningún dedo. Cada falange (del pulgar y de los dedos) es una cápsula:
// un segmento con un radio; dos cápsulas se tocan si sus segmentos están más cerca que la suma de los
// radios. La búsqueda es pequeña (un cono de direcciones alrededor de la primera idea), así que vale
// también para las animaciones, fotograma a fotograma.
import { Quaternion, Vector3 } from 'three'

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

/** Radio (m) de las cápsulas de las falanges del pulgar y de los dedos. */
export const RADIO_PULGAR = 0.012
export const RADIO_DEDO = 0.0095

export interface PulgarEnPuno {
  /** Articulación de la base del pulgar (donde empieza su primera falange). */
  base: Vector3
  /** Largo de sus dos falanges. */
  largos: readonly [number, number]
  /** Falanges de los dedos, ya cerrados (segmentos). */
  dedos: readonly (readonly [Vector3, Vector3])[]
  /** Hacia dónde debería ir cada falange (puntos): la primera idea, que se corrige si choca. */
  objetivos: readonly [Vector3, Vector3]
}

/** Lo que se mete una cápsula del pulgar en las de los dedos (m, sumado). */
function choque(a: Vector3, b: Vector3, dedos: PulgarEnPuno['dedos']): number {
  let total = 0
  for (const [p, q] of dedos) total += Math.max(0, RADIO_PULGAR + RADIO_DEDO - distanciaSegmentos(a, b, p, q))
  return total
}

/** Direcciones de un cono alrededor de `eje` (hasta `maximo` grados, cada `paso`). */
function cono(eje: Vector3, maximo: number, paso: number): Vector3[] {
  const u = Math.abs(eje.y) < 0.9 ? new Vector3(0, 1, 0).cross(eje).normalize() : new Vector3(1, 0, 0).cross(eje).normalize()
  const w = eje.clone().cross(u).normalize()
  const r: Vector3[] = []
  for (let x = -maximo; x <= maximo; x += paso)
    for (let y = -maximo; y <= maximo; y += paso) {
      const q = new Quaternion().setFromAxisAngle(u, (x * Math.PI) / 180).multiply(new Quaternion().setFromAxisAngle(w, (y * Math.PI) / 180))
      r.push(eje.clone().applyQuaternion(q))
    }
  return r
}

/**
 * Direcciones de las dos falanges del pulgar: entre las del cono alrededor de la primera idea, la que
 * no choca con ningún dedo (o choca lo menos posible) y deja la punta de cada falange más cerca de su
 * objetivo (es decir, pegada al puño).
 */
export function colocarPulgar(p: PulgarEnPuno): [Vector3, Vector3] {
  const elegir = (desde: Vector3, largo: number, objetivo: Vector3): Vector3 => {
    const idea = objetivo.clone().sub(desde).normalize()
    let mejor = idea
    let puntos = Infinity
    for (const dir of cono(idea, 40, 5)) {
      const fin = desde.clone().add(dir.clone().multiplyScalar(largo))
      const puntuacion = 1000 * choque(desde, fin, p.dedos) + fin.distanceTo(objetivo)
      if (puntuacion < puntos) {
        puntos = puntuacion
        mejor = dir
      }
    }
    return mejor
  }
  const dir1 = elegir(p.base, p.largos[0], p.objetivos[0])
  const medio = p.base.clone().add(dir1.clone().multiplyScalar(p.largos[0]))
  const dir2 = elegir(medio, p.largos[1], p.objetivos[1])
  return [dir1, dir2]
}

/** Lo que se mete el pulgar en los dedos con esas direcciones (para los tests). */
export function choquePulgar(p: PulgarEnPuno, dirs: readonly [Vector3, Vector3]): number {
  const medio = p.base.clone().add(dirs[0].clone().multiplyScalar(p.largos[0]))
  const punta = medio.clone().add(dirs[1].clone().multiplyScalar(p.largos[1]))
  return choque(p.base, medio, p.dedos) + choque(medio, punta, p.dedos)
}
