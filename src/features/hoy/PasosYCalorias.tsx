import { useState } from 'react'
import { Link } from 'react-router'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { FACTOR_PASO, KCAL_POR_KG_Y_KM, MET_MAX, MET_MIN, type CaloriasDia } from '../../domain/calorias'
import type { PasosHoy } from '../../hooks/usePasosHoy'
import { fmtEntero, fmtKg } from '../../lib/formato'

interface Props {
  pasos: PasosHoy
  objetivoPasos: number
  /** null si faltan el peso o la altura. */
  calorias: CaloriasDia | null
  /** Datos usados en la estimación, para el desglose. */
  peso: { kg: number; origen: string } | null
  alturaCm: number | null
  /** Nombre de cada entreno de hoy, en el mismo orden que `calorias.entrenos`. */
  nombresEntrenos: string[]
}

/** Anillo de pasos de hoy y, al lado, las calorías estimadas (al tocarlas, el desglose). */
export function PasosYCalorias({ pasos, objetivoPasos, calorias, peso, alturaCm, nombresEntrenos }: Props) {
  const [desglose, setDesglose] = useState(false)
  const sinPasos = pasos.situacion !== 'ok'

  return (
    <div className="grid grid-cols-2 gap-3">
      <section className="flex flex-col items-center rounded-3xl border border-line bg-surface p-4" aria-label="Pasos de hoy">
        <AnilloPasos pasos={pasos.situacion === 'ok' ? (pasos.pasos ?? 0) : null} objetivo={objetivoPasos} />
        <EstadoPasos pasos={pasos} />
      </section>

      <button
        type="button"
        onClick={() => setDesglose(true)}
        className="flex flex-col rounded-3xl border border-line bg-surface p-4 text-left active:bg-surface-2"
        aria-haspopup="dialog"
      >
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <Icono nombre="llama" tamano={16} /> Calorías hoy
        </span>
        {calorias ? (
          <>
            <span className="num mt-auto pt-3 text-4xl leading-none font-bold">
              <span className="text-2xl text-muted">≈</span> {fmtEntero(calorias.total)}
            </span>
            <span className="mt-1 text-sm text-muted">kcal estimadas</span>
            <span className="mt-3 text-xs text-muted">
              Pasos {fmtEntero(calorias.pasos.kcal)}
              {sinPasos && ' (sin datos)'} · Entreno {fmtEntero(calorias.entrenos.reduce((t, e) => t + e.kcal, 0))}
            </span>
          </>
        ) : (
          <span className="mt-auto pt-3 text-sm">
            Añade tu <span className="font-semibold">{!peso && !alturaCm ? 'peso y altura' : !peso ? 'peso' : 'altura'}</span> para estimarlas.
          </span>
        )}
      </button>

      <Hoja abierta={desglose} onCerrar={() => setDesglose(false)} titulo="Calorías de hoy">
        <Desglose calorias={calorias} peso={peso} alturaCm={alturaCm} sinPasos={sinPasos} nombresEntrenos={nombresEntrenos} />
      </Hoja>
    </div>
  )
}

function AnilloPasos({ pasos, objetivo }: { pasos: number | null; objetivo: number }) {
  const r = 52
  const largo = 2 * Math.PI * r
  const llenado = pasos === null ? 0 : Math.min(1, pasos / Math.max(1, objetivo))
  return (
    <div className="relative aspect-square w-full max-w-36">
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
        <span className="num text-2xl leading-none font-bold">{pasos === null ? '—' : fmtEntero(pasos)}</span>
        <span className="mt-1 text-xs text-muted">de {fmtEntero(objetivo)}</span>
      </div>
      {pasos !== null && (
        <span className="sr-only">
          {fmtEntero(pasos)} pasos de {fmtEntero(objetivo)}
        </span>
      )}
    </div>
  )
}

function EstadoPasos({ pasos }: { pasos: PasosHoy }) {
  const clase = 'mt-2 min-h-10 text-center text-xs text-muted'
  switch (pasos.situacion) {
    case 'ok':
    case 'cargando':
      return <p className={clase}>pasos hoy</p>
    case 'web':
      return <p className={clase}>Los pasos llegan en la app Android</p>
    case 'sin-permiso':
      return (
        <button type="button" onClick={() => void pasos.conectar()} className="mt-2 min-h-10 px-2 text-sm font-semibold text-accent">
          Conectar Health Connect
        </button>
      )
    case 'instalar':
      return (
        <button type="button" onClick={() => void pasos.abrirHealthConnect()} className="mt-2 min-h-10 px-2 text-sm font-semibold text-accent">
          Instalar Health Connect
        </button>
      )
    case 'no-disponible':
      return <p className={clase}>Este móvil no tiene Health Connect</p>
    case 'error':
      return <p className={clase}>No se pudieron leer los pasos</p>
  }
}

function Desglose({
  calorias,
  peso,
  alturaCm,
  sinPasos,
  nombresEntrenos,
}: {
  calorias: CaloriasDia | null
  peso: Props['peso']
  alturaCm: number | null
  sinPasos: boolean
  nombresEntrenos: string[]
}) {
  if (!calorias)
    return (
      <div className="pb-4">
        <p>Para estimar las calorías hacen falta tu peso y tu altura.</p>
        <div className="mt-4 grid gap-2">
          {!peso && (
            <Link to="/peso" className="flex min-h-12 items-center justify-center rounded-2xl bg-surface-2 font-semibold">
              Registrar peso
            </Link>
          )}
          {!alturaCm && (
            <Link to="/ajustes#cuerpo" className="flex min-h-12 items-center justify-center rounded-2xl bg-surface-2 font-semibold">
              Añadir altura en Ajustes
            </Link>
          )}
        </div>
      </div>
    )

  return (
    <div className="space-y-4 pb-4">
      <p className="num text-4xl font-bold">
        <span className="text-2xl text-muted">≈</span> {fmtEntero(calorias.total)} <span className="text-lg font-medium text-muted">kcal</span>
      </p>
      <p className="-mt-2 text-sm text-muted">Estimación de lo que has gastado hoy por encima del reposo.</p>

      <dl className="divide-y divide-line rounded-2xl bg-surface-2 px-4">
        <div className="flex items-start justify-between gap-3 py-3">
          <dt>
            <span className="font-semibold">Caminar</span>
            <span className="block text-sm text-muted">
              {sinPasos ? (
                'Sin datos de pasos'
              ) : (
                <>
                  {fmtEntero(calorias.pasos.pasos)} pasos · {fmtKg(Math.round(calorias.pasos.km * 10) / 10)} km
                  {calorias.pasos.enEntreno > 0 && (
                    <>
                      <br />
                      {fmtEntero(calorias.pasos.enEntreno)} pasos durante el entreno no se suman aquí
                    </>
                  )}
                </>
              )}
            </span>
          </dt>
          <dd className="num text-lg">{fmtEntero(calorias.pasos.kcal)}</dd>
        </div>
        {calorias.entrenos.length === 0 ? (
          <div className="flex justify-between gap-3 py-3">
            <dt>
              <span className="font-semibold">Entreno</span>
              <span className="block text-sm text-muted">Hoy no hay series registradas</span>
            </dt>
            <dd className="num text-lg">0</dd>
          </div>
        ) : (
          calorias.entrenos.map((e, i) => (
            <div key={i} className="flex items-start justify-between gap-3 py-3">
              <dt>
                <span className="font-semibold">{nombresEntrenos[i] ?? 'Entreno'}</span>
                <span className="block text-sm text-muted">
                  {fmtEntero(e.minutos)} min · {e.series} series · {fmtEntero(e.volumenKg)} kg
                  <br />
                  Intensidad {fmtKg(Math.round(e.met * 10) / 10)} MET
                </span>
              </dt>
              <dd className="num text-lg">{fmtEntero(e.kcal)}</dd>
            </div>
          ))
        )}
      </dl>

      <p className="text-sm text-muted">
        Con {peso ? `${fmtKg(peso.kg)} kg (${peso.origen})` : 'tu peso'} y {alturaCm} cm.
      </p>

      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">Cómo se calcula</summary>
        <div className="space-y-2 text-muted">
          <p>
            <span className="font-semibold text-fg">Caminar.</span> La distancia sale de tus pasos y de la longitud del paso, que se estima
            como {String(FACTOR_PASO).replace('.', ',')} × tu altura. Según la ecuación del ACSM para caminar en llano, cada kilómetro
            cuesta unas {String(KCAL_POR_KG_Y_KM).replace('.', ',')} kcal por kilo de peso, sin contar lo que gastarías en reposo.
          </p>
          <p>
            <span className="font-semibold text-fg">Entreno.</span> El entrenamiento de fuerza va de {String(MET_MIN).replace('.', ',')} a{' '}
            {MET_MAX} MET (Compendium of Physical Activities). El valor se elige según lo densa que fue la sesión: series por minuto,
            tiempo entre series y kilos movidos por minuto. Calorías = (MET − 1) × peso × horas, de la entrada a la salida.
          </p>
          <p>Los pasos que das durante el entreno no se suman dos veces: ya están dentro del MET de la sesión.</p>
          <p>Es una estimación: puede desviarse un 20–30 % de lo que mediría un laboratorio.</p>
        </div>
      </details>
    </div>
  )
}
