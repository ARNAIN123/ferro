export interface Posicion {
  lat: number
  lng: number
  precision: number
}

export function obtenerPosicion(timeoutMs = 15000, maximumAge = 30000): Promise<Posicion> {
  return new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) return rechazar(new Error('Este navegador no tiene geolocalización.'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }),
      (e) => rechazar(new Error(mensajeError(e))),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge },
    )
  })
}

/** Estado del permiso sin provocar el aviso del navegador. */
export async function permisoUbicacion(): Promise<PermissionState | 'desconocido'> {
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state
  } catch {
    return 'desconocido'
  }
}

function mensajeError(e: GeolocationPositionError): string {
  if (e.code === e.PERMISSION_DENIED) return 'Ferro no tiene permiso de ubicación. Actívalo en los ajustes de Chrome para este sitio.'
  if (e.code === e.TIMEOUT) return 'El GPS ha tardado demasiado. Prueba otra vez cerca de una ventana.'
  return 'No se ha podido obtener la ubicación. ¿Está activada la ubicación del móvil?'
}
