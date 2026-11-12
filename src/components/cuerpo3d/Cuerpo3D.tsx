import { ContactShadows } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { forwardRef, Suspense, use, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { leerColores } from '../../animacion3d/estudio'
import { anadirPiel, crearEsqueleto, ponerEnReposo, type Postura } from '../../avatar3d/esqueleto'
import { aplicarForma, crearGeometriaAvatar } from '../../avatar3d/geometria'
import { crearMaterialesAvatar } from '../../avatar3d/material'
import { cargarModeloAvatar, type ModeloAvatar } from '../../avatar3d/modelo'
import { posturaRelajada, respirar } from '../../avatar3d/postura'
import { resolverForma } from '../../avatar3d/resolver'
import { cargarTexturasAvatar, regionEn, type TexturasAvatar } from '../../avatar3d/texturas'
import type { DatosCuerpo } from '../../domain/cuerpo'
import { anguloCercano, aspectoDeNivel, FRENADO_GIRO, GIRO_POR_PIXEL, limitarAltura, limitarZoom, musculoDeRegion, porRegion, type RGB } from '../../domain/cuerpo3d'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { MUSCULOS, type Musculo } from '../../domain/tipos'
import { useAjustes } from '../../hooks/useAjustes'
import { useCuerpo } from '../../hooks/useCuerpo'
import { guardarUltimoError, LimiteError } from '../LimiteError'

/** Alto con el que se ve el cuerpo: el avatar se dibuja a esta talla, mida lo que mida. */
const ALTO = 1.71
const DISTANCIA = 3.75
/** Con dos cuerpos (Antes / Ahora), lo que se aparta cada uno del centro. */
const SEPARACION = 0.38

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
  /** Proporción del visor cuando no se le da un alto. */
  proporcion?: string
  /** Lo que se ve si el móvil no tiene WebGL (el mapa 2D). */
  sinWebgl?: ReactNode
  /**
   * Los cuerpos que se dibujan. Por defecto, el mío de hoy (según el perfil corporal). Con dos, van
   * uno al lado del otro y giran a la vez (Antes / Ahora).
   */
  cuerpos?: readonly DatosCuerpo[]
}

/** Lo que necesitan los gestos de la escena ya montada. */
interface EscenaLista {
  camara: THREE.Camera
  mallas: () => THREE.Mesh[]
  texturas: TexturasAvatar
  invalidar: () => void
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

/** Fotogramas por segundo de la respiración (los gestos van a los del móvil). */
const FPS_RESPIRACION = 24

/**
 * El cuerpo 3D de Ferro: mi avatar (una persona musculada de mi peso y mi altura) en arcilla mate, de
 * pie y relajado, respirando, con los músculos trabajados teñidos del acento según su nivel y los
 * bordes suaves. Se gira con el dedo (con inercia), se acerca pellizcando, un doble toque lo pone de
 * frente y un toque en un músculo lo elige. Solo respira mientras se ve (y no con «reducir
 * movimiento»); si no, solo se dibuja cuando algo se mueve. Si algo falla (el modelo, la tarjeta
 * gráfica…), se ve el mapa 2D con el motivo, nunca una pantalla vacía.
 */
export const Cuerpo3D = forwardRef<Cuerpo3DControl, Props>(function Cuerpo3D(props, ref) {
  const [fallo, setFallo] = useState<string | null>(null)
  const sustituto = (motivo: string) => (
    // El mapa 2D ya trae su alto: el mensaje va debajo, sin montarse en lo que sigue.
    <div className="w-full">
      {props.sinWebgl}
      <p className="mt-1 text-center text-[11px] break-words text-muted">El cuerpo 3D no se ha podido mostrar ({motivo}).</p>
    </div>
  )
  if (fallo) return sustituto(fallo)
  return (
    <LimiteError alFallar={(e) => sustituto(`${e.name}: ${e.message}`)}>
      <Cuerpo3DVisor {...props} ref={ref} alFallar={setFallo} />
    </LimiteError>
  )
})

/** Nombre de la tarjeta gráfica (para saber dónde falla). */
function tarjetaGrafica(ctx: WebGLRenderingContext | WebGL2RenderingContext): string {
  try {
    const ext = ctx.getExtension('WEBGL_debug_renderer_info')
    return String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER))
  } catch {
    return 'GPU desconocida'
  }
}

const Cuerpo3DVisor = forwardRef<Cuerpo3DControl, Props & { alFallar: (motivo: string) => void }>(function Cuerpo3DVisor(
  { niveles, seleccionado, onTocar, describir, className = '', proporcion = 'aspect-[4/5]', sinWebgl, cuerpos, alFallar },
  ref,
) {
  const vista = useRef<Vista>({ angulo: 0, velocidad: 0, objetivo: null, zoom: 1, zoomObjetivo: null, altura: ALTO / 2, alturaObjetivo: null })
  const escena = useRef<EscenaLista | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const [lado, setLado] = useState<'frente' | 'espalda'>('frente')
  const [conZoom, setConZoom] = useState(false)
  const tocar = useRef(onTocar)
  tocar.current = onTocar
  const mio = useCuerpo()
  const lista = useMemo(() => cuerpos ?? (mio ? [mio.datos] : []), [cuerpos, mio])

  const mover = () => escena.current?.invalidar()
  /** Si el cuerpo respira: se ve en pantalla, la app está delante y no se pide reducir el movimiento. */
  const vivo = useRef(false)
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
      const golpes = rayo.intersectObjects(e.mallas(), false)
      const piel = golpes[0]
      if (!piel?.uv) return
      const musculo = musculoDeRegion(regionEn(e.texturas, piel.uv.x, piel.uv.y))
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

  // Respira solo mientras se ve.
  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)')
    let enPantalla = false
    const actualizar = () => {
      const antes = vivo.current
      vivo.current = enPantalla && !document.hidden && !quieto.matches
      if (vivo.current && !antes) mover()
    }
    const observador = new IntersectionObserver(([e]) => {
      enPantalla = e?.isIntersecting ?? false
      actualizar()
    })
    observador.observe(el)
    document.addEventListener('visibilitychange', actualizar)
    quieto.addEventListener('change', actualizar)
    return () => {
      observador.disconnect()
      document.removeEventListener('visibilitychange', actualizar)
      quieto.removeEventListener('change', actualizar)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const girar = (l: 'frente' | 'espalda') => {
    setLado(l)
    girarA(l === 'frente' ? 0 : Math.PI)
  }

  return (
    // Sin alto propio, la figura toma una proporción de 4:5; con un alto (h-96…), lo llena.
    <div className={`relative ${proporcion} w-full ${className}`}>
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
          onCreated={({ gl }) => {
            // Si el sombreador no compila en esta tarjeta gráfica, el cuerpo no se vería: mejor el mapa 2D y el motivo.
            gl.debug.onShaderError = (ctx, programa, vs, fs) => {
              const registro = (ctx.getShaderInfoLog(fs) || ctx.getShaderInfoLog(vs) || ctx.getProgramInfoLog(programa) || '').trim().split('\n')[0]
              const motivo = `sombreador en ${tarjetaGrafica(ctx)}: ${registro || 'sin detalle'}`
              guardarUltimoError(new Error(motivo))
              alFallar(motivo)
            }
          }}
        >
          <Suspense fallback={null}>
            <Escena vista={vista} vivo={vivo} niveles={niveles} seleccionado={seleccionado ?? null} cuerpos={lista} alListo={(e) => (escena.current = e)} alCambiarLado={setLado} />
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

function Escena({
  vista,
  vivo,
  niveles,
  seleccionado,
  cuerpos,
  alListo,
  alCambiarLado,
}: {
  alCambiarLado: (l: 'frente' | 'espalda') => void
  vista: RefObject<Vista>
  vivo: RefObject<boolean>
  niveles: ReadonlyMap<Musculo, number>
  seleccionado: Musculo | null
  cuerpos: readonly DatosCuerpo[]
  alListo: (e: EscenaLista) => void
}) {
  const modelo = use(cargarModeloAvatar())
  const texturas = use(cargarTexturasAvatar(modelo))
  const { gl, scene, camera, invalidate, setSize } = useThree()
  const grupos = useRef(new Map<number, THREE.Group>())
  const mallas = useRef(new Map<number, THREE.Mesh>())
  const { tema } = useAjustes()

  // Color de cada región: el del nivel de su grupo (y al cambiar de tema o de músculo elegido).
  const aspecto = useMemo(() => {
    const { arcilla, acento } = leerColores()
    return { porRegion: porRegion((m) => aspectoDeNivel(m ? (niveles.get(m) ?? 0) : 0, arcilla, acento, m !== null && m === seleccionado)), acento }
    // El tema cambia los colores que lee `leerColores`.
  }, [niveles, seleccionado, tema]) // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    alListo({ camara: camera, mallas: () => [...mallas.current.values()], texturas, invalidar: invalidate })
  }, [camera, texturas, alListo, invalidate])

  const lado = useRef<'frente' | 'espalda'>('frente')
  const proximo = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(proximo.current), [])

  // Inercia, animaciones de giro y zoom. Solo pide otro fotograma mientras algo se mueve.
  useFrame((_, dt) => {
    const v = vista.current
    if (!v) return
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
    // Cada cuerpo gira sobre sí mismo (con dos, giran a la vez).
    for (const g of grupos.current.values()) g.rotation.y = v.angulo
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
    // Los gestos piden el fotograma siguiente; la respiración, uno cada 1/24 s.
    if (sigue) invalidate()
    else if (vivo.current && proximo.current === undefined)
      proximo.current = window.setTimeout(() => {
        proximo.current = undefined
        invalidate()
      }, 1000 / FPS_RESPIRACION)
  })

  const dos = cuerpos.length > 1
  return (
    <>
      <ambientLight intensity={0.05} />
      {/* Luz principal delante y a la izquierda, de relleno a la derecha y de contorno por detrás. */}
      <directionalLight position={[-2.6, 3.2, 2.2]} intensity={1.35} />
      <directionalLight position={[2.6, 0.9, 2]} intensity={0.14} />
      <directionalLight position={[2.4, 2.2, -3]} intensity={1.1} color="#e6edff" />
      <directionalLight position={[-2.6, 1.6, -2.4]} intensity={0.6} color="#fff2e6" />
      {cuerpos.slice(0, 2).map((datos, i) => (
        <CuerpoAvatar
          key={i}
          modelo={modelo}
          texturas={texturas}
          datos={datos}
          x={dos ? (i === 0 ? -SEPARACION : SEPARACION) : 0}
          sombra={dos ? 0.74 : 1.3}
          aspecto={aspecto}
          vivo={vivo}
          alMontar={(grupo, malla) => {
            if (grupo && malla) {
              grupos.current.set(i, grupo)
              mallas.current.set(i, malla)
            } else {
              grupos.current.delete(i)
              mallas.current.delete(i)
            }
            invalidate()
          }}
        />
      ))}
    </>
  )
}

/** Un cuerpo: su malla con la forma de esos datos, su material y su sombra. */
function CuerpoAvatar({
  modelo,
  texturas,
  datos,
  x,
  sombra,
  aspecto,
  vivo,
  alMontar,
}: {
  modelo: ModeloAvatar
  texturas: TexturasAvatar
  datos: DatosCuerpo
  x: number
  sombra: number
  aspecto: { porRegion: readonly { color: RGB; brillo: number }[]; acento: RGB }
  vivo: RefObject<boolean>
  alMontar: (grupo: THREE.Group | null, malla: THREE.Mesh | null) => void
}) {
  const { invalidate } = useThree()
  const grupo = useRef<THREE.Group>(null)
  const geometria = useMemo(() => {
    const g = crearGeometriaAvatar(modelo)
    anadirPiel(g, modelo)
    return g
  }, [modelo])
  const materiales = useMemo(() => crearMaterialesAvatar(texturas), [texturas])
  // La malla con piel y su esqueleto (los mismos 24 huesos que las animaciones). Se crean juntos: el
  // esqueleto cuelga de su malla, y si React repite el cálculo, cada malla tiene el suyo.
  const { malla, esqueleto } = useMemo(() => {
    const e = crearEsqueleto(modelo)
    const m = new THREE.SkinnedMesh(geometria, materiales.material)
    m.add(e.raiz)
    // Los huesos se apartan de la postura de reposo: que three.js no lo recorte.
    m.frustumCulled = false
    return { malla: m, esqueleto: e }
  }, [geometria, materiales, modelo])
  const postura = useRef<Postura | null>(null)
  useEffect(() => () => geometria.dispose(), [geometria])
  useEffect(() => () => materiales.liberar(), [materiales])

  // La forma: solo se recalcula cuando cambian los datos del cuerpo. Con ella, el esqueleto se pone en
  // sus articulaciones (reposo), se ata la piel y se calcula la postura relajada.
  const clave = JSON.stringify(datos)
  const resuelta = useMemo(() => resolverForma(modelo, datos), [modelo, clave]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    aplicarForma(geometria, modelo, resuelta.forma)
    materiales.definir(resuelta.definicion)
    ponerEnReposo(esqueleto, modelo, resuelta.forma.articulaciones)
    malla.bind(esqueleto.esqueleto)
    postura.current = posturaRelajada(modelo, resuelta.forma.articulaciones)
    respirar(esqueleto, postura.current, performance.now() / 1000)
    // Para tocar los músculos: la esfera que lo envuelve se recalcula con la postura.
    esqueleto.raiz.updateMatrixWorld(true)
    esqueleto.esqueleto.update()
    malla.computeBoundingSphere()
    invalidate()
  }, [geometria, materiales, esqueleto, malla, modelo, resuelta, invalidate])

  useFrame(() => {
    if (vivo.current && postura.current) respirar(esqueleto, postura.current, performance.now() / 1000)
  })

  useLayoutEffect(() => {
    materiales.pintar(aspecto.porRegion, aspecto.acento)
    invalidate()
  }, [materiales, aspecto, invalidate])

  const montar = useRef(alMontar)
  montar.current = alMontar
  useEffect(() => {
    montar.current(grupo.current, malla)
    return () => montar.current(null, null)
  }, [malla])

  return (
    <group position={[x, 0, 0]}>
      <group ref={grupo}>
        <group scale={ALTO / resuelta.forma.alto}>
          <primitive object={malla} />
        </group>
        <ContactShadows key={clave} position={[0, 0.001, 0]} scale={sombra} far={0.6} blur={2.4} opacity={0.75} resolution={512} frames={1} />
      </group>
    </group>
  )
}
