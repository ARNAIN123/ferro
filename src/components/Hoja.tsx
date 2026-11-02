import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icono } from './Icono'

interface Props {
  abierta: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
}

/** Hoja inferior modal, cómoda para el pulgar. Usa <dialog> para foco y tecla atrás. */
export function Hoja({ abierta, onCerrar, titulo, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierta && !d.open) d.showModal()
    if (!abierta && d.open) d.close()
  }, [abierta])

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar()
      }}
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none rounded-t-3xl border-t border-line bg-surface p-0 text-fg backdrop:bg-black/60 open:anim-subir sm:mx-auto sm:max-w-lg"
    >
      {abierta && (
        <div className="flex max-h-[88dvh] flex-col">
          <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
            <h2 id={idTitulo} className="condensada text-xl font-bold">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="-mr-2 grid size-12 place-items-center rounded-full text-muted active:bg-surface-2"
            >
              <Icono nombre="cerrar" />
            </button>
          </header>
          <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </div>
      )}
    </dialog>
  )
}
