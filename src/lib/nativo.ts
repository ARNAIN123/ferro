// Integración con Android (Capacitor): arranque, notificación de fin de descanso. En el navegador no hace nada.
import { LocalNotifications } from '@capacitor/local-notifications'
import { esNativa } from './plataforma'

const ID_DESCANSO = 1001
const CANAL_DESCANSO = 'descanso'
let notificacionesPermitidas = false

export async function iniciarNativo(): Promise<void> {
  if (!esNativa()) return
  // Todo viene dentro del APK: un service worker heredado serviría código viejo tras actualizar.
  try {
    for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister()
  } catch {
    // Sin service worker no hay nada que quitar.
  }
  try {
    await LocalNotifications.createChannel({
      id: CANAL_DESCANSO,
      name: 'Fin del descanso',
      description: 'Avisa cuando termina el descanso entre series, también con la pantalla apagada',
      importance: 5,
      visibility: 1,
      vibration: true,
    })
    let { display } = await LocalNotifications.checkPermissions()
    if (display === 'prompt' || display === 'prompt-with-rationale') ({ display } = await LocalNotifications.requestPermissions())
    notificacionesPermitidas = display === 'granted'
  } catch {
    notificacionesPermitidas = false
  }
}

/** Si el aviso del descanso lo da la notificación de Android (para no vibrar dos veces). */
export const avisoDescansoNativo = (): boolean => notificacionesPermitidas

/**
 * Programa (o quita) la notificación de fin de descanso. Usa una alarma exacta, así que suena
 * y vibra a su hora aunque la app esté en segundo plano o con la pantalla apagada.
 */
export async function programarAvisoDescanso(fin: number | null, texto: string): Promise<void> {
  if (!esNativa()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ID_DESCANSO }] })
    await LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: ID_DESCANSO, title: '', body: '' }] })
    if (!notificacionesPermitidas || !fin || fin <= Date.now() + 1000) return
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID_DESCANSO,
          channelId: CANAL_DESCANSO,
          title: 'Descanso terminado',
          body: texto,
          smallIcon: 'ic_stat_ferro',
          autoCancel: true,
          schedule: { at: new Date(fin), allowWhileIdle: true },
        },
      ],
    })
  } catch {
    // Si Android no deja programarla, queda el aviso dentro de la app.
  }
}
