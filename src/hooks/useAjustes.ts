import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { AJUSTES_POR_DEFECTO, type Ajustes } from '../domain/tipos'

export function useAjustes(): Ajustes {
  return useLiveQuery(() => db.ajustes.get('ajustes'), []) ?? AJUSTES_POR_DEFECTO
}

export async function leerAjustes(): Promise<Ajustes> {
  return (await db.ajustes.get('ajustes')) ?? AJUSTES_POR_DEFECTO
}

export async function guardarAjustes(cambios: Partial<Omit<Ajustes, 'id'>>): Promise<void> {
  const actuales = await leerAjustes()
  await db.ajustes.put({ ...actuales, ...cambios, id: 'ajustes' })
}
