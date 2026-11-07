// Material de gimnasio modelado con geometría (sin texturas ni archivos): barra olímpica con discos,
// mancuernas, banco ajustable, polea con pila de discos y agarres, máquina de jalón y multipower.
// Medidas reales en metros. Todo en grises: el único color de la escena es el de los músculos.
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export const MATERIALES = {
  acero: new MeshStandardMaterial({ color: '#c3c7cc', metalness: 0.9, roughness: 0.28 }),
  aceroOscuro: new MeshStandardMaterial({ color: '#6b7076', metalness: 0.85, roughness: 0.38 }),
  goma: new MeshStandardMaterial({ color: '#1f2023', metalness: 0, roughness: 0.8 }),
  gomaBorde: new MeshStandardMaterial({ color: '#2c2e32', metalness: 0, roughness: 0.65 }),
  tapizado: new MeshStandardMaterial({ color: '#2a2b2f', metalness: 0, roughness: 0.92 }),
  estructura: new MeshStandardMaterial({ color: '#43474e', metalness: 0.55, roughness: 0.45 }),
  cable: new MeshStandardMaterial({ color: '#17181a', metalness: 0.2, roughness: 0.55 }),
  cuerda: new MeshStandardMaterial({ color: '#25272b', metalness: 0, roughness: 0.9 }),
  pila: new MeshStandardMaterial({ color: '#30333a', metalness: 0.6, roughness: 0.4 }),
}

const malla = (g: BufferGeometry, m: Material, nombre?: string) => {
  const o = new Mesh(g, m)
  if (nombre) o.name = nombre
  return o
}

/** Cilindro a lo largo del eje X (las barras y los discos van así). */
const cilindroX = (radio: number, largo: number, m: Material, x = 0, segmentos = 40) => {
  const o = malla(new CylinderGeometry(radio, radio, largo, segmentos), m)
  o.rotation.z = Math.PI / 2
  o.position.x = x
  return o
}

/** Coloca un cilindro de altura 1 (eje Y) entre dos puntos: para cables y cuerdas. */
export function tender(o: Object3D, desde: Vector3, hasta: Vector3): void {
  const d = hasta.clone().sub(desde)
  const largo = Math.max(1e-4, d.length())
  o.position.copy(desde).add(hasta).multiplyScalar(0.5)
  o.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()))
  o.scale.set(1, largo, 1)
}

export const crearTramo = (radio: number, m: Material) => malla(new CylinderGeometry(radio, radio, 1, 12), m)

// ── Barra olímpica ─────────────────────────────────────────────────────────────────────────

/**
 * Barra olímpica de 2,2 m: barra de 28 mm, tope, manguitos de 50 mm, discos de goma (bumper) y
 * cierres. `radioDisco` 0,225 = disco de 20 kg; 0 = sin discos.
 */
export function crearBarra({ radioDisco = 0.225, discos = 1, almohadilla = false } = {}): Group {
  const g = new Group()
  g.name = 'barra'
  g.add(cilindroX(0.014, 1.31, MATERIALES.acero))
  for (const s of [1, -1]) {
    g.add(cilindroX(0.034, 0.03, MATERIALES.acero, s * 0.67))
    g.add(cilindroX(0.025, 0.43, MATERIALES.acero, s * 0.9))
    let x = 0.69
    for (let i = 0; i < discos && radioDisco > 0; i++) {
      const grosor = radioDisco > 0.2 ? 0.055 : 0.035
      const disco = new Group()
      disco.add(cilindroX(radioDisco, grosor, MATERIALES.goma, 0, 56))
      disco.add(cilindroX(radioDisco * 0.97, grosor + 0.004, MATERIALES.gomaBorde, 0, 56))
      disco.add(cilindroX(0.06, grosor + 0.008, MATERIALES.aceroOscuro))
      disco.position.x = s * (x + grosor / 2)
      g.add(disco)
      x += grosor + 0.004
    }
    g.add(cilindroX(0.038, 0.035, MATERIALES.aceroOscuro, s * (x + 0.02)))
  }
  if (almohadilla) g.add(cilindroX(0.05, 0.42, MATERIALES.tapizado))
  return g
}

// ── Mancuerna ──────────────────────────────────────────────────────────────────────────────

/** Mancuerna de discos: empuñadura de 13 cm y dos discos por lado. Eje X. */
export function crearMancuerna(): Group {
  const g = new Group()
  g.name = 'mancuerna'
  g.add(cilindroX(0.016, 0.14, MATERIALES.acero))
  for (const s of [1, -1]) {
    g.add(cilindroX(0.075, 0.03, MATERIALES.goma, s * 0.088, 36))
    g.add(cilindroX(0.064, 0.028, MATERIALES.goma, s * 0.118, 36))
    g.add(cilindroX(0.03, 0.022, MATERIALES.aceroOscuro, s * 0.143))
  }
  return g
}

// ── Banco ──────────────────────────────────────────────────────────────────────────────────

/**
 * Banco ajustable: asiento y respaldo de verdad, con la inclinación del respaldo en grados (0 =
 * plano). A lo largo del eje Z: el respaldo hacia −Z, el asiento hacia +Z. Altura del tapizado: 45 cm.
 */
export function crearBanco({ inclinacion = 0, largoRespaldo = 0.82 } = {}): Group {
  const g = new Group()
  g.name = 'banco'
  const alto = 0.43
  const asiento = malla(new RoundedBoxGeometry(0.28, 0.07, 0.38, 3, 0.02), MATERIALES.tapizado)
  asiento.position.set(0, alto, 0.21)
  g.add(asiento)
  // El respaldo gira desde la unión con el asiento.
  const bisagra = new Group()
  bisagra.position.set(0, alto, 0.01)
  bisagra.rotation.x = (inclinacion * Math.PI) / 180
  const respaldo = malla(new RoundedBoxGeometry(0.28, 0.07, largoRespaldo, 3, 0.02), MATERIALES.tapizado)
  respaldo.position.set(0, 0, -largoRespaldo / 2)
  bisagra.add(respaldo)
  g.add(bisagra)
  // Estructura: viga central, patas en T y el puntal del respaldo si está inclinado.
  const viga = malla(new BoxGeometry(0.06, 0.06, 1.1), MATERIALES.estructura)
  viga.position.set(0, 0.34, -0.1)
  g.add(viga)
  for (const z of [0.36, -0.6]) {
    const pata = malla(new BoxGeometry(0.06, 0.32, 0.06), MATERIALES.estructura)
    pata.position.set(0, 0.17, z)
    g.add(pata)
    const pie = malla(new BoxGeometry(0.46, 0.05, 0.07), MATERIALES.estructura)
    pie.position.set(0, 0.025, z)
    g.add(pie)
    for (const s of [1, -1]) {
      const taco = malla(new BoxGeometry(0.05, 0.02, 0.07), MATERIALES.goma)
      taco.position.set(s * 0.22, 0.01, z)
      g.add(taco)
    }
  }
  if (inclinacion > 3) {
    const puntal = malla(new BoxGeometry(0.05, 0.05, 0.4), MATERIALES.estructura)
    const ang = (inclinacion * Math.PI) / 180
    puntal.position.set(0, 0.34 + Math.sin(ang) * 0.18, -0.25)
    puntal.rotation.x = -Math.atan2(Math.sin(ang) * 0.4, 0.4)
    g.add(puntal)
  }
  return g
}

// ── Polea ──────────────────────────────────────────────────────────────────────────────────

export type Agarre = 'cuerda' | 'recta' | 'triangulo' | 'estribo' | 'jalon'

export interface Polea {
  grupo: Group
  /** Punto (mundo) por donde sale el cable. */
  salida: Vector3
  /** Mueve la pila (m hacia arriba) y tiende el cable hasta el enganche (mundo). */
  actualizar: (enganche: Vector3, subida: number) => void
}

/**
 * Torre de polea con pila de discos y su guía: al tirar, los discos seleccionados suben lo mismo
 * que se alarga el cable. La torre está en `pos`, con la polea a `alturaPolea` y vuelta hacia +Z.
 */
export function crearPolea({ pos = new Vector3(), alturaPolea = 2.0, giroY = 0 } = {}): Polea {
  const g = new Group()
  g.name = 'polea'
  g.position.copy(pos)
  g.rotation.y = giroY
  const alto = 2.25
  for (const x of [-0.17, 0.17]) {
    const poste = malla(new BoxGeometry(0.07, alto, 0.07), MATERIALES.estructura)
    poste.position.set(x, alto / 2, -0.12)
    g.add(poste)
  }
  const travesano = malla(new BoxGeometry(0.42, 0.07, 0.07), MATERIALES.estructura)
  travesano.position.set(0, alto, -0.12)
  g.add(travesano)
  const base = malla(new BoxGeometry(0.6, 0.05, 0.6), MATERIALES.estructura)
  base.position.set(0, 0.025, -0.1)
  g.add(base)
  // Guías y pila: 14 discos de 2,5 cm; los 7 de arriba son los que suben.
  for (const x of [-0.06, 0.06]) {
    const guia = malla(new CylinderGeometry(0.008, 0.008, 1.8, 10), MATERIALES.acero)
    guia.position.set(x, 0.95, -0.12)
    g.add(guia)
  }
  const fija = new Group()
  const movil = new Group()
  for (let i = 0; i < 14; i++) {
    const disco = malla(new RoundedBoxGeometry(0.24, 0.024, 0.12, 2, 0.004), MATERIALES.pila)
    disco.position.set(0, 0.08 + i * 0.026, -0.12)
    ;(i < 7 ? fija : movil).add(disco)
  }
  const tope = malla(new BoxGeometry(0.26, 0.03, 0.13), MATERIALES.aceroOscuro)
  tope.position.set(0, 0.08 + 14 * 0.026 + 0.01, -0.12)
  movil.add(tope)
  g.add(fija, movil)
  // Polea de salida (rueda) y cable interior desde la pila.
  const rueda = malla(new TorusGeometry(0.045, 0.012, 10, 28), MATERIALES.aceroOscuro)
  rueda.position.set(0, alturaPolea, 0.04)
  rueda.rotation.y = Math.PI / 2
  g.add(rueda)
  const soporte = malla(new BoxGeometry(0.05, 0.05, 0.2), MATERIALES.estructura)
  soporte.position.set(0, alturaPolea, -0.04)
  g.add(soporte)
  const interior = crearTramo(0.0035, MATERIALES.cable)
  const exterior = crearTramo(0.0035, MATERIALES.cable)
  g.add(interior)
  const salidaLocal = new Vector3(0, alturaPolea - 0.045, 0.06)
  const raiz = new Group()
  raiz.add(g, exterior)
  g.updateMatrixWorld(true)
  const salida = g.localToWorld(salidaLocal.clone())
  return {
    grupo: raiz,
    salida,
    actualizar: (enganche, subida) => {
      movil.position.y = Math.max(0, Math.min(0.9, subida))
      const arribaPila = new Vector3(0, 0.08 + 14 * 0.026 + 0.03 + movil.position.y, -0.12)
      tender(interior, arribaPila, new Vector3(0, alto - 0.02, -0.12))
      tender(exterior, salida, enganche)
    },
  }
}

// ── Agarres de polea ───────────────────────────────────────────────────────────────────────

export interface Cuerda {
  grupo: Group
  /** Coloca la cuerda: enganche (arriba) y el punto de cada mano. */
  actualizar: (enganche: Vector3, manoL: Vector3, manoR: Vector3) => void
}

/** Cuerda de tríceps: dos ramales desde el enganche, con sus topes de goma al final. */
export function crearCuerda(): Cuerda {
  const g = new Group()
  g.name = 'cuerda'
  const anilla = malla(new TorusGeometry(0.02, 0.006, 8, 20), MATERIALES.acero)
  const ramales = [crearTramo(0.012, MATERIALES.cuerda), crearTramo(0.012, MATERIALES.cuerda)]
  const topes = [malla(new SphereGeometry(0.024, 16, 12), MATERIALES.goma), malla(new SphereGeometry(0.024, 16, 12), MATERIALES.goma)]
  g.add(anilla, ...ramales, ...topes)
  return {
    grupo: g,
    actualizar: (enganche, manoL, manoR) => {
      anilla.position.copy(enganche)
      ;[manoL, manoR].forEach((m, i) => {
        // El ramal pasa por la mano y acaba un poco más allá, en el tope.
        const fin = m.clone().add(m.clone().sub(enganche).normalize().multiplyScalar(0.05))
        tender(ramales[i]!, enganche, fin)
        topes[i]!.position.copy(fin)
      })
    },
  }
}

/** Barra de jalón (1,2 m con los extremos doblados hacia abajo) o barra recta corta. Eje X. */
export function crearBarraPolea(tipo: 'jalon' | 'recta'): Group {
  const g = new Group()
  g.name = tipo === 'jalon' ? 'barraJalon' : 'barraRecta'
  if (tipo === 'recta') {
    g.add(cilindroX(0.015, 0.5, MATERIALES.acero))
  } else {
    g.add(cilindroX(0.015, 0.78, MATERIALES.acero))
    for (const s of [1, -1]) {
      const punta = new Group()
      const tramo = cilindroX(0.015, 0.24, MATERIALES.acero, s * 0.12)
      punta.add(tramo)
      const funda = cilindroX(0.019, 0.14, MATERIALES.goma, s * 0.15)
      punta.add(funda)
      punta.position.x = s * 0.39
      punta.rotation.z = s * -0.32
      g.add(punta)
    }
  }
  const anilla = malla(new TorusGeometry(0.02, 0.006, 8, 20), MATERIALES.acero)
  anilla.position.y = 0.03
  g.add(anilla)
  return g
}

/** Triángulo (agarre en V cerrado) y estribo (asa en D). Eje X a la altura de la mano. */
export function crearAgarre(tipo: 'triangulo' | 'estribo'): Group {
  const g = new Group()
  g.name = tipo
  if (tipo === 'estribo') {
    const asa = malla(new TorusGeometry(0.07, 0.008, 10, 28, Math.PI), MATERIALES.acero)
    asa.rotation.x = Math.PI
    asa.position.y = 0.06
    g.add(asa, cilindroX(0.018, 0.13, MATERIALES.goma))
  } else {
    for (const s of [1, -1]) {
      const lado = crearTramo(0.01, MATERIALES.acero)
      tender(lado, new Vector3(0, 0.16, 0), new Vector3(s * 0.07, 0, 0))
      g.add(lado)
      const empunadura = malla(new CylinderGeometry(0.017, 0.017, 0.11, 16), MATERIALES.goma)
      empunadura.position.set(s * 0.07, -0.02, 0)
      g.add(empunadura)
    }
  }
  return g
}

// ── Máquina de jalón ───────────────────────────────────────────────────────────────────────

/** Máquina de jalón: asiento, rodilleros, estructura y polea alta que sale por encima del usuario. */
export function crearMaquinaJalon({ alturaAsiento = 0.47, rodilleros = new Vector3(0, 0.66, 0.3) } = {}): { grupo: Group; polea: Polea } {
  const g = new Group()
  g.name = 'maquinaJalon'
  const asiento = malla(new RoundedBoxGeometry(0.38, 0.08, 0.36, 3, 0.02), MATERIALES.tapizado)
  asiento.position.set(0, alturaAsiento - 0.04, 0.02)
  g.add(asiento)
  const columnaAsiento = malla(new BoxGeometry(0.07, alturaAsiento - 0.08, 0.07), MATERIALES.estructura)
  columnaAsiento.position.set(0, (alturaAsiento - 0.08) / 2, 0.02)
  g.add(columnaAsiento)
  for (const s of [1, -1]) {
    const rodillero = malla(new CylinderGeometry(0.05, 0.05, 0.16, 20), MATERIALES.tapizado)
    rodillero.rotation.z = Math.PI / 2
    rodillero.position.set(rodilleros.x + s * 0.12, rodilleros.y, rodilleros.z)
    g.add(rodillero)
  }
  // Los rodilleros salen de la torre.
  const brazoRodillero = malla(new BoxGeometry(0.05, 0.05, 0.9 - rodilleros.z), MATERIALES.estructura)
  brazoRodillero.position.set(0, rodilleros.y + 0.06, (0.9 + rodilleros.z) / 2)
  g.add(brazoRodillero)
  const base = malla(new BoxGeometry(0.5, 0.05, 1.25), MATERIALES.estructura)
  base.position.set(0, 0.025, 0.4)
  g.add(base)
  // La torre con la pila está delante del usuario (la mira de frente) y la viga alta vuelve hacia
  // atrás por encima de él hasta la polea, justo sobre la barra.
  const polea = crearPolea({ pos: new Vector3(0, 0, 0.9), alturaPolea: 2.3, giroY: Math.PI })
  g.add(polea.grupo)
  const viga = malla(new BoxGeometry(0.07, 0.07, 0.95), MATERIALES.estructura)
  viga.position.set(0, 2.3, 0.53)
  g.add(viga)
  const rueda = malla(new TorusGeometry(0.045, 0.012, 10, 28), MATERIALES.aceroOscuro)
  rueda.position.set(0, 2.27, 0.1)
  rueda.rotation.y = Math.PI / 2
  g.add(rueda)
  // La polea de esta máquina sale por la rueda delantera.
  polea.salida.set(0, 2.23, 0.1)
  return { grupo: g, polea }
}

// ── Multipower ─────────────────────────────────────────────────────────────────────────────

/** Multipower: dos guías verticales, barra que corre por ellas y ganchos para dejarla. Eje X. */
export function crearMultipower(): { grupo: Group; barra: Group } {
  const g = new Group()
  g.name = 'multipower'
  for (const s of [1, -1]) {
    const guia = malla(new CylinderGeometry(0.02, 0.02, 2.1, 16), MATERIALES.acero)
    guia.position.set(s * 0.66, 1.1, 0)
    g.add(guia)
    const poste = malla(new BoxGeometry(0.08, 2.2, 0.08), MATERIALES.estructura)
    poste.position.set(s * 0.8, 1.1, -0.05)
    g.add(poste)
    for (let i = 0; i < 9; i++) {
      const tope = malla(new BoxGeometry(0.03, 0.025, 0.05), MATERIALES.aceroOscuro)
      tope.position.set(s * 0.74, 0.35 + i * 0.18, 0.02)
      g.add(tope)
    }
  }
  const arriba = malla(new BoxGeometry(1.68, 0.08, 0.1), MATERIALES.estructura)
  arriba.position.set(0, 2.2, -0.05)
  g.add(arriba)
  const barra = crearBarra({ radioDisco: 0 })
  for (const s of [1, -1]) {
    const carro = malla(new BoxGeometry(0.06, 0.1, 0.06), MATERIALES.aceroOscuro)
    carro.position.set(s * 0.66, 0, 0)
    const gancho = malla(new BoxGeometry(0.02, 0.06, 0.05), MATERIALES.aceroOscuro)
    gancho.position.set(s * 0.6, -0.02, 0.04)
    gancho.rotation.x = 0.4
    barra.add(carro, gancho)
  }
  g.add(barra)
  return { grupo: g, barra }
}
