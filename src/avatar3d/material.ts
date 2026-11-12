// Material del avatar: arcilla mate. El músculo de cada punto sale de una textura de regiones (no de
// los vértices, que son pocos), así que los bordes entre músculos quedan limpios con cualquier forma.
// El relieve muscular es un mapa de normales cuya fuerza depende de la grasa corporal, y su canal
// azul lleva la oclusión ambiental.
import * as THREE from 'three'
import type { RGB } from '../domain/cuerpo3d'
import { PROFUNDOS } from '../domain/musculos'
import { MUSCULOS } from '../domain/tipos'
import type { TexturasAvatar } from './texturas'

const REGIONES = MUSCULOS.length + 1
/** Ancho de la tabla de colores (una columna por región). */
const ANCHO_PALETA = 64
if (REGIONES > ANCHO_PALETA || PROFUNDOS.length > 4) throw new Error('La tabla de colores del avatar se ha quedado pequeña')

export interface MaterialesAvatar {
  /** Pasada opaca: todo menos la piel translúcida que hay sobre un músculo profundo resaltado. */
  material: THREE.MeshStandardMaterial
  /** Esa piel, translúcida, por encima (se dibuja después). */
  velo: THREE.MeshStandardMaterial
  /**
   * Colores de cada región (la 0 es la piel sin músculo de Ferro) y opacidad de la piel que hay sobre
   * cada músculo profundo. Devuelve si hay alguna «ventana» abierta (hay que dibujar el velo).
   */
  pintar: (porRegion: readonly { color: RGB; brillo: number }[], acento: RGB, sobre: readonly number[]) => boolean
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
    // Opacidad de la piel sobre cada uno de los 4 músculos profundos.
    uSobre: { value: new THREE.Vector4(1, 1, 1, 1) },
    colorBrillo: { value: new THREE.Color() },
  }
  const relieve = new THREE.Vector2(1, 1)
  const crear = (esVelo: boolean) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, envMapIntensity: 0.1, normalMap: texturas.relieve, transparent: esVelo, depthWrite: !esVelo })
    m.normalScale = relieve
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uniformes)
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D mapaIds;\nuniform sampler2D paletaRegiones;\nuniform vec4 uSobre;\nuniform vec3 colorBrillo;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
vec4 idsAvatar = texture2D( mapaIds, vNormalMapUv );
float idRegion = floor( idsAvatar.r * 255.0 + 0.5 );
vec4 aspecto = texture2D( paletaRegiones, vec2( ( idRegion + 0.5 ) / ${ANCHO_PALETA}.0, 0.5 ) );
diffuseColor.rgb = aspecto.rgb * ( 0.55 + 0.45 * pow( texture2D( normalMap, vNormalMapUv ).b, 1.5 ) );
float marcaPiel = floor( idsAvatar.g * 255.0 + 0.5 );
float opacidadPiel = 1.0 - dot( vec4( 1.0 ) - uSobre, vec4( equal( vec4( marcaPiel ), vec4( 1.0, 2.0, 3.0, 4.0 ) ) ) );
${esVelo ? 'if ( opacidadPiel >= 0.995 ) discard;\ndiffuseColor.a *= opacidadPiel;' : 'if ( opacidadPiel < 0.995 ) discard;\nif ( ! gl_FrontFacing ) diffuseColor.rgb *= 0.72;'}`,
        )
        // El mapa solo lleva x e y de la normal (el azul es la oclusión): la z se reconstruye.
        .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('#if defined( USE_PACKED_NORMALMAP )', '#if 1'))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += colorBrillo * aspecto.a;')
    }
    m.customProgramCacheKey = () => `avatar-${esVelo ? 'velo' : 'opaco'}`
    return m
  }
  const material = crear(false)
  const velo = crear(true)
  return {
    material,
    velo,
    pintar(porRegion, acento, sobre) {
      porRegion.forEach((a, i) => datosPaleta.set([a.color[0], a.color[1], a.color[2], a.brillo], i * 4))
      paleta.needsUpdate = true
      uniformes.colorBrillo.value.setRGB(acento[0], acento[1], acento[2])
      uniformes.uSobre.value.set(sobre[0] ?? 1, sobre[1] ?? 1, sobre[2] ?? 1, sobre[3] ?? 1)
      const hayVentana = sobre.some((o) => o < 1)
      // Con ventana se dibuja también el interior del cuerpo (las caras de dentro).
      const lado = hayVentana ? THREE.DoubleSide : THREE.FrontSide
      if (material.side !== lado) {
        material.side = lado
        material.needsUpdate = true
      }
      return hayVentana
    },
    definir(definicion) {
      relieve.set(definicion, definicion)
    },
    liberar() {
      material.dispose()
      velo.dispose()
      paleta.dispose()
    },
  }
}
