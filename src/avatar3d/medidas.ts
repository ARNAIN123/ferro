// Cinta métrica sobre el avatar: cada medida es el perímetro de la envolvente convexa (lo que
// rodearía una cinta) del corte del cuerpo con un plano, por el mismo sitio por el que se mide una
// persona. Con esto se ajusta el avatar a las medidas reales.
import type { NombreMedida } from '../domain/cuerpo'
import type { FormaAvatar } from './forma'
import type { ModeloAvatar, Vec3 } from './modelo'

const TRONCO = 0
const BRAZO_L = 1
const BRAZO_R = 2
const PIERNA_L = 3
const PIERNA_R = 4

interface Corte {
  partes: readonly number[]
  punto: Vec3
  normal: Vec3
  /** Solo los puntos a menos de esta distancia del punto (m). */
  radio?: number
}

/** Perímetro (m) de la envolvente convexa del corte de unas partes del cuerpo con un plano. */
export function perimetroCorte(modelo: ModeloAvatar, pos: Float32Array, c: Corte): number {
  const [nx, ny, nz] = c.normal
  const [px, py, pz] = c.punto
  // Dos ejes del plano.
  const ref: Vec3 = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  let ux = ref[1] * nz - ref[2] * ny
  let uy = ref[2] * nx - ref[0] * nz
  let uz = ref[0] * ny - ref[1] * nx
  const lu = Math.hypot(ux, uy, uz)
  ux /= lu
  uy /= lu
  uz /= lu
  const vx = ny * uz - nz * uy
  const vy = nz * ux - nx * uz
  const vz = nx * uy - ny * ux
  const radio2 = c.radio ? c.radio * c.radio : Infinity
  const puntos: [number, number][] = []
  const { indices } = modelo
  const d = [0, 0, 0]
  const v = [0, 0, 0]
  for (const parte of c.partes) {
    const lista = modelo.triangulosDeParte[parte]!
    for (let k = 0; k < lista.length; k++) {
      const t = lista[k]! * 3
      for (let e = 0; e < 3; e++) {
        const i = indices[t + e]!
        v[e] = i
        d[e] = (pos[i * 3]! - px) * nx + (pos[i * 3 + 1]! - py) * ny + (pos[i * 3 + 2]! - pz) * nz
      }
      const lado = d[0]! < 0
      if (lado === d[1]! < 0 && lado === d[2]! < 0) continue
      for (let e = 0; e < 3; e++) {
        const a = e
        const b = (e + 1) % 3
        if (d[a]! < 0 === d[b]! < 0) continue
        const s = d[a]! / (d[a]! - d[b]!)
        const ia = v[a]! * 3
        const ib = v[b]! * 3
        const x = pos[ia]! + s * (pos[ib]! - pos[ia]!) - px
        const y = pos[ia + 1]! + s * (pos[ib + 1]! - pos[ia + 1]!) - py
        const z = pos[ia + 2]! + s * (pos[ib + 2]! - pos[ia + 2]!) - pz
        if (x * x + y * y + z * z > radio2) continue
        puntos.push([x * ux + y * uy + z * uz, x * vx + y * vy + z * vz])
      }
    }
  }
  return perimetroConvexo(puntos)
}

/** Perímetro de la envolvente convexa de unos puntos del plano (cadena monótona de Andrew). */
export function perimetroConvexo(puntos: [number, number][]): number {
  if (puntos.length < 3) return 0
  const p = [...puntos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const giro = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const media = (lista: [number, number][]) => {
    const h: [number, number][] = []
    for (const q of lista) {
      while (h.length >= 2 && giro(h[h.length - 2]!, h[h.length - 1]!, q) <= 0) h.pop()
      h.push(q)
    }
    h.pop()
    return h
  }
  const casco = [...media(p), ...media(p.reverse())]
  let total = 0
  for (let i = 0; i < casco.length; i++) {
    const a = casco[i]!
    const b = casco[(i + 1) % casco.length]!
    total += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return total
}

const ARRIBA: Vec3 = [0, 1, 0]
const entre = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const direccion = (a: Vec3, b: Vec3): Vec3 => {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const l = Math.hypot(d[0], d[1], d[2]) || 1
  return [d[0] / l, d[1] / l, d[2] / l]
}

/**
 * Las medidas de cinta del avatar (cm). `sexo`: 0 mujer, 1 hombre (la cintura del hombre se mide
 * en el ombligo y la de la mujer en la parte más estrecha, como en el método de la Marina).
 */
export function medirAvatar(modelo: ModeloAvatar, forma: FormaAvatar, sexo: number): Record<NombreMedida, number> {
  const pos = forma.posiciones
  const J = (a: string): Vec3 => forma.articulaciones[a]!
  const k = forma.alto / 1.75 // las distancias fijas van con la talla
  const horizontal = (y: number, partes: readonly number[]) => perimetroCorte(modelo, pos, { partes, punto: [0, y, 0], normal: ARRIBA })
  const miembro = (de: string, a: string, parte: number, tramos: readonly number[]) =>
    Math.max(...tramos.map((t) => perimetroCorte(modelo, pos, { partes: [parte], punto: entre(J(de), J(a), t), normal: direccion(J(de), J(a)) })))
  const yLumbar = J('lumbar')[1]
  const yDorsal = J('dorsal')[1]
  const yPecho = J('pecho')[1]
  const yCadera = J('muslo.L')[1]
  const yHombro = J('brazo.L')[1]
  const m = {
    // El cuello se mide por su parte más estrecha, perpendicular a él (algo por debajo de su articulación,
    // que queda a la altura de la mandíbula).
    cuello: Math.min(
      ...[-0.3, -0.2, -0.1, 0].map((t) => perimetroCorte(modelo, pos, { partes: [TRONCO], punto: entre(J('cuello'), J('cabeza'), t), normal: direccion(J('cuello'), J('cabeza')), radio: 0.11 * k })),
    ),
    hombros: Math.max(...[-0.02, -0.04, -0.06].map((d) => horizontal(yHombro + d * k, [TRONCO, BRAZO_L, BRAZO_R]))),
    pecho: Math.max(...[0.5, 0.6, 0.7, 0.8].map((t) => horizontal(yDorsal + (yPecho - yDorsal) * t, [TRONCO]))),
    cintura: sexo >= 0.5 ? horizontal(yLumbar, [TRONCO]) : Math.min(...[0, 0.2, 0.4, 0.6].map((t) => horizontal(yLumbar + (yDorsal - yLumbar) * t, [TRONCO]))),
    cadera: Math.max(...[-0.06, -0.03, 0, 0.03, 0.06].map((d) => horizontal(yCadera + d * k, [TRONCO, PIERNA_L, PIERNA_R]))),
    brazo: miembro('brazo.L', 'antebrazo.L', BRAZO_L, [0.35, 0.45, 0.55]),
    antebrazo: miembro('antebrazo.L', 'mano.L', BRAZO_L, [0.15, 0.25, 0.35]),
    muslo: miembro('muslo.L', 'pierna.L', PIERNA_L, [0.25, 0.35, 0.45]),
    gemelo: miembro('pierna.L', 'pie.L', PIERNA_L, [0.2, 0.3, 0.4]),
  }
  const cm = (v: number) => Math.round(v * 1000) / 10
  return {
    cuello: cm(m.cuello),
    hombros: cm(m.hombros),
    pecho: cm(m.pecho),
    cintura: cm(m.cintura),
    cadera: cm(m.cadera),
    brazo: cm(m.brazo),
    antebrazo: cm(m.antebrazo),
    muslo: cm(m.muslo),
    gemelo: cm(m.gemelo),
  }
}
