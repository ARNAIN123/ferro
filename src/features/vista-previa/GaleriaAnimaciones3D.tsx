import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Animacion3D } from '../../components/animacion3d/Animacion3D'
import { MiniaturaAnimada } from '../../components/animacion3d/MiniaturaAnimada'
import { Cabecera } from '../../components/Cabecera'
import { Tarjeta } from '../../components/ui'
import { CUADROS_MINIATURA as CUADROS, duracionRep, EJERCICIOS_3D } from '../../animacion3d/ejercicios'
import { miniatura } from '../../animacion3d/miniaturas'
import { useAjustes } from '../../hooks/useAjustes'
import { db } from '../../db/db'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import type { Musculo } from '../../domain/tipos'
import { fmtKg } from '../../lib/formato'

// Piloto de la ronda 3, fase 4: las 10 animaciones 3D para revisarlas antes de hacer el resto.
export function GaleriaAnimaciones3D() {
  const [elegido, setElegido] = useState(EJERCICIOS_3D[0]!.id)
  const ejercicios = useLiveQuery(() => db.ejercicios.bulkGet(EJERCICIOS_3D.map((d) => d.id)), [])
  const musculos = useMemo(() => {
    const m = new Map<string, { principales: Musculo[]; secundarios: Musculo[] }>()
    for (const e of ejercicios ?? []) if (e) m.set(e.id, { principales: e.musculosPrincipales, secundarios: e.musculosSecundarios })
    return m
  }, [ejercicios])
  const def = EJERCICIOS_3D.find((d) => d.id === elegido)!
  const m = musculos.get(elegido)
  const [params] = useSearchParams()
  if (params.get('revision')) return <Revision musculos={musculos} solo={params.get('revision') === '1' ? null : params.get('revision')} />

  return (
    <>
      <Cabecera titulo="Animaciones 3D" subtitulo="Piloto de 10 ejercicios para revisar" atras="/ajustes" />
      <Tarjeta className="mt-2">
        <h2 className="font-bold">{def.nombre}</h2>
        <p className="text-sm text-muted">
          Repetición de {fmtKg(Math.round(duracionRep(def) * 10) / 10)} s: sube en 1 s y baja en unos 2 s. Arrastra para girarla.
        </p>
        {m && <Animacion3D ejercicioId={def.id} musculos={m} className="mt-3" />}
        {m && (
          <p className="mt-2 text-sm">
            <span className="font-semibold text-accent">{m.principales.map((x) => NOMBRE_MUSCULO[x]).join(', ')}</span>
            {m.secundarios.length > 0 && <span className="text-muted"> · {m.secundarios.map((x) => NOMBRE_MUSCULO[x]).join(', ')}</span>}
          </p>
        )}
      </Tarjeta>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {EJERCICIOS_3D.map((d) => {
          const mm = musculos.get(d.id)
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => {
                  setElegido(d.id)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                aria-pressed={elegido === d.id}
                className={`flex w-full flex-col items-center gap-1 rounded-2xl border p-2 text-center text-sm font-semibold ${elegido === d.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
              >
                {mm ? <MiniaturaAnimada ejercicioId={d.id} musculos={mm} className="size-28" /> : <span className="size-28" />}
                <span className="line-clamp-2 min-h-10">{d.nombre}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** Revisión (?revision=1): 6 fotogramas de la repetición de cada ejercicio, para comprobar las poses. */
function Revision({ musculos, solo }: { musculos: Map<string, { principales: Musculo[]; secundarios: Musculo[] }>; solo: string | null }) {
  return (
    <div className="space-y-3 py-3">
      {EJERCICIOS_3D.filter((d) => !solo || d.id === solo).map((d) => {
        const m = musculos.get(d.id)
        return (
          <section key={d.id}>
            <h2 className="text-sm font-bold">{d.nombre}</h2>
            {m && <Fotogramas id={d.id} musculos={m} grande={!!solo} />}
          </section>
        )
      })}
    </div>
  )
}

function Fotogramas({ id, musculos, grande }: { id: string; musculos: { principales: Musculo[]; secundarios: Musculo[] }; grande: boolean }) {
  const [tira, setTira] = useState<string | null>(null)
  const { tema } = useAjustes()
  useEffect(() => {
    void miniatura(id, musculos, tema).then(setTira)
  }, [id, musculos, tema])
  return (
    <div className={`grid gap-0.5 ${grande ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {[0, 3, 5, 8, 11, 13].map((i) => (
        <div
          key={i}
          className="aspect-square rounded bg-surface-2"
          style={tira ? { backgroundImage: `url(${tira})`, backgroundSize: `${CUADROS * 100}% 100%`, backgroundPosition: `${(i / (CUADROS - 1)) * 100}% 0` } : undefined}
        />
      ))}
    </div>
  )
}
