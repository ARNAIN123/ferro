import { Icono } from '../../components/Icono'
import type { MesHistorial } from '../../domain/objetivoMensual'

const nombreMes = (t: number, conAno: boolean) => {
  const texto = new Date(t).toLocaleDateString('es-ES', conAno ? { month: 'long', year: 'numeric' } : { month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Meses del más reciente al más antiguo: días hechos frente al objetivo, cumplido o no. */
export function HistorialMeses({ meses }: { meses: MesHistorial[] }) {
  const anoActual = new Date().getFullYear()
  return (
    <ul className="space-y-2.5">
      {meses.map((m) => {
        const llenado = Math.min(1, m.objetivo > 0 ? m.hechos / m.objetivo : 0)
        const estado = m.cumplido ? 'cumplido' : m.enCurso ? 'en curso' : 'no cumplido'
        return (
          <li key={m.inicio} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3">
            <span className="truncate text-sm">{nombreMes(m.inicio, new Date(m.inicio).getFullYear() !== anoActual)}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span
                className={`block h-full rounded-full ${m.cumplido ? 'bg-accent' : m.enCurso ? 'bg-accent/55' : 'bg-muted/45'}`}
                style={{ width: `${llenado * 100}%` }}
              />
            </span>
            <span className="flex w-20 items-center justify-end gap-1.5 text-sm" aria-label={`${m.hechos} de ${m.objetivo} días, ${estado}`}>
              <span className="num">
                {m.hechos}
                <span className="text-muted">/{m.objetivo}</span>
              </span>
              {m.cumplido ? (
                <Icono nombre="check" tamano={16} grosor={3} className="text-accent" />
              ) : m.enCurso ? (
                <span className="size-4" />
              ) : (
                <Icono nombre="cerrar" tamano={14} grosor={2.5} className="text-muted" />
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
