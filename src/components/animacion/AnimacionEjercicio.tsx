import type { Musculo } from '../../domain/tipos'
import { useMovimientoReducido } from '../../hooks/useMovimientoReducido'
import { MiniaturaAnimada } from '../animacion3d/MiniaturaAnimada'
import { useEffect, useMemo, useRef, useState } from 'react'
import { asignarAnimacion, type EjercicioAnimable } from '../../animacion/asignacion'
import { DURACION_S, generarEscena, type Escena, type FormaAnimada } from '../../animacion/fotogramas'

// Las escenas se calculan una vez por ejercicio (la animación tarda unos milisegundos).
const cache = new Map<string, Escena>()
function escenaDe(e: EjercicioAnimable, soloFijo: boolean): Escena {
  const clave = `${e.id}|${e.material}|${e.musculosPrincipales.join(',')}|${soloFijo ? 'f' : 'a'}`
  let escena = cache.get(clave)
  if (!escena) {
    escena = generarEscena(asignarAnimacion(e).animacion, e.musculosPrincipales, soloFijo)
    cache.set(clave, escena)
  }
  return escena
}



function Forma({ f, cuadro }: { f: FormaAnimada; cuadro: number | null }) {
  const clase = `an-${f.clase}`
  if (f.tipo === 'path') {
    const fija = f.d.length === 1 || cuadro !== null
    const d = f.d[Math.min(cuadro ?? 0, f.d.length - 1)]
    if (fija || f.d.every((x) => x === f.d[0])) return <path className={clase} d={d} />
    return (
      <path className={clase} d={d}>
        <animate attributeName="d" values={f.d.join(';')} dur={`${DURACION_S}s`} repeatCount="indefinite" />
      </path>
    )
  }
  const i = Math.min(cuadro ?? 0, f.cx.length - 1)
  const quieto = cuadro !== null || f.cx.length === 1 || (f.cx.every((x) => x === f.cx[0]) && f.cy.every((y) => y === f.cy[0]))
  if (quieto) return <circle className={clase} cx={f.cx[i]} cy={f.cy[i]} r={f.r} />
  return (
    <circle className={clase} cx={f.cx[0]} cy={f.cy[0]} r={f.r}>
      <animate attributeName="cx" values={f.cx.map((x) => x.toFixed(1)).join(';')} dur={`${DURACION_S}s`} repeatCount="indefinite" />
      <animate attributeName="cy" values={f.cy.map((y) => y.toFixed(1)).join(';')} dur={`${DURACION_S}s`} repeatCount="indefinite" />
    </circle>
  )
}

interface Props {
  ejercicio: EjercicioAnimable
  className?: string
  /** false: solo la pose representativa (miniaturas). */
  animar?: boolean
}

/** Ilustración animada del ejercicio: figura vectorial con el material y los músculos principales en color. */
export function AnimacionEjercicio({ ejercicio, className = '', animar = true }: Props) {
  const reducido = useMovimientoReducido()
  const fija = !animar || reducido
  const escena = useMemo(
    () => escenaDe(ejercicio, fija),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ejercicio.id, ejercicio.material, ejercicio.musculosPrincipales.join(','), fija],
  )
  return (
    <svg viewBox={escena.viewBox.join(' ')} className={className} role="img" aria-label={`Animación: ${ejercicio.nombre}`}>
      <g transform={escena.girar ? 'rotate(-90 100 100)' : undefined}>
        {escena.formas.map((f) => (
          <Forma key={f.k} f={f} cuadro={fija ? escena.fotogramaFijo : null} />
        ))}
      </g>
    </svg>
  )
}

/** Miniatura para las listas: la pose representativa, sin animar. */
export function MiniaturaEjercicio({ ejercicio, className = 'size-14' }: { ejercicio: EjercicioAnimable & { musculosSecundarios?: Musculo[] }; className?: string }) {
  // La miniatura 3D animada; mientras se genera (o sin WebGL), la 2D.
  return (
    <MiniaturaAnimada
      ejercicio={ejercicio}
      musculos={{ principales: ejercicio.musculosPrincipales, secundarios: ejercicio.musculosSecundarios ?? [] }}
      className={className}
      respaldo={<Miniatura2D ejercicio={ejercicio} />}
    />
  )
}

function Miniatura2D({ ejercicio }: { ejercicio: EjercicioAnimable }) {
  const className = 'size-full'
  return (
    <span className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2`} aria-hidden="true">
      <AnimacionEjercicio ejercicio={ejercicio} animar={false} className="size-full" />
    </span>
  )
}

/** Solo anima mientras se ve en pantalla (para la galería con cientos de animaciones). */
export function AnimacionVisible(props: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const o = new IntersectionObserver(([e]) => setVisible(e?.isIntersecting ?? false), { rootMargin: '120px' })
    o.observe(el)
    return () => o.disconnect()
  }, [])
  return (
    <div ref={ref} className={props.className}>
      {visible ? <AnimacionEjercicio {...props} className="size-full" /> : <AnimacionEjercicio {...props} animar={false} className="size-full" />}
    </div>
  )
}
