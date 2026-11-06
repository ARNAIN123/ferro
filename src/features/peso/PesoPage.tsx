import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Cabecera } from '../../components/Cabecera'
import { GraficaPeso } from '../../components/graficas'
import { Icono } from '../../components/Icono'
import { Boton, Tarjeta } from '../../components/ui'
import { db } from '../../db/db'
import { borrarPeso } from '../../db/peso'
import { mediaMovil } from '../../domain/estadisticas'
import { fmtKg } from '../../lib/formato'
import { HojaPeso } from './HojaPeso'

/** Historial de peso corporal. El registro se hace en la hoja rápida (también desde Hoy y el icono). */
export function PesoPage() {
  const pesos = useLiveQuery(() => db.pesosCorporales.orderBy('fecha').toArray(), [])
  const [registrando, setRegistrando] = useState(false)

  const puntos = mediaMovil(pesos ?? [])
  const recientes = [...(pesos ?? [])].reverse().slice(0, 10)

  return (
    <>
      <Cabecera titulo="Peso corporal" atras="/progreso?ver=peso" />
      <Boton variante="primario" grande className="mt-4 w-full" onClick={() => setRegistrando(true)}>
        <Icono nombre="bascula" /> Registrar peso
      </Boton>

      {puntos.length > 1 && (
        <Tarjeta className="mt-3">
          <h2 className="mb-2 font-bold">Evolución</h2>
          <GraficaPeso puntos={puntos} />
        </Tarjeta>
      )}

      {recientes.length > 0 && (
        <section className="mt-3">
          <h2 className="mb-2 font-bold">Registros</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {recientes.map((p) => (
              <li key={p.id} className="flex min-h-14 items-center gap-3 pl-4">
                <span className="flex-1 text-sm text-muted">
                  {new Date(p.fecha + 'T12:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {p.origen === 'salud' && <span className="text-xs text-muted">Báscula</span>}
                <span className="num text-lg">{fmtKg(p.kg)} kg</span>
                <button
                  type="button"
                  aria-label={`Borrar el registro del ${p.fecha}`}
                  onClick={() => borrarPeso(p.id)}
                  className="grid size-12 place-items-center text-muted"
                >
                  <Icono nombre="papelera" tamano={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <HojaPeso abierta={registrando} onCerrar={() => setRegistrando(false)} />
    </>
  )
}
