import { useEffect, useRef, useState } from 'react'
import { Icono } from '../../components/Icono'
import { fmtKg, parseNumero } from '../../lib/formato'

const PULSACION_LARGA_MS = 450

interface Props {
  etiqueta: string
  unidad: string
  valor: number
  onCambio: (v: number) => void
  onPaso: (direccion: 1 | -1) => void
  decimales?: boolean
}

/**
 * Valor grande con botones −/+ a los lados. Mantener pulsado el número abre el teclado numérico
 * para escribir un valor exacto; un toque corto no hace nada (evita abrir el teclado sin querer).
 */
export function CampoNumero({ etiqueta, unidad, valor, onCambio, onPaso, decimales }: Props) {
  const [texto, setTexto] = useState(fmtKg(valor))
  const [editando, setEditando] = useState(false)
  const [pulsando, setPulsando] = useState(false)
  const inicio = useRef<number | null>(null)
  const input = useRef<HTMLInputElement>(null)

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

  const soltar = () => {
    const largo = inicio.current !== null && Date.now() - inicio.current >= PULSACION_LARGA_MS
    inicio.current = null
    setPulsando(false)
    const el = input.current
    if (!largo || !el || editando) return
    // Dentro del propio gesto: así Android sí abre el teclado.
    el.readOnly = false
    setEditando(true)
    el.focus()
    el.select()
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
          ref={input}
          aria-label={`${etiqueta}. Mantén pulsado para escribir`}
          inputMode={decimales ? 'decimal' : 'numeric'}
          enterKeyHint="done"
          readOnly={!editando}
          value={texto}
          onPointerDown={() => {
            if (editando) return
            inicio.current = Date.now()
            setPulsando(true)
          }}
          onPointerUp={soltar}
          onPointerCancel={() => {
            inicio.current = null
            setPulsando(false)
          }}
          onContextMenu={(e) => e.preventDefault()}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => editando && confirmar()}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={`num h-12 w-full min-w-0 rounded-xl bg-transparent text-center text-[1.9rem] leading-none transition-colors focus:outline-none ${
            editando ? 'bg-surface-2 ring-2 ring-accent' : `select-none [-webkit-touch-callout:none] ${pulsando ? 'bg-surface-2' : ''}`
          }`}
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
