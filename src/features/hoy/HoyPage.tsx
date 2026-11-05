import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'
import { MapaConDetalle } from '../../components/mapa/MapaConDetalle'
import { Boton, Tarjeta } from '../../components/ui'
import { db } from '../../db/db'
import { iniciarSesion } from '../../db/entreno'
import { ESCALA_SEMANA_AVATAR } from '../../domain/avatar'
import { caloriasDelDia, densidadSesion, type DensidadSesion } from '../../domain/calorias'
import { rutinaQueToca } from '../../domain/ciclo'
import { entradaReciente } from '../../domain/checkin'
import { necesitaCopia } from '../../domain/copias'
import { NOMBRE_ORIGEN } from '../../domain/etiquetas'
import { nivelesDeTrabajo, rotulosEscala, trabajoMuscular } from '../../domain/mapaMuscular'
import { diasQueCuentan, estadoMes, inicioMes } from '../../domain/objetivoMensual'
import { claveDia, etiquetaSemana, inicioSemana } from '../../domain/semanas'
import { useAhora } from '../../hooks/useAhora'
import { useAjustes } from '../../hooks/useAjustes'
import { usePasosHoy } from '../../hooks/usePasosHoy'
import { fmtCrono, fmtFechaLarga, fmtHace, fmtHora } from '../../lib/formato'
import { ElegirRutina } from './ElegirRutina'
import { ObjetivoMes } from './ObjetivoMes'
import { PasosYCalorias } from './PasosYCalorias'

/**
 * Pantalla principal, en este orden: objetivo mensual, avatar de la semana, pasos y calorías,
 * y los botones para empezar.
 */
export function HoyPage() {
  const navegar = useNavigate()
  const ahora = useAhora(1000)
  const ajustes = useAjustes()
  const [eligiendo, setEligiendo] = useState(false)
  const hoy = claveDia(ahora)
  const lunes = inicioSemana(ahora)

  const datos = useLiveQuery(async () => {
    const t = Date.now()
    const desde = Math.min(inicioMes(t), inicioSemana(t), t - 24 * 3600_000)
    const [rutinas, sesiones, entradas, ultimoPeso] = await Promise.all([
      db.rutinas.toArray(),
      db.sesiones.toArray(),
      db.entradas.where('hora').aboveOrEqual(desde).toArray(),
      db.pesosCorporales.orderBy('fecha').last(),
    ])
    // Series de esta semana (avatar) y de hoy (calorías), también las del entreno en curso.
    const recientes = sesiones.filter((s) => s.entrada >= inicioSemana(t))
    const series = recientes.length
      ? (await db.series.where('sesionId').anyOf(recientes.map((s) => s.id)).toArray()).filter((s) => s.completada)
      : []
    const ejercicios = await db.ejercicios.bulkGet([...new Set(series.map((s) => s.ejercicioId))])
    const terminadas = sesiones.filter((s) => s.estado === 'terminada')
    return {
      toca: rutinaQueToca(rutinas, sesiones),
      enCurso: sesiones.find((s) => s.estado === 'en_curso') ?? null,
      primeraActividad: terminadas.reduce<number | null>((m, s) => (m === null || s.entrada < m ? s.entrada : m), null),
      terminadas,
      recientes,
      entradas,
      series,
      ejercicios: ejercicios.filter((e) => e !== undefined),
      ultimoPeso: ultimoPeso ?? null,
    }
  }, [])

  // Avatar de la semana (lunes a domingo): el músculo principal cuenta 1 serie y cada secundario 0,5.
  const semana = useMemo(() => {
    if (!datos) return null
    const deLaSemana = new Set(datos.recientes.filter((s) => s.entrada >= lunes).map((s) => s.id))
    const trabajo = trabajoMuscular(
      datos.series.filter((s) => deLaSemana.has(s.sesionId)),
      new Map(datos.ejercicios.map((e) => [e.id, e])),
    )
    return { trabajo, niveles: nivelesDeTrabajo(trabajo, ESCALA_SEMANA_AVATAR), nombres: new Map(datos.ejercicios.map((e) => [e.id, e.nombre])) }
  }, [datos, lunes])

  // Entrenos de hoy: sus tramos (para no sumar dos veces sus pasos) y su densidad (calorías).
  const deHoy = useMemo(() => (datos ? datos.recientes.filter((s) => claveDia(s.entrada) === hoy) : []), [datos, hoy])
  const tramos = useMemo(() => deHoy.map((s) => ({ desde: s.entrada, hasta: s.estado === 'terminada' ? s.salida : null })), [deHoy])
  const pasos = usePasosHoy(tramos)

  if (!datos || !semana) return <Cabecera titulo="Hoy" />

  const mes = estadoMes(
    diasQueCuentan(
      datos.entradas.map((e) => e.hora),
      datos.terminadas.map((s) => s.entrada),
    ),
    ajustes.objetivoMensual,
    ahora,
  )
  const entrenadoHoy = datos.terminadas.find((s) => claveDia(s.entrada) === hoy)
  const entrada = entradaReciente(datos.entradas, ahora, ajustes.horasEntreCheckins)

  const medidas = deHoy
    .map((s) => ({ nombre: s.rutinaNombre, d: densidadSesion(s.entrada, s.salida, datos.series.filter((x) => x.sesionId === s.id)) }))
    .filter((m): m is { nombre: string; d: DensidadSesion } => m.d !== null)
  const peso = datos.ultimoPeso
    ? { kg: datos.ultimoPeso.kg, origen: 'registro de Ferro' }
    : pasos.pesoSalud
      ? { kg: pasos.pesoSalud, origen: 'Health Connect' }
      : null
  const conPasos = pasos.situacion === 'ok'
  const calorias =
    peso && ajustes.alturaCm
      ? caloriasDelDia({
          pasos: conPasos ? (pasos.pasos ?? 0) : 0,
          pasosEnEntreno: conPasos ? pasos.pasosEnEntreno : 0,
          kg: peso.kg,
          alturaCm: ajustes.alturaCm,
          sesiones: medidas.map((m) => m.d),
        })
      : null

  const empezar = async (rutinaId: string | null) => {
    await iniciarSesion(rutinaId)
    navegar('/entreno')
  }

  return (
    <>
      <Cabecera titulo="Hoy" subtitulo={fmtFechaLarga(ahora)} />

      {/* Llegada al gimnasio: la registra la detección (S3 FIT ZONE) o el inicio del entreno. */}
      {entrada && (
        <p className="mt-1 flex min-h-11 items-center gap-2 text-sm">
          <span className="relative flex size-2.5">
            {!entrada.salida && <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:hidden" />}
            <span className={`relative inline-flex size-2.5 rounded-full ${entrada.salida ? 'bg-muted' : 'bg-ok'}`} />
          </span>
          {entrada.salida ? (
            <span>
              En el gimnasio de <span className="num font-bold">{fmtHora(entrada.hora)}</span> a{' '}
              <span className="num font-bold">{fmtHora(entrada.salida)}</span>
            </span>
          ) : (
            <span>
              En el gimnasio desde las <span className="num font-bold">{fmtHora(entrada.hora)}</span>
              <span className="text-muted"> · {NOMBRE_ORIGEN[entrada.origen]}</span>
            </span>
          )}
        </p>
      )}

      <div className="mt-2 space-y-3">
        <ObjetivoMes estado={mes} />

        <Tarjeta>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-bold">Tu semana</h2>
            <p className="text-xs text-muted">{etiquetaSemana(ahora)}</p>
          </div>
          <div className="mt-2">
            <MapaConDetalle
              trabajo={semana.trabajo}
              niveles={semana.niveles}
              nombres={semana.nombres}
              rotulos={rotulosEscala(ESCALA_SEMANA_AVATAR)}
              unidad="series"
              periodo="esta semana"
              alto="h-96"
            />
          </div>
        </Tarjeta>

        <PasosYCalorias
          pasos={pasos}
          objetivoPasos={ajustes.objetivoPasos}
          calorias={calorias}
          peso={peso}
          alturaCm={ajustes.alturaCm}
          nombresEntrenos={medidas.map((m) => m.nombre)}
        />

        {datos.enCurso ? (
          <Tarjeta className="border-accent">
            <p className="text-sm font-semibold text-accent">Entreno en curso</p>
            <p className="condensada mt-1 text-3xl font-extrabold">{datos.enCurso.rutinaNombre}</p>
            <p className="num mt-1 text-muted">{fmtCrono((ahora - datos.enCurso.entrada) / 1000)}</p>
            <Boton variante="primario" grande className="mt-4 w-full" onClick={() => navegar('/entreno')}>
              <Icono nombre="play" /> Retomar entreno
            </Boton>
          </Tarjeta>
        ) : datos.toca ? (
          <div>
            {entrenadoHoy && (
              <p className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-ok">
                <Icono nombre="check" tamano={18} grosor={3} /> Hoy ya has entrenado {entrenadoHoy.rutinaNombre}
              </p>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Boton variante={entrenadoHoy ? 'secundario' : 'primario'} grande className="min-w-0 px-4" onClick={() => empezar(datos.toca!.id)}>
                <Icono nombre="play" />
                <span className="truncate">Empezar {datos.toca.nombre}</span>
              </Boton>
              <Boton grande className="px-4" onClick={() => empezar(null)}>
                Entreno libre
              </Boton>
            </div>
            <Boton variante="fantasma" className="mt-1 w-full text-muted" onClick={() => setEligiendo(true)}>
              Elegir otra rutina
            </Boton>
          </div>
        ) : (
          <Tarjeta>
            <p className="condensada text-2xl font-bold">Prepara tu ciclo</p>
            <p className="mt-1 text-muted">Crea tus rutinas o usa una plantilla. Ferro sabrá cuál te toca cada día.</p>
            <Link to="/rutinas" className="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-accent font-bold text-accent-ink">
              Crear rutinas
            </Link>
            <Boton className="mt-2 w-full" onClick={() => empezar(null)}>
              Entreno libre
            </Boton>
          </Tarjeta>
        )}
      </div>

      {necesitaCopia(ajustes.ultimaCopia, datos.primeraActividad, ahora) && (
        <Link to="/ajustes#datos" className="mt-4 flex min-h-12 items-center gap-2 px-1 text-sm text-muted">
          <Icono nombre="descargar" tamano={18} />
          <span className="flex-1">
            {ajustes.ultimaCopia ? `Última copia de seguridad ${fmtHace(ajustes.ultimaCopia, ahora)}.` : 'Aún no has hecho ninguna copia de seguridad.'}{' '}
            <span className="font-semibold text-accent">Hacer copia</span>
          </span>
        </Link>
      )}

      <ElegirRutina abierta={eligiendo} onCerrar={() => setEligiendo(false)} tocaId={datos.toca?.id ?? null} />
    </>
  )
}
