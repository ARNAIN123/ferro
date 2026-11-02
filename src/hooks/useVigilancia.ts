import { useEffect } from 'react'
import { hayEntradaReciente, registrarEntrada } from '../db/checkin'
import { cerrarSesionCaducada } from '../db/entreno'
import { dentroDelGimnasio } from '../domain/checkin'
import { avisar } from '../lib/avisos'
import { obtenerPosicion, permisoUbicacion } from '../lib/ubicacion'
import { leerAjustes } from './useAjustes'

/**
 * Cada vez que la app pasa a primer plano:
 * 1. cierra el entreno si lleva 3 h sin actividad;
 * 2. si tengo guardada la ubicación del gimnasio, estoy dentro del radio y no hay
 *    una entrada reciente, registra la entrada sola.
 * Una PWA no puede vigilar la ubicación en segundo plano: esto es lo máximo posible.
 */
export function useVigilancia() {
  useEffect(() => {
    let ocupado = false
    const revisar = async () => {
      if (ocupado || document.visibilityState !== 'visible') return
      ocupado = true
      try {
        await cerrarSesionCaducada()
        const a = await leerAjustes()
        if (a.gimnasioLat === null || a.gimnasioLng === null) return
        if (await hayEntradaReciente()) return
        // Sin permiso concedido no lo pedimos al abrir: el aviso del navegador sería molesto.
        if ((await permisoUbicacion()) !== 'granted') return
        const pos = await obtenerPosicion(12000, 60000)
        if (!dentroDelGimnasio(pos, { lat: a.gimnasioLat, lng: a.gimnasioLng }, a.radioM)) return
        const r = await registrarEntrada('ubicacion')
        if (r.registrada) avisar('Estás en el gimnasio: entrada registrada', { texto: 'Empezar', ruta: '/empezar' }, 8000)
      } catch {
        // Sin GPS o sin señal: no pasa nada, quedan el enlace y el botón manual.
      } finally {
        ocupado = false
      }
    }
    void revisar()
    document.addEventListener('visibilitychange', revisar)
    return () => document.removeEventListener('visibilitychange', revisar)
  }, [])
}
