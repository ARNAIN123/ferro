import { Icono } from '../../components/Icono'

interface Props {
  etiqueta: string
  valor: number
  unidad: string
  min: number
  max: number
  paso?: number
  /** Cómo mostrar el valor (p. ej. 10.000). */
  formato?: (v: number) => string
  onCambio: (v: number) => void
}

/** Fila de ajuste numérico con botones −/+ grandes. */
export function Paso({ etiqueta, valor, unidad, min, max, paso = 1, formato = String, onCambio }: Props) {
  const cambiar = (d: number) => onCambio(Math.min(max, Math.max(min, valor + d)))
  return (
    <div className="flex min-h-14 items-center gap-2">
      <span className="flex-1 font-medium">{etiqueta}</span>
      <button
        type="button"
        aria-label={`Restar ${etiqueta.toLowerCase()}`}
        disabled={valor <= min}
        onClick={() => cambiar(-paso)}
        className="grid size-12 place-items-center rounded-xl bg-surface-2 disabled:opacity-30"
      >
        <Icono nombre="menos" tamano={20} />
      </button>
      <output className="num min-w-16 text-center text-xl" aria-live="polite">
        {formato(valor)}
        {unidad && <span className="ml-0.5 text-sm font-medium text-muted">{unidad}</span>}
      </output>
      <button
        type="button"
        aria-label={`Sumar ${etiqueta.toLowerCase()}`}
        disabled={valor >= max}
        onClick={() => cambiar(paso)}
        className="grid size-12 place-items-center rounded-xl bg-surface-2 disabled:opacity-30"
      >
        <Icono nombre="mas" tamano={20} />
      </button>
    </div>
  )
}
