import { App } from '@capacitor/app'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { esNativa } from '../lib/plataforma'

/** Ruta de la app a partir de un enlace ferro://app/… (accesos directos del icono). */
export function rutaDeEnlace(url: string): string | null {
  const m = /^ferro:\/\/app(\/[^#]*)?$/.exec(url.trim())
  if (!m) return null
  const ruta = m[1] || '/'
  return ruta.startsWith('/') ? ruta : `/${ruta}`
}

/**
 * Abre la pantalla que pide un acceso directo del icono (mantener pulsado → "Registrar peso"),
 * tanto si la app estaba cerrada como si ya estaba abierta.
 */
export function EnlacesNativos() {
  const navegar = useNavigate()
  useEffect(() => {
    if (!esNativa()) return
    let activo = true
    let quitar: (() => void) | null = null
    const ir = (url: string | undefined) => {
      const ruta = url ? rutaDeEnlace(url) : null
      if (ruta) navegar(ruta, { replace: true })
    }
    void App.getLaunchUrl().then((r) => activo && ir(r?.url))
    void App.addListener('appUrlOpen', (e) => ir(e.url)).then((h) => {
      if (activo) quitar = () => void h.remove()
      else void h.remove()
    })
    return () => {
      activo = false
      quitar?.()
    }
  }, [navegar])
  return null
}
