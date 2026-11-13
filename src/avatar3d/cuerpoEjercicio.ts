// El avatar de cada usuario como cuerpo de las animaciones de los ejercicios (ronda 5, fase 3): la
// misma forma, piel y colores que en el mapa muscular, con el esqueleto en las articulaciones de esa
// forma. Las animaciones se hicieron con el cuerpo de Z-Anatomy (public/modelos/cuerpo-rig.json):
// el avatar se escala para que su cadera quede a la misma altura que la de aquel cuerpo (así los
// pies llegan al suelo y los bancos, las barras y las poleas quedan a la altura de siempre), y lo
// demás —largo de brazos y piernas, anchura de hombros, grosor del tronco— es el suyo: brazos y
// piernas se colocan con cinemática inversa sobre sus huesos y el material va donde quedan sus manos.
import * as THREE from 'three'
import type { DatosCuerpo } from '../domain/cuerpo'
import type { RGB } from '../domain/cuerpo3d'
import { anadirPiel, crearEsqueleto, ponerEnReposo, type EsqueletoAvatar } from './esqueleto'
import type { FormaAvatar } from './forma'
import { aplicarForma, crearGeometriaAvatar } from './geometria'
import { crearMaterialesAvatar } from './material'
import type { ModeloAvatar } from './modelo'
import { resolverForma } from './resolver'
import type { TexturasAvatar } from './texturas'

/** Altura (m) de las caderas del cuerpo con el que se hicieron las animaciones (cuerpo-rig.json). */
export const CADERA_REFERENCIA = 0.862

/** Separación (m) entre los puntos de la superficie que se usan para apoyar bancos, cajones y suelo. */
const PASO_SUPERFICIE = 0.03

/** Lo que la escena de un ejercicio necesita de un cuerpo. */
export interface CuerpoEscena {
  /** Lo que se añade a la escena: los huesos (y la malla con piel, si la hay) ya a su escala. */
  objeto: THREE.Object3D
  /** Puntos de la superficie en reposo (mundo), por hueso: para apoyar bancos, cajones y suelo. */
  superficie: Record<string, number[]>
  /** Vuelve a poner el esqueleto en reposo (para usar el mismo cuerpo en otra escena). */
  reposo: () => void
  /** Colores de cada región (la 0 incluida) y color del brillo propio. */
  pintar: (porRegion: readonly { color: RGB; brillo: number }[], acento: RGB) => void
  liberar: () => void
}

/** Escala del avatar en las escenas: su cadera, a la altura de la del cuerpo de referencia. */
export function escalaEjercicio(forma: FormaAvatar): number {
  const a = forma.articulaciones
  return CADERA_REFERENCIA / ((a['muslo.L']![1] + a['muslo.R']![1]) / 2)
}

/**
 * Puntos de la superficie en reposo (uno cada 3 cm, con el hueso que más mueve cada uno), a la escala
 * de la escena: lo mismo que `superficie.json` para el cuerpo de Z-Anatomy, pero de esta forma.
 */
export function superficieAvatar(modelo: ModeloAvatar, forma: FormaAvatar, escala: number): Record<string, number[]> {
  const vistos = new Set<string>()
  const r: Record<string, number[]> = {}
  const p = forma.posiciones
  for (let i = 0; i < modelo.info.vertices_forma; i++) {
    const hueso = modelo.info.huesos[modelo.hueso[i]!]
    if (!hueso) continue
    const x = p[i * 3]! * escala
    const y = p[i * 3 + 1]! * escala
    const z = p[i * 3 + 2]! * escala
    const celda = `${hueso}|${Math.floor(x / PASO_SUPERFICIE)}|${Math.floor(y / PASO_SUPERFICIE)}|${Math.floor(z / PASO_SUPERFICIE)}`
    if (vistos.has(celda)) continue
    vistos.add(celda)
    ;(r[hueso] ??= []).push(+x.toFixed(4), +y.toFixed(4), +z.toFixed(4))
  }
  return r
}

/** El esqueleto del avatar con esa forma, a la escala de las escenas (sin malla: para los tests). */
export function esqueletoEjercicio(
  modelo: ModeloAvatar,
  forma: FormaAvatar,
): {
  objeto: THREE.Group
  esqueleto: EsqueletoAvatar
  escala: number
  reposo: () => void
} {
  const esqueleto = crearEsqueleto(modelo)
  const escala = escalaEjercicio(forma)
  const objeto = new THREE.Group()
  objeto.scale.setScalar(escala)
  objeto.add(esqueleto.raiz)
  const reposo = () => {
    ponerEnReposo(esqueleto, modelo, forma.articulaciones)
    objeto.updateMatrixWorld(true)
  }
  return { objeto, esqueleto, escala, reposo }
}

/** El avatar de unos datos (forma, piel, colores y relieve) como cuerpo de las escenas de ejercicios. */
export function crearCuerpoEjercicio(modelo: ModeloAvatar, texturas: TexturasAvatar, datos: DatosCuerpo): CuerpoEscena {
  const { forma, definicion } = resolverForma(modelo, datos)
  const geometria = crearGeometriaAvatar(modelo)
  anadirPiel(geometria, modelo)
  aplicarForma(geometria, modelo, forma)
  const materiales = crearMaterialesAvatar(texturas)
  materiales.definir(definicion)
  const { objeto, esqueleto, escala, reposo } = esqueletoEjercicio(modelo, forma)
  const malla = new THREE.SkinnedMesh(geometria, materiales.material)
  // Los huesos se apartan mucho de la postura de reposo: que three.js no lo recorte.
  malla.frustumCulled = false
  // El esqueleto cuelga de la malla (como en el visor).
  malla.add(esqueleto.raiz)
  objeto.add(malla)
  reposo()
  malla.bind(esqueleto.esqueleto)
  return {
    objeto,
    superficie: superficieAvatar(modelo, forma, escala),
    reposo,
    pintar: materiales.pintar,
    liberar() {
      objeto.removeFromParent()
      geometria.dispose()
      materiales.liberar()
    },
  }
}

/** Huella corta de unos datos del cuerpo (las miniaturas guardadas son de un cuerpo concreto). */
export function huellaCuerpo(datos: DatosCuerpo): string {
  // FNV-1a de 32 bits sobre el JSON de los datos.
  let h = 0x811c9dc5
  for (const c of JSON.stringify(datos)) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}
