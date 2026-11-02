import { useEffect, useState } from 'react'
import { nivelesDeEjercicio } from '../domain/mapaMuscular'
import type { Ejercicio } from '../domain/tipos'
import { MapaMuscular } from './mapa/MapaMuscular'

export const urlImagen = (id: string, n: number) => `/img/ejercicios/${encodeURIComponent(id)}/${n}.webp`

type Datos = Pick<Ejercicio, 'id' | 'nombre' | 'imagenes' | 'musculosPrincipales' | 'musculosSecundarios'>

/** Miniatura para listas: la imagen inicial o, si no hay, el mapa muscular del ejercicio. */
export function MiniaturaEjercicio({ ejercicio, className = 'size-14' }: { ejercicio: Datos; className?: string }) {
  const [fallo, setFallo] = useState(false)
  if (ejercicio.imagenes === 0 || fallo)
    return (
      <span className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 p-1`} aria-hidden="true">
        <MapaMuscular niveles={nivelesDeEjercicio(ejercicio)} soloFrente className="h-full" />
      </span>
    )
  return (
    <img
      src={urlImagen(ejercicio.id, 0)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFallo(true)}
      className={`${className} shrink-0 rounded-xl bg-surface-2 object-cover`}
    />
  )
}

/** Imagen grande de la ficha: alterna posición inicial y final. Sin imagen, muestra el mapa muscular. */
export function ImagenGrande({ ejercicio }: { ejercicio: Datos }) {
  const [actual, setActual] = useState(0)
  const [fallo, setFallo] = useState(false)
  const [pausa, setPausa] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const total = fallo ? 0 : ejercicio.imagenes

  useEffect(() => {
    if (total < 2 || pausa) return
    const t = setInterval(() => setActual((a) => (a + 1) % total), 1400)
    return () => clearInterval(t)
  }, [total, pausa])

  if (total === 0)
    return (
      <div className="rounded-3xl border border-line bg-surface p-3">
        <MapaMuscular niveles={nivelesDeEjercicio(ejercicio)} className="h-72" />
        <p className="mt-1 text-center text-xs text-muted">Sin imagen de referencia: músculos que trabaja</p>
      </div>
    )

  return (
    <figure className="relative overflow-hidden rounded-3xl bg-surface-2">
      <button
        type="button"
        onClick={() => {
          setPausa(true)
          setActual((a) => (a + 1) % total)
        }}
        aria-label={total > 1 ? 'Cambiar entre posición inicial y final' : ejercicio.nombre}
        className="relative block aspect-[3/2] w-full"
      >
        {Array.from({ length: total }, (_, n) => (
          <img
            key={n}
            src={urlImagen(ejercicio.id, n)}
            alt={`${ejercicio.nombre}: posición ${n === 0 ? 'inicial' : 'final'}`}
            onError={() => setFallo(true)}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${n === actual ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
      </button>
      {total > 1 && (
        <figcaption className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
          {actual === 0 ? 'Inicio' : 'Final'}
        </figcaption>
      )}
    </figure>
  )
}
