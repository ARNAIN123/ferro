import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { cuerpoEnFecha, type CuerpoDelDia } from '../domain/cuerpo'
import { claveDia } from '../domain/semanas'
import { useAjustes } from './useAjustes'

/**
 * El cuerpo de un día (hoy, si no se dice otro): perfil, peso según la tendencia, medidas y grasa.
 * Mientras se leen los datos devuelve undefined. Cambia solo cuando cambian el peso, las medidas o
 * el perfil, así que el avatar se actualiza sin hacer nada.
 */
export function useCuerpo(fecha?: string): CuerpoDelDia | undefined {
  const ajustes = useAjustes()
  const datos = useLiveQuery(async () => {
    const [pesos, medidas, grasas, nutricion] = await Promise.all([db.pesosCorporales.toArray(), db.medidas.toArray(), db.grasas.toArray(), db.nutricion.get('perfil')])
    return { pesos, medidas, grasas, sexoNutricion: nutricion?.sexo ?? null }
  }, [])
  const dia = fecha ?? claveDia(Date.now())
  const { sexo, edad, alturaCm, ajusteAvatar } = ajustes
  return useMemo(
    () =>
      datos &&
      cuerpoEnFecha({
        fecha: dia,
        // El sexo del perfil corporal; si aún no se ha puesto, el del asistente de nutrición.
        sexo: sexo ?? datos.sexoNutricion,
        edad,
        alturaCm,
        ajuste: ajusteAvatar,
        pesos: datos.pesos,
        medidas: datos.medidas,
        grasas: datos.grasas,
      }),
    [datos, dia, sexo, edad, alturaCm, ajusteAvatar],
  )
}
