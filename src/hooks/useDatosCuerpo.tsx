import { createContext, use, type ReactNode } from 'react'
import type { DatosCuerpo } from '../domain/cuerpo'
import { useCuerpo } from './useCuerpo'

const Contexto = createContext<DatosCuerpo | undefined>(undefined)

/**
 * Los datos del cuerpo de hoy para toda la app (una sola lectura): con ellos las animaciones de los
 * ejercicios y sus miniaturas usan el avatar de cada usuario. `datos` los sustituye (la galería de
 * revisión enseña así otros cuerpos).
 */
export function ProveedorCuerpo({ children, datos }: { children: ReactNode; datos?: DatosCuerpo }) {
  const cuerpo = useCuerpo()
  return <Contexto value={datos ?? cuerpo?.datos}>{children}</Contexto>
}

/** Datos del cuerpo de hoy (undefined mientras se leen). */
export function useDatosCuerpo(): DatosCuerpo | undefined {
  return use(Contexto)
}
