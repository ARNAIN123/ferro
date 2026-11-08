import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { asignarAnimacion } from '../../animacion/asignacion'
import { esPiloto } from '../../animacion3d/biblioteca'
import { CUADROS_MINIATURA as CUADROS } from '../../animacion3d/ejercicios'
import { AnimacionEjercicio } from '../../components/animacion/AnimacionEjercicio'
import { Animacion3D } from '../../components/animacion3d/Animacion3D'
import { MiniaturaAnimada } from '../../components/animacion3d/MiniaturaAnimada'
import { Cabecera } from '../../components/Cabecera'
import { Tarjeta } from '../../components/ui'
import { db } from '../../db/db'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import type { Ejercicio } from '../../domain/tipos'
import { useAjustes } from '../../hooks/useAjustes'

const musculosDe = (e: Ejercicio) => ({ principales: e.musculosPrincipales, secundarios: e.musculosSecundarios })

// Animaciones 3D de toda la biblioteca, agrupadas por patrón de movimiento, para revisarlas.
export function GaleriaAnimaciones3D() {
  const ejercicios = useLiveQuery(() => db.ejercicios.filter((e) => !e.archivado).toArray(), [])
  const [elegido, setElegido] = useState<string>('Barbell_Bench_Press_-_Medium_Grip')
  const [params] = useSearchParams()
  const grupos = useMemo(() => {
    const g = new Map<string, Ejercicio[]>()
    for (const e of ejercicios ?? []) {
      const patron = esPiloto(e.id) ? 'piloto (hechas a mano)' : asignarAnimacion(e).animacion.patron
      g.set(patron, [...(g.get(patron) ?? []), e])
    }
    return [...g].sort((a, b) => (a[0].startsWith('piloto') ? -1 : b[0].startsWith('piloto') ? 1 : b[1].length - a[1].length))
  }, [ejercicios])

  if (!ejercicios) return null
  if (params.get('revision') === 'patrones') return <Revision grupos={grupos} solo={params.get('solo')} cuantos={params.has('uno') ? 1 : 4} />
  const e = ejercicios.find((x) => x.id === elegido) ?? ejercicios[0]
  if (!e) return null

  return (
    <>
      <Cabecera titulo="Animaciones 3D" subtitulo={`${ejercicios.length} ejercicios, por patrón de movimiento`} atras="/ajustes" />
      <Tarjeta className="mt-2">
        <h2 className="font-bold">{e.nombre}</h2>
        <p className="text-sm text-muted">Sube en 1 s y baja en unos 2 s. Arrastra para girarla.</p>
        <Animacion3D key={e.id} ejercicio={e} musculos={musculosDe(e)} className="mt-3" sinWebgl={<AnimacionEjercicio ejercicio={e} className="aspect-square w-full" />} />
        <p className="mt-2 text-sm">
          <span className="font-semibold text-accent">{e.musculosPrincipales.map((x) => NOMBRE_MUSCULO[x]).join(', ')}</span>
          {e.musculosSecundarios.length > 0 && <span className="text-muted"> · {e.musculosSecundarios.map((x) => NOMBRE_MUSCULO[x]).join(', ')}</span>}
        </p>
      </Tarjeta>
      {grupos.map(([patron, lista]) => (
        <section key={patron} className="mt-4">
          <h3 className="mb-1.5 px-1 text-sm font-semibold tracking-wide text-muted uppercase">
            {patron} <span className="font-normal normal-case">({lista.length})</span>
          </h3>
          <ul className="grid grid-cols-3 gap-2">
            {lista.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => {
                    setElegido(x.id)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  aria-pressed={elegido === x.id}
                  className={`flex w-full flex-col items-center gap-1 rounded-2xl border p-1.5 text-center text-xs font-semibold ${elegido === x.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                >
                  <MiniaturaAnimada ejercicio={x} musculos={musculosDe(x)} className="aspect-square w-full" />
                  <span className="line-clamp-2 min-h-8">{x.nombre}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

/**
 * Revisión (?revision=patrones): un ejercicio de cada patrón, con el principio, la mitad y el final.
 * Con &solo=a,b solo esos patrones (hasta 4 ejercicios de cada uno, o 1 con &uno), más grandes.
 */
function Revision({ grupos, solo, cuantos }: { grupos: [string, Ejercicio[]][]; solo: string | null; cuantos: number }) {
  const filtros = solo ? solo.split(',').map((x) => x.trim().toLowerCase()) : null
  return (
    <div className={`grid gap-x-2 gap-y-3 py-3 ${filtros ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {grupos.flatMap(([patron, lista]) =>
        (patron.startsWith('piloto') ? [] : filtros ? (filtros.some((f) => patron.toLowerCase().includes(f)) ? lista.slice(0, cuantos) : []) : lista.slice(0, 1)).map((e) => (
          <section key={e.id}>
            <h2 className="truncate text-[10px] font-bold">
              {patron} · {e.nombre}
            </h2>
            <Fotogramas e={e} />
          </section>
        )),
      )}
    </div>
  )
}

function Fotogramas({ e }: { e: Ejercicio }) {
  const [tira, setTira] = useState<string | null>(null)
  const { tema } = useAjustes()
  useEffect(() => {
    void import('../../animacion3d/miniaturas').then((m) => m.miniatura(e, musculosDe(e), tema)).then(setTira)
  }, [e, tema])
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {[0, 5, 10].map((i) => (
        <div
          key={i}
          className="aspect-square rounded bg-surface-2"
          style={tira ? { backgroundImage: `url(${tira})`, backgroundSize: `${CUADROS * 100}% 100%`, backgroundPosition: `${(i / (CUADROS - 1)) * 100}% 0` } : undefined}
        />
      ))}
    </div>
  )
}
