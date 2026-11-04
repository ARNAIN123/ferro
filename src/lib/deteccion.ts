// Puente con la detección nativa (android/…/deteccion/DeteccionPlugin.kt). En el navegador no hay detección.
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { EventoDeteccion } from '../domain/deteccion'
import { esNativa } from './plataforma'

export interface PermisosDeteccion {
  ubicacion: boolean
  ubicacionSiempre: boolean
  notificaciones: boolean
  alarmasExactas: boolean
  sinRestriccionesBateria: boolean
}

export interface EstadoDeteccion {
  gimnasioGuardado: boolean
  presencia: { entrada: number; fuerasSeguidas: number } | null
  permisos: PermisosDeteccion
  /** Datos para la acción "Enviar intent" de MacroDroid. */
  receptor: { paquete: string; clase: string; accion: string }
}

export interface AnotacionDeteccion {
  hora: number
  evento: string
  decision: string
  distancia?: number
  precision?: number
}

interface PluginDeteccion {
  configurar(c: { lat: number | null; lng: number | null; radio: number; margen: number; horas: number; notificar: boolean }): Promise<void>
  estado(): Promise<EstadoDeteccion>
  tomarEventos(): Promise<{ eventos: EventoDeteccion[] }>
  registro(): Promise<{ registro: AnotacionDeteccion[] }>
  ubicacionActual(): Promise<{ lat: number; lng: number; precision: number }>
  pedirUbicacionSiempre(): Promise<EstadoDeteccion>
  abrirAjustesApp(): Promise<void>
  simular(o: { evento: 's3_abierta' | 'wifi_desconectada' }): Promise<EstadoDeteccion>
  addListener(evento: 'cambio', fn: () => void): Promise<PluginListenerHandle>
}

export const Deteccion = registerPlugin<PluginDeteccion>('Deteccion')

export const hayDeteccion = esNativa
