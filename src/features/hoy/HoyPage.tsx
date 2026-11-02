import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'
import { Boton, Tarjeta } from '../../components/ui'
import { db } from '../../db/db'
import { iniciarSesion } from '../../db/entreno'
import { rutinaQueToca, rutinasDelCiclo } from '../../domain/ciclo'
import { useAhora } from '../../hooks/useAhora'
import { fmtCrono, fmtFechaLarga } from '../../lib/formato'
import { ElegirRutina } from './ElegirRutina'

export function HoyPage() {
  const navegar = useNavigate()
  const ahora = useAhora(1000)
  const [eligiendo, setEligiendo] = useState(false)
  const datos = useLiveQuery(async () => {
    const [rutinas, sesiones] = await Promise.all([db.rutinas.toArray(), db.sesiones.toArray()])
    return {
      hayRutinas: rutinasDelCiclo(rutinas).length > 0,
      toca: rutinaQueToca(rutinas, sesiones),
      enCurso: sesiones.find((s) => s.estado === 'en_curso') ?? null,
    }
  }, [])

  return (
    <>
      <Cabecera titulo="Hoy" subtitulo={<span className="capitalize">{fmtFechaLarga(ahora)}</span>} />

      {datos?.enCurso ? (
        <Tarjeta className="mt-4 border-accent">
          <p className="text-sm font-semibold text-accent">Entreno en curso</p>
          <p className="condensada mt-1 text-3xl font-extrabold">{datos.enCurso.rutinaNombre}</p>
          <p className="num mt-1 text-muted">{fmtCrono((ahora - datos.enCurso.entrada) / 1000)}</p>
          <Boton variante="primario" grande className="mt-4 w-full" onClick={() => navegar('/entreno')}>
            <Icono nombre="play" /> Retomar entreno
          </Boton>
        </Tarjeta>
      ) : datos?.toca ? (
        <Tarjeta className="mt-4">
          <p className="text-sm font-semibold text-muted">Hoy toca</p>
          <p className="condensada mt-1 text-4xl leading-tight font-extrabold tracking-tight">{datos.toca.nombre}</p>
          <Boton
            variante="primario"
            grande
            className="mt-4 w-full"
            onClick={async () => {
              await iniciarSesion(datos.toca!.id)
              navegar('/entreno')
            }}
          >
            <Icono nombre="play" /> Empezar
          </Boton>
          <Boton variante="fantasma" className="mt-1 w-full text-muted" onClick={() => setEligiendo(true)}>
            Elegir otra rutina
          </Boton>
        </Tarjeta>
      ) : (
        datos && (
          <Tarjeta className="mt-4">
            <p className="condensada text-2xl font-bold">Prepara tu ciclo</p>
            <p className="mt-1 text-muted">Crea tus rutinas o usa una plantilla. Ferro sabrá cuál te toca cada día.</p>
            <Link
              to="/rutinas"
              className="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-accent font-bold text-accent-ink"
            >
              Crear rutinas
            </Link>
            <Boton variante="fantasma" className="mt-1 w-full text-muted" onClick={() => setEligiendo(true)}>
              Entreno libre
            </Boton>
          </Tarjeta>
        )
      )}

      <ElegirRutina abierta={eligiendo} onCerrar={() => setEligiendo(false)} tocaId={datos?.toca?.id ?? null} />
    </>
  )
}
