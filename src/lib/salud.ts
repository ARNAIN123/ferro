// Puente con Health Connect (android/…/salud/SaludPlugin.kt). Solo lectura de pasos, peso y grasa corporal.
// En el navegador no hay Health Connect: la app funciona igual, sin pasos.
import { registerPlugin } from '@capacitor/core'
import { esNativa } from './plataforma'

export interface EstadoSalud {
  /** "si": instalado y listo; "actualizar": hay que instalarlo o actualizarlo; "no": este móvil no lo admite. */
  disponible: 'si' | 'actualizar' | 'no'
  pasos: boolean
  peso: boolean
  /** Permiso para leer el porcentaje de grasa (una báscula que lo registre). */
  grasa?: boolean
}

interface PluginSalud {
  estado(): Promise<EstadoSalud>
  pedirPermisos(): Promise<EstadoSalud>
  pasos(o: { tramos: { desde: number; hasta: number }[] }): Promise<{ pasos: number[] }>
  ultimoPeso(): Promise<{ kg?: number; hora?: number }>
  /** Mediciones de peso entre dos instantes (ms), de la más antigua a la más reciente. */
  pesos(o: { desde: number; hasta: number }): Promise<{ pesos: { kg: number; hora: number }[] }>
  /** Mediciones de grasa corporal (%) entre dos instantes (ms), de la más antigua a la más reciente. */
  grasas(o: { desde: number; hasta: number }): Promise<{ grasas: { pct: number; hora: number }[] }>
  abrirHealthConnect(): Promise<void>
}

export const Salud = registerPlugin<PluginSalud>('Salud')

export const haySalud = esNativa
