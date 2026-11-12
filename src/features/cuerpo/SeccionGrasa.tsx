import { App } from '@capacitor/app'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'
import { Boton, Campo, claseInput, Tarjeta } from '../../components/ui'
import { borrarGrasa, guardarGrasa, importarGrasaDeSalud } from '../../db/cuerpo'
import { db } from '../../db/db'
import { ponerBasalAlDia } from '../../db/recalibracion'
import type { GrasaVigente } from '../../domain/cuerpo'
import type { Sexo } from '../../domain/nutricion'
import { claveDia } from '../../domain/semanas'
import { fmtFechaCorta, fmtKg, parseNumero } from '../../lib/formato'
import { Salud, haySalud, type EstadoSalud } from '../../lib/salud'

const ORIGEN: Record<GrasaVigente['origen'], string> = {
  salud: 'de tu báscula (Health Connect)',
  manual: 'escrito a mano',
  marina: 'método de la Marina de EE. UU., con tus medidas',
}
const fecha = (f: string) => fmtFechaCorta(new Date(`${f}T12:00`).getTime())

/**
 * Porcentaje de grasa: el de la báscula (Health Connect) si lo registra; si no, el método de la
 * Marina con las medidas de cinta, o escrito a mano. Con él, los músculos del avatar se ven más o
 * menos marcados y Nutrición calcula el metabolismo basal con Katch-McArdle.
 */
export function SeccionGrasa({ sexo, vigente, estimada }: { sexo: Sexo; vigente: GrasaVigente | null; estimada: number | null }) {
  const [texto, setTexto] = useState('')
  const registros = useLiveQuery(() => db.grasas.orderBy('fecha').reverse().limit(6).toArray(), [])
  const pct = parseNumero(texto)
  const invalido = texto.trim() !== '' && (pct === null || pct < 3 || pct > 60)

  const guardar = async () => {
    if (pct === null || invalido) return
    await guardarGrasa(claveDia(Date.now()), pct)
    await ponerBasalAlDia()
    setTexto('')
  }

  return (
    <Tarjeta>
      <h2 className="mb-1 font-bold">Grasa corporal</h2>
      {vigente ? (
        <p className="text-sm">
          <span className="num text-2xl font-bold">{fmtKg(vigente.pct)} %</span>{' '}
          <span className="text-muted">
            · {ORIGEN[vigente.origen]} ({fecha(vigente.fecha)})
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted">
          Sin dato reciente{estimada !== null && <>: el avatar usa una estimación por tu peso y tu altura (≈ {fmtKg(estimada)} %), que no distingue el músculo de la grasa</>}.
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        Con menos grasa, los músculos del avatar se ven más marcados. Si hay porcentaje de grasa, Nutrición calcula tu metabolismo basal con la fórmula de Katch-McArdle.
      </p>

      <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm text-muted">
        <li>
          <span className="font-semibold text-fg">Báscula:</span> si la tuya guarda la grasa en Health Connect, se lee sola.
        </li>
        <li>
          <span className="font-semibold text-fg">Método de la Marina:</span> se calcula con el cuello y la cintura{sexo === 'mujer' ? ', y la cadera' : ''} (abajo, en Medidas) y tu altura.
        </li>
        <li>
          <span className="font-semibold text-fg">A mano:</span> si lo sabes por otra vía (plicómetro, DEXA…).
        </li>
      </ul>

      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <Campo etiqueta="Escribirlo a mano (%)">
            <input
              inputMode="decimal"
              className={`${claseInput} num ${invalido ? 'border-danger' : ''}`}
              value={texto}
              placeholder="—"
              aria-invalid={invalido}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void guardar()}
            />
          </Campo>
        </div>
        <Boton variante="primario" disabled={pct === null || invalido} onClick={() => void guardar()}>
          Guardar
        </Boton>
      </div>

      {haySalud() && <GrasaDeSalud />}

      {registros && registros.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
          {registros.map((g) => (
            <li key={g.id} className="flex min-h-11 items-center justify-between gap-2">
              <span>
                <span className="num font-semibold">{fmtKg(g.pct)} %</span> <span className="text-muted">· {fecha(g.fecha)} · {g.origen === 'salud' ? 'báscula' : 'a mano'}</span>
              </span>
              {g.origen === 'manual' && (
                <button type="button" aria-label={`Borrar el registro del ${fecha(g.fecha)}`} className="grid size-11 place-items-center text-lg text-muted" onClick={() => void borrarGrasa(g.id).then(() => ponerBasalAlDia())}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

/** Trae la grasa de Health Connect y, si hay algo nuevo, pone al día el metabolismo basal. */
async function traerDeSalud(forzar = false): Promise<void> {
  if (await importarGrasaDeSalud(forzar)) await ponerBasalAlDia()
}

/** Lectura de la grasa corporal de Health Connect (solo en la app Android). */
function GrasaDeSalud() {
  const [estado, setEstado] = useState<EstadoSalud | null>(null)
  const refrescar = useCallback(() => {
    Salud.estado().then(
      (e) => {
        setEstado(e)
        if (e.grasa) void traerDeSalud()
      },
      () => setEstado(null),
    )
  }, [])

  // Al volver de Health Connect, los permisos pueden haber cambiado.
  useEffect(() => {
    refrescar()
    const h = App.addListener('appStateChange', ({ isActive }) => isActive && refrescar())
    return () => void h.then((x) => x.remove())
  }, [refrescar])

  if (!estado || estado.disponible !== 'si') return null
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
      <span className="text-muted">{estado.grasa ? 'Health Connect: se lee la grasa que registre tu báscula.' : 'Health Connect: falta el permiso para leer la grasa corporal.'}</span>
      {!estado.grasa && (
        <Boton
          onClick={() =>
            Salud.pedirPermisos().then((e) => {
              setEstado(e)
              if (e.grasa) void traerDeSalud(true)
            }, refrescar)
          }
        >
          Permitir
        </Boton>
      )}
    </div>
  )
}
