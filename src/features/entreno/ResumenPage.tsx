import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router'
import { Icono } from '../../components/Icono'
import { Tarjeta, Vacio } from '../../components/ui'
import { datosResumen } from '../../db/consultas'
import { compararSesiones } from '../../domain/resumen'
import { ESCALAS, nivelesDeTrabajo, rotulosEscala } from '../../domain/mapaMuscular'
import { MapaConDetalle } from '../../components/mapa/MapaConDetalle'
import { agrupar, type TipoRecord } from '../../domain/marcas'
import { fmtDuracion, fmtEntero, fmtKg } from '../../lib/formato'

const NOMBRE_RECORD: Record<TipoRecord, string> = {
  peso: 'Peso',
  e1rm: '1RM est.',
  volumen: 'Volumen',
}

export function ResumenPage() {
  const { id = '' } = useParams()
  const datos = useLiveQuery(() => datosResumen(id), [id])

  if (datos === undefined) return null
  if (datos === null)
    return (
      <div className="mx-auto max-w-lg px-safe pt-safe">
        <div className="mt-10">
          <Vacio titulo="Entreno no encontrado" />
        </div>
      </div>
    )

  const { sesion, resumen, records, anterior, nombres, trabajo } = datos
  const cmp = anterior ? compararSesiones(resumen, anterior) : null

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-safe pt-safe pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="anim-aparecer pt-10 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-accent text-accent-ink">
          <Icono nombre="check" tamano={34} grosor={3} />
        </div>
        <h1 className="condensada mt-4 text-4xl font-extrabold tracking-tight">¡Entreno hecho!</h1>
        <p className="mt-1 text-muted">{sesion.rutinaNombre}</p>
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-2">
        <Dato etiqueta="Duración" valor={fmtDuracion(resumen.duracionMs)} />
        <Dato etiqueta="Series" valor={String(resumen.series)} />
        <Dato etiqueta="Volumen" valor={`${fmtEntero(resumen.volumen)} kg`} />
      </dl>

      {cmp && (
        <Tarjeta className="mt-4">
          <h2 className="mb-2 font-bold">Frente a la última vez</h2>
          <ul className="space-y-1.5 text-sm">
            <Delta etiqueta="Volumen" valor={cmp.volumen} texto={`${cmp.volumen >= 0 ? '+' : '−'}${fmtEntero(Math.abs(cmp.volumen))} kg${cmp.volumenPct !== null ? ` (${cmp.volumenPct >= 0 ? '+' : '−'}${Math.abs(cmp.volumenPct).toFixed(0)} %)` : ''}`} />
            <Delta etiqueta="Series" valor={cmp.series} texto={`${cmp.series >= 0 ? '+' : '−'}${Math.abs(cmp.series)}`} />
            <Delta
              etiqueta="Duración"
              valor={-cmp.duracionMs}
              neutro
              texto={`${cmp.duracionMs >= 0 ? '+' : '−'}${fmtDuracion(Math.abs(cmp.duracionMs))}`}
            />
          </ul>
        </Tarjeta>
      )}

      <Tarjeta className="mt-4">
        <h2 className="mb-1 font-bold">Músculos trabajados</h2>
        <MapaConDetalle
          trabajo={trabajo}
          niveles={nivelesDeTrabajo(trabajo, ESCALAS.sesion)}
          nombres={nombres}
          rotulos={rotulosEscala(ESCALAS.sesion)}
          unidad="series"
          periodo="en esta sesión"
          alto="h-72"
        />
      </Tarjeta>

      <Tarjeta className="mt-4">
        <h2 className="mb-2 flex items-center gap-2 font-bold">
          <Icono nombre="trofeo" tamano={20} className="text-accent" /> Récords
        </h2>
        {records.length === 0 ? (
          <p className="text-sm text-muted">Hoy no ha caído ningún récord. Sumar series también es progresar.</p>
        ) : (
          <ul className="space-y-3">
            {[...agrupar(records, (r) => r.ejercicioId)].map(([ejercicioId, lista]) => (
              <li key={ejercicioId}>
                <p className="truncate font-semibold">{nombres.get(ejercicioId)}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {lista.map((r) => (
                    <span key={r.tipo} className="text-sm text-muted">
                      {NOMBRE_RECORD[r.tipo]}{' '}
                      <span className="num text-lg text-accent">
                        {r.tipo === 'volumen' ? fmtEntero(r.valor) : fmtKg(Math.round(r.valor * 10) / 10)} kg
                      </span>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <div className="mt-6 grid gap-2">
        <Link to="/" replace className="flex min-h-16 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-accent-ink">
          Volver a Hoy
        </Link>
        <Link
          to={`/rutinas/nueva?desde=${sesion.id}`}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold active:brightness-110"
        >
          <Icono nombre="copiar" tamano={20} /> Guardar como rutina
        </Link>
        <Link
          to={`/progreso/historial/${sesion.id}`}
          className="flex min-h-12 items-center justify-center rounded-2xl font-semibold text-muted active:bg-surface-2"
        >
          Ver detalle del entreno
        </Link>
      </div>
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3 text-center">
      <dt className="text-xs font-medium text-muted">{etiqueta}</dt>
      <dd className="num mt-1 text-xl leading-tight">{valor}</dd>
    </div>
  )
}

function Delta({ etiqueta, valor, texto, neutro }: { etiqueta: string; valor: number; texto: string; neutro?: boolean }) {
  const color = neutro || valor === 0 ? 'text-fg' : valor > 0 ? 'text-ok' : 'text-danger'
  return (
    <li className="flex justify-between">
      <span className="text-muted">{etiqueta}</span>
      <span className={`num ${color}`}>{texto}</span>
    </li>
  )
}
