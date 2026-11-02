import { useEffect } from 'react'

/** Mantiene la pantalla encendida mientras `activo`. Android la suelta al salir de la app; se vuelve a pedir al volver. */
export function useWakeLock(activo: boolean) {
  useEffect(() => {
    if (!activo || !('wakeLock' in navigator)) return
    let bloqueo: WakeLockSentinel | null = null
    let cancelado = false

    const pedir = async () => {
      if (document.visibilityState !== 'visible' || (bloqueo && !bloqueo.released)) return
      try {
        const nuevo = await navigator.wakeLock.request('screen')
        if (cancelado) void nuevo.release()
        else bloqueo = nuevo
      } catch {
        // Batería baja o permiso denegado: el entreno sigue funcionando igual.
      }
    }

    void pedir()
    document.addEventListener('visibilitychange', pedir)
    return () => {
      cancelado = true
      document.removeEventListener('visibilitychange', pedir)
      void bloqueo?.release()
    }
  }, [activo])
}
