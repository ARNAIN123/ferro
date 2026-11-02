import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { cerrarAviso, suscribirAvisos, type Aviso } from '../lib/avisos'

export function Avisos() {
  const [lista, setLista] = useState<Aviso[]>([])
  const navegar = useNavigate()
  useEffect(() => suscribirAvisos(setLista), [])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md flex-col gap-2"
    >
      {lista.map((a) => (
        <div
          key={a.id}
          role="status"
          className="anim-aparecer pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-surface-2 py-2 pr-2 pl-4 shadow-2xl"
        >
          <p className="flex-1 py-1.5 text-sm font-medium">{a.texto}</p>
          {a.accion && (
            <button
              type="button"
              onClick={() => {
                cerrarAviso(a.id)
                navegar(a.accion!.ruta)
              }}
              className="min-h-11 rounded-xl px-3 text-sm font-bold text-accent"
            >
              {a.accion.texto}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
