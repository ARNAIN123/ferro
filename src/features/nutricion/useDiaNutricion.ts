// Todo lo de un día de nutrición: objetivo (según entrene o no), lo que llevo comido y el agua.
// Lo usan la pantalla de Nutrición y la tarjeta de Hoy.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { objetivoDia, type Macros } from '../../domain/nutricion'
import { esDiaDeEntreno, sumar } from '../../domain/registroComidas'
import { claveDia } from '../../domain/semanas'
import type { PerfilNutricion, RegistroComida } from '../../domain/tiposNutricion'
import type { Valores100 } from '../../domain/nutricion'
import { useAjustes } from '../../hooks/useAjustes'

export interface DiaNutricion {
  perfil: PerfilNutricion | null
  fecha: string
  entrena: boolean
  /** Objetivo de ese día; null si aún no he hecho el asistente o no hay peso. */
  objetivo: ({ kcal: number } & Macros) | null
  comido: Valores100
  registros: RegistroComida[]
  aguaMl: number
  kg: number | null
}

/** Días con entreno o con entrada detectada en el gimnasio, entre dos fechas (incluidas). */
export async function diasConEntreno(desde: string, hasta: string): Promise<Set<string>> {
  const ini = new Date(`${desde}T00:00`).getTime()
  const fin = new Date(`${hasta}T23:59:59.999`).getTime()
  const [sesiones, entradas] = await Promise.all([db.sesiones.where('entrada').between(ini, fin, true, true).toArray(), db.entradas.where('hora').between(ini, fin, true, true).toArray()])
  return new Set([...sesiones.map((s) => claveDia(s.entrada)), ...entradas.map((e) => claveDia(e.hora))])
}

export function useDiaNutricion(fecha: string): DiaNutricion | undefined {
  const ajustes = useAjustes()
  return useLiveQuery(async () => {
    const [perfil, registros, agua, ultimo, entrenos] = await Promise.all([
      db.nutricion.get('perfil'),
      db.comidas.where('fecha').equals(fecha).sortBy('hora'),
      db.agua.get(fecha),
      db.pesosCorporales.where('fecha').belowOrEqual(fecha).last(),
      diasConEntreno(fecha, fecha),
    ])
    // Si el día es anterior a mi primer peso, uso el primero que haya.
    const peso = ultimo ?? (await db.pesosCorporales.orderBy('fecha').first())
    const entrena = esDiaDeEntreno(fecha, perfil?.entrenoManual, entrenos)
    const kg = peso?.kg ?? null
    const objetivo =
      perfil && kg !== null ? objetivoDia({ objetivoKcal: perfil.objetivoKcal, basal: perfil.basal, proteinaGkg: perfil.proteinaGkg, kg, entrena, objetivoMensual: ajustes.objetivoMensual }) : null
    return { perfil: perfil ?? null, fecha, entrena, objetivo, comido: sumar(registros), registros, aguaMl: agua?.ml ?? 0, kg }
  }, [fecha, ajustes.objetivoMensual])
}
