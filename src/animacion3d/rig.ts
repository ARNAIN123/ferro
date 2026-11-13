// El esqueleto del cuerpo 3D (public/modelos/cuerpo-rig.glb) y cómo ponerlo en una pose.
// Primero el tronco (pelvis, columna, cabeza, clavículas); después, con los hombros y caderas ya
// colocados, brazos y piernas por cinemática inversa hacia manos y pies.
import { Euler, Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { dosHuesos, giroEntreBases, perpendicular, v, type V3 } from './ik'
import { pulgarEnPuno } from './pulgar'

// Puntos de la superficie del cuerpo (cada 3 cm), por hueso, en reposo y en coordenadas de three.js.
// Los genera scripts/blender/generar-cuerpo.py (FERRO_PUNTOS) junto con el rig.
import SUPERFICIE from './superficie.json'

const LADOS = ['L', 'R'] as const
export type Lado = (typeof LADOS)[number]

/** Jerarquía del esqueleto (la misma que crea scripts/blender/generar-cuerpo.py). */
export const PADRES: Record<string, string | null> = {
  cadera: null,
  lumbar: 'cadera',
  dorsal: 'lumbar',
  pecho: 'dorsal',
  cuello: 'pecho',
  cabeza: 'cuello',
  ...Object.fromEntries(
    LADOS.flatMap((l) => [
      [`clavicula.${l}`, 'pecho'],
      [`brazo.${l}`, `clavicula.${l}`],
      [`antebrazo.${l}`, `brazo.${l}`],
      [`mano.${l}`, `antebrazo.${l}`],
      [`dedos.${l}`, `mano.${l}`],
      [`muslo.${l}`, 'cadera'],
      [`pierna.${l}`, `muslo.${l}`],
      [`pie.${l}`, `pierna.${l}`],
      [`punta.${l}`, `pie.${l}`],
    ]),
  ),
}

/**
 * Las falanges de cada dedo (las del corazón: «dedos», «dedos2» y «dedos3»). El cuerpo de Z-Anatomy
 * solo tiene «dedos» (los cuatro dedos juntos); el avatar, desde la ronda 5, las tres de cada dedo.
 */
export const CADENAS_DEDOS: readonly (readonly [string, string, string])[] = [
  ['dedos', 'dedos2', 'dedos3'],
  ['indice1', 'indice2', 'indice3'],
  ['anular1', 'anular2', 'anular3'],
  ['menique1', 'menique2', 'menique3'],
]

/**
 * Huesos que no todos los cuerpos tienen: las falanges de cada dedo, el pulgar y su punta (un hueso
 * sin peso que dice hacia dónde apunta). Si están, cierran la mano.
 */
/** La punta (hueso sin peso) que hay al final de cada dedo. */
const PUNTA_DEDO: Record<string, string> = { dedos: 'yema', indice1: 'yema_indice', anular1: 'yema_anular', menique1: 'yema_menique' }

export const OPCIONALES: readonly string[] = LADOS.flatMap((l) => [
  ...CADENAS_DEDOS.flat()
    .filter((h) => h !== 'dedos')
    .map((h) => `${h}.${l}`),
  ...Object.values(PUNTA_DEDO).map((h) => `${h}.${l}`),
  `pulgar0.${l}`,
  `pulgar.${l}`,
  `pulgar2.${l}`,
  `yema_pulgar.${l}`,
])

/**
 * Puño (ronda 5): hacia dónde va cada falange, como giro acumulado desde la dirección de la mano hacia
 * la palma (grados): nudillos a 80°, segunda falange a 90° más (vuelve hacia la muñeca) y tercera a
 * 40° más (hacia la palma). Con más, las yemas se meten en la palma o salen por el dorso.
 */
export const PUNO_GRADOS = [80, 170, 210] as const
/** El índice, algo menos cerrado: su punta no llega a la base del pulgar. */
export const PUNO_INDICE_GRADOS = [75, 160, 190] as const

/** three.js quita los puntos de los nombres al cargar el glTF ('brazo.L' → 'brazoL'). */
const clave = (nombre: string) => nombre.replace(/[.\s:/[\]]/g, '')

/** Una mano o un pie: dónde va y cómo se orienta. */
export interface Extremo {
  /** Muñeca o tobillo (mundo). */
  pos: V3
  /** Hacia dónde apunta el codo o la rodilla. */
  polo: V3
  /** Mano: de la muñeca a los nudillos. Pie: del tobillo a la base de los dedos. */
  dir: V3
  /** Mano: hacia dónde mira la palma. Pie: el empeine (hacia arriba si el pie está plano). */
  normal: V3
}

export interface Tronco {
  pelvis: { pos: V3; rot: V3 }
  /** Grados: [flexión (+ hacia delante), inclinación lateral, giro], repartidos por la columna. */
  columna: V3
  /** Grados, respecto al pecho: [flexión (+ barbilla abajo), ladeo, giro]. */
  cabeza?: V3
  /** Grados: [elevación, protracción (+ hombros hacia delante)]. */
  claviculas?: readonly [number, number]
}

export interface TroncoResuelto {
  hombro: Record<Lado, Vector3>
  cadera: Record<Lado, Vector3>
  pelvis: Vector3
  /** Ejes del pecho: arriba (hacia la cabeza), frente y izquierda del cuerpo. */
  arriba: Vector3
  frente: Vector3
  izquierda: Vector3
  /** Ejes de la pelvis. */
  pelvisArriba: Vector3
  pelvisFrente: Vector3
}

export interface Resultado {
  codo: Record<Lado, Vector3>
  muneca: Record<Lado, Vector3>
  rodilla: Record<Lado, Vector3>
  tobillo: Record<Lado, Vector3>
  /** ¿Llegó cada mano o pie a su sitio? (si no, se estiró hacia él). */
  alcanzado: Record<string, boolean>
}

const rad = (g: number) => (g * Math.PI) / 180
const ADELANTE = new Vector3(0, 0, 1)
const ARRIBA = new Vector3(0, 1, 0)
const IZQUIERDA = new Vector3(1, 0, 0)

interface Reposo {
  posLocal: Vector3
  quatLocal: Quaternion
  posMundo: Vector3
  quatMundo: Quaternion
}

export class Rig {
  private huesos = new Map<string, Object3D>()
  private reposo = new Map<string, Reposo>()
  /** Fase de la respiración (0–1): un movimiento secundario sutil del pecho. */
  respiracion = 0
  /** Lo que resolvió la última llamada a `aplicarExtremos` (para comprobar alcances). */
  ultimo: Resultado | null = null

  constructor(raiz: Object3D) {
    raiz.updateMatrixWorld(true)
    raiz.traverse((o) => {
      if ((o as { isBone?: boolean }).isBone) this.huesos.set(clave(o.name), o)
    })
    for (const nombre of [...Object.keys(PADRES), ...OPCIONALES.filter((n) => this.tiene(n))]) {
      const h = this.hueso(nombre)
      this.reposo.set(nombre, {
        posLocal: h.position.clone(),
        quatLocal: h.quaternion.clone(),
        posMundo: h.getWorldPosition(new Vector3()),
        quatMundo: h.getWorldQuaternion(new Quaternion()),
      })
    }
  }

  /** Si el cuerpo tiene ese hueso (los de OPCIONALES pueden faltar). */
  tiene(nombre: string): boolean {
    return this.huesos.has(clave(nombre))
  }

  hueso(nombre: string): Object3D {
    const h = this.huesos.get(clave(nombre))
    if (!h) throw new Error(`Falta el hueso ${nombre}`)
    return h
  }

  /** Posición de reposo (mundo) de una articulación. */
  enReposo(nombre: string): Vector3 {
    return this.reposo.get(nombre)!.posMundo.clone()
  }

  longitud(desde: string, hasta: string): number {
    return this.enReposo(desde).distanceTo(this.enReposo(hasta))
  }

  /** Vuelve a la postura de reposo (anatómica). */
  reiniciar(): void {
    for (const [nombre, r] of this.reposo) {
      const h = this.hueso(nombre)
      h.position.copy(r.posLocal)
      h.quaternion.copy(r.quatLocal)
    }
    this.hueso('cadera').updateMatrixWorld(true)
  }

  /** Orienta un hueso: `delta` es el giro (mundo) respecto a su orientación de reposo. */
  private orientar(nombre: string, delta: Quaternion): void {
    const h = this.hueso(nombre)
    const deseada = delta.clone().multiply(this.reposo.get(nombre)!.quatMundo)
    const padre = h.parent ? h.parent.getWorldQuaternion(new Quaternion()) : new Quaternion()
    h.quaternion.copy(padre.invert().multiply(deseada))
    h.updateMatrixWorld(true)
  }

  pos(nombre: string): Vector3 {
    return this.hueso(nombre).getWorldPosition(new Vector3())
  }


  aplicarTronco(t: Tronco): TroncoResuelto {
    this.reiniciar()
    const qPelvis = new Quaternion().setFromEuler(new Euler(rad(t.pelvis.rot[0]), rad(t.pelvis.rot[1]), rad(t.pelvis.rot[2]), 'YXZ'))
    const cadera = this.hueso('cadera')
    const destino = v(t.pelvis.pos)
    cadera.position.copy(cadera.parent ? cadera.parent.worldToLocal(destino.clone()) : destino)
    this.orientar('cadera', qPelvis)

    // La columna se reparte entre lumbar, dorsal y pecho; la respiración mueve un poco el pecho.
    const [flex, incl, giro] = t.columna
    const respira = Math.sin(this.respiracion * 2 * Math.PI) * 0.7
    let q = qPelvis.clone()
    for (const [nombre, peso, extra] of [
      ['lumbar', 0.3, 0],
      ['dorsal', 0.35, 0],
      ['pecho', 0.35, -respira],
    ] as const) {
      q = q.clone().multiply(new Quaternion().setFromEuler(new Euler(rad(flex * peso + extra), rad(giro * peso), rad(incl * peso), 'YXZ')))
      this.orientar(nombre, q)
    }
    const qPecho = q.clone()
    const [cf, cl, cg] = t.cabeza ?? [0, 0, 0]
    for (const nombre of ['cuello', 'cabeza']) {
      q = q.clone().multiply(new Quaternion().setFromEuler(new Euler(rad(cf * 0.5), rad(cg * 0.5), rad(cl * 0.5), 'YXZ')))
      this.orientar(nombre, q)
    }
    const [elev, prot] = t.claviculas ?? [0, 0]
    for (const lado of LADOS) {
      const s = lado === 'L' ? 1 : -1
      const qc = qPecho.clone().multiply(new Quaternion().setFromEuler(new Euler(0, rad(-prot * s), rad(elev * s), 'YXZ')))
      this.orientar(`clavicula.${lado}`, qc)
    }
    return {
      hombro: { L: this.pos('brazo.L'), R: this.pos('brazo.R') },
      cadera: { L: this.pos('muslo.L'), R: this.pos('muslo.R') },
      pelvis: this.pos('cadera'),
      arriba: ARRIBA.clone().applyQuaternion(qPecho),
      frente: ADELANTE.clone().applyQuaternion(qPecho),
      izquierda: IZQUIERDA.clone().applyQuaternion(qPecho),
      pelvisArriba: ARRIBA.clone().applyQuaternion(qPelvis),
      pelvisFrente: ADELANTE.clone().applyQuaternion(qPelvis),
    }
  }

  /**
   * Brazos, piernas y dedos (después de `aplicarTronco`). `dedos`: 0 abiertos, 1 cerrados. Con las
   * falanges y el pulgar (si el cuerpo los tiene), 1 es un puño (ver PUNO_GRADOS: cada dedo sobre sus
   * articulaciones) con el pulgar cruzado por fuera de los dedos índice y corazón.
   */
  aplicarExtremos(manos: Record<Lado, Extremo>, pies: Record<Lado, Extremo>, dedos = 0.85): Resultado {
    const r: Resultado = { codo: {} as Record<Lado, Vector3>, muneca: {} as Record<Lado, Vector3>, rodilla: {} as Record<Lado, Vector3>, tobillo: {} as Record<Lado, Vector3>, alcanzado: {} }
    for (const lado of LADOS) {
      // Brazo
      const m = manos[lado]
      const s = this.pos(`brazo.${lado}`)
      const a = this.longitud(`brazo.${lado}`, `antebrazo.${lado}`)
      const b = this.longitud(`antebrazo.${lado}`, `mano.${lado}`)
      const ik = dosHuesos(s, v(m.pos), a, b, v(m.polo))
      const dirBrazo = ik.medio.clone().sub(s)
      const dirAnte = ik.fin.clone().sub(ik.medio)
      const antBrazo = perpendicular(dirAnte, dirBrazo, v(m.polo).negate())
      this.orientar(`brazo.${lado}`, giroEntreBases(this.dirReposo(`brazo.${lado}`, `antebrazo.${lado}`), ADELANTE, dirBrazo, antBrazo))
      // El antebrazo gira a medias entre el brazo y la palma (pronación y supinación repartidas).
      const palma = perpendicular(v(m.normal), dirAnte)
      const mezcla = palma.clone().multiplyScalar(0.6).add(perpendicular(antBrazo, dirAnte).multiplyScalar(0.4))
      const antAnte = mezcla.lengthSq() > 1e-6 ? mezcla.normalize() : palma
      this.orientar(`antebrazo.${lado}`, giroEntreBases(this.dirReposo(`antebrazo.${lado}`, `mano.${lado}`), ADELANTE, dirAnte, antAnte))
      const qMano = giroEntreBases(this.dirReposo(`mano.${lado}`, `dedos.${lado}`), ADELANTE, v(m.dir), v(m.normal))
      this.orientar(`mano.${lado}`, qMano)
      const eje = new Vector3().crossVectors(v(m.dir), perpendicular(v(m.normal), v(m.dir))).normalize()
      this.orientar(`dedos.${lado}`, new Quaternion().setFromAxisAngle(eje, dedos * 1.4).multiply(qMano))
      // Con las falanges de cada dedo, cada una se lleva a la dirección que tiene en un puño (respecto a
      // la mano, no sumando giros: en reposo los dedos ya van algo doblados), y cada dedo gira sobre sus
      // propias articulaciones y por el camino más corto, así ninguno se tuerce hacia los lados.
      if (this.tiene(`dedos2.${lado}`)) {
        const d = v(m.dir).normalize()
        const n = perpendicular(v(m.normal), d)
        const k = Math.min(1, Math.max(0, dedos))
        const hacia = (g: number) => d.clone().multiplyScalar(Math.cos((g * Math.PI) / 180)).add(n.clone().multiplyScalar(Math.sin((g * Math.PI) / 180)))
        for (const cadena of CADENAS_DEDOS) {
          // El índice, algo menos cerrado: su punta no llega a la base del pulgar.
          const objetivos = (cadena[0] === 'indice1' ? PUNO_INDICE_GRADOS : PUNO_GRADOS).map(hacia)
          let delta = qMano.clone()
          cadena.forEach((h, i) => {
            const nombre = `${h}.${lado}`
            const siguiente = i < 2 ? `${cadena[i + 1]}.${lado}` : `${PUNTA_DEDO[cadena[0]]}.${lado}`
            if (!this.tiene(nombre) || !this.tiene(siguiente)) return
            const ahora = this.dirReposo(nombre, siguiente).normalize().applyQuaternion(delta)
            const giro = new Quaternion().setFromUnitVectors(ahora, objetivos[i]!)
            delta = new Quaternion().slerp(giro, k).multiply(delta)
            this.orientar(nombre, delta)
          })
        }
      }
      if (this.tiene(`pulgar.${lado}`) && this.tiene(`pulgar2.${lado}`) && this.tiene(`yema_pulgar.${lado}`)) {
        // El pulgar pasa por encima de los otros dedos: cruzado en diagonal del índice a la segunda
        // falange del corazón, apoyado en ellos de punta a punta (la postura medida en pulgar.ts). Si
        // el cuerpo tiene su metacarpiano, también gira (hacia la palma, como en un puño de verdad).
        const k = Math.min(1, Math.max(0, dedos))
        const cadena = [...(this.tiene(`pulgar0.${lado}`) ? ['pulgar0'] : []), 'pulgar', 'pulgar2', 'yema_pulgar'].map((h) => `${h}.${lado}`)
        const dirs = pulgarEnPuno(lado === 'L', qMano, cadena.length - 1)
        let delta = qMano.clone()
        cadena.slice(0, -1).forEach((h, i) => {
          const actual = this.dirReposo(h, cadena[i + 1]!).normalize().applyQuaternion(delta)
          delta = new Quaternion().slerp(new Quaternion().setFromUnitVectors(actual, dirs[i]!), k).multiply(delta)
          this.orientar(h, delta)
        })
      }
      r.codo[lado] = ik.medio
      r.muneca[lado] = this.pos(`mano.${lado}`)
      r.alcanzado[`mano.${lado}`] = ik.alcanzado

      // Pierna
      const p = pies[lado]
      const c = this.pos(`muslo.${lado}`)
      const ap = this.longitud(`muslo.${lado}`, `pierna.${lado}`)
      const bp = this.longitud(`pierna.${lado}`, `pie.${lado}`)
      const ikp = dosHuesos(c, v(p.pos), ap, bp, v(p.polo))
      const dirMuslo = ikp.medio.clone().sub(c)
      const dirPierna = ikp.fin.clone().sub(ikp.medio)
      const antMuslo = perpendicular(dirPierna, dirMuslo, v(p.polo).negate()).negate()
      this.orientar(`muslo.${lado}`, giroEntreBases(this.dirReposo(`muslo.${lado}`, `pierna.${lado}`), ADELANTE, dirMuslo, antMuslo))
      const antPierna = perpendicular(v(p.dir), dirPierna, antMuslo)
      this.orientar(`pierna.${lado}`, giroEntreBases(this.dirReposo(`pierna.${lado}`, `pie.${lado}`), ADELANTE, dirPierna, antPierna))
      this.orientar(`pie.${lado}`, giroEntreBases(this.dirReposo(`pie.${lado}`, `punta.${lado}`), ARRIBA, v(p.dir), v(p.normal)))
      r.rodilla[lado] = ikp.medio
      r.tobillo[lado] = this.pos(`pie.${lado}`)
      r.alcanzado[`pie.${lado}`] = ikp.alcanzado
    }
    this.ultimo = r
    return r
  }

  private superficieLocal: { nombre: string; hueso: Object3D; puntos: Vector3[] }[] | null = null

  /**
   * Recorre los puntos de la superficie del cuerpo en la pose actual (cada uno se mueve con el hueso
   * que más lo mueve). Sirve para comprobar que el cuerpo no atraviesa bancos, cajones ni el suelo.
   */
  recorrerSuperficie(f: (p: Vector3, hueso: string) => void, filtro?: (hueso: string) => boolean): void {
    this.superficieLocal ??= Object.entries(SUPERFICIE as Record<string, number[]>).flatMap(([nombre, xs]) => {
      const r = this.reposo.get(nombre)
      if (!r) return []
      const inversa = new Matrix4().compose(r.posMundo, r.quatMundo, new Vector3(1, 1, 1)).invert()
      const puntos: Vector3[] = []
      for (let i = 0; i + 2 < xs.length; i += 3) puntos.push(new Vector3(xs[i], xs[i + 1], xs[i + 2]).applyMatrix4(inversa))
      return [{ nombre, hueso: this.hueso(nombre), puntos }]
    })
    const p = new Vector3()
    for (const g of this.superficieLocal) {
      if (filtro && !filtro(g.nombre)) continue
      for (const q of g.puntos) f(p.copy(q).applyMatrix4(g.hueso.matrixWorld), g.nombre)
    }
  }

  private dirReposo(desde: string, hasta: string): Vector3 {
    return this.enReposo(hasta).sub(this.enReposo(desde))
  }
}
