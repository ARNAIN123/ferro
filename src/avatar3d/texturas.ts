// Texturas del avatar: regiones musculares (rojo: región del modelo; azul: la que se pinta, con los
// contornos de cada grupo alisados) y relieve (rojo y verde: normal; azul: oclusión ambiental). Las
// regiones se leen en la CPU para saber qué músculo se toca y para pintar el mapa de color
// (mapaColor.ts); la oclusión dice dónde hay piel en el mapa UV.
import * as THREE from 'three'
import { reducir, suavizar } from './mapaColor'
import type { ModeloAvatar } from './modelo'

/**
 * Relieve suavizado (ronda 5): las sombras que separan los músculos (el mapa de normales y la oclusión
 * horneados) tenían bordes muy marcados. Se difuminan una vez al cargar, solo dentro de la piel, a
 * la mitad de resolución (512): unos 1,5 cm de transición en el cuerpo, sin perder el dibujo.
 */
export const LADO_RELIEVE = 512
const RADIO_RELIEVE = 2
const PASADAS_RELIEVE = 1

/** Normales (rojo y verde) y oclusión (azul) de 0 a 255, difuminadas dentro de la piel. */
export function suavizarRelieve(px: Uint8ClampedArray | Uint8Array, lado: number, dentro: Uint8Array, nuevo = LADO_RELIEVE): Uint8Array {
  // Media de cada bloque (no un texel suelto: así no salen dientes) y, fuera de la piel, nada.
  const k = lado / nuevo
  const dentroNuevo = reducir(dentro, lado, nuevo)
  const a = new Float32Array(nuevo * nuevo * 4)
  for (let y = 0; y < nuevo; y++)
    for (let x = 0; x < nuevo; x++) {
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let dy = 0; dy < k; dy++)
        for (let dx = 0; dx < k; dx++) {
          const i = (y * k + dy) * lado + x * k + dx
          if (!dentro[i]) continue
          r += px[i * 4]!
          g += px[i * 4 + 1]!
          b += px[i * 4 + 2]!
          n++
        }
      const j = (y * nuevo + x) * 4
      a[j] = n ? r / n : 128
      a[j + 1] = n ? g / n : 128
      a[j + 2] = n ? b / n : 0
      a[j + 3] = 255
    }
  const f = suavizar(a, dentroNuevo, nuevo, RADIO_RELIEVE, PASADAS_RELIEVE, 8)
  const r = new Uint8Array(nuevo * nuevo * 4)
  for (let i = 0; i < r.length; i++) r[i] = Math.round(Math.min(255, Math.max(0, f[i]!)))
  return r
}

const BASE = import.meta.env.BASE_URL

export interface TexturasAvatar {
  ids: THREE.Texture
  relieve: THREE.Texture
  /** Región de cada punto del mapa UV (a media resolución) y si ahí hay piel (dentro de una isla). */
  lado: number
  region: Uint8Array
  dentro: Uint8Array
  /**
   * La región que se pinta (y se toca) en cada punto: la de su grupo con los contornos alisados (ver
   * alisarContornos; horneada en el canal azul de la textura de regiones), a la resolución de `region`.
   */
  pintado: Uint8Array
}

let cargando: Promise<TexturasAvatar> | null = null

export function cargarTexturasAvatar(modelo: ModeloAvatar): Promise<TexturasAvatar> {
  cargando ??= (async () => {
    const cargador = new THREE.TextureLoader()
    const [ids, relieve] = await Promise.all([
      cargador.loadAsync(`${BASE}modelos/${modelo.info.texturas.regiones.archivo}`),
      cargador.loadAsync(`${BASE}modelos/${modelo.info.texturas.relieve.archivo}`),
    ])
    // Como en glTF: la fila de arriba de la imagen es v = 0.
    for (const t of [ids, relieve]) {
      t.flipY = false
      t.colorSpace = THREE.NoColorSpace
    }
    // Los números de región no se pueden mezclar: sin filtrado.
    ids.magFilter = ids.minFilter = THREE.NearestFilter
    ids.generateMipmaps = false
    relieve.anisotropy = 4
    ids.needsUpdate = relieve.needsUpdate = true

    const lado = Math.round(modelo.info.texturas.regiones.lado / 2)
    const lienzo = document.createElement('canvas')
    lienzo.width = lienzo.height = lado
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })!
    ctx.imageSmoothingEnabled = false
    const leer = (imagen: unknown) => {
      ctx.clearRect(0, 0, lado, lado)
      ctx.drawImage(imagen as CanvasImageSource, 0, 0, lado, lado)
      return ctx.getImageData(0, 0, lado, lado).data
    }
    const px = leer(ids.image)
    const region = new Uint8Array(lado * lado)
    const pintado = new Uint8Array(lado * lado)
    for (let i = 0; i < lado * lado; i++) {
      region[i] = px[i * 4]!
      pintado[i] = px[i * 4 + 2]!
    }
    // Fuera de las islas del mapa UV la oclusión horneada es 0: ahí no hay piel.
    const ao = leer(relieve.image)
    const dentro = new Uint8Array(lado * lado)
    for (let i = 0; i < lado * lado; i++) dentro[i] = region[i]! > 0 || ao[i * 4 + 2]! > 0 ? 1 : 0
    // El relieve que se usa es el suavizado.
    const suave = new THREE.DataTexture(suavizarRelieve(ao, lado, dentro), LADO_RELIEVE, LADO_RELIEVE, THREE.RGBAFormat, THREE.UnsignedByteType)
    suave.colorSpace = THREE.NoColorSpace
    suave.flipY = false
    suave.magFilter = THREE.LinearFilter
    suave.minFilter = THREE.LinearMipmapLinearFilter
    suave.generateMipmaps = true
    suave.anisotropy = 4
    suave.needsUpdate = true
    relieve.dispose()
    return { ids, relieve: suave, lado, region, dentro, pintado }
  })()
  // Si falla, se queda el fallo (ver cargarModeloAvatar).
  cargando.catch(() => undefined)
  return cargando
}

/** Región del modelo (1…48; 0 = ninguna) que se ve en un punto del mapa UV (la de su grupo, alisada). */
export function regionEn(t: TexturasAvatar, u: number, v: number): number {
  const x = Math.min(t.lado - 1, Math.max(0, Math.floor(u * t.lado)))
  const y = Math.min(t.lado - 1, Math.max(0, Math.floor(v * t.lado)))
  return t.pintado[y * t.lado + x] ?? 0
}
