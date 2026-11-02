import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'
import { Boton, Etiqueta, Tarjeta, Vacio } from '../../components/ui'
import { detalleSesion } from '../../db/consultas'
import { borrarSesion } from '../../db/entreno'
import { NOMBRE_ORIGEN } from '../../domain/etiquetas'
import { fmtDuracion, fmtEntero, fmtFechaLarga, fmtHora, fmtKg } from '../../lib/formato'

export function SesionPage() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const datos = useLiveQuery(() => detalleSesion(id), [id])

  if (datos === undefined) return <Cabecera titulo="" atras />
  if (datos === null)
    return (
      <>
        <Cabecera titulo="Entreno" atras="/progreso/historial" />
        <Vacio titulo="Este entreno no existe" />
      </>
    )

  const { sesion, bloques, resumen } = datos
  return (
    <>
      <Cabecera titulo={sesion.rutinaNombre} subtitulo={<span className="capitalize">{fmtFechaLarga(sesion.entrada)}</span>} atras />

      <div className="mt-3 flex flex-wrap gap-2">
        <Etiqueta>
          {fmtHora(sesion.entrada)}–{sesion.salida ? fmtHora(sesion.salida) : '…'}
        </Etiqueta>
        <Etiqueta>{fmtDuracion(resumen.duracionMs)}</Etiqueta>
        <Etiqueta>{resumen.series} series</Etiqueta>
        <Etiqueta>{fmtEntero(resumen.volumen)} kg</Etiqueta>
        <Etiqueta>Entrada: {NOMBRE_ORIGEN[sesion.origenEntrada].toLowerCase()}</Etiqueta>
        {sesion.cierreAutomatico && <Etiqueta>Cierre automático</Etiqueta>}
      </div>

      <div className="mt-4 space-y-3">
        {bloques.map(({ se, ejercicio, series, molestia }) => (
          <Tarjeta key={se.id}>
            <Link to={`/rutinas/ejercicios/${se.ejercicioId}`} className="flex items-center gap-2 font-bold">
              <span className="min-w-0 flex-1 truncate">{ejercicio?.nombre ?? 'Ejercicio'}</span>
              <Icono nombre="adelante" tamano={18} className="text-muted" />
            </Link>
            {molestia && (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-warn">
                <Icono nombre="aviso" tamano={16} /> Molestia{molestia.nota && `: ${molestia.nota}`}
              </p>
            )}
            {se.estado === 'saltado' && series.length === 0 && <p className="mt-1 text-sm text-muted">Saltado</p>}
            <ol className="mt-2 space-y-1">
              {series.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="num w-5 text-muted">
                    {s.tipo === 'calentamiento' ? 'C' : s.tipo === 'drop' ? 'D' : series.slice(0, i + 1).filter((x) => x.tipo === 'normal').length}
                  </span>
                  <span className="num text-lg">
                    {fmtKg(s.peso)} <span className="text-sm font-normal text-muted">kg ×</span> {s.reps}
                  </span>
                  {s.rir !== null && <span className="text-muted">RIR {s.rir}</span>}
                </li>
              ))}
            </ol>
          </Tarjeta>
        ))}
      </div>

      <Boton
        variante="peligro"
        className="mt-6 w-full"
        onClick={async () => {
          if (!confirm('¿Borrar este entreno? No se puede deshacer.')) return
          await borrarSesion(sesion.id)
          navegar('/progreso/historial', { replace: true })
        }}
      >
        <Icono nombre="papelera" tamano={20} /> Borrar entreno
      </Boton>
    </>
  )
}
