import { useEffect } from 'react'
import { ajustarDescanso, terminarDescanso } from '../../db/entreno'
import { restanteMs } from '../../domain/entreno'
import { useAhora } from '../../hooks/useAhora'
import { fmtCrono } from '../../lib/formato'
import { avisoDescansoNativo } from '../../lib/nativo'
import { vibrar, VIBRACION_DESCANSO } from '../../lib/vibrar'

interface Props {
  sesionId: string
  fin: number | null
  duracion: number | null
  vibracion: boolean
}

/**
 * Temporizador de descanso. Siempre se calcula desde la hora de fin guardada,
 * así que sigue siendo exacto si sales de la app y vuelves.
 */
export function Descanso({ sesionId, fin, duracion, vibracion }: Props) {
  const ahora = useAhora(250, fin !== null)
  const restante = restanteMs(fin, ahora)

  useEffect(() => {
    if (fin === null) return
    const espera = fin - Date.now()
    if (espera <= 0) return
    const t = setTimeout(() => {
      // Solo vibra si la app está a la vista y no estamos volviendo tarde de segundo plano.
      // En Android ya vibra la notificación de fin de descanso.
      if (document.visibilityState === 'visible' && Date.now() - fin < 2000 && !avisoDescansoNativo()) vibrar(VIBRACION_DESCANSO, vibracion)
    }, espera)
    return () => clearTimeout(t)
  }, [fin, vibracion])

  if (fin === null || restante <= 0) return null
  const total = (duracion ?? 0) * 1000 || restante
  const progreso = Math.min(1, 1 - restante / total)

  return (
    <div className="anim-aparecer relative overflow-hidden rounded-2xl bg-surface-2" role="timer" aria-live="off">
      <div className="absolute inset-y-0 left-0 bg-accent-soft" style={{ width: `${progreso * 100}%` }} aria-hidden="true" />
      <div className="relative flex h-14 items-center gap-1 pr-1 pl-4">
        <span className="text-sm font-semibold text-muted">Descanso</span>
        <span className="num ml-2 flex-1 text-3xl text-accent">{fmtCrono(restante / 1000)}</span>
        <button
          type="button"
          onClick={() => ajustarDescanso(sesionId, -15)}
          className="num h-12 rounded-xl px-3 text-base active:bg-line"
          aria-label="Restar 15 segundos"
        >
          −15
        </button>
        <button
          type="button"
          onClick={() => ajustarDescanso(sesionId, 15)}
          className="num h-12 rounded-xl px-3 text-base active:bg-line"
          aria-label="Sumar 15 segundos"
        >
          +15
        </button>
        <button
          type="button"
          onClick={() => terminarDescanso(sesionId)}
          className="h-12 rounded-xl px-3 text-sm font-semibold active:bg-line"
        >
          Saltar
        </button>
      </div>
    </div>
  )
}
