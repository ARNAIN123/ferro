import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router'
import { Hoja } from '../../components/Hoja'
import { Icono } from '../../components/Icono'
import { db } from '../../db/db'
import { iniciarSesion } from '../../db/entreno'
import { rutinasDelCiclo } from '../../domain/ciclo'

interface Props {
  abierta: boolean
  onCerrar: () => void
  tocaId: string | null
}

/** Siempre puedo elegir otra rutina distinta de la que toca, o un entreno libre. */
export function ElegirRutina({ abierta, onCerrar, tocaId }: Props) {
  const navegar = useNavigate()
  const rutinas = useLiveQuery(async () => rutinasDelCiclo(await db.rutinas.toArray()), [])

  const empezar = async (rutinaId: string | null) => {
    await iniciarSesion(rutinaId)
    onCerrar()
    navegar('/entreno')
  }

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Elegir rutina">
      <ul className="divide-y divide-line pb-2">
        {(rutinas ?? []).map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => empezar(r.id)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
              <span className="condensada flex-1 text-lg font-bold">{r.nombre}</span>
              {r.id === tocaId && <span className="text-xs font-semibold text-accent">TOCA</span>}
              <Icono nombre="play" tamano={18} className="text-accent" />
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => empezar(null)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
            <span className="flex-1">
              <span className="condensada block text-lg font-bold">Entreno libre</span>
              <span className="text-sm text-muted">Sin rutina: añades los ejercicios sobre la marcha.</span>
            </span>
            <Icono nombre="play" tamano={18} className="text-accent" />
          </button>
        </li>
      </ul>
    </Hoja>
  )
}
