// Matemáticas de las animaciones 3D: cinemática inversa de dos huesos, giros entre bases y curvas.
// Coordenadas del mundo (las de three.js): Y arriba, el cuerpo en reposo mira hacia +Z y su
// izquierda es +X. Metros.
import { Matrix4, Quaternion, Vector3 } from 'three'

export type V3 = readonly [number, number, number]
export const v = (p: V3): Vector3 => new Vector3(p[0], p[1], p[2])

/** Componente de `a` perpendicular a `eje` (normalizada); si no hay, `reserva`. */
export function perpendicular(a: Vector3, eje: Vector3, reserva?: Vector3): Vector3 {
  const e = eje.clone().normalize()
  const r = a.clone().sub(e.clone().multiplyScalar(a.dot(e)))
  if (r.lengthSq() > 1e-8) return r.normalize()
  if (reserva) return perpendicular(reserva, eje)
  // Cualquier perpendicular.
  const otro = Math.abs(e.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
  return otro.sub(e.clone().multiplyScalar(otro.dot(e))).normalize()
}

/**
 * Cinemática inversa de dos huesos (brazo y antebrazo, o muslo y pierna): desde la raíz `s`, con
 * longitudes `a` y `b`, alcanzar `t`. El codo (o la rodilla) se dobla hacia `polo`. Si el objetivo
 * queda fuera de alcance, el miembro se estira hacia él sin pasar del 99,9 % (nunca se hiperextiende).
 */
export function dosHuesos(s: Vector3, t: Vector3, a: number, b: number, polo: Vector3): { medio: Vector3; fin: Vector3; alcanzado: boolean } {
  const st = t.clone().sub(s)
  const distancia = st.length()
  const max = (a + b) * 0.999
  const min = Math.abs(a - b) * 1.001 + 1e-4
  const d = Math.min(max, Math.max(min, distancia))
  const dir = distancia > 1e-6 ? st.clone().normalize() : new Vector3(0, -1, 0)
  const cosA = (a * a + d * d - b * b) / (2 * a * d)
  const senA = Math.sqrt(Math.max(0, 1 - cosA * cosA))
  const lado = perpendicular(polo, dir)
  const medio = s.clone().add(dir.clone().multiplyScalar(a * cosA)).add(lado.multiplyScalar(a * senA))
  const fin = s.clone().add(dir.multiplyScalar(d))
  return { medio, fin, alcanzado: Math.abs(distancia - d) < 1e-6 }
}

/**
 * Giro que lleva la base (dirección, secundaria) de reposo a la base deseada. Las secundarias se
 * hacen perpendiculares a su dirección antes de construir las bases.
 */
export function giroEntreBases(dirReposo: Vector3, secReposo: Vector3, dir: Vector3, sec: Vector3): Quaternion {
  const base = (d: Vector3, s: Vector3) => {
    const x = d.clone().normalize()
    const y = perpendicular(s, x)
    const z = new Vector3().crossVectors(x, y)
    return new Matrix4().makeBasis(x, y, z)
  }
  const m0 = base(dirReposo, secReposo)
  const m1 = base(dir, sec)
  return new Quaternion().setFromRotationMatrix(m1.multiply(m0.transpose()))
}

/** Ángulo (grados) entre dos segmentos que se unen en una articulación: 180 = recto. */
export function anguloArticulacion(a: Vector3, medio: Vector3, c: Vector3): number {
  const u = a.clone().sub(medio).normalize()
  const w = c.clone().sub(medio).normalize()
  return (Math.acos(Math.min(1, Math.max(-1, u.dot(w)))) * 180) / Math.PI
}

// ── Curvas y claves ─────────────────────────────────────────────────────────────────────────

/** Suavizado seno: arranca y frena sin tirones. */
export const suave = (x: number): number => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)))

export interface Clave<P> {
  /** Segundo dentro de la repetición. */
  t: number
  p: P
}

/** Pendientes de una cúbica monótona (Fritsch–Carlson): sin rebotes y con velocidad 0 en los extremos. */
function pendientes(ts: readonly number[], ys: readonly number[]): number[] {
  const n = ts.length
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1]! - ys[i]!) / Math.max(1e-6, ts[i + 1]! - ts[i]!))
  const m: number[] = new Array(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1]! * d[i]! <= 0) m[i] = 0
    else {
      const h0 = ts[i]! - ts[i - 1]!
      const h1 = ts[i + 1]! - ts[i]!
      const w1 = 2 * h1 + h0
      const w2 = h1 + 2 * h0
      m[i] = (w1 + w2) / (w1 / d[i - 1]! + w2 / d[i]!)
    }
  }
  return m
}

/**
 * Interpola las claves de una repetición: cúbica monótona para cada parámetro, así el movimiento es
 * continuo entre poses y solo frena donde cambia de sentido o hay una pausa (claves iguales).
 */
export function interpolar<P extends Record<string, number>>(claves: readonly Clave<P>[], t: number): P {
  const primera = claves[0]!
  const ultima = claves[claves.length - 1]!
  if (t <= primera.t) return { ...primera.p }
  if (t >= ultima.t) return { ...ultima.p }
  let i = 0
  while (i < claves.length - 2 && t > claves[i + 1]!.t) i++
  const ts = claves.map((c) => c.t)
  const r = {} as Record<string, number>
  for (const nombre of Object.keys(primera.p)) {
    const ys = claves.map((c) => c.p[nombre] ?? primera.p[nombre]!)
    const m = pendientes(ts, ys)
    const h = ts[i + 1]! - ts[i]!
    const x = (t - ts[i]!) / Math.max(1e-6, h)
    const x2 = x * x
    const x3 = x2 * x
    r[nombre] = (2 * x3 - 3 * x2 + 1) * ys[i]! + (x3 - 2 * x2 + x) * h * m[i]! + (-2 * x3 + 3 * x2) * ys[i + 1]! + (x3 - x2) * h * m[i + 1]!
  }
  return r as P
}
