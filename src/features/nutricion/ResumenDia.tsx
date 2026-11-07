import type { Macros, Valores100 } from '../../domain/nutricion'
import { fmtEntero } from '../../lib/formato'

interface Props {
  objetivo: { kcal: number } & Macros
  comido: Valores100
}

/** Anillo de calorías que me quedan y barras de proteína (destacada), hidratos y grasa. */
export function ResumenDia({ objetivo, comido }: Props) {
  const quedan = Math.round(objetivo.kcal - comido.kcal)
  const r = 52
  const largo = 2 * Math.PI * r
  const llenado = Math.min(1, comido.kcal / Math.max(1, objetivo.kcal))
  return (
    <section className="rounded-3xl border border-line bg-surface p-4" aria-label="Resumen del día">
      <div className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-4">
        <div className="relative aspect-square w-full">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-surface-2" />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={largo}
              strokeDashoffset={largo * (1 - llenado)}
              className={`stroke-accent transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none ${llenado === 0 ? 'opacity-0' : ''}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="num text-3xl leading-none font-bold">{fmtEntero(Math.abs(quedan))}</span>
            <span className="mt-1 text-xs text-muted">{quedan >= 0 ? 'kcal te quedan' : 'kcal por encima'}</span>
          </div>
        </div>
        <div className="space-y-2.5">
          <Barra nombre="Proteína" valor={comido.proteina} objetivo={objetivo.proteina} destacada />
          <Barra nombre="Hidratos" valor={comido.carbohidratos} objetivo={objetivo.carbohidratos} />
          <Barra nombre="Grasa" valor={comido.grasa} objetivo={objetivo.grasa} />
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-muted">
        <span className="num font-semibold text-fg">{fmtEntero(comido.kcal)}</span> de <span className="num">{fmtEntero(objetivo.kcal)}</span> kcal
      </p>
    </section>
  )
}

function Barra({ nombre, valor, objetivo, destacada }: { nombre: string; valor: number; objetivo: number; destacada?: boolean }) {
  const pct = Math.min(100, (valor / Math.max(1, objetivo)) * 100)
  const faltan = Math.round(objetivo - valor)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={destacada ? 'font-bold text-accent' : 'font-medium'}>{nombre}</span>
        <span className="num text-muted">
          <span className={destacada ? 'font-bold text-fg' : 'text-fg'}>{fmtEntero(valor)}</span> / {fmtEntero(objetivo)} g
        </span>
      </div>
      <div className={`mt-1 overflow-hidden rounded-full bg-surface-2 ${destacada ? 'h-3' : 'h-2'}`}>
        <div className={`h-full rounded-full ${destacada ? 'bg-accent' : 'bg-muted/60'} transition-[width] duration-700 motion-reduce:transition-none`} style={{ width: `${pct}%` }} />
      </div>
      {destacada && faltan > 0 && <p className="mt-0.5 text-xs text-muted">Te faltan {fmtEntero(faltan)} g</p>}
    </div>
  )
}
