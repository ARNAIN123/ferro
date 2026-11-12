// Esqueleto del avatar para three.js: los 24 huesos de Ferro (los mismos que las animaciones),
// colocados en las articulaciones de cada forma. En reposo no llevan giro: cada hueso está en su
// articulación y el cuerpo, en la postura anatómica del modelo. La malla con piel (SkinnedMesh) usa
// los pesos de MakeHuman agrupados en estos huesos (JOINTS_0 y WEIGHTS_0 del GLB).
import * as THREE from 'three'
import type { ModeloAvatar, Vec3 } from './modelo'

export interface EsqueletoAvatar {
  raiz: THREE.Bone
  /** En el orden de `info.huesos`, que es el de los índices de JOINTS_0. */
  huesos: THREE.Bone[]
  porNombre: Map<string, THREE.Bone>
  esqueleto: THREE.Skeleton
}

export function crearEsqueleto(modelo: ModeloAvatar): EsqueletoAvatar {
  const { huesos: nombres, padres } = modelo.info
  const huesos = nombres.map((n) => {
    const b = new THREE.Bone()
    b.name = n
    return b
  })
  nombres.forEach((_, i) => {
    const padre = padres[i]
    if (padre) huesos[nombres.indexOf(padre)]!.add(huesos[i]!)
  })
  const raiz = huesos[padres.indexOf(null)]
  if (!raiz) throw new Error('El esqueleto del avatar no tiene raíz')
  return { raiz, huesos, porNombre: new Map(nombres.map((n, i) => [n, huesos[i]!])), esqueleto: new THREE.Skeleton(huesos) }
}

/** Pone los huesos en la postura de reposo de una forma: cada uno en su articulación y sin giro. */
export function ponerEnReposo(e: EsqueletoAvatar, modelo: ModeloAvatar, articulaciones: Record<string, Vec3>): void {
  const { huesos: nombres, padres } = modelo.info
  nombres.forEach((n, i) => {
    const a = articulaciones[n]
    if (!a) throw new Error(`Falta la articulación ${n}`)
    const padre = padres[i]
    const p = padre ? articulaciones[padre]! : ([0, 0, 0] as Vec3)
    const h = e.huesos[i]!
    h.position.set(a[0] - p[0], a[1] - p[1], a[2] - p[2])
    h.quaternion.identity()
    h.scale.set(1, 1, 1)
  })
  e.raiz.updateMatrixWorld(true)
}

/** Añade a la geometría del avatar los huesos y los pesos de cada vértice (para la piel). */
export function anadirPiel(g: THREE.BufferGeometry, modelo: ModeloAvatar): void {
  g.setAttribute('skinIndex', new THREE.BufferAttribute(modelo.huesos4, 4))
  g.setAttribute('skinWeight', new THREE.BufferAttribute(modelo.pesos4, 4, true))
}

/** Giro y posición de cada hueso respecto a su padre: una postura que se puede guardar y aplicar. */
export type Postura = Map<string, { pos: THREE.Vector3; quat: THREE.Quaternion }>

export function leerPostura(e: EsqueletoAvatar): Postura {
  return new Map(e.huesos.map((h) => [h.name, { pos: h.position.clone(), quat: h.quaternion.clone() }]))
}

export function aplicarPostura(e: EsqueletoAvatar, p: Postura): void {
  for (const h of e.huesos) {
    const t = p.get(h.name)
    if (!t) continue
    h.position.copy(t.pos)
    h.quaternion.copy(t.quat)
  }
}
