// Clave de la API de Anthropic (opcional). Se guarda solo en este dispositivo y NO entra en las
// copias de seguridad: así un archivo de copia compartido nunca lleva la clave.
import { useSyncExternalStore } from 'react'

const CLAVE = 'ferro.claveAnthropic'
const EVENTO = 'ferro-clave-ia'

export function leerClaveIA(): string {
  try {
    return localStorage.getItem(CLAVE) ?? ''
  } catch {
    return ''
  }
}

export function guardarClaveIA(valor: string): void {
  try {
    const limpia = valor.trim()
    if (limpia) localStorage.setItem(CLAVE, limpia)
    else localStorage.removeItem(CLAVE)
  } catch {
    // Sin almacenamiento local: la función de IA simplemente no estará disponible.
  }
  window.dispatchEvent(new Event(EVENTO))
}

const suscribir = (aviso: () => void) => {
  window.addEventListener(EVENTO, aviso)
  window.addEventListener('storage', aviso)
  return () => {
    window.removeEventListener(EVENTO, aviso)
    window.removeEventListener('storage', aviso)
  }
}

export function useClaveIA(): string {
  return useSyncExternalStore(suscribir, leerClaveIA, () => '')
}
