import { App } from '@capacitor/app'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db } from '../db/db'
import { importarEventosDeteccion } from '../db/deteccion'
import { cerrarSesionCaducada } from '../db/entreno'
import { AJUSTES_POR_DEFECTO } from '../domain/tipos'
import { Deteccion, hayDeteccion } from '../lib/deteccion'

/**
 * Cada vez que la app pasa a primer plano (y cuando la detección nativa avisa de un cambio):
 * 1. pasa a la base de datos las entradas y salidas que se detectaron con Ferro cerrada;
 * 2. cierra el entreno si lleva 3 h sin actividad.
 * Además mantiene la configuración del gimnasio sincronizada con la parte nativa.
 */
export function useVigilancia() {
  useEffect(() => {
    let ocupado = false
    let activo = true
    const revisar = async () => {
      if (ocupado || document.visibilityState !== 'visible') return
      ocupado = true
      try {
        await importarEventosDeteccion()
        await cerrarSesionCaducada()
      } catch {
        // Si falla, se reintenta la próxima vez que la app vuelva a primer plano.
      } finally {
        ocupado = false
      }
    }
    void revisar()
    document.addEventListener('visibilitychange', revisar)
    const quitar: (() => Promise<void>)[] = []
    if (hayDeteccion()) {
      const guardar = (h: { remove: () => Promise<void> }) => (activo ? quitar.push(() => h.remove()) : void h.remove())
      void Deteccion.addListener('cambio', () => void importarEventosDeteccion()).then(guardar)
      void App.addListener('appStateChange', ({ isActive }) => isActive && void revisar()).then(guardar)
    }
    return () => {
      activo = false
      document.removeEventListener('visibilitychange', revisar)
      for (const q of quitar) void q()
    }
  }, [])

  // null = no hay ajustes guardados todavía; undefined = aún cargando (no se manda nada a medias).
  const guardados = useLiveQuery(async () => (await db.ajustes.get('ajustes')) ?? null, [])
  const { gimnasioLat, gimnasioLng, radioM, margenSalidaM, horasEntreCheckins, notificarEntrada } = { ...AJUSTES_POR_DEFECTO, ...guardados }
  const cargados = guardados !== undefined
  useEffect(() => {
    if (!hayDeteccion() || !cargados) return
    Deteccion.configurar({
      lat: gimnasioLat,
      lng: gimnasioLng,
      radio: radioM,
      margen: margenSalidaM,
      horas: horasEntreCheckins,
      notificar: notificarEntrada,
    }).catch(() => {})
  }, [cargados, gimnasioLat, gimnasioLng, radioM, margenSalidaM, horasEntreCheckins, notificarEntrada])
}
