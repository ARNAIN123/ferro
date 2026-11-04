import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'
import { AJUSTES_POR_DEFECTO, type Ajustes } from '../domain/tipos'

// Los ajustes guardados se completan con los valores por defecto: así los campos que llegan
// con versiones nuevas tienen valor sin necesidad de migrar la base de datos.
const completar = (a: Ajustes | undefined): Ajustes => ({ ...AJUSTES_POR_DEFECTO, ...a })

export function useAjustes(): Ajustes {
  const guardados = useLiveQuery(() => db.ajustes.get('ajustes'), [])
  return useMemo(() => completar(guardados), [guardados])
}

export async function leerAjustes(): Promise<Ajustes> {
  return completar(await db.ajustes.get('ajustes'))
}

export async function guardarAjustes(cambios: Partial<Omit<Ajustes, 'id'>>): Promise<void> {
  const actuales = await leerAjustes()
  await db.ajustes.put({ ...actuales, ...cambios, id: 'ajustes' })
}
