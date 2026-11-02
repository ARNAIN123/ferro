import { Link } from 'react-router'
import { Cabecera } from '../../components/Cabecera'
import { Icono } from '../../components/Icono'

export function ProgresoPage() {
  return (
    <>
      <Cabecera titulo="Progreso" />
      <Link
        to="/progreso/historial"
        className="mt-4 flex min-h-16 items-center gap-3 rounded-3xl border border-line bg-surface px-4 active:bg-surface-2"
      >
        <Icono nombre="historial" className="text-accent" />
        <span className="flex-1 font-semibold">Historial de entrenos</span>
        <Icono nombre="adelante" tamano={18} className="text-muted" />
      </Link>
    </>
  )
}
