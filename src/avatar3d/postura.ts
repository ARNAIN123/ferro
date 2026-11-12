// Postura del avatar en el mapa muscular (ronda 5): de pie y relajado, no en la postura anatómica
// rígida del modelo. El peso algo más sobre la pierna derecha (la cadera izquierda baja un poco y esa
// rodilla se afloja), los hombros sueltos, los brazos colgando junto al cuerpo con los codos un poco
// doblados y las palmas hacia los muslos, la cabeza algo ladeada y los dedos medio cerrados. Encima,
// la respiración: el pecho y los hombros suben y bajan muy poco.
import { Object3D, Quaternion, Vector3 } from 'three'
import { perpendicular, type V3 } from '../animacion3d/ik'
import { Rig, type Extremo, type Lado } from '../animacion3d/rig'
import { aplicarPostura, crearEsqueleto, leerPostura, ponerEnReposo, type EsqueletoAvatar, type Postura } from './esqueleto'
import type { ModeloAvatar, Vec3 } from './modelo'

const V = (x: number, y: number, z: number) => new Vector3(x, y, z)
const t3 = (p: Vector3): V3 => [p.x, p.y, p.z]
const LADOS: readonly [Lado, number][] = [
  ['L', 1],
  ['R', -1],
]

/** Lo que se estira cada brazo respecto a su largo (con el codo un poco doblado, unos 20°). */
export const ESTIRADO_BRAZO = 0.985

/**
 * Postura relajada para una forma: el giro de cada hueso respecto a su padre. Se calcula con el mismo
 * rig que las animaciones (tronco primero y después brazos y piernas por cinemática inversa), así que
 * los pies se quedan apoyados en el suelo aunque la cadera baje y se ladee.
 */
export function posturaRelajada(modelo: ModeloAvatar, articulaciones: Record<string, Vec3>): Postura {
  const e = crearEsqueleto(modelo)
  ponerEnReposo(e, modelo, articulaciones)
  const raiz = new Object3D()
  raiz.add(e.raiz)
  const rig = new Rig(raiz)
  const r = (n: string) => rig.enReposo(n)

  // Tronco: la cadera se desplaza hacia la pierna de apoyo (la derecha, −X), baja un poco y la
  // izquierda cae (giro sobre el eje que mira al frente); la columna lo compensa y la cabeza se ladea.
  const cadera = r('cadera')
  const t = rig.aplicarTronco({
    pelvis: { pos: [cadera.x - 0.014, cadera.y - 0.007, cadera.z], rot: [1.5, 3, -2.5] },
    columna: [1, -2, 2.5],
    cabeza: [4, -3, 4],
    claviculas: [-4, 4],
  })

  // Pies: el derecho donde estaba; el izquierdo, algo adelantado y abierto.
  const pies = {} as Record<Lado, Extremo>
  for (const [lado, s] of LADOS) {
    const tobillo = r(`pie.${lado}`)
    const reposo = r(`punta.${lado}`).sub(tobillo).normalize()
    const abrir = ((lado === 'L' ? 11 : 6) * Math.PI) / 180
    const dir = reposo.clone().applyAxisAngle(V(0, 1, 0), abrir * s)
    const pos = lado === 'L' ? tobillo.clone().add(V(0.018, 0, 0.05)) : tobillo
    pies[lado] = { pos: t3(pos), polo: t3(V(Math.sin(abrir) * s, 0, Math.cos(abrir))), dir: t3(dir), normal: t3(perpendicular(V(0, 1, 0), dir)) }
  }

  // Brazos: colgando desde donde quedan los hombros, con la misma apertura que en reposo (que ya se
  // abre lo justo para no meterse en el cuerpo), un poco hacia delante y con el codo flojo.
  const manos = {} as Record<Lado, Extremo>
  for (const [lado, s] of LADOS) {
    const hombro = t.hombro[lado]
    const reposo = r(`mano.${lado}`).sub(r(`brazo.${lado}`)).normalize()
    const largo = rig.longitud(`brazo.${lado}`, `antebrazo.${lado}`) + rig.longitud(`antebrazo.${lado}`, `mano.${lado}`)
    // Un poco hacia delante (el izquierdo algo más, como si fuera a dar un paso).
    const adelante = ((lado === 'L' ? 6 : 3) * Math.PI) / 180
    const dir = reposo.clone().applyAxisAngle(V(1, 0, 0), -adelante).normalize()
    const muneca = hombro.clone().add(dir.multiplyScalar(largo * ESTIRADO_BRAZO))
    // Palma hacia el muslo y un poco hacia atrás; nudillos hacia abajo y algo adelante.
    const palma = V(-s, 0, -0.3).normalize()
    const nudillos = V(-0.06 * s, -1, 0.14).normalize()
    manos[lado] = { pos: t3(muneca), polo: t3(V(0.35 * s, -0.1, -1)), dir: t3(nudillos), normal: t3(perpendicular(palma, nudillos)) }
  }
  rig.aplicarExtremos(manos, pies, 0.32)
  return leerPostura(e)
}

/** Duración de una respiración (s): unas 14 por minuto. */
export const RESPIRACION_S = 4.3

const EJE_X = V(1, 0, 0)
const EJE_Z = V(0, 0, 1)
const giro = (eje: Vector3, grados: number) => new Quaternion().setFromAxisAngle(eje, (grados * Math.PI) / 180)

/**
 * Aplica la postura y, encima, la respiración en el segundo `t`: al tomar aire el pecho se abre un
 * poco hacia atrás y los hombros suben; la cabeza lo compensa para no cabecear.
 */
export function respirar(e: EsqueletoAvatar, base: Postura, t: number): void {
  aplicarPostura(e, base)
  // Inspiración algo más corta que la espiración.
  const fase = (t / RESPIRACION_S) % 1
  const k = fase < 0.42 ? Math.sin((fase / 0.42) * (Math.PI / 2)) : Math.cos(((fase - 0.42) / 0.58) * (Math.PI / 2))
  const aire = k * k
  e.porNombre.get('pecho')?.quaternion.multiply(giro(EJE_X, -0.9 * aire))
  e.porNombre.get('dorsal')?.quaternion.multiply(giro(EJE_X, -0.35 * aire))
  e.porNombre.get('cuello')?.quaternion.multiply(giro(EJE_X, 1.1 * aire))
  e.porNombre.get('clavicula.L')?.quaternion.multiply(giro(EJE_Z, 1.2 * aire))
  e.porNombre.get('clavicula.R')?.quaternion.multiply(giro(EJE_Z, -1.2 * aire))
}
