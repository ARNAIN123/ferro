import { ContactShadows } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, use, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import type { EjercicioAnimable } from '../../animacion/asignacion'
import { definicion3D } from '../../animacion3d/biblioteca'
import type { Definicion3D } from '../../animacion3d/ejercicios'
import { EscenaEjercicio, type MusculosEjercicio } from '../../animacion3d/escena'
import { crearCuerpoEjercicio, huellaCuerpo, type CuerpoEscena } from '../../avatar3d/cuerpoEjercicio'
import { cargarModeloAvatar } from '../../avatar3d/modelo'
import { cargarTexturasAvatar } from '../../avatar3d/texturas'
import type { DatosCuerpo } from '../../domain/cuerpo'
import { FRENADO_GIRO, GIRO_POR_PIXEL } from '../../domain/cuerpo3d'
import { useAjustes } from '../../hooks/useAjustes'
import { useDatosCuerpo } from '../../hooks/useDatosCuerpo'
import { leerColores, LucesEstudio, useEntornoEstudio } from '../cuerpo3d/comun'

interface Props {
  ejercicio: EjercicioAnimable
  musculos: MusculosEjercicio
  className?: string
  /** Lo que se ve si el móvil no tiene WebGL (la animación 2D). */
  sinWebgl?: ReactNode
}

type Vista = 'tres_cuartos' | 'lado' | 'frente'

/**
 * Animación 3D de un ejercicio hecha por el avatar de cada usuario (su forma y sus proporciones): 3
 * repeticiones con su tempo y una pausa, en bucle. Se gira arrastrando (con inercia) y tiene vistas
 * de ¾, lado y frente. Solo se anima mientras se ve en pantalla.
 */
export function Animacion3D({ ejercicio, musculos, className = '', sinWebgl }: Props) {
  const datos = useDatosCuerpo()
  // Con los bancos y cajones ajustados a este cuerpo.
  const huella = datos ? huellaCuerpo(datos) : 'referencia'
  const def = useMemo(() => definicion3D(ejercicio, huella), [ejercicio, huella])
  const contenedor = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [vista, setVista] = useState<Vista>('tres_cuartos')
  const giro = useRef({
    angulo: 0,
    velocidad: 0,
    objetivo: null as number | null,
  })

  useEffect(() => {
    const el = contenedor.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const o = new IntersectionObserver(([e]) => setVisible(e?.isIntersecting ?? false), { rootMargin: '60px' })
    o.observe(el)
    return () => o.disconnect()
  }, [])

  // Igual que en el cuerpo 3D: se le avisa del tamaño al aparecer (algunos WebView tardan en medirlo).
  useEffect(() => {
    const avisos = [0, 120, 500, 1500].map((ms) => window.setTimeout(() => window.dispatchEvent(new Event('resize')), ms))
    return () => avisos.forEach((t) => window.clearTimeout(t))
  }, [])

  // Arrastrar en horizontal gira la cámara alrededor del ejercicio.
  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    let previo: { x: number; t: number } | null = null
    const abajo = (e: PointerEvent) => {
      previo = { x: e.clientX, t: performance.now() }
      giro.current.velocidad = 0
      giro.current.objetivo = null
      el.setPointerCapture(e.pointerId)
    }
    const mueve = (e: PointerEvent) => {
      if (!previo) return
      const ahora = performance.now()
      const d = (e.clientX - previo.x) * GIRO_POR_PIXEL
      giro.current.angulo -= d
      giro.current.velocidad = -d / Math.max(1, ahora - previo.t)
      previo = { x: e.clientX, t: ahora }
    }
    const arriba = () => {
      if (previo && performance.now() - previo.t > 80) giro.current.velocidad = 0
      previo = null
    }
    el.addEventListener('pointerdown', abajo)
    el.addEventListener('pointermove', mueve)
    el.addEventListener('pointerup', arriba)
    el.addEventListener('pointercancel', arriba)
    return () => {
      el.removeEventListener('pointerdown', abajo)
      el.removeEventListener('pointermove', mueve)
      el.removeEventListener('pointerup', arriba)
      el.removeEventListener('pointercancel', arriba)
    }
  }, [])

  const irA = (v: Vista) => {
    setVista(v)
    const base = (def.camara.azimut * Math.PI) / 180
    const objetivo = v === 'tres_cuartos' ? 0 : v === 'lado' ? Math.PI / 2 - base : -base
    const g = giro.current
    g.velocidad = 0
    g.objetivo = objetivo + Math.round((g.angulo - objetivo) / (2 * Math.PI)) * 2 * Math.PI
  }

  return (
    <div className={`relative aspect-square w-full ${className}`}>
      <div ref={contenedor} className="absolute inset-0 select-none" style={{ touchAction: 'pan-y' }} role="img" aria-label={`Animación 3D: ${def.nombre}. Arrastra para girarla.`}>
        <Canvas
          frameloop={visible ? 'always' : 'never'}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.NeutralToneMapping,
          }}
          camera={{ fov: 30, near: 0.1, far: 30, position: [0, 1.2, 3] }}
          fallback={sinWebgl}
        >
          <Suspense fallback={null}>{datos && <Escena def={def} musculos={musculos} giro={giro} datos={datos} />}</Suspense>
        </Canvas>
      </div>
      <div className="absolute right-0 bottom-0 flex gap-1 rounded-full bg-surface-2/80 p-1 text-xs font-semibold backdrop-blur">
        {(
          [
            ['tres_cuartos', '¾'],
            ['lado', 'Lado'],
            ['frente', 'Frente'],
          ] as const
        ).map(([v, texto]) => (
          <button key={v} type="button" onClick={() => irA(v)} aria-pressed={vista === v} className={`min-h-9 min-w-11 rounded-full px-3 ${vista === v ? 'bg-accent text-accent-ink' : 'text-muted'}`}>
            {texto}
          </button>
        ))}
      </div>
    </div>
  )
}

function Escena({
  def,
  musculos,
  giro,
  datos,
}: {
  def: Definicion3D
  musculos: MusculosEjercicio
  giro: RefObject<{
    angulo: number
    velocidad: number
    objetivo: number | null
  }>
  datos: DatosCuerpo
}) {
  const modelo = use(cargarModeloAvatar())
  const texturas = use(cargarTexturasAvatar(modelo))
  const { camera } = useThree()
  const { tema } = useAjustes()
  useEntornoEstudio()
  // El avatar de estos datos: solo se rehace si cambian (peso, medidas, perfil…). Se crea y se libera
  // en el mismo efecto (así, aunque React lo repita, cada cuerpo se libera una vez y no se usa después).
  const claveCuerpo = JSON.stringify(datos)
  const [cuerpo, setCuerpo] = useState<CuerpoEscena | null>(null)
  useEffect(() => {
    const c = crearCuerpoEjercicio(modelo, texturas, datos)
    setCuerpo(c)
    return () => c.liberar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelo, texturas, claveCuerpo])
  const claveMusculos = `${musculos.principales.join(',')}|${musculos.secundarios.join(',')}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const escena = useMemo(() => cuerpo && new EscenaEjercicio(cuerpo, def, musculos, leerColores()), [cuerpo, def, claveMusculos])
  // El cuerpo entra en la escena que se ve (un mismo cuerpo puede estar en una sola).
  useLayoutEffect(() => {
    escena?.ponerCuerpo()
    return () => escena?.retirarCuerpo()
  }, [escena])
  const tiempo = useRef(0)

  useEffect(() => {
    const f = requestAnimationFrame(() => escena?.cambiarColores(leerColores()))
    return () => cancelAnimationFrame(f)
  }, [escena, tema])

  useFrame((_, dt) => {
    if (!escena) return
    tiempo.current += Math.min(dt, 0.1)
    escena.actualizar(tiempo.current)
    // Cámara: gira alrededor del ejercicio (con inercia), desde su ángulo de ¾.
    const g = giro.current
    if (g) {
      const ms = Math.min(dt, 0.05) * 1000
      if (g.objetivo !== null) {
        const d = g.objetivo - g.angulo
        g.angulo += d * Math.min(1, ms / 120)
        if (Math.abs(d) < 0.002) g.objetivo = null
      } else if (Math.abs(g.velocidad) > 0.00002) {
        g.angulo += g.velocidad * ms
        g.velocidad *= Math.exp(-ms / FRENADO_GIRO)
      }
    }
    const az = (def.camara.azimut * Math.PI) / 180 + (g?.angulo ?? 0)
    const [ox, oy, oz] = def.camara.objetivo
    camera.position.set(ox + Math.sin(az) * def.camara.distancia, def.camara.altura, oz + Math.cos(az) * def.camara.distancia)
    camera.lookAt(ox, oy, oz)
  })

  return (
    <>
      <LucesEstudio />
      {escena && <primitive object={escena.raiz} />}
      <ContactShadows position={[0, 0.001, 0]} scale={3.2} far={1.4} blur={2.2} opacity={0.6} resolution={256} frames={Infinity} />
    </>
  )
}
