// Avatares para los tests de las animaciones (solo en los tests: lee los archivos del modelo del
// disco). Las animaciones las hace el avatar de cada usuario, así que se prueban con tres cuerpos muy
// distintos, cada uno con su rig a la escala de las escenas y su superficie, como en la app.
import { readFileSync } from 'node:fs'
import { esqueletoEjercicio, superficieAvatar } from '../avatar3d/cuerpoEjercicio'
import { modeloDesdeGlb, type InfoAvatar } from '../avatar3d/modelo'
import { resolverForma } from '../avatar3d/resolver'
import type { DatosCuerpo } from '../domain/cuerpo'
import { Rig } from './rig'

const glb = readFileSync('public/modelos/avatar.glb')
const info = JSON.parse(readFileSync('public/modelos/avatar.json', 'utf8')) as InfoAvatar
export const modeloDePrueba = modeloDesdeGlb(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer, info)

export const CUERPOS_DE_PRUEBA: DatosCuerpo[] = [
  { sexo: 'hombre', edad: 30, alturaCm: 178, kg: 80 },
  { sexo: 'hombre', edad: 45, alturaCm: 168, kg: 105 },
  { sexo: 'mujer', edad: 28, alturaCm: 162, kg: 56 },
]

/** El rig del avatar de unos datos, como en la escena de un ejercicio. `nombre` sirve de huella. */
export function rigDeAvatar(d: DatosCuerpo): { rig: Rig; nombre: string } {
  const { forma } = resolverForma(modeloDePrueba, d)
  const { objeto, escala, reposo } = esqueletoEjercicio(modeloDePrueba, forma)
  reposo()
  const rig = new Rig(objeto)
  rig.usarSuperficie(superficieAvatar(modeloDePrueba, forma, escala))
  return { rig, nombre: `${d.sexo} ${d.alturaCm}/${d.kg}` }
}
