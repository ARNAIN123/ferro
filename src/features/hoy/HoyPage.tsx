import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'
import { Boton, Tarjeta } from '../../components/ui'
import { registrarEntrada } from '../../db/checkin'
import { db } from '../../db/db'
import { iniciarSesion } from '../../db/entreno'
import { rutinaQueToca, rutinasDelCiclo } from '../../domain/ciclo'
import { entradaReciente } from '../../domain/checkin'
import { NOMBRE_ORIGEN } from '../../domain/etiquetas'
import { resumirSesion } from '../../domain/resumen'
import { claveDia, diasDeSemana, diasEntrenadosEnSemana, inicioDia, rachaSemanas } from '../../domain/semanas'
import { useAhora } from '../../hooks/useAhora'
import { useAjustes } from '../../hooks/useAjustes'
import { avisar } from '../../lib/avisos'
import { fmtCrono, fmtDuracion, fmtEntero, fmtFechaLarga, fmtHace, fmtHora } from '../../lib/formato'
import { vibrar, VIBRACION_SERIE } from '../../lib/vibrar'
import { ElegirRutina } from './ElegirRutina'

const INICIALES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function HoyPage() {
  const navegar = useNavigate()
  const ahora = useAhora(1000)
  const ajustes = useAjustes()
  const [eligiendo, setEligiendo] = useState(false)
  const hoy = claveDia(ahora)

  const datos = useLiveQuery(async () => {
    const [rutinas, sesiones, entradas] = await Promise.all([
      db.rutinas.toArray(),
      db.sesiones.toArray(),
      db.entradas.where('hora').above(Date.now() - 24 * 3600_000).toArray(),
    ])
    const terminadas = sesiones.filter((s) => s.estado === 'terminada').sort((a, b) => b.entrada - a.entrada)
    const ultima = terminadas[0]
    return {
      hayRutinas: rutinasDelCiclo(rutinas).length > 0,
      toca: rutinaQueToca(rutinas, sesiones),
      enCurso: sesiones.find((s) => s.estado === 'en_curso') ?? null,
      terminadas,
      entradas,
      ultima: ultima
        ? { sesion: ultima, resumen: resumirSesion(ultima, await db.series.where('sesionId').equals(ultima.id).toArray()) }
        : null,
    }
  }, [])

  if (!datos) return <Cabecera titulo="Hoy" />

  const horas = datos.terminadas.map((s) => s.entrada)
  const entrenadoHoy = datos.terminadas.find((s) => claveDia(s.entrada) === hoy)
  const diasSemana = diasEntrenadosEnSemana(horas, ahora)
  const racha = rachaSemanas(horas, ajustes.objetivoSemanal, ahora)
  const diasConEntreno = new Set(horas.map(claveDia))
  const entrada = entradaReciente(datos.entradas, ahora, ajustes.horasEntreCheckins)

  const llegar = async () => {
    const r = await registrarEntrada('manual')
    vibrar(VIBRACION_SERIE, ajustes.vibracion)
    if (!r.registrada) avisar(`Ya estaba registrada a las ${fmtHora(r.entrada.hora)}`)
  }

  const empezar = async (rutinaId: string) => {
    await iniciarSesion(rutinaId)
    navegar('/entreno')
  }

  return (
    <>
      <Cabecera titulo="Hoy" subtitulo={fmtFechaLarga(ahora)} />

      {/* Llegada al gimnasio */}
      <div className="mt-2">
        {entrada ? (
          <p className="flex min-h-12 items-center gap-2 text-sm">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2.5 rounded-full bg-ok" />
            </span>
            <span>
              En el gimnasio desde las <span className="num font-bold">{fmtHora(entrada.hora)}</span>
              <span className="text-muted"> · {NOMBRE_ORIGEN[entrada.origen].toLowerCase()}</span>
            </span>
          </p>
        ) : (
          <button
            type="button"
            onClick={llegar}
            className="flex min-h-12 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold active:bg-surface"
          >
            <Icono nombre="ubicacion" tamano={18} className="text-accent" /> He llegado al gimnasio
          </button>
        )}
      </div>

      {/* Qué toca */}
      {datos.enCurso ? (
        <Tarjeta className="mt-3 border-accent">
          <p className="text-sm font-semibold text-accent">Entreno en curso</p>
          <p className="condensada mt-1 text-3xl font-extrabold">{datos.enCurso.rutinaNombre}</p>
          <p className="num mt-1 text-muted">{fmtCrono((ahora - datos.enCurso.entrada) / 1000)}</p>
          <Boton variante="primario" grande className="mt-4 w-full" onClick={() => navegar('/entreno')}>
            <Icono nombre="play" /> Retomar entreno
          </Boton>
        </Tarjeta>
      ) : entrenadoHoy ? (
        <Tarjeta className="mt-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-ok">
            <Icono nombre="check" tamano={18} grosor={3} /> Entreno de hoy hecho
          </p>
          <p className="condensada mt-1 text-3xl font-extrabold">{entrenadoHoy.rutinaNombre}</p>
          {datos.toca && <p className="mt-1 text-muted">La próxima vez toca {datos.toca.nombre}.</p>}
          <Boton variante="fantasma" className="mt-2 w-full text-muted" onClick={() => setEligiendo(true)}>
            Entrenar otra vez
          </Boton>
        </Tarjeta>
      ) : datos.toca ? (
        <Tarjeta className="mt-3">
          <p className="text-sm font-semibold text-muted">Hoy toca</p>
          <p className="condensada mt-1 text-[2.6rem] leading-[1.05] font-extrabold tracking-tight">{datos.toca.nombre}</p>
          <Boton variante="primario" grande className="mt-4 w-full" onClick={() => empezar(datos.toca!.id)}>
            <Icono nombre="play" /> Empezar
          </Boton>
          <Boton variante="fantasma" className="mt-1 w-full text-muted" onClick={() => setEligiendo(true)}>
            Elegir otra rutina
          </Boton>
        </Tarjeta>
      ) : (
        <Tarjeta className="mt-3">
          <p className="condensada text-2xl font-bold">Prepara tu ciclo</p>
          <p className="mt-1 text-muted">Crea tus rutinas o usa una plantilla. Ferro sabrá cuál te toca cada día.</p>
          <Link to="/rutinas" className="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-accent font-bold text-accent-ink">
            Crear rutinas
          </Link>
          <Boton variante="fantasma" className="mt-1 w-full text-muted" onClick={() => setEligiendo(true)}>
            Entreno libre
          </Boton>
        </Tarjeta>
      )}

      {/* Semana */}
      <Tarjeta className="mt-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">Esta semana</h2>
          <p className="num text-2xl">
            <span className={diasSemana >= ajustes.objetivoSemanal ? 'text-accent' : ''}>{diasSemana}</span>
            <span className="text-muted">/{ajustes.objetivoSemanal}</span>
          </p>
        </div>
        <ol className="mt-3 grid grid-cols-7 gap-1.5" aria-label="Días de la semana">
          {diasDeSemana(ahora).map((d, i) => {
            const hecho = diasConEntreno.has(claveDia(d))
            const esHoy = d === inicioDia(ahora)
            return (
              <li key={d} className="flex flex-col items-center gap-1">
                <span
                  className={`grid aspect-square w-full max-w-10 place-items-center rounded-xl text-sm font-bold ${
                    hecho ? 'bg-accent text-accent-ink' : esHoy ? 'border-2 border-accent/60 text-fg' : 'bg-surface-2 text-muted'
                  }`}
                  aria-label={`${INICIALES[i]}${hecho ? ', entrenado' : ''}${esHoy ? ', hoy' : ''}`}
                >
                  {hecho ? <Icono nombre="check" tamano={16} grosor={3} /> : INICIALES[i]}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="mt-3 flex items-center gap-2 text-sm">
          <Icono nombre="llama" tamano={18} className={racha > 0 ? 'text-accent' : 'text-muted'} />
          {racha > 0 ? (
            <span>
              <span className="num font-bold">{racha}</span> {racha === 1 ? 'semana' : 'semanas'} seguidas cumpliendo tu objetivo
            </span>
          ) : (
            <span className="text-muted">Cumple {ajustes.objetivoSemanal} días esta semana para empezar una racha.</span>
          )}
        </p>
      </Tarjeta>

      {/* Último entreno */}
      {datos.ultima && (
        <Link
          to={`/progreso/historial/${datos.ultima.sesion.id}`}
          className="mt-3 block rounded-3xl border border-line bg-surface p-4 active:bg-surface-2"
        >
          <p className="flex items-center justify-between text-sm text-muted">
            <span>Último entreno · {fmtHace(datos.ultima.sesion.entrada, ahora)}</span>
            <Icono nombre="adelante" tamano={18} />
          </p>
          <p className="condensada mt-1 text-xl font-bold">{datos.ultima.sesion.rutinaNombre}</p>
          <dl className="mt-2 grid grid-cols-3 gap-2">
            <Mini etiqueta="Duración" valor={fmtDuracion(datos.ultima.resumen.duracionMs)} />
            <Mini etiqueta="Series" valor={String(datos.ultima.resumen.series)} />
            <Mini etiqueta="Volumen" valor={`${fmtEntero(datos.ultima.resumen.volumen)} kg`} />
          </dl>
        </Link>
      )}

      <ElegirRutina abierta={eligiendo} onCerrar={() => setEligiendo(false)} tocaId={datos.toca?.id ?? null} />
    </>
  )
}

function Mini({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className="num text-lg">{valor}</dd>
    </div>
  )
}
