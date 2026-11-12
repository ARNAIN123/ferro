// La forma del avatar: se mezclan las esquinas de MakeHuman (sexo × edad × músculo × peso) con los
// mismos pesos que usa MakeHuman, se suman los deformadores de medidas y, con los mismos pesos, se
// recalculan las articulaciones del esqueleto. Todo en la CPU: la forma cambia pocas veces.
import type { InfoAvatar, ModeloAvatar, Vec3 } from './modelo'

/** Deformadores de medidas: cada uno tiene una versión «+» y otra «−» en el modelo. */
export const OBJETIVOS = ['cuello', 'hombros', 'pecho', 'cintura', 'cadera', 'brazo', 'antebrazo', 'muslo', 'gemelo', 'piernas', 'brazos'] as const
export type NombreObjetivo = (typeof OBJETIVOS)[number]

export interface ParametrosForma {
  /** 0 = mujer, 1 = hombre. */
  sexo: number
  /** 0 = joven (25 años), 1 = mayor (90). */
  edad: number
  /** Músculo y peso de MakeHuman: 0 mínimo, 0,5 medio, 1 máximo. */
  musculo: number
  peso: number
  /** Cuánto de cada deformador de medidas (positivo: «+»; negativo: «−»). */
  objetivos?: Partial<Record<NombreObjetivo, number>>
  /** Altura final (m): el cuerpo se escala entero hasta medirla. */
  alturaM?: number
}

export interface FormaAvatar {
  /** Posición de cada vértice de dibujo (m, y hacia arriba, de pie en y = 0). */
  posiciones: Float32Array
  /** Articulaciones y extremos del esqueleto, recalculados para esta forma. */
  articulaciones: Record<string, Vec3>
  alto: number
}

/** Reparto de un valor 0–1 entre mínimo, medio y máximo, como en MakeHuman. */
const tres = (x: number): [number, number, number] => [Math.max(0, 1 - 2 * x), 1 - Math.abs(2 * x - 1), Math.max(0, 2 * x - 1)]
const limitar = (x: number) => Math.min(1, Math.max(0, x))

/** Peso de cada esquina de MakeHuman (suman 1). */
export function pesosEsquinas(info: InfoAvatar, p: Pick<ParametrosForma, 'sexo' | 'edad' | 'musculo' | 'peso'>): number[] {
  const sexo = limitar(p.sexo)
  const edad = limitar(p.edad)
  const m = tres(limitar(p.musculo))
  const w = tres(limitar(p.peso))
  return info.macro.esquinas.map((c) => (c.sexo ? sexo : 1 - sexo) * (c.edad ? edad : 1 - edad) * m[c.musculo]! * w[c.peso]!)
}

export function construirForma(modelo: ModeloAvatar, p: ParametrosForma): FormaAvatar {
  const { info, vertices } = modelo
  const base = modelo.posiciones
  const pos = new Float32Array(base)
  const art = modelo.articulaciones.map((a) => [...info.articulaciones[a]!] as Vec3)

  const sumar = (morfo: number, peso: number, mueve: readonly Vec3[]) => {
    const m = modelo.morfos[morfo]
    if (!m || Math.abs(peso) < 1e-6) return
    const k = peso / 32767
    const { filas, valores } = m
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i]! * 3
      pos[f]! += valores[i * 3]! * k
      pos[f + 1]! += valores[i * 3 + 1]! * k
      pos[f + 2]! += valores[i * 3 + 2]! * k
    }
    for (let j = 0; j < art.length; j++) {
      const d = mueve[j]
      const a = art[j]!
      if (!d) continue
      a[0] += d[0] * peso
      a[1] += d[1] * peso
      a[2] += d[2] * peso
    }
  }

  const pesos = pesosEsquinas(info, p)
  info.macro.esquinas.forEach((c, i) => {
    if (c.morfo >= 0) sumar(c.morfo, pesos[i]!, c.articulaciones)
  })
  for (const nombre of OBJETIVOS) {
    const t = p.objetivos?.[nombre] ?? 0
    if (!t) continue
    const o = info.objetivos.find((x) => x.nombre === `${nombre}${t > 0 ? '+' : '-'}`)
    if (o) sumar(o.morfo, Math.abs(t), o.articulaciones)
  }

  // Los músculos profundos se mueven con la piel que tienen más cerca.
  const u = modelo.union
  for (let i = u.primero, k = 0; i < vertices; i++) {
    let dx = 0
    let dy = 0
    let dz = 0
    for (let v = 0; v < u.vecinos; v++, k++) {
      const j = u.indices[k]! * 3
      const w = u.pesos[k]! / 255
      dx += w * (pos[j]! - base[j]!)
      dy += w * (pos[j + 1]! - base[j + 1]!)
      dz += w * (pos[j + 2]! - base[j + 2]!)
    }
    pos[i * 3] = base[i * 3]! + dx
    pos[i * 3 + 1] = base[i * 3 + 1]! + dy
    pos[i * 3 + 2] = base[i * 3 + 2]! + dz
  }

  // De pie en el suelo y, si se pide, con la altura exacta.
  let suelo = Infinity
  let techo = -Infinity
  for (let i = 0; i < info.vertices_forma; i++) {
    const y = pos[i * 3 + 1]!
    if (y < suelo) suelo = y
    if (y > techo) techo = y
  }
  const escala = p.alturaM ? p.alturaM / (techo - suelo) : 1
  for (let i = 0; i < vertices; i++) {
    pos[i * 3] = pos[i * 3]! * escala
    pos[i * 3 + 1] = (pos[i * 3 + 1]! - suelo) * escala
    pos[i * 3 + 2] = pos[i * 3 + 2]! * escala
  }
  const articulaciones: Record<string, Vec3> = {}
  modelo.articulaciones.forEach((a, j) => {
    const v = art[j]!
    articulaciones[a] = [v[0] * escala, (v[1] - suelo) * escala, v[2] * escala]
  })
  return { posiciones: pos, articulaciones, alto: (techo - suelo) * escala }
}

/** Normales de la malla: una por vértice de MakeHuman, para que las costuras del mapa UV no se noten. */
export function normalesAvatar(modelo: ModeloAvatar, pos: Float32Array): Float32Array {
  const { indices, origen } = modelo
  const suma = new Float32Array(modelo.origenes * 3)
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]!
    const b = indices[t + 1]!
    const c = indices[t + 2]!
    const ax = pos[a * 3]!
    const ay = pos[a * 3 + 1]!
    const az = pos[a * 3 + 2]!
    const ux = pos[b * 3]! - ax
    const uy = pos[b * 3 + 1]! - ay
    const uz = pos[b * 3 + 2]! - az
    const vx = pos[c * 3]! - ax
    const vy = pos[c * 3 + 1]! - ay
    const vz = pos[c * 3 + 2]! - az
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    for (const v of [a, b, c]) {
      const o = origen[v]! * 3
      suma[o]! += nx
      suma[o + 1]! += ny
      suma[o + 2]! += nz
    }
  }
  const normales = new Float32Array(modelo.vertices * 3)
  for (let i = 0; i < modelo.vertices; i++) {
    const o = origen[i]! * 3
    const x = suma[o]!
    const y = suma[o + 1]!
    const z = suma[o + 2]!
    const largo = Math.hypot(x, y, z) || 1
    normales[i * 3] = x / largo
    normales[i * 3 + 1] = y / largo
    normales[i * 3 + 2] = z / largo
  }
  return normales
}

/** Volumen (litros) que encierra la piel. */
export function volumenLitros(modelo: ModeloAvatar, pos: Float32Array): number {
  const { indices } = modelo
  let v = 0
  for (let t = 0; t < modelo.info.triangulos_piel * 3; t += 3) {
    const a = indices[t]! * 3
    const b = indices[t + 1]! * 3
    const c = indices[t + 2]! * 3
    v +=
      pos[a]! * (pos[b + 1]! * pos[c + 2]! - pos[b + 2]! * pos[c + 1]!) +
      pos[a + 1]! * (pos[b + 2]! * pos[c]! - pos[b]! * pos[c + 2]!) +
      pos[a + 2]! * (pos[b]! * pos[c + 1]! - pos[b + 1]! * pos[c]!)
  }
  return (Math.abs(v) / 6) * 1000
}
