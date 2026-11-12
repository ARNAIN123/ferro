import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Boton, Campo, claseInput, Tarjeta } from '../../components/ui'
import { borrarMedidas, guardarMedidas } from '../../db/cuerpo'
import { db } from '../../db/db'
import { ponerBasalAlDia } from '../../db/recalibracion'
import { AYUDA_MEDIDA, DIAS_MEDIDA_VIGENTE, LIMITES_MEDIDA, MEDIDAS, medidasVigentes, NOMBRE_MEDIDA, type MedidaCorporal, type NombreMedida } from '../../domain/cuerpo'
import { claveDia } from '../../domain/semanas'
import { fmtFechaCorta, fmtKg, parseNumero } from '../../lib/formato'

const fechaCorta = (f: string) => fmtFechaCorta(new Date(`${f}T12:00`).getTime())
const VACIO = Object.fromEntries(MEDIDAS.map((m) => [m, ''])) as Record<NombreMedida, string>
const textosDe = (r: MedidaCorporal | undefined) => Object.fromEntries(MEDIDAS.map((m) => [m, r?.[m] !== undefined ? String(r[m]).replace('.', ',') : ''])) as Record<NombreMedida, string>

/**
 * Medidas con cinta métrica (opcionales), con fecha: se guarda su evolución. Las de los últimos
 * meses ajustan el avatar; las que no se han tomado, las pone él según el peso y la altura.
 */
export function SeccionMedidas({ delAvatar }: { delAvatar: Record<NombreMedida, number> | null }) {
  const hoy = claveDia(Date.now())
  const registros = useLiveQuery(() => db.medidas.orderBy('fecha').reverse().toArray(), [])
  const [fecha, setFecha] = useState(hoy)
  const [textos, setTextos] = useState(VACIO)
  const [cargada, setCargada] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  // Al elegir un día que ya tiene medidas, se cargan para corregirlas.
  const delDia = registros?.find((r) => r.fecha === fecha)
  const clave = `${fecha}|${delDia ? JSON.stringify(delDia) : ''}`
  if (registros && cargada !== clave) {
    setCargada(clave)
    setTextos(textosDe(delDia))
  }

  const ultimas = medidasVigentes(registros ?? [], '9999-12-31')
  const valores = Object.fromEntries(MEDIDAS.map((m) => [m, parseNumero(textos[m])])) as Record<NombreMedida, number | null>
  const invalida = (m: NombreMedida) => textos[m].trim() !== '' && (valores[m] === null || valores[m] < LIMITES_MEDIDA[m][0] || valores[m] > LIMITES_MEDIDA[m][1])
  const hayError = MEDIDAS.some(invalida)
  const hayAlgo = MEDIDAS.some((m) => valores[m] !== null) || delDia !== undefined

  const guardar = async () => {
    if (hayError || !hayAlgo) return
    // Un campo vacío quita esa medida de ese día.
    await guardarMedidas(fecha, Object.fromEntries(MEDIDAS.map((m) => [m, textos[m].trim() === '' ? null : valores[m]])))
    await ponerBasalAlDia()
    setGuardado(true)
    window.setTimeout(() => setGuardado(false), 2500)
  }

  return (
    <Tarjeta>
      <h2 className="mb-1 font-bold">Medidas con cinta</h2>
      <p className="text-sm text-muted">Opcionales. Apunta las que quieras: el avatar se ajusta a ellas y se guarda su evolución. Las que dejes en blanco las calcula él.</p>

      <details className="mt-2 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent">Cómo medir</summary>
        <dl className="space-y-1.5 pb-2 text-muted">
          {MEDIDAS.map((m) => (
            <div key={m}>
              <dt className="inline font-semibold text-fg">{NOMBRE_MEDIDA[m]}: </dt>
              <dd className="inline">{AYUDA_MEDIDA[m]}</dd>
            </div>
          ))}
        </dl>
      </details>

      <div className="mt-2">
        <Campo etiqueta="Fecha">
          <input type="date" className={`${claseInput} num`} value={fecha} max={hoy} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </Campo>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
        {MEDIDAS.map((m) => {
          const ultima = ultimas[m]
          return (
            <Campo
              key={m}
              etiqueta={`${NOMBRE_MEDIDA[m]} (cm)`}
              ayuda={
                invalida(m)
                  ? `Entre ${LIMITES_MEDIDA[m][0]} y ${LIMITES_MEDIDA[m][1]} cm`
                  : ultima && ultima.fecha !== fecha
                    ? `Última: ${fmtKg(ultima.cm)} (${fechaCorta(ultima.fecha)})`
                    : undefined
              }
            >
              <input
                inputMode="decimal"
                className={`${claseInput} num ${invalida(m) ? 'border-danger' : ''}`}
                value={textos[m]}
                placeholder={delAvatar ? `≈ ${fmtKg(delAvatar[m])}` : '—'}
                aria-invalid={invalida(m)}
                onChange={(e) => setTextos({ ...textos, [m]: e.target.value })}
              />
            </Campo>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-muted">En gris, lo que mide ahora tu avatar. Las medidas de hace más de {Math.round(DIAS_MEDIDA_VIGENTE / 30)} meses dejan de ajustarlo (el cuerpo habrá cambiado).</p>
      <Boton variante="primario" className="mt-3 w-full" disabled={hayError || !hayAlgo} onClick={() => void guardar()}>
        {guardado ? 'Guardadas' : delDia ? 'Guardar cambios' : 'Guardar medidas'}
      </Boton>

      {registros && registros.length > 0 && (
        <>
          <h3 className="mt-4 border-t border-line pt-3 text-sm font-semibold">Evolución</h3>
          <ul className="divide-y divide-line text-sm">
            {registros.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <button type="button" className="min-h-11 flex-1 text-left" onClick={() => setFecha(r.fecha)} aria-label={`Editar las medidas del ${fechaCorta(r.fecha)}`}>
                  <span className="num font-semibold">{fechaCorta(r.fecha)}</span>
                  <span className="block text-muted">
                    {MEDIDAS.filter((m) => r[m] !== undefined)
                      .map((m) => `${NOMBRE_MEDIDA[m].toLowerCase()} ${fmtKg(r[m]!)}`)
                      .join(' · ')}
                  </span>
                </button>
                <button type="button" aria-label={`Borrar las medidas del ${fechaCorta(r.fecha)}`} className="grid size-11 shrink-0 place-items-center text-lg text-muted" onClick={() => void borrarMedidas(r.id).then(() => ponerBasalAlDia())}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Tarjeta>
  )
}
