import { BufferAttribute, BufferGeometry } from 'three'
import { NO_MUSCULO, type RegionAvatar } from '../../domain/avatar'
import { distancia, grosor, relieveMusculo, suavizar, traseraSobreFrontal, type Caja } from '../../lib/cuerpo3d'
import { ESPALDA, FRENTE, type VistaAvatar } from '../avatar/trazados'

/** Cuerpo 3D listo para pintar: la geometría es común; los colores los pone cada avatar. */
export interface Cuerpo {
  geometria: BufferGeometry
  /** Región de cada vértice (índice en `regiones`; -1 = piel sin músculo). */
  regionDeVertice: Int16Array
  regiones: RegionAvatar[]
  /** 0 en el fondo del surco entre músculos, 1 en el músculo: oscurece las separaciones. */
  surco: Float32Array
}

/** Resolución de la rejilla (filas). Más filas, más detalle y más vértices. */
const FILAS = 520
/** Relieve de cada músculo sobre el cuerpo, y cómo de rápido sube desde su surco (en píxeles). */
const ALTURA_MUSCULO = 2.4
const ANCHO_SUBIDA = 4

type Matriz = [number, number, number, number, number, number]

/**
 * Construye el cuerpo 3D a partir del avatar 2D: la silueta frontal se rasteriza, se infla según la
 * distancia a su borde (miembros redondos, tronco más plano) y cada músculo sobresale un poco con un
 * surco en su contorno. La cara delantera lleva los músculos de la vista frontal y la trasera los de
 * la vista de espaldas (reflejada). Tarda unos cientos de milisegundos: se hace una vez y se reutiliza.
 */
export function construirCuerpo(): Cuerpo {
  const caja = FRENTE.caja
  const escala = FILAS / caja[3]
  const W = Math.ceil(caja[2] * escala)
  const H = FILAS
  const lienzo = document.createElement('canvas')
  lienzo.width = W
  lienzo.height = H
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!
  const base: Matriz = [escala, 0, 0, escala, -caja[0] * escala, -caja[1] * escala]

  ctx.setTransform(...base)
  ctx.fill(new Path2D(FRENTE.silueta))
  const pix = ctx.getImageData(0, 0, W, H).data
  const fuera = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) fuera[i] = pix[i * 4 + 3]! < 128 ? 1 : 0

  const regiones: RegionAvatar[] = []
  const indices = new Map<RegionAvatar, number>()
  const idDe = (r: RegionAvatar) => {
    if (!indices.has(r)) indices.set(r, regiones.push(r) - 1)
    return indices.get(r)!
  }

  /** Región de cada píxel para una vista (con la transformación que la lleva a la rejilla). */
  const rasterizar = (vista: VistaAvatar, m: Matriz): Int16Array => {
    const ids = new Int16Array(W * H).fill(-1)
    for (const p of vista.partes) {
      const [x0, y0, x1, y1] = cajaEnPixeles(p.d, m, W, H)
      if (x1 <= x0 || y1 <= y0) continue
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(x0, y0, x1 - x0, y1 - y0)
      ctx.setTransform(...m)
      ctx.save()
      if (p.recorte) ctx.clip(new Path2D(p.recorte))
      ctx.fill(new Path2D(p.d))
      ctx.restore()
      const datos = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
      const id = idDe(p.region)
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) if (datos[((y - y0) * (x1 - x0) + (x - x0)) * 4 + 3]! >= 128) ids[y * W + x] = id
    }
    return ids
  }

  const t = traseraSobreFrontal(ESPALDA.caja as Caja, caja as Caja)
  const trasera: Matriz = [base[0] * t[0], 0, 0, base[3] * t[3], base[0] * t[4] + base[4], base[3] * t[5] + base[5]]
  const caras = [
    { signo: 1, ids: rasterizar(FRENTE, base) },
    { signo: -1, ids: rasterizar(ESPALDA, trasera) },
  ]

  // Grosor del cuerpo: distancia al borde, inflada y suavizada (sin la arista del eje de cada miembro).
  const dBorde = distancia(fuera, W, H)
  const bruto = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) bruto[i] = grosor(dBorde[i]!)
  const suave = suavizar(suavizar(bruto, W, H, 3), W, H, 2)
  const cuerpo = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) cuerpo[i] = Math.min(suave[i]!, bruto[i]!)

  // Contorno sin escalones: los píxeles del borde se colocan en la media de sus vecinos del borde.
  const xy = suavizarContorno(fuera, W, H)

  // Vértices de las dos caras.
  const posiciones: number[] = []
  const region: number[] = []
  const surco: number[] = []
  const indicesTri: number[] = []
  for (const cara of caras) {
    const semillas = new Uint8Array(W * H)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        const id = cara.ids[i]!
        semillas[i] =
          fuera[i] || id < 0 || (x > 0 && cara.ids[i - 1] !== id) || (x < W - 1 && cara.ids[i + 1] !== id) || (y > 0 && cara.ids[i - W] !== id) || (y < H - 1 && cara.ids[i + W] !== id)
            ? 1
            : 0
      }
    const e = distancia(semillas, W, H)
    const relieve = new Float32Array(W * H)
    for (let i = 0; i < W * H; i++) {
      const id = cara.ids[i]!
      const altura = id < 0 ? 0 : NO_MUSCULO.has(regiones[id]!) ? ALTURA_MUSCULO * 0.5 : ALTURA_MUSCULO
      relieve[i] = relieveMusculo(e[i]!, altura, ANCHO_SUBIDA)
    }
    const relieveSuave = suavizar(relieve, W, H, 1)

    const vertice = new Int32Array(W * H).fill(-1)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        if (fuera[i]) continue
        // El relieve no puede asomar por el borde de la silueta (ahí las dos caras se juntan).
        const z = cuerpo[i]! + Math.min(relieveSuave[i]!, relieve[i]! + 0.6, cuerpo[i]! * 0.5)
        vertice[i] = posiciones.length / 3
        posiciones.push((xy[i * 2]! - W / 2) / H, (H / 2 - xy[i * 2 + 1]!) / H, (cara.signo * z) / H)
        region.push(cara.ids[i]!)
        surco.push(cara.ids[i]! < 0 ? 1 : Math.min(1, e[i]! / 1.6))
      }

    // Dos triángulos por celda (uno si solo hay tres esquinas dentro). La rejilla va con la y hacia
    // abajo, así que el orden se invierte en la cara delantera para que mire hacia fuera.
    for (let y = 0; y < H - 1; y++)
      for (let x = 0; x < W - 1; x++) {
        const a = vertice[y * W + x]!
        const b = vertice[y * W + x + 1]!
        const c = vertice[(y + 1) * W + x]!
        const d = vertice[(y + 1) * W + x + 1]!
        const tri = (p: number, q: number, r: number) => {
          if (p < 0 || q < 0 || r < 0) return
          if (cara.signo > 0) indicesTri.push(p, r, q)
          else indicesTri.push(p, q, r)
        }
        if (a >= 0 && d >= 0) {
          tri(a, b, d)
          tri(a, d, c)
        } else {
          tri(b, d, c)
          tri(a, b, c)
        }
      }
  }

  const geometria = new BufferGeometry()
  geometria.setAttribute('position', new BufferAttribute(new Float32Array(posiciones), 3))
  geometria.setIndex(indicesTri)
  geometria.computeVertexNormals()
  geometria.computeBoundingSphere()
  return { geometria, regionDeVertice: Int16Array.from(region), regiones, surco: Float32Array.from(surco) }
}

/**
 * Posición (x, y) de cada píxel. Los del borde de la silueta (con algún vecino fuera) se mueven a la
 * media de sus vecinos del borde, dos veces: el contorno queda suave en vez de en escalera.
 */
function suavizarContorno(fuera: Uint8Array, W: number, H: number): Float32Array {
  const xy = new Float32Array(W * H * 2)
  const borde = new Uint8Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      xy[i * 2] = x
      xy[i * 2 + 1] = y
      if (fuera[i]) continue
      borde[i] = x === 0 || y === 0 || x === W - 1 || y === H - 1 || fuera[i - 1] || fuera[i + 1] || fuera[i - W] || fuera[i + W] ? 1 : 0
    }
  for (let pasada = 0; pasada < 2; pasada++) {
    const previo = xy.slice()
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x
        if (!borde[i]) continue
        let sx = 0
        let sy = 0
        let n = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const j = i + dy * W + dx
            if (!borde[j]) continue
            sx += previo[j * 2]!
            sy += previo[j * 2 + 1]!
            n++
          }
        xy[i * 2] = sx / n
        xy[i * 2 + 1] = sy / n
      }
  }
  return xy
}

/** Caja en píxeles (entera y dentro del lienzo) de un trazado tras aplicarle la transformación. */
function cajaEnPixeles(d: string, m: Matriz, W: number, H: number): [number, number, number, number] {
  const n = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i + 1 < n.length; i += 2) {
    const x = m[0] * n[i]! + m[2] * n[i + 1]! + m[4]
    const y = m[1] * n[i]! + m[3] * n[i + 1]! + m[5]
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  return [Math.max(0, Math.floor(x0) - 2), Math.max(0, Math.floor(y0) - 2), Math.min(W, Math.ceil(x1) + 2), Math.min(H, Math.ceil(y1) + 2)]
}
