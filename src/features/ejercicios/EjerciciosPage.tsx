import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'
import { claseInput, Vacio } from '../../components/ui'
import { db } from '../../db/db'
import { NOMBRE_MATERIAL, NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { coincide } from '../../domain/texto'
import { MUSCULOS, type Musculo } from '../../domain/tipos'
import { PestanasRutinas } from '../rutinas/PestanasRutinas'

export function EjerciciosPage() {
  const ejercicios = useLiveQuery(() => db.ejercicios.toArray(), [])
  const [busqueda, setBusqueda] = useState('')
  const [musculo, setMusculo] = useState<Musculo | null>(null)
  const [verArchivados, setVerArchivados] = useState(false)

  const filtrados = useMemo(
    () =>
      (ejercicios ?? [])
        .filter((e) => e.archivado === verArchivados)
        .filter((e) => !musculo || e.musculoPrincipal === musculo)
        .filter((e) => !busqueda || coincide(e.nombre, busqueda))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [ejercicios, busqueda, musculo, verArchivados],
  )

  return (
    <>
      <Cabecera
        titulo="Rutinas"
        accion={
          <Link
            to="/rutinas/ejercicios/nuevo"
            aria-label="Nuevo ejercicio"
            className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink"
          >
            <Icono nombre="mas" />
          </Link>
        }
      />
      <PestanasRutinas />

      <div className="relative">
        <Icono nombre="buscar" tamano={20} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
        <input
          type="search"
          className={`${claseInput} pl-11`}
          placeholder="Buscar ejercicio"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar ejercicio"
        />
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip activo={musculo === null} onClick={() => setMusculo(null)}>
          Todos
        </Chip>
        {MUSCULOS.map((m) => (
          <Chip key={m} activo={musculo === m} onClick={() => setMusculo(musculo === m ? null : m)}>
            {NOMBRE_MUSCULO[m]}
          </Chip>
        ))}
      </div>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
        {filtrados.map((e) => (
          <li key={e.id}>
            <Link to={`/rutinas/ejercicios/${e.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{e.nombre}</span>
                <span className="block truncate text-sm text-muted">
                  {NOMBRE_MUSCULO[e.musculoPrincipal]} · {NOMBRE_MATERIAL[e.material]}
                  {e.personalizado && ' · Propio'}
                </span>
              </span>
              {e.notasFijas && <Icono nombre="nota" tamano={18} className="shrink-0 text-muted" />}
              <Icono nombre="adelante" tamano={18} className="shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      {ejercicios && filtrados.length === 0 && (
        <div className="mt-4">
          <Vacio titulo="Nada por aquí">Prueba con otra búsqueda o crea tu propio ejercicio.</Vacio>
        </div>
      )}

      <button
        type="button"
        onClick={() => setVerArchivados(!verArchivados)}
        className="mx-auto mt-4 flex min-h-12 items-center gap-2 px-4 text-sm font-medium text-muted"
      >
        <Icono nombre="archivar" tamano={18} />
        {verArchivados ? 'Ver ejercicios activos' : 'Ver archivados'}
      </button>
    </>
  )
}

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium transition ${
        activo ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'
      }`}
    >
      {children}
    </button>
  )
}
