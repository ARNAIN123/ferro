import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Icono } from './Icono'

interface Props {
  titulo: string
  subtitulo?: ReactNode
  atras?: boolean | string
  accion?: ReactNode
}

export function Cabecera({ titulo, subtitulo, atras, accion }: Props) {
  const navegar = useNavigate()
  return (
    <header className="pt-safe">
      <div className="flex min-h-16 items-center gap-2 pt-3">
        {atras && (
          <button
            type="button"
            aria-label="Volver"
            onClick={() => (typeof atras === 'string' ? navegar(atras) : navegar(-1))}
            className="-ml-3 grid size-12 shrink-0 place-items-center rounded-full active:bg-surface-2"
          >
            <Icono nombre="atras" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="condensada line-clamp-2 text-3xl leading-[1.1] font-extrabold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="truncate text-sm text-muted">{subtitulo}</p>}
        </div>
        {accion}
      </div>
    </header>
  )
}
