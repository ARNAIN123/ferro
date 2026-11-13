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

/** Radio (m) de las cápsulas del pulgar (la base y la primera falange, más gruesas; la punta) y de los dedos. */
export const RADIO_PULGAR = 0.0105
export const RADIO_PULGAR_PUNTA = 0.0085
export const RADIO_DEDO = 0.009

/** Un tramo del pulgar (el metacarpiano o una falange). */
export interface TramoPulgar {
  largo: number
  radio: number
  /**
   * Dirección de partida: la búsqueda mira en un cono alrededor de ella. Sin ella, hacia el objetivo
   * del tramo desde donde empieza (o hacia la punta, si no tiene objetivo).
   */
  idea?: Vector3
  /** Abertura del cono (grados): lo que puede girar ese tramo. */
  cono: number
  /** Dónde debería acabar el tramo (opcional) y cuánto pesa acercarse. */
  objetivo?: Vector3
  peso?: number
}

export interface PulgarEnPuno {
  /** Donde empieza el primer tramo. */
  base: Vector3
  tramos: readonly TramoPulgar[]
  /** Falanges de los dedos, ya cerrados (segmentos). */
  dedos: readonly (readonly [Vector3, Vector3])[]
  /** Dónde debería quedar la punta del pulgar. */
  punta: Vector3
}

/** Lo que se mete una cápsula del pulgar (de radio `radio`) en las de los dedos (m, sumado). */
function choque(a: Vector3, b: Vector3, dedos: PulgarEnPuno['dedos'], radio: number): number {
  let total = 0
  for (const [p, q] of dedos) total += Math.max(0, radio + RADIO_DEDO - distanciaSegmentos(a, b, p, q))
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

/** Paso (grados) de las direcciones que se prueban al mirar cómo seguirían los tramos siguientes. */
const PASO_PREVIO = 9
const PASO_FINO = 5

/**
 * Dirección de cada tramo del pulgar, uno tras otro. Para cada dirección posible de un tramo (en el
 * cono alrededor de su idea) se mira también cómo seguirían los siguientes (eligiendo cada uno lo mejor
 * para él), y se queda la que deja el pulgar entero mejor: sin meterse en ningún dedo, con la punta en
 * su sitio y cada tramo cerca de su objetivo, si tiene. Así el metacarpiano gira lo justo para que las
 * falanges lleguen por fuera del puño.
 */
export function colocarPulgar(p: PulgarEnPuno): Vector3[] {
  const ideaDe = (t: TramoPulgar, desde: Vector3) => (t.idea ?? (t.objetivo ?? p.punta).clone().sub(desde)).clone().normalize()
  /** Puntuación de un tramo (sin la punta): choque y objetivo. */
  const deTramo = (t: TramoPulgar, desde: Vector3, fin: Vector3) => 1000 * choque(desde, fin, p.dedos, t.radio) + (t.objetivo ? (t.peso ?? 1) * fin.distanceTo(t.objetivo) : 0)
  /** Lo mejor que pueden hacer los tramos desde `i`, cada uno por su cuenta: su puntuación y su punta. */
  const seguir = (i: number, desde: Vector3, paso: number): { puntos: number; fin: Vector3 } => {
    let puntos = 0
    let actual = desde
    for (let k = i; k < p.tramos.length; k++) {
      const t = p.tramos[k]!
      const idea = ideaDe(t, actual)
      let mejor = { puntos: Infinity, fin: actual }
      for (const dir of cono(idea, t.cono, paso)) {
        const fin = actual.clone().add(dir.multiplyScalar(t.largo))
        const pt = deTramo(t, actual, fin) + (k === p.tramos.length - 1 ? fin.distanceTo(p.punta) : 0)
        if (pt < mejor.puntos) mejor = { puntos: pt, fin }
      }
      puntos += mejor.puntos
      actual = mejor.fin
    }
    return { puntos, fin: actual }
  }
  const dirs: Vector3[] = []
  let desde = p.base.clone()
  p.tramos.forEach((t, i) => {
    const idea = ideaDe(t, desde)
    const ultimo = i === p.tramos.length - 1
    let mejor = idea
    let puntos = Infinity
    for (const dir of cono(idea, t.cono, ultimo ? PASO_FINO : PASO_PREVIO)) {
      const fin = desde.clone().add(dir.clone().multiplyScalar(t.largo))
      const resto = ultimo ? { puntos: fin.distanceTo(p.punta) } : seguir(i + 1, fin, PASO_PREVIO * 1.5)
      // A igualdad, lo que menos se aparta de la idea.
      const puntuacion = deTramo(t, desde, fin) + resto.puntos + 0.002 * dir.angleTo(idea)
      if (puntuacion < puntos) {
        puntos = puntuacion
        mejor = dir
      }
    }
    dirs.push(mejor)
    desde = desde.add(mejor.clone().multiplyScalar(t.largo))
  })
  return dirs
}

/** Lo que se mete el pulgar en los dedos con esas direcciones (para los tests). */
export function choquePulgar(p: PulgarEnPuno, dirs: readonly Vector3[]): number {
  let desde = p.base.clone()
  let total = 0
  p.tramos.forEach((t, i) => {
    const fin = desde.clone().add(dirs[i]!.clone().multiplyScalar(t.largo))
    total += choque(desde, fin, p.dedos, t.radio)
    desde = fin
  })
  return total
}

/** Dónde queda la punta del pulgar con esas direcciones. */
export function puntaPulgar(p: PulgarEnPuno, dirs: readonly Vector3[]): Vector3 {
  return p.tramos.reduce((desde, t, i) => desde.add(dirs[i]!.clone().multiplyScalar(t.largo)), p.base.clone())
}
