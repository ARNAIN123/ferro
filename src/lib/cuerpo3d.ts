// Geometría del avatar 3D: funciones puras sobre rejillas (máscaras y distancias), con tests.
// La figura 3D sale de "inflar" la silueta del avatar: cuanto más lejos del borde, más grosor.

const INF = 1e20

/** Transformada de distancia 1D al cuadrado (Felzenszwalb y Huttenlocher). */
function dt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!)
    while (s <= z[k]!) {
      k--
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!)
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++
    d[q] = (q - v[k]!) ** 2 + f[v[k]!]!
  }
}

/**
 * Distancia euclídea exacta (en píxeles) de cada píxel a la "semilla" más cercana.
 * `semilla[i]` = 1 donde la distancia es 0 (por ejemplo, el exterior de la silueta).
 */
export function distancia(semilla: Uint8Array, ancho: number, alto: number): Float32Array {
  const n = Math.max(ancho, alto)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  const g = new Float64Array(ancho * alto)
  for (let i = 0; i < ancho * alto; i++) g[i] = semilla[i] ? 0 : INF
  for (let x = 0; x < ancho; x++) {
    for (let y = 0; y < alto; y++) f[y] = g[y * ancho + x]!
    dt1d(f, alto, d, v, z)
    for (let y = 0; y < alto; y++) g[y * ancho + x] = d[y]!
  }
  const r = new Float32Array(ancho * alto)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) f[x] = g[y * ancho + x]!
    dt1d(f, ancho, d, v, z)
    for (let x = 0; x < ancho; x++) r[y * ancho + x] = Math.sqrt(d[x]!)
  }
  return r
}

/**
 * Grosor de la figura en un punto a `d` píxeles del borde. Con exponente < 1 los miembros quedan
 * casi redondos y el tronco más plano (como un cuerpo de verdad); en el borde vale 0, así que la
 * cara delantera y la trasera se juntan sin costura.
 */
export const grosor = (d: number, escala = 2.5, exponente = 0.6): number => (d <= 1 ? 0 : escala * (d - 1) ** exponente)

/** Relieve de un músculo a `e` píxeles de su contorno: 0 en el surco y `altura` en el centro. */
export const relieveMusculo = (e: number, altura: number, ancho: number): number =>
  altura * (1 - Math.exp(-Math.max(0, e - 0.5) / ancho))

/** Caja [x, y, ancho, alto]. */
export type Caja = readonly [number, number, number, number]

/**
 * La vista trasera se dibuja de espaldas: para pegarla en la cara de atrás del cuerpo se refleja
 * en horizontal y se ajusta a la caja de la vista frontal. Devuelve la transformación afín
 * [a, b, c, d, e, f] (como en canvas: x' = a·x + c·y + e, y' = b·x + d·y + f).
 */
export function traseraSobreFrontal(trasera: Caja, frontal: Caja): [number, number, number, number, number, number] {
  const sx = frontal[2] / trasera[2]
  const sy = frontal[3] / trasera[3]
  return [-sx, 0, 0, sy, frontal[0] + (trasera[0] + trasera[2]) * sx, frontal[1] - trasera[1] * sy]
}

/** Desenfoque de caja separable (radio en píxeles), para quitar las aristas de la distancia en el eje de cada miembro. */
export function suavizar(campo: Float32Array, ancho: number, alto: number, radio: number): Float32Array {
  const tmp = new Float32Array(campo.length)
  const out = new Float32Array(campo.length)
  const lado = 2 * radio + 1
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let s = 0
      for (let k = -radio; k <= radio; k++) s += campo[y * ancho + Math.min(ancho - 1, Math.max(0, x + k))]!
      tmp[y * ancho + x] = s / lado
    }
  }
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let s = 0
      for (let k = -radio; k <= radio; k++) s += tmp[Math.min(alto - 1, Math.max(0, y + k)) * ancho + x]!
      out[y * ancho + x] = s / lado
    }
  }
  return out
}
