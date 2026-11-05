// Patrones de movimiento parametrizados. Cada uno devuelve las poses clave de un ejercicio y el
// material que se dibuja. Las poses clave se recorren en bucle (ida y vuelta si son dos).
import { angulo, desde, dir, lerpP, mas, por, type P } from './geometria'
import { anterior, L, SUELO, TOBILLO, type Brazo, type BrazoF, type Control, type ControlFrontal, type Pierna, type PiernaF } from './esqueleto'
import type { Equipo, Vista } from './dibujo'

export type Clave = Control | ControlFrontal

export interface Animacion {
  /** Nombre del patrón, para la galería. */
  patron: string
  vista: Vista
  claves: readonly Clave[]
  equipo: readonly Equipo[]
}

/** Material que se sujeta con las manos. */
export type Carga = 'barra' | 'barra_z' | 'mancuernas' | 'mancuerna' | 'disco' | 'polea' | 'multipower' | 'landmine' | 'hexagonal' | 'ninguna'

// ── Utilidades ──────────────────────────────────────────────────────────────────────────────

const X = 100
const DE_PIE: P = [X - 1, TOBILLO - L.muslo - L.tibia + 0.6]

const hombro = (cadera: P, tronco: number): P => desde(cadera, tronco, L.tronco)
/** Punto del tronco a la altura `f` (0 cadera, 1 hombros) y `fuera` hacia delante del pecho. */
const enTronco = (cadera: P, tronco: number, f: number, fuera: number): P => mas(desde(cadera, tronco, L.tronco * f), por(anterior(tronco), fuera))
const pies = (x = X, atras = 3, y = TOBILLO): [Pierna, Pierna] => [{ tobillo: [x, y] }, { tobillo: [x - atras, y] }]
const ambos = <T>(b: T): [T, T] => [b, b]
const lat = (c: Control): Control => c

/** Equipo para la carga en las manos (vista lateral o frontal). */
function material(carga: Carga): Equipo[] {
  switch (carga) {
    case 'barra':
    case 'hexagonal':
      return [{ tipo: 'barra' }]
    case 'barra_z':
      return [{ tipo: 'barra', discos: 'pequenos' }]
    case 'mancuernas':
      return [{ tipo: 'mancuernas' }]
    case 'mancuerna':
      return [{ tipo: 'mancuernas', manos: [0] }]
    case 'disco':
      return [{ tipo: 'disco' }]
    case 'multipower':
      return [{ tipo: 'multipower' }]
    default:
      return []
  }
}

/** Banco plano bajo un tronco tumbado (de la cadera a los hombros). */
function bancoBajo(cadera: P, tronco: number, desdeF = -0.3, hastaF = 1.15, fondo = 11): Equipo {
  const a = enTronco(cadera, tronco, desdeF, -fondo)
  const b = enTronco(cadera, tronco, hastaF, -fondo)
  return { tipo: 'banco', asiento: [a, b] }
}

const sentadoEn = (x: number, asiento = 144): { cadera: P; piernas: [Pierna, Pierna] } => ({
  cadera: [x, asiento - 9],
  piernas: pies(x + 38, 4),
})

// ── Press ───────────────────────────────────────────────────────────────────────────────────

export type PosturaPress = 'banco' | 'inclinado' | 'declinado' | 'suelo' | 'de_pie' | 'sentado' | 'polea_pie' | 'polea_inclinado' | 'svend' | 'landmine'

export function press(o: {
  postura: PosturaPress
  carga: Carga
  unilateral?: boolean
  trasNuca?: boolean
  parcial?: boolean
  /** Hasta dónde baja la barra: pecho (por defecto), cuello o cara (JM, guillotina). */
  hasta?: 'pecho' | 'cuello'
  impulso?: boolean
}): Animacion {
  const eq = material(o.carga)
  if (o.postura === 'banco' || o.postura === 'inclinado' || o.postura === 'declinado' || o.postura === 'suelo') {
    const tronco = o.postura === 'inclinado' ? -128 : o.postura === 'declinado' ? -74 : -90
    const cadera: P = o.postura === 'suelo' ? [124, SUELO - 10] : o.postura === 'inclinado' ? [126, 126] : o.postura === 'declinado' ? [118, 118] : [124, 124]
    const S = hombro(cadera, tronco)
    const piernas: [Pierna, Pierna] =
      o.postura === 'declinado' ? [{ tobillo: [cadera[0] + 26, 150] }, { tobillo: [cadera[0] + 23, 150] }] : pies(cadera[0] + 34, 4)
    const pecho = enTronco(cadera, tronco, o.hasta === 'cuello' ? 0.98 : 0.8, o.postura === 'suelo' ? 20 : 13)
    const arriba: P = [S[0] + (o.carga === 'multipower' ? pecho[0] - S[0] : 2), S[1] - 56]
    const abajo = o.parcial ? lerpP(pecho, arriba, 0.4) : o.carga === 'multipower' ? ([arriba[0], pecho[1]] as P) : pecho
    const libre: Brazo = { mano: enTronco(cadera, tronco, 0.45, 12), doblez: -1 }
    const brazos = (m: P): [Brazo, Brazo] => [{ mano: m, doblez: -1 }, o.unilateral ? libre : { mano: mas(m, [-2, 1]), doblez: -1 }]
    const base = { cadera, tronco, piernas }
    const equipo: Equipo[] = [...eq]
    if (o.postura === 'inclinado') {
      equipo.unshift({ tipo: 'banco', asiento: [[cadera[0] + 14, cadera[1] + 12], [cadera[0] - 6, cadera[1] + 12]], respaldo: [enTronco(cadera, tronco, 0, -11), enTronco(cadera, tronco, 1.2, -11)] })
    } else if (o.postura === 'declinado') {
      equipo.unshift(bancoBajo(cadera, tronco, -0.5, 1.15), { tipo: 'rodillo', c: [cadera[0] + 30, 144] })
    } else if (o.postura === 'banco') equipo.unshift(bancoBajo(cadera, tronco, -0.35))
    return {
      patron: `press ${o.postura}`,
      vista: 'lateral',
      claves: [lat({ ...base, brazos: brazos(abajo) }), lat({ ...base, brazos: brazos(arriba) })],
      equipo,
    }
  }

  if (o.postura === 'de_pie' || o.postura === 'sentado') {
    const sentado = o.postura === 'sentado'
    const { cadera, piernas } = sentado ? sentadoEn(X - 8) : { cadera: DE_PIE, piernas: pies() }
    const tronco = sentado ? 180 : 179
    const S = hombro(cadera, tronco)
    const doblez = o.trasNuca ? 1 : -1
    const rack: P = o.trasNuca ? mas(S, [-8, -5]) : mas(S, [9, 2])
    const arriba: P = mas(S, [o.trasNuca ? -1 : 1, -57])
    const libre: Brazo = { mano: mas(S, [6, 52]), doblez: -1 }
    const brazos = (m: P): [Brazo, Brazo] => [{ mano: m, doblez }, o.unilateral ? libre : { mano: mas(m, [-2, 1]), doblez }]
    const equipo: Equipo[] = [...eq]
    if (sentado) equipo.unshift({ tipo: 'banco', asiento: [[cadera[0] - 12, cadera[1] + 9], [cadera[0] + 14, cadera[1] + 9]], respaldo: [[cadera[0] - 12, cadera[1] + 8], [cadera[0] - 12, cadera[1] - 50]] })
    if (o.carga === 'polea') equipo.push({ tipo: 'polea', anclaje: [S[0] - 30, SUELO - 6] })
    if (o.impulso) {
      const flexion: P = mas(cadera, [-4, 9])
      const S2 = hombro(flexion, tronco)
      return {
        patron: 'push press',
        vista: 'lateral',
        claves: [
          lat({ cadera, tronco, piernas, brazos: brazos(rack) }),
          lat({ cadera: flexion, tronco, piernas, brazos: brazos(mas(S2, [9, 2])) }),
          lat({ cadera, tronco, piernas, brazos: brazos(arriba) }),
        ],
        equipo,
      }
    }
    return { patron: `press ${o.postura}`, vista: 'lateral', claves: [lat({ cadera, tronco, piernas, brazos: brazos(rack) }), lat({ cadera, tronco, piernas, brazos: brazos(arriba) })], equipo }
  }

  if (o.postura === 'landmine') {
    const cadera: P = [X - 4, DE_PIE[1] + 3]
    const tronco = 168
    const S = hombro(cadera, tronco)
    const piernas: [Pierna, Pierna] = [{ tobillo: [X + 14, TOBILLO] }, { tobillo: [X - 22, TOBILLO] }]
    const brazos = (m: P): [Brazo, Brazo] => [{ mano: m, doblez: -1 }, o.unilateral ? { mano: mas(S, [6, 52]), doblez: -1 } : { mano: mas(m, [-2, 1]), doblez: -1 }]
    return {
      patron: 'press landmine',
      vista: 'lateral',
      claves: [lat({ cadera, tronco, piernas, brazos: brazos(mas(S, [10, 3])) }), lat({ cadera, tronco, piernas, brazos: brazos(mas(S, [38, -40])) })],
      equipo: [{ tipo: 'landmine', pivote: [S[0] + 160, SUELO - 2] }],
    }
  }

  // De pie empujando hacia delante: polea (pecho) o disco (Svend).
  const cadera: P = [X - 3, DE_PIE[1] + 2]
  const tronco = 170
  const S = hombro(cadera, tronco)
  const piernas: [Pierna, Pierna] = [{ tobillo: [X + 12, TOBILLO] }, { tobillo: [X - 18, TOBILLO] }]
  const alto = o.postura === 'polea_inclinado' ? -34 : -4
  const brazos = (m: P): [Brazo, Brazo] => [{ mano: m, doblez: -1 }, o.unilateral ? { mano: mas(S, [4, 50]), doblez: -1 } : { mano: mas(m, [-2, 1]), doblez: -1 }]
  const equipo: Equipo[] = o.postura === 'svend' ? [{ tipo: 'disco' }] : [{ tipo: 'polea', anclaje: [S[0] - 48, S[1] + 8] }]
  return {
    patron: o.postura === 'svend' ? 'press Svend' : 'press en polea',
    vista: 'lateral',
    claves: [lat({ cadera, tronco, piernas, brazos: brazos(mas(S, [9, 11])) }), lat({ cadera, tronco, piernas, brazos: brazos(mas(S, [54, alto + 8])) })],
    equipo,
  }
}

/** Press Pallof: de frente, la polea tira desde un lado y el tronco no se deja girar. */
export function pallof(rotacion: boolean): Animacion {
  const cadera: P = [X, DE_PIE[1] + 4]
  const piernas: [PiernaF, PiernaF] = [{ tobillo: [X + 15, TOBILLO] }, { tobillo: [X - 15, TOBILLO] }]
  const cerca: [BrazoF, BrazoF] = [{ brazo: -12, antebrazo: -95, escala: 0.95, escalaAntebrazo: 0.75 }, { brazo: -12, antebrazo: -95, escala: 0.95, escalaAntebrazo: 0.75 }]
  const lejos: [BrazoF, BrazoF] = [{ brazo: -8, antebrazo: -20, escala: 0.42, escalaAntebrazo: 0.35 }, { brazo: -8, antebrazo: -20, escala: 0.42, escalaAntebrazo: 0.35 }]
  return {
    patron: 'press Pallof',
    vista: 'frontal',
    claves: [
      { cadera, tronco: 180, piernas, brazos: cerca },
      { cadera, tronco: 180, giro: rotacion ? 25 : 0, piernas, brazos: lejos },
    ],
    equipo: [{ tipo: 'polea', anclaje: [28, 92] }],
  }
}

// ── Remo ────────────────────────────────────────────────────────────────────────────────────

export type PosturaRemo = 'inclinado' | 'pendlay' | 'una_mano_banco' | 'pecho_apoyado' | 'banco_plano' | 'sentado_polea' | 'polea_alta_rodillas' | 'face_pull' | 'polea_pie'

export function remo(o: { postura: PosturaRemo; carga: Carga; unilateral?: boolean; hasta?: 'abdomen' | 'pecho' | 'cuello' }): Animacion {
  const eq = material(o.carga)
  const fHasta = o.hasta === 'pecho' ? 0.72 : o.hasta === 'cuello' ? 0.95 : 0.38
  const doblez: 1 | -1 = o.hasta === 'cuello' ? 1 : -1
  switch (o.postura) {
    case 'inclinado':
    case 'pendlay': {
      const pendlay = o.postura === 'pendlay'
      const cadera: P = pendlay ? [X - 26, 104] : [X - 24, 102]
      const tronco = pendlay ? 96 : 112
      const S = hombro(cadera, tronco)
      const abajo: P = pendlay ? [S[0] + 2, SUELO - 20] : [S[0] + 2, S[1] + 55]
      const arriba = enTronco(cadera, tronco, fHasta, 13)
      const piernas = pies()
      const brazos = (m: P): [Brazo, Brazo] => [{ mano: m, doblez }, o.unilateral ? { brazo: 5, antebrazo: 6 } : { mano: mas(m, [-2, 0]), doblez }]
      const equipo: Equipo[] = o.carga === 'landmine' ? [{ tipo: 'landmine', pivote: [X - 150, SUELO - 2] }] : eq
      return { patron: pendlay ? 'remo Pendlay' : 'remo inclinado', vista: 'lateral', claves: [lat({ cadera, tronco, piernas, brazos: brazos(abajo) }), lat({ cadera, tronco, piernas, brazos: brazos(arriba) })], equipo }
    }
    case 'una_mano_banco': {
      const cadera: P = [82, 92]
      const tronco = 93
      const S = hombro(cadera, tronco)
      const piernas: [Pierna, Pierna] = [{ tobillo: [76, TOBILLO] }, { muslo: 2, tibia: -90 }]
      const apoyo: Brazo = { mano: [S[0] + 2, 129], doblez: -1 }
      return {
        patron: 'remo a una mano',
        vista: 'lateral',
        claves: [
          lat({ cadera, tronco, piernas, brazos: [{ mano: [S[0] + 1, S[1] + 55], doblez: -1 }, apoyo] }),
          lat({ cadera, tronco, piernas, brazos: [{ mano: enTronco(cadera, tronco, 0.36, 12), doblez: -1 }, apoyo] }),
        ],
        equipo: [{ tipo: 'banco', asiento: [[38, 134], [146, 134]] }, ...material(o.carga === 'mancuernas' ? 'mancuerna' : o.carga)],
      }
    }
    case 'pecho_apoyado':
    case 'banco_plano': {
      const plano = o.postura === 'banco_plano'
      const cadera: P = plano ? [78, 100] : [86, 116]
      const tronco = plano ? 90 : 136
      const S = hombro(cadera, tronco)
      const piernas: [Pierna, Pierna] = plano ? [{ muslo: -90, tibia: -90, pie: 0 }, { muslo: -90, tibia: -90, pie: 0 }] : pies(66, 4)
      const brazos = (m: P): [Brazo, Brazo] => [{ mano: m, doblez: -1 }, o.unilateral ? { brazo: 4, antebrazo: 6 } : { mano: mas(m, [-2, 0]), doblez: -1 }]
      return {
        patron: 'remo con el pecho apoyado',
        vista: 'lateral',
        claves: [lat({ cadera, tronco, piernas, brazos: brazos([S[0] + 1, S[1] + 54]) }), lat({ cadera, tronco, piernas, brazos: brazos(enTronco(cadera, tronco, 0.62, 14)) })],
        equipo: [plano ? { tipo: 'banco', asiento: [enTronco(cadera, tronco, -0.9, 11), enTronco(cadera, tronco, 0.95, 11)] } : bancoBajo(cadera, tronco, 0.1, 1.05, -11), ...eq],
      }
    }
    case 'sentado_polea': {
      const cadera: P = [70, 160]
      const piernas: [Pierna, Pierna] = [{ tobillo: [142, 158] }, { tobillo: [139, 158] }]
      const ida = lat({ cadera, tronco: 158, piernas, brazos: ambos<Brazo>({ mano: mas(hombro(cadera, 158), [48, 10]), doblez }) })
      const vuelta = lat({ cadera, tronco: 186, piernas, brazos: ambos<Brazo>({ mano: enTronco(cadera, 186, fHasta, 14), doblez }) })
      return {
        patron: 'remo en polea baja',
        vista: 'lateral',
        claves: [ida, vuelta].map((c) => (o.unilateral ? { ...c, brazos: [c.brazos[0], { brazo: 30, antebrazo: 80 }] as [Brazo, Brazo] } : c)),
        equipo: [{ tipo: 'polea', anclaje: [176, 150] }, { tipo: 'banco', asiento: [[50, 170], [90, 170]] }],
      }
    }
    case 'polea_alta_rodillas': {
      const rodilla: P = [X, SUELO - 5]
      const cadera: P = [X - 2, rodilla[1] - L.muslo]
      const piernas: [Pierna, Pierna] = ambos<Pierna>({ muslo: angulo(cadera, rodilla), tibia: -90, pie: -180 })
      const S = hombro(cadera, 178)
      const brazos = (m: P): [Brazo, Brazo] => [{ mano: m, doblez: -1 }, o.unilateral ? { brazo: 6, antebrazo: 8 } : { mano: mas(m, [-2, 0]), doblez: -1 }]
      return {
        patron: 'remo en polea alta',
        vista: 'lateral',
        claves: [lat({ cadera, tronco: 172, piernas, brazos: brazos(mas(S, [34, -42])) }), lat({ cadera, tronco: 182, piernas, brazos: brazos(mas(S, [12, 8])) })],
        equipo: [{ tipo: 'polea', anclaje: [S[0] + 70, 16] }],
      }
    }
    case 'face_pull': {
      const cadera: P = [X - 4, DE_PIE[1] + 2]
      const piernas: [Pierna, Pierna] = [{ tobillo: [X + 10, TOBILLO] }, { tobillo: [X - 16, TOBILLO] }]
      const S = hombro(cadera, 184)
      return {
        patron: 'face pull',
        vista: 'lateral',
        claves: [
          lat({ cadera, tronco: 184, piernas, brazos: ambos<Brazo>({ mano: mas(S, [52, -8]), doblez: 1 }) }),
          lat({ cadera, tronco: 184, piernas, brazos: ambos<Brazo>({ mano: mas(S, [8, -16]), doblez: 1 }) }),
        ],
        equipo: [{ tipo: 'polea', anclaje: [S[0] + 82, S[1] - 10] }],
      }
    }
    case 'polea_pie': {
      const cadera: P = [X - 6, DE_PIE[1] + 4]
      const tronco = 168
      const piernas: [Pierna, Pierna] = [{ tobillo: [X + 12, TOBILLO] }, { tobillo: [X - 18, TOBILLO] }]
      const S = hombro(cadera, tronco)
      const brazos = (m: P): [Brazo, Brazo] => [{ mano: m, doblez: -1 }, o.unilateral ? { brazo: 8, antebrazo: 10 } : { mano: mas(m, [-2, 0]), doblez: -1 }]
      return {
        patron: 'remo en polea de pie',
        vista: 'lateral',
        claves: [lat({ cadera, tronco, piernas, brazos: brazos(mas(S, [50, 12])) }), lat({ cadera, tronco, piernas, brazos: brazos(enTronco(cadera, tronco, fHasta, 13)) })],
        equipo: [{ tipo: 'polea', anclaje: [S[0] + 80, S[1] + 20] }],
      }
    }
  }
}

// ── Curl ────────────────────────────────────────────────────────────────────────────────────

export type PosturaCurl = 'de_pie' | 'sentado' | 'inclinado' | 'predicador' | 'concentrado' | 'tumbado' | 'prono' | 'bayesiano' | 'arrastre' | 'polea_alta' | 'tumbado_polea'

export function curl(o: { postura: PosturaCurl; carga: Carga; unilateral?: boolean }): Animacion {
  const eq = material(o.unilateral && o.carga === 'mancuernas' ? 'mancuerna' : o.carga)
  if (o.postura === 'polea_alta') {
    const cadera: P = [X, DE_PIE[1] + 2]
    const piernas: [PiernaF, PiernaF] = [{ tobillo: [X + 13, TOBILLO] }, { tobillo: [X - 13, TOBILLO] }]
    return {
      patron: 'curl en polea alta',
      vista: 'frontal',
      claves: [
        { cadera, tronco: 180, piernas, brazos: ambos<BrazoF>({ brazo: 96, antebrazo: 98 }) },
        { cadera, tronco: 180, piernas, brazos: ambos<BrazoF>({ brazo: 98, antebrazo: 168 }) },
      ],
      equipo: [{ tipo: 'polea', anclaje: [26, 46], anclaje2: [174, 46] }],
    }
  }
  let cadera: P = DE_PIE
  let tronco = 179
  let piernas: [Pierna, Pierna] = pies()
  let brazo = 2
  let ini = 6
  let fin = 148
  let fondo: Equipo[] = []
  switch (o.postura) {
    case 'sentado': {
      ;({ cadera, piernas } = sentadoEn(X - 8))
      fondo = [{ tipo: 'banco', asiento: [[cadera[0] - 14, cadera[1] + 9], [cadera[0] + 14, cadera[1] + 9]] }]
      break
    }
    case 'inclinado': {
      ;({ cadera, piernas } = sentadoEn(X - 4))
      tronco = 214
      brazo = -2
      ini = -1
      fin = 132
      fondo = [{ tipo: 'banco', asiento: [[cadera[0] - 8, cadera[1] + 9], [cadera[0] + 16, cadera[1] + 9]], respaldo: [enTronco(cadera, tronco, -0.05, -11), enTronco(cadera, tronco, 1.15, -11)] }]
      break
    }
    case 'predicador': {
      ;({ cadera, piernas } = sentadoEn(X - 14))
      tronco = 168
      brazo = 46
      ini = 58
      fin = 168
      const S = hombro(cadera, tronco)
      const atras = dir(brazo - 90)
      fondo = [
        { tipo: 'banco', asiento: [mas(desde(S, brazo, 6), por(atras, 10.5)), mas(desde(S, brazo, 31), por(atras, 10.5))], patas: false, delante: true },
        { tipo: 'banco', asiento: [[cadera[0] - 12, cadera[1] + 9], [cadera[0] + 12, cadera[1] + 9]] },
      ]
      break
    }
    case 'concentrado': {
      ;({ cadera, piernas } = sentadoEn(X - 12))
      tronco = 142
      brazo = -1
      ini = 2
      fin = 150
      fondo = [{ tipo: 'banco', asiento: [[cadera[0] - 14, cadera[1] + 9], [cadera[0] + 12, cadera[1] + 9]] }]
      break
    }
    case 'tumbado': {
      cadera = [124, 112]
      tronco = -90
      piernas = pies(158, 4)
      brazo = -3
      ini = 2
      fin = 150
      fondo = [bancoBajo(cadera, tronco, -0.35, 0.95)]
      break
    }
    case 'prono': {
      cadera = [84, 118]
      tronco = 136
      piernas = pies(64, 4)
      brazo = 0
      ini = 2
      fin = 140
      fondo = [bancoBajo(cadera, tronco, 0.1, 1.05, -11)]
      break
    }
    case 'bayesiano':
      piernas = [{ tobillo: [X + 12, TOBILLO] }, { tobillo: [X - 16, TOBILLO] }]
      brazo = -22
      ini = -18
      fin = 112
      fondo = [{ tipo: 'polea', anclaje: [36, SUELO - 8] }]
      break
    case 'arrastre':
      brazo = 0
      break
    case 'tumbado_polea':
      cadera = [124, SUELO - 10]
      tronco = -90
      piernas = pies(158, 4)
      brazo = 176
      ini = 180
      fin = 262
      fondo = [{ tipo: 'polea', anclaje: [hombro(cadera, tronco)[0] + 4, 14] }]
      break
  }
  const quieto: Brazo = o.postura === 'tumbado' || o.postura === 'tumbado_polea' ? { brazo: brazo, antebrazo: brazo + 2 } : { brazo: brazo, antebrazo: brazo + 3 }
  const brazos = (b: number, a: number): [Brazo, Brazo] => [{ brazo: b, antebrazo: a }, o.unilateral ? quieto : { brazo: b, antebrazo: a }]
  const brazoFin = o.postura === 'arrastre' ? -38 : o.postura === 'de_pie' || o.postura === 'sentado' ? brazo + 10 : brazo
  const polea: Equipo[] = o.carga === 'polea' && o.postura !== 'bayesiano' && o.postura !== 'tumbado_polea' ? [{ tipo: 'polea', anclaje: [hombro(cadera, tronco)[0] + 46, SUELO - 8] }] : []
  return {
    patron: `curl ${o.postura}`,
    vista: 'lateral',
    claves: [lat({ cadera, tronco, piernas, brazos: brazos(brazo, ini) }), lat({ cadera, tronco, piernas, brazos: brazos(brazoFin, fin) })],
    equipo: [...fondo, ...polea, ...eq],
  }
}

/** Muñecas: el antebrazo quieto y la mano que sube y baja. */
export function muneca(o: { postura: 'sentado' | 'banco' | 'detras' | 'de_pie' | 'polea'; carga: Carga; flexion: boolean; unilateral?: boolean }): Animacion {
  let cadera: P = DE_PIE
  let tronco = 179
  let piernas: [Pierna, Pierna] = pies()
  let brazo: Brazo = { brazo: 2, antebrazo: 3 }
  let ini = -45
  let fin = 45
  if (o.postura === 'sentado' || o.postura === 'polea') {
    ;({ cadera, piernas } = sentadoEn(X - 14))
    tronco = 146
    brazo = { brazo: 28, antebrazo: 88 }
    ;[ini, fin] = o.flexion ? [-50, 40] : [40, -50]
  } else if (o.postura === 'banco') {
    const rodilla: P = [X - 6, SUELO - 5]
    cadera = [X - 8, rodilla[1] - L.muslo]
    piernas = ambos<Pierna>({ muslo: angulo(cadera, rodilla), tibia: -90, pie: -180 })
    tronco = 132
    brazo = { brazo: 36, antebrazo: 88 }
    ;[ini, fin] = o.flexion ? [-50, 40] : [40, -50]
  } else if (o.postura === 'detras') {
    brazo = { brazo: -4, antebrazo: -4 }
    ;[ini, fin] = [10, -50]
  } else {
    ;[ini, fin] = [-8, 30]
  }
  const conMuneca = (m: number): Brazo => ({ ...brazo, muneca: m })
  const claves = [ini, fin].map((m) => lat({ cadera, tronco, piernas, brazos: [conMuneca(m), o.unilateral ? { ...brazo, muneca: 0 } : conMuneca(m)] }))
  const equipo: Equipo[] = [...material(o.unilateral && o.carga === 'mancuernas' ? 'mancuerna' : o.carga)]
  if (o.postura === 'polea') equipo.push({ tipo: 'polea', anclaje: [X + 60, SUELO - 6] })
  if (o.postura === 'sentado' || o.postura === 'polea') equipo.unshift({ tipo: 'banco', asiento: [[cadera[0] - 14, cadera[1] + 9], [cadera[0] + 14, cadera[1] + 9]] })
  if (o.postura === 'banco') equipo.unshift({ tipo: 'banco', asiento: [[X - 4, 128], [X + 70, 128]] })
  return { patron: 'muñeca', vista: 'lateral', claves, equipo }
}

// ── Extensión de tríceps ────────────────────────────────────────────────────────────────────

export type PosturaExtension = 'polea_alta' | 'sobre_cabeza' | 'sobre_cabeza_sentado' | 'polea_espalda' | 'tumbado' | 'declinado' | 'inclinado' | 'patada' | 'patada_sentado' | 'patada_banco' | 'tumbado_polea'

export function extension(o: { postura: PosturaExtension; carga: Carga; unilateral?: boolean }): Animacion {
  const eq = material(o.unilateral && o.carga === 'mancuernas' ? 'mancuerna' : o.carga)
  let cadera: P = DE_PIE
  let tronco = 179
  let piernas: [Pierna, Pierna] = pies()
  let brazo = 5
  let ini = 112
  let fin = 6
  let quieto: Brazo = { brazo: 3, antebrazo: 5 }
  const equipo: Equipo[] = []
  switch (o.postura) {
    case 'polea_alta': {
      tronco = 172
      piernas = [{ tobillo: [X + 4, TOBILLO] }, { tobillo: [X - 8, TOBILLO] }]
      equipo.push({ tipo: 'polea', anclaje: [hombro(cadera, tronco)[0] + 30, 16] })
      break
    }
    case 'sobre_cabeza':
    case 'sobre_cabeza_sentado':
    case 'polea_espalda': {
      if (o.postura === 'sobre_cabeza_sentado') {
        ;({ cadera, piernas } = sentadoEn(X - 8))
        equipo.push({ tipo: 'banco', asiento: [[cadera[0] - 12, cadera[1] + 9], [cadera[0] + 14, cadera[1] + 9]], respaldo: [[cadera[0] - 12, cadera[1] + 8], [cadera[0] - 12, cadera[1] - 40]] })
      }
      if (o.postura === 'polea_espalda') {
        tronco = 150
        cadera = [X - 4, DE_PIE[1] + 4]
        piernas = [{ tobillo: [X + 14, TOBILLO] }, { tobillo: [X - 22, TOBILLO] }]
        brazo = 156
        ini = -28
        fin = -198
        equipo.push({ tipo: 'polea', anclaje: [X - 60, 30] })
      } else {
        brazo = 172
        ini = -18
        fin = -186
      }
      quieto = { brazo: 3, antebrazo: 5 }
      break
    }
    case 'tumbado':
    case 'declinado':
    case 'inclinado':
    case 'tumbado_polea': {
      tronco = o.postura === 'declinado' ? -76 : o.postura === 'inclinado' ? -128 : -90
      cadera = o.postura === 'tumbado_polea' ? [124, SUELO - 10] : o.postura === 'inclinado' ? [126, 126] : o.postura === 'declinado' ? [118, 118] : [124, 124]
      piernas = o.postura === 'declinado' ? [{ tobillo: [cadera[0] + 26, 150] }, { tobillo: [cadera[0] + 23, 150] }] : pies(cadera[0] + 34, 4)
      brazo = tronco + 282
      ini = tronco + 34
      fin = tronco - 80
      quieto = { brazo: tronco + 135, antebrazo: tronco + 135 }
      if (o.postura === 'tumbado') equipo.push(bancoBajo(cadera, tronco, -0.35))
      if (o.postura === 'declinado') equipo.push(bancoBajo(cadera, tronco, -0.5, 1.15), { tipo: 'rodillo', c: [cadera[0] + 30, 144] })
      if (o.postura === 'inclinado')
        equipo.push({ tipo: 'banco', asiento: [[cadera[0] + 14, cadera[1] + 12], [cadera[0] - 6, cadera[1] + 12]], respaldo: [enTronco(cadera, tronco, 0, -11), enTronco(cadera, tronco, 1.2, -11)] })
      if (o.postura === 'tumbado_polea' || o.carga === 'polea') equipo.push({ tipo: 'polea', anclaje: [hombro(cadera, tronco)[0] - 40, SUELO - 8] })
      break
    }
    case 'patada':
    case 'patada_sentado':
    case 'patada_banco': {
      if (o.postura === 'patada_sentado') {
        ;({ cadera, piernas } = sentadoEn(X - 14))
        tronco = 124
        equipo.push({ tipo: 'banco', asiento: [[cadera[0] - 14, cadera[1] + 9], [cadera[0] + 12, cadera[1] + 9]] })
      } else if (o.postura === 'patada_banco') {
        cadera = [82, 92]
        tronco = 93
        piernas = [{ tobillo: [76, TOBILLO] }, { muslo: 2, tibia: -90 }]
        equipo.push({ tipo: 'banco', asiento: [[38, 134], [146, 134]] })
      } else {
        cadera = [X - 24, 102]
        tronco = 110
      }
      brazo = -82 + (tronco - 110) * 0.3
      ini = 2
      fin = brazo - 4
      quieto = o.postura === 'patada_banco' ? { brazo: 2, antebrazo: 2 } : { brazo: 4, antebrazo: 6 }
      if (o.carga === 'polea') equipo.push({ tipo: 'polea', anclaje: [hombro(cadera, tronco)[0] + 40, SUELO - 8] })
      break
    }
  }
  const brazos = (a: number): [Brazo, Brazo] => [{ brazo, antebrazo: a }, o.unilateral ? quieto : { brazo, antebrazo: a }]
  return {
    patron: `extensión ${o.postura}`,
    vista: 'lateral',
    claves: [lat({ cadera, tronco, piernas, brazos: brazos(ini) }), lat({ cadera, tronco, piernas, brazos: brazos(fin) })],
    equipo: [...equipo, ...eq],
  }
}

// ── Aperturas ───────────────────────────────────────────────────────────────────────────────

export function aperturas(o: { postura: 'banco' | 'inclinado' | 'declinado' | 'polea_alta' | 'polea_baja' | 'polea_banco'; carga: Carga; unilateral?: boolean }): Animacion {
  if (o.postura === 'polea_alta' || o.postura === 'polea_baja') {
    const alta = o.postura === 'polea_alta'
    const cadera: P = [X, DE_PIE[1] + 3]
    const piernas: [PiernaF, PiernaF] = [{ tobillo: [X + 14, TOBILLO] }, { tobillo: [X - 14, TOBILLO] }]
    const ini: BrazoF = alta ? { brazo: 118, antebrazo: 112 } : { brazo: 36, antebrazo: 30 }
    const fin: BrazoF = alta ? { brazo: -22, antebrazo: -34, escala: 0.9 } : { brazo: -52, antebrazo: -96, escala: 0.72, escalaAntebrazo: 0.8 }
    const quieto: BrazoF = { brazo: 14, antebrazo: 10 }
    const brazos = (b: BrazoF): [BrazoF, BrazoF] => [b, o.unilateral ? quieto : b]
    const y = alta ? 26 : SUELO - 8
    return {
      patron: alta ? 'cruce de poleas' : 'cruce de poleas desde abajo',
      vista: 'frontal',
      claves: [
        { cadera, tronco: 180, escalaTronco: 0.96, piernas, brazos: brazos(ini) },
        { cadera, tronco: 180, escalaTronco: 0.96, piernas, brazos: brazos(fin) },
      ],
      equipo: [{ tipo: 'polea', anclaje: [20, y], ...(o.unilateral ? { a: 'mano0' as const, anclaje: [180, y] as P } : { anclaje2: [180, y] as P }) }],
    }
  }
  // Tumbado en el banco, visto desde arriba.
  const escalaTronco = o.postura === 'inclinado' ? 0.82 : 1
  const cadera: P = [X, 128]
  const piernas: [PiernaF, PiernaF] = [{ muslo: 14, tibia: 10, escala: 0.75 }, { muslo: 14, tibia: 10, escala: 0.75 }]
  const cerrado: BrazoF = { brazo: 88, antebrazo: 90, escala: 0.2, escalaAntebrazo: 0.22 }
  const abierto: BrazoF = { brazo: 96, antebrazo: 104, escala: 1, escalaAntebrazo: 0.95 }
  const quieto: BrazoF = { brazo: -30, antebrazo: -80, escala: 0.8 }
  const brazos = (b: BrazoF): [BrazoF, BrazoF] => [b, o.unilateral ? quieto : b]
  const equipo: Equipo[] = [{ tipo: 'banco', asiento: [[X, cadera[1] + 12], [X, cadera[1] - 64]] }, ...material(o.unilateral && o.carga === 'mancuernas' ? 'mancuerna' : o.carga)]
  if (o.postura === 'polea_banco') equipo.push({ tipo: 'polea', anclaje: [24, 74], anclaje2: [176, 74] })
  return {
    patron: 'aperturas en banco',
    vista: 'cenital',
    claves: [
      { cadera, tronco: 180, escalaTronco, piernas, brazos: brazos(cerrado) },
      { cadera, tronco: 180, escalaTronco, piernas, brazos: brazos(abierto) },
    ],
    equipo: equipo.filter((e) => e.tipo !== 'polea' || o.postura === 'polea_banco'),
  }
}

// ── Elevaciones de hombro ───────────────────────────────────────────────────────────────────

export type TipoElevacion = 'lateral' | 'lateral_sentado' | 'lateral_polea' | 'frontal' | 'frontal_alta' | 'frontal_prono' | 'posterior' | 'posterior_sentado' | 'posterior_polea' | 'y' | 'protraccion'

export function elevacion(o: { tipo: TipoElevacion; carga: Carga; unilateral?: boolean; parcial?: boolean }): Animacion {
  if (o.tipo === 'frontal' || o.tipo === 'frontal_alta' || o.tipo === 'frontal_prono' || o.tipo === 'protraccion') {
    if (o.tipo === 'protraccion') {
      const cadera: P = [126, 126]
      const tronco = -128
      const brazos = ambos<Brazo>({ rel: [57, 0] })
      const piernas = pies(160, 4)
      return {
        patron: 'protracción de hombros',
        vista: 'lateral',
        claves: [lat({ cadera, tronco, piernas, brazos, escapula: [0, 0] }), lat({ cadera, tronco, piernas, brazos, escapula: [7, 0] })],
        equipo: [
          { tipo: 'banco', asiento: [[cadera[0] + 14, cadera[1] + 12], [cadera[0] - 6, cadera[1] + 12]], respaldo: [enTronco(cadera, tronco, 0, -11), enTronco(cadera, tronco, 1.2, -11)] },
          ...material(o.carga),
        ],
      }
    }
    const prono = o.tipo === 'frontal_prono'
    const cadera: P = prono ? [84, 118] : DE_PIE
    const tronco = prono ? 136 : 179
    const piernas = prono ? pies(64, 4) : pies()
    const fin = o.tipo === 'frontal_alta' ? 174 : prono ? 150 : 94
    const ini = prono ? 2 : 6
    const brazos = (a: number): [Brazo, Brazo] => [{ brazo: a, antebrazo: a + 3 }, o.unilateral ? { brazo: 4, antebrazo: 6 } : { brazo: a, antebrazo: a + 3 }]
    const equipo: Equipo[] = [...(prono ? [bancoBajo(cadera, tronco, 0.1, 1.05, -11)] : []), ...material(o.unilateral && o.carga === 'mancuernas' ? 'mancuerna' : o.carga)]
    if (o.carga === 'polea') equipo.push({ tipo: 'polea', anclaje: [X - 30, SUELO - 6] })
    return { patron: 'elevación frontal', vista: 'lateral', claves: [lat({ cadera, tronco, piernas, brazos: brazos(ini) }), lat({ cadera, tronco, piernas, brazos: brazos(fin) })], equipo }
  }

  const dorsal = o.tipo.startsWith('posterior')
  const sentado = o.tipo === 'lateral_sentado' || o.tipo === 'posterior_sentado'
  const inclinado = o.tipo === 'posterior' || o.tipo === 'posterior_sentado'
  const cadera: P = sentado ? [X, 132] : [X, DE_PIE[1] + (inclinado ? 6 : 0)]
  const piernas: [PiernaF, PiernaF] = sentado
    ? [{ muslo: 8, tibia: 3, escala: 0.9 }, { muslo: 8, tibia: 3, escala: 0.9 }]
    : [{ tobillo: [X + 13, TOBILLO] }, { tobillo: [X - 13, TOBILLO] }]
  const [ini, fin] = o.tipo === 'y' ? [18, 150] : o.parcial ? [50, 92] : o.tipo === 'lateral_polea' ? [-12, 88] : o.tipo === 'posterior_polea' ? [-30, 86] : [10, 88]
  const b = (a: number): BrazoF => ({ brazo: a, antebrazo: a + (o.tipo === 'y' ? 2 : 5), escala: inclinado ? 0.92 : 1 })
  const quieto: BrazoF = { brazo: 5, antebrazo: 6 }
  const brazos = (a: number): [BrazoF, BrazoF] => [b(a), o.unilateral ? quieto : b(a)]
  const control = (a: number): ControlFrontal => ({ cadera, tronco: 180, escalaTronco: inclinado ? 0.7 : 1, cabeza: 0, piernas: sentado ? piernasSentado(cadera) : piernas, brazos: brazos(a) })
  const equipo: Equipo[] = [...material(o.unilateral && o.carga === 'mancuernas' ? 'mancuerna' : o.carga)]
  if (o.tipo === 'lateral_polea') equipo.push({ tipo: 'polea', anclaje: [36, SUELO - 6], a: 'mano0' })
  if (o.tipo === 'posterior_polea') equipo.push({ tipo: 'polea', anclaje: [26, 64], anclaje2: [174, 64] })
  if (sentado) equipo.unshift({ tipo: 'banco', asiento: [[X - 22, cadera[1] + 10], [X + 22, cadera[1] + 10]] })
  return { patron: dorsal ? 'pájaros' : o.tipo === 'y' ? 'elevación en Y' : 'elevación lateral', vista: dorsal ? 'dorsal' : 'frontal', claves: [control(ini), control(fin)], equipo }
}

const piernasSentado = (cadera: P): [PiernaF, PiernaF] => {
  const y = TOBILLO - cadera[1]
  return [{ tobillo: [X + 16, cadera[1] + y] }, { tobillo: [X - 16, cadera[1] + y] }]
}

/** Rotación del hombro con el codo pegado al cuerpo (de frente). */
export function rotacion(o: { externa: boolean; carga: Carga }): Animacion {
  const cadera: P = [X, DE_PIE[1] + 2]
  const piernas: [PiernaF, PiernaF] = [{ tobillo: [X + 12, TOBILLO] }, { tobillo: [X - 12, TOBILLO] }]
  const dentro: BrazoF = { brazo: 4, antebrazo: -70, escalaAntebrazo: 0.7 }
  const delante: BrazoF = { brazo: 4, antebrazo: 30, escalaAntebrazo: 0.28 }
  const fuera: BrazoF = { brazo: 4, antebrazo: 88, escalaAntebrazo: 0.9 }
  const quieto: BrazoF = { brazo: 4, antebrazo: 5 }
  const [a, b] = o.externa ? [delante, fuera] : [fuera, dentro]
  return {
    patron: o.externa ? 'rotación externa' : 'rotación interna',
    vista: 'frontal',
    claves: [
      { cadera, tronco: 180, piernas, brazos: [a, quieto] },
      { cadera, tronco: 180, piernas, brazos: [b, quieto] },
    ],
    equipo: o.carga === 'polea' ? [{ tipo: 'polea', anclaje: o.externa ? [30, 100] : [178, 100], a: 'mano0' }] : material('mancuerna'),
  }
}

/** Remo al mentón (de frente). */
export function remoMenton(o: { carga: Carga; unilateral?: boolean }): Animacion {
  const cadera: P = [X, DE_PIE[1] + 2]
  const piernas: [PiernaF, PiernaF] = [{ tobillo: [X + 12, TOBILLO] }, { tobillo: [X - 12, TOBILLO] }]
  const abajo = (s: number): BrazoF => ({ mano: [X + s * 9, 110], doblez: 1 })
  const arriba = (s: number): BrazoF => ({ mano: [X + s * 7, 50], doblez: 1 })
  const quieto: BrazoF = { mano: [X - 24, 104], doblez: 1 }
  return {
    patron: 'remo al mentón',
    vista: 'frontal',
    claves: [
      { cadera, tronco: 180, piernas, brazos: [abajo(1), o.unilateral ? quieto : abajo(-1)] },
      { cadera, tronco: 180, piernas, brazos: [arriba(1), o.unilateral ? quieto : arriba(-1)] },
    ],
    equipo: o.carga === 'polea' ? [{ tipo: 'polea', anclaje: [X, SUELO - 6] }] : material(o.unilateral && o.carga === 'mancuernas' ? 'mancuerna' : o.carga),
  }
}

// ── Encogimientos ───────────────────────────────────────────────────────────────────────────

export function encogimiento(o: { carga: Carga; detras?: boolean; escapular?: boolean }): Animacion {
  const cadera: P = [X, DE_PIE[1] + 2]
  const piernas: [PiernaF, PiernaF] = [{ tobillo: [X + 12, TOBILLO] }, { tobillo: [X - 12, TOBILLO] }]
  if (o.escapular) {
    const brazos = ambos<BrazoF>({ brazo: 6, antebrazo: 6, escala: 0.8 })
    return {
      patron: 'retracción escapular',
      vista: 'dorsal',
      claves: [
        { cadera, tronco: 180, escalaTronco: 0.72, piernas, brazos, retraccion: 0 },
        { cadera, tronco: 180, escalaTronco: 0.72, piernas, brazos, retraccion: 5 },
      ],
      equipo: material(o.carga),
    }
  }
  const sep = o.carga === 'mancuernas' ? 10 : 5
  const brazos = ambos<BrazoF>({ brazo: sep, antebrazo: sep - 2 })
  const equipo: Equipo[] = o.carga === 'polea' ? [{ tipo: 'polea', anclaje: [36, SUELO - 6], anclaje2: [164, SUELO - 6] }] : material(o.carga)
  return {
    patron: 'encogimientos',
    vista: o.detras ? 'dorsal' : 'frontal',
    claves: [
      { cadera, tronco: 180, piernas, brazos, encogimiento: 0 },
      { cadera, tronco: 180, piernas, brazos, encogimiento: 9 },
    ],
    equipo,
  }
}

// ── Sentadilla ──────────────────────────────────────────────────────────────────────────────

export type CargaSentadilla = 'espalda' | 'frontal' | 'goblet' | 'mancuernas' | 'overhead' | 'zercher' | 'hack' | 'landmine' | 'colgando' | 'multipower' | 'multipower_frontal' | 'brazos_delante'

/** Brazos según dónde va la carga en la sentadilla y similares. */
function brazosCarga(carga: CargaSentadilla, cadera: P, tronco: number): [Brazo, Brazo] {
  const S = hombro(cadera, tronco)
  switch (carga) {
    case 'espalda':
    case 'multipower':
      return [{ rel: [-6, 4], doblez: -1 }, { rel: [-6, 4], doblez: -1 }]
    case 'frontal':
    case 'multipower_frontal':
      return [{ rel: [8, 1], doblez: 1 }, { rel: [8, 1], doblez: 1 }]
    case 'brazos_delante':
      return [{ rel: [52, -2], doblez: -1 }, { rel: [52, -2], doblez: -1 }]
    case 'goblet':
    case 'landmine':
      return [{ rel: [13, -16], doblez: -1 }, { rel: [12, -16], doblez: -1 }]
    case 'zercher':
      return [{ rel: [16, -30], doblez: -1 }, { rel: [15, -30], doblez: -1 }]
    case 'overhead':
      return [{ rel: [-3, 57] }, { rel: [-3, 57] }]
    case 'hack':
      return [{ mano: mas(S, [-6, 54]), doblez: -1 }, { mano: mas(S, [-8, 54]), doblez: -1 }]
    case 'mancuernas':
    case 'colgando':
      return [{ mano: mas(S, [2, 55]), doblez: -1 }, { mano: mas(S, [0, 55]), doblez: -1 }]
  }
}

function equipoCarga(carga: CargaSentadilla): Equipo[] {
  switch (carga) {
    case 'espalda':
    case 'frontal':
    case 'overhead':
    case 'zercher':
    case 'hack':
    case 'brazos_delante':
      return [{ tipo: 'barra' }]
    case 'multipower':
    case 'multipower_frontal':
      return [{ tipo: 'multipower' }]
    case 'goblet':
      return [{ tipo: 'mancuernas', manos: [0] }]
    case 'colgando':
      return [{ tipo: 'mancuernas', manos: [0] }]
    case 'mancuernas':
      return [{ tipo: 'mancuernas' }]
    case 'landmine':
      return [{ tipo: 'landmine', pivote: [X + 150, SUELO - 2] }]
  }
}

export function sentadilla(o: { carga: CargaSentadilla; profunda?: boolean; caja?: boolean; variante?: 'normal' | 'pistol' | 'sissy' | 'rodillas' }): Animacion {
  const variante = o.variante ?? 'normal'
  const erguido = ['frontal', 'multipower_frontal', 'goblet', 'zercher', 'overhead', 'landmine', 'brazos_delante'].includes(o.carga)
  const multipower = o.carga === 'multipower' || o.carga === 'multipower_frontal'
  const pieX = multipower ? X + 10 : X

  if (variante === 'rodillas') {
    const rodilla: P = [X, SUELO - 5]
    const arriba: P = [X - 1, rodilla[1] - L.muslo]
    const abajo: P = desde(rodilla, -142, L.muslo)
    const piernas = (c: P): [Pierna, Pierna] => ambos<Pierna>({ muslo: angulo(c, rodilla), tibia: -90, pie: -180 })
    return {
      patron: 'sentadilla de rodillas',
      vista: 'lateral',
      claves: [lat({ cadera: abajo, tronco: 160, piernas: piernas(abajo), brazos: brazosCarga(o.carga, abajo, 160) }), lat({ cadera: arriba, tronco: 179, piernas: piernas(arriba), brazos: brazosCarga(o.carga, arriba, 179) })],
      equipo: equipoCarga(o.carga),
    }
  }
  if (variante === 'sissy') {
    const piernasArriba: [Pierna, Pierna] = [{ tobillo: [X, TOBILLO], punta: [X + 14, SUELO - 1] }, { tobillo: [X - 3, TOBILLO], punta: [X + 11, SUELO - 1] }]
    const piernasAbajo: [Pierna, Pierna] = [{ tobillo: [X + 5, TOBILLO - 8], punta: [X + 14, SUELO - 1] }, { tobillo: [X + 2, TOBILLO - 8], punta: [X + 11, SUELO - 1] }]
    const abajo: P = [X - 2, 136]
    return {
      patron: 'sentadilla sissy',
      vista: 'lateral',
      claves: [lat({ cadera: DE_PIE, tronco: 180, piernas: piernasArriba, brazos: brazosCarga('goblet', DE_PIE, 180) }), lat({ cadera: abajo, tronco: 208, piernas: piernasAbajo, brazos: brazosCarga('goblet', abajo, 208) })],
      equipo: [{ tipo: 'disco' }],
    }
  }

  const arriba: P = [pieX - 1, DE_PIE[1]]
  let abajo: P = o.profunda ? [pieX - 20, 148] : [pieX - 24, 135]
  let troncoAbajo = erguido ? (o.profunda ? 160 : 156) : o.carga === 'hack' ? 156 : o.profunda ? 148 : 140
  if (multipower) {
    // La barra sube y baja en vertical: los hombros no se mueven de x.
    troncoAbajo = 158
    abajo = [arriba[0] - L.tronco * Math.sin((troncoAbajo * Math.PI) / 180), abajo[1]]
  }
  const piernas = (): [Pierna, Pierna] => {
    if (variante === 'pistol') return [{ tobillo: [pieX, TOBILLO] }, { tobillo: [pieX + 46, TOBILLO - 26] }]
    return pies(pieX)
  }
  const piernasArriba: [Pierna, Pierna] = variante === 'pistol' ? [{ tobillo: [pieX, TOBILLO] }, { tobillo: [pieX + 16, TOBILLO - 12] }] : pies(pieX)
  const equipo = equipoCarga(o.carga)
  if (o.caja) equipo.unshift({ tipo: 'caja', x: abajo[0] - 18, y: abajo[1] + 10, ancho: 28 })
  return {
    patron: variante === 'pistol' ? 'sentadilla a una pierna' : 'sentadilla',
    vista: 'lateral',
    claves: [
      lat({ cadera: arriba, tronco: 178, piernas: piernasArriba, brazos: brazosCarga(o.carga, arriba, 178) }),
      lat({ cadera: abajo, tronco: troncoAbajo, piernas: piernas(), brazos: brazosCarga(o.carga, abajo, troncoAbajo) }),
    ],
    equipo,
  }
}

/** Prensa tumbado bajo el multipower: empuja la barra con los pies. */
export function prensaMultipower(): Animacion {
  const cadera: P = [124, SUELO - 10]
  const tronco = -90
  const brazos = ambos<Brazo>({ brazo: 86, antebrazo: 90 })
  return {
    patron: 'prensa en multipower',
    vista: 'lateral',
    claves: [
      lat({ cadera, tronco, brazos, piernas: ambos<Pierna>({ tobillo: [cadera[0] + 4, cadera[1] - 42] }) }),
      lat({ cadera, tronco, brazos, piernas: ambos<Pierna>({ tobillo: [cadera[0] + 8, cadera[1] - 77] }) }),
    ],
    equipo: [{ tipo: 'multipower', en: 'pies' }],
  }
}

// ── Bisagra de cadera ───────────────────────────────────────────────────────────────────────

export type TipoBisagra = 'peso_muerto' | 'sumo' | 'deficit' | 'rack' | 'rumano' | 'rigidas' | 'buenos_dias' | 'buenos_dias_sentado' | 'una_pierna' | 'pull_through' | 'polea'

export function bisagra(o: { tipo: TipoBisagra; carga: Carga }): Animacion {
  const multipower = o.carga === 'multipower'
  const eq = material(o.carga === 'mancuernas' ? 'mancuernas' : o.carga === 'polea' ? 'ninguna' : o.carga)
  const piernas = pies()
  const colgado = (c: P, t: number): [Brazo, Brazo] => {
    const S = hombro(c, t)
    return [{ mano: mas(S, [2, 55]), doblez: -1 }, { mano: mas(S, [0, 55]), doblez: -1 }]
  }
  switch (o.tipo) {
    case 'peso_muerto':
    case 'sumo':
    case 'deficit':
    case 'rack':
    case 'polea': {
      const deficit = o.tipo === 'deficit'
      const y = deficit ? TOBILLO - 8 : TOBILLO
      const abajo: P = o.tipo === 'rack' ? [X - 22, 110] : o.tipo === 'sumo' ? [X - 22, 136] : [X - 30, deficit ? 130 : 134]
      const tAbajo = o.tipo === 'rack' ? 140 : o.tipo === 'sumo' ? 140 : 128
      const arriba: P = [X - 1, y - L.muslo - L.tibia + 0.6]
      const equipo: Equipo[] = [...eq]
      if (deficit) equipo.unshift({ tipo: 'caja', x: X - 26, y: SUELO - 8, ancho: 60 })
      if (o.tipo === 'polea') equipo.push({ tipo: 'polea', anclaje: [X + 40, SUELO - 6] })
      return {
        patron: o.tipo === 'rack' ? 'rack pull' : 'peso muerto',
        vista: 'lateral',
        claves: [lat({ cadera: abajo, tronco: tAbajo, piernas: pies(X, 3, y), brazos: colgado(abajo, tAbajo) }), lat({ cadera: arriba, tronco: 180, piernas: pies(X, 3, y), brazos: colgado(arriba, 180) })],
        equipo,
      }
    }
    case 'rumano':
    case 'rigidas': {
      const abajo: P = o.tipo === 'rumano' ? [X - 26, 104] : [X - 20, 99]
      const tAbajo = o.tipo === 'rumano' ? 110 : 104
      const brazos = (c: P, t: number): [Brazo, Brazo] => {
        if (!multipower) return colgado(c, t)
        const m: P = [hombro(DE_PIE, 180)[0] + 2, c === DE_PIE ? hombro(DE_PIE, 180)[1] + 55 : 146]
        return [{ mano: m, doblez: -1 }, { mano: mas(m, [-2, 0]), doblez: -1 }]
      }
      return {
        patron: 'peso muerto rumano',
        vista: 'lateral',
        claves: [lat({ cadera: DE_PIE, tronco: 180, piernas, brazos: brazos(DE_PIE, 180) }), lat({ cadera: abajo, tronco: tAbajo, piernas, brazos: brazos(abajo, tAbajo) })],
        equipo: eq,
      }
    }
    case 'una_pierna': {
      const abajo: P = [X - 14, 104]
      const t = 100
      return {
        patron: 'peso muerto a una pierna',
        vista: 'lateral',
        claves: [
          lat({ cadera: DE_PIE, tronco: 180, piernas: [{ tobillo: [X, TOBILLO] }, { muslo: -4, tibia: -10, pie: 80 }], brazos: colgado(DE_PIE, 180) }),
          lat({ cadera: abajo, tronco: t, piernas: [{ tobillo: [X, TOBILLO] }, { muslo: -80, tibia: -84, pie: -10 }], brazos: colgado(abajo, t) }),
        ],
        equipo: eq,
      }
    }
    case 'buenos_dias':
    case 'buenos_dias_sentado': {
      const sentado = o.tipo === 'buenos_dias_sentado'
      const { cadera, piernas: pS } = sentado ? sentadoEn(X - 8) : { cadera: DE_PIE, piernas }
      const abajo: P = sentado ? cadera : [X - 22, 100]
      const tAbajo = sentado ? 102 : 100
      const espalda: [Brazo, Brazo] = [{ rel: [-6, 4], doblez: -1 }, { rel: [-6, 4], doblez: -1 }]
      const equipo: Equipo[] = [...eq]
      if (sentado) equipo.unshift({ tipo: 'banco', asiento: [[cadera[0] - 12, cadera[1] + 9], [cadera[0] + 14, cadera[1] + 9]] })
      return {
        patron: 'buenos días',
        vista: 'lateral',
        claves: [lat({ cadera, tronco: 180, piernas: pS, brazos: espalda }), lat({ cadera: abajo, tronco: tAbajo, piernas: pS, brazos: espalda })],
        equipo,
      }
    }
    case 'pull_through': {
      const abajo: P = [X - 24, 104]
      const piernas2: [Pierna, Pierna] = [{ tobillo: [X + 6, TOBILLO] }, { tobillo: [X - 4, TOBILLO] }]
      return {
        patron: 'pull through',
        vista: 'lateral',
        claves: [
          lat({ cadera: abajo, tronco: 112, piernas: piernas2, brazos: ambos<Brazo>({ mano: [X - 6, 150], doblez: -1 }) }),
          lat({ cadera: DE_PIE, tronco: 180, piernas: piernas2, brazos: ambos<Brazo>({ mano: [X + 10, 112], doblez: -1 }) }),
        ],
        equipo: [{ tipo: 'polea', anclaje: [X - 70, SUELO - 6] }],
      }
    }
  }
}

// ── Puente de glúteo / hip thrust ───────────────────────────────────────────────────────────

export function puente(o: { banco: boolean; carga: Carga; unaPierna?: boolean }): Animacion {
  const S: P = o.banco ? [72, 126] : [62, SUELO - 10]
  const abajo: P = o.banco ? desde(S, 128, L.tronco) : desde(S, 92, L.tronco)
  const arriba: P = o.banco ? desde(S, 90, L.tronco) : desde(S, 120, L.tronco)
  const tobillo: P = [o.banco ? 140 : 132, TOBILLO]
  const pierna = (c: P): [Pierna, Pierna] => [{ tobillo }, o.unaPierna ? { tobillo: [c[0] + 34, c[1] - 24] } : { tobillo: [tobillo[0] - 3, TOBILLO] }]
  const control = (c: P): Control => {
    const tronco = angulo(c, S)
    const barra = mas(enTronco(c, tronco, 0.05, 13), [0, 0])
    const brazos: [Brazo, Brazo] = o.carga === 'ninguna' ? ambos<Brazo>({ brazo: tronco + 270, antebrazo: tronco + 270 }) : [{ mano: barra, doblez: -1 }, { mano: mas(barra, [-2, 0]), doblez: -1 }]
    return { cadera: c, tronco, piernas: pierna(c), brazos }
  }
  const equipo: Equipo[] = o.banco ? [{ tipo: 'banco', asiento: [[30, 134], [78, 134]] }] : []
  equipo.push(...material(o.carga === 'mancuernas' ? 'mancuerna' : o.carga))
  return { patron: o.banco ? 'hip thrust' : 'puente de glúteo', vista: 'lateral', claves: [control(abajo), control(arriba)], equipo }
}

// ── Zancadas ────────────────────────────────────────────────────────────────────────────────

export type TipoZancada = 'estatica' | 'atras' | 'adelante' | 'bulgara' | 'subida' | 'lateral' | 'elevada'

export function zancada(o: { tipo: TipoZancada; carga: CargaSentadilla }): Animacion {
  const equipo = equipoCarga(o.carga)
  if (o.tipo === 'lateral') {
    const arriba: P = [X, DE_PIE[1] + 6]
    const abajo: P = [X + 20, 128]
    const piernas: [PiernaF, PiernaF] = [{ tobillo: [X + 34, TOBILLO] }, { tobillo: [X - 34, TOBILLO] }]
    const brazos = (): [BrazoF, BrazoF] =>
      o.carga === 'espalda' ? [{ brazo: 150, antebrazo: -10 }, { brazo: 150, antebrazo: -10 }] : [{ brazo: 6, antebrazo: 4 }, { brazo: 6, antebrazo: 4 }]
    return {
      patron: 'zancada lateral',
      vista: 'frontal',
      claves: [
        { cadera: arriba, tronco: 180, piernas, brazos: brazos() },
        { cadera: abajo, tronco: 172, piernas, brazos: brazos() },
      ],
      equipo: o.carga === 'espalda' ? [{ tipo: 'barra' }] : [{ tipo: 'mancuernas' }],
    }
  }
  const vertical = o.carga === 'multipower' || o.carga === 'multipower_frontal'
  const delante: P = [X + 22, TOBILLO]
  if (o.tipo === 'subida') {
    const caja: Equipo = { tipo: 'caja', x: X + 6, y: 138, ancho: 36 }
    const sobre: P = [X + 22, 132]
    const abajo: P = [X - 4, 104]
    const arriba: P = [X + 18, sobre[1] - L.muslo - L.tibia + 0.6]
    return {
      patron: 'subida al banco',
      vista: 'lateral',
      claves: [
        lat({ cadera: abajo, tronco: 168, piernas: [{ tobillo: sobre }, { tobillo: [X - 10, TOBILLO] }], brazos: brazosCarga(o.carga, abajo, 168) }),
        lat({ cadera: arriba, tronco: 178, piernas: [{ tobillo: sobre }, { tobillo: [X + 10, 120] }], brazos: brazosCarga(o.carga, arriba, 178) }),
      ],
      equipo: [caja, ...equipo],
    }
  }
  const bulgara = o.tipo === 'bulgara'
  const atras: Pierna = bulgara ? { tobillo: [X - 44, 132], punta: [X - 58, 135] } : { tobillo: [X - 32, TOBILLO - 5], punta: [X - 18, SUELO - 1] }
  const juntos: Pierna = { tobillo: [X - 4, TOBILLO], punta: [X + 11, SUELO - 1] }
  const arriba: P = bulgara ? [X - 8, 106] : [X - 5, 102]
  const abajo: P = bulgara ? [X - 10, 136] : [X - 6, 136]
  const piernasArriba: [Pierna, Pierna] = o.tipo === 'atras' ? [{ tobillo: [X, TOBILLO] }, juntos] : [{ tobillo: delante }, atras]
  const caderaArriba = o.tipo === 'atras' ? DE_PIE : arriba
  const extra: Equipo[] = bulgara ? [{ tipo: 'banco', asiento: [[X - 72, 140], [X - 38, 140]] }] : o.tipo === 'elevada' ? [{ tipo: 'caja', x: X + 8, y: SUELO - 8, ancho: 30 }] : []
  const pieDelante: P = o.tipo === 'elevada' ? [X + 22, TOBILLO - 8] : delante
  return {
    patron: bulgara ? 'sentadilla búlgara' : 'zancada',
    vista: 'lateral',
    claves: [
      lat({ cadera: caderaArriba, tronco: 179, piernas: o.tipo === 'atras' ? piernasArriba : [{ tobillo: pieDelante }, atras], brazos: brazosCarga(o.carga, caderaArriba, 179) }),
      lat({ cadera: abajo, tronco: vertical ? 179 : 176, piernas: [{ tobillo: pieDelante }, atras], brazos: brazosCarga(o.carga, abajo, vertical ? 179 : 176) }),
    ],
    equipo: [...extra, ...equipo],
  }
}

// ── Jalón y pullover ────────────────────────────────────────────────────────────────────────

export function jalon(o: { tipo: 'pecho' | 'nuca' | 'brazos_rectos' | 'pullover' | 'pullover_doblado' | 'pullover_declinado'; carga: Carga; unilateral?: boolean }): Animacion {
  if (o.tipo === 'pecho' || o.tipo === 'nuca') {
    const cadera: P = [X - 10, 136]
    const piernas: [Pierna, Pierna] = ambos<Pierna>({ muslo: 88, tibia: 2 })
    const t = o.tipo === 'nuca' ? 176 : 192
    const S = hombro(cadera, t)
    const brazos = (m: P): [Brazo, Brazo] => [{ mano: m, doblez: -1 }, o.unilateral ? { brazo: 30, antebrazo: 70 } : { mano: mas(m, [-2, 0]), doblez: -1 }]
    const fin = o.tipo === 'nuca' ? mas(S, [-6, -8]) : enTronco(cadera, t, 0.96, 12)
    return {
      patron: 'jalón',
      vista: 'lateral',
      claves: [lat({ cadera, tronco: t, piernas, brazos: brazos(mas(S, [8, -56])) }), lat({ cadera, tronco: t, piernas, brazos: brazos(fin) })],
      equipo: [
        { tipo: 'polea', anclaje: [S[0] + 8, 10] },
        { tipo: 'banco', asiento: [[cadera[0] - 14, cadera[1] + 9], [cadera[0] + 18, cadera[1] + 9]] },
        { tipo: 'rodillo', c: [cadera[0] + 34, cadera[1] - 9] },
      ],
    }
  }
  if (o.tipo === 'brazos_rectos') {
    const cadera: P = [X - 8, DE_PIE[1] + 4]
    const t = 160
    const piernas: [Pierna, Pierna] = [{ tobillo: [X + 4, TOBILLO] }, { tobillo: [X - 8, TOBILLO] }]
    return {
      patron: 'jalón con brazos rectos',
      vista: 'lateral',
      claves: [
        lat({ cadera, tronco: t, piernas, brazos: ambos<Brazo>({ brazo: 150, antebrazo: 154 }) }),
        lat({ cadera, tronco: t, piernas, brazos: ambos<Brazo>({ brazo: 6, antebrazo: 8 }) }),
      ],
      equipo: [{ tipo: 'polea', anclaje: [hombro(cadera, t)[0] + 56, 14] }],
    }
  }
  const declinado = o.tipo === 'pullover_declinado'
  const tronco = declinado ? -76 : -90
  const cadera: P = declinado ? [118, 118] : [124, 124]
  const piernas: [Pierna, Pierna] = declinado ? [{ tobillo: [cadera[0] + 26, 150] }, { tobillo: [cadera[0] + 23, 150] }] : pies(cadera[0] + 34, 4)
  const doblado = o.tipo === 'pullover_doblado'
  const b = (a: number): Brazo => ({ brazo: a, antebrazo: a + (doblado ? 70 : 6) })
  return {
    patron: 'pullover',
    vista: 'lateral',
    claves: [lat({ cadera, tronco, piernas, brazos: ambos(b(tronco + 345)) }), lat({ cadera, tronco, piernas, brazos: ambos(b(tronco + 262)) })],
    equipo: [declinado ? bancoBajo(cadera, tronco, -0.5, 1.15) : bancoBajo(cadera, tronco, -0.35), ...material(o.carga === 'mancuernas' ? 'mancuerna' : o.carga)],
  }
}

// ── Gemelos ─────────────────────────────────────────────────────────────────────────────────

export function gemelos(o: { postura: 'de_pie' | 'sentado' | 'escalon'; carga: Carga | 'espalda' }): Animacion {
  if (o.postura === 'sentado') {
    const { cadera } = sentadoEn(X - 30)
    const punta: P = [X + 22, SUELO - 1]
    const abajo: [Pierna, Pierna] = [{ tobillo: [X + 8, TOBILLO], punta }, { tobillo: [X + 5, TOBILLO], punta: mas(punta, [-3, 0]) }]
    const arriba: [Pierna, Pierna] = [{ tobillo: [X + 10, TOBILLO - 9], punta }, { tobillo: [X + 7, TOBILLO - 9], punta: mas(punta, [-3, 0]) }]
    const manos = (dy: number): [Brazo, Brazo] => [{ mano: [X + 10, cadera[1] - 6 - dy], doblez: -1 }, { mano: [X + 8, cadera[1] - 6 - dy], doblez: -1 }]
    return {
      patron: 'gemelos sentado',
      vista: 'lateral',
      claves: [lat({ cadera, tronco: 172, piernas: abajo, brazos: manos(0) }), lat({ cadera, tronco: 172, piernas: arriba, brazos: manos(8) })],
      equipo: [{ tipo: 'banco', asiento: [[cadera[0] - 14, cadera[1] + 9], [cadera[0] + 14, cadera[1] + 9]] }, ...material(o.carga === 'espalda' ? 'barra' : o.carga === 'mancuernas' ? 'mancuerna' : o.carga)],
    }
  }
  const escalon = o.postura === 'escalon'
  const base = escalon ? SUELO - 9 : SUELO - 1
  const punta: P = [X + 13, base]
  const abajoY = escalon ? TOBILLO - 2 : TOBILLO
  const pierna = (y: number): [Pierna, Pierna] => [{ tobillo: [X, y], punta }, { tobillo: [X - 3, y], punta: mas(punta, [-3, 0]) }]
  const cadera = (y: number): P => [X - 1, y - L.muslo - L.tibia + 0.6]
  const brazos = (c: P): [Brazo, Brazo] =>
    o.carga === 'espalda' || o.carga === 'multipower' ? [{ rel: [-6, 4], doblez: -1 }, { rel: [-6, 4], doblez: -1 }] : brazosCarga('mancuernas', c, 180)
  const equipo: Equipo[] = o.carga === 'espalda' ? [{ tipo: 'barra' }] : material(o.carga)
  if (escalon) equipo.unshift({ tipo: 'caja', x: X + 2, y: SUELO - 8, ancho: 28 })
  const y1 = abajoY
  const y2 = abajoY - 12
  return {
    patron: 'elevación de gemelos',
    vista: 'lateral',
    claves: [lat({ cadera: cadera(y1), tronco: 180, piernas: pierna(y1), brazos: brazos(cadera(y1)) }), lat({ cadera: cadera(y2), tronco: 180, piernas: pierna(y2), brazos: brazos(cadera(y2)) })],
    equipo,
  }
}

// ── Abdominales y oblicuos ──────────────────────────────────────────────────────────────────

export type TipoAbdominal = 'crunch_polea' | 'crunch_pie' | 'crunch_sentado' | 'crunch_suelo' | 'inverso' | 'press_situp' | 'rollout' | 'rollout_pie'

export function abdominal(o: { tipo: TipoAbdominal; carga: Carga }): Animacion {
  switch (o.tipo) {
    case 'crunch_polea': {
      const rodilla: P = [X, SUELO - 5]
      const c1: P = [X - 2, rodilla[1] - L.muslo]
      const c2: P = desde(rodilla, 194, L.muslo)
      const piernas = (c: P): [Pierna, Pierna] => ambos<Pierna>({ muslo: angulo(c, rodilla), tibia: -90, pie: -180 })
      const cabeza: [Brazo, Brazo] = ambos<Brazo>({ rel: [8, 9], doblez: -1 })
      return {
        patron: 'crunch en polea',
        vista: 'lateral',
        claves: [lat({ cadera: c1, tronco: 176, cabeza: 0, piernas: piernas(c1), brazos: cabeza }), lat({ cadera: c2, tronco: 112, cabeza: 28, piernas: piernas(c2), brazos: cabeza })],
        equipo: [{ tipo: 'polea', anclaje: [X + 38, 14] }],
      }
    }
    case 'crunch_pie':
    case 'crunch_sentado': {
      const sentado = o.tipo === 'crunch_sentado'
      const { cadera, piernas } = sentado ? sentadoEn(X - 8) : { cadera: DE_PIE, piernas: pies() }
      const cabeza: [Brazo, Brazo] = ambos<Brazo>({ rel: [8, 9], doblez: -1 })
      const equipo: Equipo[] = [{ tipo: 'polea', anclaje: [X - 40, 14] }]
      if (sentado) equipo.unshift({ tipo: 'banco', asiento: [[cadera[0] - 12, cadera[1] + 9], [cadera[0] + 14, cadera[1] + 9]] })
      return {
        patron: 'crunch',
        vista: 'lateral',
        claves: [lat({ cadera, tronco: 178, cabeza: 0, piernas, brazos: cabeza }), lat({ cadera, tronco: 130, cabeza: 26, piernas, brazos: cabeza })],
        equipo,
      }
    }
    case 'crunch_suelo':
    case 'press_situp': {
      const press = o.tipo === 'press_situp'
      const cadera: P = [124, SUELO - 10]
      const piernas = pies(cadera[0] + 30, 4)
      const brazos = (t: number): [Brazo, Brazo] => (press ? ambos<Brazo>({ rel: [t === -90 ? 14 : 57, t === -90 ? -10 : 0], doblez: -1 }) : ambos<Brazo>({ rel: [12, -6], doblez: -1 }))
      const t2 = press ? -150 : -118
      return {
        patron: press ? 'abdominal con press' : 'crunch',
        vista: 'lateral',
        claves: [lat({ cadera, tronco: -90, cabeza: 0, piernas, brazos: brazos(-90) }), lat({ cadera, tronco: t2, cabeza: -20, piernas, brazos: brazos(t2) })],
        equipo: material(o.carga),
      }
    }
    case 'inverso': {
      const cadera: P = [118, SUELO - 10]
      const brazos = ambos<Brazo>({ brazo: 86, antebrazo: 90 })
      return {
        patron: 'crunch inverso',
        vista: 'lateral',
        claves: [
          lat({ cadera, tronco: -90, piernas: ambos<Pierna>({ muslo: 140, tibia: 92 }), brazos }),
          lat({ cadera: mas(cadera, [-2, -4]), tronco: -96, piernas: ambos<Pierna>({ muslo: 212, tibia: 120 }), brazos }),
        ],
        equipo: o.carga === 'polea' ? [{ tipo: 'polea', anclaje: [180, SUELO - 6], a: 'tobillo0' }] : material(o.carga),
      }
    }
    case 'rollout':
    case 'rollout_pie': {
      const pie = o.tipo === 'rollout_pie'
      const rodilla: P = [X - 20, SUELO - 5]
      const c1: P = pie ? [X - 20, 98] : [rodilla[0] - 2, rodilla[1] - L.muslo]
      const c2: P = pie ? [X + 6, 128] : desde(rodilla, 146, L.muslo)
      const piernas = (c: P): [Pierna, Pierna] => (pie ? pies(X - 30) : ambos<Pierna>({ muslo: angulo(c, rodilla), tibia: -90, pie: -180 }))
      const t1 = pie ? 98 : 140
      const t2 = pie ? 98 : 102
      const S1 = hombro(c1, t1)
      const S2 = hombro(c2, t2)
      return {
        patron: 'rodillo abdominal',
        vista: 'lateral',
        claves: [
          lat({ cadera: c1, tronco: t1, piernas: piernas(c1), brazos: ambos<Brazo>({ mano: [S1[0] + 4, SUELO - 20], doblez: -1 }) }),
          lat({ cadera: c2, tronco: t2, piernas: piernas(c2), brazos: ambos<Brazo>({ mano: [S2[0] + 54, SUELO - 20], doblez: -1 }) }),
        ],
        equipo: [{ tipo: 'barra' }],
      }
    }
  }
}

export function giroTronco(o: { tipo: 'sentado' | 'de_pie' | 'lenador' | 'lenador_inverso' | 'landmine' | 'inclinacion'; carga: Carga }): Animacion {
  const dePie: P = [X, DE_PIE[1] + 2]
  const piernas: [PiernaF, PiernaF] = [{ tobillo: [X + 16, TOBILLO] }, { tobillo: [X - 16, TOBILLO] }]
  if (o.tipo === 'inclinacion') {
    const brazos: [BrazoF, BrazoF] =
      o.carga === 'barra'
        ? [{ brazo: 150, antebrazo: -10 }, { brazo: 150, antebrazo: -10 }]
        : o.carga === 'polea'
          ? [{ brazo: 158, antebrazo: 166 }, { brazo: 30, antebrazo: -150 }]
          : [{ brazo: 0, antebrazo: 0 }, { brazo: 30, antebrazo: -150 }]
    return {
      patron: 'inclinación lateral',
      vista: 'frontal',
      // Con polea alta se inclina hacia la polea (el codo baja a la cadera); con peso, hacia los dos lados.
      claves:
        o.carga === 'polea'
          ? [
              { cadera: dePie, tronco: 190, piernas, brazos },
              { cadera: dePie, tronco: 166, piernas, brazos: [{ brazo: 128, antebrazo: 168 }, brazos[1]] },
            ]
          : [
              { cadera: dePie, tronco: 174, piernas, brazos },
              { cadera: dePie, tronco: 196, piernas, brazos },
            ],
      equipo: o.carga === 'polea' ? [{ tipo: 'polea', anclaje: [172, 14], a: 'mano0' }] : o.carga === 'barra' ? [{ tipo: 'barra' }] : [{ tipo: 'mancuernas', manos: [0] }],
    }
  }
  if (o.tipo === 'sentado') {
    const cadera: P = [X, 158]
    const pS: [PiernaF, PiernaF] = [{ muslo: 30, tibia: -10, escala: 0.6 }, { muslo: 30, tibia: -10, escala: 0.6 }]
    const manos = (x: number): [BrazoF, BrazoF] => [{ mano: [x + 3, 136], doblez: 1 }, { mano: [x - 3, 136], doblez: 1 }]
    return {
      patron: 'giros rusos',
      vista: 'frontal',
      claves: [
        { cadera, tronco: 180, escalaTronco: 0.82, giro: -35, piernas: pS, brazos: manos(X - 24) },
        { cadera, tronco: 180, escalaTronco: 0.82, giro: 35, piernas: pS, brazos: manos(X + 24) },
      ],
      equipo: o.carga === 'polea' ? [{ tipo: 'polea', anclaje: [18, 120] }] : material(o.carga === 'barra' ? 'disco' : o.carga),
    }
  }
  const [ini, fin]: [P, P] =
    o.tipo === 'lenador' ? [[150, 34], [66, 136]] : o.tipo === 'lenador_inverso' ? [[66, 140], [150, 40]] : o.tipo === 'landmine' ? [[66, 112], [134, 112]] : [[70, 100], [130, 100]]
  const manos = (p: P): [BrazoF, BrazoF] => [{ mano: mas(p, [3, 0]), doblez: 1 }, { mano: mas(p, [-3, 0]), doblez: 1 }]
  const equipo: Equipo[] =
    o.tipo === 'landmine'
      ? [{ tipo: 'landmine', pivote: [X, SUELO - 2] }]
      : o.carga === 'polea'
        ? [{ tipo: 'polea', anclaje: o.tipo === 'lenador_inverso' ? [30, SUELO - 6] : o.tipo === 'lenador' ? [180, 16] : [18, 100] }]
        : material(o.carga)
  return {
    patron: o.tipo === 'landmine' ? 'landmine 180' : 'leñador',
    vista: 'frontal',
    claves: [
      { cadera: dePie, tronco: 180, giro: ini[0] < X ? -30 : 30, piernas, brazos: manos(ini) },
      { cadera: dePie, tronco: 180, giro: fin[0] < X ? -30 : 30, piernas, brazos: manos(fin) },
    ],
    equipo,
  }
}

/** Cuello con un disco: tumbado en un banco con la cabeza fuera. */
export function cuello(o: { bocaArriba: boolean }): Animacion {
  const cadera: P = o.bocaArriba ? [130, 124] : [70, 120]
  const tronco = o.bocaArriba ? -90 : 90
  const piernas: [Pierna, Pierna] = o.bocaArriba ? pies(cadera[0] + 34, 4) : ambos<Pierna>({ muslo: -90, tibia: -90, pie: 0 })
  const [c1, c2] = o.bocaArriba ? [28, -40] : [-38, 18]
  const manos = (c: number): [Brazo, Brazo] => {
    const S = hombro(cadera, tronco)
    const cab = desde(S, tronco + c, 15)
    const sobre = mas(cab, por(anterior(tronco + c), o.bocaArriba ? 10 : -10))
    return ambos<Brazo>({ mano: sobre, doblez: -1 })
  }
  return {
    patron: 'cuello con disco',
    vista: 'lateral',
    claves: [lat({ cadera, tronco, cabeza: c1, piernas, brazos: manos(c1) }), lat({ cadera, tronco, cabeza: c2, piernas, brazos: manos(c2) })],
    equipo: [bancoBajo(cadera, tronco, -1.9, 0.82), { tipo: 'disco' }],
  }
}

// ── Cadera en polea, curl femoral, paseo ────────────────────────────────────────────────────

export function caderaPolea(o: { tipo: 'abduccion' | 'aduccion' | 'patada' }): Animacion {
  if (o.tipo === 'patada') {
    const cadera: P = [X - 2, DE_PIE[1] + 2]
    const t = 166
    const S = hombro(cadera, t)
    const apoyo = ambos<Brazo>({ mano: [S[0] + 34, S[1] + 14], doblez: -1 })
    return {
      patron: 'patada de glúteo',
      vista: 'lateral',
      claves: [
        lat({ cadera, tronco: t, piernas: [{ muslo: 12, tibia: 8 }, { tobillo: [X - 2, TOBILLO] }], brazos: apoyo }),
        lat({ cadera, tronco: t, piernas: [{ muslo: -38, tibia: -30 }, { tobillo: [X - 2, TOBILLO] }], brazos: apoyo }),
      ],
      equipo: [{ tipo: 'polea', anclaje: [X + 58, SUELO - 6], a: 'tobillo0' }],
    }
  }
  const cadera: P = [X, DE_PIE[1] + 1]
  const [a, b] = o.tipo === 'abduccion' ? [2, 34] : [26, -10]
  const quieta: PiernaF = { tobillo: [X - 12, TOBILLO] }
  const sujeta: BrazoF = { brazo: 74, antebrazo: 86 }
  const suelto: BrazoF = { brazo: 8, antebrazo: 6 }
  const brazos: [BrazoF, BrazoF] = o.tipo === 'abduccion' ? [suelto, sujeta] : [sujeta, suelto]
  return {
    patron: o.tipo === 'abduccion' ? 'abducción de cadera' : 'aducción de cadera',
    vista: 'frontal',
    claves: [
      { cadera, tronco: 180, piernas: [{ muslo: a, tibia: a }, quieta], brazos },
      { cadera, tronco: o.tipo === 'abduccion' ? 176 : 180, piernas: [{ muslo: b, tibia: b }, quieta], brazos },
    ],
    equipo: [{ tipo: 'polea', anclaje: o.tipo === 'abduccion' ? [30, SUELO - 6] : [172, SUELO - 6], a: 'tobillo0' }],
  }
}

export function curlFemoral(): Animacion {
  const cadera: P = [82, 120]
  const tronco = 90
  const brazos = ambos<Brazo>({ brazo: 30, antebrazo: 10 })
  return {
    patron: 'curl femoral',
    vista: 'lateral',
    claves: [
      lat({ cadera, tronco, piernas: ambos<Pierna>({ muslo: -88, tibia: -90, pie: 0 }), brazos }),
      lat({ cadera, tronco, piernas: ambos<Pierna>({ muslo: -86, tibia: -176, pie: -88 }), brazos }),
    ],
    equipo: [bancoBajo(cadera, tronco, -1.05, 0.95, -11), { tipo: 'mancuernas', manos: [0], en: 'pies' }],
  }
}

export function paseo(o: { carga: Carga }): Animacion {
  const brazos = (c: P): [Brazo, Brazo] => brazosCarga('mancuernas', c, 180)
  const c1: P = [X - 1, DE_PIE[1] + 3]
  return {
    patron: 'paseo del granjero',
    vista: 'lateral',
    claves: [
      lat({ cadera: c1, tronco: 179, piernas: [{ muslo: 22, tibia: 6 }, { muslo: -16, tibia: -30 }], brazos: brazos(c1) }),
      lat({ cadera: c1, tronco: 179, piernas: [{ muslo: -16, tibia: -30 }, { muslo: 22, tibia: 6 }], brazos: brazos(c1) }),
    ],
    equipo: material(o.carga),
  }
}

// ── Halterofilia ────────────────────────────────────────────────────────────────────────────

export type InicioOlimpico = 'suelo' | 'colgante' | 'bajo_rodillas' | 'bloques' | 'rack'
export type FinOlimpico = 'cargada' | 'cargada_sentadilla' | 'cargada_tijera' | 'arrancada' | 'arrancada_sentadilla' | 'arrancada_tijera' | 'tiron' | 'encogimiento'

/** Cargadas, arrancadas y tirones: la barra sube pegada al cuerpo hasta los hombros o por encima de la cabeza. */
export function olimpico(o: { inicio: InicioOlimpico; fin: FinOlimpico; carga: Carga; despues?: 'press' | 'envion' }): Animacion {
  const piernasJuntas = pies()
  const tijera: [Pierna, Pierna] = [{ tobillo: [X + 26, TOBILLO] }, { tobillo: [X - 30, TOBILLO - 4] }]
  const S = (c: P, t: number) => hombro(c, t)
  const colgadas = (c: P, t: number): P => mas(S(c, t), [2, 55])
  const rack = (c: P, t: number): P => mas(S(c, t), [8, 2])
  const arriba = (c: P, t: number): P => mas(S(c, t), [-2, -57])
  const ancho = o.fin.startsWith('arrancada')
  const control = (c: P, t: number, m: P, piernas: [Pierna, Pierna] = piernasJuntas): Control => ({ cadera: c, tronco: t, piernas, brazos: [{ mano: m, doblez: 1 }, { mano: mas(m, [-2, 0]), doblez: 1 }] })

  const ini: Control =
    o.inicio === 'colgante'
      ? control([X - 16, 106], 146, colgadas([X - 16, 106], 146))
      : o.inicio === 'bajo_rodillas' || o.inicio === 'bloques'
        ? control([X - 24, 116], 132, colgadas([X - 24, 116], 132))
        : o.inicio === 'rack'
          ? control(DE_PIE, 179, rack(DE_PIE, 179))
          : control([X - 30, ancho ? 138 : 134], ancho ? 124 : 128, colgadas([X - 30, ancho ? 138 : 134], ancho ? 124 : 128))
  const dePie = DE_PIE
  const claves: Control[] = [ini]
  switch (o.fin) {
    case 'tiron':
    case 'encogimiento': {
      const punta: [Pierna, Pierna] = [{ tobillo: [X, TOBILLO - 9], punta: [X + 14, SUELO - 1] }, { tobillo: [X - 3, TOBILLO - 9], punta: [X + 11, SUELO - 1] }]
      const c: P = [X + 1, DE_PIE[1] - 9]
      const conPunta: [Pierna, Pierna] = [{ tobillo: [X, TOBILLO], punta: [X + 14, SUELO - 1] }, { tobillo: [X - 3, TOBILLO], punta: [X + 11, SUELO - 1] }]
      claves[0] = { ...ini, piernas: conPunta }
      claves.push({ ...control(c, 186, colgadas(c, 186), punta), escapula: [0, 7] })
      claves[0] = { ...claves[0], escapula: [0, 0] }
      break
    }
    case 'cargada':
      claves.push(control([X - 8, 112], 168, rack([X - 8, 112], 168)), control(dePie, 179, rack(dePie, 179)))
      break
    case 'cargada_sentadilla':
      claves.push(control([X - 18, 140], 158, rack([X - 18, 140], 158)), control(dePie, 179, rack(dePie, 179)))
      break
    case 'cargada_tijera':
      claves[0] = { ...ini, piernas: pies() }
      claves.push(control([X - 4, 122], 178, rack([X - 4, 122], 178), tijera), control(dePie, 179, rack(dePie, 179)))
      break
    case 'arrancada':
      claves.push(control([X - 10, 114], 168, arriba([X - 10, 114], 168)), control(dePie, 179, arriba(dePie, 179)))
      break
    case 'arrancada_sentadilla':
      claves.push(control([X - 18, 142], 160, arriba([X - 18, 142], 160)), control(dePie, 179, arriba(dePie, 179)))
      break
    case 'arrancada_tijera':
      claves.push(control([X - 4, 122], 178, arriba([X - 4, 122], 178), tijera), control(dePie, 179, arriba(dePie, 179)))
      break
  }
  if (o.despues === 'press') claves.push(control(dePie, 179, arriba(dePie, 179)))
  if (o.despues === 'envion') {
    const dip: P = mas(dePie, [-3, 9])
    claves.push(control(dip, 179, rack(dip, 179)), control([X - 4, 122], 178, arriba([X - 4, 122], 178), tijera))
  }
  // Todas las claves con las mismas piernas (tobillo con o sin punta).
  const conPunta = claves.some((c) => c.piernas.some((p) => 'punta' in p))
  const normalizadas = conPunta ? claves : claves.map((c) => ({ ...c, piernas: c.piernas.map((p) => ('tobillo' in p ? { tobillo: p.tobillo } : p)) as [Pierna, Pierna] }))
  const equipo: Equipo[] = material(o.carga)
  if (o.inicio === 'bloques') equipo.unshift({ tipo: 'caja', x: X - 2, y: 150, ancho: 30 })
  return { patron: `halterofilia: ${o.fin}`, vista: 'lateral', claves: normalizadas, equipo }
}

/** Envión, push press y equilibrios desde el rack: la barra sale de los hombros. */
export function envion(o: { fin: 'potencia' | 'tijera' | 'sentadilla' | 'flexion' | 'equilibrio_tijera' | 'equilibrio_arrancada'; impulso?: boolean }): Animacion {
  const tijera: [Pierna, Pierna] = [{ tobillo: [X + 26, TOBILLO] }, { tobillo: [X - 30, TOBILLO - 4] }]
  const juntas = pies()
  const S = (c: P, t: number) => hombro(c, t)
  const rack = (c: P, t: number): P => mas(S(c, t), [8, 2])
  const arriba = (c: P, t: number): P => mas(S(c, t), [-2, -57])
  const control = (c: P, t: number, m: P, piernas: [Pierna, Pierna] = juntas): Control => ({ cadera: c, tronco: t, piernas, brazos: [{ mano: m, doblez: 1 }, { mano: mas(m, [-2, 0]), doblez: 1 }] })
  const dip: P = mas(DE_PIE, [-3, 9])
  let claves: Control[]
  switch (o.fin) {
    case 'flexion':
      claves = [control(DE_PIE, 179, rack(DE_PIE, 179)), control(dip, 179, rack(dip, 179))]
      break
    case 'equilibrio_tijera':
      claves = [control([X - 4, 112], 178, rack([X - 4, 112], 178), tijera), control([X - 4, 122], 178, arriba([X - 4, 122], 178), tijera)]
      break
    case 'equilibrio_arrancada':
      claves = [control(DE_PIE, 179, arriba(DE_PIE, 179)), control([X - 18, 142], 160, arriba([X - 18, 142], 160))]
      break
    case 'tijera':
      claves = [control(DE_PIE, 179, rack(DE_PIE, 179)), control(dip, 179, rack(dip, 179)), control([X - 4, 122], 178, arriba([X - 4, 122], 178), tijera)]
      break
    case 'sentadilla':
      claves = [control(DE_PIE, 179, rack(DE_PIE, 179)), control(dip, 179, rack(dip, 179)), control([X - 18, 142], 160, arriba([X - 18, 142], 160))]
      break
    default:
      claves = [control(DE_PIE, 179, rack(DE_PIE, 179)), control(dip, 179, rack(dip, 179)), control(mas(DE_PIE, [-2, 6]), 179, arriba(mas(DE_PIE, [-2, 6]), 179))]
  }
  return { patron: `envión: ${o.fin}`, vista: 'lateral', claves, equipo: [{ tipo: 'barra' }] }
}

/** Jammer con landmine: media sentadilla y empuje hacia delante y arriba. */
export function jammer(o: { unilateral?: boolean }): Animacion {
  const piernas: [Pierna, Pierna] = [{ tobillo: [X + 8, TOBILLO] }, { tobillo: [X - 12, TOBILLO] }]
  const abajo: P = [X - 14, 120]
  const arriba: P = [X - 2, DE_PIE[1] + 2]
  const brazos = (m: P): [Brazo, Brazo] => [{ mano: m, doblez: -1 }, o.unilateral ? { brazo: 6, antebrazo: 8 } : { mano: mas(m, [-2, 0]), doblez: -1 }]
  return {
    patron: 'jammer',
    vista: 'lateral',
    claves: [
      lat({ cadera: abajo, tronco: 156, piernas, brazos: brazos(mas(hombro(abajo, 156), [10, 3])) }),
      lat({ cadera: arriba, tronco: 168, piernas, brazos: brazos(mas(hombro(arriba, 168), [42, -36])) }),
    ],
    equipo: [{ tipo: 'landmine', pivote: [X + 170, SUELO - 2] }],
  }
}

/** Volantes con disco: los brazos estirados giran el disco como un volante (de frente). */
export function volantes(): Animacion {
  const cadera: P = [X, DE_PIE[1] + 2]
  const piernas: [PiernaF, PiernaF] = [{ tobillo: [X + 12, TOBILLO] }, { tobillo: [X - 12, TOBILLO] }]
  const centro: P = [X, 74]
  const manos = (giro: number): [BrazoF, BrazoF] => [{ mano: desde(centro, 90 + giro, 13), doblez: 1 }, { mano: desde(centro, -90 + giro, 13), doblez: 1 }]
  return {
    patron: 'volantes con disco',
    vista: 'frontal',
    claves: [
      { cadera, tronco: 180, piernas, brazos: manos(-35) },
      { cadera, tronco: 180, piernas, brazos: manos(35) },
    ],
    equipo: [{ tipo: 'disco' }],
  }
}

/** Vueltas al mundo: tumbado, los brazos rectos dan media vuelta de la cadera a por encima de la cabeza. */
export function vueltasAlMundo(): Animacion {
  const cadera: P = [X, 128]
  const piernas: [PiernaF, PiernaF] = [{ muslo: 4, tibia: 4 }, { muslo: 4, tibia: 4 }]
  return {
    patron: 'vueltas al mundo',
    vista: 'cenital',
    claves: [
      { cadera, tronco: 180, piernas, brazos: ambos<BrazoF>({ brazo: 14, antebrazo: 16 }) },
      { cadera, tronco: 180, piernas, brazos: ambos<BrazoF>({ brazo: 168, antebrazo: 170 }) },
    ],
    equipo: [{ tipo: 'banco', asiento: [[X, cadera[1] + 12], [X, cadera[1] - 64]] }, { tipo: 'mancuernas' }],
  }
}

