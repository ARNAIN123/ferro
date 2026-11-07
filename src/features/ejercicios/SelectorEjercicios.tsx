import { useEffect, useRef, useState } from 'react'
import { Icono } from '../../components/Icono'
import { Boton } from '../../components/ui'
import type { Musculo } from '../../domain/tipos'
import { BuscadorPorMapa } from './BuscadorPorMapa'

interface Props {
  abierto: boolean
  titulo: string
  /** Selección múltiple (por defecto) o de uno solo. */
  multiple?: boolean
  /** Músculo con el que se abre el mapa (al cambiar un ejercicio, su músculo principal). */
  musculo?: Musculo
  excluir?: readonly string[]
  onCerrar: () => void
  onConfirmar: (ids: string[]) => void
}

/** Selector a pantalla completa: se busca con el mapa y se pueden elegir varios ejercicios de golpe. */
export function SelectorEjercicios({ abierto, titulo, multiple = true, musculo, excluir = [], onCerrar, onConfirmar }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [elegido, setElegido] = useState<Musculo | null>(null)
  const [elegidos, setElegidos] = useState<string[]>([])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) {
      setElegido(musculo ?? null)
      setElegidos([])
      d.showModal()
    }
    if (!abierto && d.open) d.close()
  }, [abierto, musculo])


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
              {multiple && elegidos.length > 0 && <span className="text-sm text-muted">{elegidos.length} elegidos</span>}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-safe py-3">
            <BuscadorPorMapa
              musculo={elegido}
              onMusculo={setElegido}
              excluir={excluir}
              altoMapa="h-80"
              fila={(e, contenido) => {
                const marcado = elegidos.includes(e.id)
                return (
                  <button
                    type="button"
                    onClick={() => alternar(e.id)}
                    aria-pressed={multiple ? marcado : undefined}
                    className="flex min-h-18 w-full items-center gap-3 px-3 py-2 text-left active:bg-surface-2"
                  >
                    {contenido}
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
                )
              }}
            />
          </div>

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
