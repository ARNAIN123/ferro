// Esqueleto articulado de la figura. Una pose se describe con un "control" (cadera, tronco y a
// dónde van manos y pies) y se resuelve en articulaciones con cinemática inversa. Los controles
// se interpolan entre poses clave, así los pies apoyados no resbalan y la barra sigue su recorrido.
import { angulo, desde, dir, ik, mas, por, type P } from './geometria'

/** Medidas de la figura (unidades SVG; de pie mide unos 160). */
export const L = {
  tronco: 50,
  cuello: 6,
  cabeza: 9.5,
  brazo: 29,
  antebrazo: 26,
  mano: 7,
  muslo: 40,
  tibia: 39,
  pie: 15,
  /** Media anchura de hombros y de caderas en la vista frontal. */
  hombros: 19,
  caderas: 11,
} as const

export const SUELO = 180
/** Altura del tobillo de pie. */
export const TOBILLO = SUELO - 6

/** Dirección "hacia delante" del pecho para un tronco con ángulo `t` (de cadera a hombro). */
export const anterior = (t: number): P => dir(t - 90)

// ── Vista lateral ───────────────────────────────────────────────────────────────────────────

export type Brazo =
  /** La muñeca va a un punto. */
  | { mano: P; doblez?: 1 | -1; muneca?: number }
  /** La muñeca va a un punto relativo al hombro: [hacia delante del pecho, hacia la cabeza]. */
  | { rel: readonly [number, number]; doblez?: 1 | -1; muneca?: number }
  /** Ángulos absolutos del brazo y del antebrazo. */
  | { brazo: number; antebrazo: number; muneca?: number }

export type Pierna =
  /** El tobillo va a un punto; `punta`, si se da, es donde apoyan los dedos (talón levantado). */
  | { tobillo: P; doblez?: 1 | -1; punta?: P }
  /** Ángulos absolutos del muslo, la tibia y el pie (90 = pie plano hacia delante). */
  | { muslo: number; tibia: number; pie?: number }

export interface Control {
  cadera: P
  /** Ángulo del tronco de la cadera al hombro: 180 erguido, 90 inclinado hacia delante en horizontal. */
  tronco: number
  /** Giro de la cabeza respecto al tronco. */
  cabeza?: number
  /** Desplazamiento de los hombros (escápulas): [hacia delante, hacia arriba]. */
  escapula?: readonly [number, number]
  /** [cerca, lejos] */
  brazos: readonly [Brazo, Brazo]
  piernas: readonly [Pierna, Pierna]
}

export interface BrazoResuelto {
  hombro: P
  codo: P
  muneca: P
  /** Punto donde se agarra el material. */
  agarre: P
}
export interface PiernaResuelta {
  cadera: P
  rodilla: P
  tobillo: P
  talon: P
  punta: P
}
export interface PoseLateral {
  vista: 'lateral'
  tronco: number
  cadera: P
  hombro: P
  cabeza: P
  /** Base del cuello. */
  cuello: P
  brazos: [BrazoResuelto, BrazoResuelto]
  piernas: [PiernaResuelta, PiernaResuelta]
}

function resolverBrazo(hombro: P, t: number, b: Brazo): BrazoResuelto {
  let codo: P
  let muneca: P
  if ('brazo' in b) {
    codo = desde(hombro, b.brazo, L.brazo)
    muneca = desde(codo, b.antebrazo, L.antebrazo)
  } else {
    const objetivo = 'mano' in b ? b.mano : mas(hombro, mas(por(anterior(t), b.rel[0]), por(dir(t), b.rel[1])))
    const r = ik(hombro, objetivo, L.brazo, L.antebrazo, b.doblez ?? -1)
    codo = r.medio
    muneca = r.fin
  }
  const ang = angulo(codo, muneca) + (b.muneca ?? 0)
  return { hombro, codo, muneca, agarre: desde(muneca, ang, L.mano * 0.55) }
}

function resolverPierna(cadera: P, p: Pierna): PiernaResuelta {
  let rodilla: P
  let tobillo: P
  let angPie = 90
  if ('muslo' in p) {
    rodilla = desde(cadera, p.muslo, L.muslo)
    tobillo = desde(rodilla, p.tibia, L.tibia)
    angPie = p.pie ?? p.tibia + 90
  } else {
    const r = ik(cadera, p.tobillo, L.muslo, L.tibia, p.doblez ?? 1)
    rodilla = r.medio
    tobillo = r.fin
    if (p.punta) angPie = angulo(tobillo, p.punta)
  }
  const punta = desde(tobillo, angPie, L.pie)
  const talon = mas(desde(tobillo, angPie, -4), por(dir(angPie - 90), -1.5))
  return { cadera, rodilla, tobillo, talon, punta: mas(punta, por(dir(angPie - 90), -1.5)) }
}

export function resolverLateral(c: Control): PoseLateral {
  const u = dir(c.tronco)
  const esc = c.escapula ?? [0, 0]
  const hombro = mas(mas(c.cadera, por(u, L.tronco)), mas(por(anterior(c.tronco), esc[0]), por(u, esc[1])))
  const cuello = mas(c.cadera, por(u, L.tronco + 4))
  const cabeza = desde(cuello, c.tronco + (c.cabeza ?? 0), L.cuello + L.cabeza)
  return {
    vista: 'lateral',
    tronco: c.tronco,
    cadera: c.cadera,
    hombro,
    cuello,
    cabeza,
    brazos: [resolverBrazo(hombro, c.tronco, c.brazos[0]), resolverBrazo(hombro, c.tronco, c.brazos[1])],
    piernas: [resolverPierna(c.cadera, c.piernas[0]), resolverPierna(c.cadera, c.piernas[1])],
  }
}

// ── Vista frontal (y dorsal) ────────────────────────────────────────────────────────────────
// [lado derecho de la imagen, lado izquierdo]. Los ángulos del lado izquierdo van en espejo:
// 90 es "hacia fuera" en los dos lados.

export type BrazoF =
  | { brazo: number; antebrazo: number; escala?: number; escalaAntebrazo?: number }
  | { mano: P; doblez?: 1 | -1 }
export type PiernaF = { muslo: number; tibia: number; escala?: number } | { tobillo: P; doblez?: 1 | -1 }

export interface ControlFrontal {
  /** Centro de la pelvis. */
  cadera: P
  /** Inclinación lateral del tronco: 180 erguido. */
  tronco: number
  /** Escorzo del tronco (1 erguido; menos si se inclina hacia la cámara o se aleja). */
  escalaTronco?: number
  /** Giro del tronco en grados: estrecha los hombros. */
  giro?: number
  /** Hombros arriba (encogimientos). */
  encogimiento?: number
  /** Hombros hacia dentro (escápulas juntas). */
  retraccion?: number
  cabeza?: number
  brazos: readonly [BrazoF, BrazoF]
  piernas: readonly [PiernaF, PiernaF]
}

export interface PoseFrontal {
  vista: 'frontal'
  tronco: number
  cadera: P
  /** Centro de la línea de hombros. */
  centroHombros: P
  cuello: P
  cabeza: P
  caderas: [P, P]
  brazos: [BrazoResuelto, BrazoResuelto]
  piernas: [PiernaResuelta, PiernaResuelta]
}

/** Ángulo de un lado al otro: en el lado izquierdo de la imagen, "hacia fuera" es hacia la izquierda. */
const lado = (a: number, i: number) => (i === 0 ? a : -a)

export function resolverFrontal(c: ControlFrontal): PoseFrontal {
  const u = dir(c.tronco)
  const lateral = dir(c.tronco - 90) // hacia la derecha de la imagen con el tronco erguido
  const ancho = L.hombros * Math.cos(((c.giro ?? 0) * Math.PI) / 180) - (c.retraccion ?? 0)
  const centroHombros = mas(c.cadera, por(u, L.tronco * (c.escalaTronco ?? 1)))
  const arriba = por(u, c.encogimiento ?? 0)
  const hombros: [P, P] = [mas(mas(centroHombros, por(lateral, ancho)), arriba), mas(mas(centroHombros, por(lateral, -ancho)), arriba)]
  const caderas: [P, P] = [mas(c.cadera, por(lateral, L.caderas)), mas(c.cadera, por(lateral, -L.caderas))]
  const cuello = mas(centroHombros, por(u, 4))
  const cabeza = desde(cuello, c.tronco + (c.cabeza ?? 0), L.cuello + L.cabeza)

  const brazos = c.brazos.map((b, i): BrazoResuelto => {
    const hombro = hombros[i]!
    let codo: P
    let muneca: P
    if ('brazo' in b) {
      codo = desde(hombro, lado(b.brazo, i), L.brazo * (b.escala ?? 1))
      muneca = desde(codo, lado(b.antebrazo, i), L.antebrazo * (b.escalaAntebrazo ?? b.escala ?? 1))
    } else {
      const r = ik(hombro, b.mano, L.brazo, L.antebrazo, ((b.doblez ?? 1) * (i === 0 ? 1 : -1)) as 1 | -1)
      codo = r.medio
      muneca = r.fin
    }
    return { hombro, codo, muneca, agarre: desde(muneca, angulo(codo, muneca), L.mano * 0.55) }
  }) as [BrazoResuelto, BrazoResuelto]

  const piernas = c.piernas.map((p, i): PiernaResuelta => {
    const cadera = caderas[i]!
    let rodilla: P
    let tobillo: P
    if ('muslo' in p) {
      rodilla = desde(cadera, lado(p.muslo, i), L.muslo * (p.escala ?? 1))
      tobillo = desde(rodilla, lado(p.tibia, i), L.tibia * (p.escala ?? 1))
    } else {
      const r = ik(cadera, p.tobillo, L.muslo, L.tibia, ((p.doblez ?? 1) * (i === 0 ? 1 : -1)) as 1 | -1)
      rodilla = r.medio
      tobillo = r.fin
    }
    // De frente el pie se ve corto, apuntando un poco hacia fuera.
    const fuera = i === 0 ? 1 : -1
    return { cadera, rodilla, tobillo, talon: mas(tobillo, [-2 * fuera, 4]), punta: mas(tobillo, [6 * fuera, 5]) }
  }) as [PiernaResuelta, PiernaResuelta]

  return { vista: 'frontal', tronco: c.tronco, cadera: c.cadera, centroHombros, cuello, cabeza, caderas, brazos, piernas }
}

// ── Interpolación de controles ──────────────────────────────────────────────────────────────

type Valor = number | readonly Valor[] | { readonly [k: string]: Valor | undefined }

/** Interpola dos controles con la misma forma (números, puntos y objetos anidados). */
export function interpolar<T>(a: T, b: T, t: number): T {
  return mezclar(a as Valor, b as Valor, t) as T
}

function mezclar(a: Valor, b: Valor, t: number): Valor {
  if (typeof a === 'number') {
    if (typeof b !== 'number') throw new Error('Controles con distinta forma')
    return a + (b - a) * t
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) throw new Error('Controles con distinta forma')
    return a.map((x, i) => mezclar(x as Valor, b[i] as Valor, t))
  }
  const oa = a as { readonly [k: string]: Valor | undefined }
  const ob = b as { readonly [k: string]: Valor | undefined }
  const r: Record<string, Valor> = {}
  for (const k of new Set([...Object.keys(oa), ...Object.keys(ob)])) {
    const x = oa[k] ?? (k === 'doblez' ? ob[k] : DEFECTO[k])
    const y = ob[k] ?? (k === 'doblez' ? oa[k] : DEFECTO[k])
    if (x === undefined && y === undefined) continue
    if (x === undefined || y === undefined) throw new Error(`Controles con distinta forma: ${k}`)
    r[k] = mezclar(x, y, t)
  }
  return r
}

/** Valor de los campos opcionales cuando una pose clave no los da. */
const DEFECTO: Record<string, Valor> = {
  escala: 1,
  escalaAntebrazo: 1,
  escalaTronco: 1,
  muneca: 0,
  cabeza: 0,
  giro: 0,
  encogimiento: 0,
  retraccion: 0,
  escapula: [0, 0],
}
