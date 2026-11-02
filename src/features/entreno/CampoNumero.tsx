import { useEffect, useState } from 'react'
import { Icono } from '../../components/Icono'
import { fmtKg, parseNumero } from '../../lib/formato'

interface Props {
  etiqueta: string
  unidad: string
  valor: number
  onCambio: (v: number) => void
  onPaso: (direccion: 1 | -1) => void
  decimales?: boolean
}

/** Valor grande con botones −/+ a los lados. Tocar el número permite escribirlo. */
export function CampoNumero({ etiqueta, unidad, valor, onCambio, onPaso, decimales }: Props) {
  const [texto, setTexto] = useState(fmtKg(valor))
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    if (!editando) setTexto(fmtKg(valor))
  }, [valor, editando])

  const confirmar = () => {
    setEditando(false)
    const n = parseNumero(texto)
    if (n === null || n < 0) return setTexto(fmtKg(valor))
    const limpio = decimales ? Math.round(n * 100) / 100 : Math.round(n)
    if (limpio !== valor) onCambio(limpio)
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="flex w-full items-center justify-between gap-1">
        <button
          type="button"
          aria-label={`Menos ${etiqueta}`}
          onClick={() => onPaso(-1)}
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 active:bg-line"
        >
          <Icono nombre="menos" />
        </button>
        <input
          aria-label={etiqueta}
          inputMode={decimales ? 'decimal' : 'numeric'}
          enterKeyHint="done"
          value={texto}
          onFocus={(e) => {
            setEditando(true)
            e.target.select()
          }}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="num h-12 w-full min-w-0 bg-transparent text-center text-[1.9rem] leading-none focus:outline-none"
        />
        <button
          type="button"
          aria-label={`Más ${etiqueta}`}
          onClick={() => onPaso(1)}
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 active:bg-line"
        >
          <Icono nombre="mas" />
        </button>
      </div>
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{unidad}</span>
    </div>
  )
}
