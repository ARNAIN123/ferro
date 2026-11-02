import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { claseInput } from '../../components/ui'
import { db } from '../../db/db'
import { NOMBRE_MATERIAL, NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { coincide } from '../../domain/texto'
import type { Ejercicio, Musculo } from '../../domain/tipos'

interface Props {
  abierta: boolean
  onCerrar: () => void
  titulo: string
  onElegir: (ejercicio: Ejercicio) => void
  /** Limita a alternativas de un músculo (para cambiar un ejercicio ocupado). */
  musculo?: Musculo
  excluir?: string[]
}

export function SelectorEjercicio({ abierta, onCerrar, titulo, onElegir, musculo, excluir = [] }: Props) {
  const ejercicios = useLiveQuery(() => db.ejercicios.toArray(), [])
  const [busqueda, setBusqueda] = useState('')

  const lista = useMemo(() => {
    const fuera = new Set(excluir)
    return (ejercicios ?? [])
      .filter((e) => !e.archivado && !fuera.has(e.id))
      .filter((e) => !musculo || e.musculoPrincipal === musculo)
      .filter((e) => !busqueda || coincide(`${e.nombre} ${NOMBRE_MUSCULO[e.musculoPrincipal]}`, busqueda))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [ejercicios, busqueda, musculo, excluir])

  return (
    <Hoja
      abierta={abierta}
      onCerrar={() => {
        setBusqueda('')
        onCerrar()
      }}
      titulo={titulo}
    >
      <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
        <div className="relative">
          <Icono nombre="buscar" tamano={20} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
          <input
            type="search"
            className={`${claseInput} pl-11`}
            placeholder={musculo ? `Alternativas de ${NOMBRE_MUSCULO[musculo].toLowerCase()}` : 'Buscar ejercicio o músculo'}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar ejercicio"
          />
        </div>
      </div>
      <ul className="divide-y divide-line">
        {lista.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => {
                setBusqueda('')
                onElegir(e)
              }}
              className="flex min-h-14 w-full items-center gap-3 py-2 text-left active:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{e.nombre}</span>
                <span className="block truncate text-sm text-muted">
                  {NOMBRE_MUSCULO[e.musculoPrincipal]} · {NOMBRE_MATERIAL[e.material]}
                </span>
              </span>
              <Icono nombre="mas" tamano={20} className="text-accent" />
            </button>
          </li>
        ))}
        {ejercicios && lista.length === 0 && <li className="py-8 text-center text-muted">No hay ejercicios que coincidan.</li>}
      </ul>
    </Hoja>
  )
}
