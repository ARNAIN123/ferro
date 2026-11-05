import { Tarjeta } from '../../components/ui'
import { mensajeMes, type EstadoMes } from '../../domain/objetivoMensual'

/** "9 / 16 días · noviembre", barra de progreso y cuántos días me puedo saltar. */
export function ObjetivoMes({ estado }: { estado: EstadoMes }) {
  const mes = new Date(estado.inicio).toLocaleDateString('es-ES', { month: 'long' })
  const llenado = estado.objetivo > 0 ? Math.min(1, estado.hechos / estado.objetivo) : 0
  const color = estado.situacion === 'cumplido' ? 'text-accent' : estado.situacion === 'imposible' ? 'text-muted' : 'text-fg'

  return (
    <Tarjeta>
      <p className="flex items-baseline gap-2">
        <span className="num text-4xl leading-none font-bold">
          <span className={estado.situacion === 'cumplido' ? 'text-accent' : ''}>{estado.hechos}</span>
          <span className="text-2xl text-muted"> / {estado.objetivo}</span>
        </span>
        <span className="text-muted">días · {mes}</span>
      </p>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label={`Objetivo de ${mes}`}
        aria-valuemin={0}
        aria-valuemax={estado.objetivo}
        aria-valuenow={Math.min(estado.hechos, estado.objetivo)}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${llenado * 100}%` }} />
      </div>
      <p className={`mt-2.5 text-sm font-medium ${color}`}>{mensajeMes(estado)}</p>
    </Tarjeta>
  )
}
