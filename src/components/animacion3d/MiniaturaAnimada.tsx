import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { EjercicioAnimable } from '../../animacion/asignacion'
import { definicion3D } from '../../animacion3d/biblioteca'
import { CUADROS_MINIATURA as CUADROS, duracionRep } from '../../animacion3d/ejercicios'
import type { MusculosEjercicio } from '../../animacion3d/escena'
import { useAjustes } from '../../hooks/useAjustes'
import { useMovimientoReducido } from '../../hooks/useMovimientoReducido'

/**
 * Miniatura animada de un ejercicio 3D para las listas (una tira de fotogramas animada con CSS).
 * Mientras se genera (o si el móvil no puede), se ve `respaldo`.
 */
export function MiniaturaAnimada({ ejercicio, musculos, className = 'size-14', respaldo }: { ejercicio: EjercicioAnimable; musculos: MusculosEjercicio; className?: string; respaldo?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [tira, setTira] = useState<string | null>(null)
  const { tema } = useAjustes()
  const reducido = useMovimientoReducido()

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return setVisible(true)
    const o = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { rootMargin: '200px' })
    o.observe(el)
    return () => o.disconnect()
  }, [])

  const clave = `${ejercicio.id}|${musculos.principales.join(',')}|${musculos.secundarios.join(',')}`
  useEffect(() => {
    if (!visible) return
    let vivo = true
    // El generador (three.js sin pantalla) solo se descarga cuando hace falta una miniatura.
    import('../../animacion3d/miniaturas')
      .then((m) => m.miniatura(ejercicio, musculos, tema))
      .then((url) => vivo && setTira(url))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, clave, tema])

  return (
    <span ref={ref} className={`${className} relative block shrink-0 overflow-hidden rounded-xl bg-surface-2`} aria-hidden="true">
      {tira ? (
        <span
          className="block size-full"
          style={{
            backgroundImage: `url(${tira})`,
            backgroundSize: `${CUADROS * 100}% 100%`,
            backgroundRepeat: 'no-repeat',
            animation: reducido ? undefined : `tira-3d ${duracionRep(definicion3D(ejercicio))}s steps(${CUADROS}, jump-none) infinite`,
          }}
        />
      ) : (
        respaldo
      )}
    </span>
  )
}
