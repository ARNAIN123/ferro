// Gráficas de Recharts. Este módulo se carga bajo demanda para no engordar el arranque.
import type { ReactElement } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { FRANJA_SERIES, type PuntoEjercicio, type PuntoPeso } from '../../domain/estadisticas'
import type { Musculo } from '../../domain/tipos'
import { fmtEntero, fmtFechaCorta, fmtKg } from '../../lib/formato'
import { useColores, type Colores } from './useColores'

const sinAnimacion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

function ejes(c: Colores) {
  return {
    tick: { fill: c.tenue, fontSize: 12 },
    axisLine: false,
    tickLine: false,
  } as const
}

/** Tooltip con los tokens de texto del tema (nunca el color de la serie para el texto). */
function Burbuja({ titulo, filas }: { titulo: string; filas: { etiqueta: string; valor: string; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm shadow-xl">
      <p className="mb-0.5 font-semibold">{titulo}</p>
      {filas.map((f) => (
        <p key={f.etiqueta} className="flex items-center gap-2 text-muted">
          {f.color && <span className="size-2 rounded-full" style={{ background: f.color }} />}
          {f.etiqueta}: <span className="num text-fg">{f.valor}</span>
        </p>
      ))}
    </div>
  )
}

function Marco({ alto = 200, children, etiqueta }: { alto?: number; children: ReactElement; etiqueta: string }) {
  return (
    <figure role="img" aria-label={etiqueta} className="-ml-2" style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </figure>
  )
}

export function GraficaE1rm({ puntos }: { puntos: PuntoEjercicio[] }) {
  const c = useColores()
  const datos = puntos.map((p) => ({ ...p, e1rm: Math.round(p.e1rm * 10) / 10 }))
  return (
    <Marco etiqueta="Evolución del 1RM estimado">
      <LineChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={c.linea} strokeDasharray="0" />
        <XAxis dataKey="fecha" tickFormatter={fmtFechaCorta} {...ejes(c)} minTickGap={24} />
        <YAxis {...ejes(c)} width={40} domain={['auto', 'auto']} tickFormatter={(v: number) => fmtKg(v)} />
        <Tooltip
          cursor={{ stroke: c.tenue, strokeWidth: 1 }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as (PuntoEjercicio & { e1rm: number }) | undefined
            if (!active || !p) return null
            return (
              <Burbuja
                titulo={fmtFechaCorta(p.fecha)}
                filas={[
                  { etiqueta: '1RM est.', valor: `${fmtKg(p.e1rm)} kg` },
                  { etiqueta: 'Mejor serie', valor: `${fmtKg(p.mejor.peso)} × ${p.mejor.reps}` },
                ]}
              />
            )
          }}
        />
        <Line
          type="monotone"
          dataKey="e1rm"
          stroke={c.acento}
          strokeWidth={2}
          dot={{ r: 4, fill: c.acento, stroke: c.superficie, strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: c.superficie, strokeWidth: 2 }}
          isAnimationActive={!sinAnimacion}
        />
      </LineChart>
    </Marco>
  )
}

export function GraficaVolumen({ puntos }: { puntos: PuntoEjercicio[] }) {
  const c = useColores()
  return (
    <Marco alto={160} etiqueta="Volumen por sesión">
      <BarChart data={puntos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={c.linea} />
        <XAxis dataKey="fecha" tickFormatter={fmtFechaCorta} {...ejes(c)} minTickGap={24} />
        <YAxis {...ejes(c)} width={40} tickFormatter={(v: number) => (v >= 1000 ? `${fmtKg(Math.round(v / 100) / 10)}k` : String(v))} />
        <Tooltip
          cursor={{ fill: c.superficie2 }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as PuntoEjercicio | undefined
            if (!active || !p) return null
            return <Burbuja titulo={fmtFechaCorta(p.fecha)} filas={[{ etiqueta: 'Volumen', valor: `${fmtEntero(p.volumen)} kg` }]} />
          }}
        />
        <Bar dataKey="volumen" fill={c.acento} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={!sinAnimacion} />
      </BarChart>
    </Marco>
  )
}

export function GraficaAsistencia({ semanas, objetivo }: { semanas: { inicio: number; dias: number }[]; objetivo: number }) {
  const c = useColores()
  return (
    <Marco alto={150} etiqueta="Días entrenados por semana">
      <BarChart data={semanas} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={c.linea} />
        <XAxis dataKey="inicio" tickFormatter={fmtFechaCorta} {...ejes(c)} minTickGap={16} />
        <YAxis {...ejes(c)} width={28} allowDecimals={false} domain={[0, Math.max(7, objetivo)]} ticks={[0, objetivo, 7]} />
        <ReferenceLine y={objetivo} stroke={c.tenue} strokeDasharray="4 4" />
        <Tooltip
          cursor={{ fill: c.superficie2 }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as { inicio: number; dias: number } | undefined
            if (!active || !p) return null
            return <Burbuja titulo={`Semana del ${fmtFechaCorta(p.inicio)}`} filas={[{ etiqueta: 'Días', valor: `${p.dias} de ${objetivo}` }]} />
          }}
        />
        <Bar dataKey="dias" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={!sinAnimacion}>
          {semanas.map((s) => (
            <Cell key={s.inicio} fill={s.dias >= objetivo ? c.acento : c.tenue} />
          ))}
        </Bar>
      </BarChart>
    </Marco>
  )
}

export function GraficaMusculos({ datos }: { datos: { musculo: Musculo; series: number }[] }) {
  const c = useColores()
  const max = Math.max(FRANJA_SERIES.max + 4, ...datos.map((d) => Math.ceil(d.series)))
  const filas = datos.map((d) => ({ ...d, nombre: NOMBRE_MUSCULO[d.musculo] }))
  return (
    <Marco alto={Math.max(120, filas.length * 30 + 30)} etiqueta="Series por grupo muscular esta semana">
      <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barCategoryGap={4}>
        <ReferenceArea x1={FRANJA_SERIES.min} x2={FRANJA_SERIES.max} fill={c.acento} fillOpacity={0.08} stroke="none" />
        <CartesianGrid horizontal={false} stroke={c.linea} />
        <XAxis type="number" domain={[0, max]} ticks={[0, FRANJA_SERIES.min, FRANJA_SERIES.max]} {...ejes(c)} />
        <YAxis type="category" dataKey="nombre" width={92} {...ejes(c)} interval={0} />
        <Tooltip
          cursor={{ fill: c.superficie2 }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as (typeof filas)[number] | undefined
            if (!active || !p) return null
            return <Burbuja titulo={p.nombre} filas={[{ etiqueta: 'Series', valor: fmtKg(p.series) }]} />
          }}
        />
        <Bar dataKey="series" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={!sinAnimacion}>
          {filas.map((f) => (
            <Cell key={f.musculo} fill={f.series >= FRANJA_SERIES.min ? c.acento : c.tenue} />
          ))}
        </Bar>
      </BarChart>
    </Marco>
  )
}

export function GraficaPeso({ puntos }: { puntos: PuntoPeso[] }) {
  const c = useColores()
  const datos = puntos.map((p) => {
    const [a, m, d] = p.fecha.split('-').map(Number)
    return { ...p, t: new Date(a!, m! - 1, d!).getTime() }
  })
  return (
    <>
      <Marco etiqueta="Peso corporal con media móvil de 7 días">
        <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.linea} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fmtFechaCorta} {...ejes(c)} minTickGap={24} />
          <YAxis {...ejes(c)} width={40} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v: number) => fmtKg(Math.round(v))} />
          <Tooltip
            cursor={{ stroke: c.tenue, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof datos)[number] | undefined
              if (!active || !p) return null
              return (
                <Burbuja
                  titulo={fmtFechaCorta(p.t)}
                  filas={[
                    { etiqueta: 'Peso', valor: `${fmtKg(p.kg)} kg`, color: c.tenue },
                    { etiqueta: 'Media 7 días', valor: `${fmtKg(p.media)} kg`, color: c.acento },
                  ]}
                />
              )
            }}
          />
          <Scatter dataKey="kg" fill={c.tenue} isAnimationActive={false} shape="circle" />
          <Line type="monotone" dataKey="media" stroke={c.acento} strokeWidth={2} dot={false} isAnimationActive={!sinAnimacion} />
        </ComposedChart>
      </Marco>
      <p className="mt-1 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: c.tenue }} /> Pesajes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: c.acento }} /> Media móvil 7 días
        </span>
      </p>
    </>
  )
}
