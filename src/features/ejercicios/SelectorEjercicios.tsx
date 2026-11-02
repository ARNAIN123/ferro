import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icono } from '../../components/Icono'
import { MiniaturaEjercicio } from '../../components/ImagenEjercicio'
import { Boton } from '../../components/ui'
import { db } from '../../db/db'
import { filtrarEjercicios, FILTROS_INICIALES, type Filtros } from '../../domain/biblioteca'
import { NOMBRE_MATERIAL, NOMBRE_MUSCULO } from '../../domain/etiquetas'
import type { Musculo } from '../../domain/tipos'
import { useIncremental } from '../../hooks/useIncremental'
import { FiltrosBiblioteca } from './FiltrosBiblioteca'

interface Props {
  abierto: boolean
  titulo: string
  /** Selección múltiple (por defecto) o de uno solo. */
  multiple?: boolean
  /** Filtra por un músculo fijo, p. ej. para buscar alternativas. */
  musculo?: Musculo
  excluir?: readonly string[]
  onCerrar: () => void
  onConfirmar: (ids: string[]) => void
}

/** Selector a pantalla completa con buscador, filtros, miniaturas y selección múltiple. */
export function SelectorEjercicios({ abierto, titulo, multiple = true, musculo, excluir = [], onCerrar, onConfirmar }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const ejercicios = useLiveQuery(() => (abierto ? db.ejercicios.toArray() : []), [abierto])
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [elegidos, setElegidos] = useState<string[]>([])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) {
      setFiltros({ ...FILTROS_INICIALES, musculo: musculo ?? null })
      setElegidos([])
      d.showModal()
    }
    if (!abierto && d.open) d.close()
  }, [abierto, musculo])

  const lista = useMemo(() => {
    const fuera = new Set(excluir)
    return filtrarEjercicios((ejercicios ?? []).filter((e) => !fuera.has(e.id)), filtros)
  }, [ejercicios, filtros, excluir])
  const { visibles, hayMas, centinela } = useIncremental(lista)

  const alternar = (id: string) => {
    if (!multiple) return onConfirmar([id])
    setElegidos((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))
  }

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      aria-label={titulo}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-bg p-0 text-fg backdrop:bg-bg"
    >
      {abierto && (
        <div className="mx-auto flex h-full max-w-lg flex-col">
          <header className="pt-safe px-safe border-b border-line pb-3">
            <div className="flex min-h-14 items-center gap-2">
              <button type="button" onClick={onCerrar} aria-label="Cerrar" className="-ml-3 grid size-12 place-items-center rounded-full active:bg-surface-2">
                <Icono nombre="cerrar" />
              </button>
              <h2 className="condensada flex-1 truncate text-2xl font-extrabold">{titulo}</h2>
              <span className="text-sm text-muted">{lista.length}</span>
            </div>
            <FiltrosBiblioteca filtros={filtros} onCambio={setFiltros} musculoFijo={Boolean(musculo)} />
          </header>

          <ul className="flex-1 overflow-y-auto overscroll-contain px-safe py-2">
            {visibles.map((e) => {
              const marcado = elegidos.includes(e.id)
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => alternar(e.id)}
                    aria-pressed={multiple ? marcado : undefined}
                    className="flex min-h-18 w-full items-center gap-3 rounded-2xl py-2 text-left active:bg-surface"
                  >
                    <MiniaturaEjercicio ejercicio={e} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 leading-snug font-semibold">{e.nombre}</span>
                      <span className="block truncate text-sm text-muted">
                        {e.musculosPrincipales.map((m) => NOMBRE_MUSCULO[m]).join(', ')} · {NOMBRE_MATERIAL[e.material]}
                      </span>
                    </span>
                    {multiple ? (
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-lg border-2 ${marcado ? 'border-accent bg-accent text-accent-ink' : 'border-line'}`}
                        aria-hidden="true"
                      >
                        {marcado && <Icono nombre="check" tamano={18} grosor={3} />}
                      </span>
                    ) : (
                      <Icono nombre="adelante" tamano={18} className="shrink-0 text-muted" />
                    )}
                  </button>
                </li>
              )
            })}
            {hayMas && <div ref={centinela} className="h-10" />}
            {ejercicios && lista.length === 0 && <li className="py-10 text-center text-muted">No hay ejercicios con estos filtros.</li>}
          </ul>

          {multiple && (
            <footer className="border-t border-line px-safe pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Boton variante="primario" grande className="w-full" disabled={elegidos.length === 0} onClick={() => onConfirmar(elegidos)}>
                <Icono nombre="mas" />
                {elegidos.length === 0 ? 'Elige ejercicios' : `Añadir ${elegidos.length} ${elegidos.length === 1 ? 'ejercicio' : 'ejercicios'}`}
              </Boton>
            </footer>
          )}
        </div>
      )}
    </dialog>
  )
}
