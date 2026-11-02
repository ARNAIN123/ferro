import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { GraficaPeso } from '../../components/graficas'
import { Icono } from '../../components/Icono'
import { Boton, Tarjeta } from '../../components/ui'
import { db } from '../../db/db'
import { borrarPeso, guardarPeso } from '../../db/peso'
import { mediaMovil } from '../../domain/estadisticas'
import { claveDia } from '../../domain/semanas'
import { avisar } from '../../lib/avisos'
import { fmtKg } from '../../lib/formato'
import { CampoNumero } from '../entreno/CampoNumero'

/** Registro rápido de peso corporal (también es el acceso directo "Registrar peso"). */
export function PesoPage() {
  const navegar = useNavigate()
  const pesos = useLiveQuery(() => db.pesosCorporales.orderBy('fecha').toArray(), [])
  const [kg, setKg] = useState<number | null>(null)
  const hoy = claveDia(Date.now())

  useEffect(() => {
    if (kg === null && pesos) setKg(pesos.find((p) => p.fecha === hoy)?.kg ?? pesos.at(-1)?.kg ?? 75)
  }, [pesos, kg, hoy])

  const puntos = mediaMovil(pesos ?? [])
  const recientes = [...(pesos ?? [])].reverse().slice(0, 10)

  return (
    <>
      <Cabecera titulo="Peso corporal" atras="/progreso?ver=peso" />
      <Tarjeta className="mt-4">
        <p className="text-center text-sm font-medium text-muted">Hoy</p>
        {kg !== null && (
          <div className="mt-2">
            <CampoNumero
              etiqueta="peso corporal"
              unidad="kg"
              decimales
              valor={kg}
              onCambio={setKg}
              onPaso={(d) => setKg(Math.max(0, Math.round((kg + d * 0.1) * 10) / 10))}
            />
          </div>
        )}
        <Boton
          variante="primario"
          grande
          className="mt-4 w-full"
          disabled={kg === null || kg <= 0}
          onClick={async () => {
            if (kg === null) return
            await guardarPeso(hoy, kg)
            avisar(`Guardado: ${fmtKg(kg)} kg`)
            navegar('/progreso?ver=peso', { replace: true })
          }}
        >
          <Icono nombre="check" grosor={3} /> Guardar
        </Boton>
      </Tarjeta>

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
    </>
  )
}
