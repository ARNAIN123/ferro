// Escena de un ejercicio en three.js puro (sin React): la usan el visor 3D y las miniaturas.
import { BufferAttribute, Color, Group, MeshStandardMaterial, Object3D, Quaternion, Vector3, Vector4, type BufferGeometry, type SkinnedMesh } from 'three'
import { clone as clonarConEsqueleto } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { aspectoDeNivel, idDeCanal, NUM_REGIONES, porRegion, type RGB } from '../domain/cuerpo3d'
import type { Musculo } from '../domain/tipos'
import { enConcentrica, momento, type AgarrePolea, type Definicion3D, type EstadoMaterial } from './ejercicios'
import { interpolar } from './ik'
import {
  crearAgarre,
  crearBanco,
  crearBancoLibre,
  crearBarra,
  crearBarraPolea,
  crearCaja,
  crearCuerda,
  crearDisco,
  crearHexagonal,
  crearLandmine,
  crearMancuerna,
  crearMaquinaJalon,
  crearMultipower,
  crearPolea,
  crearRodillo,
  crearTobillera,
  crearTorre,
  type Cuerda,
  type Polea,
} from './material'
import { Rig } from './rig'

/** Región y oclusión de cada vértice (del canal de color del modelo), una vez por geometría. */
function prepararGeometria(g: BufferGeometry): void {
  if (g.getAttribute('region')) return
  const datos = g.getAttribute('color')
  const n = g.getAttribute('position').count
  const region = new Float32Array(n)
  const oclusion = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    region[i] = idDeCanal(datos.getX(i))
    oclusion[i] = datos.getY(i)
  }
  g.setAttribute('region', new BufferAttribute(region, 1))
  g.setAttribute('oclusion', new BufferAttribute(oclusion, 1))
}

const REGIONES = NUM_REGIONES + 1

/** Material de arcilla con un color y un brillo por región que se cambian en la GPU. */
function materialPorRegiones() {
  // Por región: color (rgb) y brillo (a).
  const regiones = Array.from({ length: REGIONES }, () => new Vector4())
  const acento = { value: new Color() }
  const material = new MeshStandardMaterial({ roughness: 0.85, metalness: 0, envMapIntensity: 0.1 })
  material.onBeforeCompile = (s) => {
    s.uniforms.uRegiones = { value: regiones }
    s.uniforms.uAcento = acento
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float region;\nattribute float oclusion;\nuniform vec4 uRegiones[${REGIONES}];\nvarying vec3 vBase;\nvarying float vBrillo;`)
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvec4 deRegion = uRegiones[int(region + 0.5)];\nvBase = deRegion.rgb * (0.55 + 0.45 * pow(clamp(oclusion, 0.0, 1.0), 1.5));\nvBrillo = deRegion.a;',
      )
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uAcento;\nvarying vec3 vBase;\nvarying float vBrillo;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vBase;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uAcento * vBrillo;')
  }
  return {
    material,
    pintar: (deRegion: readonly { color: RGB; brillo: number }[], acentoRGB: RGB) => {
      deRegion.forEach((a, i) => regiones[i]!.set(a.color[0], a.color[1], a.color[2], a.brillo))
      acento.value.setRGB(acentoRGB[0], acentoRGB[1], acentoRGB[2])
    },
  }
}

export interface MusculosEjercicio {
  principales: readonly Musculo[]
  secundarios: readonly Musculo[]
}

export class EscenaEjercicio {
  readonly raiz = new Group()
  readonly rig: Rig
  private readonly pintor: ReturnType<typeof materialPorRegiones>
  private barra?: Object3D
  private mancuernas?: Partial<Record<'L' | 'R', Object3D>>
  private polea?: Polea
  private cuerda?: Cuerda
  private barraPolea?: Object3D
  private cableInicial = 0
  private multipower?: Object3D
  private disco?: Object3D
  private landmine?: ReturnType<typeof crearLandmine>
  private rodillo?: Object3D
  /** Torres de polea (pieza `torre`), con su cable y su agarre, en el mismo orden que los cables. */
  private torres: { polea: Polea; inicial: number; agarre?: { tipo: AgarrePolea; objeto?: Object3D; cuerda?: Cuerda } }[] = []
  private ultimoConcentrico: boolean | null = null

  readonly def: Definicion3D
  private readonly musculos: MusculosEjercicio
  private colores: { arcilla: RGB; acento: RGB }

  constructor(modelo: Object3D, def: Definicion3D, musculos: MusculosEjercicio, colores: { arcilla: RGB; acento: RGB }) {
    this.def = def
    this.musculos = musculos
    this.colores = colores
    const cuerpo = clonarConEsqueleto(modelo)
    this.pintor = materialPorRegiones()
    cuerpo.traverse((o) => {
      const m = o as SkinnedMesh
      if (m.isSkinnedMesh || (m as unknown as { isMesh?: boolean }).isMesh) {
        prepararGeometria(m.geometry)
        m.material = this.pintor.material
        // Los huesos se mueven lejos de su postura de reposo: que three.js no lo recorte.
        m.frustumCulled = false
      }
    })
    this.raiz.add(cuerpo)
    this.rig = new Rig(cuerpo)
    this.def.preparar?.(this.rig)
    this.montarMaterial()
    // Largo del cable al empezar: la pila sube lo que se alargue desde ahí.
    const estado = this.def.colocar(interpolar(this.def.claves, 0), this.rig)
    if (estado.cable && this.polea) this.cableInicial = this.polea.salida.distanceTo(estado.cable)
    estado.cables?.forEach((c, i) => {
      const t = this.torres[i]
      if (t) t.inicial = c.salida.distanceTo(this.engancheDe(i, estado))
    })
    this.pintar(false)
  }

  private montarMaterial(): void {
    for (const pieza of this.def.material) {
      switch (pieza.tipo) {
        case 'barra':
          this.barra = crearBarra({ radioDisco: pieza.radioDisco ?? 0.225, discos: pieza.discos ?? 1, almohadilla: pieza.almohadilla })
          this.raiz.add(this.barra)
          break
        case 'mancuernas': {
          const lados = pieza.manos ?? (['L', 'R'] as const)
          this.mancuernas = Object.fromEntries(lados.map((l) => [l, crearMancuerna()]))
          for (const m of Object.values(this.mancuernas)) if (m) this.raiz.add(m)
          break
        }
        case 'banco': {
          const banco = crearBanco({ inclinacion: pieza.inclinacion ?? 0, alto: pieza.alto })
          banco.position.set(...pieza.pos)
          banco.rotation.y = pieza.giroY ?? 0
          this.raiz.add(banco)
          break
        }
        case 'polea': {
          this.polea = crearPolea({ pos: new Vector3(...pieza.pos), alturaPolea: pieza.alturaPolea, giroY: pieza.giroY ?? 0 })
          this.raiz.add(this.polea.grupo)
          if (pieza.agarre === 'cuerda') {
            this.cuerda = crearCuerda()
            this.raiz.add(this.cuerda.grupo)
          } else {
            this.barraPolea = pieza.agarre === 'recta' ? crearBarraPolea('recta') : crearAgarre(pieza.agarre)
            this.raiz.add(this.barraPolea)
          }
          break
        }
        case 'hexagonal':
          this.barra = crearHexagonal()
          this.raiz.add(this.barra)
          break
        case 'disco':
          this.disco = crearDisco()
          this.raiz.add(this.disco)
          break
        case 'multipower': {
          const m = crearMultipower()
          this.multipower = m.grupo
          this.barra = m.barra
          this.raiz.add(m.grupo)
          break
        }
        case 'landmine':
          this.landmine = crearLandmine()
          this.raiz.add(this.landmine.grupo)
          break
        case 'rodillo':
          this.rodillo = crearRodillo()
          this.raiz.add(this.rodillo)
          break
        case 'caja': {
          const c = crearCaja(new Vector3(...pieza.tam))
          c.position.set(...pieza.centro)
          this.raiz.add(c)
          break
        }
        case 'bancoLibre': {
          const v = (q: readonly [number, number, number]) => new Vector3(...q)
          this.raiz.add(
            crearBancoLibre(
              [v(pieza.asiento[0]), v(pieza.asiento[1])],
              pieza.respaldo ? [v(pieza.respaldo[0]), v(pieza.respaldo[1])] : undefined,
              pieza.patas,
              pieza.arriba ? v(pieza.arriba) : undefined,
              pieza.arribaRespaldo ? v(pieza.arribaRespaldo) : undefined,
              pieza.ancho,
            ),
          )
          break
        }
        case 'torre': {
          const polea = crearTorre(new Vector3(...pieza.salida))
          this.raiz.add(polea.grupo)
          this.torres.push({ polea, inicial: 0 })
          break
        }
        case 'agarrePolea': {
          const torre = this.torres.find((t) => !t.agarre)
          if (!torre) break
          if (pieza.agarre === 'cuerda') {
            const cuerda = crearCuerda()
            this.raiz.add(cuerda.grupo)
            torre.agarre = { tipo: 'cuerda', cuerda }
          } else {
            const objeto = pieza.agarre === 'tobillera' ? crearTobillera() : pieza.agarre === 'recta' || pieza.agarre === 'jalon' ? crearBarraPolea(pieza.agarre) : crearAgarre(pieza.agarre)
            this.raiz.add(objeto)
            torre.agarre = { tipo: pieza.agarre, objeto }
          }
          break
        }
        case 'jalon': {
          const maquina = crearMaquinaJalon()
          this.polea = maquina.polea
          this.raiz.add(maquina.grupo)
          this.barraPolea = crearBarraPolea('jalon')
          this.raiz.add(this.barraPolea)
          break
        }
      }
    }
  }

  /** Colores de los músculos: los principales más vivos (y con brillo) durante la fase concéntrica. */
  private pintar(concentrico: boolean): void {
    if (this.ultimoConcentrico === concentrico) return
    this.ultimoConcentrico = concentrico
    const { arcilla, acento } = this.colores
    const nivel = (m: Musculo | null) => (!m ? 0 : this.musculos.principales.includes(m) ? (concentrico ? 5 : 4) : this.musculos.secundarios.includes(m) ? 2 : 0)
    this.pintor.pintar(
      porRegion((m) => aspectoDeNivel(nivel(m), arcilla, acento)),
      acento,
    )
  }

  cambiarColores(colores: { arcilla: RGB; acento: RGB }): void {
    this.colores = colores
    this.ultimoConcentrico = null
  }

  /** Pone la escena en el segundo `t` de la animación (3 repeticiones en bucle con una pausa). */
  actualizar(t: number): void {
    const m = momento(this.def, t)
    this.rig.respiracion = t / 3.6
    const p = interpolar(this.def.claves, m.t)
    const estado = this.def.colocar(p, this.rig)
    this.colocarMaterial(estado)
    this.pintar(!m.enPausa && enConcentrica(this.def, m.t))
  }

  /** Punto donde el cable `i` engancha su agarre (encima de las manos, hacia la polea). */
  private engancheDe(i: number, e: EstadoMaterial): Vector3 {
    const c = e.cables![i]!
    const tipo = this.torres[i]?.agarre?.tipo
    const hacia = c.salida.clone().sub(c.enganche).normalize()
    const distancia = tipo === 'cuerda' ? 0.16 : tipo === 'triangulo' ? 0.17 : tipo === 'estribo' ? 0.07 : tipo === 'recta' || tipo === 'jalon' ? 0.03 : 0
    return c.enganche.clone().add(hacia.multiplyScalar(distancia))
  }

  private colocarMaterial(e: EstadoMaterial): void {
    if (this.barra && e.barra) {
      this.barra.position.copy(e.barra)
      // Si las manos no están a la misma altura, la barra se inclina con ellas.
      if (e.ejeBarra) this.barra.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), e.ejeBarra)
    }
    if (this.barra && e.multipower) {
      // El multipower solo deja subir y bajar la barra por sus guías.
      this.barra.position.set(0, e.multipower.y, 0)
      if (this.multipower) this.multipower.position.set(e.multipower.x, 0, e.multipower.z)
    }
    if (this.mancuernas && e.mancuernas) {
      for (const lado of ['L', 'R'] as const) {
        const m = this.mancuernas[lado]
        const d = e.mancuernas[lado]
        if (!m || !d) continue
        m.position.copy(d.centro)
        m.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), d.eje))
      }
    }
    if (this.disco && e.disco) {
      this.disco.position.copy(e.disco.centro)
      this.disco.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), e.disco.eje))
    }
    if (this.landmine && e.landmine) this.landmine.actualizar(e.landmine.pivote, e.landmine.mano)
    if (this.rodillo && e.rodillo) this.rodillo.position.copy(e.rodillo).setY(0.09)
    e.cables?.forEach((c, i) => {
      const t = this.torres[i]
      if (!t) return
      const enganche = this.engancheDe(i, e)
      t.polea.actualizar(enganche, c.salida.distanceTo(enganche) - t.inicial)
      const a = t.agarre
      const sitio = e.agarresPolea?.[i]
      if (!a || !sitio) return
      if (a.cuerda) {
        const manos = sitio.manos ?? [sitio.centro.clone().add(new Vector3(0.06, 0, 0)), sitio.centro.clone().add(new Vector3(-0.06, 0, 0))]
        a.cuerda.actualizar(enganche, manos[0], manos[1])
      } else if (a.objeto) {
        a.objeto.position.copy(sitio.centro)
        if (a.tipo === 'estribo' || a.tipo === 'triangulo') {
          a.objeto.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), c.salida.clone().sub(sitio.centro).normalize()))
        } else if ((a.tipo === 'recta' || a.tipo === 'jalon') && sitio.manos) {
          // La barra va de una mano a la otra.
          const eje = sitio.manos[0].clone().sub(sitio.manos[1])
          if (eje.lengthSq() > 1e-4) a.objeto.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), eje.normalize())
        }
      }
    })
    if (this.barraPolea && e.barraPolea) this.barraPolea.position.copy(e.barraPolea)
    if (this.cuerda && e.cuerda) this.cuerda.actualizar(e.cuerda.enganche, e.cuerda.manos[0], e.cuerda.manos[1])
    if (this.polea && e.cable) this.polea.actualizar(e.cable, this.polea.salida.distanceTo(e.cable) - this.cableInicial)
  }
}
