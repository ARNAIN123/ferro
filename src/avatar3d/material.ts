// Material del avatar: arcilla mate. El color de cada punto sale de un mapa de color en el espacio UV
// (mapaColor.ts), con el de cada grupo muscular y los bordes entre ellos difuminados: así la piel no
// parece recortada a trozos. El relieve muscular es un mapa de normales cuya fuerza depende de la
// definición del cuerpo, y su canal azul lleva la oclusión ambiental. Funciona con piel (SkinnedMesh).
import * as THREE from 'three'
import type { RGB } from '../domain/cuerpo3d'
import { crearMapaColor } from './mapaColor'
import type { TexturasAvatar } from './texturas'

/** Parte del relieve muscular horneado que se usa (con la definición de cada cuerpo). */
const FUERZA_RELIEVE = 0.45

export interface MaterialesAvatar {
  material: THREE.MeshStandardMaterial
  /** Colores de cada región (la 0 es la piel sin músculo de Ferro) y color del brillo propio. */
  pintar: (porRegion: readonly { color: RGB; brillo: number }[], acento: RGB) => void
  /** Fuerza del relieve muscular. */
  definir: (definicion: number) => void
  liberar: () => void
}

export function crearMaterialesAvatar(texturas: TexturasAvatar): MaterialesAvatar {
  const mapa = crearMapaColor(texturas)
  const uniformes = {
    mapaColor: { value: mapa.textura },
    colorBrillo: { value: new THREE.Color() },
  }
  const relieve = new THREE.Vector2(1, 1)
  const material = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0, envMapIntensity: 0.14, normalMap: texturas.relieve })
  material.normalScale = relieve
  material.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniformes)
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D mapaColor;\nuniform vec3 colorBrillo;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec4 aspecto = texture2D( mapaColor, vNormalMapUv );
diffuseColor.rgb = aspecto.rgb * ( 0.55 + 0.45 * pow( texture2D( normalMap, vNormalMapUv ).b, 1.5 ) );`,
      )
      // El mapa solo lleva x e y de la normal (el azul es la oclusión): la z se reconstruye.
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('#if defined( USE_PACKED_NORMALMAP )', '#if 1'))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += colorBrillo * aspecto.a;')
  }
  material.customProgramCacheKey = () => 'avatar-r5'
  return {
    material,
    pintar(porRegion, acento) {
      mapa.pintar(porRegion)
      uniformes.colorBrillo.value.setRGB(acento[0], acento[1], acento[2])
    },
    definir(definicion) {
      // El relieve horneado marca surcos hondos entre músculos: a toda fuerza, la piel parece cortada.
      const k = definicion * FUERZA_RELIEVE
      relieve.set(k, k)
    },
    liberar() {
      material.dispose()
      mapa.liberar()
    },
  }
}
