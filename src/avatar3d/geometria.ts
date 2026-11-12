// Geometría de three.js del avatar: la malla es siempre la misma; al cambiar la forma se cambian
// las posiciones y se recalculan las normales y las tangentes (las del mapa de relieve).
import * as THREE from 'three'
import { normalesAvatar, type FormaAvatar } from './forma'
import type { ModeloAvatar } from './modelo'

export function crearGeometriaAvatar(modelo: ModeloAvatar): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setIndex(new THREE.BufferAttribute(modelo.indices, 1))
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(modelo.posiciones), 3))
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(modelo.vertices * 3), 3))
  g.setAttribute('uv', new THREE.BufferAttribute(modelo.uv, 2))
  return g
}

export function aplicarForma(g: THREE.BufferGeometry, modelo: ModeloAvatar, forma: FormaAvatar): void {
  const posicion = g.getAttribute('position') as THREE.BufferAttribute
  const normal = g.getAttribute('normal') as THREE.BufferAttribute
  ;(posicion.array as Float32Array).set(forma.posiciones)
  ;(normal.array as Float32Array).set(normalesAvatar(modelo, forma.posiciones))
  posicion.needsUpdate = true
  normal.needsUpdate = true
  // El mismo cálculo con el que se horneó el relieve (scripts/blender/generar-avatar.py).
  g.computeTangents()
  g.getAttribute('tangent').needsUpdate = true
  g.computeBoundingSphere()
  g.computeBoundingBox()
}
