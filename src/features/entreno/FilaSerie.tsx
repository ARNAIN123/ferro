import { Icono } from '../../components/Icono'
import { actualizarSerie } from '../../db/entreno'
import { siguienteRir, siguienteTipo } from '../../domain/entreno'
import { NOMBRE_TIPO_SERIE } from '../../domain/etiquetas'
import type { Serie } from '../../domain/tipos'
import { fmtKg } from '../../lib/formato'

interface Props {
  serie: Serie
  numero: number
  seleccionada: boolean
  onSeleccionar: () => void
  onCompletar: () => void
}

const INSIGNIA = {
  calentamiento: 'bg-surface-2 text-muted',
  normal: 'bg-surface-2 text-fg',
  drop: 'bg-accent-soft text-accent',
} as const

export function FilaSerie({ serie, numero, seleccionada, onSeleccionar, onCompletar }: Props) {
  const etiqueta = serie.tipo === 'calentamiento' ? 'C' : serie.tipo === 'drop' ? 'D' : String(numero)
  return (
    <li
      className={`flex h-16 items-center gap-1.5 rounded-2xl pr-1.5 pl-1.5 transition-colors ${
        serie.completada ? 'bg-accent-soft' : 'bg-surface'
      } ${seleccionada ? 'ring-2 ring-accent' : ''}`}
    >
      <button
        type="button"
        onClick={() => actualizarSerie(serie.id, { tipo: siguienteTipo(serie.tipo) })}
        aria-label={`Tipo: ${NOMBRE_TIPO_SERIE[serie.tipo]}. Tocar para cambiar`}
        className={`num grid size-12 shrink-0 place-items-center rounded-xl text-lg ${INSIGNIA[serie.tipo]}`}
      >
        {etiqueta}
      </button>
      <button
        type="button"
        onClick={onSeleccionar}
        aria-label={`Editar serie ${etiqueta}: ${fmtKg(serie.peso)} kilos por ${serie.reps} repeticiones`}
        aria-pressed={seleccionada}
        className="flex h-full min-w-0 flex-1 items-baseline justify-center gap-1.5"
      >
        <span className={`num self-center text-2xl ${serie.completada ? 'text-accent' : ''}`}>{fmtKg(serie.peso)}</span>
        <span className="self-center text-sm text-muted">kg ×</span>
        <span className={`num self-center text-2xl ${serie.completada ? 'text-accent' : ''}`}>{serie.reps}</span>
      </button>
      <button
        type="button"
        onClick={() => actualizarSerie(serie.id, { rir: siguienteRir(serie.rir) })}
        aria-label={serie.rir === null ? 'RIR sin anotar. Tocar para anotar' : `RIR ${serie.rir}. Tocar para cambiar`}
        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-[0.65rem] leading-tight font-semibold ${
          serie.rir === null ? 'text-muted/70' : 'bg-surface-2 text-fg'
        }`}
      >
        RIR
        <span className="num text-base">{serie.rir ?? '–'}</span>
      </button>
      <button
        type="button"
        onClick={onCompletar}
        aria-label={serie.completada ? 'Serie hecha. Tocar para desmarcar' : 'Completar serie'}
        aria-pressed={serie.completada}
        className={`grid size-13 shrink-0 place-items-center rounded-2xl transition ${
          serie.completada ? 'bg-accent text-accent-ink' : 'border-2 border-line text-muted active:border-accent'
        }`}
      >
        <Icono nombre="check" tamano={26} grosor={3} />
      </button>
    </li>
  )
}
