import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { GraficaAsistencia, GraficaMusculos, GraficaPeso } from '../../components/graficas'
import { Icono } from '../../components/Icono'
import { Segmentado, Tarjeta, Vacio } from '../../components/ui'
import { aSerieHecha, sesionesTerminadas } from '../../db/consultas'
import { db } from '../../db/db'
import { asistenciaPorSemana, duracionMedia, FRANJA_SERIES, mapaCalor, mediaMovil, seriesPorMusculo } from '../../domain/estadisticas'
import { NOMBRE_MUSCULO } from '../../domain/etiquetas'
import { recordsPersonales } from '../../domain/marcas'
import { inicioSemana, sumarDias } from '../../domain/semanas'
import { MUSCULOS, type Ejercicio, type Entrada, type PesoCorporal, type Serie, type Sesion } from '../../domain/tipos'
import { useAjustes } from '../../hooks/useAjustes'
import { fmtDuracion, fmtFechaCorta, fmtHace, fmtKg } from '../../lib/formato'
import { MapaCalor } from './MapaCalor'

type Vista = 'general' | 'ejercicios' | 'peso'

export function ProgresoPage() {
  const ajustes = useAjustes()
  const [params, setParams] = useSearchParams()
  const vista = (params.get('ver') as Vista | null) ?? 'general'
  const [semanaAtras, setSemanaAtras] = useState(0)

  const datos = useLiveQuery(async (): Promise<Datos> => {
    const [sesiones, entradas, series, ejercicios, pesos] = await Promise.all([
      sesionesTerminadas(),
      db.entradas.toArray(),
      db.series.filter((s) => s.completada).toArray(),
      db.ejercicios.toArray(),
      db.pesosCorporales.toArray(),
    ])
    const terminadas = new Set(sesiones.map((s) => s.id))
    return { sesiones, entradas, series: series.filter((s) => terminadas.has(s.sesionId)), ejercicios, pesos }
  }, [])

  const ahora = Date.now()

  return (
    <>
      <Cabecera
        titulo="Progreso"
        accion={
          <Link
            to="/progreso/historial"
            aria-label="Historial de entrenos"
            className="grid size-12 place-items-center rounded-full active:bg-surface-2"
          >
            <Icono nombre="historial" />
          </Link>
        }
      />
      <div className="mt-2 mb-4">
        <Segmentado<Vista>
          etiqueta="Sección"
          valor={vista}
          onCambio={(v) => setParams(v === 'general' ? {} : { ver: v }, { replace: true })}
          opciones={[
            { valor: 'general', texto: 'General' },
            { valor: 'ejercicios', texto: 'Ejercicios' },
            { valor: 'peso', texto: 'Peso' },
          ]}
        />
      </div>

      {datos && vista === 'general' && <General datos={datos} ahora={ahora} objetivo={ajustes.objetivoSemanal} semanaAtras={semanaAtras} setSemanaAtras={setSemanaAtras} />}
      {datos && vista === 'ejercicios' && <Ejercicios datos={datos} ahora={ahora} />}
      {datos && vista === 'peso' && <Peso pesos={datos.pesos} />}
    </>
  )
}

interface Datos {
  sesiones: Sesion[]
  entradas: Entrada[]
  series: Serie[]
  ejercicios: Ejercicio[]
  pesos: PesoCorporal[]
}

function General({
  datos,
  ahora,
  objetivo,
  semanaAtras,
  setSemanaAtras,
}: {
  datos: Datos
  ahora: number
  objetivo: number
  semanaAtras: number
  setSemanaAtras: (n: number) => void
}) {
  if (datos.sesiones.length === 0 && datos.entradas.length === 0)
    return <Vacio titulo="Todavía no hay datos">Termina tu primer entreno y aquí verás tu asistencia y tus series por músculo.</Vacio>

  const horasEntreno = datos.sesiones.map((s) => s.entrada)
  const semanas = asistenciaPorSemana(horasEntreno, ahora, 12)
  const completas = semanas.slice(0, -1).filter((s) => s.inicio >= inicioSemana(Math.min(...horasEntreno, ahora)))
  const mediaDias = completas.length ? completas.reduce((t, s) => t + s.dias, 0) / completas.length : null
  const media = duracionMedia(datos.sesiones.slice(0, 20))

  const inicio = inicioSemana(sumarDias(ahora, -7 * semanaAtras))
  const fin = sumarDias(inicio, 7)
  const sesionesSemana = new Set(datos.sesiones.filter((s) => s.entrada >= inicio && s.entrada < fin).map((s) => s.id))
  const fichas = new Map(datos.ejercicios.map((e) => [e.id, e]))
  const porMusculo = seriesPorMusculo(
    datos.series.filter((s) => sesionesSemana.has(s.sesionId)),
    fichas,
  )
  const filas = MUSCULOS.filter((m) => (porMusculo.get(m) ?? 0) > 0)
    .map((musculo) => ({ musculo, series: porMusculo.get(musculo) ?? 0 }))
    .sort((a, b) => b.series - a.series)

  return (
    <div className="space-y-3">
      <Tarjeta>
        <h2 className="mb-3 font-bold">Asistencia</h2>
        <MapaCalor semanas={mapaCalor(datos.entradas.map((e) => e.hora), horasEntreno, ahora, 18)} />
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
          <Mini etiqueta="Entrenos" valor={String(datos.sesiones.length)} />
          <Mini etiqueta="Días/semana" valor={mediaDias === null ? '—' : fmtKg(Math.round(mediaDias * 10) / 10)} />
          <Mini etiqueta="Duración media" valor={media === null ? '—' : fmtDuracion(media)} />
        </dl>
      </Tarjeta>

      <Tarjeta>
        <h2 className="font-bold">Días por semana</h2>
        <p className="mb-2 text-xs text-muted">Últimas 12 semanas · la línea es tu objetivo ({objetivo})</p>
        <GraficaAsistencia semanas={semanas} objetivo={objetivo} />
      </Tarjeta>

      <Tarjeta>
        <h2 className="font-bold">Series por músculo</h2>
        <div className="-mx-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => setSemanaAtras(semanaAtras + 1)}
            className="grid size-11 place-items-center rounded-full active:bg-surface-2"
          >
            <Icono nombre="atras" tamano={20} />
          </button>
          <span className="text-sm font-medium">{semanaAtras === 0 ? 'Esta semana' : `Semana del ${fmtFechaCorta(inicio)}`}</span>
          <button
            type="button"
            aria-label="Semana siguiente"
            disabled={semanaAtras === 0}
            onClick={() => setSemanaAtras(semanaAtras - 1)}
            className="grid size-11 place-items-center rounded-full active:bg-surface-2 disabled:opacity-30"
          >
            <Icono nombre="adelante" tamano={20} />
          </button>
        </div>
        <p className="mb-2 text-xs text-muted">
          Principal cuenta 1, secundario 0,5. Franja de referencia: {FRANJA_SERIES.min}–{FRANJA_SERIES.max} series.
        </p>
        {filas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Sin series esta semana.</p>
        ) : (
          <>
            <GraficaMusculos datos={filas} />
            <details className="mt-2 text-sm">
              <summary className="min-h-10 cursor-pointer py-2 text-muted">Ver como tabla</summary>
              <table className="w-full">
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.musculo} className="border-t border-line">
                      <td className="py-1.5">{NOMBRE_MUSCULO[f.musculo]}</td>
                      <td className="num py-1.5 text-right">{fmtKg(f.series)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </Tarjeta>
    </div>
  )
}

function Ejercicios({ datos, ahora }: { datos: Datos; ahora: number }) {
  if (datos.series.length === 0) return <Vacio titulo="Sin ejercicios registrados">Tus récords y progresos aparecerán aquí.</Vacio>
  const nombres = new Map(datos.ejercicios.map((e) => [e.id, e.nombre]))
  const records = recordsPersonales(datos.series.map(aSerieHecha))
  const ultimo = new Map<string, number>()
  const sesionesPorEj = new Map<string, Set<string>>()
  for (const s of datos.series) {
    ultimo.set(s.ejercicioId, Math.max(ultimo.get(s.ejercicioId) ?? 0, s.hora ?? 0))
    sesionesPorEj.set(s.ejercicioId, (sesionesPorEj.get(s.ejercicioId) ?? new Set()).add(s.sesionId))
  }

  return (
    <div className="space-y-3">
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-bold">
          <Icono nombre="trofeo" tamano={20} className="text-accent" /> Récords personales
        </h2>
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {records.map((r) => (
            <li key={r.ejercicioId}>
              <Link to={`/rutinas/ejercicios/${r.ejercicioId}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{nombres.get(r.ejercicioId)}</span>
                  <span className="block text-sm text-muted">
                    Mejor serie <span className="num text-fg">{fmtKg(r.marcas.mejorSerie!.peso)}×{r.marcas.mejorSerie!.reps}</span> ·{' '}
                    {fmtHace(r.fecha, ahora)} · {sesionesPorEj.get(r.ejercicioId)?.size ?? 0} sesiones
                  </span>
                </span>
                <span className="text-right">
                  <span className="num block text-xl text-accent">{fmtKg(Math.round(r.marcas.e1rm * 10) / 10)}</span>
                  <span className="text-xs text-muted">1RM est.</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Peso({ pesos }: { pesos: Datos['pesos'] }) {
  const puntos = mediaMovil(pesos)
  const ultimo = puntos.at(-1)
  return (
    <div className="space-y-3">
      <Link
        to="/peso"
        className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-bold text-accent-ink"
      >
        <Icono nombre="bascula" /> Registrar peso
      </Link>
      {puntos.length === 0 ? (
        <Vacio titulo="Sin registros">El peso corporal es opcional. Regístralo cuando quieras y verás su media de 7 días.</Vacio>
      ) : (
        <Tarjeta>
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Peso corporal</h2>
            {ultimo && (
              <p className="num text-2xl">
                {fmtKg(ultimo.media)}
                <span className="ml-1 text-sm font-medium text-muted">kg media</span>
              </p>
            )}
          </div>
          <div className="mt-2">
            <GraficaPeso puntos={puntos} />
          </div>
        </Tarjeta>
      )}
    </div>
  )
}

function Mini({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className="num text-xl">{valor}</dd>
    </div>
  )
}
