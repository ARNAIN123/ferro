import { GraficaE1rm, GraficaVolumen } from '../../components/graficas'
import { Icono } from '../../components/Icono'
import { Tarjeta } from '../../components/ui'
import type { EntradaHistorial } from '../../db/consultas'
import { evolucionEjercicio } from '../../domain/estadisticas'
import { estancado } from '../../domain/progresion'
import type { Ejercicio } from '../../domain/tipos'
import { fmtFechaCorta, fmtKg } from '../../lib/formato'

export function ProgresoEjercicio({ ejercicio, historial }: { ejercicio: Ejercicio; historial: EntradaHistorial[] }) {
  const fechas = new Map(historial.map((h) => [h.sesion.id, h.sesion.entrada]))
  const puntos = evolucionEjercicio(
    historial.flatMap((h) => h.series),
    fechas,
  )
  if (puntos.length === 0) return null

  const mejor = puntos.reduce((a, b) => (b.e1rm > a.e1rm ? b : a))
  const pesoMax = Math.max(...historial.flatMap((h) => h.series.filter((s) => s.tipo !== 'calentamiento').map((s) => s.peso)))
  const desde = ejercicio.reinicioProgresion ?? 0
  const atascado = estancado(historial.filter((h) => h.sesion.entrada >= desde).map((h) => h.series))

  return (
    <section className="space-y-3">
      <dl className="grid grid-cols-3 gap-2">
        <Dato etiqueta="1RM estimado" valor={`${fmtKg(Math.round(mejor.e1rm * 10) / 10)}`} unidad="kg" />
        <Dato etiqueta="Mejor serie" valor={`${fmtKg(mejor.mejor.peso)}×${mejor.mejor.reps}`} pie={fmtFechaCorta(mejor.fecha)} />
        <Dato etiqueta="Peso máximo" valor={fmtKg(pesoMax)} unidad="kg" />
      </dl>

      {atascado && (
        <p className="flex items-start gap-2 rounded-2xl bg-warn/10 px-4 py-3 text-sm text-warn">
          <Icono nombre="aviso" tamano={18} className="mt-0.5 shrink-0" />
          3 sesiones seguidas sin mejorar. En el próximo entreno podrás bajar un 10 % y reconstruir o cambiar de ejercicio.
        </p>
      )}

      {puntos.length >= 2 && (
        <>
          <Tarjeta>
            <h2 className="mb-2 font-bold">1RM estimado</h2>
            <GraficaE1rm puntos={puntos} />
            <p className="mt-1 text-xs text-muted">Fórmula de Epley: peso × (1 + reps / 30), con la mejor serie de cada sesión.</p>
          </Tarjeta>
          <Tarjeta>
            <h2 className="mb-2 font-bold">Volumen por sesión</h2>
            <GraficaVolumen puntos={puntos} />
          </Tarjeta>
        </>
      )}
    </section>
  )
}

function Dato({ etiqueta, valor, unidad, pie }: { etiqueta: string; valor: string; unidad?: string; pie?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3">
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className="num mt-1 text-2xl leading-none">
        {valor}
        {unidad && <span className="ml-0.5 text-sm font-medium text-muted">{unidad}</span>}
      </dd>
      {pie && <dd className="mt-1 text-xs text-muted">{pie}</dd>}
    </div>
  )
}
