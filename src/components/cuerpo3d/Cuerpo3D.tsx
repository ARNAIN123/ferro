import { ContactShadows } from '@react-three/drei'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { DRACO_GLTF_CONFIG, DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  anguloCercano,
  aspectoDeNivel,
  colorCss,
  factorOclusion,
  FRENADO_GIRO,
  GIRO_POR_PIXEL,
  idDeCanal,
  limitarAltura,
  limitarZoom,
  musculoDeRegion,
  type RGB,
} from '../../domain/cuerpo3d'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { MUSCULOS, type Musculo } from '../../domain/tipos'
import { useAjustes } from '../../hooks/useAjustes'

const BASE = import.meta.env.BASE_URL
const MODELO = `${BASE}modelos/cuerpo.glb`
const ALTO = 1.71
const DISTANCIA = 3.75

// El decodificador Draco va empaquetado con la app (el de three.js): nada se descarga de fuera.
let draco: DRACOLoader | null = null
const conDraco = (l: GLTFLoader) => {
  draco ??= new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG)
  l.setDRACOLoader(draco)
}

export interface Cuerpo3DControl {
  /** Gira el cuerpo hasta un ángulo (0 = de frente, π = de espaldas). */
  girarA: (angulo: number, animado?: boolean) => void
  /** Vuelve a la vista inicial: de frente y sin zoom. */
  reiniciar: () => void
}

interface Props {
  /** Nivel 0–5 de cada músculo. */
  niveles: ReadonlyMap<Musculo, number>
  seleccionado?: Musculo | null
  onTocar?: (m: Musculo) => void
  /** Texto accesible de cada músculo (por defecto, su nombre). */
  describir?: (m: Musculo) => string
  className?: string
  /** Lo que se ve si el móvil no tiene WebGL (el mapa 2D). */
  sinWebgl?: ReactNode
}

/** Estado de la vista: se cambia fuera de React para que los gestos vayan a 60 fps. */
interface Vista {
  angulo: number
  velocidad: number
  objetivo: number | null
  zoom: number
  zoomObjetivo: number | null
  altura: number
  alturaObjetivo: number | null
}

const leerColores = () => {
  const css = getComputedStyle(document.documentElement)
  return { arcilla: colorCss(css.getPropertyValue('--cuerpo-arcilla') || '#8c8884'), acento: colorCss(css.getPropertyValue('--accent') || '#ff6b1f') }
}

/**
 * El cuerpo 3D de Ferro: arcilla mate con los músculos trabajados teñidos del acento según su nivel.
 * Se gira con el dedo (con inercia), se acerca pellizcando, un doble toque lo pone de frente y un
 * toque en un músculo lo elige. Solo se dibuja cuando algo se mueve.
 */
export const Cuerpo3D = forwardRef<Cuerpo3DControl, Props>(function Cuerpo3D({ niveles, seleccionado, onTocar, describir, className = '', sinWebgl }, ref) {
  const vista = useRef<Vista>({ angulo: 0, velocidad: 0, objetivo: null, zoom: 1, zoomObjetivo: null, altura: ALTO / 2, alturaObjetivo: null })
  const escena = useRef<{ camara: THREE.Camera; malla: THREE.Mesh; regiones: Uint8Array; invalidar: () => void } | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const [lado, setLado] = useState<'frente' | 'espalda'>('frente')
  const [conZoom, setConZoom] = useState(false)
  const tocar = useRef(onTocar)
  tocar.current = onTocar

  const mover = () => escena.current?.invalidar()
  const girarA = (angulo: number, animado = true) => {
    const v = vista.current
    v.velocidad = 0
    if (animado) v.objetivo = anguloCercano(v.angulo, angulo)
    else {
      v.angulo = angulo
      v.objetivo = null
    }
    mover()
  }
  const reiniciar = () => {
    const v = vista.current
    v.zoomObjetivo = 1
    v.alturaObjetivo = ALTO / 2
    setConZoom(false)
    girarA(0)
    setLado('frente')
  }
  useImperativeHandle(ref, () => ({ girarA, reiniciar }))

  // react-three-fiber no monta la escena hasta medir el lienzo, y en algunos WebView la primera medida
  // no llega hasta que hay un cambio de tamaño: se le avisa unas cuantas veces al aparecer.
  useEffect(() => {
    const avisos = [0, 120, 500, 1500].map((ms) => window.setTimeout(() => window.dispatchEvent(new Event('resize')), ms))
    return () => avisos.forEach((t) => window.clearTimeout(t))
  }, [])

  // ── Gestos: arrastrar gira (o sube y baja con zoom), pellizcar acerca, toque elige, doble toque reinicia.
  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const punteros = new Map<number, { x: number; y: number }>()
    let inicio: { x: number; y: number; t: number } | null = null
    let movido = false
    let ultimo = { x: 0, t: 0 }
    let distanciaInicial = 0
    let zoomInicial = 1
    let ultimoToque = { t: 0, x: 0, y: 0 }
    let toquePendiente: number | undefined

    const elegir = (x: number, y: number) => {
      const e = escena.current
      if (!e || !tocar.current) return
      const r = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
      const rayo = new THREE.Raycaster()
      rayo.setFromCamera(ndc, e.camara)
      const golpe = rayo.intersectObject(e.malla, false)[0]
      const musculo = golpe?.face ? musculoDeRegion(e.regiones[golpe.face.a] ?? 0) : null
      if (musculo) tocar.current(musculo)
    }

    const abajo = (ev: PointerEvent) => {
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      el.setPointerCapture(ev.pointerId)
      const v = vista.current
      v.velocidad = 0
      v.objetivo = null
      if (punteros.size === 1) {
        inicio = { x: ev.clientX, y: ev.clientY, t: performance.now() }
        movido = false
        ultimo = { x: ev.clientX, t: performance.now() }
      } else if (punteros.size === 2) {
        const [a, b] = [...punteros.values()]
        distanciaInicial = Math.hypot(a!.x - b!.x, a!.y - b!.y)
        zoomInicial = v.zoom
        movido = true
      }
    }
    const mueve = (ev: PointerEvent) => {
      const previo = punteros.get(ev.pointerId)
      if (!previo) return
      const v = vista.current
      const dx = ev.clientX - previo.x
      const dy = ev.clientY - previo.y
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      if (inicio && Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) > 8) movido = true
      if (punteros.size === 2) {
        const [a, b] = [...punteros.values()]
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
        if (distanciaInicial > 0) {
          v.zoom = limitarZoom(zoomInicial * (d / distanciaInicial))
          v.altura = limitarAltura(v.altura, v.zoom, ALTO)
          setConZoom(v.zoom > 1.02)
        }
      } else if (movido) {
        const ahora = performance.now()
        v.angulo += dx * GIRO_POR_PIXEL
        const dt = Math.max(1, ahora - ultimo.t)
        v.velocidad = (dx * GIRO_POR_PIXEL) / dt
        ultimo = { x: ev.clientX, t: ahora }
        if (v.zoom > 1.02) v.altura = limitarAltura(v.altura + dy * (ALTO / el.clientHeight) / v.zoom, v.zoom, ALTO)
      }
      mover()
    }
    const arriba = (ev: PointerEvent) => {
      punteros.delete(ev.pointerId)
      const v = vista.current
      if (performance.now() - ultimo.t > 80) v.velocidad = 0
      if (punteros.size === 0 && inicio && !movido && performance.now() - inicio.t < 350) {
        const ahora = performance.now()
        if (ahora - ultimoToque.t < 300 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 40) {
          window.clearTimeout(toquePendiente)
          ultimoToque = { t: 0, x: 0, y: 0 }
          reiniciar()
        } else {
          ultimoToque = { t: ahora, x: ev.clientX, y: ev.clientY }
          const { clientX, clientY } = ev
          toquePendiente = window.setTimeout(() => elegir(clientX, clientY), 260)
        }
      }
      if (punteros.size === 0) inicio = null
      mover()
    }
    const rueda = (ev: WheelEvent) => {
      if (!ev.ctrlKey && Math.abs(ev.deltaY) < 1) return
      ev.preventDefault()
      const v = vista.current
      v.zoom = limitarZoom(v.zoom * Math.exp(-ev.deltaY * 0.0015))
      v.altura = limitarAltura(v.altura, v.zoom, ALTO)
      setConZoom(v.zoom > 1.02)
      mover()
    }
    el.addEventListener('pointerdown', abajo)
    el.addEventListener('pointermove', mueve)
    el.addEventListener('pointerup', arriba)
    el.addEventListener('pointercancel', arriba)
    el.addEventListener('wheel', rueda, { passive: false })
    return () => {
      window.clearTimeout(toquePendiente)
      el.removeEventListener('pointerdown', abajo)
      el.removeEventListener('pointermove', mueve)
      el.removeEventListener('pointerup', arriba)
      el.removeEventListener('pointercancel', arriba)
      el.removeEventListener('wheel', rueda)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const girar = (l: 'frente' | 'espalda') => {
    setLado(l)
    girarA(l === 'frente' ? 0 : Math.PI)
  }

  return (
    // Sin alto propio, la figura toma una proporción de 4:5; con un alto (h-96…), lo llena.
    <div className={`relative aspect-[4/5] w-full ${className}`}>
      <div
        ref={contenedor}
        className="absolute inset-0 select-none"
        // Sin zoom, el desplazamiento vertical sigue moviendo la página; con zoom, mueve la vista.
        style={{ touchAction: conZoom ? 'none' : 'pan-y' }}
        role="img"
        aria-label="Cuerpo en 3D. Arrastra para girarlo, pellizca para acercarlo y toca dos veces para verlo de frente."
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.NeutralToneMapping }}
          camera={{ fov: 28, near: 0.1, far: 20, position: [0, ALTO / 2, DISTANCIA] }}
          fallback={sinWebgl}
        >
          <Suspense fallback={null}>
            <Escena vista={vista} niveles={niveles} seleccionado={seleccionado ?? null} alListo={(e) => (escena.current = e)} alCambiarLado={setLado} />
          </Suspense>
        </Canvas>
      </div>
      <div className="absolute right-0 bottom-0 flex gap-1 rounded-full bg-surface-2/80 p-1 text-xs font-semibold backdrop-blur">
        {(['frente', 'espalda'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => girar(l)}
            aria-pressed={lado === l}
            className={`min-h-9 rounded-full px-3 ${lado === l ? 'bg-accent text-accent-ink' : 'text-muted'}`}
          >
            {l === 'frente' ? 'Frente' : 'Espalda'}
          </button>
        ))}
      </div>
      {/* Para lectores de pantalla y teclado: los músculos como botones. */}
      {onTocar && (
        <ul className="sr-only">
          {MUSCULOS.map((m) => (
            <li key={m}>
              <button type="button" aria-pressed={seleccionado === m} onClick={() => onTocar(m)}>
                {describir?.(m) ?? NOMBRE_MUSCULO[m]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

/** Datos del modelo que no cambian: regiones y oclusión de cada vértice. */
interface Modelo {
  base: THREE.BufferGeometry
  regiones: Uint8Array
  oclusion: Float32Array
}
const modelos = new WeakMap<object, Modelo>()

function prepararModelo(gltf: { scene: THREE.Object3D }): Modelo {
  const previo = modelos.get(gltf)
  if (previo) return previo
  let malla: THREE.Mesh | null = null
  gltf.scene.traverse((o) => {
    if (!malla && (o as THREE.Mesh).isMesh) malla = o as THREE.Mesh
  })
  if (!malla) throw new Error('El modelo no tiene malla')
  const base = (malla as THREE.Mesh).geometry as THREE.BufferGeometry
  const datos = base.getAttribute('color') as THREE.BufferAttribute
  const n = base.getAttribute('position').count
  const regiones = new Uint8Array(n)
  const oclusion = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    regiones[i] = idDeCanal(datos.getX(i))
    oclusion[i] = datos.getY(i)
  }
  const m = { base, regiones, oclusion }
  modelos.set(gltf, m)
  return m
}

function Escena({
  vista,
  niveles,
  seleccionado,
  alListo,
  alCambiarLado,
}: {
  alCambiarLado: (l: 'frente' | 'espalda') => void
  vista: RefObject<Vista>
  niveles: ReadonlyMap<Musculo, number>
  seleccionado: Musculo | null
  alListo: (e: { camara: THREE.Camera; malla: THREE.Mesh; regiones: Uint8Array; invalidar: () => void }) => void
}) {
  const gltf = useLoader(GLTFLoader, MODELO, conDraco)
  const modelo = useMemo(() => prepararModelo(gltf), [gltf])
  const { gl, scene, camera, invalidate, setSize } = useThree()
  const grupo = useRef<THREE.Group>(null)
  const malla = useRef<THREE.Mesh>(null)
  const { tema } = useAjustes()
  const brillo = useMemo(() => ({ value: new THREE.Color() }), [])

  // Geometría propia (colores de este avatar) que comparte posiciones, normales e índices.
  const geometria = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setIndex(modelo.base.getIndex())
    g.setAttribute('position', modelo.base.getAttribute('position'))
    g.setAttribute('normal', modelo.base.getAttribute('normal'))
    const n = modelo.regiones.length
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('brillo', new THREE.Float32BufferAttribute(new Float32Array(n), 1))
    g.computeBoundingSphere()
    return g
  }, [modelo])
  useEffect(() => () => geometria.dispose(), [geometria])

  // Arcilla mate; los músculos de nivel alto tienen un brillo propio sutil.
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, envMapIntensity: 0.1 })
    m.onBeforeCompile = (s) => {
      s.uniforms.colorBrillo = brillo
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float brillo;\nvarying float vBrillo;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBrillo = brillo;')
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 colorBrillo;\nvarying float vBrillo;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += colorBrillo * vBrillo;')
    }
    return m
  }, [brillo])
  useEffect(() => () => material.dispose(), [material])

  // El lienzo se mide solo (en algunos WebView la primera medida llega tarde y se queda en 300×150).
  useEffect(() => {
    const padre = gl.domElement.parentElement
    if (!padre) return
    const medir = () => {
      const r = padre.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        setSize(r.width, r.height)
        invalidate()
      }
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(padre)
    return () => observador.disconnect()
  }, [gl, setSize, invalidate])

  // Entorno de estudio suave (generado en el momento, sin descargar nada).
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = entorno
    invalidate()
    return () => {
      scene.environment = null
      entorno.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, invalidate])

  // Colores según los niveles (y al cambiar de tema o de músculo elegido).
  useEffect(() => {
    const f = requestAnimationFrame(() => {
      const { arcilla, acento } = leerColores()
      brillo.value.setRGB(acento[0], acento[1], acento[2])
      const porRegion: { color: RGB; brillo: number }[] = [aspectoDeNivel(0, arcilla, acento)]
      for (const m of MUSCULOS) porRegion.push(aspectoDeNivel(niveles.get(m) ?? 0, arcilla, acento, m === seleccionado))
      const color = geometria.getAttribute('color') as THREE.BufferAttribute
      const brilloV = geometria.getAttribute('brillo') as THREE.BufferAttribute
      const c = color.array as Float32Array
      const b = brilloV.array as Float32Array
      for (let i = 0; i < modelo.regiones.length; i++) {
        const a = porRegion[modelo.regiones[i]!] ?? porRegion[0]!
        const k = factorOclusion(modelo.oclusion[i]!)
        c[i * 3] = a.color[0] * k
        c[i * 3 + 1] = a.color[1] * k
        c[i * 3 + 2] = a.color[2] * k
        b[i] = a.brillo
      }
      color.needsUpdate = true
      brilloV.needsUpdate = true
      invalidate()
    })
    return () => cancelAnimationFrame(f)
  }, [niveles, seleccionado, tema, geometria, modelo, brillo, invalidate])

  useEffect(() => {
    if (malla.current) alListo({ camara: camera, malla: malla.current, regiones: modelo.regiones, invalidar: invalidate })
  }, [camera, modelo, alListo, invalidate])

  const lado = useRef<'frente' | 'espalda'>('frente')

  // Inercia, animaciones de giro y zoom. Solo pide otro fotograma mientras algo se mueve.
  useFrame((_, dt) => {
    const v = vista.current
    if (!v || !grupo.current) return
    const ms = Math.min(dt, 0.05) * 1000
    let sigue = false
    if (v.objetivo !== null) {
      const d = v.objetivo - v.angulo
      v.angulo += d * Math.min(1, ms / 110)
      if (Math.abs(d) < 0.002) {
        v.angulo = v.objetivo
        v.objetivo = null
      } else sigue = true
    } else if (Math.abs(v.velocidad) > 0.00002) {
      v.angulo += v.velocidad * ms
      v.velocidad *= Math.exp(-ms / FRENADO_GIRO)
      sigue = true
    }
    if (v.zoomObjetivo !== null) {
      const d = v.zoomObjetivo - v.zoom
      v.zoom += d * Math.min(1, ms / 110)
      if (Math.abs(d) < 0.002) {
        v.zoom = v.zoomObjetivo
        v.zoomObjetivo = null
      } else sigue = true
    }
    if (v.alturaObjetivo !== null) {
      const d = v.alturaObjetivo - v.altura
      v.altura += d * Math.min(1, ms / 110)
      if (Math.abs(d) < 0.0005) {
        v.altura = v.alturaObjetivo
        v.alturaObjetivo = null
      } else sigue = true
    }
    grupo.current.rotation.y = v.angulo
    const ahora = Math.cos(v.angulo) >= 0 ? 'frente' : 'espalda'
    if (ahora !== lado.current) {
      lado.current = ahora
      alCambiarLado(ahora)
    }
    const cam = camera as THREE.PerspectiveCamera
    if (cam.zoom !== v.zoom) {
      cam.zoom = v.zoom
      cam.updateProjectionMatrix()
    }
    cam.position.set(0, v.altura, DISTANCIA)
    cam.lookAt(0, v.altura, 0)
    if (sigue) invalidate()
  })

  return (
    <>
      <ambientLight intensity={0.05} />
      {/* Luz principal delante y a la izquierda, de relleno a la derecha y de contorno por detrás. */}
      <directionalLight position={[-2.6, 3.2, 2.2]} intensity={1.35} />
      <directionalLight position={[2.6, 0.9, 2]} intensity={0.14} />
      <directionalLight position={[2.4, 2.2, -3]} intensity={1.1} color="#e6edff" />
      <directionalLight position={[-2.6, 1.6, -2.4]} intensity={0.6} color="#fff2e6" />
      <group ref={grupo}>
        <mesh ref={malla} geometry={geometria} material={material} />
        <ContactShadows position={[0, 0.001, 0]} scale={1.3} far={0.6} blur={2.4} opacity={0.75} resolution={512} frames={1} />
      </group>
    </>
  )
}
