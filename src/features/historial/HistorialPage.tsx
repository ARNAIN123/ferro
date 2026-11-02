import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'
import { Vacio } from '../../components/ui'
import { db } from '../../db/db'
import { sesionesTerminadas } from '../../db/consultas'
import { resumirSesion } from '../../domain/resumen'
import { fmtDuracion, fmtEntero, fmtHora } from '../../lib/formato'

export function HistorialPage() {
  const datos = useLiveQuery(async () => {
    const [sesiones, series, molestias] = await Promise.all([sesionesTerminadas(), db.series.toArray(), db.molestias.toArray()])
    const conMolestia = new Set(molestias.map((m) => m.sesionId))
    return sesiones.map((sesion) => ({
      sesion,
      resumen: resumirSesion(
        sesion,
        series.filter((s) => s.sesionId === sesion.id),
      ),
      molestia: conMolestia.has(sesion.id),
    }))
  }, [])

  const porMes = new Map<string, NonNullable<typeof datos>>()
  for (const d of datos ?? []) {
    const mes = new Date(d.sesion.entrada).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    porMes.set(mes, [...(porMes.get(mes) ?? []), d])
  }

  return (
    <>
      <Cabecera titulo="Historial" atras="/progreso" subtitulo={datos ? `${datos.length} entrenos` : undefined} />
      {datos && datos.length === 0 && (
        <div className="mt-4">
          <Vacio titulo="Sin entrenos todavía">Cuando termines tu primer entreno aparecerá aquí.</Vacio>
        </div>
      )}
      {[...porMes].map(([mes, lista]) => (
        <section key={mes} className="mt-5">
          <h2 className="mb-2 text-sm font-semibold text-muted capitalize">{mes}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {lista.map(({ sesion, resumen, molestia }) => {
              const d = new Date(sesion.entrada)
              return (
                <li key={sesion.id}>
                  <Link to={`/progreso/historial/${sesion.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-surface-2">
                    <span className="w-10 shrink-0 text-center">
                      <span className="num block text-2xl leading-none">{d.getDate()}</span>
                      <span className="text-xs text-muted">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="truncate">{sesion.rutinaNombre}</span>
                        {molestia && <Icono nombre="aviso" tamano={16} className="shrink-0 text-warn" />}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {fmtHora(sesion.entrada)} · {fmtDuracion(resumen.duracionMs)} · {resumen.series} series ·{' '}
                        {fmtEntero(resumen.volumen)} kg
                      </span>
                    </span>
                    <Icono nombre="adelante" tamano={18} className="shrink-0 text-muted" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
