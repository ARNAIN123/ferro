import { useEffect, useRef, useState } from 'react'
import { CUADROS_MINIATURA as CUADROS, definicion3D, duracionRep } from '../../animacion3d/ejercicios'
import type { MusculosEjercicio } from '../../animacion3d/escena'
import { useAjustes } from '../../hooks/useAjustes'
import { useMovimientoReducido } from '../../hooks/useMovimientoReducido'

/** Miniatura animada de un ejercicio 3D para las listas (una tira de fotogramas animada con CSS). */
export function MiniaturaAnimada({ ejercicioId, musculos, className = 'size-14' }: { ejercicioId: string; musculos: MusculosEjercicio; className?: string }) {
  const def = definicion3D(ejercicioId)
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

  const clave = `${musculos.principales.join(',')}|${musculos.secundarios.join(',')}`
  useEffect(() => {
    if (!visible || !def) return
    let vivo = true
    // El generador (three.js sin pantalla) solo se descarga cuando hace falta una miniatura.
    import('../../animacion3d/miniaturas')
      .then((m) => m.miniatura(ejercicioId, musculos, tema))
      .then((url) => vivo && setTira(url))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ejercicioId, clave, tema])

  return (
    <span ref={ref} className={`${className} block shrink-0 overflow-hidden rounded-xl bg-surface-2`} aria-hidden="true">
      {tira && def && (
        <span
          className="block size-full"
          style={{
            backgroundImage: `url(${tira})`,
            backgroundSize: `${CUADROS * 100}% 100%`,
            backgroundRepeat: 'no-repeat',
            animation: reducido ? undefined : `tira-3d ${duracionRep(def)}s steps(${CUADROS}, jump-none) infinite`,
          }}
        />
      )}
    </span>
  )
}
