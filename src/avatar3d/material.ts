// Material del avatar: arcilla mate. El músculo de cada punto sale de una textura de regiones (no de
// los vértices, que son pocos), así que los bordes entre músculos quedan limpios con cualquier forma.
// El relieve muscular es un mapa de normales cuya fuerza depende de la grasa corporal, y su canal
// azul lleva la oclusión ambiental.
import * as THREE from 'three'
import { NUM_REGIONES, type RGB } from '../domain/cuerpo3d'
import type { TexturasAvatar } from './texturas'

/** Ancho de la tabla de colores (una columna por región). */
const ANCHO_PALETA = 64
if (NUM_REGIONES + 1 > ANCHO_PALETA) throw new Error('La tabla de colores del avatar se ha quedado pequeña')

export interface MaterialesAvatar {
  material: THREE.MeshStandardMaterial
  /** Colores de cada región (la 0 es la piel sin músculo de Ferro). */
  pintar: (porRegion: readonly { color: RGB; brillo: number }[], acento: RGB) => void
  /** Fuerza del relieve muscular. */
  definir: (definicion: number) => void
  liberar: () => void
}

export function crearMaterialesAvatar(texturas: TexturasAvatar): MaterialesAvatar {
  // Color (rgb) y brillo (a) de cada región en una textura de 64 × 1: así el sombreador no indexa
  // arrays de uniformes con un número variable, que algunas tarjetas gráficas de móvil no llevan bien.
  const datosPaleta = new Float32Array(ANCHO_PALETA * 4)
  const paleta = new THREE.DataTexture(datosPaleta, ANCHO_PALETA, 1, THREE.RGBAFormat, THREE.FloatType)
  paleta.magFilter = paleta.minFilter = THREE.NearestFilter
  paleta.generateMipmaps = false
  paleta.needsUpdate = true
  const uniformes = {
    mapaIds: { value: texturas.ids },
    paletaRegiones: { value: paleta },
    colorBrillo: { value: new THREE.Color() },
  }
  const relieve = new THREE.Vector2(1, 1)
  const material = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, envMapIntensity: 0.1, normalMap: texturas.relieve })
  material.normalScale = relieve
  material.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniformes)
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D mapaIds;\nuniform sampler2D paletaRegiones;\nuniform vec3 colorBrillo;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec4 idsAvatar = texture2D( mapaIds, vNormalMapUv );
float idRegion = floor( idsAvatar.r * 255.0 + 0.5 );
vec4 aspecto = texture2D( paletaRegiones, vec2( ( idRegion + 0.5 ) / ${ANCHO_PALETA}.0, 0.5 ) );
diffuseColor.rgb = aspecto.rgb * ( 0.55 + 0.45 * pow( texture2D( normalMap, vNormalMapUv ).b, 1.5 ) );`,
      )
      // El mapa solo lleva x e y de la normal (el azul es la oclusión): la z se reconstruye.
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('#if defined( USE_PACKED_NORMALMAP )', '#if 1'))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += colorBrillo * aspecto.a;')
  }
  material.customProgramCacheKey = () => 'avatar'
  return {
    material,
    pintar(porRegion, acento) {
      porRegion.forEach((a, i) => datosPaleta.set([a.color[0], a.color[1], a.color[2], a.brillo], i * 4))
      paleta.needsUpdate = true
      uniformes.colorBrillo.value.setRGB(acento[0], acento[1], acento[2])
    },
    definir(definicion) {
      relieve.set(definicion, definicion)
    },
    liberar() {
      material.dispose()
      paleta.dispose()
    },
  }
}
