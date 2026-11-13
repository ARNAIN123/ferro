// Material del avatar: arcilla mate. El color de cada punto sale de un mapa de color en el espacio UV
// (mapaColor.ts), con el de cada grupo muscular y los bordes entre ellos difuminados: así la piel no
// parece recortada a trozos. El relieve muscular es un mapa de normales cuya fuerza depende de la
// definición del cuerpo, y su canal azul lleva la oclusión ambiental. Funciona con piel (SkinnedMesh).
import * as THREE from 'three'
import type { RGB } from '../domain/cuerpo3d'
import { crearMapaColor, crearMapaRelieve, type MapaColor } from './mapaColor'
import type { TexturasAvatar } from './texturas'

/** Parte del relieve muscular horneado que se usa (con la definición de cada cuerpo). */
const FUERZA_RELIEVE = 0.7

/**
 * Mapas de color que se guardan (los últimos usados): volver a unos colores ya pintados no recalcula
 * nada (en un ejercicio, los músculos cambian de brillo en cada fase de la repetición).
 */
const MAPAS_GUARDADOS = 3

export interface MaterialesAvatar {
  material: THREE.MeshStandardMaterial
  /** Colores de cada región (la 0 es la piel sin músculo de Ferro) y color del brillo propio. */
  pintar: (porRegion: readonly { color: RGB; brillo: number }[], acento: RGB) => void
  /** Fuerza del relieve muscular. */
  definir: (definicion: number) => void
  liberar: () => void
}

export function crearMaterialesAvatar(texturas: TexturasAvatar): MaterialesAvatar {
  // Del más reciente al más antiguo; la clave son los colores con los que se pintó.
  const mapas: { clave: string; mapa: MapaColor }[] = [{ clave: '', mapa: crearMapaColor(texturas) }]
  const relieveRegion = crearMapaRelieve(texturas)
  const uniformes = {
    mapaColor: { value: mapas[0]!.mapa.textura },
    mapaRelieve: { value: relieveRegion },
    colorBrillo: { value: new THREE.Color() },
  }
  const relieve = new THREE.Vector2(1, 1)
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 0.14,
    normalMap: texturas.relieve,
  })
  material.normalScale = relieve
  material.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniformes)
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D mapaColor;\nuniform sampler2D mapaRelieve;\nuniform vec3 colorBrillo;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec4 aspecto = texture2D( mapaColor, vNormalMapUv );
diffuseColor.rgb = aspecto.rgb * ( 0.55 + 0.45 * pow( texture2D( normalMap, vNormalMapUv ).b, 1.5 ) );`,
      )
      // El mapa solo lleva x e y de la normal (el azul es la oclusión): la z se reconstruye. Su fuerza
      // depende también de la zona (en el pecho, el relieve horneado no encaja con la forma: casi nada).
      .replace(
        '#include <normal_fragment_maps>',
        THREE.ShaderChunk.normal_fragment_maps
          .replace('#if defined( USE_PACKED_NORMALMAP )', '#if 1')
          .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * texture2D( mapaRelieve, vNormalMapUv ).r;'),
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += colorBrillo * aspecto.a;')
  }
  material.customProgramCacheKey = () => 'avatar-r5'
  return {
    material,
    pintar(porRegion, acento) {
      const clave = porRegion.map((a) => `${a.color[0]},${a.color[1]},${a.color[2]},${a.brillo}`).join(';')
      const i = mapas.findIndex((m) => m.clave === clave)
      let usado = i >= 0 ? mapas.splice(i, 1)[0]! : undefined
      if (!usado) {
        // Uno nuevo o, si ya hay bastantes, el que hace más que no se usa.
        usado = mapas.length < MAPAS_GUARDADOS ? { clave: '', mapa: crearMapaColor(texturas) } : mapas.pop()!
        usado.mapa.pintar(porRegion)
        usado.clave = clave
      }
      mapas.unshift(usado)
      uniformes.mapaColor.value = usado.mapa.textura
      uniformes.colorBrillo.value.setRGB(acento[0], acento[1], acento[2])
    },
    definir(definicion) {
      // El relieve horneado marca surcos hondos entre músculos: a toda fuerza, la piel parece cortada.
      const k = definicion * FUERZA_RELIEVE
      relieve.set(k, k)
    },
    liberar() {
      material.dispose()
      for (const m of mapas) m.mapa.liberar()
      relieveRegion.dispose()
    },
  }
}
