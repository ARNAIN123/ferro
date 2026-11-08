// Piloto de animaciones 3D: 10 ejercicios con poses clave sobre el mismo cuerpo del avatar.
// Cada ejercicio describe UNA repetición con sus claves (segundos) y cómo colocar el cuerpo y el
// material para unos parámetros. Tempo real: bajada ~2 s, subida ~1 s y pausas cortas.
import { Vector3 } from 'three'
import { perpendicular, type Clave, type V3 } from './ik'
import type { Extremo, Lado, Rig, TroncoResuelto } from './rig'

export type Parametros = Record<string, number>

export interface EstadoMaterial {
  /** Centro de la barra (a lo largo de X). */
  barra?: Vector3
  mancuernas?: Partial<Record<Lado, { centro: Vector3; eje: Vector3 }>>
  /** Punto donde el cable engancha el agarre (la pila sube lo que se alarga el cable). */
  cable?: Vector3
  cuerda?: { enganche: Vector3; manos: [Vector3, Vector3] }
  /** Centro de la barra de jalón. */
  barraPolea?: Vector3
  /** Centro de la barra del multipower. */
  multipower?: Vector3
  disco?: { centro: Vector3; eje: Vector3 }
  landmine?: { pivote: Vector3; mano: Vector3 }
  rodillo?: Vector3
  /** Cables de las torres (`torre`), en orden: de la salida de la polea al agarre. */
  cables?: { salida: Vector3; enganche: Vector3 }[]
  /** Agarre de cada cable: dónde está y, si es para dos manos, dónde van las manos. */
  agarresPolea?: { centro: Vector3; manos?: [Vector3, Vector3] }[]
}

export type AgarrePolea = 'cuerda' | 'recta' | 'triangulo' | 'estribo' | 'jalon' | 'tobillera'

export type Pieza =
  | { tipo: 'barra'; radioDisco?: number; discos?: number; almohadilla?: boolean }
  | { tipo: 'hexagonal' }
  | { tipo: 'mancuernas'; manos?: Lado[] }
  | { tipo: 'disco' }
  | { tipo: 'multipower' }
  | { tipo: 'landmine'; pivote: V3 }
  | { tipo: 'caja'; centro: V3; tam: V3 }
  | { tipo: 'rodillo' }
  | { tipo: 'banco'; pos: V3; giroY?: number; inclinacion?: number }
  | { tipo: 'bancoLibre'; asiento: [V3, V3]; respaldo?: [V3, V3]; patas: boolean }
  | { tipo: 'polea'; pos: V3; alturaPolea: number; giroY?: number; agarre: 'cuerda' | 'recta' | 'triangulo' | 'estribo' }
  | { tipo: 'torre'; salida: V3 }
  | { tipo: 'agarrePolea'; agarre: AgarrePolea }
  | { tipo: 'jalon' }

export interface Definicion3D {
  /** Id del ejercicio en la biblioteca. */
  id: string
  nombre: string
  material: Pieza[]
  /** Una repetición (s). La primera y la última clave son la misma pose. */
  claves: Clave<Parametros>[]
  /** Tramos (s) de la fase concéntrica: los músculos principales se iluminan más. */
  concentrica: readonly (readonly [number, number])[]
  /** Cámara inicial: ángulo en grados desde el frente (+Z) hacia la izquierda del cuerpo (+X). */
  camara: { azimut: number; altura: number; distancia: number; objetivo: V3 }
  colocar: (p: Parametros, rig: Rig) => EstadoMaterial
}

// ── Ayudas ─────────────────────────────────────────────────────────────────────────────────

const lados = <T>(f: (s: number, lado: Lado) => T): Record<Lado, T> => ({ L: f(1, 'L'), R: f(-1, 'R') })
const V = (x: number, y: number, z: number) => new Vector3(x, y, z)
const t3 = (p: Vector3): V3 => [p.x, p.y, p.z]
const mezcla = (a: number, b: number, k: number) => a + (b - a) * k
const entre = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/** Mano agarrando algo en `punto`: la muñeca queda detrás, según hacia dónde van los nudillos y la palma. */
function agarre(punto: Vector3, dir: Vector3, palma: Vector3, polo: Vector3): Extremo {
  const d = dir.clone().normalize()
  const n = perpendicular(palma, d)
  const muneca = punto.clone().sub(d.clone().multiplyScalar(0.075)).sub(n.clone().multiplyScalar(0.025))
  return { pos: t3(muneca), polo: t3(polo), dir: t3(d), normal: t3(n) }
}

/** Pie plano en el suelo: tobillo en (x, z), con la punta abierta `abrir` grados hacia fuera. */
function piePlano(x: number, z: number, s: number, abrir: number, polo: Vector3, y = 0.066): Extremo {
  const a = (abrir * Math.PI) / 180
  const dir = V(Math.sin(a) * s, -0.36, Math.cos(a)).normalize()
  return { pos: [x, y, z], polo: t3(polo), dir: t3(dir), normal: t3(perpendicular(V(0, 1, 0), dir)) }
}

const medio = (t: TroncoResuelto) => t.hombro.L.clone().add(t.hombro.R).multiplyScalar(0.5)

/** Claves de un solo parámetro: [segundo, valor]. */
const claves = (nombre: string, puntos: readonly (readonly [number, number])[]): Clave<Parametros>[] =>
  puntos.map(([t, valor]) => ({ t, p: { [nombre]: valor } }))

/** Repetición que empieza con la fase concéntrica (sube y luego baja en 2 s), con 4 poses en cada fase. */
const concentricaPrimero = (n: string, pausaArriba = 0.45): Clave<Parametros>[] =>
  claves(n, [
    [0, 0],
    [0.35, 0.42],
    [0.7, 0.85],
    [1.0, 1],
    [1.0 + pausaArriba, 1],
    [1.7 + pausaArriba, 0.6],
    [2.4 + pausaArriba, 0.18],
    [3.0 + pausaArriba, 0],
    [3.3 + pausaArriba, 0],
  ])

// ── Los 10 ejercicios ──────────────────────────────────────────────────────────────────────

const pressBanca: Definicion3D = {
  id: 'Barbell_Bench_Press_-_Medium_Grip',
  nombre: 'Press de banca con barra',
  material: [{ tipo: 'banco', pos: [0, 0, -0.1] }, { tipo: 'barra' }],
  // Empieza arriba: baja en 2 s describiendo una J hasta el pecho, pausa y sube en 1 s.
  claves: [
    { t: 0, p: { y: 1.045, z: -0.31 } },
    { t: 0.7, p: { y: 0.95, z: -0.29 } },
    { t: 1.4, p: { y: 0.85, z: -0.24 } },
    { t: 2.0, p: { y: 0.745, z: -0.18 } },
    { t: 2.25, p: { y: 0.745, z: -0.18 } },
    { t: 2.75, p: { y: 0.88, z: -0.235 } },
    { t: 3.25, p: { y: 1.045, z: -0.31 } },
    { t: 3.75, p: { y: 1.045, z: -0.31 } },
  ],
  concentrica: [[2.25, 3.25]],
  camara: { azimut: 55, altura: 1.55, distancia: 3.4, objetivo: [0, 0.62, 0.05] },
  colocar: (p, rig) => {
    // Tumbado boca arriba: la cabeza hacia −Z, con la espalda algo arqueada y las escápulas juntas.
    rig.aplicarTronco({ pelvis: { pos: [0, 0.55, 0.15], rot: [-90, 0, 0] }, columna: [-6, 0, 0], cabeza: [6, 0, 0], claviculas: [0, -8] })
    const barra = V(0, p.y!, p.z!)
    const dir = V(0, 0.75, -0.66)
    const palma = V(0, 0.66, 0.75)
    const manos = lados((s) => agarre(barra.clone().add(V(0.39 * s, 0, 0)), dir, palma, V(0.8 * s, -0.5, 0.35)))
    const pies = lados((s) => piePlano(0.26 * s, 0.62, s, 18, V(0.35 * s, 1, 0.15)))
    rig.aplicarExtremos(manos, pies)
    return { barra }
  },
}

const sentadilla: Definicion3D = {
  id: 'Barbell_Squat',
  nombre: 'Sentadilla con barra',
  material: [{ tipo: 'barra' }],
  claves: claves('s', [
    [0, 0],
    [0.6, 0.3],
    [1.3, 0.72],
    [2.0, 1],
    [2.25, 1],
    [2.75, 0.45],
    [3.25, 0],
    [3.75, 0],
  ]),
  concentrica: [[2.25, 3.25]],
  camara: { azimut: 60, altura: 1.4, distancia: 3.7, objetivo: [0, 0.9, 0] },
  colocar: (p, rig) => {
    const s = p.s!
    // Cadera atrás y abajo, tronco inclinado y la barra siempre encima del medio del pie.
    const t = rig.aplicarTronco({
      pelvis: { pos: [0, mezcla(0.902, 0.53, s), mezcla(-0.03, -0.27, Math.pow(s, 0.9))], rot: [38 * Math.pow(s, 0.85), 0, 0] },
      columna: [4 * s, 0, 0],
      cabeza: [-14 * s, 0, 0],
      claviculas: [4, -6],
    })
    const barra = medio(t).add(t.arriba.clone().multiplyScalar(0.045)).sub(t.frente.clone().multiplyScalar(0.075))
    const dir = t.arriba.clone().sub(t.frente.clone().multiplyScalar(0.35))
    const manos = lados((lado) => agarre(barra.clone().add(V(0.36 * lado, 0, 0)), dir, t.frente, V(0.3 * lado, -1, -0.4)))
    const pies = lados((lado) => piePlano(0.17 * lado, -0.04, lado, 18, V(0.4 * lado, 0, 1)))
    rig.aplicarExtremos(manos, pies)
    return { barra }
  },
}

/** Altura de la pelvis en el peso muerto según la altura de la barra (de suelo a bloqueo). */
const PELVIS_MUERTO: readonly (readonly [number, number])[] = [
  [0, 0.63],
  [0.25, 0.68],
  [0.45, 0.74],
  [0.7, 0.83],
  [1, 0.908],
]
const tabla = (t: readonly (readonly [number, number])[], x: number) => {
  for (let i = 0; i < t.length - 1; i++) if (x <= t[i + 1]![0]) return mezcla(t[i]![1], t[i + 1]![1], (x - t[i]![0]) / (t[i + 1]![0] - t[i]![0]))
  return t[t.length - 1]![1]
}

const pesoMuerto: Definicion3D = {
  id: 'Barbell_Deadlift',
  nombre: 'Peso muerto con barra',
  material: [{ tipo: 'barra' }],
  claves: claves('h', [
    [0, 0],
    [0.3, 0.2],
    [0.6, 0.5],
    [1.0, 1],
    [1.5, 1],
    [2.2, 0.6],
    [2.9, 0.22],
    [3.5, 0],
    [3.9, 0],
  ]),
  concentrica: [[0, 1.0]],
  camara: { azimut: 70, altura: 1.25, distancia: 3.6, objetivo: [0, 0.75, 0] },
  colocar: (p, rig) => {
    const h = p.h!
    const barraY = mezcla(0.225, 0.8, h)
    const barraZ = 0.035
    const pelvisY = tabla(PELVIS_MUERTO, h)
    // Inclinación del tronco para que los brazos cuelguen rectos hasta la barra.
    const torso = 0.47
    const hombroY = barraY + 0.075 + 0.53 * 0.99
    const alfa = Math.acos(Math.min(1, Math.max(0, (hombroY - pelvisY) / torso)))
    const pelvisZ = barraZ + 0.03 * (1 - h) - torso * Math.sin(alfa)
    rig.aplicarTronco({ pelvis: { pos: [0, pelvisY, pelvisZ], rot: [(alfa * 180) / Math.PI, 0, 0] }, columna: [2, 0, 0], cabeza: [-18 * (1 - h), 0, 0], claviculas: [-3 * h, 4 * (1 - h)] })
    const barra = V(0, barraY, barraZ)
    const manos = lados((s) => agarre(barra.clone().add(V(0.25 * s, 0, 0)), V(0, -1, 0), V(0, 0, -1), V(0.4 * s, 0, -1)))
    const pies = lados((s) => piePlano(0.13 * s, -0.04, s, 8, V(0.3 * s, 0, 1)))
    rig.aplicarExtremos(manos, pies)
    return { barra }
  },
}

const remoConBarra: Definicion3D = {
  id: 'Bent_Over_Barbell_Row',
  nombre: 'Remo con barra',
  material: [{ tipo: 'barra' }],
  claves: concentricaPrimero('r', 0.4),
  concentrica: [[0, 1.0]],
  camara: { azimut: 75, altura: 1.25, distancia: 3.5, objetivo: [0, 0.82, 0] },
  colocar: (p, rig) => {
    const r = p.r!
    const t = rig.aplicarTronco({ pelvis: { pos: [0, 0.86, -0.13], rot: [55, 0, 0] }, columna: [3, 0, 0], cabeza: [-22, 0, 0], claviculas: [0, mezcla(6, -10, r)] })
    const colgada = medio(t).add(V(0, -(0.53 * 0.985 + 0.075), 0.02))
    const arriba = t.pelvis.clone().add(t.pelvisArriba.clone().multiplyScalar(0.25)).add(t.pelvisFrente.clone().multiplyScalar(0.17))
    const barra = colgada.clone().lerp(arriba, r)
    const manos = lados((s) => agarre(barra.clone().add(V(0.25 * s, 0, 0)), V(0, -1, 0.15 * r), V(0, 0, -1), V(0.35 * s, 1, -0.6)))
    const pies = lados((s) => piePlano(0.15 * s, -0.04, s, 10, V(0.25 * s, 0, 1)))
    rig.aplicarExtremos(manos, pies)
    return { barra }
  },
}

const pressMilitar: Definicion3D = {
  id: 'Standing_Military_Press',
  nombre: 'Press militar de pie',
  material: [{ tipo: 'barra' }],
  claves: concentricaPrimero('p', 0.5),
  concentrica: [[0, 1.0]],
  camara: { azimut: 55, altura: 1.55, distancia: 3.9, objetivo: [0, 1.2, 0] },
  colocar: (p, rig) => {
    const k = p.p!
    // La cabeza se aparta mientras la barra pasa por delante de la cara y vuelve debajo al final.
    const t = rig.aplicarTronco({ pelvis: { pos: [0, 0.908, -0.03], rot: [-2, 0, 0] }, columna: [-4, 0, 0], cabeza: [-16 * entre(0.05, 0.3, k) * (1 - entre(0.5, 0.85, k)), 0, 0], claviculas: [mezcla(2, 10, k), 0] })
    const h = medio(t)
    const barra = V(0, h.y + mezcla(0.02, 0.56, k), mezcla(h.z + 0.12, h.z - 0.01, entre(0.35, 0.85, k)))
    const polo = (s: number) => V(mezcla(0.35, 1, k) * s, mezcla(-0.4, 0, k), mezcla(1, 0, k))
    const manos = lados((s) => agarre(barra.clone().add(V(0.25 * s, 0, 0)), V(0, 1, mezcla(0.25, 0, k)), V(0, 0.2, 1), polo(s)))
    const pies = lados((s) => piePlano(0.15 * s, -0.04, s, 10, V(0.2 * s, 0, 1)))
    rig.aplicarExtremos(manos, pies)
    return { barra }
  },
}

const curlMancuernas: Definicion3D = {
  id: 'Dumbbell_Bicep_Curl',
  nombre: 'Curl con mancuernas',
  material: [{ tipo: 'mancuernas' }],
  claves: concentricaPrimero('c', 0.35),
  concentrica: [[0, 1.0]],
  camara: { azimut: 50, altura: 1.35, distancia: 3.2, objetivo: [0, 0.98, 0] },
  colocar: (p, rig) => {
    const c = p.c!
    const t = rig.aplicarTronco({ pelvis: { pos: [0, 0.908, -0.03], rot: [0, 0, 0] }, columna: [0, 0, 0], cabeza: [0, 0, 0], claviculas: [0, -2] })
    const a = rig.longitud('brazo.L', 'antebrazo.L')
    const b = rig.longitud('antebrazo.L', 'mano.L')
    const theta = ((8 + 132 * c) * Math.PI) / 180
    const mancuernas = {} as Record<Lado, { centro: Vector3; eje: Vector3 }>
    const manos = lados((s, lado) => {
      // El codo se queda pegado al costado (solo avanza un poco al final); el antebrazo sube.
      const codo = t.hombro[lado].clone().add(V(0.03 * s, -1, 0.02 + 0.1 * c).normalize().multiplyScalar(a))
      const dir = V(-0.04 * s * c, -Math.cos(theta), Math.sin(theta)).normalize()
      const muneca = codo.clone().add(dir.clone().multiplyScalar(b))
      const palma = perpendicular(V(0, Math.sin(theta), Math.cos(theta)), dir)
      const centro = muneca.clone().add(dir.clone().multiplyScalar(0.075)).add(palma.clone().multiplyScalar(0.025))
      mancuernas[lado] = { centro, eje: new Vector3().crossVectors(dir, palma).normalize() }
      return { pos: t3(muneca), polo: [0.15 * s, 0, -1] as V3, dir: t3(dir), normal: t3(palma) }
    })
    const pies = lados((s) => piePlano(0.14 * s, -0.04, s, 10, V(0.2 * s, 0, 1)))
    rig.aplicarExtremos(manos, pies)
    return { mancuernas }
  },
}

const POLEA_TRICEPS = V(0, 2.0, 0.42)
const tricepsCuerda: Definicion3D = {
  id: 'Triceps_Pushdown_-_Rope_Attachment',
  nombre: 'Extensión de tríceps con cuerda',
  material: [{ tipo: 'polea', pos: [0, 0, 0.5], alturaPolea: 2.0, giroY: Math.PI, agarre: 'cuerda' }],
  claves: concentricaPrimero('e', 0.35),
  concentrica: [[0, 1.0]],
  camara: { azimut: 60, altura: 1.45, distancia: 3.6, objetivo: [0, 1.1, 0.15] },
  colocar: (p, rig) => {
    const e = p.e!
    const t = rig.aplicarTronco({ pelvis: { pos: [0, 0.9, -0.06], rot: [8, 0, 0] }, columna: [7, 0, 0], cabeza: [6, 0, 0], claviculas: [-2, 2] })
    const a = rig.longitud('brazo.L', 'antebrazo.L')
    const b = rig.longitud('antebrazo.L', 'mano.L')
    const theta = ((96 - 96 * e) * Math.PI) / 180
    const agarres: Vector3[] = []
    const manos = lados((s, lado) => {
      const codo = t.hombro[lado].clone().add(t.frente.clone().multiplyScalar(0.12).add(V(0.02 * s, -1, 0)).normalize().multiplyScalar(a))
      const dir = V(0.13 * e * s, -Math.cos(theta), Math.sin(theta)).normalize()
      const muneca = codo.clone().add(dir.clone().multiplyScalar(b))
      const palma = perpendicular(V(-s, 0, -0.4 * e), dir)
      agarres.push(muneca.clone().add(dir.clone().multiplyScalar(0.075)).add(palma.clone().multiplyScalar(0.02)))
      return { pos: t3(muneca), polo: [0.1 * s, 0.2, -1] as V3, dir: t3(dir), normal: t3(palma) }
    })
    const pies = lados((s) => piePlano(0.15 * s, -0.08, s, 10, V(0.2 * s, 0, 1)))
    rig.aplicarExtremos(manos, pies)
    const centro = agarres[0]!.clone().add(agarres[1]!).multiplyScalar(0.5)
    const enganche = centro.clone().add(POLEA_TRICEPS.clone().sub(centro).normalize().multiplyScalar(0.16))
    return { cable: enganche, cuerda: { enganche, manos: [agarres[0]!, agarres[1]!] } }
  },
}

const jalonPecho: Definicion3D = {
  id: 'Wide-Grip_Lat_Pulldown',
  nombre: 'Jalón al pecho agarre ancho',
  material: [{ tipo: 'jalon' }],
  claves: concentricaPrimero('r', 0.4),
  concentrica: [[0, 1.0]],
  camara: { azimut: 55, altura: 1.6, distancia: 4.0, objetivo: [0, 1.2, -0.1] },
  colocar: (p, rig) => {
    const r = p.r!
    const t = rig.aplicarTronco({ pelvis: { pos: [0, 0.6, -0.02], rot: [-4 - 9 * r, 0, 0] }, columna: [-5 * r, 0, 0], cabeza: [-10, 0, 0], claviculas: [mezcla(14, -4, r), mezcla(0, -8, r)] })
    const h = medio(t)
    const arriba = V(0, h.y + 0.53, h.z + 0.06)
    const abajo = V(0, h.y + 0.03, h.z + 0.15)
    const barra = arriba.clone().lerp(abajo, r)
    barra.z += Math.sin(r * Math.PI) * 0.04
    const manos = lados((s) => agarre(barra.clone().add(V(0.42 * s, -0.02 * r, 0)), V(0.12 * s, 1, -0.1), V(0, 0, 1), V(1 * s, -0.3, -0.25)))
    const pies = lados((s) => piePlano(0.16 * s, 0.42, s, 8, V(0.2 * s, 0.3, 1)))
    rig.aplicarExtremos(manos, pies)
    return { barraPolea: barra, cable: barra.clone().add(V(0, 0.03, 0)) }
  },
}

const elevacionesLaterales: Definicion3D = {
  id: 'Side_Lateral_Raise',
  nombre: 'Elevaciones laterales con mancuernas',
  material: [{ tipo: 'mancuernas' }],
  claves: concentricaPrimero('a', 0.3),
  concentrica: [[0, 1.0]],
  camara: { azimut: 25, altura: 1.45, distancia: 3.4, objetivo: [0, 1.05, 0] },
  colocar: (p, rig) => {
    const k = p.a!
    const t = rig.aplicarTronco({ pelvis: { pos: [0, 0.905, -0.04], rot: [5, 0, 0] }, columna: [3, 0, 0], cabeza: [0, 0, 0], claviculas: [3 * k, 0] })
    const largo = (rig.longitud('brazo.L', 'antebrazo.L') + rig.longitud('antebrazo.L', 'mano.L')) * 0.965
    const fi = ((12 + 76 * k) * Math.PI) / 180
    const mancuernas = {} as Record<Lado, { centro: Vector3; eje: Vector3 }>
    const manos = lados((s, lado) => {
      const dir = V(s * Math.sin(fi), -Math.cos(fi), 0.12).normalize()
      const muneca = t.hombro[lado].clone().add(dir.clone().multiplyScalar(largo))
      const palma = perpendicular(V(-s * Math.cos(fi), -Math.sin(fi), 0), dir)
      const centro = muneca.clone().add(dir.clone().multiplyScalar(0.075)).add(palma.clone().multiplyScalar(0.025))
      mancuernas[lado] = { centro, eje: new Vector3().crossVectors(dir, palma).normalize() }
      return { pos: t3(muneca), polo: [0, 0.35, -1] as V3, dir: t3(dir), normal: t3(palma) }
    })
    const pies = lados((s) => piePlano(0.14 * s, -0.04, s, 10, V(0.2 * s, 0, 1)))
    rig.aplicarExtremos(manos, pies)
    return { mancuernas }
  },
}

const hipThrust: Definicion3D = {
  id: 'Barbell_Hip_Thrust',
  nombre: 'Hip thrust con barra',
  material: [{ tipo: 'banco', pos: [0, 0, -0.44], giroY: Math.PI / 2 }, { tipo: 'barra', almohadilla: true }],
  claves: concentricaPrimero('h', 0.5),
  concentrica: [[0, 1.0]],
  camara: { azimut: 70, altura: 1.35, distancia: 3.5, objetivo: [0, 0.45, 0.12] },
  colocar: (p, rig) => {
    const h = p.h!
    // Las escápulas apoyadas en el borde del banco; la cadera sube hasta dejar el tronco horizontal.
    const beta = mezcla(32, -2, h)
    const b = (beta * Math.PI) / 180
    const apoyo = V(0, 0.52, -0.3)
    const torso = 0.46
    const pelvis = apoyo.clone().add(V(0, -Math.sin(b) * torso, Math.cos(b) * torso))
    const t = rig.aplicarTronco({ pelvis: { pos: t3(pelvis), rot: [-90 + beta, 0, 0] }, columna: [0, 0, 0], cabeza: [mezcla(10, 28, h), 0, 0], claviculas: [0, -4] })
    const barra = t.pelvis.clone().add(t.pelvisFrente.clone().multiplyScalar(0.135)).add(t.pelvisArriba.clone().multiplyScalar(-0.05))
    const manos = lados((s) => agarre(barra.clone().add(V(0.33 * s, 0, 0)), V(0, 0, 1), V(0, -1, 0), V(1 * s, 0.5, -0.2)))
    const pies = lados((s) => piePlano(0.2 * s, 0.6, s, 12, V(0.3 * s, 1, 0.1)))
    rig.aplicarExtremos(manos, pies)
    return { barra }
  },
}

export const EJERCICIOS_3D: readonly Definicion3D[] = [
  pressBanca,
  sentadilla,
  pesoMuerto,
  remoConBarra,
  pressMilitar,
  curlMancuernas,
  tricepsCuerda,
  jalonPecho,
  elevacionesLaterales,
  hipThrust,
]

export const definicionPiloto = (id: string): Definicion3D | undefined => EJERCICIOS_3D.find((d) => d.id === id)

// ── Tiempo ─────────────────────────────────────────────────────────────────────────────────

/** Fotogramas de las miniaturas animadas de las listas. */
export const CUADROS_MINIATURA = 16

export const REPETICIONES = 3
export const PAUSA_SERIE = 1.2

/** Duración de una repetición (s). */
export const duracionRep = (d: Definicion3D) => d.claves[d.claves.length - 1]!.t

/** Momento dentro de la repetición para un tiempo global: 3 repeticiones seguidas y una pausa. */
export function momento(d: Definicion3D, t: number): { t: number; rep: number; enPausa: boolean } {
  const rep = duracionRep(d)
  const ciclo = REPETICIONES * rep + PAUSA_SERIE
  const x = ((t % ciclo) + ciclo) % ciclo
  if (x >= REPETICIONES * rep) return { t: 0, rep: REPETICIONES - 1, enPausa: true }
  return { t: x % rep, rep: Math.floor(x / rep), enPausa: false }
}

export const enConcentrica = (d: Definicion3D, t: number) => d.concentrica.some(([a, b]) => t >= a && t <= b)
