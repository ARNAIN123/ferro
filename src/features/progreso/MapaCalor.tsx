import type { CeldaCalor } from '../../domain/estadisticas'
import { fmtFechaCorta } from '../../lib/formato'

const INICIALES = ['L', '', 'X', '', 'V', '', 'D']
const ESTILO = ['bg-surface-2', 'bg-accent/35', 'bg-accent'] as const
const TEXTO = ['sin ir', 'fui al gimnasio', 'entrené'] as const

/** Calendario de asistencia estilo GitHub: cada columna es una semana, de lunes a domingo. */
export function MapaCalor({ semanas }: { semanas: CeldaCalor[][] }) {
  const meses = semanas.map((s, i) => {
    const mes = new Date(s[0]!.inicio).toLocaleDateString('es-ES', { month: 'short' })
    const anterior = i > 0 ? new Date(semanas[i - 1]![0]!.inicio).toLocaleDateString('es-ES', { month: 'short' }) : ''
    return mes !== anterior ? mes.replace('.', '') : ''
  })

  return (
    <div>
      <div className="flex gap-[3px]">
        <div className="mr-1 grid grid-rows-[14px_repeat(7,1fr)] gap-[3px] text-[10px] leading-none text-muted">
          <span />
          {INICIALES.map((l, i) => (
            <span key={i} className="flex items-center">
              {l}
            </span>
          ))}
        </div>
        <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: `repeat(${semanas.length}, minmax(0, 1fr))` }}>
          {semanas.map((s, i) => (
            <div key={s[0]!.clave} className="grid grid-rows-[14px_repeat(7,auto)] gap-[3px]">
              <span className="w-0 justify-self-start overflow-visible text-[10px] leading-none whitespace-nowrap text-muted">{meses[i]}</span>
              {s.map((c) => (
                <span
                  key={c.clave}
                  title={`${fmtFechaCorta(c.inicio)}: ${TEXTO[c.nivel]}`}
                  aria-label={c.futuro ? undefined : `${fmtFechaCorta(c.inicio)}: ${TEXTO[c.nivel]}`}
                  className={`aspect-square w-full rounded-[3px] ${c.futuro ? 'opacity-0' : ESTILO[c.nivel]}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 flex items-center justify-end gap-3 text-xs text-muted">
        {TEXTO.map((t, n) => (
          <span key={t} className="flex items-center gap-1">
            <span className={`size-2.5 rounded-[3px] ${ESTILO[n]}`} /> {t.charAt(0).toUpperCase() + t.slice(1)}
          </span>
        ))}
      </p>
    </div>
  )
}
