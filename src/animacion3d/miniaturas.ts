// Miniaturas animadas para las listas: un único renderizador sin pantalla dibuja los fotogramas de
// una repetición en una tira (WebP) que se anima con CSS, con el avatar de cada usuario. Se generan
// una vez, cuando hace falta, y se guardan en una base de datos aparte (no entra en las copias de
// seguridad ni toca los datos). Son de un cuerpo concreto: si cambia (peso, medidas, perfil…), se
// rehacen y las del cuerpo anterior se borran.
import Dexie, { type EntityTable } from 'dexie'
import * as THREE from 'three'
import type { EjercicioAnimable } from '../animacion/asignacion'
import { crearCuerpoEjercicio, huellaCuerpo, type CuerpoEscena } from '../avatar3d/cuerpoEjercicio'
import { cargarModeloAvatar } from '../avatar3d/modelo'
import { cargarTexturasAvatar } from '../avatar3d/texturas'
import type { DatosCuerpo } from '../domain/cuerpo'
import { definicion3D } from './biblioteca'
import { CUADROS_MINIATURA as CUADROS, duracionRep } from './ejercicios'
import { EscenaEjercicio, type MusculosEjercicio } from './escena'
import { crearEntorno, leerColores, lucesEstudio } from './estudio'

const LADO = 140
/** Cambia si cambian el modelo, el material o las animaciones: las miniaturas guardadas se rehacen. */
const VERSION = 'v11'

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

/** El avatar de las miniaturas: uno solo (se generan de una en una), el del último cuerpo pedido. */
let avatar: { huella: string; cuerpo: CuerpoEscena } | null = null
async function avatarDe(datos: DatosCuerpo): Promise<CuerpoEscena> {
  const huella = huellaCuerpo(datos)
  if (avatar?.huella !== huella) {
    avatar?.cuerpo.liberar()
    const modelo = await cargarModeloAvatar()
    avatar = { huella, cuerpo: crearCuerpoEjercicio(modelo, await cargarTexturasAvatar(modelo), datos) }
  }
  return avatar.cuerpo
}

/** Al pedir miniaturas de otro cuerpo, las guardadas de los anteriores ya no sirven: se borran. */
let huellaActual: string | null = null
function soloDe(huella: string) {
  if (huellaActual === huella) return
  huellaActual = huella
  void baseDeDatos()
    .tiras.filter((t) => !t.clave.includes(`|${huella}|`))
    .delete()
    .catch(() => undefined)
}

let motor: { renderer: THREE.WebGLRenderer; entorno: THREE.Texture } | null = null
const enMemoria = new Map<string, Promise<string>>()
let cola: Promise<unknown> = Promise.resolve()

/** Tira de fotogramas (URL de un Blob) de la animación de un ejercicio con el avatar de esos datos. */
export function miniatura(e: EjercicioAnimable, musculos: MusculosEjercicio, tema: string, datos: DatosCuerpo): Promise<string> {
  const huella = huellaCuerpo(datos)
  const clave = `${VERSION}|${tema}|${huella}|${e.id}|${e.material}|${musculos.principales.join('+')}|${musculos.secundarios.join('+')}`
  const previa = enMemoria.get(clave)
  if (previa) return previa
  soloDe(huella)
  const p = (async () => {
    try {
      const guardada = await baseDeDatos().tiras.get(clave)
      if (guardada) return URL.createObjectURL(guardada.tira)
    } catch {
      // Sin base de datos: se genera igual.
    }
    // De una en una, para no atascar el móvil.
    const tira = (await (cola = cola.then(
      () => generar(e, musculos, datos),
      () => generar(e, musculos, datos),
    ))) as Blob
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
export async function fotogramasRevision(
  e: EjercicioAnimable,
  musculos: MusculosEjercicio,
  datos: DatosCuerpo,
  o: { lado: number; cuadros: number[]; giro?: number; cerca?: number },
): Promise<string> {
  const def = definicion3D(e, huellaCuerpo(datos))
  const cuerpo = await avatarDe(datos)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(o.lado, o.lado, false)
  renderer.toneMapping = THREE.NeutralToneMapping
  const escena = new THREE.Scene()
  escena.environment = crearEntorno(renderer).textura
  for (const luz of lucesEstudio()) escena.add(luz)
  const ejercicio = new EscenaEjercicio(cuerpo, def, musculos, leerColores())
  ejercicio.ponerCuerpo()
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
  ejercicio.retirarCuerpo()
  renderer.dispose()
  return tira.toDataURL('image/webp', 0.85)
}

async function generar(e: EjercicioAnimable, musculos: MusculosEjercicio, datos: DatosCuerpo): Promise<Blob> {
  const def = definicion3D(e, huellaCuerpo(datos))
  const cuerpo = await avatarDe(datos)
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
  const ejercicio = new EscenaEjercicio(cuerpo, def, musculos, leerColores())
  ejercicio.ponerCuerpo()
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
  // Libera el material de esta escena (el avatar se usa en la siguiente).
  ejercicio.retirarCuerpo()
  ejercicio.raiz.traverse((o) => {
    const malla = o as THREE.Mesh
    if (malla.isMesh) malla.geometry.dispose()
  })
  renderer.renderLists.dispose()
  return new Promise((ok, mal) => tira.toBlob((b) => (b ? ok(b) : mal(new Error('Sin imagen'))), 'image/webp', 0.8))
}
