import { entradaReciente } from '../domain/checkin'
import type { Entrada, OrigenEntrada } from '../domain/tipos'
import { leerAjustes } from '../hooks/useAjustes'
import { nuevoId } from '../lib/id'
import { db } from './db'

export interface ResultadoEntrada {
  registrada: boolean
  entrada: Entrada
}

/** Registra la llegada al gimnasio salvo que ya haya una en las últimas N horas (deduplicación). */
export async function registrarEntrada(origen: OrigenEntrada, ahora = Date.now()): Promise<ResultadoEntrada> {
  const { horasEntreCheckins } = await leerAjustes()
  return db.transaction('rw', db.entradas, async () => {
    const recientes = await db.entradas.where('hora').above(ahora - horasEntreCheckins * 3600_000).toArray()
    const previa = entradaReciente(recientes, ahora, horasEntreCheckins)
    if (previa) return { registrada: false, entrada: previa }
    const entrada: Entrada = { id: nuevoId(), hora: ahora, origen }
    await db.entradas.add(entrada)
    return { registrada: true, entrada }
  })
}

/** ¿Hay una entrada reciente? Sirve para no encender el GPS si ya estoy registrado. */
export async function hayEntradaReciente(ahora = Date.now()): Promise<boolean> {
  const { horasEntreCheckins } = await leerAjustes()
  return (await db.entradas.where('hora').above(ahora - horasEntreCheckins * 3600_000).count()) > 0
}
