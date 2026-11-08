// La animación 3D de cualquier ejercicio: las 10 del piloto, hechas a mano, y el resto a partir de
// sus poses 2D (desde2d.ts). Se calculan una vez por ejercicio.
import type { EjercicioAnimable } from '../animacion/asignacion'
import { definicionDesde2D } from './desde2d'
import { EJERCICIOS_3D, type Definicion3D } from './ejercicios'

const piloto = new Map(EJERCICIOS_3D.map((d) => [d.id, d]))
const cache = new Map<string, Definicion3D>()

export function definicion3D(e: EjercicioAnimable): Definicion3D {
  const hecha = piloto.get(e.id)
  if (hecha) return hecha
  const clave = `${e.id}|${e.nombre}|${e.material}|${e.musculosPrincipales.join(',')}`
  let d = cache.get(clave)
  if (!d) {
    d = definicionDesde2D(e)
    cache.set(clave, d)
  }
  return d
}

/** ¿Tiene una animación hecha a mano (piloto)? */
export const esPiloto = (id: string) => piloto.has(id)
