// Texturas del avatar: regiones musculares (rojo: músculo; verde: músculo profundo que hay debajo)
// y relieve (rojo y verde: normal; azul: oclusión ambiental). Las regiones se leen también en la CPU
// para saber qué músculo se toca.
import * as THREE from 'three'
import type { ModeloAvatar } from './modelo'

const BASE = import.meta.env.BASE_URL

export interface TexturasAvatar {
  ids: THREE.Texture
  relieve: THREE.Texture
  /** Región y marca de cada punto del mapa UV (a media resolución). */
  lado: number
  region: Uint8Array
  marca: Uint8Array
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
    ctx.drawImage(ids.image as CanvasImageSource, 0, 0, lado, lado)
    const px = ctx.getImageData(0, 0, lado, lado).data
    const region = new Uint8Array(lado * lado)
    const marca = new Uint8Array(lado * lado)
    for (let i = 0; i < lado * lado; i++) {
      region[i] = px[i * 4]!
      marca[i] = px[i * 4 + 1]!
    }
    return { ids, relieve, lado, region, marca }
  })()
  // Si falla, se queda el fallo (ver cargarModeloAvatar).
  cargando.catch(() => undefined)
  return cargando
}

/** Región (índice del músculo + 1; 0 = ninguno) y marca de músculo profundo en un punto del mapa UV. */
export function regionEn(t: TexturasAvatar, u: number, v: number): { region: number; marca: number } {
  const x = Math.min(t.lado - 1, Math.max(0, Math.floor(u * t.lado)))
  const y = Math.min(t.lado - 1, Math.max(0, Math.floor(v * t.lado)))
  return { region: t.region[y * t.lado + x] ?? 0, marca: t.marca[y * t.lado + x] ?? 0 }
}
