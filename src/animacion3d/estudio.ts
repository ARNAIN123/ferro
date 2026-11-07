// Escena de estudio compartida (sin React): carga con Draco, colores del tema, entorno y luces.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { DRACO_GLTF_CONFIG, DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { colorCss } from '../domain/cuerpo3d'

export const BASE = import.meta.env.BASE_URL

// El decodificador Draco va empaquetado con la app (el de three.js): nada se descarga de fuera.
let draco: DRACOLoader | null = null
export const conDraco = (l: GLTFLoader) => {
  draco ??= new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG)
  l.setDRACOLoader(draco)
}

/** Arcilla y acento del tema actual, en lineal. */
export const leerColores = () => {
  const css = getComputedStyle(document.documentElement)
  return { arcilla: colorCss(css.getPropertyValue('--cuerpo-arcilla') || '#8c8884'), acento: colorCss(css.getPropertyValue('--accent') || '#ff6b1f') }
}

/** Entorno de estudio suave para una escena (generado en el momento, sin descargar nada). */
export function crearEntorno(renderer: THREE.WebGLRenderer): { textura: THREE.Texture; liberar: () => void } {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const textura = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  return {
    textura,
    liberar: () => {
      textura.dispose()
      pmrem.dispose()
    },
  }
}

/** Luces de estudio: principal delante y a la izquierda, relleno a la derecha y dos de contorno detrás. */
export function lucesEstudio(): THREE.Light[] {
  const l = (x: number, y: number, z: number, i: number, color = '#ffffff') => {
    const d = new THREE.DirectionalLight(color, i)
    d.position.set(x, y, z)
    return d
  }
  return [new THREE.AmbientLight('#ffffff', 0.05), l(-2.6, 3.2, 2.2, 1.35), l(2.6, 0.9, 2, 0.14), l(2.4, 2.2, -3, 1.1, '#e6edff'), l(-2.6, 1.6, -2.4, 0.6, '#fff2e6')]
}
