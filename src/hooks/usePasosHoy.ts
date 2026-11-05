import { App } from '@capacitor/app'
import { useCallback, useEffect, useRef, useState } from 'react'
import { inicioDia, sumarDias } from '../domain/semanas'
import { Salud, haySalud, type EstadoSalud } from '../lib/salud'

/** Cada cuánto se vuelven a leer los pasos mientras Hoy está abierta. */
const REFRESCO_MS = 5 * 60_000

export type SituacionPasos = 'web' | 'cargando' | 'no-disponible' | 'instalar' | 'sin-permiso' | 'ok' | 'error'

export interface PasosHoy {
  situacion: SituacionPasos
  /** Pasos de hoy (agregados por Health Connect). */
  pasos: number | null
  /** Pasos dados durante los entrenos de hoy, para no contarlos dos veces en las calorías. */
  pasosEnEntreno: number
  /** Último peso de Health Connect (por si no hay ninguno apuntado en Ferro). */
  pesoSalud: number | null
  conectar: () => Promise<void>
  abrirHealthConnect: () => Promise<void>
}

const situacionDe = (e: EstadoSalud): SituacionPasos =>
  e.disponible === 'no' ? 'no-disponible' : e.disponible === 'actualizar' ? 'instalar' : e.pasos ? 'ok' : 'sin-permiso'

/**
 * Pasos de hoy desde Health Connect. Se leen al abrir, al volver a la app y cada 5 minutos.
 * `entrenos` son los tramos [desde, hasta] de los entrenos de hoy (hasta = null: sigue en curso).
 */
export function usePasosHoy(entrenos: readonly { desde: number; hasta: number | null }[]): PasosHoy {
  const [situacion, setSituacion] = useState<SituacionPasos>(haySalud() ? 'cargando' : 'web')
  const [pasos, setPasos] = useState<number | null>(null)
  const [pasosEnEntreno, setPasosEnEntreno] = useState(0)
  const [pesoSalud, setPesoSalud] = useState<number | null>(null)
  const tramos = useRef(entrenos)
  const claveTramos = entrenos.map((t) => `${t.desde}-${t.hasta}`).join(',')
  useEffect(() => {
    tramos.current = entrenos
  })

  const leer = useCallback(async () => {
    if (!haySalud() || document.visibilityState !== 'visible') return
    try {
      const estado = await Salud.estado()
      const s = situacionDe(estado)
      setSituacion(s)
      if (s !== 'ok') return
      const ahora = Date.now()
      const dia = { desde: inicioDia(ahora), hasta: Math.min(ahora, sumarDias(inicioDia(ahora), 1)) }
      const r = await Salud.pasos({ tramos: [dia, ...tramos.current.map((t) => ({ desde: t.desde, hasta: t.hasta ?? ahora }))] })
      setPasos(r.pasos[0] ?? 0)
      setPasosEnEntreno(r.pasos.slice(1).reduce((t, n) => t + n, 0))
      if (estado.peso) {
        const p = await Salud.ultimoPeso().catch(() => ({}) as { kg?: number })
        setPesoSalud(p.kg ?? null)
      }
    } catch {
      setSituacion('error')
    }
  }, [])

  useEffect(() => {
    void leer()
  }, [leer, claveTramos])

  useEffect(() => {
    if (!haySalud()) return
    let activo = true
    const t = setInterval(() => void leer(), REFRESCO_MS)
    const alVolver = () => void leer()
    document.addEventListener('visibilitychange', alVolver)
    let quitar: (() => void) | null = null
    void App.addListener('appStateChange', ({ isActive }) => isActive && void leer()).then((h) => {
      if (activo) quitar = () => void h.remove()
      else void h.remove()
    })
    return () => {
      activo = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
      quitar?.()
    }
  }, [leer])

  const conectar = useCallback(async () => {
    if (!haySalud()) return
    try {
      const e = await Salud.pedirPermisos()
      setSituacion(situacionDe(e))
      await leer()
    } catch {
      setSituacion('error')
    }
  }, [leer])

  const abrirHealthConnect = useCallback(async () => {
    if (haySalud()) await Salud.abrirHealthConnect().catch(() => {})
  }, [])

  return { situacion, pasos, pasosEnEntreno, pesoSalud, conectar, abrirHealthConnect }
}
