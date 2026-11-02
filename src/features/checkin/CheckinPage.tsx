import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { registrarEntrada } from '../../db/checkin'
import { db } from '../../db/db'
import { empezarLoQueToca } from '../../db/entreno'
import { avisar } from '../../lib/avisos'
import { fmtHora } from '../../lib/formato'

/**
 * Enlace de check-in (/checkin o ?checkin=auto), pensado para MacroDroid:
 * registra la entrada y abre directamente el entreno del día.
 */
export function CheckinPage() {
  const navegar = useNavigate()
  const hecho = useRef(false)

  useEffect(() => {
    if (hecho.current) return
    hecho.current = true
    void (async () => {
      const r = await registrarEntrada('enlace')
      // Si en esta misma visita ya terminé un entreno, no empiezo otro.
      const sesionPrevia = r.entrada.sesionId ? await db.sesiones.get(r.entrada.sesionId) : undefined
      if (sesionPrevia?.estado === 'terminada') {
        avisar(`Entrada ya registrada a las ${fmtHora(r.entrada.hora)}`)
        return navegar('/', { replace: true })
      }
      if (await empezarLoQueToca('enlace')) return navegar('/entreno', { replace: true })
      avisar(r.registrada ? 'Entrada registrada. Crea tus rutinas para empezar.' : `Entrada ya registrada a las ${fmtHora(r.entrada.hora)}`)
      navegar('/', { replace: true })
    })()
  }, [navegar])

  return (
    <div className="grid h-dvh place-items-center bg-bg">
      <p className="condensada animate-pulse text-2xl font-bold text-muted">Registrando entrada…</p>
    </div>
  )
}

/** Atajo del manifest "Empezar entreno": retoma o empieza lo que toca. */
export function EmpezarPage() {
  const navegar = useNavigate()
  const hecho = useRef(false)
  useEffect(() => {
    if (hecho.current) return
    hecho.current = true
    void empezarLoQueToca('manual').then((ok) => navegar(ok ? '/entreno' : '/rutinas', { replace: true }))
  }, [navegar])
  return <div className="h-dvh bg-bg" />
}
