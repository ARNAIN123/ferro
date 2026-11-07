// Esqueleto sin malla construido con las articulaciones del rig (public/modelos/cuerpo-rig.json):
// para los tests, que no cargan el glTF.
import { Bone, Object3D } from 'three'
import { PADRES } from './rig'

/** Coordenadas de Blender (Z arriba, frente −Y) → three.js (Y arriba, frente +Z). */
const aThree = (p: readonly number[]): [number, number, number] => [p[0]!, p[2]!, -p[1]!]

export function esqueletoDePrueba(articulaciones: Record<string, readonly number[]>): Object3D {
  const raiz = new Object3D()
  raiz.name = 'esqueleto'
  const huesos = new Map<string, Bone>()
  for (const nombre of Object.keys(PADRES)) {
    const h = new Bone()
    h.name = nombre.replace('.', '')
    huesos.set(nombre, h)
  }
  for (const [nombre, padre] of Object.entries(PADRES)) {
    const h = huesos.get(nombre)!
    const p = aThree(articulaciones[nombre]!)
    if (padre) {
      const q = aThree(articulaciones[padre]!)
      h.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2])
      huesos.get(padre)!.add(h)
    } else {
      h.position.set(...p)
      raiz.add(h)
    }
  }
  raiz.updateMatrixWorld(true)
  return raiz
}
