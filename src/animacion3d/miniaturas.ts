// Miniaturas animadas para las listas: un único renderizador sin pantalla dibuja 16 fotogramas de una
// repetición en una tira (WebP) que se anima con CSS. Se generan una vez y se guardan en el móvil.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BASE, conDraco, crearEntorno, leerColores, lucesEstudio } from './estudio'
import { CUADROS_MINIATURA as CUADROS, definicion3D, duracionRep } from './ejercicios'
import { EscenaEjercicio, type MusculosEjercicio } from './escena'

const LADO = 160
/** Cambia si cambian el modelo, el material o las animaciones: las miniaturas guardadas se rehacen. */
const VERSION = 'v3'

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

const leerGuardada = (clave: string) => {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}
const guardar = (clave: string, valor: string) => {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // Sin sitio: se volverá a generar la próxima vez.
  }
}

/** Tira de fotogramas (data URL) de la animación de un ejercicio. */
export function miniatura(id: string, musculos: MusculosEjercicio, tema: string): Promise<string> {
  const clave = `ferro.mini3d.${VERSION}.${tema}.${id}.${musculos.principales.join('+')}.${musculos.secundarios.join('+')}`
  const previa = enMemoria.get(clave)
  if (previa) return previa
  const guardada = leerGuardada(clave)
  if (guardada) {
    const p = Promise.resolve(guardada)
    enMemoria.set(clave, p)
    return p
  }
  // De una en una, para no atascar el móvil.
  const p = (cola = cola.then(() => generar(id, musculos))).then((url) => {
    guardar(clave, url as string)
    return url as string
  })
  enMemoria.set(clave, p)
  return p
}

async function generar(id: string, musculos: MusculosEjercicio): Promise<string> {
  const def = definicion3D(id)
  if (!def) throw new Error(`Sin animación 3D: ${id}`)
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
  renderer.renderLists.dispose()
  return tira.toDataURL('image/webp', 0.82)
}
