// Escena de un ejercicio en three.js puro (sin React): la usan el visor 3D y las miniaturas.
import { BufferAttribute, Color, Group, MeshStandardMaterial, Object3D, Quaternion, SkinnedMesh, Vector3, type BufferGeometry } from 'three'
import { clone as clonarConEsqueleto } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { aspectoDeNivel, idDeCanal, type RGB } from '../domain/cuerpo3d'
import { MUSCULOS, type Musculo } from '../domain/tipos'
import { enConcentrica, momento, type Definicion3D, type EstadoMaterial } from './ejercicios'
import { interpolar } from './ik'
import { crearAgarre, crearBanco, crearBarra, crearBarraPolea, crearCuerda, crearMancuerna, crearMaquinaJalon, crearPolea, type Cuerda, type Polea } from './material'
import { Rig } from './rig'

/** Regiones y oclusión de cada vértice (del canal de color del modelo), una vez por geometría. */
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

const REGIONES = MUSCULOS.length + 1

/** Material de arcilla con un color y un brillo por región que se cambian en la GPU. */
function materialPorRegiones() {
  const colores = Array.from({ length: REGIONES }, () => new Color())
  const brillos = new Array<number>(REGIONES).fill(0)
  const acento = { value: new Color() }
  const m = new MeshStandardMaterial({ roughness: 0.85, metalness: 0, envMapIntensity: 0.1 })
  m.onBeforeCompile = (s) => {
    s.uniforms.uColores = { value: colores }
    s.uniforms.uBrillos = { value: brillos }
    s.uniforms.uAcento = acento
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nattribute float region;\nattribute float oclusion;\nuniform vec3 uColores[${REGIONES}];\nuniform float uBrillos[${REGIONES}];\nvarying vec3 vBase;\nvarying float vBrillo;`,
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nint r = int(region + 0.5);\nvBase = uColores[r] * (0.55 + 0.45 * pow(clamp(oclusion, 0.0, 1.0), 1.5));\nvBrillo = uBrillos[r];',
      )
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uAcento;\nvarying vec3 vBase;\nvarying float vBrillo;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vBase;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uAcento * vBrillo;')
  }
  return {
    material: m,
    pintar: (porRegion: readonly { color: RGB; brillo: number }[], acentoRGB: RGB) => {
      porRegion.forEach((a, i) => {
        colores[i]!.setRGB(a.color[0], a.color[1], a.color[2])
        brillos[i] = a.brillo
      })
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
  private mancuernas?: Record<'L' | 'R', Object3D>
  private polea?: Polea
  private cuerda?: Cuerda
  private barraPolea?: Object3D
  private cableInicial = 0
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
    this.montarMaterial()
    // Largo del cable al empezar: la pila sube lo que se alargue desde ahí.
    const estado = this.def.colocar(interpolar(this.def.claves, 0), this.rig)
    if (estado.cable && this.polea) this.cableInicial = this.polea.salida.distanceTo(estado.cable)
    this.pintar(false)
  }

  private montarMaterial(): void {
    for (const pieza of this.def.material) {
      switch (pieza.tipo) {
        case 'barra':
          this.barra = crearBarra({ radioDisco: pieza.radioDisco ?? 0.225, discos: pieza.discos ?? 1, almohadilla: pieza.almohadilla })
          this.raiz.add(this.barra)
          break
        case 'mancuernas':
          this.mancuernas = { L: crearMancuerna(), R: crearMancuerna() }
          this.raiz.add(this.mancuernas.L, this.mancuernas.R)
          break
        case 'banco': {
          const banco = crearBanco({ inclinacion: pieza.inclinacion ?? 0 })
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
    const porRegion = [aspectoDeNivel(0, arcilla, acento)]
    for (const m of MUSCULOS) {
      if (this.musculos.principales.includes(m)) porRegion.push(aspectoDeNivel(concentrico ? 5 : 4, arcilla, acento))
      else if (this.musculos.secundarios.includes(m)) porRegion.push(aspectoDeNivel(2, arcilla, acento))
      else porRegion.push(aspectoDeNivel(0, arcilla, acento))
    }
    this.pintor.pintar(porRegion, acento)
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

  private colocarMaterial(e: EstadoMaterial): void {
    if (this.barra && e.barra) this.barra.position.copy(e.barra)
    if (this.mancuernas && e.mancuernas) {
      for (const lado of ['L', 'R'] as const) {
        const { centro, eje } = e.mancuernas[lado]
        this.mancuernas[lado].position.copy(centro)
        this.mancuernas[lado].quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), eje))
      }
    }
    if (this.barraPolea && e.barraPolea) this.barraPolea.position.copy(e.barraPolea)
    if (this.cuerda && e.cuerda) this.cuerda.actualizar(e.cuerda.enganche, e.cuerda.manos[0], e.cuerda.manos[1])
    if (this.polea && e.cable) this.polea.actualizar(e.cable, this.polea.salida.distanceTo(e.cable) - this.cableInicial)
  }
}
