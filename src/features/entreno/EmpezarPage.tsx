import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { empezarLoQueToca } from '../../db/entreno'

/** Atajo del manifest "Empezar entreno": retoma o empieza lo que toca. */
export function EmpezarPage() {
  const navegar = useNavigate()
  const hecho = useRef(false)
  useEffect(() => {
    if (hecho.current) return
    hecho.current = true
    void empezarLoQueToca('entreno').then((ok) => navegar(ok ? '/entreno' : '/rutinas', { replace: true }))
  }, [navegar])
  return <div className="h-dvh bg-bg" />
}
