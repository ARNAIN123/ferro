import { NavLink } from 'react-router'

const clase = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 flex-1 items-center justify-center rounded-xl text-sm font-semibold transition ${
    isActive ? 'bg-surface text-fg shadow-sm' : 'text-muted'
  }`

export function PestanasRutinas() {
  return (
    <nav aria-label="Secciones" className="mt-2 mb-5 flex rounded-2xl bg-surface-2 p-1">
      <NavLink to="/rutinas" end className={clase}>
        Rutinas
      </NavLink>
      <NavLink to="/rutinas/ejercicios" className={clase}>
        Ejercicios
      </NavLink>
    </nav>
  )
}
