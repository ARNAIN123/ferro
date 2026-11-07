import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'
import { Boton, Tarjeta } from '../../components/ui'
import { db } from '../../db/db'
import { actualizarPerfil, sumarAgua } from '../../db/nutricion'
import { lunesDe, recalibrarSiToca } from '../../db/recalibracion'
import { comeMuyPoco } from '../../domain/nutricion'
import { comidaPorHora, sumar } from '../../domain/registroComidas'
import { claveDia, sumarDias } from '../../domain/semanas'
import type { Comida } from '../../domain/tiposNutricion'
import { useAhora } from '../../hooks/useAhora'
import { useClaveIA } from '../../lib/claveIA'
import { fmtFechaLarga, fmtKg } from '../../lib/formato'
import { Asistente } from './Asistente'
import { ComidasDelDia } from './ComidasDelDia'
import { HojaAnadir } from './HojaAnadir'
import { HojaCerrarDia } from './HojaCerrarDia'
import { ResumenDia } from './ResumenDia'
import { RevisionSemanal } from './RevisionSemanal'
import { TarjetaReto } from './TarjetaReto'
import { useDiaNutricion } from './useDiaNutricion'

const masDias = (fecha: string, n: number) => claveDia(sumarDias(new Date(`${fecha}T12:00`).getTime(), n))

/** Nutrición: el día (lo que me queda, macros, comidas y agua) y, la primera vez, el asistente. */
export function NutricionPage() {
  const ahora = useAhora(60_000)
  const hoy = claveDia(ahora)
  const [fecha, setFecha] = useState(hoy)
  const [anadir, setAnadir] = useState<Comida | null>(null)
  const [cerrarDia, setCerrarDia] = useState(false)
  const conIA = useClaveIA() !== ''
  const dia = useDiaNutricion(fecha)
  const lunes = lunesDe(ahora)

  // Cada lunes (o la primera vez que abro la semana), recalcula el objetivo.
  useEffect(() => {
    void recalibrarSiToca().catch(() => null)
  }, [lunes])

  // ¿Llevo varios días comiendo muy por debajo del objetivo? (solo días ya terminados)
  const muyPoco = useLiveQuery(async () => {
    const perfil = await db.nutricion.get('perfil')
    if (!perfil) return false
    const desde = masDias(hoy, -7)
    const registros = await db.comidas.where('fecha').between(desde, masDias(hoy, -1), true, true).toArray()
    const dias = Array.from({ length: 7 }, (_, i) => masDias(hoy, -1 - i)).map((f) => {
      const del = registros.filter((r) => r.fecha === f)
      return { kcal: del.length ? sumar(del).kcal : null, objetivo: perfil.objetivoKcal }
    })
    return comeMuyPoco(dias)
  }, [hoy])

  if (dia === undefined) return null
  const { perfil } = dia

  if (!perfil) {
    return (
      <div className="pb-6">
        <Cabecera titulo="Nutrición" subtitulo="Un minuto para calcular tu objetivo" />
        <p className="mt-1 mb-3 text-sm text-muted">
          Con tus datos y tu actividad real (pasos y entrenos) calculo cuánto gastas y cuánto comer. Después se ajusta solo cada lunes con lo que comes y cómo cambia tu peso.
        </p>
        <Asistente />
      </div>
    )
  }

  const ajusteDeHoy = perfil.ajustes.find((a) => a.lunes === lunes)
  const verRevision = ajusteDeHoy && perfil.revisionVista !== lunes && dia.kg !== null
  const comidaAhora = fecha === hoy ? comidaPorHora(Date.now(), dia.entrena) : 'cena'
  const restante = dia.objetivo ? { kcal: dia.objetivo.kcal - dia.comido.kcal, proteina: dia.objetivo.proteina - dia.comido.proteina } : null
  const titulo = fecha === hoy ? 'Hoy' : fecha === masDias(hoy, -1) ? 'Ayer' : fmtFechaLarga(new Date(`${fecha}T12:00`).getTime())

  return (
    <div className="pb-6">
      <Cabecera
        titulo="Nutrición"
        accion={
          <Link to="/nutricion/perfil" aria-label="Objetivo y ajustes de nutrición" className="grid size-12 place-items-center rounded-full text-muted active:bg-surface-2">
            <Icono nombre="ajustes" />
          </Link>
        }
      />

      <div className="mt-1 flex items-center gap-1">
        <button type="button" onClick={() => setFecha(masDias(fecha, -1))} aria-label="Día anterior" className="grid size-12 place-items-center rounded-full active:bg-surface-2">
          <Icono nombre="atras" />
        </button>
        <p className="flex-1 text-center font-semibold">{titulo}</p>
        <button
          type="button"
          onClick={() => setFecha(masDias(fecha, 1))}
          disabled={fecha >= hoy}
          aria-label="Día siguiente"
          className="grid size-12 place-items-center rounded-full active:bg-surface-2 disabled:opacity-30"
        >
          <Icono nombre="adelante" />
        </button>
      </div>

      <div className="mt-1 space-y-3">
        {verRevision && <RevisionSemanal perfil={perfil} ajuste={ajusteDeHoy} kg={dia.kg!} alCerrar={() => undefined} />}

        {muyPoco && fecha === hoy && (
          <Tarjeta>
            <p className="font-semibold">Estos días has comido bastante menos de tu objetivo</p>
            <p className="mt-1 text-sm text-muted">
              Comer tan poco hace que pierdas músculo y rindas peor entrenando. Te recomiendo acercarte más a tu objetivo: un poco más en cada comida ya ayuda.
            </p>
          </Tarjeta>
        )}

        {dia.objetivo ? (
          <ResumenDia objetivo={dia.objetivo} comido={dia.comido} />
        ) : (
          <Tarjeta>
            <p className="text-sm">
              Registra tu peso para calcular el objetivo del día. <Link to="/?peso=1" className="font-semibold text-accent">Registrar peso</Link>
            </p>
          </Tarjeta>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => actualizarPerfil({ entrenoManual: { ...perfil.entrenoManual, [fecha]: !dia.entrena } })}
            aria-pressed={dia.entrena}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${dia.entrena ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
          >
            {dia.entrena ? 'Día de entreno' : 'Día de descanso'}
          </button>
          <p className="text-xs text-muted">{dia.entrena ? 'Algo más de hidratos hoy' : 'Toca si hoy entrenas'}</p>
        </div>

        <ComidasDelDia fecha={fecha} registros={dia.registros} entrena={dia.entrena} onAnadir={setAnadir} />

        <div className="grid grid-cols-2 gap-3">
          <section className="flex items-center gap-2 rounded-3xl border border-line bg-surface p-3" aria-label="Agua">
            <Icono nombre="agua" className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="num block text-lg leading-tight font-bold">{fmtKg(Math.round(dia.aguaMl / 50) / 20)} L</span>
              <span className="text-xs text-muted">de agua</span>
            </span>
            {dia.aguaMl > 0 && (
              <button type="button" onClick={() => sumarAgua(fecha, -250)} aria-label="Quitar 250 ml de agua" className="grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
                <Icono nombre="menos" tamano={18} />
              </button>
            )}
            <button type="button" onClick={() => sumarAgua(fecha, 250)} aria-label="Añadir 250 ml de agua" className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent active:bg-line">
              <Icono nombre="mas" />
            </button>
          </section>
          <Boton grande className="h-full" disabled={!restante} onClick={() => setCerrarDia(true)}>
            Cerrar el día
          </Boton>
        </div>

        <TarjetaReto perfil={perfil} lunes={lunes} />
      </div>

      <HojaAnadir abierta={anadir !== null} onCerrar={() => setAnadir(null)} fecha={fecha} comida={anadir ?? comidaAhora} conIA={conIA} />
      {restante && <HojaCerrarDia abierta={cerrarDia} onCerrar={() => setCerrarDia(false)} fecha={fecha} comida={comidaAhora} restante={restante} perfil={perfil} />}
    </div>
  )
}
