// Miniaturas animadas para las listas: un único renderizador sin pantalla dibuja los fotogramas de
// una repetición en una tira (WebP) que se anima con CSS. Se generan una vez, cuando hace falta, y
// se guardan en una base de datos aparte (no entra en las copias de seguridad ni toca los datos).
import Dexie, { type EntityTable } from 'dexie'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { EjercicioAnimable } from '../animacion/asignacion'
import { definicion3D } from './biblioteca'
import { CUADROS_MINIATURA as CUADROS, duracionRep } from './ejercicios'
import { EscenaEjercicio, type MusculosEjercicio } from './escena'
import { BASE, conDraco, crearEntorno, leerColores, lucesEstudio } from './estudio'

const LADO = 140
/** Cambia si cambian el modelo, el material o las animaciones: las miniaturas guardadas se rehacen. */
const VERSION = 'v10'

class Miniaturas extends Dexie {
  tiras!: EntityTable<{ clave: string; tira: Blob; creada: number }, 'clave'>
  constructor() {
    super('ferro-miniaturas')
    this.version(1).stores({ tiras: 'clave' })
  }
}
let base: Miniaturas | null = null
const baseDeDatos = () => {
  if (!base) {
    base = new Miniaturas()
    limpiarAntiguas(base)
  }
  return base
}

/**
 * Borra las miniaturas que ya no sirven: las de versiones anteriores y las del piloto (que iban en
 * localStorage con la clave `ferro.mini3d.…`). Son solo caché: los datos no se tocan.
 */
function limpiarAntiguas(db: Miniaturas) {
  void db.tiras
    .filter((t) => !t.clave.startsWith(`${VERSION}|`))
    .delete()
    .catch(() => undefined)
  try {
    // Primero las claves y después se borran (al borrar, el orden de las claves puede cambiar).
    const viejas = Object.keys(localStorage).filter((k) => k.startsWith('ferro.mini3d.'))
    for (const k of viejas) localStorage.removeItem(k)
  } catch {
    // Sin localStorage: no hay nada que limpiar.
  }
}

let modelo: Promise<THREE.Object3D> | null = null
const cargarModelo = () =>
  (modelo ??= new Promise((ok, mal) => {
    const l = new GLTFLoader()
    conDraco(l)
    l.load(`${BASE}modelos/cuerpo-rig.glb`, (g) => ok(g.scene), undefined, mal)
  }))

let motor: { renderer: THREE.WebGLRenderer; entorno: THREE.Texture } | null = null
const enMemoria = new Map<string, Promise<string>>()
let cola: Promise<unknown> = Promise.resolve()

/** Tira de fotogramas (URL de un Blob) de la animación de un ejercicio. */
export function miniatura(e: EjercicioAnimable, musculos: MusculosEjercicio, tema: string): Promise<string> {
  const clave = `${VERSION}|${tema}|${e.id}|${e.material}|${musculos.principales.join('+')}|${musculos.secundarios.join('+')}`
  const previa = enMemoria.get(clave)
  if (previa) return previa
  const p = (async () => {
    try {
      const guardada = await baseDeDatos().tiras.get(clave)
      if (guardada) return URL.createObjectURL(guardada.tira)
    } catch {
      // Sin base de datos: se genera igual.
    }
    // De una en una, para no atascar el móvil.
    const tira = (await (cola = cola.then(() => generar(e, musculos), () => generar(e, musculos)))) as Blob
    try {
      await baseDeDatos().tiras.put({ clave, tira, creada: Date.now() })
    } catch {
      // Sin sitio: se volverá a generar otra vez.
    }
    return URL.createObjectURL(tira)
  })()
  enMemoria.set(clave, p)
  p.catch(() => enMemoria.delete(clave))
  return p
}

/**
 * Solo para revisar (galería con `?revision`): fotogramas grandes de los cuadros `cuadros` (de 16),
 * con la cámara girada `giro` grados y acercada `cerca` veces. No se guardan.
 */
export async function fotogramasRevision(e: EjercicioAnimable, musculos: MusculosEjercicio, o: { lado: number; cuadros: number[]; giro?: number; cerca?: number }): Promise<string> {
  const def = definicion3D(e)
  const m = await cargarModelo()
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(o.lado, o.lado, false)
  renderer.toneMapping = THREE.NeutralToneMapping
  const escena = new THREE.Scene()
  escena.environment = crearEntorno(renderer).textura
  for (const luz of lucesEstudio()) escena.add(luz)
  const ejercicio = new EscenaEjercicio(m, def, musculos, leerColores())
  escena.add(ejercicio.raiz)
  const camara = new THREE.PerspectiveCamera(30 / (o.cerca ?? 1), 1, 0.1, 30)
  const az = ((def.camara.azimut + (o.giro ?? 0)) * Math.PI) / 180
  const [ox, oy, oz] = def.camara.objetivo
  camara.position.set(ox + Math.sin(az) * def.camara.distancia, def.camara.altura, oz + Math.cos(az) * def.camara.distancia)
  camara.lookAt(ox, oy, oz)
  const tira = document.createElement('canvas')
  // De dos en dos por fila.
  const columnas = Math.min(2, o.cuadros.length)
  tira.width = o.lado * columnas
  tira.height = o.lado * Math.ceil(o.cuadros.length / columnas)
  const ctx = tira.getContext('2d')!
  const rep = duracionRep(def)
  o.cuadros.forEach((c, i) => {
    ejercicio.actualizar((c * rep) / CUADROS)
    renderer.render(escena, camara)
    ctx.drawImage(renderer.domElement, (i % columnas) * o.lado, Math.floor(i / columnas) * o.lado)
  })
  renderer.dispose()
  return tira.toDataURL('image/webp', 0.85)
}

async function generar(e: EjercicioAnimable, musculos: MusculosEjercicio): Promise<Blob> {
  const def = definicion3D(e)
  const m = await cargarModelo()
  if (!motor) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(LADO, LADO, false)
    renderer.toneMapping = THREE.NeutralToneMapping
    motor = { renderer, entorno: crearEntorno(renderer).textura }
  }
  const { renderer, entorno } = motor
  const escena = new THREE.Scene()
  escena.environment = entorno
  for (const luz of lucesEstudio()) escena.add(luz)
  const ejercicio = new EscenaEjercicio(m, def, musculos, leerColores())
  escena.add(ejercicio.raiz)
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 30)
  const az = (def.camara.azimut * Math.PI) / 180
  const [ox, oy, oz] = def.camara.objetivo
  camara.position.set(ox + Math.sin(az) * def.camara.distancia, def.camara.altura, oz + Math.cos(az) * def.camara.distancia)
  camara.lookAt(ox, oy, oz)
  const tira = document.createElement('canvas')
  tira.width = LADO * CUADROS
  tira.height = LADO
  const ctx = tira.getContext('2d')!
  const rep = duracionRep(def)
  for (let i = 0; i < CUADROS; i++) {
    ejercicio.actualizar((i * rep) / CUADROS)
    renderer.render(escena, camara)
    ctx.drawImage(renderer.domElement, i * LADO, 0)
    // Cede el hilo entre fotogramas: la app sigue respondiendo.
    await new Promise((r) => setTimeout(r, 0))
  }
  // Libera el material de esta escena (el cuerpo se comparte).
  ejercicio.raiz.traverse((o) => {
    const malla = o as THREE.Mesh
    if (malla.isMesh && !(malla as THREE.SkinnedMesh).isSkinnedMesh) malla.geometry.dispose()
  })
  renderer.renderLists.dispose()
  return new Promise((ok, mal) => tira.toBlob((b) => (b ? ok(b) : mal(new Error('Sin imagen'))), 'image/webp', 0.8))
}
