// Animaciones 3D de toda la biblioteca a partir de las poses 2D que ya tiene cada ejercicio
// (src/animacion): cada pose 2D se lleva al cuerpo 3D. Del plano del dibujo salen la altura y la
// profundidad (vista lateral) o la anchura (vista frontal); lo que falta se reconstruye:
//   · vista lateral: la anchura del agarre y de los pies, según la carga y el ejercicio;
//   · vistas frontal, dorsal y cenital: la profundidad, con el escorzo de cada segmento (si un
//     brazo se ve corto es que va hacia delante, hacia atrás o hacia arriba).
// Los brazos y las piernas se colocan con la cinemática inversa del rig, así siempre tienen sus
// longitudes reales. El tempo sale solo: la fase concéntrica es la que sube la carga (o la que aleja
// las manos de la polea) y dura 1 s; la excéntrica, 2 s.
import { Vector3 } from 'three'
import { asignarAnimacion, type EjercicioAnimable } from '../animacion/asignacion'
import type { Equipo } from '../animacion/dibujo'
import { interpolar as mezclar2D, L, resolverFrontal, resolverLateral, SUELO, type Control, type ControlFrontal, type PoseFrontal, type PoseLateral } from '../animacion/esqueleto'
import type { P } from '../animacion/geometria'
import type { Animacion } from '../animacion/patrones'
import type { Material } from '../domain/tipos'
import type { Definicion3D, EstadoMaterial, Parametros, Pieza } from './ejercicios'
import { perpendicular, type Clave, type V3 } from './ik'
import type { Extremo, Lado, Rig } from './rig'

/** Metros por unidad del dibujo 2D (la pierna 2D mide 79 y la 3D 0,8 m). */
const K = 0.0099
/** Pelvis tumbada en la vista cenital (como en el press de banca). */
const CENITAL = { y: 0.55, z: 0.15, caderaY: 128 }

type Vista = 'lateral' | 'frontal' | 'dorsal' | 'cenital'
type Agarre = 'prono' | 'supino' | 'neutro'

export interface Ajustes2D {
  /** Media anchura del agarre (m). */
  ancho: number
  /** Media separación de los tobillos (m). */
  anchoPies: number
  agarre: Agarre
  dedos: number
  /** Tipo de agarre de la polea. */
  enganche: 'cuerda' | 'recta' | 'triangulo' | 'estribo' | 'jalon'
  /**
   * Inclinación del tronco (grados, + hacia delante) en las vistas de frente y de espalda cuando el
   * escorzo del dibujo no basta: el dibujo acorta poco el tronco para que se lea bien.
   */
  inclinacion: number | null
  /** Sentado en un banco (en las vistas de frente y de espalda, los pies van delante). */
  sentado: boolean
}

const texto = (e: EjercicioAnimable) =>
  `${e.id} ${e.nombre}`
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Anchura del agarre y de los pies, tipo de agarre y agarre de polea de cada ejercicio. */
export function ajustesDe(e: EjercicioAnimable, a: Animacion): Ajustes2D {
  const t = texto(e)
  const p = a.patron
  const m: Material = e.material
  let ancho = 0.25
  if (m === 'barra' || m === 'barra_z' || m === 'multipower') {
    if (/press (banco|inclinado|declinado|suelo)/.test(p)) ancho = /close|cerrad|jm press|tate/.test(t) ? 0.19 : /wide|ancho/.test(t) ? 0.44 : 0.38
    else if (/sentadilla|zancada|bulgara|búlgara|subida|gemelos|buenos días|envión|push press|equilibrio/.test(p)) ancho = 0.36
    else if (/arrancada/.test(p)) ancho = 0.55
    else if (/pullover/.test(p)) ancho = 0.2
    else if (/extensión|curl|muñeca/.test(p)) ancho = /wide|ancho/.test(t) ? 0.26 : 0.17
    else if (/encogimiento|remo al mentón/.test(p)) ancho = /upright|menton/.test(t) ? 0.14 : 0.26
  } else if (m === 'barra_hexagonal') ancho = 0.29
  else if (m === 'mancuernas') ancho = /press/.test(p) ? 0.27 : 0.21
  else if (m === 'polea') ancho = /^jalón$/.test(p) ? 0.42 : /face pull/.test(p) ? 0.14 : 0.11
  else if (m === 'discos') ancho = 0.13
  else if (m === 'landmine') ancho = 0.05
  const anchoPies = /sumo/.test(t) ? 0.33 : /sentadilla(?! búlgara)|halterofilia|envión|peso muerto|push press/.test(p) ? 0.17 : /zancada|búlgara|subida/.test(p) ? 0.12 : 0.14
  let agarre: Agarre = 'prono'
  if (/hammer|martillo|neutral|rope|cuerda|v ?bar|triangle|triangulo|farmer|granjero|paseo/.test(t)) agarre = 'neutro'
  else if (/^curl|curl /.test(p) && !/reverse|inverso|zottman|pronad|prono|muneca|femoral/.test(t)) agarre = 'supino'
  else if (/chin|underhand|reverse grip|supin|palms? up|agarre supino/.test(t)) agarre = 'supino'
  const enganche = /rope|cuerda/.test(t) ? 'cuerda' : /v ?bar|triangle|triangulo/.test(t) ? 'triangulo' : /^jalón$|pulldown|jalon/.test(`${p} ${t}`) && !/straight arm|brazos rectos/.test(t) ? 'jalon' : /one arm|una mano|single|crossover|fly|flye|lateral|kickback|patada|rotation|rotacion|pallof|abduc|aduc|bayes/.test(t) ? 'estribo' : 'recta'
  const sentado = a.equipo.some((q) => q.tipo === 'banco')
  const inclinacion = p === 'giros rusos' ? -42 : p === 'pájaros' ? (sentado ? 62 : 72) : p === 'retracción escapular' ? 66 : null
  return { ancho, anchoPies, agarre, dedos: m === 'polea' || a.equipo.some((q) => q.tipo !== 'banco' && q.tipo !== 'caja') ? 0.85 : 0.3, enganche, inclinacion, sentado }
}

// ── Del dibujo al espacio ──────────────────────────────────────────────────────────────────

/** Punto del dibujo en 3D; `falta` es la coordenada que el dibujo no tiene. */
function punto(v: Vista, p: P, falta = 0): Vector3 {
  switch (v) {
    case 'lateral':
      return new Vector3(falta, (SUELO - p[1]) * K, (p[0] - 100) * K)
    case 'frontal':
      return new Vector3((p[0] - 100) * K, (SUELO - p[1]) * K, falta)
    case 'dorsal':
      return new Vector3(-(p[0] - 100) * K, (SUELO - p[1]) * K, falta)
    case 'cenital':
      return new Vector3((p[0] - 100) * K, falta, CENITAL.z + (p[1] - CENITAL.caderaY) * K)
  }
}

/** Dirección 3D de un segmento del dibujo; con su longitud real, recupera la profundidad del escorzo. */
function direccion(v: Vista, a: P, b: P, largo = 0): Vector3 {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const prof = largo > 0 ? Math.sqrt(Math.max(0, largo * largo - dx * dx - dy * dy)) : 0
  const d =
    v === 'lateral'
      ? new Vector3(0, -dy, dx)
      : v === 'frontal'
        ? new Vector3(dx, -dy, prof)
        : v === 'dorsal'
          ? new Vector3(-dx, -dy, -prof)
          : new Vector3(dx, prof, dy)
  return d.lengthSq() > 1e-9 ? d.normalize() : new Vector3(0, -1, 0)
}

const t3 = (p: Vector3): V3 => [p.x, p.y, p.z]

/** Acorta la parte del plano del dibujo para que un miembro llegue (la anchura se respeta). */
function alcanzable(raiz: Vector3, objetivo: Vector3, largo: number, ejeFijo: 'x' | 'z' | 'y' | null): Vector3 {
  const d = objetivo.clone().sub(raiz)
  const max = largo * 0.985
  if (d.length() <= max || !ejeFijo) return d.length() <= max ? objetivo : raiz.clone().add(d.setLength(max))
  const fijo = d[ejeFijo]
  const resto = Math.sqrt(Math.max(0, max * max - fijo * fijo))
  const plano = d.clone()
  plano[ejeFijo] = 0
  if (plano.length() > 1e-6) plano.setLength(Math.min(plano.length(), resto))
  plano[ejeFijo] = Math.abs(fijo) > max ? Math.sign(fijo) * max : fijo
  return raiz.clone().add(plano)
}

function palma(agarre: Agarre, dir: Vector3, s: number): Vector3 {
  const x = new Vector3(1, 0, 0)
  if (agarre === 'neutro') return perpendicular(new Vector3(-s, 0, 0), dir, new Vector3().crossVectors(x, dir))
  const n = new Vector3().crossVectors(x, dir)
  if (n.lengthSq() < 1e-4) return perpendicular(new Vector3(0, -1, 0), dir)
  return (agarre === 'prono' ? n : n.negate()).normalize()
}

interface Pose2D {
  vista: Vista
  pose: PoseLateral | PoseFrontal
  control: Control | ControlFrontal
}

/** Lado del cuerpo de cada brazo o pierna del dibujo. */
function ladoDe(v: Vista, i: number): Lado {
  if (v === 'dorsal') return i === 0 ? 'R' : 'L'
  return i === 0 ? 'L' : 'R'
}

/** Tronco 3D (pelvis, columna, cabeza, clavículas) de una pose 2D. */
function tronco(p: Pose2D, aj: Ajustes2D) {
  if (p.vista === 'lateral') {
    const c = p.control as Control
    const pitch = 180 - c.tronco
    const r = (pitch * Math.PI) / 180
    // La cadera del dibujo es la línea de las caderas; la pelvis 3D está un poco más arriba y atrás.
    const caderas = punto('lateral', c.cadera)
    const arriba = new Vector3(0, Math.cos(r), Math.sin(r))
    const frente = new Vector3(0, -Math.sin(r), Math.cos(r))
    const pelvis = caderas.add(arriba.multiplyScalar(0.062)).add(frente.multiplyScalar(-0.026))
    const esc = c.escapula ?? [0, 0]
    return { pelvis: { pos: t3(pelvis), rot: [pitch, 0, 0] as V3 }, columna: [0, 0, 0] as V3, cabeza: [-(c.cabeza ?? 0), 0, 0] as V3, claviculas: [esc[1] * 2.5, esc[0] * 2.5] as const }
  }
  const c = p.control as ControlFrontal
  const escorzo = Math.acos(Math.min(1, Math.max(0, c.escalaTronco ?? 1))) * (180 / Math.PI)
  if (p.vista === 'cenital') {
    const inclinado = escorzo
    const cad = punto('cenital', c.cadera, CENITAL.y)
    return { pelvis: { pos: t3(cad), rot: [-90 + inclinado, 0, 0] as V3 }, columna: [0, 0, 0] as V3, cabeza: [8, 0, 0] as V3, claviculas: [0, -6] as const }
  }
  const inclinado = aj.inclinacion ?? escorzo
  const signo = p.vista === 'dorsal' ? -1 : 1
  const cad = punto(p.vista, c.cadera, -0.035).add(new Vector3(0, 0.062, 0))
  return {
    pelvis: { pos: t3(cad), rot: [inclinado, 0, 0] as V3 },
    columna: [0, (c.tronco - 180) * signo, (c.giro ?? 0) * signo] as V3,
    cabeza: [0, (c.cabeza ?? 0) * signo, 0] as V3,
    claviculas: [(c.encogimiento ?? 0) * 3, -(c.retraccion ?? 0) * 3] as const,
  }
}

interface Resuelto {
  manos: Record<Lado, Extremo>
  pies: Record<Lado, Extremo>
  agarres: Record<Lado, Vector3>
  tobillos: Record<Lado, Vector3>
}

function extremos(p: Pose2D, rig: Rig, aj: Ajustes2D): Resuelto {
  const v = p.vista
  const manos = {} as Record<Lado, Extremo>
  const pies = {} as Record<Lado, Extremo>
  const agarres = {} as Record<Lado, Vector3>
  const tobillos = {} as Record<Lado, Vector3>
  p.pose.brazos.forEach((b, i) => {
    const lado = ladoDe(v, i)
    const s = lado === 'L' ? 1 : -1
    const S = rig.pos(`brazo.${lado}`)
    const a3 = rig.longitud(`brazo.${lado}`, `antebrazo.${lado}`)
    const b3 = rig.longitud(`antebrazo.${lado}`, `mano.${lado}`)
    const codo = S.clone().add(direccion(v, b.hombro, b.codo, L.brazo).multiplyScalar(a3))
    let muneca = codo.clone().add(direccion(v, b.codo, b.muneca, L.antebrazo).multiplyScalar(b3))
    if (v === 'lateral') {
      muneca.x = s * aj.ancho
      muneca = alcanzable(S, muneca, a3 + b3, 'x')
    } else muneca = alcanzable(S, muneca, a3 + b3, null)
    const medio = S.clone().add(muneca).multiplyScalar(0.5)
    const polo = codo.clone().sub(medio)
    if (polo.lengthSq() < 1e-6) polo.set(0, -0.3, -1)
    polo.normalize().add(new Vector3(s * (v === 'lateral' ? 0.35 : 0.1), 0, 0))
    const dir = direccion(v, b.muneca, b.agarre)
    const n = palma(aj.agarre, dir, s)
    manos[lado] = { pos: t3(muneca), polo: t3(polo), dir: t3(dir), normal: t3(n) }
    agarres[lado] = muneca.clone().add(dir.clone().multiplyScalar(0.075)).add(n.clone().multiplyScalar(0.025))
  })
  p.pose.piernas.forEach((q, i) => {
    const lado = ladoDe(v, i)
    const s = lado === 'L' ? 1 : -1
    const C = rig.pos(`muslo.${lado}`)
    const a3 = rig.longitud(`muslo.${lado}`, `pierna.${lado}`)
    const b3 = rig.longitud(`pierna.${lado}`, `pie.${lado}`)
    let tobillo: Vector3
    let polo: Vector3
    let dirPie: Vector3
    if (v === 'cenital') {
      // Tumbado: los pies, apoyados en el suelo delante del banco.
      tobillo = new Vector3(0.26 * s, 0.066, C.z + 0.42)
      polo = new Vector3(0.35 * s, 1, 0.15)
      dirPie = new Vector3(0.3 * s, -0.36, 0.93)
    } else {
      const rodilla = C.clone().add(direccion(v, q.cadera, q.rodilla, L.muslo).multiplyScalar(a3))
      tobillo = rodilla.clone().add(direccion(v, q.rodilla, q.tobillo, L.tibia).multiplyScalar(b3))
      if (v === 'lateral') {
        tobillo.x = s * aj.anchoPies
        tobillo = alcanzable(C, tobillo, a3 + b3, 'x')
      } else {
        // De frente el dibujo dobla la rodilla hacia fuera (no puede hacerlo hacia delante); sentado,
        // además, los pies van delante del banco, con la rodilla en ángulo recto.
        if (aj.sentado) tobillo.z = C.z + a3 * 0.95
        tobillo = alcanzable(C, tobillo, a3 + b3, null)
      }
      if (tobillo.y < 0.06) tobillo.y = 0.06
      const medio = C.clone().add(tobillo).multiplyScalar(0.5)
      polo = rodilla.clone().sub(medio)
      if (v !== 'lateral' && (aj.sentado || Math.abs(polo.z) < 0.6 * polo.length())) polo.set(s * 0.3, aj.sentado ? 0.6 : 0, 1)
      if (polo.lengthSq() < 1e-6) polo.set(0, 0, 1)
      polo.normalize().add(new Vector3(s * 0.25, 0, 0))
      dirPie = direccion(v, q.tobillo, q.punta)
      if (v === 'lateral') dirPie.x = s * 0.18
      if (v !== 'lateral' && Math.abs(dirPie.z) < 0.5) dirPie = new Vector3(0.18 * s, -0.36, 0.93)
      dirPie.normalize()
    }
    pies[lado] = { pos: t3(tobillo), polo: t3(polo), dir: t3(dirPie), normal: t3(perpendicular(new Vector3(0, 1, 0), dirPie)) }
    tobillos[lado] = tobillo
  })
  return { manos, pies, agarres, tobillos }
}

// ── Material ───────────────────────────────────────────────────────────────────────────────

function piezas(a: Animacion, e: EjercicioAnimable, aj: Ajustes2D, v: Vista): { piezas: Pieza[]; cables: { anclaje: Vector3; a: 'manos' | 'mano0' | 'mano1' | 'tobillo0' | 'mano_otra' }[] } {
  const r: Pieza[] = []
  const cables: { anclaje: Vector3; a: 'manos' | 'mano0' | 'mano1' | 'tobillo0' | 'mano_otra' }[] = []
  const lateral = v === 'lateral'
  const prof = (q: P, falta: number) => punto(v, q, falta)
  for (const q of a.equipo as readonly Equipo[]) {
    switch (q.tipo) {
      case 'barra':
        if (e.material === 'barra_hexagonal') r.push({ tipo: 'hexagonal' })
        else r.push({ tipo: 'barra', radioDisco: q.discos === 'pequenos' || e.material === 'barra_z' ? 0.13 : 0.225 })
        break
      case 'mancuernas':
        r.push({ tipo: 'mancuernas', manos: q.manos ? q.manos.map((i) => ladoDe(v, i)) : undefined })
        break
      case 'disco':
        r.push({ tipo: 'disco' })
        break
      case 'multipower':
        r.push({ tipo: 'multipower' })
        break
      case 'landmine':
        r.push({ tipo: 'landmine', pivote: t3(prof(q.pivote, 0)) })
        break
      case 'caja': {
        const a1 = prof([q.x, q.y], 0)
        const a2 = prof([q.x + q.ancho, SUELO], 0)
        r.push({ tipo: 'caja', centro: [0, a1.y / 2, (a1.z + a2.z) / 2], tam: [0.5, a1.y, Math.abs(a2.z - a1.z)] })
        break
      }
      case 'rodillo':
        r.push({ tipo: 'rodillo' })
        break
      case 'banco': {
        const alto = v === 'cenital' ? 0.45 : 0
        const seg = (s: readonly [P, P]): [V3, V3] => [t3(prof(s[0], alto)), t3(prof(s[1], alto))]
        if (lateral || v === 'cenital') r.push({ tipo: 'bancoLibre', asiento: seg(q.asiento), respaldo: q.respaldo ? seg(q.respaldo) : undefined, patas: q.patas !== false })
        else {
          // De frente o de espalda el dibujo solo da la altura del asiento: va de atrás adelante.
          const y = (SUELO - Math.min(q.asiento[0][1], q.asiento[1][1])) * K
          r.push({ tipo: 'bancoLibre', asiento: [[0, y, -0.3], [0, y, 0.22]], patas: true })
        }
        break
      }
      case 'polea': {
        const anclaje = prof(q.anclaje, lateral ? 0 : -0.15)
        cables.push({ anclaje, a: q.a ?? 'manos' })
        r.push({ tipo: 'torre', salida: t3(anclaje) })
        if (q.anclaje2) {
          const otro = prof(q.anclaje2, lateral ? 0 : -0.15)
          cables.push({ anclaje: otro, a: 'mano_otra' })
          r.push({ tipo: 'torre', salida: t3(otro) })
        }
        break
      }
    }
  }
  if (cables.length) {
    for (const c of cables) r.push({ tipo: 'agarrePolea', agarre: c.a === 'tobillo0' ? 'tobillera' : cables.length > 1 ? 'estribo' : aj.enganche })
  }
  return { piezas: r, cables }
}

// ── Tiempo ─────────────────────────────────────────────────────────────────────────────────

/** Cuánto "sube" la carga en una pose (más = más arriba o más lejos de la polea). */
function carga(a: Animacion, p: PoseLateral | PoseFrontal): number {
  const polea = a.equipo.find((q) => q.tipo === 'polea')
  const manos = p.brazos.map((b) => b.agarre)
  if (polea && polea.tipo === 'polea') {
    const destino = polea.a === 'tobillo0' ? p.piernas[0].tobillo : polea.a === 'mano1' ? manos[1]! : manos[0]!
    return Math.hypot(destino[0] - polea.anclaje[0], destino[1] - polea.anclaje[1])
  }
  const lleva = a.equipo.some((q) => q.tipo === 'barra' || q.tipo === 'mancuernas' || q.tipo === 'disco' || q.tipo === 'landmine' || q.tipo === 'multipower')
  if (lleva) return -(manos[0]![1] + manos[1]![1]) / 2
  return -(p.cadera[1] + (p.vista === 'lateral' ? p.hombro[1] : p.centroHombros[1])) / 2
}

function resolver(a: Animacion, c: Control | ControlFrontal) {
  return a.vista === 'lateral' ? resolverLateral(c as Control) : resolverFrontal(c as ControlFrontal)
}

/**
 * Claves de una repetición con el parámetro `s` (posición en la secuencia de poses 2D): con dos
 * poses, sube en 1 s y baja en 2 s (en el orden que toque); con más, las recorre en orden.
 */
function lineaDeTiempo(a: Animacion): { claves: Clave<Parametros>[]; concentrica: [number, number][] } {
  const n = a.claves.length
  const alturas = a.claves.map((c) => carga(a, resolver(a, c)))
  if (n === 2) {
    const sube = alturas[1]! >= alturas[0]!
    const k = (t: number, s: number) => ({ t, p: { s } })
    if (sube)
      return {
        claves: [k(0, 0), k(0.3, 0), k(0.65, 0.42), k(1.0, 0.85), k(1.3, 1), k(1.75, 1), k(2.45, 0.62), k(3.15, 0.2), k(3.75, 0), k(4.0, 0)],
        concentrica: [[0.3, 1.3]],
      }
    return {
      claves: [k(0, 0), k(0.4, 0), k(1.1, 0.38), k(1.8, 0.8), k(2.4, 1), k(2.7, 1), k(3.2, 0.5), k(3.7, 0), k(4.0, 0)],
      concentrica: [[2.7, 3.7]],
    }
  }
  const claves: Clave<Parametros>[] = []
  const concentrica: [number, number][] = []
  let t = 0
  for (let i = 0; i < n; i++) {
    claves.push({ t, p: { s: i } })
    t += 0.25
    claves.push({ t, p: { s: i } })
    const siguiente = (i + 1) % n
    const dur = alturas[siguiente]! > alturas[i]! ? 1.0 : 1.4
    if (alturas[siguiente]! > alturas[i]!) concentrica.push([t, t + dur])
    t += dur
  }
  claves.push({ t, p: { s: n } })
  return { claves, concentrica }
}

// ── Definición ─────────────────────────────────────────────────────────────────────────────

export function definicionDesde2D(e: EjercicioAnimable): Definicion3D {
  const a = asignarAnimacion(e).animacion
  const v = a.vista as Vista
  const aj = ajustesDe(e, a)
  const { piezas: material, cables } = piezas(a, e, aj, v)
  const { claves, concentrica } = lineaDeTiempo(a)
  const n = a.claves.length

  const pose2D = (s: number): Pose2D => {
    const i = Math.floor(s) % n
    const f = s - Math.floor(s)
    const control = f < 1e-6 ? a.claves[i]! : mezclar2D(a.claves[i]!, a.claves[(i + 1) % n]!, f)
    return { vista: v, pose: resolver(a, control), control }
  }

  const p0 = pose2D(0)
  const tumbado = v === 'cenital' || (v === 'lateral' && Math.abs(Math.cos((((p0.control as Control).tronco - 180) * Math.PI) / 180)) < 0.5)
  const azimut = v === 'lateral' ? 62 : v === 'frontal' ? 25 : v === 'dorsal' ? 205 : 40
  const camara = v === 'cenital' ? { azimut, altura: 1.7, distancia: 3.6, objetivo: [0, 0.6, CENITAL.z - 0.1] as V3 } : encuadre(a, v, azimut, tumbado, aj)

  return {
    id: e.id,
    nombre: e.nombre,
    material,
    claves,
    concentrica,
    camara,
    colocar: (p, rig) => {
      const q = pose2D(p.s!)
      const tr = tronco(q, aj)
      rig.aplicarTronco(tr)
      const r = extremos(q, rig, aj)
      rig.aplicarExtremos(r.manos, r.pies, aj.dedos)
      return estadoMaterial(material, r, cables)
    },
  }
}

/**
 * Cámara que encuadra el cuerpo entero en todas las poses (de los pies a la cabeza o a las manos,
 * y de delante atrás si está tumbado), para que no se corte nada en la ficha ni en las miniaturas.
 */
function encuadre(a: Animacion, v: Vista, azimut: number, tumbado: boolean, aj: Ajustes2D): Definicion3D['camara'] {
  let arriba = -Infinity
  let abajo = Infinity
  let delante = -Infinity
  let detras = Infinity
  for (const c of a.claves) {
    const q = resolver(a, c)
    const puntos: P[] = [q.cabeza, q.cadera, ...q.brazos.flatMap((b) => [b.codo, b.agarre]), ...q.piernas.flatMap((p) => [p.rodilla, p.tobillo, p.punta])]
    for (const p of puntos) {
      const y = (SUELO - p[1]) * K
      arriba = Math.max(arriba, y)
      abajo = Math.min(abajo, y)
      if (v === 'lateral') {
        const z = (p[0] - 100) * K
        delante = Math.max(delante, z)
        detras = Math.min(detras, z)
      }
    }
  }
  arriba += 0.12 // de la cabeza (su centro) a la coronilla
  // Con el tronco más inclinado que en el dibujo, la cabeza queda más baja.
  if ((aj.inclinacion ?? 0) > 30) arriba -= 0.15
  abajo = Math.max(0, abajo - 0.06)
  const alto = arriba - abajo
  const ancho = v === 'lateral' ? (delante - detras) * Math.sin((azimut * Math.PI) / 180) : 0.7
  // Con el campo de 30° caben 2·tan(15°) ≈ 0,536 m por metro de distancia.
  const distancia = Math.min(4.6, Math.max(3.3, (Math.max(alto, ancho) + 0.3) / 0.536))
  const z = v === 'lateral' ? (delante + detras) / 2 : 0
  // Un poco por debajo del centro: abajo están los botones de la vista y la cámara mira desde arriba.
  return { azimut, altura: tumbado ? 1.7 : 1.45, distancia, objetivo: [0, (arriba + abajo) / 2 - 0.06, z] }
}

function estadoMaterial(material: readonly Pieza[], r: Resuelto, cables: { anclaje: Vector3; a: string }[]): EstadoMaterial {
  const e: EstadoMaterial = {}
  const centro = r.agarres.L.clone().add(r.agarres.R).multiplyScalar(0.5)
  const eje = (l: Lado) => {
    const m = r.manos[l]
    return new Vector3().crossVectors(new Vector3(...m.dir), new Vector3(...m.normal)).normalize()
  }
  for (const p of material) {
    if (p.tipo === 'barra' || p.tipo === 'hexagonal') e.barra = centro.clone()
    if (p.tipo === 'multipower') e.multipower = centro.clone()
    if (p.tipo === 'mancuernas') {
      const lados = p.manos ?? (['L', 'R'] as Lado[])
      e.mancuernas = Object.fromEntries(lados.map((l) => [l, { centro: r.agarres[l].clone(), eje: eje(l) }])) as EstadoMaterial['mancuernas']
    }
    if (p.tipo === 'disco') e.disco = { centro: centro.clone(), eje: new Vector3().crossVectors(r.agarres.L.clone().sub(r.agarres.R), new Vector3(0, 1, 0)).normalize() }
    if (p.tipo === 'landmine') e.landmine = { pivote: new Vector3(...p.pivote), mano: centro.clone() }
    if (p.tipo === 'rodillo') e.rodillo = centro.clone()
  }
  if (cables.length) {
    e.cables = cables.map((c, i) => {
      const destino = c.a === 'tobillo0' ? r.tobillos.L : c.a === 'mano0' ? r.agarres.L : c.a === 'mano1' || c.a === 'mano_otra' ? (cables.length > 1 && i === 0 ? r.agarres.L : r.agarres.R) : centro
      return { salida: c.anclaje.clone(), enganche: destino.clone() }
    })
    e.agarresPolea = cables.map((c, i) => ({ centro: e.cables![i]!.enganche.clone(), manos: c.a === 'manos' ? ([r.agarres.L.clone(), r.agarres.R.clone()] as [Vector3, Vector3]) : undefined }))
  }
  return e
}
