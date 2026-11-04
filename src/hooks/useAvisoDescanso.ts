import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db } from '../db/db'
import { programarAvisoDescanso } from '../lib/nativo'

/**
 * Mantiene programada la notificación de fin de descanso del entreno en curso, esté en la
 * pantalla que esté: cualquier cambio (serie nueva, ±15 s, saltar, terminar) la reprograma.
 */
export function useAvisoDescanso(): void {
  const aviso = useLiveQuery(async () => {
    const s = await db.sesiones.where('estado').equals('en_curso').first()
    if (!s?.descansoFin) return { fin: null, texto: '' }
    const se = s.ejercicioActivoId ? await db.sesionEjercicios.get(s.ejercicioActivoId) : undefined
    const e = se ? await db.ejercicios.get(se.ejercicioId) : undefined
    return { fin: s.descansoFin, texto: e ? `Siguiente serie: ${e.nombre}` : 'A por la siguiente serie' }
  }, [])

  const listo = aviso !== undefined
  const fin = aviso?.fin ?? null
  const texto = aviso?.texto ?? ''
  useEffect(() => {
    if (listo) void programarAvisoDescanso(fin, texto)
  }, [listo, fin, texto])
}
