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
  /**
   * Las dos manos en el mismo agarre (de frente, cuando el dibujo las junta en todas las poses: un
   * leñador, unos giros rusos con un disco…): se llevan juntas al mismo punto.
   */
  manosJuntas: boolean
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
  // Solo con material de un agarre (polea con un cable a las dos manos, disco, landmine, rueda).
  const unAgarre = a.equipo.some((q) => q.tipo === 'disco' || q.tipo === 'landmine' || q.tipo === 'rodillo' || (q.tipo === 'polea' && !q.anclaje2 && (q.a ?? 'manos') === 'manos'))
  // Un estribo para las dos manos (press Pallof): solo tiene un asa, así que van juntas siempre.
  const manosJuntas =
    unAgarre &&
    ((enganche === 'estribo' && a.equipo.some((q) => q.tipo === 'polea')) ||
      (a.vista !== 'lateral' &&
        a.claves.every((c) => {
          const [b0, b1] = resolver(a, c).brazos
          return Math.hypot(b0.agarre[0] - b1.agarre[0], b0.agarre[1] - b1.agarre[1]) < 22
        })))
  return { ancho, anchoPies, agarre, dedos: m === 'polea' || a.equipo.some((q) => q.tipo !== 'banco' && q.tipo !== 'caja') ? 0.85 : 0.3, enganche, inclinacion, sentado, manosJuntas }
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

function extremos(p: Pose2D, rig: Rig, aj: Ajustes2D, elevar = 0, escalones: readonly Escalon[] = []): Resuelto {
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
    muneca.y += elevar
    manos[lado] = { pos: t3(muneca), polo: t3(polo), dir: t3(dir), normal: t3(n) }
    agarres[lado] = muneca.clone().add(dir.clone().multiplyScalar(0.075)).add(n.clone().multiplyScalar(0.025))
  })
  if (aj.manosJuntas) {
    // Las dos manos en el mismo agarre: al punto medio, una a cada lado.
    const medio = agarres.L.clone().add(agarres.R).multiplyScalar(0.5)
    for (const lado of ['L', 'R'] as const) {
      const m = manos[lado]
      const dir = new Vector3(...m.dir)
      const n = new Vector3(...m.normal)
      agarres[lado] = medio.clone().add(new Vector3(lado === 'L' ? 0.045 : -0.045, 0, 0))
      m.pos = t3(agarres[lado].clone().sub(dir.multiplyScalar(0.075)).sub(n.multiplyScalar(0.025)))
    }
  }
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
      // Al subir al cajón, el pie pasa por encima de la tapa (el dibujo lo lleva en línea recta).
      // Primero sube y luego avanza: en los primeros 6 cm hacia el cajón ya ha subido a su altura.
      for (const e of escalones) {
        if (e.lado !== lado || Math.abs(tobillo.x - e.x) > e.medio + 0.05 || tobillo.z - 0.05 > e.z1) continue
        const k = Math.min(1, Math.max(0, (tobillo.z + 0.17 - e.inicio) / 0.06))
        const sube = k * k * (3 - 2 * k)
        tobillo.y = Math.max(tobillo.y, tobillo.y + (e.arriba + 0.075 - tobillo.y) * sube)
      }
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

/** A qué va cada cable: a las dos manos (un agarre entre ellas), a una mano o a un tobillo. */
type Destino = 'manos' | { mano: Lado } | { tobillo: Lado }
interface Cable {
  anclaje: Vector3
  destino: Destino
}

/** Banco o cajón tal como está en el dibujo: se lleva al cuerpo 3D en `preparar`. */
interface Apoyo2D {
  /** Índice de la pieza en el material. */
  indice: number
  /** Asiento (y respaldo) del banco, o las dos esquinas de arriba del cajón. */
  puntos: P[]
  /** Atril del curl predicador: va bajo los brazos (es más ancho y solo cuentan los brazos). */
  atril?: boolean
  /** Cajón: qué pies se suben a él en algún momento, y cuáles están ya encima al empezar. */
  pies?: Lado[]
  piesInicio?: Lado[]
}

/** Un pie que sube al cajón desde el suelo: pasa por encima de la tapa, no a través del cajón. */
interface Escalon {
  lado: Lado
  x: number
  medio: number
  z0: number
  z1: number
  arriba: number
  /** Dónde está la punta del pie antes de subir (en el suelo). */
  inicio: number
}

/** Punto de la superficie del cuerpo y el hueso que lo mueve. */
type Nube = { p: Vector3; hueso: string }[]

function piezas(a: Animacion, e: EjercicioAnimable, aj: Ajustes2D, v: Vista): { piezas: Pieza[]; cables: Cable[]; apoyos: Apoyo2D[] } {
  const r: Pieza[] = []
  const cables: Cable[] = []
  const apoyos: Apoyo2D[] = []
  const lado0 = ladoDe(v, 0)
  const lado1 = ladoDe(v, 1)
  // De frente, cada polea a la mano de su lado (la izquierda del cuerpo es +X).
  const ladoDeLaPolea = (p: Vector3, otro: Lado): Lado => (Math.abs(p.x) > 0.05 ? (p.x > 0 ? 'L' : 'R') : otro)
  // A una mano: el dibujo lleva el cable "a las manos", pero solo un brazo se mueve (el otro descansa).
  const recorrido = ([0, 1] as const).map((i) => {
    // Respecto al hombro: si el tronco se mueve, el brazo que descansa se mueve con él.
    const agarres = a.claves.map((c) => {
      const b = resolver(a, c).brazos[i]
      return [b.agarre[0] - b.hombro[0], b.agarre[1] - b.hombro[1]] as const
    })
    return Math.max(...agarres.map((p) => Math.hypot(p[0] - agarres[0]![0], p[1] - agarres[0]![1])))
  })
  const manoQueSeMueve: Destino | null = recorrido[1]! < 3 && recorrido[0]! > 10 ? { mano: lado0 } : recorrido[0]! < 3 && recorrido[1]! > 10 ? { mano: lado1 } : null
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
        if (lateral) {
          // ¿Qué pies se suben al cajón? (el tobillo, por encima de la tapa y sobre ella, en alguna pose)
          const pies = ([0, 1] as const).filter((i) =>
            a.claves.some((c) => {
              const t = resolver(a, c).piernas[i].tobillo
              return t[0] >= q.x - 4 && t[0] <= q.x + q.ancho + 4 && t[1] <= q.y
            }),
          )
          const encima = (i: 0 | 1) => {
            const t = resolver(a, a.claves[0]!).piernas[i].tobillo
            return t[0] >= q.x - 4 && t[0] <= q.x + q.ancho + 4 && t[1] <= q.y
          }
          apoyos.push({ indice: r.length, puntos: [[q.x, q.y], [q.x + q.ancho, q.y]], pies: pies.map((i) => ladoDe(v, i)), piesInicio: pies.filter(encima).map((i) => ladoDe(v, i)) })
        }
        r.push({ tipo: 'caja', centro: [0, a1.y / 2, (a1.z + a2.z) / 2], tam: [0.5, a1.y, Math.abs(a2.z - a1.z)] })
        break
      }
      case 'rodillo':
        r.push({ tipo: 'rodillo' })
        break
      case 'banco': {
        const alto = v === 'cenital' ? 0.45 : 0
        const seg = (s: readonly [P, P]): [V3, V3] => [t3(prof(s[0], alto)), t3(prof(s[1], alto))]
        if (lateral || v === 'cenital') {
          apoyos.push({ indice: r.length, puntos: q.respaldo ? [...q.asiento, ...q.respaldo] : [...q.asiento], atril: q.delante === true })
          r.push({ tipo: 'bancoLibre', asiento: seg(q.asiento), respaldo: q.respaldo ? seg(q.respaldo) : undefined, patas: q.patas !== false, ancho: q.delante ? ANCHO_ATRIL : undefined })
        } else {
          // De frente o de espalda el dibujo solo da la altura del asiento: va de atrás adelante.
          const y = (SUELO - Math.min(q.asiento[0][1], q.asiento[1][1])) * K
          apoyos.push({ indice: r.length, puntos: [] })
          r.push({ tipo: 'bancoLibre', asiento: [[0, y, -0.3], [0, y, 0.22]], patas: true })
        }
        break
      }
      case 'polea': {
        const anclaje = prof(q.anclaje, lateral ? 0 : -0.15)
        const a = q.a ?? 'manos'
        r.push({ tipo: 'torre', salida: t3(anclaje) })
        if (q.anclaje2) {
          // Dos poleas: cada una a una mano.
          const otro = prof(q.anclaje2, lateral ? 0 : -0.15)
          const l = a === 'mano0' ? lado0 : a === 'mano1' ? lado1 : ladoDeLaPolea(anclaje, 'L')
          cables.push({ anclaje, destino: { mano: l } }, { anclaje: otro, destino: { mano: l === 'L' ? 'R' : 'L' } })
          r.push({ tipo: 'torre', salida: t3(otro) })
        } else cables.push({ anclaje, destino: a === 'manos' ? (manoQueSeMueve ?? 'manos') : a === 'tobillo0' ? { tobillo: lado0 } : { mano: a === 'mano0' ? lado0 : lado1 } })
        break
      }
    }
  }
  // Con una sola mano, un estribo; con las dos, el agarre del ejercicio (cuerda, barra, triángulo…).
  for (const c of cables) r.push({ tipo: 'agarrePolea', agarre: typeof c.destino === 'object' ? ('tobillo' in c.destino ? 'tobillera' : 'estribo') : aj.enganche })
  return { piezas: r, cables, apoyos }
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
  const { piezas: material, cables, apoyos } = piezas(a, e, aj, v)
  const { claves, concentrica } = lineaDeTiempo(a)
  const n = a.claves.length

  let preparado = false
  let elevacion: { s: number; d: number }[] = []
  const escalones: Escalon[] = []

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
    colocar: (p, rig) => colocar(p.s!, rig),
    preparar: (rig) => {
      if (preparado) return
      preparado = true
      const muestras = Array.from({ length: MUESTRAS + 1 }, (_, k) => (k / MUESTRAS) * (n === 2 ? 1 : n))
      // 1. El tronco no se hunde en el suelo (tumbado o sentado en él): cuánto hay que subirlo.
      elevacion = muestras.map((s) => {
        colocar(s, rig)
        let minimo = Infinity
        rig.recorrerSuperficie((q) => (minimo = Math.min(minimo, q.y)), (h) => !/^(pierna|pie|punta|mano|dedos)/.test(h))
        return { s, d: Math.max(0, -minimo) }
      })
      // 2. Bancos y cajones: del dibujo al cuerpo 3D, y que lo toquen sin atravesarlo.
      if (apoyos.length) {
        colocar(0, rig)
        const atadas = marcas(pose2D(0), rig)
        const centro = rig.pos('muslo.L').add(rig.pos('muslo.R')).add(rig.pos('brazo.L')).add(rig.pos('brazo.R')).multiplyScalar(0.25)
        const barra0 = colocar(0, rig).barra
        const radio = material.find((p) => p.tipo === 'barra')
        const barra = barra0 && radio?.tipo === 'barra' ? { centro: barra0, radio: radio.radioDisco ?? 0.225 } : null
        colocar(0, rig)
        const tobillos0 = { L: rig.pos('pie.L'), R: rig.pos('pie.R') }
        escalones.push(...ajustarApoyos(material, apoyos, v, atadas, centro, muestras.map((s) => nube(s, rig)), { anchoPies: aj.anchoPies, barra, tobillos0 }))
      }
    },
  }

  /** Subida del tronco en `s` (interpolada entre las muestras). */
  function subir(s: number): number {
    if (!elevacion.length) return 0
    const x = n === 2 ? s : ((s % n) + n) % n
    for (let i = 1; i < elevacion.length; i++) {
      const a = elevacion[i - 1]!
      const b = elevacion[i]!
      if (x <= b.s) return a.d + ((b.d - a.d) * (x - a.s)) / Math.max(1e-6, b.s - a.s)
    }
    return elevacion[elevacion.length - 1]!.d
  }

  function colocar(s: number, rig: Rig): EstadoMaterial {
    const q = pose2D(s)
    const tr = tronco(q, aj)
    const d = subir(s)
    if (d > 0) tr.pelvis.pos = [tr.pelvis.pos[0], tr.pelvis.pos[1] + d, tr.pelvis.pos[2]]
    rig.aplicarTronco(tr)
    const r = extremos(q, rig, aj, d, escalones)
    rig.aplicarExtremos(r.manos, r.pies, aj.dedos)
    // El material va donde quedan de verdad las manos y los tobillos (si una mano no llega a su sitio,
    // la barra o el agarre van con ella).
    const real = rig.ultimo!
    for (const lado of ['L', 'R'] as const) {
      const m = r.manos[lado]
      r.agarres[lado] = real.muneca[lado].clone().add(new Vector3(...m.dir).multiplyScalar(0.075)).add(new Vector3(...m.normal).multiplyScalar(0.025))
      r.tobillos[lado] = real.tobillo[lado].clone()
    }
    return estadoMaterial(material, r, cables)
  }

  function nube(s: number, rig: Rig): Nube {
    colocar(s, rig)
    const puntos: Nube = []
    rig.recorrerSuperficie((q, hueso) => puntos.push({ p: q.clone(), hueso }))
    return puntos
  }
}

/** Poses que se miran para ajustar bancos y suelo. */
const MUESTRAS = 12

interface Marca {
  d2: P
  d3: Vector3
}

/** Articulaciones del dibujo y del cuerpo 3D (en la pose actual del rig) a las que se ata cada apoyo. */
function marcas(p: Pose2D, rig: Rig): Marca[] {
  const medio = (a: string, b: string) => rig.pos(a).add(rig.pos(b)).multiplyScalar(0.5)
  const pose = p.pose
  const hombro = pose.vista === 'lateral' ? pose.hombro : pose.centroHombros
  const r: Marca[] = [
    { d2: pose.cadera, d3: medio('muslo.L', 'muslo.R') },
    { d2: hombro, d3: medio('brazo.L', 'brazo.R') },
  ]
  pose.piernas.forEach((q, i) => {
    const l = ladoDe(p.vista, i)
    r.push({ d2: q.rodilla, d3: rig.pos(`pierna.${l}`) }, { d2: q.tobillo, d3: rig.pos(`pie.${l}`) })
  })
  pose.brazos.forEach((b, i) => r.push({ d2: b.codo, d3: rig.pos(`antebrazo.${ladoDe(p.vista, i)}`) }))
  return r
}

/**
 * Lleva cada banco y cajón del dibujo al cuerpo 3D: cada punto se ata a la articulación más cercana
 * del dibujo (cadera, hombros, rodillas, tobillos, codos) y se pone a la misma distancia de esa
 * articulación en 3D. Después se acerca o se aleja hasta que toca el cuerpo sin atravesarlo en
 * ninguna pose.
 */
function ajustarApoyos(
  material: Pieza[],
  apoyos: Apoyo2D[],
  v: Vista,
  atadas: Marca[],
  centro: Vector3,
  nubes: Nube[],
  caja: { anchoPies: number; barra: { centro: Vector3; radio: number } | null; tobillos0: Record<Lado, Vector3> },
): Escalon[] {
  const escalones: Escalon[] = []
  const atar = (q: P): Vector3 | null => {
    if (v !== 'lateral' && v !== 'cenital') return null
    let mejor: Marca | null = null
    let dist = Infinity
    for (const m of atadas) {
      const d = Math.hypot(q[0] - m.d2[0], q[1] - m.d2[1])
      if (d < dist) {
        dist = d
        mejor = m
      }
    }
    if (!mejor) return null
    const dx = (q[0] - mejor.d2[0]) * K
    const dy = (q[1] - mejor.d2[1]) * K
    return v === 'lateral' ? new Vector3(0, mejor.d3.y - dy, mejor.d3.z + dx) : new Vector3(0, 0, mejor.d3.z + dy)
  }
  for (const ap of apoyos) {
    const pieza = material[ap.indice]!
    if (pieza.tipo === 'bancoLibre') {
      const tramos: [Vector3, Vector3][] = [[new Vector3(...pieza.asiento[0]), new Vector3(...pieza.asiento[1])]]
      if (pieza.respaldo) tramos.push([new Vector3(...pieza.respaldo[0]), new Vector3(...pieza.respaldo[1])])
      tramos.forEach((t, i) => {
        const q0 = ap.puntos[2 * i]
        const q1 = ap.puntos[2 * i + 1]
        const a = q0 ? atar(q0) : null
        const b = q1 ? atar(q1) : null
        if (!a || !b) return
        // Tumbado (vista cenital) el dibujo no da la altura: se queda la del banco.
        if (v === 'cenital') {
          a.y = t[0].y
          b.y = t[1].y
        }
        t[0].copy(a)
        t[1].copy(b)
      })
      const normales = tramos.map(([a, b]) => (ap.atril ? tocar(a, b, centro, nubes, ANCHO_ATRIL / 2, (h) => /^(brazo|antebrazo)/.test(h)) : tocar(a, b, centro, nubes)))
      pieza.asiento = [t3(tramos[0]![0]), t3(tramos[0]![1])]
      pieza.arriba = t3(normales[0]!)
      if (pieza.respaldo && tramos[1]) {
        pieza.respaldo = [t3(tramos[1][0]), t3(tramos[1][1])]
        pieza.arribaRespaldo = t3(normales[1]!)
      }
    } else if (pieza.tipo === 'caja') {
      const [q0, q1] = ap.puntos
      const a = q0 ? atar(q0) : null
      const b = q1 ? atar(q1) : null
      if (!a || !b) continue
      if (!ap.pies?.length && caja.barra) {
        // Bloques de la barra (arrancadas y cargadas desde bloques): uno bajo los discos de cada lado.
        const { centro: c, radio } = caja.barra
        const alto = Math.max(0.1, c.y - radio - 0.004)
        pieza.centro = [0.72, alto / 2, c.z]
        pieza.tam = [0.24, alto, 0.4]
        material.push({ tipo: 'caja', centro: [-0.72, alto / 2, c.z], tam: [0.24, alto, 0.4] })
        continue
      }
      // Bajo los pies que se suben a él (solo bajo uno si el otro se queda en el suelo).
      const uno = ap.pies?.length === 1 ? ap.pies[0]! : null
      // La tapa se ajusta a los pies que ya están encima al empezar; los que suben desde el suelo
      // pasan por encima de ella.
      const apoyados = ap.piesInicio?.length ? ap.piesInicio : (ap.pies ?? [])
      const suben = (ap.pies ?? []).filter((l) => !apoyados.includes(l))
      // Sin pies encima es un cajón para sentarse (sentadilla a banco): la tapa, bajo los glúteos.
      const deApoyados = ap.pies?.length ? new RegExp(`^(pie|punta)\\.(${apoyados.join('|') || 'L|R'})$`) : /^(cadera|lumbar|muslo)/
      const x = uno ? (uno === 'L' ? 1 : -1) * caja.anchoPies : 0
      const medio = uno ? 0.15 : 0.25
      a.x = x
      b.x = x
      const [z0, z1] = a.z < b.z ? [a, b] : [b, a]
      // La tapa, horizontal.
      z0.y = z1.y = (z0.y + z1.y) / 2
      // La tapa es un tramo horizontal: toca la planta de los pies y se acorta si un pie baja más
      // por un extremo (los talones en las elevaciones de gemelos).
      tocar(z0, z1, centro, nubes, medio, (h) => deApoyados.test(h), 0.03, false, false)
      const arriba = Math.max(0.03, Math.min(z0.y, z1.y))
      pieza.centro = [x, arriba / 2, (z0.z + z1.z) / 2]
      pieza.tam = [medio * 2, arriba, Math.max(0.12, Math.abs(z1.z - z0.z))]
      if (!ap.pies?.length) {
        // Cajón para sentarse: los pies se quedan en el suelo, delante; que los talones no se metan en él.
        let desde = pieza.centro[2] - pieza.tam[2] / 2
        let hasta = pieza.centro[2] + pieza.tam[2] / 2
        const medioZ = (desde + hasta) / 2
        for (const nube of nubes)
          for (const { p: q, hueso } of nube) {
            if (!/^(pie|punta)/.test(hueso) || q.y > arriba || Math.abs(q.x - x) > medio || q.z <= desde || q.z >= hasta) continue
            if (q.z > medioZ) hasta = Math.min(hasta, q.z - 0.02)
            else desde = Math.max(desde, q.z + 0.02)
          }
        if (hasta - desde >= 0.12) {
          pieza.centro = [x, arriba / 2, (desde + hasta) / 2]
          pieza.tam = [medio * 2, arriba, hasta - desde]
        }
      }
      for (const lado of suben) {
        // El cajón empieza un poco por delante de esa pierna al empezar (el pie en el suelo y la rodilla,
        // que puede adelantarse).
        const inicio = caja.tobillos0[lado].z + 0.17
        // (el muslo también: al subir, la rodilla es lo que más se adelanta)
        const pierna = new RegExp(`^(muslo|pierna|pie|punta)\.${lado}$`)
        let borde = inicio + 0.06
        // (las dos primeras poses de muestra: la de partida y justo al empezar a subir)
        for (const nube of nubes.slice(0, 2)) for (const { p: q, hueso } of nube) if (pierna.test(hueso) && q.y < arriba) borde = Math.max(borde, q.z + 0.04)
        const delante = Math.max(z0.z, z1.z)
        if (Math.min(z0.z, z1.z) < borde && delante - borde > 0.18) {
          pieza.centro = [x, arriba / 2, (borde + delante) / 2]
          pieza.tam = [medio * 2, arriba, delante - borde]
        }
        escalones.push({ lado, x, medio, z0: pieza.centro[2] - pieza.tam[2] / 2, z1: pieza.centro[2] + pieza.tam[2] / 2, arriba, inicio })
      }
    }
  }
  return escalones
}

/** Grosor del tapizado de los bancos (m). */
export const GROSOR = 0.07
/** Media anchura del tapizado de un banco y anchura del atril del curl predicador (m). */
export const MEDIO_ANCHO_BANCO = 0.14
export const ANCHO_ATRIL = 0.6

/**
 * Coloca el tramo `a`–`b` (la cara del tapizado que toca el cuerpo) para que el cuerpo quede apoyado
 * encima (o delante, si el tramo es casi vertical, como un respaldo) sin atravesarlo en ninguna pose:
 * a lo largo del tramo, en franjas de 4 cm, se busca la parte de abajo del cuerpo; el tapizado toca la
 * más baja de la parte central y, si en los extremos baja algo más (una pierna que cuelga, la cadera
 * de quien está de rodillas…), el tramo se acorta por ese lado. Devuelve hacia dónde queda el cuerpo.
 */
function tocar(
  a: Vector3,
  b: Vector3,
  centro: Vector3,
  nubes: Nube[],
  medioAncho = MEDIO_ANCHO_BANCO + 0.02,
  cuenta: (hueso: string) => boolean = (h) => !/^(mano|dedos)/.test(h),
  suelo = 0.08,
  /** Cajón: la tapa a la altura habitual de los pies (la mediana), no a la del pie que pasa más bajo. */
  mediana = false,
  /** Banco: si solo se apoya una pierna (la rodilla o el pie de atrás), el banco va bajo esa pierna. */
  alLado = true,
): Vector3 {
  const dir = b.clone().sub(a)
  const largo = dir.length()
  dir.normalize()
  const n = new Vector3(0, -dir.z, dir.y)
  if (n.lengthSq() < 1e-6) n.set(0, 1, 0)
  n.normalize()
  const vertical = Math.abs(dir.y) > 0.8
  if (vertical ? centro.clone().sub(a).dot(n) < 0 : n.y < 0) n.negate()
  const d = new Vector3()
  // Qué partes del cuerpo se apoyan: las que llegan cerca del tramo del dibujo y nunca bajan mucho
  // más (la pierna en la que se está de pie junto al banco, o la espinilla que cuelga delante en una
  // búlgara, sí bajan: no cuentan para la altura, solo para acortar el tramo por los extremos).
  const porHueso = new Map<string, { cerca: boolean; minimo: number; x: number; n: number }>()
  for (const nube of nubes)
    for (const { p: q, hueso } of nube) {
      if (Math.abs(q.x - a.x) > medioAncho || !cuenta(hueso)) continue
      d.copy(q).sub(a)
      const u = d.dot(dir)
      if (u < 0 || u > largo) continue
      const h = d.dot(n)
      if (Math.abs(h) > 0.4) continue
      const m = porHueso.get(hueso) ?? { cerca: false, minimo: Infinity, x: 0, n: 0 }
      m.minimo = Math.min(m.minimo, h)
      if (Math.abs(h) < 0.08) {
        m.cerca = true
        m.x += q.x
        m.n++
      }
      porHueso.set(hueso, m)
    }
  const apoyados = new Set([...porHueso].filter(([, m]) => m.cerca && m.minimo >= -0.12).map(([h]) => h))
  const huesos = [...apoyados]
  // (la rodilla, la espinilla o el pie: el muslo de la pierna de apoyo puede pasar cerca del banco)
  const ladosPierna = new Set(huesos.filter((h) => /^(pierna|pie|punta)\./.test(h)).map((h) => h.slice(-1)))
  if (alLado && !vertical && ladosPierna.size === 1 && !huesos.some((h) => /^(cadera|lumbar|dorsal|pecho)/.test(h))) {
    // Solo se apoya una pierna: el banco va bajo ella, al lado de la otra.
    const lado = [...ladosPierna][0]!
    const pierna = huesos.filter((h) => /^(pierna|pie|punta)\./.test(h) && h.endsWith(lado)).map((h) => porHueso.get(h)!)
    const x = pierna.reduce((s, m) => s + m.x, 0) / Math.max(1, pierna.reduce((s, m) => s + m.n, 0))
    a.x = b.x = Math.max(-0.2, Math.min(0.2, x))
  }
  const FRANJA = 0.04
  const franjas = Math.max(1, Math.ceil(largo / FRANJA))
  // Parte de abajo del cuerpo en cada franja: de lo que se apoya y de todo (esto, solo justo encima
  // del tapizado: lo que pasa por su lado no lo toca).
  const apoyo: number[] = new Array(franjas).fill(Infinity)
  const fondo: number[] = new Array(franjas).fill(Infinity)
  const justo = medioAncho - 0.04
  for (const nube of nubes)
    for (const { p: q, hueso } of nube) {
      if (Math.abs(q.x - a.x) > medioAncho || !cuenta(hueso)) continue
      d.copy(q).sub(a)
      const u = d.dot(dir)
      if (u < 0 || u > largo) continue
      const h = d.dot(n)
      if (Math.abs(h) > 0.4) continue
      const k = Math.min(franjas - 1, Math.floor(u / FRANJA))
      if (Math.abs(q.x - a.x) <= justo) fondo[k] = Math.min(fondo[k]!, h)
      // Si se apoya la espinilla, el pie de esa pierna puede colgar: no marca la altura.
      const cuelga = /^(pie|punta)\./.test(hueso) && apoyados.has(`pierna.${hueso.slice(-1)}`)
      if ((apoyados.size === 0 || apoyados.has(hueso)) && !cuelga) apoyo[k] = Math.min(apoyo[k]!, h)
    }
  const conApoyo = apoyo.map((h, k) => [h, k] as const).filter(([h]) => h < Infinity)
  if (conApoyo.length) {
    // Altura del tapizado: lo más bajo de lo que se apoya en el 60 % central (o en todo, si es corto).
    const centrales = conApoyo.filter(([, k]) => k >= franjas * 0.2 && k < franjas * 0.8)
    const alturas = (centrales.length ? centrales : conApoyo).map(([h]) => h).sort((x, y) => x - y)
    let t = mediana ? alturas[Math.floor(alturas.length / 2)]! : alturas[0]!
    // Por los extremos: si algo del cuerpo baja más que el tapizado (o no hay nada encima hasta
    // llegar a ello), se acorta por ese lado.
    const sobra = (k: number) => fondo[k]! < t - 0.005
    const corta = (desdeFin: boolean) => {
      const orden = desdeFin ? [...fondo.keys()].reverse() : [...fondo.keys()]
      const primeroOcupado = orden.find((k) => fondo[k]! < Infinity)
      if (primeroOcupado === undefined || !sobra(primeroOcupado)) return desdeFin ? franjas - 1 : 0
      let k = primeroOcupado
      while (k >= 0 && k < franjas && (sobra(k) || fondo[k] === Infinity)) k += desdeFin ? -1 : 1
      return k
    }
    let desde = corta(false)
    let hasta = Math.max(desde, corta(true))
    let inicio = desde * FRANJA
    let fin = Math.min(largo, (hasta + 1) * FRANJA)
    // Si acortarlo lo deja demasiado corto, no se acorta: se baja.
    if (fin - inicio < Math.max(0.15, largo * 0.5)) {
      desde = 0
      hasta = franjas - 1
      inicio = 0
      fin = largo
    }
    // Lo que quede por debajo en medio obliga a bajar el tapizado.
    for (let k = desde; k <= hasta; k++) t = Math.min(t, fondo[k]!)
    t = Math.max(-0.3, Math.min(0.3, t))
    if (inicio > 0 || fin < largo) {
      const a0 = a.clone()
      a.copy(a0).addScaledVector(dir, inicio)
      b.copy(a0).addScaledVector(dir, fin)
    }
    a.addScaledVector(n, t)
    b.addScaledVector(n, t)
  }
  // Que no quede por debajo del suelo (el tapizado tiene su grosor).
  const bajo = Math.min(a.y, b.y)
  if (bajo < suelo) {
    a.y += suelo - bajo
    b.y += suelo - bajo
  }
  return n
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

function estadoMaterial(material: readonly Pieza[], r: Resuelto, cables: Cable[]): EstadoMaterial {
  const e: EstadoMaterial = {}
  const centro = r.agarres.L.clone().add(r.agarres.R).multiplyScalar(0.5)
  const eje = (l: Lado) => {
    const m = r.manos[l]
    return new Vector3().crossVectors(new Vector3(...m.dir), new Vector3(...m.normal)).normalize()
  }
  const deManoAMano = r.agarres.L.clone().sub(r.agarres.R)
  for (const p of material) {
    if (p.tipo === 'barra' || p.tipo === 'hexagonal') {
      e.barra = centro.clone()
      if (deManoAMano.lengthSq() > 0.01) e.ejeBarra = deManoAMano.clone().normalize()
    }
    if (p.tipo === 'multipower') e.multipower = centro.clone()
    if (p.tipo === 'mancuernas') {
      const lados = p.manos ?? (['L', 'R'] as Lado[])
      e.mancuernas = Object.fromEntries(lados.map((l) => [l, { centro: r.agarres[l].clone(), eje: eje(l) }])) as EstadoMaterial['mancuernas']
    }
    if (p.tipo === 'disco') e.disco = { centro: centro.clone(), eje: new Vector3().crossVectors(deManoAMano, new Vector3(0, 1, 0)).normalize() }
    if (p.tipo === 'landmine') e.landmine = { pivote: new Vector3(...p.pivote), mano: centro.clone() }
    if (p.tipo === 'rodillo') e.rodillo = centro.clone()
  }
  if (cables.length) {
    const destino = (c: Cable) => (c.destino === 'manos' ? centro : 'mano' in c.destino ? r.agarres[c.destino.mano] : r.tobillos[c.destino.tobillo])
    e.cables = cables.map((c) => ({ salida: c.anclaje.clone(), enganche: destino(c).clone() }))
    e.agarresPolea = cables.map((c) => ({ centro: destino(c).clone(), manos: c.destino === 'manos' ? ([r.agarres.L.clone(), r.agarres.R.clone()] as [Vector3, Vector3]) : undefined }))
  }
  return e
}
