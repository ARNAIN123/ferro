// Texturas del avatar: regiones musculares (rojo: región del modelo) y relieve (rojo y verde:
// normal; azul: oclusión ambiental). Las regiones se leen en la CPU para saber qué músculo se toca y
// para pintar el mapa de color (mapaColor.ts); la oclusión dice dónde hay piel en el mapa UV.
import * as THREE from 'three'
import type { ModeloAvatar } from './modelo'

const BASE = import.meta.env.BASE_URL

export interface TexturasAvatar {
  ids: THREE.Texture
  relieve: THREE.Texture
  /** Región de cada punto del mapa UV (a media resolución) y si ahí hay piel (dentro de una isla). */
  lado: number
  region: Uint8Array
  dentro: Uint8Array
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
    for (let i = 0; i < lado * lado; i++) region[i] = px[i * 4]!
    // Fuera de las islas del mapa UV la oclusión horneada es 0: ahí no hay piel.
    const ao = leer(relieve.image)
    const dentro = new Uint8Array(lado * lado)
    for (let i = 0; i < lado * lado; i++) dentro[i] = region[i]! > 0 || ao[i * 4 + 2]! > 0 ? 1 : 0
    return { ids, relieve, lado, region, dentro }
  })()
  // Si falla, se queda el fallo (ver cargarModeloAvatar).
  cargando.catch(() => undefined)
  return cargando
}

/** Región del modelo (1…48; 0 = ninguna) en un punto del mapa UV. */
export function regionEn(t: TexturasAvatar, u: number, v: number): number {
  const x = Math.min(t.lado - 1, Math.max(0, Math.floor(u * t.lado)))
  const y = Math.min(t.lado - 1, Math.max(0, Math.floor(v * t.lado)))
  return t.region[y * t.lado + x] ?? 0
}
