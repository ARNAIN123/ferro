import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three'
import type { RegionAvatar } from '../../domain/avatar'
import type { Cuerpo } from './construirCuerpo'

/** Colores de partida (de las variables CSS del tema) y opacidad del acento por nivel. */
export interface Paleta {
  musculo: string
  piel: string
  tendon: string
  acento: string
}

const OPACIDAD = [0, 0.32, 0.5, 0.68, 0.85, 1]
const ARRASTRE = 0.011 // radianes por píxel
const UMBRAL_TOQUE = 7 // píxeles: menos que esto es un toque, no un giro

export interface Motor {
  /** Nivel 0–5 por región y región seleccionada (con su brillo). */
  pintar(nivel: (r: RegionAvatar) => number, tendon: (r: RegionAvatar) => boolean, seleccionada: (r: RegionAvatar) => boolean, paleta: Paleta): void
  /** Gira la figura hasta quedar de frente (0) o de espaldas (π). */
  girarA(angulo: number): void
  destruir(): void
}

/**
 * Escena de three.js con el cuerpo: se gira arrastrando en horizontal (con inercia) y un toque corto
 * elige la región que hay debajo del dedo. Solo dibuja cuando algo cambia, para no gastar batería.
 */
export function crearMotor(lienzo: HTMLCanvasElement, cuerpo: Cuerpo, alTocar: (r: RegionAvatar) => void): Motor {
  const renderer = new WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const escena = new Scene()
  const camara = new PerspectiveCamera(26, 1, 0.1, 20)
  escena.add(new HemisphereLight(0xffffff, 0x3a3836, 1.1))
  const clave = new DirectionalLight(0xffffff, 2.4)
  clave.position.set(-1.3, 1.7, 2.2)
  const relleno = new DirectionalLight(0xfff4ea, 0.7)
  relleno.position.set(1.6, 0.2, 1.2)
  const contraluz = new DirectionalLight(0xffffff, 1.2)
  contraluz.position.set(0.4, 1, -2.2)
  escena.add(clave, relleno, contraluz)

  // Geometría compartida entre avatares; cada uno tiene sus propios colores.
  const geometria = new BufferGeometry()
  geometria.setAttribute('position', cuerpo.geometria.getAttribute('position'))
  geometria.setAttribute('normal', cuerpo.geometria.getAttribute('normal'))
  geometria.setIndex(cuerpo.geometria.getIndex())
  geometria.boundingSphere = cuerpo.geometria.boundingSphere
  const colores = new Float32Array(cuerpo.regionDeVertice.length * 3)
  geometria.setAttribute('color', new BufferAttribute(colores, 3))
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.02 })
  const malla = new Mesh(geometria, material)
  escena.add(malla)

  let pendiente = 0
  const dibujar = () => {
    if (!pendiente) pendiente = requestAnimationFrame(() => {
      pendiente = 0
      renderer.render(escena, camara)
    })
  }

  // Encaje: la figura mide 1 de alto y ~0,5 de ancho; la cámara se aleja lo justo para que quepa.
  const encajar = () => {
    const w = lienzo.clientWidth
    const h = lienzo.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camara.aspect = w / h
    const tan = Math.tan(((camara.fov / 2) * Math.PI) / 180)
    const distancia = Math.max(0.53 / tan, 0.3 / (tan * camara.aspect))
    camara.position.set(0, 0, distancia)
    camara.lookAt(0, 0, 0)
    camara.updateProjectionMatrix()
    dibujar()
  }
  const observador = new ResizeObserver(encajar)
  observador.observe(lienzo)
  encajar()

  // Giro con inercia y animación a un ángulo.
  let velocidad = 0
  let objetivo: number | null = null
  let animando = 0
  const animar = () => {
    animando = 0
    if (objetivo !== null) {
      const d = objetivo - malla.rotation.y
      malla.rotation.y += d * 0.18
      if (Math.abs(d) < 0.002) {
        malla.rotation.y = objetivo
        objetivo = null
      }
    } else {
      malla.rotation.y += velocidad
      velocidad *= 0.92
      if (Math.abs(velocidad) < 0.0004) velocidad = 0
    }
    renderer.render(escena, camara)
    if (objetivo !== null || velocidad !== 0) animando = requestAnimationFrame(animar)
  }
  const arrancar = () => {
    if (!animando) animando = requestAnimationFrame(animar)
  }

  let inicio: { x: number; y: number; t: number; ultimo: number } | null = null
  let movido = 0
  const abajo = (e: PointerEvent) => {
    try {
      lienzo.setPointerCapture(e.pointerId)
    } catch {
      // Sin captura el giro sigue funcionando mientras el dedo esté sobre la figura.
    }
    inicio = { x: e.clientX, y: e.clientY, t: performance.now(), ultimo: e.clientX }
    movido = 0
    velocidad = 0
    objetivo = null
  }
  const mover = (e: PointerEvent) => {
    if (!inicio) return
    const dx = e.clientX - inicio.ultimo
    inicio.ultimo = e.clientX
    movido = Math.max(movido, Math.abs(e.clientX - inicio.x), Math.abs(e.clientY - inicio.y))
    if (movido < UMBRAL_TOQUE) return
    malla.rotation.y += dx * ARRASTRE
    velocidad = dx * ARRASTRE
    dibujar()
  }
  const raycaster = new Raycaster()
  const arriba = (e: PointerEvent) => {
    if (!inicio) return
    const fueToque = movido < UMBRAL_TOQUE && performance.now() - inicio.t < 500
    inicio = null
    if (!fueToque) return arrancar()
    const r = lienzo.getBoundingClientRect()
    raycaster.setFromCamera(new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camara)
    const golpe = raycaster.intersectObject(malla)[0]
    const id = golpe?.face ? cuerpo.regionDeVertice[golpe.face.a]! : -1
    if (id >= 0) alTocar(cuerpo.regiones[id]!)
  }
  const cancelar = () => {
    inicio = null
  }
  lienzo.addEventListener('pointerdown', abajo)
  lienzo.addEventListener('pointermove', mover)
  lienzo.addEventListener('pointerup', arriba)
  lienzo.addEventListener('pointercancel', cancelar)

  const a = new Color()
  const b = new Color()
  return {
    pintar(nivel, tendon, seleccionada, paleta) {
      const musculo = new Color(paleta.musculo)
      const piel = new Color(paleta.piel)
      const gris = new Color(paleta.tendon)
      const acento = new Color(paleta.acento)
      const blanco = new Color(0xffffff)
      const porRegion = cuerpo.regiones.map((r) => {
        if (tendon(r)) return gris.clone()
        a.copy(musculo).lerp(acento, OPACIDAD[Math.min(nivel(r), 5)]!)
        return seleccionada(r) ? a.clone().lerp(blanco, 0.35) : a.clone()
      })
      for (let v = 0; v < cuerpo.regionDeVertice.length; v++) {
        const id = cuerpo.regionDeVertice[v]!
        b.copy(id < 0 ? piel : porRegion[id]!)
        // Surco entre músculos: más oscuro, como una sombra de contacto.
        b.multiplyScalar(0.5 + 0.5 * cuerpo.surco[v]!)
        colores[v * 3] = b.r
        colores[v * 3 + 1] = b.g
        colores[v * 3 + 2] = b.b
      }
      geometria.getAttribute('color').needsUpdate = true
      dibujar()
    },
    girarA(angulo) {
      // Por el camino más corto.
      const actual = malla.rotation.y
      const vueltas = Math.round((actual - angulo) / (2 * Math.PI))
      objetivo = angulo + vueltas * 2 * Math.PI
      velocidad = 0
      arrancar()
    },
    destruir() {
      cancelAnimationFrame(pendiente)
      cancelAnimationFrame(animando)
      observador.disconnect()
      lienzo.removeEventListener('pointerdown', abajo)
      lienzo.removeEventListener('pointermove', mover)
      lienzo.removeEventListener('pointerup', arriba)
      lienzo.removeEventListener('pointercancel', cancelar)
      geometria.dispose()
      material.dispose()
      renderer.dispose()
    },
  }
}
