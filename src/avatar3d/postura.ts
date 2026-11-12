// Postura del avatar en el mapa muscular (ronda 5): de pie, recto y simétrico, como en el gimnasio,
// no en la postura anatómica rígida del modelo. Pecho fuera y hombros atrás, piernas a la anchura de
// las caderas con las puntas algo abiertas y las rodillas sin bloquear, los brazos algo abiertos (como
// con los dorsales marcados) con los codos un poco doblados, las palmas hacia dentro y los dedos
// medio cerrados. Encima, la respiración: el pecho y los hombros suben y bajan muy poco.
import { Object3D, Quaternion, Vector3 } from 'three'
import { perpendicular, type V3 } from '../animacion3d/ik'
import { Rig, type Extremo, type Lado } from '../animacion3d/rig'
import { aplicarPostura, crearEsqueleto, leerPostura, ponerEnReposo, type EsqueletoAvatar, type Postura } from './esqueleto'
import type { ModeloAvatar, Vec3 } from './modelo'

const V = (x: number, y: number, z: number) => new Vector3(x, y, z)
const t3 = (p: Vector3): V3 => [p.x, p.y, p.z]
const rad = (g: number) => (g * Math.PI) / 180
const LADOS: readonly [Lado, number][] = [
  ['L', 1],
  ['R', -1],
]

/** Lo que se estira cada brazo respecto a su largo (con el codo un poco doblado, unos 18°). */
export const ESTIRADO_BRAZO = 0.988
/** Lo que se abren los brazos (grados) además de lo que ya se abren en reposo. */
export const APERTURA_BRAZOS = 8

/**
 * Postura de gimnasio para una forma: el giro de cada hueso respecto a su padre. Se calcula con el
 * mismo rig que las animaciones (tronco primero y después brazos y piernas por cinemática inversa),
 * así que los pies se quedan apoyados en el suelo. Es simétrica: los dos lados igual.
 */
export function posturaRelajada(modelo: ModeloAvatar, articulaciones: Record<string, Vec3>): Postura {
  const e = crearEsqueleto(modelo)
  ponerEnReposo(e, modelo, articulaciones)
  const raiz = new Object3D()
  raiz.add(e.raiz)
  const rig = new Rig(raiz)
  const r = (n: string) => rig.enReposo(n)

  // Tronco: la cadera en su sitio (apenas baja, con las rodillas sin bloquear), la columna se
  // extiende un poco (pecho fuera), la barbilla lo compensa y los hombros van atrás.
  const cadera = r('cadera')
  const t = rig.aplicarTronco({
    pelvis: { pos: [cadera.x, cadera.y - 0.004, cadera.z], rot: [1, 0, 0] },
    columna: [-4, 0, 0],
    cabeza: [3, 0, 0],
    claviculas: [1, -7],
  })

  // Pies: a la anchura de las caderas, con las puntas algo abiertas.
  const pies = {} as Record<Lado, Extremo>
  for (const [lado, s] of LADOS) {
    const tobillo = r(`pie.${lado}`).add(V(0.012 * s, 0, 0))
    const reposo = r(`punta.${lado}`).sub(r(`pie.${lado}`)).normalize()
    const abrir = rad(9)
    const dir = reposo.clone().applyAxisAngle(V(0, 1, 0), abrir * s)
    pies[lado] = { pos: t3(tobillo), polo: t3(V(Math.sin(abrir) * s, 0, Math.cos(abrir))), dir: t3(dir), normal: t3(perpendicular(V(0, 1, 0), dir)) }
  }

  // Brazos: desde los hombros (ya atrás), algo más abiertos que en reposo, apenas hacia delante y
  // con el codo flojo hacia atrás y afuera.
  const manos = {} as Record<Lado, Extremo>
  for (const [lado, s] of LADOS) {
    const hombro = t.hombro[lado]
    const reposo = r(`mano.${lado}`).sub(r(`brazo.${lado}`)).normalize()
    const largo = rig.longitud(`brazo.${lado}`, `antebrazo.${lado}`) + rig.longitud(`antebrazo.${lado}`, `mano.${lado}`)
    const dir = reposo
      .clone()
      .applyAxisAngle(V(0, 0, 1), rad(APERTURA_BRAZOS) * s)
      .applyAxisAngle(V(1, 0, 0), -rad(2))
      .normalize()
    const muneca = hombro.clone().add(dir.multiplyScalar(largo * ESTIRADO_BRAZO))
    // Palma hacia dentro (hacia el muslo), con el pulgar delante; nudillos hacia abajo y un poco hacia dentro.
    const palma = V(-s, 0, 0.05).normalize()
    const nudillos = V(-0.12 * s, -1, 0.05).normalize()
    manos[lado] = { pos: t3(muneca), polo: t3(V(0.5 * s, -0.05, -1)), dir: t3(nudillos), normal: t3(perpendicular(palma, nudillos)) }
  }
  rig.aplicarExtremos(manos, pies, 0.45)
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
