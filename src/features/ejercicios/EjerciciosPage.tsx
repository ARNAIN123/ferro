import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'
import { MiniaturaEjercicio } from '../../components/ImagenEjercicio'
import { Vacio } from '../../components/ui'
import { db } from '../../db/db'
import { filtrarEjercicios, FILTROS_INICIALES, type Filtros } from '../../domain/biblioteca'
import { NOMBRE_MATERIAL, NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { useIncremental } from '../../hooks/useIncremental'
import { PestanasRutinas } from '../rutinas/PestanasRutinas'
import { FiltrosBiblioteca } from './FiltrosBiblioteca'

export function EjerciciosPage() {
  const ejercicios = useLiveQuery(() => db.ejercicios.toArray(), [])
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const lista = useMemo(() => filtrarEjercicios(ejercicios ?? [], filtros), [ejercicios, filtros])
  const { visibles, hayMas, centinela } = useIncremental(lista)
  const hayArchivados = ejercicios?.some((e) => e.archivado)

  return (
    <>
      <Cabecera
        titulo="Rutinas"
        accion={
          <Link
            to="/rutinas/ejercicios/nuevo"
            aria-label="Crear ejercicio propio"
            className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink"
          >
            <Icono nombre="mas" />
          </Link>
        }
      />
      <PestanasRutinas />
      <FiltrosBiblioteca filtros={filtros} onCambio={setFiltros} />

      <p className="mt-4 mb-2 text-sm text-muted">
        {ejercicios ? `${lista.length} ${lista.length === 1 ? 'ejercicio' : 'ejercicios'}` : 'Preparando la biblioteca…'}
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
        {visibles.map((e) => (
          <li key={e.id}>
            <Link to={`/rutinas/ejercicios/${encodeURIComponent(e.id)}`} className="flex min-h-18 items-center gap-3 px-3 py-2 active:bg-surface-2">
              <MiniaturaEjercicio ejercicio={e} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 leading-snug font-semibold">{e.nombre}</span>
                <span className="block truncate text-sm text-muted">
                  {e.musculosPrincipales.map((m) => NOMBRE_MUSCULO[m]).join(', ')} · {NOMBRE_MATERIAL[e.material]}
                  {e.personalizado && ' · Propio'}
                </span>
              </span>
              {e.notasFijas && <Icono nombre="nota" tamano={18} className="shrink-0 text-muted" />}
            </Link>
          </li>
        ))}
      </ul>
      {hayMas && <div ref={centinela} className="h-12" />}
      {ejercicios && lista.length === 0 && (
        <div className="mt-4">
          <Vacio titulo="Nada por aquí">
            Prueba con otros filtros. Si de verdad no existe, <Link to="/rutinas/ejercicios/nuevo" className="text-accent underline">créalo</Link>.
          </Vacio>
        </div>
      )}
      {hayArchivados && (
        <button
          type="button"
          onClick={() => setFiltros({ ...filtros, archivados: !filtros.archivados })}
          className="mx-auto mt-4 flex min-h-12 items-center gap-2 px-4 text-sm font-medium text-muted"
        >
          <Icono nombre="archivar" tamano={18} />
          {filtros.archivados ? 'Ver ejercicios activos' : 'Ver mis ejercicios archivados'}
        </button>
      )}
    </>
  )
}
