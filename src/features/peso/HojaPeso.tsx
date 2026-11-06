import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { BotonRepetir } from '../../components/BotonRepetir'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { Regla } from '../../components/Regla'
import { Boton } from '../../components/ui'
import { db } from '../../db/db'
import { guardarPeso } from '../../db/peso'
import { ajustar } from '../../domain/regla'
import { claveDia, sumarDias } from '../../domain/semanas'
import { avisar } from '../../lib/avisos'
import { fmtKg, parseNumero } from '../../lib/formato'

const MIN = 30
const MAX = 250

/** Siempre con un decimal: "80,0". */
const fmtPeso = (kg: number) => kg.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const textoFecha = (fecha: string, hoy: string) => {
  if (fecha === hoy) return 'Hoy'
  if (fecha === claveDia(sumarDias(Date.now(), -1))) return 'Ayer'
  return new Date(`${fecha}T12:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Registrar el peso en dos toques: se abre ya en el último peso, se ajusta con la regla o con los
 * botones (o escribiéndolo) y se guarda. La fecha es hoy salvo que se cambie en el chip.
 */
export function HojaPeso({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const hoy = claveDia(Date.now())
  const recientes = useLiveQuery(() => db.pesosCorporales.orderBy('fecha').reverse().limit(60).toArray(), [])
  const [fecha, setFecha] = useState(hoy)
  const [kg, setKg] = useState<number | null>(null)
  const [texto, setTexto] = useState<string | null>(null)

  // Cada vez que se abre: hoy y el peso de hoy o, si no hay, el último.
  useEffect(() => {
    if (!abierta) return
    setFecha(hoy)
    setKg(null)
    setTexto(null)
  }, [abierta, hoy])
  useEffect(() => {
    if (abierta && kg === null && recientes) setKg(recientes.find((p) => p.fecha === hoy)?.kg ?? recientes[0]?.kg ?? 75)
  }, [abierta, kg, recientes, hoy])

  const sumar = (d: number) => setKg((v) => ajustar((v ?? 75) + d, 0.1, MIN, MAX))
  const delDia = recientes?.find((p) => p.fecha === fecha)
  const anterior = recientes?.find((p) => p.fecha < fecha)

  const guardar = async () => {
    if (kg === null) return
    await guardarPeso(fecha, kg)
    avisar(`Guardado: ${fmtPeso(kg)} kg${fecha === hoy ? '' : ` (${textoFecha(fecha, hoy).toLowerCase()})`}`)
    onCerrar()
  }

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Registrar peso">
      {kg !== null && (
        <div className="pb-2">
          <div className="flex items-center justify-center gap-2">
            <label className="relative inline-flex min-h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-sm font-semibold">
              <Icono nombre="historial" tamano={16} className="text-muted" />
              {textoFecha(fecha, hoy)}
              <Icono nombre="abajo" tamano={14} className="text-muted" />
              <input
                type="date"
                aria-label="Fecha del registro"
                max={hoy}
                value={fecha}
                onChange={(e) => e.target.value && setFecha(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>

          <div className="mt-3 flex items-baseline justify-center gap-1">
            <input
              aria-label="Peso en kilos. Toca para escribirlo"
              inputMode="decimal"
              enterKeyHint="done"
              value={texto ?? fmtPeso(kg)}
              onFocus={(e) => {
                setTexto(fmtPeso(kg))
                e.currentTarget.select()
              }}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={() => {
                const n = texto === null ? null : parseNumero(texto)
                if (n !== null && n > 0) setKg(ajustar(n, 0.1, MIN, MAX))
                setTexto(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="num w-[5.2ch] bg-transparent text-center text-6xl font-bold outline-none focus:text-accent"
            />
            <span className="text-xl font-semibold text-muted">kg</span>
          </div>
          <p className="mt-1 min-h-5 text-center text-sm text-muted">
            {delDia && fecha !== hoy
              ? `Sustituye el de ese día (${fmtKg(delDia.kg)} kg)`
              : anterior
                ? `Anterior: ${fmtKg(anterior.kg)} kg · ${textoFecha(anterior.fecha, hoy).toLowerCase()}${
                    kg !== anterior.kg ? ` (${kg > anterior.kg ? '+' : ''}${fmtKg(Math.round((kg - anterior.kg) * 10) / 10)})` : ''
                  }`
                : ''}
          </p>

          <div className="mt-3">
            <Regla
              valor={kg}
              onCambio={setKg}
              min={MIN}
              max={MAX}
              paso={0.1}
              marcaGrande={1}
              pasoPx={13}
              etiqueta="Peso en kilos"
              formatoMarca={(v) => String(Math.round(v))}
            />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <BotonRepetir etiqueta="Restar 1 kilo" accion={() => sumar(-1)}>
              −1
            </BotonRepetir>
            <BotonRepetir etiqueta="Restar 100 gramos" accion={() => sumar(-0.1)}>
              −0,1
            </BotonRepetir>
            <BotonRepetir etiqueta="Sumar 100 gramos" accion={() => sumar(0.1)}>
              +0,1
            </BotonRepetir>
            <BotonRepetir etiqueta="Sumar 1 kilo" accion={() => sumar(1)}>
              +1
            </BotonRepetir>
          </div>

          <Boton variante="primario" grande className="mt-4 w-full" onClick={guardar}>
            <Icono nombre="check" grosor={3} /> Guardar
          </Boton>
        </div>
      )}
    </Hoja>
  )
}
