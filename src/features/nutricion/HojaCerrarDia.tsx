import { useLiveQuery } from 'dexie-react-hooks'
import { Hoja } from '../../components/Hoja'
import { Boton } from '../../components/ui'
import { db } from '../../db/db'
import { alimentosGenericos, registrarAlimento } from '../../db/nutricion'
import { sugerirCierre } from '../../domain/nutricion'
import { habitualesDe } from '../../domain/registroComidas'
import { claveDia, sumarDias } from '../../domain/semanas'
import { NOMBRE_COMIDA, type Comida, type PerfilNutricion } from '../../domain/tiposNutricion'
import { avisar } from '../../lib/avisos'
import { fmtEntero } from '../../lib/formato'

interface Props {
  abierta: boolean
  onCerrar: () => void
  fecha: string
  comida: Comida
  restante: { kcal: number; proteina: number }
  perfil: PerfilNutricion
}

/** Combinaciones de mis alimentos de siempre que encajan con lo que me queda (sin IA). */
export function HojaCerrarDia({ abierta, onCerrar, fecha, comida, restante, perfil }: Props) {
  const habituales = useLiveQuery(async () => {
    if (!abierta) return null
    const desde = claveDia(sumarDias(Date.now(), -45))
    const [registros, mios, genericos] = await Promise.all([db.comidas.where('fecha').aboveOrEqual(desde).toArray(), db.alimentos.toArray(), alimentosGenericos()])
    const raciones = new Map([...mios, ...genericos].map((a) => [a.id, a.raciones]))
    const noGustan = new Set(perfil.retos.filter((r) => r.estado === 'no_gusta').map((r) => r.alimentoId))
    return habitualesDe(registros, (id) => raciones.get(id) ?? [], noGustan)
  }, [abierta, perfil.retos])

  const sugerencias = habituales ? sugerirCierre(restante, habituales) : []
  const kcal = Math.round(restante.kcal)
  const prot = Math.max(0, Math.round(restante.proteina))

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Cerrar el día">
      <div className="space-y-3 pb-2">
        <p className="text-sm text-muted">
          Te quedan <span className="num font-semibold text-fg">{fmtEntero(Math.max(0, kcal))} kcal</span>
          {prot > 0 && (
            <>
              {' '}
              y <span className="num font-semibold text-accent">{prot} g de proteína</span>
            </>
          )}
          . Ideas con lo que sueles comer:
        </p>
        {kcal < 60 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">Ya estás en tu objetivo de hoy.</p>
        ) : habituales && habituales.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">Cuando lleves unos días registrando, aquí aparecerán combinaciones con tus alimentos de siempre.</p>
        ) : habituales && sugerencias.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">
            {kcal > 1000
              ? 'Aún te queda mucho para cerrarlo con una sola comida. Registra tus comidas normales y vuelve aquí al final del día.'
              : 'No hay ninguna combinación de tus alimentos habituales que encaje bien. Añade lo que te apetezca.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {sugerencias.map((s) => (
              <li key={s.partes.map((p) => `${p.id}${p.gramos}`).join('+')} className="rounded-2xl border border-line p-3">
                <p className="font-semibold">{s.partes.map((p) => `${p.nombre} ${p.racion ? `(${p.racion})` : `${p.gramos} g`}`).join(' + ')}</p>
                <p className="text-sm text-muted">
                  <span className="num">{fmtEntero(s.kcal)}</span> kcal · <span className="num font-semibold text-accent">{s.proteina} g de proteína</span>
                </p>
                <Boton
                  variante="primario"
                  className="mt-2 w-full"
                  onClick={async () => {
                    for (const p of s.partes) {
                      const h = habituales?.find((x) => x.id === p.id)
                      if (h) await registrarAlimento({ fecha, comida, alimento: h, gramos: p.gramos, racion: p.racion })
                    }
                    avisar(`Añadido a ${NOMBRE_COMIDA[comida].toLowerCase()}`)
                    onCerrar()
                  }}
                >
                  Añadir a {NOMBRE_COMIDA[comida].toLowerCase()}
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Hoja>
  )
}
