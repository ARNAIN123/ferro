// Puente con Health Connect (android/…/salud/SaludPlugin.kt). Solo lectura de pasos y peso.
// En el navegador no hay Health Connect: la app funciona igual, sin pasos.
import { registerPlugin } from '@capacitor/core'
import { esNativa } from './plataforma'

export interface EstadoSalud {
  /** "si": instalado y listo; "actualizar": hay que instalarlo o actualizarlo; "no": este móvil no lo admite. */
  disponible: 'si' | 'actualizar' | 'no'
  pasos: boolean
  peso: boolean
}

interface PluginSalud {
  estado(): Promise<EstadoSalud>
  pedirPermisos(): Promise<EstadoSalud>
  pasos(o: { tramos: { desde: number; hasta: number }[] }): Promise<{ pasos: number[] }>
  ultimoPeso(): Promise<{ kg?: number; hora?: number }>
  abrirHealthConnect(): Promise<void>
}

export const Salud = registerPlugin<PluginSalud>('Salud')

export const haySalud = esNativa
